const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { addChild, getChildren, recordConsent } = require('../controllers/parentController');

router.use(authenticate);
router.use(requireRole('PARENT'));

router.post('/children', addChild);
router.get('/children', getChildren);
router.post('/consent', recordConsent);

module.exports = router;
