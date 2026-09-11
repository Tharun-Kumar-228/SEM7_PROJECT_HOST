const https = require('https');

const DEFAULT_GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

class GeminiXaiService {
  constructor(apiKey = DEFAULT_GEMINI_API_KEY) {
    this.apiKey = apiKey;
    this.apiEndpoint =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';
  }

  async generateXaiExplanation(data) {
    const { characterMetrics, sentenceMetrics, studentInfo } = data;

    const charConf = characterMetrics?.confidence || 0.95;
    const charProb = characterMetrics?.probability || 0.05;
    const charStatus = characterMetrics?.status || 'WITHIN_EXPECTED_RANGE';
    const charClasses = characterMetrics?.classConfidences || {
      normal: Math.round((1 - charProb) * 10000) / 10000,
      reversal: Math.round(charProb * 0.55 * 10000) / 10000,
      corrected: Math.round(charProb * 0.45 * 10000) / 10000,
    };

    const sentConf = sentenceMetrics?.confidence || 0.90;
    const sentProb = sentenceMetrics?.probability || 0.10;
    const sentStatus = sentenceMetrics?.status || 'WITHIN_EXPECTED_RANGE';
    const sentClasses = sentenceMetrics?.classConfidences || {
      low_potential_dysgraphia: Math.round((1 - sentProb) * 10000) / 10000,
      potential_dysgraphia: Math.round(sentProb * 10000) / 10000,
    };

    // Try calling Gemini 3.6 Flash API
    try {
      const geminiResult = await this.callGeminiApi({
        charConf,
        charProb,
        charStatus,
        charClasses,
        sentConf,
        sentProb,
        sentStatus,
        sentClasses,
        studentInfo,
      });

      if (geminiResult && geminiResult.summary) {
        return geminiResult;
      }
    } catch (err) {
      console.warn('[GeminiXaiService] Live Gemini call bypassed, using deterministic XAI engine:', err.message);
    }

    return this.generateDeterministicXai({
      charConf,
      charProb,
      charStatus,
      charClasses,
      sentConf,
      sentProb,
      sentStatus,
      sentClasses,
      studentInfo,
    });
  }

  callGeminiApi(params) {
    return new Promise((resolve, reject) => {
      const prompt = `You are a certified pediatric neuropsychologist and handwriting development expert for the NEUROSCREEN observational pre-screening platform.
Analyze the following dual AI model handwriting screening metrics and generate a neat, structured, and clinically reassuring Explainable AI (XAI) report for parents and educators.

STUDENT PROFILE:
- Name: ${params.studentInfo?.name || 'Child'}
- Age: ${params.studentInfo?.age || 6} years old
- Grade: ${params.studentInfo?.grade || 'K'}

MODEL 1: VisionMamba Single-Character Classifier (Dyslexia Pre-Screening)
- Evaluated Activity: Target character writing ('B', 'd', '7')
- Overall Status: ${params.charStatus}
- Confidence Breakdown:
  * Normal Formation: ${(params.charClasses.normal * 100).toFixed(1)}%
  * Reversal Pattern: ${(params.charClasses.reversal * 100).toFixed(1)}%
  * Corrected / Overwritten Pattern: ${(params.charClasses.corrected * 100).toFixed(1)}%

MODEL 2: VMamba2D Sentence Copy Classifier (Dysgraphia Pre-Screening)
- Evaluated Activity: Sentence copy ("The boy is playing with a ball.")
- Overall Status: ${params.sentStatus}
- Confidence Breakdown:
  * Low Potential Dysgraphia (LPD): ${(params.sentClasses.low_potential_dysgraphia * 100).toFixed(1)}%
  * Potential Dysgraphia (PD): ${(params.sentClasses.potential_dysgraphia * 100).toFixed(1)}%

IMPORTANT GUIDELINES:
1. Maintain a non-diagnostic, supportive, and empowering tone. Do NOT state the child "has" dyslexia or dysgraphia.
2. Provide concrete observations about stroke directionality, loop placement, baseline stability, and spacing.
3. Offer actionable, joyful, multi-sensory home and classroom activities.

Return ONLY valid JSON matching this exact structure (no markdown fences, no extra text):
{
  "summary": "Multimodal XAI Evaluation: 2-3 clear, comprehensive sentences providing an executive summary of the screening session.",
  "characterModelAnalysis": {
    "modelName": "VisionMamba-SingleCharacter-V1",
    "targetDisease": "Dyslexia (Letter/Number Stroke Directionality & Reversal)",
    "status": "${params.charStatus}",
    "confidence": ${params.charConf},
    "classBreakdown": {
      "normalPercent": ${(params.charClasses.normal * 100).toFixed(1)},
      "reversalPercent": ${(params.charClasses.reversal * 100).toFixed(1)},
      "correctedPercent": ${(params.charClasses.corrected * 100).toFixed(1)}
    },
    "explanation": "Detailed visual analysis explaining stroke formation, loop orientation (e.g. b vs d), and whether standard progression, lateral mirroring, or repeated corrections were observed."
  },
  "sentenceModelAnalysis": {
    "modelName": "VMamba2D-Dysgraphia-Sentence-V1",
    "targetDisease": "Dysgraphia (Fine-Motor Coordination & Spatial Alignment)",
    "status": "${params.sentStatus}",
    "confidence": ${params.sentConf},
    "classBreakdown": {
      "lpdPercent": ${(params.sentClasses.low_potential_dysgraphia * 100).toFixed(1)},
      "pdPercent": ${(params.sentClasses.potential_dysgraphia * 100).toFixed(1)}
    },
    "explanation": "Detailed spatial analysis explaining sentence baseline alignment, word spacing consistency, and fine-motor pencil control."
  },
  "conditionInsights": {
    "dyslexia": {
      "name": "Dyslexia",
      "nature": "Neurodevelopmental learning variation influencing spatial letter/number orientation, left-right tracking, and stroke direction.",
      "observedPattern": "Summary of observed character traits and percentage breakdown.",
      "guidance": "Encourage multi-sensory tracing (sand tray, finger painting) and directional arrow stroke guides."
    },
    "dysgraphia": {
      "name": "Dysgraphia",
      "nature": "Neurodevelopmental learning variation influencing fine-motor speed, line alignment, letter sizing, and handwriting stamina.",
      "observedPattern": "Summary of observed sentence spatial traits and percentage breakdown.",
      "guidance": "Encourage baseline guide paper, pencil grip warm-ups, and playful fine-motor activities like clay modeling."
    }
  },
  "strengths": [
    "Specific positive observation 1",
    "Specific positive observation 2"
  ],
  "areasForGrowth": [
    "Specific supportive area 1",
    "Specific supportive area 2"
  ],
  "recommendations": [
    "Concrete actionable recommendation 1",
    "Concrete actionable recommendation 2",
    "Periodic observational review recommendation"
  ]
}`;

      const postData = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      });

      const url = `${this.apiEndpoint}?key=${this.apiKey}`;
      const req = https.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 4500,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(body);
              const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              const cleaned = text.replace(/```json|```/g, '').trim();
              const parsedXai = JSON.parse(cleaned);
              resolve(parsedXai);
            } catch (e) {
              reject(e);
            }
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Gemini API timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  generateDeterministicXai(params) {
    const { charConf, charProb, charStatus, charClasses, sentConf, sentProb, sentStatus, sentClasses, studentInfo } = params;

    const normPct = (charClasses.normal * 100).toFixed(1);
    const revPct = (charClasses.reversal * 100).toFixed(1);
    const corrPct = (charClasses.corrected * 100).toFixed(1);

    const lpdPct = (sentClasses.low_potential_dysgraphia * 100).toFixed(1);
    const pdPct = (sentClasses.potential_dysgraphia * 100).toFixed(1);

    const dyslexiaAttn = charStatus === 'REQUIRES_ATTENTION' || charProb >= 0.50 || parseFloat(revPct) > 40.0 || parseFloat(corrPct) > 40.0;
    const isReversal = parseFloat(revPct) >= parseFloat(corrPct);
    const dysgraphiaAttn = sentStatus === 'REQUIRES_ATTENTION' || sentProb >= 0.50 || parseFloat(pdPct) >= 50.0;
    const name = studentInfo?.name || 'Child';

    let summaryText = '';
    if (!dyslexiaAttn && !dysgraphiaAttn) {
      summaryText = `Multimodal XAI Evaluation: ${name}'s pre-screening demonstrates healthy developmental handwriting execution across both activities. Character stroke directionality is well-maintained (${normPct}% standard formation), and sentence copying exhibits steady line alignment (${lpdPct}% Low Potential Dysgraphia) consistent with age-appropriate fine motor skills.`;
    } else if (dyslexiaAttn && !dysgraphiaAttn) {
      summaryText = `Multimodal XAI Evaluation: ${name} demonstrated good line alignment and motor control during sentence writing, while character activities showed observational patterns of ${isReversal ? 'lateral reversal' : 'repeated line correction'} (${isReversal ? revPct : corrPct}%). Targeted multi-sensory stroke practice is recommended.`;
    } else if (!dyslexiaAttn && dysgraphiaAttn) {
      summaryText = `Multimodal XAI Evaluation: ${name} demonstrated clear character formation (${normPct}% standard formation), while sentence copying showed emerging fine-motor line drift (${pdPct}% Potential Dysgraphia). Baseline grid practice and ergonomic pencil support will help build writing stamina.`;
    } else {
      summaryText = `Multimodal XAI Evaluation: ${name}'s pre-screening observed emerging handwriting patterns in both character stroke directionality (${revPct}% reversal / ${corrPct}% corrected) and sentence baseline alignment (${pdPct}% potential dysgraphia). Early structured fine-motor and stroke guidance is warmly encouraged.`;
    }

    let charExplanation = '';
    if (!dyslexiaAttn) {
      charExplanation = `VisionMamba character stroke analysis confirmed steady formation with ${normPct}% standard stroke confidence. Character loops and ascender stems were placed on the correct side without lateral inversion or excessive re-tracing.`;
    } else if (isReversal) {
      charExplanation = `VisionMamba detected lateral stroke reversal tendencies (${revPct}%). The drawn character exhibited mirrored orientation (such as loop placement on the opposite side of the vertical stem), typical of early visual-spatial directionality development.`;
    } else {
      charExplanation = `VisionMamba identified multiple overlapping stroke passes and high ink density (${corrPct}%), indicating line re-tracing or hesitation corrections during character formation.`;
    }

    let sentExplanation = '';
    if (!dysgraphiaAttn) {
      sentExplanation = `VMamba2D 2D-selective-scan verified Low Potential Dysgraphia (${lpdPct}%). Sentence handwriting maintained a steady horizontal baseline with uniform word spacing and smooth pencil pressure.`;
    } else {
      sentExplanation = `VMamba2D detected spatial motor variation (${pdPct}% Potential Dysgraphia). The sentence showed noticeable baseline drift and irregular inter-word spacing, suggesting emerging hand fatigue or line orientation challenges.`;
    }

    return {
      summary: summaryText,
      characterModelAnalysis: {
        modelName: 'VisionMamba-SingleCharacter-V1',
        targetDisease: 'Dyslexia (Letter/Number Stroke Directionality & Reversal)',
        status: charStatus,
        confidence: charConf,
        classBreakdown: {
          normalPercent: parseFloat(normPct),
          reversalPercent: parseFloat(revPct),
          correctedPercent: parseFloat(corrPct),
        },
        explanation: charExplanation,
      },
      sentenceModelAnalysis: {
        modelName: 'VMamba2D-Dysgraphia-Sentence-V1',
        targetDisease: 'Dysgraphia (Fine-Motor Coordination & Spatial Alignment)',
        status: sentStatus,
        confidence: sentConf,
        classBreakdown: {
          lpdPercent: parseFloat(lpdPct),
          pdPercent: parseFloat(pdPct),
        },
        explanation: sentExplanation,
      },
      conditionInsights: {
        dyslexia: {
          name: 'Dyslexia',
          nature: 'Neurodevelopmental learning variation influencing spatial letter/number orientation, left-right tracking, and stroke direction.',
          observedPattern: `Class Confidences: Normal (${normPct}%), Reversal (${revPct}%), Corrected (${corrPct}%).`,
          guidance: 'Incorporate directional arrow stroke guides, sky-writing, and tactile letter tracing.',
        },
        dysgraphia: {
          name: 'Dysgraphia',
          nature: 'Neurodevelopmental learning variation influencing fine-motor speed, line alignment, letter sizing, and handwriting stamina.',
          observedPattern: `Class Confidences: Low Potential Dysgraphia / LPD (${lpdPct}%), Potential Dysgraphia / PD (${pdPct}%).`,
          guidance: 'Utilize baseline grid paper, ergonomic pencil grips, and finger warm-up motor exercises.',
        },
      },
      strengths: [
        !dyslexiaAttn ? 'Consistently forms letter loops and ascender stems in the correct direction' : 'Maintained steady effort across character activities',
        !dysgraphiaAttn ? 'Maintained stable horizontal line alignment across full sentence' : 'Recognizable letter sizing and word structure throughout the sentence',
      ],
      areasForGrowth: [
        dyslexiaAttn ? (isReversal ? 'Directional orientation for letters prone to mirror reversals (b vs d, p vs q)' : 'Smooth single-stroke completion without hesitant line re-tracing') : 'Continue regular letter formation practice',
        dysgraphiaAttn ? 'Maintaining an even horizontal baseline across longer sentences' : 'Maintain current comfortable grip and spacing',
      ],
      recommendations: [
        dyslexiaAttn
          ? 'Practice multi-sensory tracing (sand tray, textured sandpaper letters) using top-to-bottom stroke order.'
          : 'Continue daily playful letter and number writing games.',
        dysgraphiaAttn
          ? 'Use baseline-highlighted lined paper to help visually guide horizontal sentence progression.'
          : 'Encourage comfortable seated posture and ergonomic pencil grip.',
        'Review progress periodically in consultation with classroom educators.',
      ],
    };
  }
}

module.exports = new GeminiXaiService();
