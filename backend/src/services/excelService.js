const xlsx = require('xlsx');
const fs = require('fs');
const Student = require('../models/Student');
const User = require('../models/User');
const ParentStudentLink = require('../models/ParentStudentLink');
const { normalizePhone } = require('../utils/phoneUtils');

const parseAndValidateExcel = async (filePath, classId, schoolId) => {
  if (!fs.existsSync(filePath)) {
    throw new Error('Uploaded Excel file not found');
  }

  // Read workbook
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel workbook contains no readable sheets');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    return {
      totalRows: 0,
      validRowsCount: 0,
      invalidRowsCount: 0,
      summary: 'Excel file is empty',
      errors: [{ row: 0, field: 'file', message: 'Excel file contains no data rows' }],
      preview: [],
    };
  }

  const requiredHeaders = ['Student Name', 'Roll Number', 'Parent Phone Number'];
  const firstRowKeys = Object.keys(rawRows[0]).map((k) => k.trim());
  const missingHeaders = requiredHeaders.filter((h) => !firstRowKeys.includes(h));

  if (missingHeaders.length > 0) {
    return {
      totalRows: rawRows.length,
      validRowsCount: 0,
      invalidRowsCount: rawRows.length,
      summary: `Missing required column headers: ${missingHeaders.join(', ')}`,
      errors: [
        {
          row: 1,
          field: 'headers',
          message: `Required columns missing: ${missingHeaders.join(', ')}. Expected headers: 'Student Name', 'Roll Number', 'Parent Phone Number'`,
        },
      ],
      preview: [],
    };
  }

  // Fetch existing roll numbers in database for this class
  let existingDbRollNumbers = new Set();
  if (classId) {
    const existingStudents = await Student.find({ classId }).select('rollNumber');
    existingDbRollNumbers = new Set(existingStudents.map((s) => s.rollNumber.toString().trim().toUpperCase()));
  }

  const seenRollNumbersInFile = new Set();
  const validRows = [];
  const errors = [];
  const preview = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rowIndex = i + 2; // Excel 1-indexed + header row
    const row = rawRows[i];

    const rawName = String(row['Student Name'] || '').trim();
    const rawRoll = String(row['Roll Number'] || '').trim().toUpperCase();
    const rawPhone = String(row['Parent Phone Number'] || '').trim();

    const rowErrors = [];

    // Validation 1: Missing Student Name
    if (!rawName) {
      rowErrors.push({ row: rowIndex, field: 'Student Name', message: 'Student Name is required' });
    }

    // Validation 2: Missing Roll Number
    if (!rawRoll) {
      rowErrors.push({ row: rowIndex, field: 'Roll Number', message: 'Roll Number is required' });
    } else {
      // Validation 3: Duplicate roll number in file
      if (seenRollNumbersInFile.has(rawRoll)) {
        rowErrors.push({
          row: rowIndex,
          field: 'Roll Number',
          message: `Duplicate Roll Number '${rawRoll}' found within Excel file`,
        });
      } else {
        seenRollNumbersInFile.add(rawRoll);
      }

      // Validation 4: Duplicate roll number in database for this class
      if (existingDbRollNumbers.has(rawRoll)) {
        rowErrors.push({
          row: rowIndex,
          field: 'Roll Number',
          message: `Roll Number '${rawRoll}' already exists in database for this class`,
        });
      }
    }

    // Validation 5: Parent Phone Number missing or invalid format
    const phoneRegex = /^\+?[0-9]{7,15}$/;
    const sanitizedPhone = normalizePhone(rawPhone);
    if (!sanitizedPhone) {
      rowErrors.push({ row: rowIndex, field: 'Parent Phone Number', message: 'Parent Phone Number is required' });
    } else if (!phoneRegex.test(sanitizedPhone) && sanitizedPhone.length < 7) {
      rowErrors.push({
        row: rowIndex,
        field: 'Parent Phone Number',
        message: `Invalid Phone Number format '${rawPhone}'. Must contain 7 to 15 digits.`,
      });
    }

    const isValid = rowErrors.length === 0;

    const rowPreview = {
      rowNumber: rowIndex,
      name: rawName,
      rollNumber: rawRoll,
      parentPhone: sanitizedPhone || rawPhone,
      age: row['Age'] ? Number(row['Age']) : 6, // Default age 6 if not provided
      isValid,
      errors: rowErrors.map((e) => e.message),
    };

    preview.push(rowPreview);

    if (isValid) {
      validRows.push(rowPreview);
    } else {
      errors.push(...rowErrors);
    }
  }

  return {
    totalRows: rawRows.length,
    validRowsCount: validRows.length,
    invalidRowsCount: rawRows.length - validRows.length,
    summary: `${validRows.length} valid student records, ${rawRows.length - validRows.length} invalid records found`,
    errors,
    preview,
    validDataToImport: validRows,
  };
};

const commitStudentImport = async (validRows, classId, schoolId) => {
  const importedStudents = [];

  for (const item of validRows) {
    const sanitizedPhone = normalizePhone(item.parentPhone);
    const parentUser = await User.findOne({ phone: sanitizedPhone, role: 'PARENT' });

    let student = await Student.findOne({
      $or: [
        { classId, rollNumber: item.rollNumber },
        { parentPhone: sanitizedPhone, name: { $regex: new RegExp(`^${item.name.trim()}$`, 'i') } }
      ]
    });

    if (!student) {
      student = new Student({
        name: item.name.trim(),
        rollNumber: item.rollNumber,
        age: item.age || 6,
        classId: classId || null,
        schoolId: schoolId || null,
        parentPhone: sanitizedPhone,
        parentId: parentUser ? parentUser._id : undefined,
      });
    } else {
      student.name = item.name.trim();
      student.rollNumber = item.rollNumber;
      if (classId) student.classId = classId;
      if (schoolId) student.schoolId = schoolId;
      student.parentPhone = sanitizedPhone;
      if (parentUser) student.parentId = parentUser._id;
    }

    await student.save();
    importedStudents.push(student);

    if (parentUser) {
      await ParentStudentLink.updateOne(
        { parentId: parentUser._id, studentId: student._id },
        { parentId: parentUser._id, studentId: student._id, linkedByPhone: sanitizedPhone },
        { upsert: true }
      );
    }
  }

  return importedStudents;
};

module.exports = { parseAndValidateExcel, commitStudentImport };
