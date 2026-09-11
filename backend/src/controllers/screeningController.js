const Screening = require('../models/Screening');
const CharacterSample = require('../models/CharacterSample');
const SentenceSample = require('../models/SentenceSample');
const ScreeningResult = require('../models/ScreeningResult');
const Student = require('../models/Student');
const screeningService = require('../services/screeningService');
const { resolveSampleImagePath } = require('../services/strokeRenderer');
const path = require('path');
const fs = require('fs');

// Initiate new screening session
const createScreening = async (req, res, next) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'studentId is required' },
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Student record not found' },
      });
    }

    const screening = new Screening({
      studentId,
      initiatedByRole: req.user ? req.user.role : 'PARENT',
      initiatorId: req.user ? req.user.userId : student.parentId,
      status: 'IN_PROGRESS',
    });
    await screening.save();

    return res.status(201).json({
      success: true,
      message: 'Screening session initiated',
      data: screening,
    });
  } catch (error) {
    next(error);
  }
};

// Upload Character Stroke Sample
const saveCharacterSample = async (req, res, next) => {
  try {
    const { id } = req.params; // screeningId
    const { expectedCharacter, characterType } = req.body;

    const imagePath = await resolveSampleImagePath(req);
    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Handwriting sample image file or stroke paths are required' },
      });
    }

    const screening = await Screening.findById(id);
    if (!screening) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Screening session not found' },
      });
    }

    const sample = new CharacterSample({
      screeningId: screening._id,
      studentId: screening.studentId,
      expectedCharacter: expectedCharacter || 'B',
      characterType: characterType || 'LETTER',
      imagePath,
      status: 'ANALYSIS_PENDING',
    });
    await sample.save();

    screening.characterSamples.push(sample._id);
    await screening.save();

    // Trigger instant VisionMamba single character inference
    let directPrediction = null;
    try {
      directPrediction = await screeningService.predictSingleCharacterDirect(sample);
      if (directPrediction && directPrediction.success) {
        sample.prediction = directPrediction.prediction;
        sample.probability = directPrediction.probability;
        sample.classification = directPrediction.classification;
        sample.processingTimeMs = directPrediction.processingTimeMs;
        sample.status = 'COMPLETED';
        await sample.save();
      }
    } catch (err) {
      console.error('Instant single character prediction error:', err);
    }

    return res.status(201).json({
      success: true,
      message: 'Character stroke sample stored and analyzed successfully',
      data: sample,
      analysis: directPrediction,
    });
  } catch (error) {
    next(error);
  }
};

// Upload Sentence Stroke Sample
const saveSentenceSample = async (req, res, next) => {
  try {
    const { id } = req.params; // screeningId
    const { expectedSentence } = req.body;

    const imagePath = await resolveSampleImagePath(req);
    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'Sentence handwriting image file or stroke paths are required' },
      });
    }

    const screening = await Screening.findById(id);
    if (!screening) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Screening session not found' },
      });
    }

    const sample = new SentenceSample({
      screeningId: screening._id,
      studentId: screening.studentId,
      expectedSentence: expectedSentence || 'The boy is playing with a ball.',
      imagePath,
      status: 'ANALYSIS_PENDING',
    });
    await sample.save();

    screening.sentenceSample = sample._id;
    await screening.save();

    // Trigger instant VMamba2D Dysgraphia sentence inference
    let directPrediction = null;
    try {
      directPrediction = await screeningService.predictSingleSentenceDirect(sample);
      if (directPrediction && directPrediction.success) {
        sample.prediction = directPrediction.prediction;
        sample.probability = directPrediction.probability;
        sample.classification = directPrediction.classification;
        sample.processingTimeMs = directPrediction.processingTimeMs;
        sample.status = 'COMPLETED';
        await sample.save();
      }
    } catch (err) {
      console.error('Instant sentence prediction error:', err);
    }

    return res.status(201).json({
      success: true,
      message: 'Sentence stroke sample stored and analyzed successfully',
      data: sample,
      analysis: directPrediction,
    });
  } catch (error) {
    next(error);
  }
};

// Direct Single Character Testing API
const predictSingleCharacterDirect = async (req, res, next) => {
  try {
    const imagePath = await resolveSampleImagePath(req);

    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_IMAGE', message: 'Please upload an image file, stroke paths, or provide imageBase64' },
      });
    }

    const result = await screeningService.predictSingleCharacterDirect({
      imagePath,
      expectedCharacter: req.body.expectedCharacter || 'B',
      characterType: req.body.characterType || 'LETTER',
    });

    return res.status(200).json({
      success: true,
      message: 'VisionMamba single character dyslexia prediction complete',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Direct Single Sentence Testing API (Dysgraphia)
const predictSingleSentenceDirect = async (req, res, next) => {
  try {
    const imagePath = await resolveSampleImagePath(req);

    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_IMAGE', message: 'Please upload an image file, stroke paths, or provide imageBase64' },
      });
    }

    const result = await screeningService.predictSingleSentenceDirect({
      imagePath,
      expectedSentence: req.body.expectedSentence || 'The boy is playing with a ball.',
    });

    return res.status(200).json({
      success: true,
      message: 'VMamba2D single sentence dysgraphia prediction complete',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Trigger Full Screening Analysis (Dual Model + Gemini XAI)
const analyzeScreening = async (req, res, next) => {
  try {
    const { id } = req.params; // screeningId
    const { screening, result } = await screeningService.runAnalysis(id);

    return res.status(200).json({
      success: true,
      message: 'Screening analysis and Explainable AI (XAI) synthesis completed',
      data: {
        screening,
        result,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get Screening Session & Result
const getScreeningResult = async (req, res, next) => {
  try {
    const { id } = req.params;
    const screening = await Screening.findById(id)
      .populate('studentId')
      .populate('characterSamples')
      .populate('sentenceSample');

    if (!screening) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Screening session not found' },
      });
    }

    const result = await ScreeningResult.findOne({ screeningId: id });

    return res.status(200).json({
      success: true,
      data: {
        screening,
        result: result || {
          characterStatus: 'ANALYSIS_PENDING',
          sentenceStatus: 'ANALYSIS_PENDING',
          overallInterpretation: 'Screening in progress / analysis pending',
          disclaimer:
            'This pre-screening result is generated for observational and early learning support purposes only. It does NOT constitute a medical diagnosis.',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get list of screenings
const getScreenings = async (req, res, next) => {
  try {
    let studentIds = [];

    if (req.user && req.user.role === 'PARENT') {
      const ParentStudentLink = require('../models/ParentStudentLink');
      const children = await Student.find({ parentId: req.user.userId });
      const links = await ParentStudentLink.find({ parentId: req.user.userId });
      const linkedStudentIds = links.map((l) => l.studentId);
      const ownStudentIds = children.map((c) => c._id);
      studentIds = [...ownStudentIds, ...linkedStudentIds];
    } else if (req.user && req.user.role === 'TEACHER') {
      const Class = require('../models/Class');
      const teacherClasses = await Class.find({ teacherId: req.user.userId });
      const classIds = teacherClasses.map((c) => c._id);
      const students = await Student.find({ classId: { $in: classIds } });
      studentIds = students.map((s) => s._id);
    }

    const query = {};
    if (req.query.studentId) {
      query.studentId = req.query.studentId;
    } else if (studentIds.length > 0) {
      query.studentId = { $in: studentIds };
    } else if (req.user && (req.user.role === 'PARENT' || req.user.role === 'TEACHER')) {
      return res.status(200).json({ success: true, data: [] });
    }

    const screenings = await Screening.find(query)
      .populate('studentId')
      .sort({ createdAt: -1 });

    const formattedScreenings = [];
    for (const s of screenings) {
      if (s.status !== 'COMPLETED' && (s.characterSamples?.length > 0 || s.sentenceSample)) {
        try {
          const resData = await screeningService.runAnalysis(s._id);
          if (resData && resData.screening) {
            s.status = resData.screening.status;
          }
        } catch (err) {}
      }

      formattedScreenings.push({
        _id: s._id,
        studentId: s.studentId ? s.studentId._id : null,
        studentName: s.studentId ? s.studentId.name : 'Child',
        status: s.status === 'COMPLETED' || (s.characterSamples && s.characterSamples.length > 0) || s.sentenceSample ? 'COMPLETED' : s.status,
        initiatedByRole: s.initiatedByRole,
        createdAt: s.createdAt,
      });
    }

    return res.status(200).json({
      success: true,
      data: formattedScreenings,
    });
  } catch (error) {
    next(error);
  }
};

// Delete a screening session and its associated results & samples
const deleteScreening = async (req, res, next) => {
  try {
    const { id } = req.params;
    const screening = await Screening.findById(id);

    if (!screening) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Screening session not found' },
      });
    }

    // Cascade delete associated models & samples
    await CharacterSample.deleteMany({ screeningId: id });
    await SentenceSample.deleteMany({ screeningId: id });
    await ScreeningResult.deleteMany({ screeningId: id });
    await Screening.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Screening session and all associated report data deleted successfully',
      data: { screeningId: id },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createScreening,
  saveCharacterSample,
  saveSentenceSample,
  analyzeScreening,
  predictSingleCharacterDirect,
  predictSingleSentenceDirect,
  getScreeningResult,
  getScreenings,
  deleteScreening,
};
