const mongoose = require('mongoose');

const SentenceSampleSchema = new mongoose.Schema(
  {
    screeningId: { type: mongoose.Schema.Types.ObjectId, ref: 'Screening', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    expectedSentence: { type: String, required: true },
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

module.exports = mongoose.model('SentenceSample', SentenceSampleSchema);
