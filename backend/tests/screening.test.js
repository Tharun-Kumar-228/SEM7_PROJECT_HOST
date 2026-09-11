const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Student = require('../src/models/Student');
const Screening = require('../src/models/Screening');
const CharacterSample = require('../src/models/CharacterSample');
const SentenceSample = require('../src/models/SentenceSample');
const ScreeningResult = require('../src/models/ScreeningResult');
const { generateToken } = require('../src/config/jwt');

let parentToken;
let studentId;
let screeningId;

const testImage = path.join(__dirname, 'fixtures', 'sample_stroke.png');

beforeAll(async () => {
  await connectDB();
  const testDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Create mock PNG image byte buffer
  const dummyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(testImage, dummyPng);

  const parent = new User({ phone: '+15558889999', role: 'PARENT', isVerified: true });
  await parent.save();
  parentToken = generateToken({ userId: parent._id.toString(), role: 'PARENT', phone: parent.phone });

  const student = new Student({
    name: 'Child Tester',
    rollNumber: 'SCR001',
    age: 5,
    parentPhone: parent.phone,
    parentId: parent._id,
  });
  await student.save();
  studentId = student._id.toString();
});

afterAll(async () => {
  await User.deleteMany({});
  await Student.deleteMany({});
  await Screening.deleteMany({});
  await CharacterSample.deleteMany({});
  await SentenceSample.deleteMany({});
  await ScreeningResult.deleteMany({});
  await disconnectDB();
});

describe('Screening Workflow, Dysgraphia Sentence Model & Gemini XAI Tests', () => {
  test('POST /api/screenings - Initiate new screening session', async () => {
    const res = await request(app)
      .post('/api/screenings')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ studentId });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('IN_PROGRESS');
    screeningId = res.body.data._id;
  });

  test('POST /api/screenings/character/predict-single - Instant single character Dyslexia testing', async () => {
    const res = await request(app)
      .post('/api/screenings/character/predict-single')
      .set('Authorization', `Bearer ${parentToken}`)
      .field('expectedCharacter', 'B')
      .field('characterType', 'LETTER')
      .attach('sample', testImage);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.success).toBe(true);
    expect(['WITHIN_EXPECTED_RANGE', 'REQUIRES_ATTENTION']).toContain(res.body.data.status);
    expect(res.body.data.model).toContain('VisionMamba');
  });

  test('POST /api/screenings/sentence/predict-single - Instant single sentence Dysgraphia testing', async () => {
    const res = await request(app)
      .post('/api/screenings/sentence/predict-single')
      .set('Authorization', `Bearer ${parentToken}`)
      .field('expectedSentence', 'The quick brown fox jumps over the lazy dog')
      .attach('sample', testImage);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.success).toBe(true);
    expect(['WITHIN_EXPECTED_RANGE', 'REQUIRES_ATTENTION']).toContain(res.body.data.status);
    expect(res.body.data.model).toContain('VMamba2D');
  });

  test('POST /api/screenings/:id/character-samples - Save character stroke sample', async () => {
    const res = await request(app)
      .post(`/api/screenings/${screeningId}/character-samples`)
      .set('Authorization', `Bearer ${parentToken}`)
      .field('expectedCharacter', 'B')
      .field('characterType', 'LETTER')
      .attach('sample', testImage);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.expectedCharacter).toBe('B');
    expect(res.body.data.status).toBe('COMPLETED');
  });

  test('POST /api/screenings/:id/sentence-sample - Save sentence stroke sample', async () => {
    const res = await request(app)
      .post(`/api/screenings/${screeningId}/sentence-sample`)
      .set('Authorization', `Bearer ${parentToken}`)
      .field('expectedSentence', 'The boy is playing with a ball.')
      .attach('sample', testImage);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('COMPLETED');
  });

  test('POST /api/screenings/:id/analyze - Run full dual model screening & Gemini XAI synthesis', async () => {
    const res = await request(app)
      .post(`/api/screenings/${screeningId}/analyze`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(['WITHIN_EXPECTED_RANGE', 'REQUIRES_ATTENTION']).toContain(res.body.data.result.characterStatus);
    expect(['WITHIN_EXPECTED_RANGE', 'REQUIRES_ATTENTION']).toContain(res.body.data.result.sentenceStatus);
    expect(res.body.data.result.xaiExplanation).toBeDefined();
    expect(res.body.data.result.xaiExplanation.summary).toContain('Multimodal XAI Evaluation');
  });

  test('GET /api/screenings/:id/result - Retrieve screening result & XAI report', async () => {
    const res = await request(app)
      .get(`/api/screenings/${screeningId}/result`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.screening.status).toBe('COMPLETED');
    expect(res.body.data.result.disclaimer).toContain('observational and early learning support');
  });
});
