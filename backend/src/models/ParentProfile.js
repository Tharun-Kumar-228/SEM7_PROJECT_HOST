const mongoose = require('mongoose');

const ParentProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, index: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ParentProfile', ParentProfileSchema);
