const mongoose = require('mongoose');

const ParentStudentLinkSchema = new mongoose.Schema(
  {
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    linkedByPhone: { type: String, required: true },
  },
  { timestamps: true }
);

ParentStudentLinkSchema.index({ parentId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('ParentStudentLink', ParentStudentLinkSchema);
