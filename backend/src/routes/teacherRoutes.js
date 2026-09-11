const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { uploadExcel } = require('../middleware/uploadMiddleware');
const {
  createSchool,
  createClass,
  getClasses,
  validateExcelImport,
  confirmExcelImport,
  getStudents,
  addStudentManual,
  getStudentById,
  updateStudent,
  deleteStudent,
} = require('../controllers/teacherController');

router.use(authenticate);
router.use(requireRole('TEACHER'));

router.post('/schools', createSchool);
router.post('/classes', createClass);
router.get('/classes', getClasses);

router.post('/students/excel-validate', uploadExcel.single('file'), validateExcelImport);
router.post('/students/excel-import', confirmExcelImport);
router.post('/students', addStudentManual);
router.get('/students', getStudents);
router.get('/students/:id', getStudentById);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);


module.exports = router;
