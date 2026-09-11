const request = require('supertest');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Student = require('../src/models/Student');
const { generateToken } = require('../src/config/jwt');

let parent1Token, parent2Token;
let parent1StudentId;

beforeAll(async () => {
  await connectDB();

  const user1 = new User({ phone: '+19991112222', role: 'PARENT', isVerified: true });
  await user1.save();
  parent1Token = generateToken({ userId: user1._id.toString(), role: 'PARENT', phone: user1.phone });

  const student1 = new Student({
    name: 'Parent1 Child',
    rollNumber: 'SEC001',
    age: 6,
    parentPhone: user1.phone,
    parentId: user1._id,
  });
  await student1.save();
  parent1StudentId = student1._id.toString();

  const user2 = new User({ phone: '+19993334444', role: 'PARENT', isVerified: true });
  await user2.save();
  parent2Token = generateToken({ userId: user2._id.toString(), role: 'PARENT', phone: user2.phone });
});

afterAll(async () => {
  await User.deleteMany({});
  await Student.deleteMany({});
  await disconnectDB();
});

describe('Security & Access Control Tests', () => {
  test('Requests without JWT header should return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/parents/children');
    expect(res.statusCode).toEqual(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('Parent attempting to access Teacher-only endpoint should return 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/teachers/students')
      .set('Authorization', `Bearer ${parent1Token}`);
    expect(res.statusCode).toEqual(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('IDOR Protection: Parent 2 attempting to access Parent 1 child report should return 403 Forbidden', async () => {
    const res = await request(app)
      .get(`/api/reports/student/${parent1StudentId}`)
      .set('Authorization', `Bearer ${parent2Token}`);

    expect(res.statusCode).toEqual(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('Invalid ObjectId parameter should return 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/reports/student/invalid-object-id-string')
      .set('Authorization', `Bearer ${parent1Token}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });
});
