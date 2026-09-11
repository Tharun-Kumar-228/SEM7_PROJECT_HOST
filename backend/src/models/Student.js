const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    age: { type: Number, required: true },
    grade: { type: String, trim: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', sparse: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', sparse: true },
    parentPhone: { type: String, required: true, index: true, trim: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true },
  },
  { timestamps: true }
);

// Indexes
StudentSchema.index({ classId: 1, rollNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Student', StudentSchema);
