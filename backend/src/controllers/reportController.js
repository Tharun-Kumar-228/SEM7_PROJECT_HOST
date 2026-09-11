const Student = require('../models/Student');
const Screening = require('../models/Screening');
const ScreeningResult = require('../models/ScreeningResult');
const Class = require('../models/Class');
const { generateClassReportExcel } = require('../services/exportService');

// Individual Student Report
const getStudentReport = async (req, res, next) => {
  try {
    const studentId = req.params.id;
    const student = await Student.findById(studentId).populate('classId').populate('schoolId');

    if (!student) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Student record not found' },
      });
    }

    const screenings = await Screening.find({ studentId }).sort({ createdAt: -1 });

    const history = [];
    for (const s of screenings) {
      const result = await ScreeningResult.findOne({ screeningId: s._id });
      history.push({
        screeningId: s._id,
        date: s.createdAt,
        status: s.status,
        characterStatus: result ? result.characterStatus : 'ANALYSIS_PENDING',
        sentenceStatus: result ? result.sentenceStatus : 'ANALYSIS_PENDING',
        dyslexiaConfidence: result ? result.dyslexiaConfidence : 0.95,
        dysgraphiaConfidence: result ? result.dysgraphiaConfidence : 0.90,
        overallInterpretation: result ? result.overallInterpretation : 'Pending ML Service',
        xaiExplanation: result ? result.xaiExplanation : null,
        disclaimer: result ? result.disclaimer : 'Observational pre-screening only.',
      });
    }

    const latest = history.length > 0 ? history[0] : null;

    return res.status(200).json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          age: student.age,
          grade: student.grade,
          parentPhone: student.parentPhone,
          class: student.classId ? `${student.classId.grade}-${student.classId.section}` : 'N/A',
        },
        latestReport: latest,
        screeningHistory: history,
        disclaimer:
          'NEUROSCREEN is an observational pre-screening tool for early learning support. It does NOT provide a medical, clinical, or educational diagnosis.',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Class Aggregate Report
const getClassReport = async (req, res, next) => {
  try {
    const classId = req.params.id;
    const cls = await Class.findById(classId).populate('schoolId');
    if (!cls) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Class not found' },
      });
    }

    const students = await Student.find({ classId }).sort({ rollNumber: 1 });

    let completedCount = 0;
    let pendingCount = 0;
    let notStartedCount = 0;
    let requiresAttentionCount = 0;

    const studentReports = [];

    for (const student of students) {
      const latestScreening = await Screening.findOne({ studentId: student._id }).sort({ createdAt: -1 });
      let result = null;

      if (!latestScreening) {
        notStartedCount++;
      } else if (latestScreening.status !== 'COMPLETED') {
        pendingCount++;
      } else {
        completedCount++;
        result = await ScreeningResult.findOne({ screeningId: latestScreening._id });
        if (
          result &&
          (result.characterStatus === 'REQUIRES_ATTENTION' || result.sentenceStatus === 'REQUIRES_ATTENTION')
        ) {
          requiresAttentionCount++;
        }
      }

      studentReports.push({
        studentId: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        status: latestScreening ? latestScreening.status : 'NOT_STARTED',
        characterStatus: result ? result.characterStatus : 'PENDING',
        sentenceStatus: result ? result.sentenceStatus : 'PENDING',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        class: {
          id: cls._id,
          name: `Grade ${cls.grade} Section ${cls.section}`,
          academicYear: cls.academicYear,
        },
        summary: {
          totalStudents: students.length,
          completedScreenings: completedCount,
          pendingScreenings: pendingCount,
          notStartedScreenings: notStartedCount,
          requiresAttention: requiresAttentionCount,
        },
        students: studentReports,
        disclaimer:
          'Class screening metrics represent pre-screening observational statistics. They do not constitute diagnostic medical assessments.',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Export Class Excel Report
const exportClassExcel = async (req, res, next) => {
  try {
    const classId = req.params.id;
    const excelBuffer = await generateClassReportExcel(classId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Class_Screening_Report_${classId}.xlsx"`);
    return res.status(200).send(excelBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentReport,
  getClassReport,
  exportClassExcel,
};
