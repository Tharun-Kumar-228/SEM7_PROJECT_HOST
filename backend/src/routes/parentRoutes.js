const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { addChild, getChildren, recordConsent, deleteChild } = require('../controllers/parentController');

router.use(authenticate);
router.use(requireRole('PARENT'));

router.post('/children', addChild);
router.get('/children', getChildren);
router.delete('/children/:id', deleteChild);
router.post('/consent', recordConsent);

module.exports = router;
