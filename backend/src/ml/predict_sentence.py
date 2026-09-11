import os
import sys
import time
import json
import numpy as np
from PIL import Image

import torch
import torch.nn as nn
import torch.nn.functional as F

# Optimize PyTorch CPU threading for fast inference
torch.set_num_threads(min(4, os.cpu_count() or 4))

def selective_scan(x, delta, A, B, C, D):
    batch, L, d_inner = x.shape
    N = A.shape[1]
    device, dtype = x.device, x.dtype
    deltaA = torch.exp(delta.unsqueeze(-1) * A.view(1, 1, d_inner, N))
    deltaB_x = delta.unsqueeze(-1) * B.unsqueeze(2) * x.unsqueeze(-1)
    h = torch.zeros(batch, d_inner, N, device=device, dtype=dtype)
    ys = []
    for t in range(L):
        h = deltaA[:, t] * h + deltaB_x[:, t]
        y_t = torch.einsum('bdn,bn->bd', h, C[:, t])
        ys.append(y_t)
    y = torch.stack(ys, dim=1)
    return y + x * D

class S6Core(nn.Module):
    def __init__(self, d_inner, d_state=16, dt_rank=None):
        super().__init__()
        self.d_inner = d_inner
        self.d_state = d_state
        self.dt_rank = dt_rank or max(1, d_inner // 16)
        self.x_proj = nn.Linear(d_inner, self.dt_rank + d_state * 2, bias=False)
        self.dt_proj = nn.Linear(self.dt_rank, d_inner, bias=True)
        A = torch.arange(1, d_state + 1, dtype=torch.float32).repeat(d_inner, 1)
        self.A_log = nn.Parameter(torch.log(A))
        self.D = nn.Parameter(torch.ones(d_inner))

    def forward(self, x):
        x_dbl = self.x_proj(x)
        dt, Bp, Cp = torch.split(x_dbl, [self.dt_rank, self.d_state, self.d_state], dim=-1)
        delta = F.softplus(self.dt_proj(dt))
        A = -torch.exp(self.A_log)
        return selective_scan(x, delta, A, Bp, Cp, self.D)

class SS2D(nn.Module):
    def __init__(self, d_model, d_state=16, d_conv=3, expand=2):
        super().__init__()
        self.d_model = d_model
        self.d_inner = expand * d_model
        self.in_proj = nn.Linear(d_model, self.d_inner * 2, bias=False)
        self.conv2d = nn.Conv2d(
            self.d_inner, self.d_inner, kernel_size=d_conv,
            padding=d_conv // 2, groups=self.d_inner, bias=True
        )
        self.core = S6Core(self.d_inner, d_state=d_state)
        self.out_norm = nn.LayerNorm(self.d_inner)
        self.out_proj = nn.Linear(self.d_inner, d_model, bias=False)

    def forward(self, x):
        B, H, W, C = x.shape
        x_and_res = self.in_proj(x)
        x_in, res = x_and_res.chunk(2, dim=-1)

        x_in = x_in.permute(0, 3, 1, 2)
        x_in = self.conv2d(x_in)
        x_in = F.silu(x_in)

        seq_row_fwd = x_in.flatten(2).transpose(1, 2)
        seq_row_bwd = torch.flip(seq_row_fwd, dims=[1])
        seq_col_fwd = x_in.transpose(2, 3).flatten(2).transpose(1, 2)
        seq_col_bwd = torch.flip(seq_col_fwd, dims=[1])

        y_row_fwd = self.core(seq_row_fwd)
        y_row_bwd = torch.flip(self.core(seq_row_bwd), dims=[1])
        y_col_fwd = self.core(seq_col_fwd)
        y_col_bwd = torch.flip(self.core(seq_col_bwd), dims=[1])

        y_row_fwd = y_row_fwd.transpose(1, 2).reshape(B, self.d_inner, H, W).permute(0, 2, 3, 1)
        y_row_bwd = y_row_bwd.transpose(1, 2).reshape(B, self.d_inner, H, W).permute(0, 2, 3, 1)
        y_col_fwd = y_col_fwd.transpose(1, 2).reshape(B, self.d_inner, W, H).permute(0, 3, 2, 1)
        y_col_bwd = y_col_bwd.transpose(1, 2).reshape(B, self.d_inner, W, H).permute(0, 3, 2, 1)

        y = y_row_fwd + y_row_bwd + y_col_fwd + y_col_bwd
        y = self.out_norm(y)
        y = y * F.silu(res)
        return self.out_proj(y)

class VSSBlock(nn.Module):
    def __init__(self, d_model, d_state=16, expand=2, mlp_ratio=2.0, drop_path=0.0):
        super().__init__()
        self.norm1 = nn.LayerNorm(d_model)
        self.ss2d = SS2D(d_model, d_state=d_state, expand=expand)
        self.drop_path = nn.Dropout(drop_path) if drop_path > 0 else nn.Identity()
        hidden = int(d_model * mlp_ratio)
        self.norm2 = nn.LayerNorm(d_model)
        self.mlp = nn.Sequential(nn.Linear(d_model, hidden), nn.GELU(), nn.Linear(hidden, d_model))

    def forward(self, x):
        x = x + self.drop_path(self.ss2d(self.norm1(x)))
        x = x + self.drop_path(self.mlp(self.norm2(x)))
        return x

class PatchEmbed2D(nn.Module):
    def __init__(self, img_size=96, patch_size=8, in_chans=3, embed_dim=64):
        super().__init__()
        self.grid_size = img_size // patch_size
        self.proj = nn.Conv2d(in_chans, embed_dim, kernel_size=patch_size, stride=patch_size)

    def forward(self, x):
        x = self.proj(x)
        return x.permute(0, 2, 3, 1)

class VMamba2D(nn.Module):
    def __init__(self, img_size=96, patch_size=8, in_chans=3, num_classes=2, embed_dim=64, depth=4, d_state=16, expand=2, drop_rate=0.1, drop_path_rate=0.1):
        super().__init__()
        self.patch_embed = PatchEmbed2D(img_size, patch_size, in_chans, embed_dim)
        self.pos_drop = nn.Dropout(drop_rate)
        dpr = [x.item() for x in torch.linspace(0, drop_path_rate, depth)]
        self.blocks = nn.ModuleList([VSSBlock(embed_dim, d_state=d_state, expand=expand, drop_path=dpr[i]) for i in range(depth)])
        self.norm = nn.LayerNorm(embed_dim)
        self.head = nn.Sequential(nn.Dropout(drop_rate), nn.Linear(embed_dim, num_classes))

    def forward(self, x):
        x = self.patch_embed(x)
        x = self.pos_drop(x)
        for blk in self.blocks:
            x = blk(x)
        x = self.norm(x)
        x = x.mean(dim=[1, 2])
        return self.head(x)

_global_sentence_model = None
_global_img_size = 96

def find_dysgraphia_checkpoint():
    possible_paths = [
        os.path.join(os.getcwd(), 'dysgraphia/vmamba_dysgraphia_final.pt'),
        os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../dysgraphia/vmamba_dysgraphia_final.pt')),
        '/home/tharunkumar/Desktop/FINAL_YEAR_PROJECT/dysgraphia/vmamba_dysgraphia_final.pt',
    ]
    for p in possible_paths:
        if os.path.isfile(p):
            return p
    raise FileNotFoundError(f"vmamba_dysgraphia_final.pt not found in paths: {possible_paths}")

def load_sentence_model(checkpoint_path=None):
    global _global_sentence_model, _global_img_size
    if _global_sentence_model is not None:
        return _global_sentence_model, _global_img_size

    if checkpoint_path is None:
        checkpoint_path = find_dysgraphia_checkpoint()

    ckpt = torch.load(checkpoint_path, map_location='cpu', weights_only=False)

    img_size = ckpt.get('img_size', 96)
    model = VMamba2D(img_size=img_size, patch_size=8, in_chans=3, num_classes=2, embed_dim=64, depth=4, d_state=16)

    if 'model_state' in ckpt:
        model.load_state_dict(ckpt['model_state'], strict=True)
    elif 'state_dict' in ckpt:
        model.load_state_dict(ckpt['state_dict'], strict=True)
    else:
        model.load_state_dict(ckpt, strict=False)

    model.eval()
    _global_sentence_model = model
    _global_img_size = img_size

    # Pre-warm model with dummy inference to eliminate cold-start delay
    with torch.inference_mode():
        dummy = torch.zeros(1, 3, img_size, img_size, dtype=torch.float32)
        _ = model(dummy)

    return model, img_size

def analyze_sentence_spatial(img):
    """
    Extracts geometric & spatial motor metrics from sentence handwriting:
    - Baseline drift / curvature (identifying descending or wavy lines)
    - Inter-word spacing regularity
    - Line tilt / slope
    """
    arr = np.array(img.convert('L'), dtype=np.uint8)
    if np.mean(arr) < 127:
        arr = 255 - arr

    ink_mask = arr < 210
    if not np.any(ink_mask):
        return {
            'baseline_drift': 0.0,
            'line_slope': 0.0,
            'spacing_variance': 0.0,
            'dysgraphia_score': 0.15,
            'ink_box': None,
        }

    y_idx, x_idx = np.where(ink_mask)
    min_x, max_x = int(np.min(x_idx)), int(np.max(x_idx))
    min_y, max_y = int(np.min(y_idx)), int(np.max(y_idx))
    w_box = max(1, max_x - min_x + 1)
    h_box = max(1, max_y - min_y + 1)

    # Divide line into 8 horizontal segments to sample the baseline progression
    num_bins = 8
    bin_width = max(1, w_box // num_bins)
    baseline_points = []
    for b in range(num_bins):
        bx_start = min_x + b * bin_width
        bx_end = min(max_x + 1, bx_start + bin_width)
        sub_mask = ink_mask[:, bx_start:bx_end]
        if np.any(sub_mask):
            sub_y, _ = np.where(sub_mask)
            baseline_points.append(float(np.percentile(sub_y, 85)))

    baseline_drift = 0.0
    slope_abs = 0.0
    if len(baseline_points) >= 4:
        xs = np.arange(len(baseline_points))
        slope, intercept = np.polyfit(xs, baseline_points, 1)
        fitted = slope * xs + intercept
        residuals = np.abs(baseline_points - fitted)
        baseline_drift = float(np.mean(residuals))
        slope_abs = float(abs(slope))

    # Inter-word spacing consistency
    vert_proj = np.sum(ink_mask[min_y:max_y + 1, min_x:max_x + 1], axis=0)
    zero_runs = np.diff(np.where(vert_proj == 0)[0])
    word_gaps = zero_runs[zero_runs > 2]
    spacing_var = float(np.std(word_gaps)) if len(word_gaps) > 1 else 0.0

    # Composite motor indicator (0.0 to 1.0)
    drift_factor = min(1.0, baseline_drift / 14.0)
    slope_factor = min(1.0, slope_abs / 5.0)
    spacing_factor = min(1.0, spacing_var / 12.0)
    dysgraphia_score = round(0.45 * drift_factor + 0.30 * slope_factor + 0.25 * spacing_factor, 3)

    return {
        'baseline_drift': round(baseline_drift, 2),
        'line_slope': round(slope_abs, 2),
        'spacing_variance': round(spacing_var, 2),
        'dysgraphia_score': dysgraphia_score,
        'ink_box': (min_x, min_y, max_x, max_y),
    }

def preprocess_sentence_image(image_input, img_size=96):
    """
    Safely preprocess sentence image for VMamba2D:
    - Resolves alpha channels onto white
    - Preserves aspect ratio with letterbox centering onto square white canvas
    - Extracts spatial motor metrics
    - Applies standard ImageNet normalization
    """
    if isinstance(image_input, Image.Image):
        img = image_input
    else:
        img = Image.open(image_input)

    # Safe alpha channel handling
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        rgba = img.convert('RGBA')
        bg = Image.new('RGB', rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[3])
        img = bg
    else:
        img = img.convert('RGB')

    # Analyze spatial handwriting metrics
    metrics = analyze_sentence_spatial(img)
    ink_box = metrics.get('ink_box')

    if ink_box:
        min_x, min_y, max_x, max_y = ink_box
        pad_x = int((max_x - min_x) * 0.08)
        pad_y = int((max_y - min_y) * 0.15)
        crop_x0 = max(0, min_x - pad_x)
        crop_y0 = max(0, min_y - pad_y)
        crop_x1 = min(img.width, max_x + pad_x + 1)
        crop_y1 = min(img.height, max_y + pad_y + 1)
        cropped = img.crop((crop_x0, crop_y0, crop_x1, crop_y1))
    else:
        cropped = img

    # Aspect-ratio preserving letterbox resize
    w, h = cropped.size
    scale = min(img_size / max(1, w), img_size / max(1, h))
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    scaled = cropped.resize((new_w, new_h), Image.BILINEAR)

    letterbox = Image.new('RGB', (img_size, img_size), (255, 255, 255))
    paste_x = (img_size - new_w) // 2
    paste_y = (img_size - new_h) // 2
    letterbox.paste(scaled, (paste_x, paste_y))

    arr = np.array(letterbox, dtype=np.float32) / 255.0

    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = (arr - mean) / std

    arr = np.transpose(arr, (2, 0, 1))
    tensor = torch.from_numpy(arr).unsqueeze(0)
    return tensor, metrics

def predict_single_sentence(image_path, expected_sentence=None, checkpoint_path=None):
    start_time = time.time()
    model, img_size = load_sentence_model(checkpoint_path)
    tensor, metrics = preprocess_sentence_image(image_path, img_size)

    with torch.inference_mode():
        logits = model(tensor)
        # Apply temperature calibration
        scaled_logits = logits.float() / 0.5
        probs = torch.softmax(scaled_logits, dim=1)[0]
        raw_lpd = float(probs[0].item())
        raw_pd = float(probs[1].item())

    # Combine deep VMamba2D features with spatial handwriting motor indicators
    spatial_score = metrics.get('dysgraphia_score', 0.2)

    # Weighted synthesis: 60% deep neural representation + 40% spatial line geometry
    combined_pd = 0.60 * raw_pd + 0.40 * spatial_score

    # Determine final calibrated probabilities
    if spatial_score >= 0.38 or combined_pd >= 0.50:
        pd_prob = round(min(0.95, max(0.60, combined_pd * 1.15)), 4)
        lpd_prob = round(1.0 - pd_prob, 4)
        prediction_label = 1
        class_name = 'POTENTIAL_DYSGRAPHIA'
        label_name = 'Potential Dysgraphia (PD)'
        classification = 'REQUIRES_ATTENTION'
        confidence = pd_prob
    else:
        lpd_prob = round(min(0.96, max(0.65, (1.0 - combined_pd) * 1.15)), 4)
        pd_prob = round(1.0 - lpd_prob, 4)
        prediction_label = 0
        class_name = 'LOW_POTENTIAL_DYSGRAPHIA'
        label_name = 'Low Potential Dysgraphia (LPD)'
        classification = 'WITHIN_EXPECTED_RANGE'
        confidence = lpd_prob

    proc_time = round((time.time() - start_time) * 1000, 2)

    return {
        'success': True,
        'model': 'VMamba2D-Dysgraphia-Sentence-V1',
        'prediction': {
            'label': prediction_label,
            'className': class_name,
            'label_name': label_name,
            'confidence': confidence,
            'dysgraphia_probability': pd_prob,
            'classification': classification,
            'class_confidences': {
                'low_potential_dysgraphia': lpd_prob,
                'potential_dysgraphia': pd_prob,
            },
            'metrics': {
                'baselineDrift': metrics.get('baseline_drift', 0.0),
                'lineSlope': metrics.get('line_slope', 0.0),
                'spacingVariance': metrics.get('spacing_variance', 0.0),
                'spatialScore': spatial_score,
            },
        },
        'processing_time_ms': proc_time,
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'Usage: python3 predict_sentence.py <image_path> [expected_sentence]'}))
        sys.exit(1)

    image_path = sys.argv[1]
    expected_sentence = sys.argv[2] if len(sys.argv) > 2 else None
    try:
        res = predict_single_sentence(image_path, expected_sentence=expected_sentence)
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)
