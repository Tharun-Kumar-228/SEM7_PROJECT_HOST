# ============================================================
# VISION MAMBA - DYSLEXIA HANDWRITING CLASSIFIER
# FINAL HELD-OUT TESTING
#
# IMPORTANT:
#   - Loads best_model.pt
#   - Loads EMA weights: ckpt["ema_state"]
#   - Does NOT use augmentation
#   - Uses the same preprocessing as training
#
# Expected test structure:
#
# dyslexic/
# └── test/
#     ├── normal/
#     │   └── images...
#     ├── reversal/
#     │   └── images...
#     └── corrected/
#         └── images...
#
# Binary labels:
#   normal              -> 0 (Not Dyslexic)
#   reversal/corrected  -> 1 (Dyslexic)
# ============================================================

import os
import glob
import time
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

from torch.utils.data import Dataset, DataLoader

try:
    from sklearn.metrics import (
        accuracy_score,
        balanced_accuracy_score,
        f1_score,
        precision_score,
        recall_score,
        confusion_matrix,
        classification_report,
        roc_auc_score
    )
except ImportError:
    def accuracy_score(y_true, y_pred):
        return float(np.mean(np.array(y_true) == np.array(y_pred)))

    def confusion_matrix(y_true, y_pred, labels=None):
        y_true, y_pred = np.array(y_true), np.array(y_pred)
        tn = int(np.sum((y_true == 0) & (y_pred == 0)))
        fp = int(np.sum((y_true == 0) & (y_pred == 1)))
        fn = int(np.sum((y_true == 1) & (y_pred == 0)))
        tp = int(np.sum((y_true == 1) & (y_pred == 1)))
        return np.array([[tn, fp], [fn, tp]])

    def precision_score(y_true, y_pred, pos_label=1, zero_division=0):
        y_true, y_pred = np.array(y_true), np.array(y_pred)
        tp = np.sum((y_true == pos_label) & (y_pred == pos_label))
        pred_p = np.sum(y_pred == pos_label)
        return float(tp / pred_p) if pred_p > 0 else float(zero_division)

    def recall_score(y_true, y_pred, pos_label=1, zero_division=0):
        y_true, y_pred = np.array(y_true), np.array(y_pred)
        tp = np.sum((y_true == pos_label) & (y_pred == pos_label))
        act_p = np.sum(y_true == pos_label)
        return float(tp / act_p) if act_p > 0 else float(zero_division)

    def f1_score(y_true, y_pred, pos_label=1, average=None, zero_division=0):
        if average == "macro":
            f1_0 = f1_score(y_true, y_pred, pos_label=0, zero_division=zero_division)
            f1_1 = f1_score(y_true, y_pred, pos_label=1, zero_division=zero_division)
            return float((f1_0 + f1_1) / 2.0)
        p = precision_score(y_true, y_pred, pos_label=pos_label, zero_division=zero_division)
        r = recall_score(y_true, y_pred, pos_label=pos_label, zero_division=zero_division)
        return float(2 * p * r / (p + r)) if (p + r) > 0 else float(zero_division)

    def balanced_accuracy_score(y_true, y_pred):
        rec_0 = recall_score(y_true, y_pred, pos_label=0)
        rec_1 = recall_score(y_true, y_pred, pos_label=1)
        return float((rec_0 + rec_1) / 2.0)

    def roc_auc_score(y_true, y_score):
        y_true = np.array(y_true)
        y_score = np.array(y_score)
        n_pos = np.sum(y_true == 1)
        n_neg = np.sum(y_true == 0)
        if n_pos == 0 or n_neg == 0:
            return 0.5
        rank = np.argsort(np.argsort(y_score)) + 1
        return float((np.sum(rank[y_true == 1]) - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))

    def classification_report(y_true, y_pred, labels=None, target_names=None, digits=4, zero_division=0, **kwargs):
        p0 = precision_score(y_true, y_pred, pos_label=0)
        r0 = recall_score(y_true, y_pred, pos_label=0)
        f0 = f1_score(y_true, y_pred, pos_label=0)
        s0 = int(np.sum(np.array(y_true) == 0))
        p1 = precision_score(y_true, y_pred, pos_label=1)
        r1 = recall_score(y_true, y_pred, pos_label=1)
        f1 = f1_score(y_true, y_pred, pos_label=1)
        s1 = int(np.sum(np.array(y_true) == 1))
        name0 = target_names[0] if target_names and len(target_names) > 0 else "0"
        name1 = target_names[1] if target_names and len(target_names) > 1 else "1"
        return (
            f"              precision    recall  f1-score   support\n\n"
            f"{name0:>12}     {p0:.{digits}f}    {r0:.{digits}f}    {f0:.{digits}f}     {s0}\n"
            f"{name1:>12}     {p1:.{digits}f}    {r1:.{digits}f}    {f1:.{digits}f}     {s1}\n\n"
            f"    accuracy                         {accuracy_score(y_true, y_pred):.{digits}f}     {s0+s1}\n"
            f"   macro avg     {(p0+p1)/2:.{digits}f}    {(r0+r1)/2:.{digits}f}    {(f0+f1)/2:.{digits}f}     {s0+s1}\n"
        )


# ============================================================
# 1. CONFIGURATION
# ============================================================

SEED = 42

DATASET_ROOT = os.environ.get(
    "DYSLEXIA_DATASET_ROOT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "datasets", "dyslexic"))
)

CHECKPOINT_PATH = os.environ.get(
    "DYSLEXIA_CHECKPOINT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "best_model.pt"))
)

BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 256))
NUM_WORKERS = 0

# These will be verified/replaced using checkpoint information
IMG_SIZE = 64
PATCH_SIZE = 16
IN_CHANS = 1

EMBED_DIM = 96
DEPTH = 4
D_STATE = 16
NUM_CLASSES = 2

DROP_PATH_RATE = 0.1
DELTA_CLAMP_MAX = 5.0


# ============================================================
# 2. DEVICE
# ============================================================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ============================================================
# 3. DATASET COLLECTION
# ============================================================

def collect_images(folder):
    extensions = [
        "*.png",
        "*.jpg",
        "*.jpeg",
        "*.bmp",
        "*.tif",
        "*.tiff"
    ]

    files = []

    for ext in extensions:
        files.extend(
            glob.glob(
                os.path.join(folder, "**", ext),
                recursive=True
            )
        )

    return files


def build_test_manifest():
    def find_dir(parent, candidates):
        for c in candidates:
            p = os.path.join(parent, c)
            if os.path.isdir(p):
                return p
        return os.path.join(parent, candidates[0])

    test_base = find_dir(DATASET_ROOT, ["Test", "test"])
    test_normal_dir = find_dir(test_base, ["Normal", "normal"])
    test_reversal_dir = find_dir(test_base, ["Reversal", "reversal"])
    test_corrected_dir = find_dir(test_base, ["Corrected", "corrected"])

    required_dirs = [
        test_normal_dir,
        test_reversal_dir,
        test_corrected_dir
    ]

    for folder in required_dirs:
        if not os.path.isdir(folder):
            raise FileNotFoundError(
                f"\nTest folder not found:\n{folder}\n"
                f"Check DATASET_ROOT and test dataset structure."
            )

    normal_files = collect_images(test_normal_dir)
    reversal_files = collect_images(test_reversal_dir)
    corrected_files = collect_images(test_corrected_dir)

    print()
    print("=" * 70)
    print("TEST DATASET")
    print("=" * 70)

    print(f"Normal    : {len(normal_files):,}")
    print(f"Reversal  : {len(reversal_files):,}")
    print(f"Corrected : {len(corrected_files):,}")

    total = (
        len(normal_files)
        + len(reversal_files)
        + len(corrected_files)
    )

    print(f"Total     : {total:,}")

    rows = []

    # Normal -> Not Dyslexic -> 0
    for path in normal_files:
        rows.append({
            "path": path,
            "label": 0,
            "original_class": "normal"
        })

    # Reversal -> Dyslexic -> 1
    for path in reversal_files:
        rows.append({
            "path": path,
            "label": 1,
            "original_class": "reversal"
        })

    # Corrected -> Dyslexic -> 1
    for path in corrected_files:
        rows.append({
            "path": path,
            "label": 1,
            "original_class": "corrected"
        })

    df = pd.DataFrame(rows)

    max_samples = os.environ.get("MAX_TEST_SAMPLES")
    if max_samples and max_samples.isdigit():
        max_n = int(max_samples)
        if 0 < max_n < len(df):
            sampled_dfs = [
                group.sample(n=min(len(group), max_n // 3), random_state=SEED)
                for _, group in df.groupby("original_class")
            ]
            df = pd.concat(sampled_dfs, ignore_index=True)
            print(f"\n[INFO] Sampled {len(df)} images for fast test run (MAX_TEST_SAMPLES={max_n})")

    if len(df) == 0:
        raise RuntimeError("No test images found.")

    return df


# ============================================================
# 4. PRELOAD TEST IMAGES
# ============================================================

def preload_images(df, img_size):

    n = len(df)

    buffer = np.empty(
        (n, img_size, img_size),
        dtype=np.uint8
    )

    labels = df["label"].values.astype(np.int64)

    bad_indices = []

    print()
    print("=" * 70)
    print("PRELOADING TEST IMAGES")
    print("=" * 70)

    for i, path in enumerate(
        tqdm(df["path"].values, desc="Loading test images")
    ):

        try:

            img = (
                Image.open(path)
                .convert("L")
                .resize((img_size, img_size))
            )

            buffer[i] = np.array(
                img,
                dtype=np.uint8
            )

        except Exception as e:

            print(
                f"\nWARNING: Failed to load:\n"
                f"{path}\n"
                f"Reason: {e}"
            )

            bad_indices.append(i)

    keep_df = df

    if bad_indices:

        keep_mask = np.ones(
            n,
            dtype=bool
        )

        keep_mask[bad_indices] = False

        buffer = buffer[keep_mask]
        labels = labels[keep_mask]

        keep_df = (
            df.iloc[keep_mask]
            .reset_index(drop=True)
        )

    images_tensor = torch.from_numpy(buffer)
    labels_tensor = torch.from_numpy(labels)

    print()
    print(
        f"Successfully loaded: "
        f"{len(images_tensor):,} images"
    )

    return (
        images_tensor,
        labels_tensor,
        keep_df
    )


# ============================================================
# 5. DATASET
# ============================================================

class PreloadedDataset(Dataset):

    def __init__(
        self,
        images_tensor,
        labels_tensor
    ):

        self.images = images_tensor
        self.labels = labels_tensor

    def __len__(self):

        return self.images.shape[0]

    def __getitem__(self, idx):

        # SAME preprocessing used during training
        img = (
            self.images[idx]
            .float()
            / 255.0
        )

        # Convert 0..1 -> -1..1
        img = (img - 0.5) / 0.5

        # grayscale channel
        img = img.unsqueeze(0)

        label = int(
            self.labels[idx]
        )

        return img, label


# ============================================================
# 6. MODEL ARCHITECTURE
# ============================================================

class PatchEmbed(nn.Module):

    def __init__(
        self,
        img_size,
        patch_size,
        in_chans,
        embed_dim
    ):

        super().__init__()

        self.proj = nn.Conv2d(
            in_chans,
            embed_dim,
            kernel_size=patch_size,
            stride=patch_size
        )

        n_patches = (
            img_size // patch_size
        ) ** 2

        self.pos_embed = nn.Parameter(
            torch.zeros(
                1,
                n_patches,
                embed_dim
            )
        )

        nn.init.trunc_normal_(
            self.pos_embed,
            std=0.02
        )

    def forward(self, x):

        x = self.proj(x)

        x = (
            x.flatten(2)
            .transpose(1, 2)
        )

        return x + self.pos_embed


# ============================================================

class DropPath(nn.Module):

    def __init__(self, drop_prob=0.0):

        super().__init__()

        self.drop_prob = drop_prob

    def forward(self, x):

        # DropPath automatically disabled in model.eval()
        if (
            self.drop_prob == 0.0
            or not self.training
        ):
            return x

        keep_prob = 1 - self.drop_prob

        shape = (
            (x.shape[0],)
            + (1,) * (x.ndim - 1)
        )

        random_tensor = (
            keep_prob
            + torch.rand(
                shape,
                dtype=x.dtype,
                device=x.device
            )
        )

        random_tensor.floor_()

        return (
            x.div(keep_prob)
            * random_tensor
        )


# ============================================================

class SelectiveSSM(nn.Module):

    def __init__(
        self,
        d_inner,
        d_state=16
    ):

        super().__init__()

        self.d_inner = d_inner
        self.d_state = d_state

        A = torch.arange(
            1,
            d_state + 1,
            dtype=torch.float32
        ).repeat(
            d_inner,
            1
        )

        self.A_log = nn.Parameter(
            torch.log(A)
        )

        self.D = nn.Parameter(
            torch.ones(d_inner)
        )

        self.x_proj = nn.Linear(
            d_inner,
            d_state * 2 + 1,
            bias=False
        )

        self.dt_proj = nn.Linear(
            1,
            d_inner,
            bias=True
        )

    def forward(
        self,
        x,
        reverse=False
    ):

        B_, L, D_ = x.shape

        if reverse:
            x = x.flip(1)

        A = -torch.exp(
            self.A_log
        )

        x_dbl = self.x_proj(x)

        Bp, Cp, delta = torch.split(
            x_dbl,
            [
                self.d_state,
                self.d_state,
                1
            ],
            dim=-1
        )

        delta = F.softplus(
            self.dt_proj(delta)
        )

        # EXACT SAME stability clamp as training
        delta = torch.clamp(
            delta,
            max=DELTA_CLAMP_MAX
        )

        dA = torch.exp(
            delta.unsqueeze(-1)
            * A
        )

        dB = (
            delta.unsqueeze(-1)
            * Bp.unsqueeze(2)
        )

        h = x.new_zeros(
            B_,
            D_,
            self.d_state
        )

        ys = []

        for t in range(L):

            h = (
                dA[:, t] * h
                + dB[:, t]
                * x[:, t].unsqueeze(-1)
            )

            y_t = (
                h
                * Cp[:, t].unsqueeze(1)
            ).sum(-1)

            ys.append(y_t)

        y = torch.stack(
            ys,
            dim=1
        )

        y = y + x * self.D

        if reverse:
            y = y.flip(1)

        return y


# ============================================================

class MambaBlock(nn.Module):

    def __init__(
        self,
        d_model,
        expand=2,
        d_state=16,
        conv_kernel=3,
        drop_path=0.0
    ):

        super().__init__()

        d_inner = d_model * expand

        self.norm = nn.LayerNorm(
            d_model
        )

        self.in_proj = nn.Linear(
            d_model,
            d_inner * 2
        )

        self.conv = nn.Conv1d(
            d_inner,
            d_inner,
            kernel_size=conv_kernel,
            padding=conv_kernel - 1,
            groups=d_inner
        )

        self.ssm_fwd = SelectiveSSM(
            d_inner,
            d_state
        )

        self.ssm_bwd = SelectiveSSM(
            d_inner,
            d_state
        )

        self.out_proj = nn.Linear(
            d_inner,
            d_model
        )

        self.drop_path = DropPath(
            drop_path
        )

    def forward(self, x):

        residual = x

        x = self.norm(x)

        x, z = (
            self.in_proj(x)
            .chunk(2, dim=-1)
        )

        x_conv = self.conv(
            x.transpose(1, 2)
        )

        x_conv = (
            x_conv[..., :x.shape[1]]
            .transpose(1, 2)
        )

        x_conv = F.silu(
            x_conv
        )

        y = (
            self.ssm_fwd(
                x_conv,
                reverse=False
            )
            +
            self.ssm_bwd(
                x_conv,
                reverse=True
            )
        )

        y = y * F.silu(z)

        y = self.out_proj(y)

        return (
            residual
            + self.drop_path(y)
        )


# ============================================================

class VisionMamba(nn.Module):

    def __init__(
        self,
        img_size,
        patch_size,
        in_chans,
        embed_dim,
        depth,
        d_state,
        num_classes,
        drop_rate=0.1,
        drop_path_rate=0.1
    ):

        super().__init__()

        self.patch_embed = PatchEmbed(
            img_size,
            patch_size,
            in_chans,
            embed_dim
        )

        self.pos_drop = nn.Dropout(
            drop_rate
        )

        dpr = [
            x.item()
            for x in torch.linspace(
                0,
                drop_path_rate,
                depth
            )
        ]

        self.blocks = nn.ModuleList([
            MambaBlock(
                embed_dim,
                d_state=d_state,
                drop_path=dpr[i]
            )
            for i in range(depth)
        ])

        self.norm = nn.LayerNorm(
            embed_dim
        )

        self.head = nn.Linear(
            embed_dim,
            num_classes
        )

    def forward(self, x):

        x = self.patch_embed(x)

        x = self.pos_drop(x)

        for block in self.blocks:
            x = block(x)

        x = self.norm(x)

        x = x.mean(
            dim=1
        )

        return self.head(x)


# ============================================================
# 7. TEST FUNCTION
# ============================================================

def test_model(
    model,
    loader,
    dataframe,
    device
):

    model.eval()

    all_labels = []
    all_predictions = []
    all_probabilities = []

    inference_start = time.time()

    with torch.no_grad():

        for images, labels in tqdm(
            loader,
            desc="Testing"
        ):

            images = images.to(
                device,
                non_blocking=True
            )

            labels = labels.to(
                device,
                non_blocking=True
            )

            with torch.autocast(
                device_type=device.type,
                enabled=(device.type == "cuda")
            ):

                logits = model(images)

            probabilities = torch.softmax(
                logits.float(),
                dim=1
            )

            predictions = torch.argmax(
                probabilities,
                dim=1
            )

            dyslexic_probability = (
                probabilities[:, 1]
            )

            all_labels.extend(
                labels.cpu().numpy()
            )

            all_predictions.extend(
                predictions.cpu().numpy()
            )

            all_probabilities.extend(
                dyslexic_probability
                .cpu()
                .numpy()
            )

    inference_time = (
        time.time()
        - inference_start
    )

    all_labels = np.array(
        all_labels
    )

    all_predictions = np.array(
        all_predictions
    )

    all_probabilities = np.array(
        all_probabilities
    )

    # ========================================================
    # Overall Metrics
    # ========================================================

    accuracy = accuracy_score(
        all_labels,
        all_predictions
    )

    balanced_acc = balanced_accuracy_score(
        all_labels,
        all_predictions
    )

    macro_f1 = f1_score(
        all_labels,
        all_predictions,
        average="macro"
    )

    dyslexic_f1 = f1_score(
        all_labels,
        all_predictions,
        pos_label=1,
        zero_division=0
    )

    precision = precision_score(
        all_labels,
        all_predictions,
        pos_label=1,
        zero_division=0
    )

    recall = recall_score(
        all_labels,
        all_predictions,
        pos_label=1,
        zero_division=0
    )

    cm = confusion_matrix(
        all_labels,
        all_predictions,
        labels=[0, 1]
    )

    tn, fp, fn, tp = cm.ravel()

    specificity = (
        tn / (tn + fp)
        if (tn + fp) > 0
        else 0
    )

    sensitivity = (
        tp / (tp + fn)
        if (tp + fn) > 0
        else 0
    )

    try:

        roc_auc = roc_auc_score(
            all_labels,
            all_probabilities
        )

    except ValueError:

        roc_auc = float("nan")

    # ========================================================
    # Per-original-class accuracy
    # ========================================================

    orig_classes = dataframe[
        "original_class"
    ].values

    per_class_results = {}

    for class_name in [
        "normal",
        "reversal",
        "corrected"
    ]:

        mask = (
            orig_classes
            == class_name
        )

        if mask.sum() > 0:

            class_accuracy = (
                all_predictions[mask]
                == all_labels[mask]
            ).mean()

            per_class_results[
                class_name
            ] = class_accuracy

    # ========================================================
    # Print
    # ========================================================

    print()
    print("=" * 70)
    print("FINAL TEST RESULTS")
    print("=" * 70)

    print(
        f"Test Samples       : "
        f"{len(all_labels):,}"
    )

    print(
        f"Test Accuracy      : "
        f"{accuracy * 100:.2f}%"
    )

    print(
        f"Balanced Accuracy  : "
        f"{balanced_acc * 100:.2f}%"
    )

    print(
        f"Macro F1           : "
        f"{macro_f1:.4f}"
    )

    print(
        f"Dyslexic F1        : "
        f"{dyslexic_f1:.4f}"
    )

    print(
        f"Precision          : "
        f"{precision:.4f}"
    )

    print(
        f"Recall/Sensitivity : "
        f"{recall:.4f}"
    )

    print(
        f"Specificity        : "
        f"{specificity:.4f}"
    )

    print(
        f"ROC-AUC            : "
        f"{roc_auc:.4f}"
    )

    print()
    print("-" * 70)
    print("PER-ORIGINAL-CLASS ACCURACY")
    print("-" * 70)

    for class_name in [
        "normal",
        "reversal",
        "corrected"
    ]:

        if class_name in per_class_results:

            print(
                f"{class_name:10s}: "
                f"{per_class_results[class_name] * 100:.2f}%"
            )

    print()
    print("-" * 70)
    print("CONFUSION MATRIX")
    print("-" * 70)

    print()
    print("                 Predicted")
    print("                 Normal   Dyslexic")
    print(
        f"Actual Normal     {tn:7d}   {fp:8d}"
    )
    print(
        f"Actual Dyslexic   {fn:7d}   {tp:8d}"
    )

    print()
    print(f"TN: {tn}")
    print(f"FP: {fp}")
    print(f"FN: {fn}")
    print(f"TP: {tp}")

    print()
    print("-" * 70)
    print("CLASSIFICATION REPORT")
    print("-" * 70)

    print(
        classification_report(
            all_labels,
            all_predictions,
            labels=[0, 1],
            target_names=[
                "Not Dyslexic",
                "Dyslexic"
            ],
            digits=4,
            zero_division=0
        )
    )

    print("-" * 70)

    print(
        f"Inference time: "
        f"{inference_time:.2f}s"
    )

    print(
        f"Average: "
        f"{inference_time / len(all_labels) * 1000:.3f} "
        f"ms/image"
    )

    print("=" * 70)

    return {
        "accuracy": accuracy,
        "balanced_accuracy": balanced_acc,
        "macro_f1": macro_f1,
        "precision": precision,
        "recall": recall,
        "specificity": specificity,
        "roc_auc": roc_auc,
        "confusion_matrix": cm,
        "predictions": all_predictions,
        "probabilities": all_probabilities,
        "labels": all_labels,
        "per_class": per_class_results
    }


# ============================================================
# 8. MAIN
# ============================================================

def main():

    global IMG_SIZE
    global PATCH_SIZE
    global EMBED_DIM
    global DEPTH
    global D_STATE
    global NUM_CLASSES
    global DROP_PATH_RATE

    # ========================================================
    # Reproducibility
    # ========================================================

    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)

    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(SEED)

    torch.backends.cudnn.benchmark = True

    if torch.cuda.is_available():
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True

    # ========================================================
    # Device information
    # ========================================================

    print()
    print("=" * 70)
    print("DEVICE INFORMATION")
    print("=" * 70)

    print(
        "PyTorch version:",
        torch.__version__
    )

    print(
        "CUDA available:",
        torch.cuda.is_available()
    )

    if torch.cuda.is_available():

        print(
            "GPU:",
            torch.cuda.get_device_name(0)
        )

        gpu_memory = (
            torch.cuda.get_device_properties(
                0
            ).total_memory
            / (1024 ** 3)
        )

        print(
            f"GPU Memory: "
            f"{gpu_memory:.1f} GB"
        )

    print(
        "Device:",
        device
    )

    # ========================================================
    # Check checkpoint
    # ========================================================

    print()
    print("=" * 70)
    print("LOADING CHECKPOINT")
    print("=" * 70)

    if not os.path.isfile(
        CHECKPOINT_PATH
    ):

        raise FileNotFoundError(
            f"\nCheckpoint not found:\n"
            f"{CHECKPOINT_PATH}"
        )

    print(
        "Checkpoint:",
        CHECKPOINT_PATH
    )

    ckpt = torch.load(
        CHECKPOINT_PATH,
        map_location="cpu",
        weights_only=False
    )

    # ========================================================
    # Read architecture directly from checkpoint
    # ========================================================

    IMG_SIZE = ckpt.get(
        "img_size",
        IMG_SIZE
    )

    PATCH_SIZE = ckpt.get(
        "patch_size",
        PATCH_SIZE
    )

    EMBED_DIM = ckpt.get(
        "embed_dim",
        EMBED_DIM
    )

    DEPTH = ckpt.get(
        "depth",
        DEPTH
    )

    D_STATE = ckpt.get(
        "d_state",
        D_STATE
    )

    NUM_CLASSES = ckpt.get(
        "num_classes",
        NUM_CLASSES
    )

    DROP_PATH_RATE = ckpt.get(
        "drop_path_rate",
        DROP_PATH_RATE
    )

    print()
    print(
        "Checkpoint information:"
    )

    print(
        f"Best checkpoint epoch : "
        f"{ckpt.get('epoch', 'Unknown')}"
    )

    if "ema_val_balanced_acc" in ckpt:

        print(
            f"Validation balanced acc: "
            f"{ckpt['ema_val_balanced_acc'] * 100:.2f}%"
        )

    if "ema_val_acc" in ckpt:

        print(
            f"Validation accuracy    : "
            f"{ckpt['ema_val_acc'] * 100:.2f}%"
        )

    print()
    print(
        "Architecture stored in checkpoint:"
    )

    print(
        f"img_size       : {IMG_SIZE}"
    )

    print(
        f"patch_size     : {PATCH_SIZE}"
    )

    print(
        f"embed_dim      : {EMBED_DIM}"
    )

    print(
        f"depth          : {DEPTH}"
    )

    print(
        f"d_state        : {D_STATE}"
    )

    print(
        f"num_classes    : {NUM_CLASSES}"
    )

    print(
        f"drop_path_rate : {DROP_PATH_RATE}"
    )

    # ========================================================
    # Create model
    # ========================================================

    print()
    print("=" * 70)
    print("CREATING MODEL")
    print("=" * 70)

    model = VisionMamba(
        img_size=IMG_SIZE,
        patch_size=PATCH_SIZE,
        in_chans=IN_CHANS,
        embed_dim=EMBED_DIM,
        depth=DEPTH,
        d_state=D_STATE,
        num_classes=NUM_CLASSES,
        drop_path_rate=DROP_PATH_RATE
    )

    num_params = sum(
        p.numel()
        for p in model.parameters()
    )

    print(
        f"Model parameters: "
        f"{num_params:,}"
    )

    # ========================================================
    # CRITICAL: Load EMA state
    # ========================================================

    if "ema_state" not in ckpt:

        raise KeyError(
            "\nERROR: 'ema_state' not found "
            "inside checkpoint.\n"
            "Your final V2 test should use "
            "the EMA weights."
        )

    print()
    print(
        "Loading EMA weights..."
    )

    model.load_state_dict(
        ckpt["ema_state"],
        strict=True
    )

    model = model.to(device)

    # CRITICAL:
    # disables dropout and stochastic depth
    model.eval()

    print(
        "EMA weights loaded successfully."
    )

    print(
        "Model switched to evaluation mode."
    )

    # Free checkpoint memory
    del ckpt

    # ========================================================
    # Test data
    # ========================================================

    test_df = build_test_manifest()

    (
        test_images,
        test_labels,
        test_df
    ) = preload_images(
        test_df,
        IMG_SIZE
    )

    test_dataset = PreloadedDataset(
        test_images,
        test_labels
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=(
            device.type == "cuda"
        ),
        persistent_workers=(
            NUM_WORKERS > 0
        )
    )

    # ========================================================
    # Run final test
    # ========================================================

    results = test_model(
        model,
        test_loader,
        test_df,
        device
    )

    # ========================================================
    # Save individual predictions
    # ========================================================

    output_df = test_df.copy()

    output_df[
        "true_label"
    ] = results["labels"]

    output_df[
        "predicted_label"
    ] = results["predictions"]

    output_df[
        "dyslexic_probability"
    ] = results["probabilities"]

    output_df[
        "true_class"
    ] = np.where(
        output_df["true_label"] == 0,
        "Not Dyslexic",
        "Dyslexic"
    )

    output_df[
        "predicted_class"
    ] = np.where(
        output_df["predicted_label"] == 0,
        "Not Dyslexic",
        "Dyslexic"
    )

    output_df[
        "correct"
    ] = (
        output_df["true_label"]
        == output_df["predicted_label"]
    )

    output_path = os.path.join(
        os.path.dirname(
            os.path.abspath(__file__)
        ),
        "test_predictions.csv"
    )

    output_df.to_csv(
        output_path,
        index=False
    )

    print()
    print("=" * 70)
    print("TESTING COMPLETED")
    print("=" * 70)

    print(
        "Prediction details saved to:"
    )

    print(
        output_path
    )

    print()
    print(
        f"FINAL TEST ACCURACY     : "
        f"{results['accuracy'] * 100:.2f}%"
    )

    print(
        f"FINAL BALANCED ACCURACY : "
        f"{results['balanced_accuracy'] * 100:.2f}%"
    )

    print(
        f"FINAL MACRO F1          : "
        f"{results['macro_f1']:.4f}"
    )

    print("=" * 70)


# ============================================================
# 9. WINDOWS ENTRY POINT
# ============================================================

if __name__ == "__main__":
    main()