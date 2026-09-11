# ============================================================
# VMAMBA2D (SS2D) - DYSGRAPHIA HANDWRITING CLASSIFIER
# HELD-OUT TESTING SCRIPT (LINUX / LUBUNTU / WINDOWS COMPATIBLE)
#
# Evaluates VMamba2D on the held-out Dysgraphic dataset (LPD vs PD)
# Loads checkpoint: dysgraphia/vmamba_dysgraphia_final.pt
# Outputs:
#   - Accuracy, Balanced Accuracy, Macro F1
#   - Sensitivity (PD Recall), Specificity (LPD Recall), Precision
#   - Confusion Matrix
#   - Prediction details saved to dysgraphia_test_predictions.csv
# ============================================================

import os
import sys
import glob
import time
import random
import numpy as np
import pandas as pd
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend/src/ml"))
from predict_sentence import load_sentence_model

import torch
import torchvision.transforms as T
from torch.utils.data import Dataset, DataLoader

# ============================================================
# 1. CONFIGURATION
# ============================================================

SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

DATASET_ROOT = os.environ.get(
    "DYSGRAPHIA_DATASET_ROOT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "datasets", "dysgraphia", "Dysgraphic"))
)

CHECKPOINT_PATH = os.environ.get(
    "DYSGRAPHIA_CHECKPOINT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "dysgraphia", "vmamba_dysgraphia_final.pt"))
)

BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 32))
NUM_WORKERS = 0

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ============================================================
# 2. DATASET
# ============================================================

class DysgraphiaDataset(Dataset):
    def __init__(self, samples, transform):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert("RGB")
        tensor = self.transform(img)
        return tensor, label, path


# ============================================================
# 3. MAIN TESTING ROUTINE
# ============================================================

def main():
    print("=" * 70)
    print("VMAMBA2D (SS2D) - DYSGRAPHIA HELD-OUT TESTING")
    print("=" * 70)
    print(f"Device        : {device}")
    print(f"Checkpoint    : {CHECKPOINT_PATH}")
    print(f"Dataset Root  : {DATASET_ROOT}")

    if not os.path.isfile(CHECKPOINT_PATH):
        raise FileNotFoundError(f"Checkpoint not found: {CHECKPOINT_PATH}")

    if not os.path.isdir(DATASET_ROOT):
        raise FileNotFoundError(f"Dataset directory not found: {DATASET_ROOT}")

    # Load VMamba2D model from checkpoint
    model, img_size = load_sentence_model(CHECKPOINT_PATH)
    model.to(device)
    model.eval()
    print(f"Loaded VMamba2D model ({sum(p.numel() for p in model.parameters()):,} params) successfully.")

    # Locate LPD and PD folders
    lpd_dir = os.path.join(DATASET_ROOT, "lpd")
    pd_dir = os.path.join(DATASET_ROOT, "pd")

    extensions = ["*.jpg", "*.jpeg", "*.png", "*.bmp"]
    lpd_files = []
    pd_files = []
    for ext in extensions:
        lpd_files.extend(glob.glob(os.path.join(lpd_dir, ext)))
        pd_files.extend(glob.glob(os.path.join(pd_dir, ext)))

    print()
    print(f"LPD (Not Dysgraphia, label 0) samples : {len(lpd_files):,}")
    print(f"PD  (Dysgraphia, label 1) samples     : {len(pd_files):,}")
    total_samples = len(lpd_files) + len(pd_files)
    print(f"Total Test Samples                     : {total_samples:,}")

    if total_samples == 0:
        raise RuntimeError("No test images found in dataset directories.")

    # Data transform (standard ImageNet normalization matching training)
    transform = T.Compose([
        T.Resize((img_size, img_size)),
        T.ToTensor(),
        T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    samples = [(p, 0) for p in lpd_files] + [(p, 1) for p in pd_files]
    ds = DysgraphiaDataset(samples, transform)
    loader = DataLoader(ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS)

    all_paths = []
    all_y_true = []
    all_y_pred = []
    all_probs_pd = []
    all_conf = []

    t0 = time.time()
    with torch.inference_mode():
        for batch_idx, (tensors, labels, paths) in enumerate(loader):
            tensors = tensors.to(device)
            logits = model(tensors)
            probs = torch.softmax(logits, dim=1)
            preds = torch.argmax(logits, dim=1)

            all_paths.extend(paths)
            all_y_true.extend(labels.tolist())
            all_y_pred.extend(preds.cpu().tolist())
            all_probs_pd.extend(probs[:, 1].cpu().tolist())
            all_conf.extend(probs.max(dim=1).values.cpu().tolist())

    inference_time = time.time() - t0
    y_true = np.array(all_y_true)
    y_pred = np.array(all_y_pred)

    # Metrics computation
    acc = float(np.mean(y_true == y_pred))
    tn = int(np.sum((y_true == 0) & (y_pred == 0)))
    fp = int(np.sum((y_true == 0) & (y_pred == 1)))
    fn = int(np.sum((y_true == 1) & (y_pred == 0)))
    tp = int(np.sum((y_true == 1) & (y_pred == 1)))

    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    balanced_acc = (specificity + sensitivity) / 2.0
    precision_pd = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    f1_pd = (2 * precision_pd * sensitivity) / (precision_pd + sensitivity) if (precision_pd + sensitivity) > 0 else 0.0

    prec_lpd = tn / (tn + fn) if (tn + fn) > 0 else 0.0
    f1_lpd = (2 * prec_lpd * specificity) / (prec_lpd + specificity) if (prec_lpd + specificity) > 0 else 0.0
    macro_f1 = (f1_lpd + f1_pd) / 2.0

    print()
    print("=" * 70)
    print("FINAL TEST RESULTS (DYSGRAPHIA)")
    print("=" * 70)
    print(f"Test Samples              : {len(y_true):,}")
    print(f"Overall Accuracy          : {acc * 100:.2f}% ({np.sum(y_true == y_pred)}/{len(y_true)})")
    print(f"Balanced Accuracy         : {balanced_acc * 100:.2f}%")
    print(f"Macro F1 Score            : {macro_f1:.4f}")
    print(f"LPD F1 Score              : {f1_lpd:.4f}")
    print(f"PD F1 Score               : {f1_pd:.4f}")
    print(f"Sensitivity (PD Recall)   : {sensitivity * 100:.2f}% ({tp}/{tp+fn})")
    print(f"Specificity (LPD Recall)  : {specificity * 100:.2f}% ({tn}/{tn+fp})")
    print(f"Precision (PD)            : {precision_pd * 100:.2f}% ({tp}/{tp+fp})")
    print(f"Precision (LPD)           : {prec_lpd * 100:.2f}% ({tn}/{tn+fn})")
    print(f"Total Inference Time      : {inference_time:.2f}s ({inference_time / len(y_true) * 1000:.2f} ms/image)")
    print("-" * 70)
    print("CONFUSION MATRIX")
    print("-" * 70)
    print(f"                      Predicted LPD     Predicted PD")
    print(f"  Actual LPD (0)          {tn:5d}             {fp:5d}")
    print(f"  Actual PD  (1)          {fn:5d}             {tp:5d}")
    print()
    print(f"TN: {tn} | FP: {fp} | FN: {fn} | TP: {tp}")
    print("-" * 70)
    print("CLASSIFICATION REPORT")
    print("-" * 70)
    print(f"              precision    recall  f1-score   support\n")
    print(f"         LPD     {prec_lpd:.4f}    {specificity:.4f}    {f1_lpd:.4f}     {tn+fp}")
    print(f"          PD     {precision_pd:.4f}    {sensitivity:.4f}    {f1_pd:.4f}     {fn+tp}\n")
    print(f"    accuracy                         {acc:.4f}     {len(y_true)}")
    print(f"   macro avg     {(prec_lpd+precision_pd)/2:.4f}    {(specificity+sensitivity)/2:.4f}    {macro_f1:.4f}     {len(y_true)}")
    print("=" * 70)

    # Save CSV
    df_out = pd.DataFrame({
        "path": all_paths,
        "true_label": all_y_true,
        "true_class": ["LPD" if l == 0 else "PD" for l in all_y_true],
        "pred_label": all_y_pred,
        "predicted_class": ["LPD" if p == 0 else "PD" for p in all_y_pred],
        "dysgraphia_probability": np.round(all_probs_pd, 4),
        "confidence": np.round(all_conf, 4),
        "correct": (y_true == y_pred)
    })
    csv_out = os.path.abspath(os.path.join(os.path.dirname(__file__), "dysgraphia_test_predictions.csv"))
    df_out.to_csv(csv_out, index=False)
    print(f"Full predictions saved to: {csv_out}")
    print("=" * 70)


if __name__ == "__main__":
    main()
