const mongoose = require('mongoose');

const DISCLAIMER_TEXT =
  'This pre-screening result is generated for observational and early learning support purposes only. It does NOT constitute a medical diagnosis, clinical evaluation, or formal educational assessment. If you have concerns regarding your child learning or handwriting development, please consult a qualified healthcare or educational specialist.';

const ScreeningResultSchema = new mongoose.Schema(
  {
    screeningId: { type: mongoose.Schema.Types.ObjectId, ref: 'Screening', required: true, unique: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    characterStatus: {
      type: String,
      enum: ['ANALYSIS_PENDING', 'MODEL_SERVICE_NOT_CONNECTED', 'WITHIN_EXPECTED_RANGE', 'REQUIRES_ATTENTION', 'FAILED'],
      default: 'ANALYSIS_PENDING',
    },
    sentenceStatus: {
      type: String,
      enum: ['ANALYSIS_PENDING', 'MODEL_SERVICE_NOT_CONNECTED', 'WITHIN_EXPECTED_RANGE', 'REQUIRES_ATTENTION', 'FAILED'],
      default: 'ANALYSIS_PENDING',
    },
    dyslexiaConfidence: { type: Number, default: 0 },
    dysgraphiaConfidence: { type: Number, default: 0 },
    overallDyslexiaStatus: { type: String, default: 'ANALYSIS_PENDING' },
    overallDysgraphiaStatus: { type: String, default: 'ANALYSIS_PENDING' },
    overallInterpretation: {
      type: String,
      default: 'Screening samples collected successfully. Analysis pending ML service integration.',
    },
    xaiExplanation: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    recommendations: [
      {
        type: String,
      },
    ],
    disclaimer: {
      type: String,
      default: DISCLAIMER_TEXT,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScreeningResult', ScreeningResultSchema);
