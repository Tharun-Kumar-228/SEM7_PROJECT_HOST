const User = require('../models/User');
const ParentProfile = require('../models/ParentProfile');
const TeacherProfile = require('../models/TeacherProfile');
const Student = require('../models/Student');
const ParentStudentLink = require('../models/ParentStudentLink');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');
const { normalizePhone } = require('../utils/phoneUtils');

// Parent Auth: Send OTP
const sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Phone number is required' },
      });
    }

    const sanitizedPhone = normalizePhone(phone);
    if (!sanitizedPhone) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Please enter a valid phone number' },
      });
    }

    // Generate static/mock OTP for dev/testing (e.g. '123456')
    const otpCode = '123456';
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    let user = await User.findOne({ phone: sanitizedPhone, role: 'PARENT' });
    if (!user) {
      user = new User({
        phone: sanitizedPhone,
        role: 'PARENT',
        isVerified: false,
        otpCode,
        otpExpiresAt,
      });
    } else {
      user.otpCode = otpCode;
      user.otpExpiresAt = otpExpiresAt;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        phone: phone.trim(),
        otpCode: process.env.NODE_ENV === 'production' ? undefined : otpCode, // Exposed for easy testing in non-prod
      },
    });
  } catch (error) {
    next(error);
  }
};

// Parent Auth: Verify OTP
const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otpCode, parentName } = req.body;
    if (!phone || !otpCode) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Phone and OTP code are required' },
      });
    }

    const sanitizedPhone = normalizePhone(phone);
    const user = await User.findOne({ phone: sanitizedPhone, role: 'PARENT' });

    if (!user || user.otpCode !== otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP code' },
      });
    }

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    // Ensure Parent Profile exists
    let profile = await ParentProfile.findOne({ userId: user._id });
    if (!profile) {
      profile = new ParentProfile({
        userId: user._id,
        name: parentName ? parentName.trim() : `Parent-${sanitizedPhone.slice(-4)}`,
        phone: sanitizedPhone,
      });
      await profile.save();
    }

    // Auto-link any existing Students imported by Teachers matching this parent phone (check exact and normalized phone)
    const matchingStudents = await Student.find({
      $or: [{ parentPhone: sanitizedPhone }, { parentPhone: phone.trim() }],
    });
    for (const student of matchingStudents) {
      if (!student.parentId) {
        student.parentId = user._id;
        student.parentPhone = sanitizedPhone; // normalize on student record too
        await student.save();
      }
      await ParentStudentLink.updateOne(
        { parentId: user._id, studentId: student._id },
        { parentId: user._id, studentId: student._id, linkedByPhone: sanitizedPhone },
        { upsert: true }
      );
    }

    const token = generateToken({
      userId: user._id.toString(),
      role: 'PARENT',
      phone: sanitizedPhone,
    });

    return res.status(200).json({
      success: true,
      message: 'Parent authenticated successfully',
      data: {
        token,
        user: {
          id: user._id,
          phone: user.phone,
          role: user.role,
          name: profile.name,
        },
        linkedStudentsCount: matchingStudents.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Teacher Auth: Register
const registerTeacher = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name, email, and password are required' },
      });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    // Check if account already exists with this email across any role
    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'An account with this email address already exists' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({
      email: sanitizedEmail,
      passwordHash,
      role: 'TEACHER',
      isVerified: true,
    });
    await user.save();

    const profile = new TeacherProfile({
      userId: user._id,
      name: name.trim(),
      email: sanitizedEmail,
    });
    await profile.save();

    const token = generateToken({
      userId: user._id.toString(),
      role: 'TEACHER',
      email: sanitizedEmail,
    });

    return res.status(201).json({
      success: true,
      message: 'Teacher registered successfully',
      data: {
        token,
        user: {
          id: user._id,
          name: profile.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Teacher Auth: Login
const loginTeacher = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and password are required' },
      });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: sanitizedEmail, role: 'TEACHER' });
    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const profile = await TeacherProfile.findOne({ userId: user._id });

    const token = generateToken({
      userId: user._id.toString(),
      role: 'TEACHER',
      email: sanitizedEmail,
    });

    return res.status(200).json({
      success: true,
      message: 'Teacher authenticated successfully',
      data: {
        token,
        user: {
          id: user._id,
          name: profile ? profile.name : 'Teacher',
          email: user.email,
          role: user.role,
          schoolId: profile ? profile.schoolId : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get current authenticated user profile
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User account not found' },
      });
    }

    let profile = null;
    if (user.role === 'PARENT') {
      profile = await ParentProfile.findOne({ userId: user._id });
    } else if (user.role === 'TEACHER') {
      profile = await TeacherProfile.findOne({ userId: user._id });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          phone: user.phone,
          email: user.email,
          role: user.role,
          name: profile ? profile.name : undefined,
          schoolId: profile && profile.schoolId ? profile.schoolId : undefined,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Teacher Auth: Forgot Password Request
const forgotPasswordTeacher = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email address is required' },
      });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: sanitizedEmail, role: 'TEACHER' });
    if (!user) {
      // Return 200 to prevent user enumeration
      return res.status(200).json({
        success: true,
        message: 'If a matching account exists, password reset instructions have been sent.',
        data: { resetToken: '123456' },
      });
    }

    const resetToken = '123456';
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset code generated successfully.',
      data: {
        email: sanitizedEmail,
        resetToken: process.env.NODE_ENV === 'production' ? undefined : resetToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Teacher Auth: Reset Password
const resetPasswordTeacher = async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email, reset code, and new password are required' },
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters long' },
      });
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      email: sanitizedEmail,
      role: 'TEACHER',
      resetPasswordToken: resetToken,
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired password reset code' },
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiresAt = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// Update User Profile (Teacher or Parent)
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User account not found' },
      });
    }

    const { name, email, phone } = req.body;

    if (user.role === 'TEACHER') {
      const TeacherProfile = require('../models/TeacherProfile');
      let profile = await TeacherProfile.findOne({ userId: user._id });
      if (!profile) {
        profile = new TeacherProfile({ userId: user._id, name: name || 'Teacher', email: user.email });
      }

      if (name) {
        profile.name = name.trim();
      }

      if (email && email.trim().toLowerCase() !== user.email) {
        const sanitizedEmail = email.trim().toLowerCase();
        const existing = await User.findOne({ _id: { $ne: user._id }, email: sanitizedEmail });
        if (existing) {
          return res.status(409).json({
            success: false,
            error: { code: 'USER_EXISTS', message: 'An account with this email address already exists' },
          });
        }
        user.email = sanitizedEmail;
        profile.email = sanitizedEmail;
      }

      await user.save();
      await profile.save();

      return res.status(200).json({
        success: true,
        message: 'Teacher profile updated successfully',
        data: {
          user: {
            id: user._id,
            name: profile.name,
            email: user.email,
            role: user.role,
          },
        },
      });
    } else if (user.role === 'PARENT') {
      const ParentProfile = require('../models/ParentProfile');
      let profile = await ParentProfile.findOne({ userId: user._id });
      if (!profile) {
        profile = new ParentProfile({ userId: user._id, name: name || 'Parent', phone: user.phone });
      }

      if (name) {
        profile.name = name.trim();
      }

      if (phone) {
        const sanitizedPhone = normalizePhone(phone);
        if (sanitizedPhone !== user.phone) {
          const existing = await User.findOne({ _id: { $ne: user._id }, phone: sanitizedPhone, role: 'PARENT' });
          if (existing) {
            return res.status(409).json({
              success: false,
              error: { code: 'USER_EXISTS', message: 'A parent account with this phone number already exists' },
            });
          }
          user.phone = sanitizedPhone;
          profile.phone = sanitizedPhone;
        }
      }

      await user.save();
      await profile.save();

      return res.status(200).json({
        success: true,
        message: 'Parent profile updated successfully',
        data: {
          user: {
            id: user._id,
            name: profile.name,
            phone: user.phone,
            role: user.role,
          },
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  registerTeacher,
  loginTeacher,
  getMe,
  forgotPasswordTeacher,
  resetPasswordTeacher,
  updateProfile,
};

