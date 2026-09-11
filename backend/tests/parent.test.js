const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const ParentProfile = require('../src/models/ParentProfile');
const Student = require('../src/models/Student');
const ParentStudentLink = require('../src/models/ParentStudentLink');
const Consent = require('../src/models/Consent');
const { generateToken } = require('../src/config/jwt');

let parentToken;
let parentUserId;
let createdStudentId;

beforeAll(async () => {
  await connectDB();
  const parentUser = new User({ phone: '+15551112222', role: 'PARENT', isVerified: true });
  await parentUser.save();
  parentUserId = parentUser._id.toString();

  const profile = new ParentProfile({ userId: parentUser._id, name: 'Alice Parent', phone: '+15551112222' });
  await profile.save();

  parentToken = generateToken({ userId: parentUserId, role: 'PARENT', phone: '+15551112222' });
});

afterAll(async () => {
  await User.deleteMany({});
  await ParentProfile.deleteMany({});
  await Student.deleteMany({});
  await ParentStudentLink.deleteMany({});
  await Consent.deleteMany({});
  await disconnectDB();
});

describe('Parent API Tests', () => {
  test('POST /api/parents/children - Add child profile', async () => {
    const res = await request(app)
      .post('/api/parents/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ name: 'Tommy', age: 7, grade: 'Grade 1' });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Tommy');
    createdStudentId = res.body.data._id;
  });

  test('POST /api/parents/children - Add duplicate child profile should fail with 409', async () => {
    const res = await request(app)
      .post('/api/parents/children')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ name: 'Tommy', age: 7, grade: 'Grade 1' });

    expect(res.statusCode).toEqual(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_CHILD');
  });

  test('GET /api/parents/children - List parent children', async () => {
    const res = await request(app)
      .get('/api/parents/children')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /api/parents/consent - Record screening consent', async () => {
    const res = await request(app)
      .post('/api/parents/consent')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ studentId: createdStudentId, consentGiven: true });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.consentGiven).toBe(true);
  });
});
