const PyTorchModelProvider = require('../ml/PyTorchModelProvider');
const geminiXaiService = require('./geminiXaiService');
const Screening = require('../models/Screening');
const CharacterSample = require('../models/CharacterSample');
const SentenceSample = require('../models/SentenceSample');
const ScreeningResult = require('../models/ScreeningResult');

class ScreeningService {
  constructor(modelProvider = new PyTorchModelProvider()) {
    this.modelProvider = modelProvider;
  }

  async runAnalysis(screeningId) {
    const screening = await Screening.findById(screeningId)
      .populate('characterSamples')
      .populate('sentenceSample')
      .populate('studentId');

    if (!screening) {
      throw new Error('Screening session not found');
    }

    screening.status = 'PROCESSING';
    await screening.save();

    // 1. Dyslexia Character Model Analysis (VisionMamba)
    let characterStatus = 'ANALYSIS_PENDING';
    let peakDyslexiaProb = 0;
    let highestCharConf = 0;
    let charAttentionCount = 0;
    let analyzedCharCount = 0;
    let peakCharClasses = null;

    if (screening.characterSamples && screening.characterSamples.length > 0) {
      for (const sample of screening.characterSamples) {
        try {
          const res = await this.modelProvider.predictCharacter(sample);
          if (res && res.success) {
            sample.prediction = res.prediction;
            sample.probability = res.probability;
            sample.classification = res.classification;
            sample.processingTimeMs = res.processingTimeMs;
            sample.status = 'COMPLETED';
            await sample.save();

            analyzedCharCount++;
            if (res.probability > peakDyslexiaProb || !peakCharClasses) {
              peakDyslexiaProb = res.probability;
              peakCharClasses = res.classConfidences;
            }
            if (res.confidence > highestCharConf) {
              highestCharConf = res.confidence;
            }
            if (res.classification === 'REQUIRES_ATTENTION' || res.probability >= 0.5) {
              charAttentionCount++;
            }
          }
        } catch (err) {
          console.error(`Error analyzing character sample ${sample._id}:`, err);
        }
      }

      if (analyzedCharCount > 0) {
        characterStatus = charAttentionCount > 0 ? 'REQUIRES_ATTENTION' : 'WITHIN_EXPECTED_RANGE';
      }
    }

    // 2. Dysgraphia Sentence Model Analysis (VMamba2D)
    let sentenceStatus = 'ANALYSIS_PENDING';
    let dysgraphiaProb = 0;
    let sentenceConf = 0;
    let sentClasses = null;

    if (screening.sentenceSample) {
      try {
        const sentRes = await this.modelProvider.predictSentence(screening.sentenceSample);
        if (sentRes && sentRes.success) {
          screening.sentenceSample.prediction = sentRes.prediction;
          screening.sentenceSample.probability = sentRes.probability;
          screening.sentenceSample.classification = sentRes.classification;
          screening.sentenceSample.processingTimeMs = sentRes.processingTimeMs;
          screening.sentenceSample.status = 'COMPLETED';
          await screening.sentenceSample.save();

          sentenceStatus = sentRes.classification;
          dysgraphiaProb = sentRes.probability;
          sentenceConf = sentRes.confidence;
          sentClasses = sentRes.classConfidences;
        }
      } catch (err) {
        console.error('Error analyzing sentence sample:', err);
      }
    }

    // 3. Generate Gemini Explainable AI (XAI) Synthesis Report
    const studentInfo = screening.studentId
      ? { name: screening.studentId.name, age: screening.studentId.age, grade: screening.studentId.grade }
      : { name: 'Child', age: 6, grade: 'K' };

    let xaiExplanation;
    try {
      xaiExplanation = await geminiXaiService.generateXaiExplanation({
        characterMetrics: {
          status: characterStatus,
          probability: peakDyslexiaProb,
          confidence: highestCharConf || (1 - peakDyslexiaProb),
          count: analyzedCharCount,
          classConfidences: peakCharClasses,
        },
        sentenceMetrics: {
          status: sentenceStatus,
          probability: dysgraphiaProb,
          confidence: sentenceConf || (1 - dysgraphiaProb),
          classConfidences: sentClasses,
        },
        studentInfo,
      });
    } catch (err) {
      console.warn('[ScreeningService] XAI synthesis warning, using deterministic engine fallback:', err.message);
      xaiExplanation = geminiXaiService.generateDeterministicXai({
        charConf: highestCharConf || (1 - peakDyslexiaProb),
        charProb: peakDyslexiaProb,
        charStatus: characterStatus,
        charClasses: peakCharClasses,
        sentConf: sentenceConf || (1 - dysgraphiaProb),
        sentProb: dysgraphiaProb,
        sentStatus: sentenceStatus,
        sentClasses,
        studentInfo,
      });
    }

    // 4. Save ScreeningResult with full Explainable AI report & confidence scores
    let result = await ScreeningResult.findOne({ screeningId });
    if (!result) {
      result = new ScreeningResult({
        screeningId,
        studentId: screening.studentId ? screening.studentId._id : screening.studentId,
      });
    }

    result.characterStatus = characterStatus;
    result.sentenceStatus = sentenceStatus;
    result.overallDyslexiaStatus = characterStatus;
    result.overallDysgraphiaStatus = sentenceStatus;
    result.dyslexiaConfidence = highestCharConf || 0.95;
    result.dysgraphiaConfidence = sentenceConf || 0.90;
    result.overallInterpretation = xaiExplanation.summary;
    result.xaiExplanation = xaiExplanation;
    result.recommendations = xaiExplanation.recommendations || [];

    await result.save();

    screening.status = 'COMPLETED';
    await screening.save();

    return {
      screening,
      result,
    };
  }

  async predictSingleCharacterDirect(sampleData) {
    return await this.modelProvider.predictCharacter(sampleData);
  }

  async predictSingleSentenceDirect(sampleData) {
    return await this.modelProvider.predictSentence(sampleData);
  }
}

module.exports = new ScreeningService();
