const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { uploadSample } = require('../middleware/uploadMiddleware');
const {
  createScreening,
  saveCharacterSample,
  saveSentenceSample,
  analyzeScreening,
  predictSingleCharacterDirect,
  predictSingleSentenceDirect,
  getScreeningResult,
  getScreenings,
} = require('../controllers/screeningController');

router.use(authenticate);

router.post('/', createScreening);
router.get('/', getScreenings);
router.post('/character/predict-single', uploadSample.single('sample'), predictSingleCharacterDirect);
router.post('/sentence/predict-single', uploadSample.single('sample'), predictSingleSentenceDirect);
router.post('/:id/character-samples', uploadSample.single('sample'), saveCharacterSample);
router.post('/:id/sentence-sample', uploadSample.single('sample'), saveSentenceSample);
router.post('/:id/analyze', analyzeScreening);
router.get('/:id/result', getScreeningResult);

module.exports = router;
