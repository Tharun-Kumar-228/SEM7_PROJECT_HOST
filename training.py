# ============================================================
# VISION MAMBA - DYSLEXIA HANDWRITING CLASSIFIER (V2)
# WINDOWS + NVIDIA RTX 3050 6GB — STABILITY + GENERALIZATION PASS
#
# Why V1 needed this: val acc 97.65% but held-out TEST acc only
# 86.78%, and "Reversal" class specifically dropped to 76.60%.
# That gap is classic overfitting to the exact training pixels,
# not a capacity problem — so the fixes below are almost all
# about regularization/stability, NOT a bigger/different model.
# Architecture is still Vision Mamba (your novelty) — unchanged
# in kind, only made numerically steadier.
#
# WHAT CHANGED VS V1, AND WHY:
#
#  1. ON-THE-FLY GPU AUGMENTATION (biggest fix for the gap).
#     V1 preloads raw pixels and trains on the exact same 150k
#     images every epoch with zero variation — the model can
#     memorize them. Augmentation is applied AFTER the batch is
#     already on the GPU (affine_grid/grid_sample), so it costs
#     almost nothing and doesn't touch your fast RAM-preload path.
#     Small random rotation (+/-8deg), translation, scale, and
#     light random erasing.
#     IMPORTANT: NO horizontal/vertical flips. Your task is
#     literally b/d, p/q-style reversal detection — flipping a
#     letter can silently turn a "normal" sample into a real
#     mirror-image and corrupt the label. Never add flip augmentation
#     here even if you're tempted for "more data".
#
#  2. SELECTIVE-SCAN STABILITY CLAMP.
#     delta = softplus(...) is unbounded above. In the recurrence
#     h = exp(delta*A)*h + ..., an occasional large delta can blow
#     the state up and spike the loss for a batch or two — this is
#     a very plausible source of the "fluctuation" you're seeing,
#     independent of augmentation. Clamped to a sane max.
#
#  3. GRADIENT CLIPPING (max norm 1.0). Cheap, standard, reduces
#     epoch-to-epoch loss spikes from the recurrent SSM scan.
#
#  4. ADAMW + LINEAR WARMUP -> COSINE. Plain Adam mixes weight
#     decay into the gradient; AdamW decouples it properly. A short
#     warmup avoids the first few unstable steps that LayerNorm+SSM
#     combos are prone to.
#
#  5. LABEL SMOOTHING (0.05). Keeps the model from getting
#     overconfident on the exact training samples — directly
#     targets the "val 97%, test 87%" overconfidence gap.
#
#  6. STOCHASTIC DEPTH (DropPath) across the 4 Mamba blocks.
#     Standard regularizer for transformer/SSM-style stacks,
#     basically free.
#
#  7. EMA (exponential moving average) OF WEIGHTS.
#     This is the direct fix for "fluctuation": EMA weights are a
#     running average over ~1000 steps, so epoch-to-epoch validation
#     metrics stop bouncing around and best-checkpoint selection
#     becomes reliable. Both raw and EMA weights are saved; use
#     EMA for your final test.
#
#  8. CHECKPOINT SELECTION BY VALIDATION BALANCED ACCURACY
#     (computed on EMA weights), not raw val_loss. With your class
#     imbalance, loss can improve while the minority class (and
#     specifically Reversal) quietly gets worse. Balanced accuracy
#     + a per-original-class breakdown (normal/reversal/corrected)
#     is printed every epoch so you can watch Reversal specifically.
#
#  9. Preload, label mapping, checkpoint directory logic: UNCHANGED.
#
# Saves (per epoch + best):
#   checkpoints/checkpoint_epoch_NN.pt  (has "model_state" + "ema_state")
#   checkpoints/best_model.pt           (selected on EMA balanced accuracy)
# ============================================================

import os
import glob
import time
import math
import random
import numpy as np
import pandas as pd

from PIL import Image
try:
    from tqdm import tqdm
except ImportError:
    def tqdm(iterable, *args, **kwargs):
        return iterable

import torch
import torch.nn as nn
import torch.nn.functional as F

from torch.utils.data import (
    Dataset,
    DataLoader,
    WeightedRandomSampler
)

try:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import f1_score, balanced_accuracy_score
except ImportError:
    def train_test_split(indices, test_size=0.15, random_state=42, stratify=None):
        indices = np.array(indices)
        rng = np.random.RandomState(random_state)
        if stratify is not None:
            stratify = np.array(stratify)
            train_idx, val_idx = [], []
            for cls in np.unique(stratify):
                cls_indices = indices[stratify == cls]
                rng.shuffle(cls_indices)
                n_val = int(len(cls_indices) * test_size)
                val_idx.extend(cls_indices[:n_val])
                train_idx.extend(cls_indices[n_val:])
            return np.array(train_idx), np.array(val_idx)
        else:
            shuffled = indices.copy()
            rng.shuffle(shuffled)
            n_val = int(len(shuffled) * test_size)
            return shuffled[n_val:], shuffled[:n_val]

    def balanced_accuracy_score(y_true, y_pred):
        y_true, y_pred = np.array(y_true), np.array(y_pred)
        rec_0 = np.sum((y_true == 0) & (y_pred == 0)) / max(1, np.sum(y_true == 0))
        rec_1 = np.sum((y_true == 1) & (y_pred == 1)) / max(1, np.sum(y_true == 1))
        return float((rec_0 + rec_1) / 2.0)

    def f1_score(y_true, y_pred, pos_label=1, average=None, zero_division=0):
        y_true, y_pred = np.array(y_true), np.array(y_pred)
        if average == "macro":
            f0 = f1_score(y_true, y_pred, pos_label=0, zero_division=zero_division)
            f1 = f1_score(y_true, y_pred, pos_label=1, zero_division=zero_division)
            return float((f0 + f1) / 2.0)
        tp = np.sum((y_true == pos_label) & (y_pred == pos_label))
        prec = tp / max(1, np.sum(y_pred == pos_label)) if np.sum(y_pred == pos_label) > 0 else zero_division
        rec = tp / max(1, np.sum(y_true == pos_label)) if np.sum(y_true == pos_label) > 0 else zero_division
        return float(2 * prec * rec / max(1e-8, prec + rec)) if (prec + rec) > 0 else float(zero_division)


# ============================================================
# 1. CONFIGURATION
# ============================================================

SEED = 42

DATASET_ROOT = os.environ.get(
    "DYSLEXIA_DATASET_ROOT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "datasets", "dyslexic"))
)

IMG_SIZE = 64
PATCH_SIZE = 16
IN_CHANS = 1

EMBED_DIM = 96
DEPTH = 4
D_STATE = 16
DROP_PATH_RATE = 0.1          # stochastic depth, linspace 0 -> this across the 4 blocks
DELTA_CLAMP_MAX = 5.0         # stability clamp on the SSM's softplus(dt), see header note #2

NUM_CLASSES = 2

EPOCHS = 20
LR = 3e-4
WEIGHT_DECAY = 1e-4
WARMUP_EPOCHS = 2
LABEL_SMOOTHING = 0.05
GRAD_CLIP_NORM = 1.0
EMA_DECAY = 0.999

PATIENCE = 7

BATCH_SIZE = 256
NUM_WORKERS = 0
VAL_SIZE = 0.15

# --- augmentation (train only, applied on GPU after batching) ---
AUG_ENABLED = True
AUG_DEGREES = 8.0
AUG_TRANSLATE = 0.06
AUG_SCALE = (0.92, 1.08)
AUG_ERASE_PROB = 0.25
AUG_ERASE_MAX_FRAC = 0.18
# Background value AFTER normalization to assume for erased patches.
# Preprocessing does img/255 -> (x-0.5)/0.5, so a white paper background
# (255) becomes +1.0 and dark ink becomes negative. If your scans have
# a DARK background instead, flip this to -1.0.
AUG_ERASE_VALUE = 1.0

CHECKPOINT_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "checkpoints"
)


# ============================================================
# 2. DATASET COLLECTION (paths + labels only, not pixels yet)
# ============================================================

def collect_images(folder):
    extensions = ["*.png", "*.jpg", "*.jpeg", "*.bmp", "*.tif", "*.tiff"]
    files = []
    for ext in extensions:
        files.extend(glob.glob(os.path.join(folder, "**", ext), recursive=True))
    return files


def build_manifest():
    def find_dir(parent, candidates):
        for c in candidates:
            p = os.path.join(parent, c)
            if os.path.isdir(p):
                return p
        return os.path.join(parent, candidates[0])

    train_base = find_dir(DATASET_ROOT, ["Train", "train"])
    train_normal_dir    = find_dir(train_base, ["Normal", "normal"])
    train_reversal_dir  = find_dir(train_base, ["Reversal", "reversal"])
    train_corrected_dir = find_dir(train_base, ["Corrected", "corrected"])

    required_dirs = [train_normal_dir, train_reversal_dir, train_corrected_dir]
    for folder in required_dirs:
        if not os.path.isdir(folder):
            raise FileNotFoundError(
                f"\nDataset folder not found:\n{folder}\n\nPlease check DATASET_ROOT."
            )

    normal_train    = collect_images(train_normal_dir)
    reversal_train  = collect_images(train_reversal_dir)
    corrected_train = collect_images(train_corrected_dir)

    print()
    print("TRAIN DATA")
    print("-" * 70)
    print(f"Normal    : {len(normal_train):,}")
    print(f"Reversal  : {len(reversal_train):,}")
    print(f"Corrected : {len(corrected_train):,}")
    print(f"Total     : {len(normal_train) + len(reversal_train) + len(corrected_train):,}")

    rows = []
    for path in normal_train:
        rows.append({"path": path, "label": 0, "original_class": "normal"})
    for path in reversal_train:
        rows.append({"path": path, "label": 1, "original_class": "reversal"})
    for path in corrected_train:
        rows.append({"path": path, "label": 1, "original_class": "corrected"})

    return pd.DataFrame(rows)


# ============================================================
# 3. PRELOAD ALL IMAGES INTO RAM (unchanged approach from V1)
# ============================================================

def preload_images(df, img_size=IMG_SIZE, desc="Preloading"):
    """Decode + resize every image ONCE and hold it as a single uint8
    tensor in memory. Returns tensors PLUS the filtered dataframe (rows
    dropped for bad images are removed) so original_class stays aligned
    with the returned tensors for per-class reporting later."""
    n = len(df)
    buffer = np.empty((n, img_size, img_size), dtype=np.uint8)
    labels = df["label"].values.astype(np.int64)

    bad_indices = []
    for i, path in enumerate(tqdm(df["path"].values, desc=desc)):
        try:
            img = Image.open(path).convert("L").resize((img_size, img_size))
            buffer[i] = np.array(img, dtype=np.uint8)
        except Exception as e:
            print(f"WARNING: failed to load {path}: {e} -- skipping")
            bad_indices.append(i)

    keep_df = df
    if bad_indices:
        keep_mask = np.ones(n, dtype=bool)
        keep_mask[bad_indices] = False
        buffer = buffer[keep_mask]
        labels = labels[keep_mask]
        keep_df = df.iloc[keep_mask].reset_index(drop=True)

    images_tensor = torch.from_numpy(buffer)          # (N, H, W) uint8
    labels_tensor = torch.from_numpy(labels)           # (N,) int64
    return images_tensor, labels_tensor, keep_df


class PreloadedDataset(Dataset):
    """Indexes an in-memory uint8 tensor -- no disk I/O, no PIL, per item."""
    def __init__(self, images_tensor, labels_tensor):
        self.images = images_tensor
        self.labels = labels_tensor

    def __len__(self):
        return self.images.shape[0]

    def __getitem__(self, idx):
        img = self.images[idx].float() / 255.0          # (H, W) -> 0..1
        img = (img - 0.5) / 0.5                           # -> -1..1
        return img.unsqueeze(0), int(self.labels[idx])    # (1, H, W), label


# ============================================================
# 3b. GPU-SIDE AUGMENTATION (applied to whole batch, train only)
# ============================================================

def random_affine_batch(x, degrees=AUG_DEGREES, translate=AUG_TRANSLATE, scale_range=AUG_SCALE):
    """Random small rotation/translation/scale, batched, on-GPU.
    Deliberately no flips -- see header note #1."""
    B = x.size(0)
    device = x.device

    angles = (torch.rand(B, device=device) * 2 - 1) * degrees * math.pi / 180.0
    tx = (torch.rand(B, device=device) * 2 - 1) * translate
    ty = (torch.rand(B, device=device) * 2 - 1) * translate
    scales = torch.empty(B, device=device).uniform_(*scale_range)

    cos = torch.cos(angles) * scales
    sin = torch.sin(angles) * scales

    theta = torch.zeros(B, 2, 3, device=device, dtype=x.dtype)
    theta[:, 0, 0] = cos
    theta[:, 0, 1] = -sin
    theta[:, 0, 2] = tx
    theta[:, 1, 0] = sin
    theta[:, 1, 1] = cos
    theta[:, 1, 2] = ty

    grid = F.affine_grid(theta, x.size(), align_corners=False)
    x = F.grid_sample(x, grid, align_corners=False, padding_mode="zeros", mode="bilinear")
    return x


def random_erasing_batch(x, p=AUG_ERASE_PROB, max_frac=AUG_ERASE_MAX_FRAC, erase_value=AUG_ERASE_VALUE):
    """Blanks a small random rectangle in some samples -- cheap robustness
    regularizer, forces the model to not rely on one exact stroke pixel-run."""
    B, C, H, W = x.shape
    hit = torch.rand(B, device=x.device) < p
    idxs = torch.nonzero(hit).flatten().tolist()
    for i in idxs:
        eh = random.randint(2, max(2, int(H * max_frac)))
        ew = random.randint(2, max(2, int(W * max_frac)))
        top = random.randint(0, H - eh)
        left = random.randint(0, W - ew)
        x[i, :, top:top + eh, left:left + ew] = erase_value
    return x


def gpu_augment(x):
    x = random_affine_batch(x)
    x = random_erasing_batch(x)
    return x


# ============================================================
# 4. MODEL: VISION MAMBA (bidirectional selective SSM)
# ============================================================

class PatchEmbed(nn.Module):
    def __init__(self, img_size=IMG_SIZE, patch_size=PATCH_SIZE, in_chans=IN_CHANS, embed_dim=EMBED_DIM):
        super().__init__()
        self.proj = nn.Conv2d(in_chans, embed_dim, kernel_size=patch_size, stride=patch_size)
        n_patches = (img_size // patch_size) ** 2
        self.pos_embed = nn.Parameter(torch.zeros(1, n_patches, embed_dim))
        nn.init.trunc_normal_(self.pos_embed, std=0.02)

    def forward(self, x):
        x = self.proj(x)
        x = x.flatten(2).transpose(1, 2)
        return x + self.pos_embed


class DropPath(nn.Module):
    """Stochastic depth: randomly zeroes an entire sample's residual branch
    during training. Standard regularizer for deep transformer/SSM stacks."""
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
        delta = torch.clamp(delta, max=DELTA_CLAMP_MAX)  # stability, see header note #2

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
        self.conv = nn.Conv1d(d_inner, d_inner, kernel_size=conv_kernel,
                               padding=conv_kernel - 1, groups=d_inner)
        self.ssm_fwd = SelectiveSSM(d_inner, d_state)
        self.ssm_bwd = SelectiveSSM(d_inner, d_state)
        self.out_proj = nn.Linear(d_inner, d_model)
        self.drop_path = DropPath(drop_path)

    def forward(self, x):
        residual = x
        x = self.norm(x)
        x, z = self.in_proj(x).chunk(2, dim=-1)

        x_conv = self.conv(x.transpose(1, 2))[..., :x.shape[1]].transpose(1, 2)
        x_conv = F.silu(x_conv)

        y = self.ssm_fwd(x_conv, reverse=False) + self.ssm_bwd(x_conv, reverse=True)
        y = y * F.silu(z)
        y = self.out_proj(y)
        return residual + self.drop_path(y)


class VisionMamba(nn.Module):
    def __init__(self, img_size=IMG_SIZE, patch_size=PATCH_SIZE, in_chans=IN_CHANS,
                 embed_dim=EMBED_DIM, depth=DEPTH, d_state=D_STATE,
                 num_classes=NUM_CLASSES, drop_rate=0.1, drop_path_rate=DROP_PATH_RATE):
        super().__init__()
        self.patch_embed = PatchEmbed(img_size, patch_size, in_chans, embed_dim)
        self.pos_drop = nn.Dropout(drop_rate)
        dpr = [x.item() for x in torch.linspace(0, drop_path_rate, depth)]
        self.blocks = nn.ModuleList([
            MambaBlock(embed_dim, d_state=d_state, drop_path=dpr[i]) for i in range(depth)
        ])
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


# ============================================================
# 5. EMA (exponential moving average of weights)
# ============================================================

class EMA:
    """Keeps a running-average copy of the model's weights. Used both to
    stabilize which epoch looks 'best' and, at inference, usually
    generalizes better than the raw last-step weights."""
    def __init__(self, model, decay=EMA_DECAY):
        self.decay = decay
        self.shadow = {k: v.detach().clone() for k, v in model.state_dict().items()}
        self.backup = None

    def update(self, model):
        with torch.no_grad():
            for k, v in model.state_dict().items():
                if v.dtype.is_floating_point:
                    self.shadow[k].mul_(self.decay).add_(v.detach(), alpha=1 - self.decay)
                else:
                    self.shadow[k] = v.detach().clone()

    def apply_shadow(self, model):
        self.backup = {k: v.detach().clone() for k, v in model.state_dict().items()}
        model.load_state_dict(self.shadow, strict=True)

    def restore(self, model):
        model.load_state_dict(self.backup, strict=True)
        self.backup = None


# ============================================================
# 6. TRAIN / VALIDATE
# ============================================================

def run_train_epoch(model, loader, device, criterion, optimizer, scaler, ema):
    model.train()
    total_loss, correct, total = 0.0, 0, 0

    progress = tqdm(loader, desc="Training", leave=False)
    for x, y in progress:
        x = x.to(device, non_blocking=True)
        y = y.to(device, non_blocking=True)

        if AUG_ENABLED:
            x = gpu_augment(x)

        optimizer.zero_grad(set_to_none=True)

        with torch.autocast(device_type=device.type, enabled=(device.type == "cuda")):
            logits = model(x)
            loss = criterion(logits, y)

        scaler.scale(loss).backward()
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), GRAD_CLIP_NORM)
        scaler.step(optimizer)
        scaler.update()

        ema.update(model)

        total_loss += loss.item() * x.size(0)
        correct += (logits.argmax(dim=1) == y).sum().item()
        total += x.size(0)
        progress.set_postfix(loss=f"{loss.item():.4f}")

    return total_loss / total, correct / total


def evaluate(model, loader, device, criterion, orig_classes=None):
    """Full validation pass: loss, accuracy, macro-F1, balanced accuracy,
    and (if orig_classes given) per-original-class accuracy so you can
    watch Reversal specifically."""
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    all_preds, all_labels = [], []

    with torch.no_grad():
        for x, y in tqdm(loader, desc="Validation", leave=False):
            x = x.to(device, non_blocking=True)
            y = y.to(device, non_blocking=True)

            with torch.autocast(device_type=device.type, enabled=(device.type == "cuda")):
                logits = model(x)
                loss = criterion(logits, y)

            preds = logits.argmax(dim=1)
            total_loss += loss.item() * x.size(0)
            correct += (preds == y).sum().item()
            total += x.size(0)
            all_preds.append(preds.cpu())
            all_labels.append(y.cpu())

    all_preds = torch.cat(all_preds).numpy()
    all_labels = torch.cat(all_labels).numpy()

    result = {
        "loss": total_loss / total,
        "acc": correct / total,
        "macro_f1": f1_score(all_labels, all_preds, average="macro"),
        "balanced_acc": balanced_accuracy_score(all_labels, all_preds),
    }

    if orig_classes is not None:
        orig_classes = np.asarray(orig_classes)
        for cls_name in np.unique(orig_classes):
            mask = orig_classes == cls_name
            result[f"acc_{cls_name}"] = float((all_preds[mask] == all_labels[mask]).mean())

    return result


# ============================================================
# 7. MAIN (guarded for Windows)
# ============================================================

def main():
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(SEED)

    torch.backends.cudnn.benchmark = True
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True

    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    print()
    print("=" * 70)
    print("DEVICE INFORMATION")
    print("=" * 70)
    print("PyTorch version:", torch.__version__)
    print("CUDA available:", torch.cuda.is_available())
    if torch.cuda.is_available():
        print("GPU:", torch.cuda.get_device_name(0))
        gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
        print(f"GPU Memory: {gpu_memory:.1f} GB")
    print("Device:", device)
    print("=" * 70)

    print()
    print("=" * 70)
    print("BUILDING DATASET MANIFEST")
    print("=" * 70)
    full_df = build_manifest()

    train_indices, valid_indices = train_test_split(
        np.arange(len(full_df)), test_size=VAL_SIZE, random_state=SEED,
        stratify=full_df["label"].values
    )
    train_split = full_df.iloc[train_indices].reset_index(drop=True)
    valid_split = full_df.iloc[valid_indices].reset_index(drop=True)

    print()
    print("Training images:", f"{len(train_split):,}")
    print("Validation images:", f"{len(valid_split):,}")

    print()
    print("=" * 70)
    print("PRELOADING IMAGES INTO RAM (one-time cost, then every epoch is fast)")
    print("=" * 70)
    t0 = time.time()
    train_images, train_labels, train_split = preload_images(train_split, desc="Preloading train")
    valid_images, valid_labels, valid_split = preload_images(valid_split, desc="Preloading valid")
    print(f"Preload finished in {time.time() - t0:.1f}s")
    approx_mb = (train_images.numel() + valid_images.numel()) / (1024 ** 2)
    print(f"Approx RAM used by image buffers: {approx_mb:.0f} MB")

    valid_orig_classes = valid_split["original_class"].values

    train_ds = PreloadedDataset(train_images, train_labels)
    valid_ds = PreloadedDataset(valid_images, valid_labels)

    class_counts = np.bincount(train_labels.numpy(), minlength=NUM_CLASSES)
    print()
    print("=" * 70)
    print("CLASS BALANCING")
    print("=" * 70)
    print("Not-Dyslexic:", class_counts[0])
    print("Dyslexic:", class_counts[1])

    class_weights = 1.0 / np.clip(class_counts, 1, None)
    sample_weights = torch.as_tensor(class_weights[train_labels.numpy()], dtype=torch.double)
    sampler = WeightedRandomSampler(weights=sample_weights, num_samples=len(sample_weights), replacement=True)

    train_loader = DataLoader(
        train_ds, batch_size=BATCH_SIZE, sampler=sampler,
        num_workers=NUM_WORKERS, pin_memory=(device.type == "cuda"),
        persistent_workers=(NUM_WORKERS > 0),
    )
    valid_loader = DataLoader(
        valid_ds, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=NUM_WORKERS, pin_memory=(device.type == "cuda"),
        persistent_workers=(NUM_WORKERS > 0),
    )

    print()
    print("=" * 70)
    print("CREATING MODEL")
    print("=" * 70)
    model = VisionMamba().to(device)
    num_params = sum(p.numel() for p in model.parameters())
    print(f"VisionMamba parameters: {num_params:,}")
    print(f"Patch size: {PATCH_SIZE} -> tokens per image: {(IMG_SIZE // PATCH_SIZE) ** 2}")
    print(f"Augmentation: {'ON' if AUG_ENABLED else 'OFF'} (no flips -- reversal task)")
    print(f"Drop path rate: {DROP_PATH_RATE} | Delta clamp: {DELTA_CLAMP_MAX} | Grad clip: {GRAD_CLIP_NORM}")

    criterion = nn.CrossEntropyLoss(label_smoothing=LABEL_SMOOTHING)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)

    warmup_scheduler = torch.optim.lr_scheduler.LinearLR(
        optimizer, start_factor=0.1, total_iters=WARMUP_EPOCHS
    )
    cosine_scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=max(1, EPOCHS - WARMUP_EPOCHS)
    )
    scheduler = torch.optim.lr_scheduler.SequentialLR(
        optimizer, schedulers=[warmup_scheduler, cosine_scheduler], milestones=[WARMUP_EPOCHS]
    )

    scaler = torch.amp.GradScaler("cuda", enabled=(device.type == "cuda"))
    ema = EMA(model, decay=EMA_DECAY)

    best_model_path = os.path.join(CHECKPOINT_DIR, "best_model.pt")
    best_balanced_acc = -1.0
    best_epoch = 0
    patience_counter = 0

    print()
    print("=" * 70)
    print("STARTING TRAINING")
    print("=" * 70)
    print("Epochs:", EPOCHS, "| Warmup epochs:", WARMUP_EPOCHS)
    print("Batch size:", BATCH_SIZE, "| Device:", device)
    print("Checkpoints:", CHECKPOINT_DIR)
    print("Best-checkpoint metric: EMA validation balanced accuracy")

    for epoch in range(1, EPOCHS + 1):
        print()
        print("=" * 70)
        print(f"EPOCH {epoch}/{EPOCHS}")
        print("=" * 70)

        epoch_start = time.time()
        train_loss, train_acc = run_train_epoch(model, train_loader, device, criterion, optimizer, scaler, ema)

        # Raw-weights validation (fast sanity check, matches training loss curve)
        raw_val = evaluate(model, valid_loader, device, criterion)

        # EMA-weights validation (this is the one that drives checkpointing)
        ema.apply_shadow(model)
        ema_val = evaluate(model, valid_loader, device, criterion, orig_classes=valid_orig_classes)
        ema.restore(model)

        scheduler.step()
        epoch_time = time.time() - epoch_start
        current_lr = optimizer.param_groups[0]["lr"]

        print()
        print(f"Epoch {epoch:02d} Results  (took {epoch_time:.1f}s)")
        print(f"Train Loss        : {train_loss:.4f}")
        print(f"Train Acc         : {train_acc * 100:.2f}%")
        print(f"Val Loss (raw)    : {raw_val['loss']:.4f}")
        print(f"Val Acc  (raw)    : {raw_val['acc'] * 100:.2f}%")
        print(f"Val Loss (EMA)    : {ema_val['loss']:.4f}")
        print(f"Val Acc  (EMA)    : {ema_val['acc'] * 100:.2f}%")
        print(f"Val Macro-F1 (EMA): {ema_val['macro_f1']:.4f}")
        print(f"Val Balanced Acc (EMA): {ema_val['balanced_acc'] * 100:.2f}%")
        for cls_name in ["normal", "reversal", "corrected"]:
            key = f"acc_{cls_name}"
            if key in ema_val:
                print(f"  {cls_name:9s} acc (EMA): {ema_val[key] * 100:.2f}%")
        print(f"Learning Rate     : {current_lr:.8f}")

        epoch_path = os.path.join(CHECKPOINT_DIR, f"checkpoint_epoch_{epoch:02d}.pt")
        torch.save({
            "epoch": epoch,
            "model_state": model.state_dict(),
            "ema_state": ema.shadow,
            "optimizer_state": optimizer.state_dict(),
            "scheduler_state": scheduler.state_dict(),
            "scaler_state": scaler.state_dict(),
            "train_loss": train_loss, "train_acc": train_acc,
            "val_loss": raw_val["loss"], "val_acc": raw_val["acc"],
            "ema_val_loss": ema_val["loss"], "ema_val_acc": ema_val["acc"],
            "ema_val_macro_f1": ema_val["macro_f1"],
            "ema_val_balanced_acc": ema_val["balanced_acc"],
            "img_size": IMG_SIZE, "patch_size": PATCH_SIZE,
            "embed_dim": EMBED_DIM, "depth": DEPTH,
            "d_state": D_STATE, "num_classes": NUM_CLASSES,
            "drop_path_rate": DROP_PATH_RATE,
        }, epoch_path)
        print()
        print("Saved epoch checkpoint:", epoch_path)

        if ema_val["balanced_acc"] > best_balanced_acc:
            best_balanced_acc = ema_val["balanced_acc"]
            best_epoch = epoch
            patience_counter = 0
            torch.save({
                "epoch": epoch,
                "model_state": model.state_dict(),
                "ema_state": ema.shadow,
                "optimizer_state": optimizer.state_dict(),
                "scheduler_state": scheduler.state_dict(),
                "scaler_state": scaler.state_dict(),
                "train_loss": train_loss, "train_acc": train_acc,
                "val_loss": raw_val["loss"], "val_acc": raw_val["acc"],
                "ema_val_loss": ema_val["loss"], "ema_val_acc": ema_val["acc"],
                "ema_val_macro_f1": ema_val["macro_f1"],
                "ema_val_balanced_acc": ema_val["balanced_acc"],
                "img_size": IMG_SIZE, "patch_size": PATCH_SIZE,
                "embed_dim": EMBED_DIM, "depth": DEPTH,
                "d_state": D_STATE, "num_classes": NUM_CLASSES,
                "drop_path_rate": DROP_PATH_RATE,
            }, best_model_path)
            print()
            print("* NEW BEST MODEL (by EMA validation balanced accuracy) *")
            print(f"Best Epoch          : {best_epoch}")
            print(f"Best Balanced Acc   : {best_balanced_acc * 100:.2f}%")
            print(f"Saved to            : {best_model_path}")
        else:
            patience_counter += 1
            print()
            print("No improvement in EMA balanced accuracy.")
            print(f"Patience: {patience_counter}/{PATIENCE}")

        if device.type == "cuda":
            allocated = torch.cuda.memory_allocated() / (1024 ** 3)
            reserved = torch.cuda.memory_reserved() / (1024 ** 3)
            print()
            print(f"GPU Memory - Allocated: {allocated:.2f} GB | Reserved: {reserved:.2f} GB")

        if patience_counter >= PATIENCE:
            print()
            print("=" * 70)
            print("EARLY STOPPING")
            print(f"No EMA balanced-accuracy improvement for {PATIENCE} epochs.")
            print("=" * 70)
            break

    print()
    print()
    print("=" * 70)
    print("TRAINING COMPLETED")
    print("=" * 70)
    print(f"Best Epoch            : {best_epoch}")
    print(f"Best EMA Balanced Acc  : {best_balanced_acc * 100:.2f}%")
    print()
    print("Best model:", best_model_path)
    print()
    print("=" * 70)
    print("IMPORTANT")
    print("=" * 70)
    print("For final testing, load best_model.pt and use the 'ema_state' dict")
    print("(model.load_state_dict(ckpt['ema_state'])), not 'model_state' -- EMA")
    print("weights are the ones that were used to pick this checkpoint and")
    print("should generalize better to your held-out test set.")
    print("Do NOT use the test dataset during training.")
    print("=" * 70)


if __name__ == "__main__":
    main()