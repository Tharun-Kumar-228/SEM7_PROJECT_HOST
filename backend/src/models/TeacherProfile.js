const mongoose = require('mongoose');

const TeacherProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, index: true, lowercase: true, trim: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TeacherProfile', TeacherProfileSchema);
