const mongoose = require('mongoose');
const Student = require('../models/Student');
const ParentStudentLink = require('../models/ParentStudentLink');
const Class = require('../models/Class');
const School = require('../models/School');

const verifyStudentAccess = async (req, res, next) => {
  try {
    const studentId = req.params.studentId || req.params.id || req.body.studentId;
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid or missing student ID',
        },
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Student not found',
        },
      });
    }

    if (req.user.role === 'PARENT') {
      // Check parent-student link or direct parentId match
      const link = await ParentStudentLink.findOne({
        parentId: req.user.userId,
        studentId: student._id,
      });

      const directMatch = student.parentId && student.parentId.toString() === req.user.userId.toString();

      if (!link && !directMatch) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to access this student record',
          },
        });
      }
    } else if (req.user.role === 'TEACHER') {
      // Check if student belongs to teacher's class or school
      if (student.classId) {
        const cls = await Class.findById(student.classId);
        if (!cls || cls.teacherId.toString() !== req.user.userId.toString()) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You are not authorized to access students outside your assigned class',
            },
          });
        }
      } else if (student.schoolId) {
        const school = await School.findById(student.schoolId);
        if (!school || school.createdByTeacherId.toString() !== req.user.userId.toString()) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You are not authorized to access students outside your school',
            },
          });
        }
      }
    }

    req.student = student;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { verifyStudentAccess };
