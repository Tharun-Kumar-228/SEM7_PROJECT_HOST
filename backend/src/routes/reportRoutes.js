const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { verifyStudentAccess } = require('../middleware/ownershipMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { getStudentReport, getClassReport, exportClassExcel } = require('../controllers/reportController');

router.use(authenticate);

router.get('/student/:id', verifyStudentAccess, getStudentReport);
router.get('/class/:id', requireRole('TEACHER'), getClassReport);
router.get('/class/:id/export', requireRole('TEACHER'), exportClassExcel);

module.exports = router;
