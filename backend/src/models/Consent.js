const mongoose = require('mongoose');

const ConsentSchema = new mongoose.Schema(
  {
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    consentGiven: { type: Boolean, required: true },
    consentVersion: { type: String, default: '1.0' },
    ipAddress: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Consent', ConsentSchema);
