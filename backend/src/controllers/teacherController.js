const School = require('../models/School');
const Class = require('../models/Class');
const Student = require('../models/Student');
const TeacherProfile = require('../models/TeacherProfile');
const { parseAndValidateExcel, commitStudentImport } = require('../services/excelService');

// Create/Link School
const createSchool = async (req, res, next) => {
  try {
    const { name, code, address } = req.body;
    if (!name || !code) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'School name and unique school code are required' },
      });
    }

    const schoolCode = code.trim().toUpperCase();
    let school = await School.findOne({ code: schoolCode });

    if (!school) {
      school = new School({
        name: name.trim(),
        code: schoolCode,
        address: address ? address.trim() : '',
        createdByTeacherId: req.user.userId,
      });
      await school.save();
    }

    // Update teacher profile
    await TeacherProfile.updateOne({ userId: req.user.userId }, { schoolId: school._id });

    return res.status(201).json({
      success: true,
      message: 'School configured successfully',
      data: school,
    });
  } catch (error) {
    next(error);
  }
};

// Create Class
const createClass = async (req, res, next) => {
  try {
    const { schoolId, grade, section, academicYear } = req.body;
    if (!schoolId || !grade || !section) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'schoolId, grade, and section are required' },
      });
    }

    const cls = new Class({
      schoolId,
      teacherId: req.user.userId,
      grade: grade.trim(),
      section: section.trim(),
      academicYear: academicYear ? academicYear.trim() : '2026-2027',
    });
    await cls.save();

    return res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: cls,
    });
  } catch (error) {
    next(error);
  }
};

// Get Teacher Classes
const getClasses = async (req, res, next) => {
  try {
    const classes = await Class.find({ teacherId: req.user.userId }).populate('schoolId');
    return res.status(200).json({
      success: true,
      data: classes,
    });
  } catch (error) {
    next(error);
  }
};

// Validate Excel file (Preview stage)
const validateExcelImport = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Excel file (.xlsx) is required for upload' },
      });
    }

    const { classId, schoolId } = req.body;
    const validationResult = await parseAndValidateExcel(req.file.path, classId, schoolId);

    return res.status(200).json({
      success: true,
      data: validationResult,
      filePath: req.file.path,
    });
  } catch (error) {
    next(error);
  }
};

// Confirm Excel Student Import
const confirmExcelImport = async (req, res, next) => {
  try {
    const { validDataToImport, classId, schoolId } = req.body;
    if (!validDataToImport || !Array.isArray(validDataToImport) || validDataToImport.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'No valid data provided to import' },
      });
    }

    const importedStudents = await commitStudentImport(validDataToImport, classId, schoolId);

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${importedStudents.length} students`,
      data: {
        importedCount: importedStudents.length,
        students: importedStudents,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get Students for Teacher with filtering & pagination
const getStudents = async (req, res, next) => {
  try {
    const { schoolId, classId, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (classId) {
      query.classId = classId;
    } else if (schoolId) {
      const schoolClasses = await Class.find({ schoolId, teacherId: req.user.userId });
      const classIds = schoolClasses.map((c) => c._id);
      query.classId = { $in: classIds };
    } else {
      // Find all classes created by this teacher
      const teacherClasses = await Class.find({ teacherId: req.user.userId });
      const classIds = teacherClasses.map((c) => c._id);
      query.classId = { $in: classIds };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { parentPhone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const students = await Student.find(query)
      .populate('classId')
      .populate('schoolId')
      .sort({ rollNumber: 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Student.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        students,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Add Student Manually
const addStudentManual = async (req, res, next) => {
  try {
    const { name, rollNumber, parentPhone, classId, age } = req.body;
    if (!name || !rollNumber || !parentPhone) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name, roll number, and parent phone are required' },
      });
    }

    let targetClassId = classId;
    let cls;

    if (targetClassId && targetClassId !== 'auto') {
      cls = await Class.findOne({ _id: targetClassId, teacherId: req.user.userId });
    }

    if (!cls) {
      // Auto-find or auto-create a default class for teacher if not provided or missing
      cls = await Class.findOne({ teacherId: req.user.userId });
      if (!cls) {
        let school = await School.findOne({ createdByTeacherId: req.user.userId });
        if (!school) {
          school = new School({
            name: 'Default Primary School',
            code: `SCH-${Date.now().toString().slice(-6)}`,
            createdByTeacherId: req.user.userId,
          });
          await school.save();
        }
        cls = new Class({
          schoolId: school._id,
          teacherId: req.user.userId,
          grade: 'Grade 1',
          section: 'Section A',
          academicYear: '2026-2027',
        });
        await cls.save();
      }
      targetClassId = cls._id;
    }

    const { normalizePhone } = require('../utils/phoneUtils');
    const ParentStudentLink = require('../models/ParentStudentLink');
    const User = require('../models/User');

    const sanitizedRoll = rollNumber.trim();
    const sanitizedName = name.trim();
    const sanitizedPhone = normalizePhone(parentPhone);

    // Check if a student with same parentPhone and name already exists (e.g. created by parent)
    let existingStudent = await Student.findOne({
      $or: [
        { classId: targetClassId, rollNumber: sanitizedRoll },
        { classId: targetClassId, name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') } },
        { parentPhone: sanitizedPhone, name: { $regex: new RegExp(`^${sanitizedName}$`, 'i') } }
      ]
    });

    const parentUser = await User.findOne({ phone: sanitizedPhone, role: 'PARENT' });

    if (existingStudent) {
      existingStudent.classId = targetClassId;
      existingStudent.schoolId = cls.schoolId;
      existingStudent.rollNumber = sanitizedRoll;
      existingStudent.parentPhone = sanitizedPhone;
      if (age) existingStudent.age = Number(age);
      if (parentUser) existingStudent.parentId = parentUser._id;
      await existingStudent.save();

      if (parentUser) {
        await ParentStudentLink.updateOne(
          { parentId: parentUser._id, studentId: existingStudent._id },
          { parentId: parentUser._id, studentId: existingStudent._id, linkedByPhone: sanitizedPhone },
          { upsert: true }
        );
      }

      return res.status(200).json({
        success: true,
        message: 'Student record mapped and updated successfully',
        data: existingStudent,
      });
    }

    const student = new Student({
      name: sanitizedName,
      rollNumber: sanitizedRoll,
      parentPhone: sanitizedPhone,
      classId: targetClassId,
      schoolId: cls.schoolId,
      age: age ? Number(age) : 6,
      parentId: parentUser ? parentUser._id : undefined,
    });

    await student.save();

    if (parentUser) {
      await ParentStudentLink.create({
        parentId: parentUser._id,
        studentId: student._id,
        linkedByPhone: sanitizedPhone,
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: 'Student added successfully',
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

// Get Single Student by ID
const getStudentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid Student ID format' },
      });
    }

    const student = await Student.findById(id).populate('classId').populate('schoolId');
    if (!student) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Student not found' },
      });
    }

    // IDOR Check: Ensure teacher owns student's class
    const cls = await Class.findOne({ _id: student.classId._id, teacherId: req.user.userId });
    if (!cls) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized access to student record' },
      });
    }

    return res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

// Update Student Details
const updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid Student ID format' },
      });
    }

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Student not found' },
      });
    }

    // IDOR Check: Ensure teacher owns student's class
    const cls = await Class.findOne({ _id: student.classId, teacherId: req.user.userId });
    if (!cls) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized access to student record' },
      });
    }

    const { name, rollNumber, parentPhone, age, classId } = req.body;
    const { normalizePhone } = require('../utils/phoneUtils');
    const User = require('../models/User');

    if (name) {
      student.name = name.trim();
    }

    if (rollNumber && rollNumber.trim() !== student.rollNumber) {
      const sanitizedRoll = rollNumber.trim();
      const duplicateRoll = await Student.findOne({
        _id: { $ne: student._id },
        classId: student.classId,
        rollNumber: sanitizedRoll,
      });
      if (duplicateRoll) {
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_ROLL', message: `Student with roll number '${sanitizedRoll}' already exists in this class` },
        });
      }
      student.rollNumber = sanitizedRoll;
    }

    if (parentPhone) {
      const sanitizedPhone = normalizePhone(parentPhone);
      student.parentPhone = sanitizedPhone;
      const parentUser = await User.findOne({ phone: sanitizedPhone, role: 'PARENT' });
      student.parentId = parentUser ? parentUser._id : undefined;
    }

    if (age) {
      student.age = Number(age);
    }

    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      const targetClass = await Class.findOne({ _id: classId, teacherId: req.user.userId });
      if (targetClass) {
        student.classId = targetClass._id;
        student.schoolId = targetClass.schoolId;
      }
    }

    await student.save();
    const updatedStudent = await Student.findById(student._id).populate('classId').populate('schoolId');

    return res.status(200).json({
      success: true,
      message: 'Student record updated successfully',
      data: updatedStudent,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSchool,
  createClass,
  getClasses,
  validateExcelImport,
  confirmExcelImport,
  getStudents,
  addStudentManual,
  getStudentById,
  updateStudent,
};

