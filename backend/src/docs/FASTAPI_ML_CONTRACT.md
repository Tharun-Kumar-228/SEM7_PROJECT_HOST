# NEUROSCREEN — Future FastAPI ML Service Contract Specification

This document defines the REST service contract between the **Node.js/Express API Gateway** and future **FastAPI PyTorch ML Microservices**.

---

## Architectural Principles

1. **Isolation**: Mobile React Native clients NEVER talk directly to FastAPI. All calls route through Express.
2. **Provider Abstraction**: Node.js uses `ModelProvider` class (`CharacterAnalysisProvider`, `SentenceAnalysisProvider`).
3. **Decoupled Deployment**: FastAPI services can run on separate GPU microservice instances.

---

## 1. Character-Level Model Service Contract

- **Target Service**: `FastAPI Character Model Microservice`
- **Endpoint**: `POST /model/character/predict`
- **Content-Type**: `multipart/form-data` or `application/json` (Base64)

### Input Payload
```json
{
  "screening_id": "60d5ec49f1b2c80015f8b9a1",
  "student_id": "60d5ec49f1b2c80015f8b9a2",
  "expected_character": "B",
  "character_type": "LETTER",
  "image_base64": "data:image/png;base64,iVBORw0KGgoAAAANSU..."
}
```

### Expected Response Payload
```json
{
  "success": true,
  "service": "neuroscreen-fastapi-character-model",
  "version": "1.0.0",
  "prediction": {
    "detected_character": "B",
    "stroke_count": 3,
    "confidence": 0.94,
    "classification": "WITHIN_EXPECTED_RANGE"
  },
  "processing_time_ms": 128
}
```

---

## 2. Sentence-Level Model Service Contract

- **Target Service**: `FastAPI Sentence Model Microservice`
- **Endpoint**: `POST /model/sentence/predict`
- **Content-Type**: `application/json`

### Input Payload
```json
{
  "screening_id": "60d5ec49f1b2c80015f8b9a1",
  "student_id": "60d5ec49f1b2c80015f8b9a2",
  "expected_sentence": "The boy is playing with a ball.",
  "image_base64": "data:image/png;base64,iVBORw0KGgoAAAANSU..."
}
```

### Expected Response Payload
```json
{
  "success": true,
  "service": "neuroscreen-fastapi-sentence-model",
  "version": "1.0.0",
  "prediction": {
    "word_segmentation_score": 0.88,
    "line_alignment_score": 0.91,
    "confidence": 0.89,
    "classification": "WITHIN_EXPECTED_RANGE"
  },
  "processing_time_ms": 340
}
```

---

## Current State (No ML Integration)

Currently, Node.js returns:
- `status`: `ANALYSIS_PENDING`
- `message`: `MODEL_SERVICE_NOT_CONNECTED`

No fake predictions or diagnostic outputs are generated.
