"""
CyberShield Voice Scam ML Classifier
=====================================
- TF-IDF vectorizer + scikit-learn SVM classifier
- Trained offline on labeled Indian phone scam transcripts
- No API keys, no internet, runs 100% locally
- Exports trained model artefacts for reuse by voice_analyzer.py
"""

import os
import sys
import pickle
import json

# Ensure repo root on path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, classification_report, confusion_matrix
)

from services.ml_training.training_data import get_texts_and_labels

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_artifacts")
MODEL_PATH = os.path.join(MODEL_DIR, "scam_classifier.pkl")
METRICS_PATH = os.path.join(MODEL_DIR, "metrics.json")


def build_pipeline() -> Pipeline:
    """
    TF-IDF (1–3 gram character + word hybrid) → Ensemble (SVM + RF)
    """
    tfidf = TfidfVectorizer(
        analyzer="word",
        ngram_range=(1, 3),
        max_features=8000,
        sublinear_tf=True,
        min_df=1,
        strip_accents="unicode",
        token_pattern=r"(?u)\b[a-zA-Z₹][a-zA-Z₹0-9]*\b",
    )
    svm = LinearSVC(C=1.0, max_iter=2000, class_weight="balanced")
    rf = RandomForestClassifier(n_estimators=200, class_weight="balanced", random_state=42, n_jobs=-1)
    ensemble = VotingClassifier(
        estimators=[("svm", svm), ("rf", rf)],
        voting="hard",
    )
    return Pipeline([("tfidf", tfidf), ("clf", ensemble)])


def train(save: bool = True) -> dict:
    texts, labels = get_texts_and_labels()
    print(f"\n[ML TRAIN] Dataset: {len(texts)} samples, "
          f"{sum(labels)} scam / {len(labels) - sum(labels)} legitimate")

    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.20, random_state=42, stratify=labels
    )

    pipeline = build_pipeline()

    # 5-fold CV on training data
    cv_scores = cross_val_score(pipeline, X_train, y_train, cv=5, scoring="f1", n_jobs=-1)
    print(f"[ML TRAIN] 5-fold CV F1: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    metrics = {
        "dataset_size": len(texts),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred), 4),
        "recall": round(recall_score(y_test, y_pred), 4),
        "f1": round(f1_score(y_test, y_pred), 4),
        "cv_f1_mean": round(cv_scores.mean(), 4),
        "cv_f1_std": round(cv_scores.std(), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
    }

    print("\n[ML TRAIN] Test Set Evaluation:")
    print(classification_report(y_test, y_pred, target_names=["Legitimate", "Scam"]))
    print(f"[ML TRAIN] Confusion Matrix:\n{confusion_matrix(y_test, y_pred)}")
    print(f"[ML TRAIN] Accuracy: {metrics['accuracy']} | F1: {metrics['f1']}")

    if save:
        os.makedirs(MODEL_DIR, exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(pipeline, f, protocol=pickle.HIGHEST_PROTOCOL)
        with open(METRICS_PATH, "w") as f:
            json.dump(metrics, f, indent=2)
        print(f"[ML TRAIN] Model saved: {MODEL_PATH}")
        print(f"[ML TRAIN] Metrics saved: {METRICS_PATH}")

    return {"pipeline": pipeline, "metrics": metrics}


if __name__ == "__main__":
    result = train(save=True)
    print("\n[ML TRAIN] Complete. Model ready for offline inference.")
