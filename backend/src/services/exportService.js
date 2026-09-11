const xlsx = require('xlsx');
const Student = require('../models/Student');
const Screening = require('../models/Screening');
const ScreeningResult = require('../models/ScreeningResult');

const generateClassReportExcel = async (classId) => {
  const students = await Student.find({ classId }).sort({ rollNumber: 1 });

  const exportData = [];

  for (const student of students) {
    const latestScreening = await Screening.findOne({ studentId: student._id }).sort({ createdAt: -1 });
    let result = null;
    if (latestScreening) {
      result = await ScreeningResult.findOne({ screeningId: latestScreening._id });
    }

    exportData.push({
      'Roll Number': student.rollNumber,
      'Student Name': student.name,
      'Parent Phone': student.parentPhone,
      Age: student.age,
      'Screening Status': latestScreening ? latestScreening.status : 'NOT_STARTED',
      'Character Screening': result ? result.characterStatus : 'PENDING',
      'Sentence Screening': result ? result.sentenceStatus : 'PENDING',
      'Overall Interpretation': result ? result.overallInterpretation : 'No screening performed yet',
      'Screening Date': latestScreening ? latestScreening.createdAt.toISOString().split('T')[0] : 'N/A',
      Disclaimer: result ? result.disclaimer : 'Observational pre-screening tool. Not a medical diagnosis.',
    });
  }

  const worksheet = xlsx.utils.json_to_sheet(exportData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Class Screening Report');

  const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return excelBuffer;
};

module.exports = { generateClassReportExcel };
