const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  sendOtp,
  verifyOtp,
  registerTeacher,
  loginTeacher,
  getMe,
  forgotPasswordTeacher,
  resetPasswordTeacher,
  updateProfile,
} = require('../controllers/authController');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', loginTeacher);
router.post('/teacher/register', registerTeacher);
router.post('/teacher/login', loginTeacher);
router.post('/teacher/forgot-password', forgotPasswordTeacher);
router.post('/teacher/reset-password', resetPasswordTeacher);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);

module.exports = router;

