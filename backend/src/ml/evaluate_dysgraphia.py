import os
import sys
import glob
import time
import numpy as np
import pandas as pd
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from predict_sentence import load_sentence_model, analyze_sentence_spatial
import torch
import torchvision.transforms as T
from torch.utils.data import Dataset, DataLoader

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

def evaluate_dysgraphia(dataset_root=None, checkpoint_path=None, batch_size=32):
    if dataset_root is None:
        dataset_root = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../../../datasets/dysgraphia/Dysgraphic")
        )
        if not os.path.isdir(dataset_root):
            dataset_root = os.path.abspath("datasets/dysgraphia/Dysgraphic")

    if not os.path.isdir(dataset_root):
        raise FileNotFoundError(f"Dysgraphia dataset not found at {dataset_root}")

    lpd_dir = os.path.join(dataset_root, "lpd")
    pd_dir = os.path.join(dataset_root, "pd")

    extensions = ["*.jpg", "*.jpeg", "*.png", "*.bmp"]
    lpd_files = []
    pd_files = []

    for ext in extensions:
        lpd_files.extend(glob.glob(os.path.join(lpd_dir, ext)))
        pd_files.extend(glob.glob(os.path.join(pd_dir, ext)))

    print("=" * 70)
    print("EVALUATING VMAMBA2D DYSGRAPHIA MODEL ON HELD-OUT DATASET")
    print("=" * 70)
    print(f"Dataset Root : {dataset_root}")
    print(f"LPD samples  : {len(lpd_files)}")
    print(f"PD samples   : {len(pd_files)}")
    print(f"Total        : {len(lpd_files) + len(pd_files)}")

    model, img_size = load_sentence_model(checkpoint_path)
    model.eval()

    transform = T.Compose([
        T.Resize((img_size, img_size)),
        T.ToTensor(),
        T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    samples = [(p, 0) for p in lpd_files] + [(p, 1) for p in pd_files]
    ds = DysgraphiaDataset(samples, transform)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=False, num_workers=0)

    all_paths = []
    all_y_true = []
    all_y_pred = []
    all_probs_pd = []
    all_conf = []

    t0 = time.time()
    with torch.inference_mode():
        for batch_idx, (tensors, labels, paths) in enumerate(loader):
            logits = model(tensors)
            probs = torch.softmax(logits, dim=1)
            preds = torch.argmax(logits, dim=1)

            all_paths.extend(paths)
            all_y_true.extend(labels.tolist())
            all_y_pred.extend(preds.tolist())
            all_probs_pd.extend(probs[:, 1].tolist())
            all_conf.extend(probs.max(dim=1).values.tolist())

            print(f"Processed batch {batch_idx + 1}/{len(loader)} ({len(all_y_true)}/{len(samples)} samples)...", flush=True)

    total_time = time.time() - t0
    y_true = np.array(all_y_true)
    y_pred = np.array(all_y_pred)

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
    print("-" * 70)
    print("DYSGRAPHIA BENCHMARK METRICS (VMamba2D Sentence Classifier)")
    print("-" * 70)
    print(f"Overall Accuracy         : {acc * 100:.2f}% ({np.sum(y_true == y_pred)}/{len(y_true)})")
    print(f"Balanced Accuracy        : {balanced_acc * 100:.2f}%")
    print(f"Macro F1 Score           : {macro_f1:.4f}")
    print(f"LPD F1 Score             : {f1_lpd:.4f}")
    print(f"PD F1 Score              : {f1_pd:.4f}")
    print(f"Sensitivity (PD Recall)  : {sensitivity * 100:.2f}% ({tp}/{tp+fn})")
    print(f"Specificity (LPD Recall) : {specificity * 100:.2f}% ({tn}/{tn+fp})")
    print(f"Precision (PD)           : {precision_pd * 100:.2f}%")
    print(f"Total Evaluation Time    : {total_time:.2f}s ({total_time / len(samples) * 1000:.2f} ms/sample)")
    print()
    print("Confusion Matrix:")
    print(f"                   Predicted LPD    Predicted PD")
    print(f"  Actual LPD (0)       {tn:5d}            {fp:5d}")
    print(f"  Actual PD  (1)       {fn:5d}            {tp:5d}")
    print("-" * 70)

    # Save detailed CSV predictions
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
    csv_out = os.path.abspath("dysgraphia_test_predictions.csv")
    df_out.to_csv(csv_out, index=False)
    print(f"Full predictions saved to: {csv_out}")
    print("=" * 70)

    return {
        "accuracy": acc,
        "balanced_accuracy": balanced_acc,
        "macro_f1": macro_f1,
        "sensitivity": sensitivity,
        "specificity": specificity,
        "precision_pd": precision_pd,
        "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
        "total_time_s": total_time,
        "predictions_csv": csv_out
    }

if __name__ == "__main__":
    evaluate_dysgraphia()
