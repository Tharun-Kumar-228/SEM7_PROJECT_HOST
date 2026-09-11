const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    grade: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

ClassSchema.index({ schoolId: 1, grade: 1, section: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Class', ClassSchema);
