const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const rawConnStr = process.env.MONGODB_URI;
    const connStr = rawConnStr || 'mongodb://localhost:27017/neuroscreen';
    
    if (rawConnStr) {
      console.log(`[MongoDB] Connecting using MONGODB_URI environment variable...`);
    } else {
      console.warn(`[MongoDB WARNING] MONGODB_URI not found in environment; using local fallback: ${connStr}`);
    }

    await mongoose.connect(connStr);
    console.log(`[MongoDB] Connected successfully`);
    const User = require('../models/User');
    await User.collection.dropIndexes().catch(() => {});
    await User.syncIndexes().catch(() => {});
    if (process.env.NODE_ENV !== 'test') {
      await seedInitialData();
    }
  } catch (error) {
    console.error('[MongoDB] Connection error:', error.message);
  }
};

const seedInitialData = async () => {
  try {
    const User = require('../models/User');
    const TeacherProfile = require('../models/TeacherProfile');
    const ParentProfile = require('../models/ParentProfile');
    const bcrypt = require('bcryptjs');

    // Seed default Teacher
    const defaultEmail = 'teacher.test@neuroscreen.org';
    let teacher = await User.findOne({ email: defaultEmail, role: 'TEACHER' });
    if (!teacher) {
      const passwordHash = await bcrypt.hash('password123', 10);
      teacher = new User({
        email: defaultEmail,
        passwordHash,
        role: 'TEACHER',
        isVerified: true,
      });
      await teacher.save();

      const profile = new TeacherProfile({
        userId: teacher._id,
        name: 'Sarah Connor',
        email: defaultEmail,
      });
      await profile.save();
      console.log('[Seed] Default Teacher account created: teacher.test@neuroscreen.org / password123');
    }

    // Seed default Parent
    const { normalizePhone } = require('../utils/phoneUtils');
    const defaultPhone = normalizePhone('+15550001111');
    let parent = await User.findOne({ phone: defaultPhone, role: 'PARENT' });
    if (!parent) {
      parent = new User({
        phone: defaultPhone,
        role: 'PARENT',
        isVerified: true,
      });
      await parent.save();

      const profile = new ParentProfile({
        userId: parent._id,
        name: 'John Parent',
        phone: defaultPhone,
      });
      await profile.save();
      console.log('[Seed] Default Parent account created: +15550001111 / OTP 123456');
    }
  } catch (err) {
    console.error('[Seed Error]:', err.message);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected successfully');
  } catch (error) {
    console.error('[MongoDB] Disconnect error:', error);
  }
};

module.exports = { connectDB, disconnectDB };
