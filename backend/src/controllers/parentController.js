const ParentProfile = require('../models/ParentProfile');
const Student = require('../models/Student');
const ParentStudentLink = require('../models/ParentStudentLink');
const Consent = require('../models/Consent');
const User = require('../models/User');
const { normalizePhone } = require('../utils/phoneUtils');

// Add or update a child profile
const addChild = async (req, res, next) => {
  try {
    const { name, age, grade } = req.body;
    if (!name || !age) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Child name and age are required' },
      });
    }

    const parentUser = await User.findById(req.user.userId);
    let parentProfile = await ParentProfile.findOne({ userId: req.user.userId });
    
    const parentPhone = parentProfile ? parentProfile.phone : (parentUser ? parentUser.phone : req.user.phone);
    const sanitizedPhone = normalizePhone(parentPhone);

    if (!parentProfile) {
      parentProfile = new ParentProfile({
        userId: req.user.userId,
        name: `Parent-${sanitizedPhone.slice(-4)}`,
        phone: sanitizedPhone,
      });
      await parentProfile.save();
    }

    const sanitizedName = name.trim();
    
    // Search for existing child profile under this parent OR parent phone
    let existingChild = await Student.findOne({
      $or: [
        { parentId: req.user.userId, name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') } },
        { parentPhone: sanitizedPhone, name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') } }
      ]
    });

    if (existingChild) {
      if (existingChild.parentId && existingChild.parentId.toString() === req.user.userId && existingChild.age === Number(age)) {
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_CHILD', message: `A child profile for '${sanitizedName}' already exists in your account` },
        });
      }
      // Retain & update existing child details
      existingChild.parentId = req.user.userId;
      existingChild.parentPhone = sanitizedPhone;
      existingChild.age = Number(age);
      if (grade) existingChild.grade = grade.trim();
      await existingChild.save();

      await ParentStudentLink.updateOne(
        { parentId: req.user.userId, studentId: existingChild._id },
        { parentId: req.user.userId, studentId: existingChild._id, linkedByPhone: sanitizedPhone },
        { upsert: true }
      );

      return res.status(200).json({
        success: true,
        message: 'Child profile updated and retained successfully',
        data: existingChild,
      });
    }

    const rollNumber = `P-${Date.now().toString().slice(-6)}`;

    const student = new Student({
      name: sanitizedName,
      age: Number(age),
      grade: grade ? grade.trim() : 'Kindergarten',
      rollNumber,
      parentPhone: sanitizedPhone,
      parentId: req.user.userId,
    });
    await student.save();

    await ParentStudentLink.create({
      parentId: req.user.userId,
      studentId: student._id,
      linkedByPhone: sanitizedPhone,
    });

    return res.status(201).json({
      success: true,
      message: 'Child profile created successfully',
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

// Get linked children for parent
const getChildren = async (req, res, next) => {
  try {
    const parentUser = await User.findById(req.user.userId);
    const rawPhone = parentUser ? parentUser.phone : req.user.phone;
    const sanitizedPhone = normalizePhone(rawPhone);

    const links = await ParentStudentLink.find({ parentId: req.user.userId }).populate('studentId');
    const directChildren = await Student.find({
      $or: [
        { parentId: req.user.userId },
        { parentPhone: sanitizedPhone },
        { parentPhone: rawPhone }
      ]
    });

    // Combine, auto-heal missing links, and deduplicate
    const map = new Map();
    for (const link of links) {
      if (link.studentId) {
        map.set(link.studentId._id.toString(), link.studentId);
      }
    }
    for (const child of directChildren) {
      map.set(child._id.toString(), child);

      // Auto-heal missing parentId or link in DB
      if (!child.parentId) {
        child.parentId = req.user.userId;
        child.parentPhone = sanitizedPhone;
        await child.save().catch(() => {});
      }
      await ParentStudentLink.updateOne(
        { parentId: req.user.userId, studentId: child._id },
        { parentId: req.user.userId, studentId: child._id, linkedByPhone: sanitizedPhone },
        { upsert: true }
      ).catch(() => {});
    }

    const children = Array.from(map.values());

    return res.status(200).json({
      success: true,
      data: children,
    });
  } catch (error) {
    next(error);
  }
};

// Record explicit parent consent
const recordConsent = async (req, res, next) => {
  try {
    const { studentId, consentGiven } = req.body;
    if (!studentId || consentGiven === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'studentId and consentGiven boolean are required' },
      });
    }

    const consent = new Consent({
      parentId: req.user.userId,
      studentId,
      consentGiven: Boolean(consentGiven),
      consentVersion: '1.0',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    });
    await consent.save();

    return res.status(200).json({
      success: true,
      message: 'Parent consent recorded successfully',
      data: consent,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addChild,
  getChildren,
  recordConsent,
};
