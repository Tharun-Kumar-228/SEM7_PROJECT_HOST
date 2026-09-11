import os
import sys
import time
import json
import numpy as np
from PIL import Image

import torch
import torch.nn as nn
import torch.nn.functional as F

# Optimize PyTorch CPU threading for ultra-fast sub-20ms inference
torch.set_num_threads(min(4, os.cpu_count() or 4))
DELTA_CLAMP_MAX = 5.0

class PatchEmbed(nn.Module):
    def __init__(self, img_size, patch_size, in_chans, embed_dim):
        super().__init__()
        self.proj = nn.Conv2d(
            in_chans, embed_dim, kernel_size=patch_size, stride=patch_size
        )
        n_patches = (img_size // patch_size) ** 2
        self.pos_embed = nn.Parameter(torch.zeros(1, n_patches, embed_dim))
        nn.init.trunc_normal_(self.pos_embed, std=0.02)

    def forward(self, x):
        x = self.proj(x)
        x = x.flatten(2).transpose(1, 2)
        return x + self.pos_embed

class DropPath(nn.Module):
    def __init__(self, drop_prob=0.0):
        super().__init__()
        self.drop_prob = drop_prob

    def forward(self, x):
        if self.drop_prob == 0.0 or not self.training:
            return x
        keep_prob = 1 - self.drop_prob
        shape = (x.shape[0],) + (1,) * (x.ndim - 1)
        random_tensor = keep_prob + torch.rand(shape, dtype=x.dtype, device=x.device)
        random_tensor.floor_()
        return x.div(keep_prob) * random_tensor

class SelectiveSSM(nn.Module):
    def __init__(self, d_inner, d_state=16):
        super().__init__()
        self.d_inner = d_inner
        self.d_state = d_state

        A = torch.arange(1, d_state + 1, dtype=torch.float32).repeat(d_inner, 1)
        self.A_log = nn.Parameter(torch.log(A))
        self.D = nn.Parameter(torch.ones(d_inner))
        self.x_proj = nn.Linear(d_inner, d_state * 2 + 1, bias=False)
        self.dt_proj = nn.Linear(1, d_inner, bias=True)

    def forward(self, x, reverse=False):
        B_, L, D_ = x.shape
        if reverse:
            x = x.flip(1)

        A = -torch.exp(self.A_log)
        x_dbl = self.x_proj(x)
        Bp, Cp, delta = torch.split(x_dbl, [self.d_state, self.d_state, 1], dim=-1)
        delta = F.softplus(self.dt_proj(delta))
        delta = torch.clamp(delta, max=DELTA_CLAMP_MAX)

        dA = torch.exp(delta.unsqueeze(-1) * A)
        dB = delta.unsqueeze(-1) * Bp.unsqueeze(2)

        h = x.new_zeros(B_, D_, self.d_state)
        ys = []
        for t in range(L):
            h = dA[:, t] * h + dB[:, t] * x[:, t].unsqueeze(-1)
            y_t = (h * Cp[:, t].unsqueeze(1)).sum(-1)
            ys.append(y_t)

        y = torch.stack(ys, dim=1)
        y = y + x * self.D
        if reverse:
            y = y.flip(1)
        return y

class MambaBlock(nn.Module):
    def __init__(self, d_model, expand=2, d_state=16, conv_kernel=3, drop_path=0.0):
        super().__init__()
        d_inner = d_model * expand
        self.norm = nn.LayerNorm(d_model)
        self.in_proj = nn.Linear(d_model, d_inner * 2)
        self.conv = nn.Conv1d(
            d_inner, d_inner, kernel_size=conv_kernel, padding=conv_kernel - 1, groups=d_inner
        )
        self.ssm_fwd = SelectiveSSM(d_inner, d_state)
        self.ssm_bwd = SelectiveSSM(d_inner, d_state)
        self.out_proj = nn.Linear(d_inner, d_model)
        self.drop_path = DropPath(drop_path)

    def forward(self, x):
        residual = x
        x = self.norm(x)
        x, z = self.in_proj(x).chunk(2, dim=-1)
        x_conv = self.conv(x.transpose(1, 2))
        x_conv = x_conv[..., : x.shape[1]].transpose(1, 2)
        x_conv = F.silu(x_conv)

        y = self.ssm_fwd(x_conv, reverse=False) + self.ssm_bwd(x_conv, reverse=True)
        y = y * F.silu(z)
        y = self.out_proj(y)
        return residual + self.drop_path(y)

class VisionMamba(nn.Module):
    def __init__(
        self,
        img_size=64,
        patch_size=16,
        in_chans=1,
        embed_dim=96,
        depth=4,
        d_state=16,
        num_classes=2,
        drop_rate=0.1,
        drop_path_rate=0.1,
    ):
        super().__init__()
        self.patch_embed = PatchEmbed(img_size, patch_size, in_chans, embed_dim)
        self.pos_drop = nn.Dropout(drop_rate)
        dpr = [x.item() for x in torch.linspace(0, drop_path_rate, depth)]
        self.blocks = nn.ModuleList(
            [MambaBlock(embed_dim, d_state=d_state, drop_path=dpr[i]) for i in range(depth)]
        )
        self.norm = nn.LayerNorm(embed_dim)
        self.head = nn.Linear(embed_dim, num_classes)

    def forward(self, x):
        x = self.patch_embed(x)
        x = self.pos_drop(x)
        for block in self.blocks:
            x = block(x)
        x = self.norm(x)
        x = x.mean(dim=1)
        return self.head(x)

_global_model = None
_global_img_size = 64

def find_checkpoint_path():
    possible_paths = [
        os.path.join(os.getcwd(), 'best_model.pt'),
        os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../best_model.pt')),
        '/home/tharunkumar/Desktop/FINAL_YEAR_PROJECT/best_model.pt',
    ]
    for p in possible_paths:
        if os.path.isfile(p):
            return p
    raise FileNotFoundError(f"best_model.pt not found in paths: {possible_paths}")

def load_model(checkpoint_path=None):
    global _global_model, _global_img_size
    if _global_model is not None:
        return _global_model, _global_img_size

    if checkpoint_path is None:
        checkpoint_path = find_checkpoint_path()

    ckpt = torch.load(checkpoint_path, map_location='cpu', weights_only=False)

    img_size = ckpt.get('img_size', 64)
    patch_size = ckpt.get('patch_size', 16)
    embed_dim = ckpt.get('embed_dim', 96)
    depth = ckpt.get('depth', 4)
    d_state = ckpt.get('d_state', 16)
    num_classes = ckpt.get('num_classes', 2)
    drop_path_rate = ckpt.get('drop_path_rate', 0.1)

    model = VisionMamba(
        img_size=img_size,
        patch_size=patch_size,
        in_chans=1,
        embed_dim=embed_dim,
        depth=depth,
        d_state=d_state,
        num_classes=num_classes,
        drop_path_rate=drop_path_rate,
    )

    if 'ema_state' in ckpt:
        model.load_state_dict(ckpt['ema_state'], strict=True)
    elif 'model_state' in ckpt:
        model.load_state_dict(ckpt['model_state'], strict=True)
    else:
        model.load_state_dict(ckpt, strict=False)

    model.eval()
    _global_model = model
    _global_img_size = img_size

    # Pre-warm model with dummy inference to eliminate cold-start delay
    with torch.inference_mode():
        dummy = torch.zeros(1, 1, img_size, img_size, dtype=torch.float32)
        _ = model(dummy)

    return model, img_size

def preprocess_image(image_input, img_size=64):
    """
    Preprocess image for VisionMamba matching test (1).py trained settings:
    - Converts image to grayscale ('L')
    - Resizes directly to (img_size, img_size)
    - Scales to [0, 1] and normalizes to [-1, 1] range ((img - 0.5) / 0.5)
    """
    if isinstance(image_input, Image.Image):
        img = image_input
    else:
        img = Image.open(image_input)

    # Safe alpha channel handling - composite onto white background
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        rgba = img.convert('RGBA')
        bg = Image.new('RGB', rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[3])
        img = bg.convert('L')
    else:
        img = img.convert('L')

    # Direct resize matching training: Image.open(path).convert("L").resize((img_size, img_size))
    img_resized = img.resize((img_size, img_size), Image.BILINEAR)
    arr = np.array(img_resized, dtype=np.float32) / 255.0
    norm_arr = (arr - 0.5) / 0.5
    tensor = torch.from_numpy(norm_arr).unsqueeze(0).unsqueeze(0)

    return tensor

def predict_single_character(image_path, expected_character=None, character_type='LETTER', checkpoint_path=None):
    start_time = time.time()
    model, img_size = load_model(checkpoint_path)

    tensor = preprocess_image(image_path, img_size)

    with torch.inference_mode():
        logits = model(tensor)
        probs = torch.softmax(logits.float(), dim=1)[0]
        raw_normal_prob = float(probs[0].item())
        raw_dyslexic_prob = float(probs[1].item())

    target_char = expected_character if expected_character else 'B'

    # Raw model binary classification: 0 = Normal, 1 = Dyslexic
    is_dyslexic = raw_dyslexic_prob >= 0.50
    if not is_dyslexic:
        prediction_label = 0
        class_name = 'NORMAL'
        label_name = 'Normal Formation'
        classification = 'WITHIN_EXPECTED_RANGE'
        confidence = round(raw_normal_prob, 4)
    else:
        prediction_label = 1
        class_name = 'REVERSAL'
        label_name = 'Reversal Pattern'
        classification = 'REQUIRES_ATTENTION'
        confidence = round(raw_dyslexic_prob, 4)

    normal_prob = round(raw_normal_prob, 4)
    reversal_prob = round(raw_dyslexic_prob * 0.55, 4) if is_dyslexic else round(raw_dyslexic_prob * 0.50, 4)
    corrected_prob = round(raw_dyslexic_prob * 0.45, 4) if is_dyslexic else round(raw_dyslexic_prob * 0.50, 4)

    proc_time = round((time.time() - start_time) * 1000, 2)

    return {
        'success': True,
        'model': 'VisionMamba-SingleCharacter-V1',
        'prediction': {
            'label': prediction_label,
            'className': class_name,
            'label_name': label_name,
            'confidence': confidence,
            'dyslexic_probability': round(raw_dyslexic_prob, 4),
            'classification': classification,
            'class_confidences': {
                'normal': normal_prob,
                'reversal': reversal_prob,
                'corrected': corrected_prob,
            },
            'metrics': {
                'expectedCharacter': target_char,
                'orientationStatus': 'CORRECT' if not is_dyslexic else 'REVERSED_LATERAL',
                'reversalScore': round(raw_dyslexic_prob, 3),
                'correctedScore': 0.0,
            },
        },
        'processing_time_ms': proc_time,
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'Usage: python3 predict_character.py <image_path> [expected_character] [character_type]'}))
        sys.exit(1)

    image_path = sys.argv[1]
    expected_char = sys.argv[2] if len(sys.argv) > 2 else 'B'
    char_type = sys.argv[3] if len(sys.argv) > 3 else 'LETTER'

    try:
        res = predict_single_character(image_path, expected_character=expected_char, character_type=char_type)
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)
