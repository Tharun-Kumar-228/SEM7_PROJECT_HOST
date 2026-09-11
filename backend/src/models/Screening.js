const mongoose = require('mongoose');

const ScreeningSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    initiatedByRole: { type: String, enum: ['PARENT', 'TEACHER'], required: true },
    initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PROCESSING', 'ANALYZED', 'FAILED', 'ANALYSIS_PENDING'],
      default: 'IN_PROGRESS',
    },
    characterSamples: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CharacterSample' }],
    sentenceSample: { type: mongoose.Schema.Types.ObjectId, ref: 'SentenceSample' },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Screening', ScreeningSchema);
