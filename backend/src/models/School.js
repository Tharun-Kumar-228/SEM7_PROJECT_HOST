const mongoose = require('mongoose');

const SchoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, unique: true, required: true, uppercase: true, trim: true },
    address: { type: String, trim: true },
    createdByTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('School', SchoolSchema);
