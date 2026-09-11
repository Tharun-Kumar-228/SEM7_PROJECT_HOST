const request = require('supertest');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const TeacherProfile = require('../src/models/TeacherProfile');
const Student = require('../src/models/Student');
const Class = require('../src/models/Class');
const School = require('../src/models/School');
const { generateToken } = require('../src/config/jwt');

let teacherToken;
let classId;
let schoolId;

const testDir = path.join(__dirname, 'fixtures');

beforeAll(async () => {
  await connectDB();
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const teacher = new User({ email: 'excel.teacher@neuroscreen.org', role: 'TEACHER', isVerified: true });
  await teacher.save();
  teacherToken = generateToken({ userId: teacher._id.toString(), role: 'TEACHER', email: teacher.email });

  const school = new School({ name: 'Excel Test School', code: 'EX101', createdByTeacherId: teacher._id });
  await school.save();
  schoolId = school._id.toString();

  const cls = new Class({ schoolId: school._id, teacherId: teacher._id, grade: 'K2', section: 'B', academicYear: '2026' });
  await cls.save();
  classId = cls._id.toString();
});

afterAll(async () => {
  await User.deleteMany({});
  await TeacherProfile.deleteMany({});
  await Student.deleteMany({});
  await Class.deleteMany({});
  await School.deleteMany({});
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  await disconnectDB();
});

describe('Excel Student Import & 12-Step Validation Engine Tests', () => {
  test('Upload Non-Excel File should be rejected', async () => {
    const txtFile = path.join(testDir, 'invalid.txt');
    fs.writeFileSync(txtFile, 'this is text file');

    const res = await request(app)
      .post('/api/teachers/students/excel-validate')
      .set('Authorization', `Bearer ${teacherToken}`)
      .attach('file', txtFile);

    expect(res.statusCode).toEqual(500); // Multer file filter rejection error
  });

  test('Upload Valid Excel File with 3 Students', async () => {
    const validFile = path.join(testDir, 'valid_students.xlsx');
    const data = [
      { 'Student Name': 'Alice Green', 'Roll Number': 'R001', 'Parent Phone Number': '+15551234567', Age: 6 },
      { 'Student Name': 'Bob White', 'Roll Number': 'R002', 'Parent Phone Number': '+15552345678', Age: 7 },
      { 'Student Name': 'Charlie Brown', 'Roll Number': 'R003', 'Parent Phone Number': '+15553456789', Age: 6 },
    ];
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Students');
    xlsx.writeFile(wb, validFile);

    const res = await request(app)
      .post('/api/teachers/students/excel-validate')
      .set('Authorization', `Bearer ${teacherToken}`)
      .field('classId', classId)
      .field('schoolId', schoolId)
      .attach('file', validFile);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalRows).toBe(3);
    expect(res.body.data.validRowsCount).toBe(3);
    expect(res.body.data.invalidRowsCount).toBe(0);

    // Confirm Import
    const importRes = await request(app)
      .post('/api/teachers/students/excel-import')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        validDataToImport: res.body.data.validDataToImport,
        classId,
        schoolId,
      });

    expect(importRes.statusCode).toEqual(201);
    expect(importRes.body.data.importedCount).toBe(3);
  });

  test('Excel with Missing Required Headers should detect error', async () => {
    const badHeadersFile = path.join(testDir, 'bad_headers.xlsx');
    const data = [{ 'Full Name': 'Wrong Header', ID: 'R999', Mobile: '1234567' }];
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Students');
    xlsx.writeFile(wb, badHeadersFile);

    const res = await request(app)
      .post('/api/teachers/students/excel-validate')
      .set('Authorization', `Bearer ${teacherToken}`)
      .field('classId', classId)
      .attach('file', badHeadersFile);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.validRowsCount).toBe(0);
    expect(res.body.data.errors.length).toBeGreaterThan(0);
  });

  test('Excel with Duplicate Roll Numbers inside file should flag errors', async () => {
    const dupFile = path.join(testDir, 'duplicate_in_file.xlsx');
    const data = [
      { 'Student Name': 'Student One', 'Roll Number': 'DUP01', 'Parent Phone Number': '+15551111111' },
      { 'Student Name': 'Student Two', 'Roll Number': 'DUP01', 'Parent Phone Number': '+15552222222' },
    ];
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Students');
    xlsx.writeFile(wb, dupFile);

    const res = await request(app)
      .post('/api/teachers/students/excel-validate')
      .set('Authorization', `Bearer ${teacherToken}`)
      .field('classId', classId)
      .attach('file', dupFile);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.validRowsCount).toBe(1);
    expect(res.body.data.invalidRowsCount).toBe(1);
  });
});
