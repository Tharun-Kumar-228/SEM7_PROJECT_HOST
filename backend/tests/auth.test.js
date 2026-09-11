const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const ParentProfile = require('../src/models/ParentProfile');
const TeacherProfile = require('../src/models/TeacherProfile');

beforeAll(async () => {
  await connectDB();
  await User.deleteMany({});
  await ParentProfile.deleteMany({});
  await TeacherProfile.deleteMany({});
});

afterAll(async () => {
  await User.deleteMany({});
  await ParentProfile.deleteMany({});
  await TeacherProfile.deleteMany({});
  await disconnectDB();
});

describe('Authentication API Tests', () => {
  const testParentPhone = '+15550001111';
  const testTeacherEmail = 'teacher.test@neuroscreen.org';

  test('POST /api/auth/send-otp - Send OTP to Parent Phone', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({ phone: testParentPhone });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.phone).toBe(testParentPhone);
    expect(res.body.data.otpCode).toBe('123456');
  });

  test('POST /api/auth/verify-otp - Verify OTP with invalid code should fail', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: testParentPhone, otpCode: '999999' });
    expect(res.statusCode).toEqual(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/verify-otp - Verify OTP with valid code', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: testParentPhone, otpCode: '123456', parentName: 'John Parent' });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('PARENT');
  });

  test('POST /api/auth/teacher/register - Register new Teacher', async () => {
    const res = await request(app).post('/api/auth/teacher/register').send({
      name: 'Sarah Connor',
      email: testTeacherEmail,
      password: 'password123',
    });
    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('TEACHER');
  });

  test('POST /api/auth/teacher/register - Register duplicate Teacher email should fail with 409', async () => {
    const res = await request(app).post('/api/auth/teacher/register').send({
      name: 'Duplicate Sarah',
      email: testTeacherEmail,
      password: 'password123',
    });
    expect(res.statusCode).toEqual(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('USER_EXISTS');
  });

  test('POST /api/auth/teacher/login - Login with correct Teacher credentials', async () => {
    const res = await request(app).post('/api/auth/teacher/login').send({
      email: testTeacherEmail,
      password: 'password123',
    });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  test('POST /api/auth/teacher/login - Login with wrong password should fail', async () => {
    const res = await request(app).post('/api/auth/teacher/login').send({
      email: testTeacherEmail,
      password: 'wrongpassword',
    });
    expect(res.statusCode).toEqual(401);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/auth/me - Retrieve current authenticated user profile', async () => {
    const loginRes = await request(app).post('/api/auth/teacher/login').send({
      email: testTeacherEmail,
      password: 'password123',
    });
    const token = loginRes.body.data.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testTeacherEmail);
    expect(res.body.data.user.role).toBe('TEACHER');
  });

  test('POST /api/auth/teacher/forgot-password - Request password reset code', async () => {
    const res = await request(app).post('/api/auth/teacher/forgot-password').send({
      email: testTeacherEmail,
    });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/auth/teacher/reset-password - Reset teacher password with valid code', async () => {
    const res = await request(app).post('/api/auth/teacher/reset-password').send({
      email: testTeacherEmail,
      resetToken: '123456',
      newPassword: 'newpassword123',
    });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    // Verify login with new password works
    const loginRes = await request(app).post('/api/auth/teacher/login').send({
      email: testTeacherEmail,
      password: 'newpassword123',
    });
    expect(loginRes.statusCode).toEqual(200);
    expect(loginRes.body.success).toBe(true);
  });
});
