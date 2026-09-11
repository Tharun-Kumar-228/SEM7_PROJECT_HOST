const mongoose = require('mongoose');

const CharacterSampleSchema = new mongoose.Schema(
  {
    screeningId: { type: mongoose.Schema.Types.ObjectId, ref: 'Screening', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    expectedCharacter: { type: String, required: true },
    characterType: { type: String, enum: ['LETTER', 'NUMBER'], required: true },
    imagePath: { type: String, required: true },
    prediction: { type: String },
    probability: { type: Number },
    classification: { type: String },
    processingTimeMs: { type: Number },
    timestamp: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PROCESSING', 'ANALYZED', 'FAILED', 'ANALYSIS_PENDING'],
      default: 'ANALYSIS_PENDING',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CharacterSample', CharacterSampleSchema);
