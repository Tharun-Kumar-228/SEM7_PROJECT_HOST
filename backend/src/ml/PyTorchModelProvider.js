const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const http = require('http');
const ModelProvider = require('./ModelProvider');

// Reusable HTTP Keep-Alive Agent for ultra-fast Node -> Python ML Service requests
const keepAliveAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 20,
  keepAliveMsecs: 30000,
});

class PyTorchModelProvider extends ModelProvider {
  constructor(options = {}) {
    super();
    this.httpPort = options.httpPort || process.env.ML_PORT || 5001;
    this.charScriptPath = path.resolve(__dirname, 'predict_character.py');
    this.sentenceScriptPath = path.resolve(__dirname, 'predict_sentence.py');
  }

  async predictCharacter(sampleData) {
    if (!sampleData || !sampleData.imagePath) {
      throw new Error('Invalid sampleData: imagePath is required');
    }

    const absImagePath = path.isAbsolute(sampleData.imagePath)
      ? sampleData.imagePath
      : path.resolve(process.cwd(), sampleData.imagePath);

    if (!fs.existsSync(absImagePath)) {
      return {
        success: false,
        status: 'FAILED',
        error: `Sample image file not found at path: ${absImagePath}`,
      };
    }

    const expectedChar = sampleData.expectedCharacter || 'B';
    const charType = sampleData.characterType || 'LETTER';

    try {
      const httpResult = await this.predictViaHttp('/predict/character', {
        image_path: absImagePath,
        expected_character: expectedChar,
        character_type: charType,
      });
      if (httpResult && httpResult.success) {
        return this.formatCharacterResponse(httpResult);
      }
    } catch (err) {
      // Fallback to CLI
    }

    try {
      const cliResult = await this.predictViaCli(this.charScriptPath, [absImagePath, expectedChar, charType]);
      return this.formatCharacterResponse(cliResult);
    } catch (err) {
      return {
        success: false,
        status: 'FAILED',
        error: `PyTorch VisionMamba character inference failed: ${err.message}`,
      };
    }
  }

  async predictSentence(sampleData) {
    if (!sampleData || !sampleData.imagePath) {
      throw new Error('Invalid sampleData: imagePath is required');
    }

    const absImagePath = path.isAbsolute(sampleData.imagePath)
      ? sampleData.imagePath
      : path.resolve(process.cwd(), sampleData.imagePath);

    if (!fs.existsSync(absImagePath)) {
      return {
        success: false,
        status: 'FAILED',
        error: `Sentence sample image file not found at path: ${absImagePath}`,
      };
    }

    const expectedSentence = sampleData.expectedSentence || 'The boy is playing with a ball.';

    try {
      const httpResult = await this.predictViaHttp('/predict/sentence', {
        image_path: absImagePath,
        expected_sentence: expectedSentence,
      });
      if (httpResult && httpResult.success) {
        return this.formatSentenceResponse(httpResult);
      }
    } catch (err) {
      // Fallback to CLI
    }

    try {
      const cliResult = await this.predictViaCli(this.sentenceScriptPath, [absImagePath, expectedSentence]);
      return this.formatSentenceResponse(cliResult);
    } catch (err) {
      return {
        success: false,
        status: 'FAILED',
        error: `VMamba2D Dysgraphia sentence inference failed: ${err.message}`,
      };
    }
  }

  predictViaHttp(endpoint, payload) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(typeof payload === 'string' ? { image_path: payload } : payload);
      const baseUrlStr = process.env.ML_SERVICE_URL || `http://127.0.0.1:${this.httpPort}`;
      const fullUrl = new URL(endpoint, baseUrlStr);
      const httpModule = fullUrl.protocol === 'https:' ? require('https') : http;

      const req = httpModule.request(
        fullUrl,
        {
          method: 'POST',
          agent: keepAliveAgent,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 10000,
        },
        (res) => {
          let rawData = '';
          res.on('data', (chunk) => {
            rawData += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(rawData);
              resolve(parsed);
            } catch (e) {
              reject(e);
            }
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('ML HTTP request timed out'));
      });
      req.write(postData);
      req.end();
    });
  }

  getPythonBinary() {
    const winVenv = path.resolve(__dirname, '../../venv/Scripts/python.exe');
    const nixVenv = path.resolve(__dirname, '../../venv/bin/python');
    if (fs.existsSync(winVenv)) return winVenv;
    if (fs.existsSync(nixVenv)) return nixVenv;
    return process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');
  }

  predictViaCli(scriptPath, args) {
    return new Promise((resolve, reject) => {
      const cliArgs = Array.isArray(args) ? [scriptPath, ...args] : [scriptPath, args];
      const pythonBin = this.getPythonBinary();
      execFile(pythonBin, cliArgs, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(stderr || error.message));
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          if (!parsed.success) {
            return reject(new Error(parsed.error || 'Unknown CLI model error'));
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse CLI output: ${stdout}`));
        }
      });
    });
  }

  formatCharacterResponse(raw) {
    const pred = raw.prediction || {};
    const confidences = pred.class_confidences || {};
    const normalConf = confidences.normal ?? (pred.label === 0 ? (pred.confidence || 0.95) : 1 - (pred.dyslexic_probability || 0.05));
    const reversalConf = confidences.reversal ?? (pred.label === 1 ? (pred.confidence || 0.85) : (pred.dyslexic_probability || 0.05) * 0.55);
    const correctedConf = confidences.corrected ?? (pred.label === 2 ? (pred.confidence || 0.80) : (pred.dyslexic_probability || 0.05) * 0.45);

    const isAttention = pred.classification === 'REQUIRES_ATTENTION' || pred.label === 1 || pred.label === 2 || (pred.dyslexic_probability || 0) >= 0.50;

    return {
      success: true,
      status: isAttention ? 'REQUIRES_ATTENTION' : 'WITHIN_EXPECTED_RANGE',
      model: raw.model || 'VisionMamba-SingleCharacter-V1',
      prediction: pred.label_name || (isAttention ? 'Reversal Pattern' : 'Normal Formation'),
      className: pred.className || (pred.label === 0 ? 'NORMAL' : pred.label === 1 ? 'REVERSAL' : 'CORRECTED'),
      label: pred.label ?? (isAttention ? 1 : 0),
      probability: pred.dyslexic_probability ?? (1 - normalConf),
      confidence: pred.confidence ?? (isAttention ? Math.max(reversalConf, correctedConf) : normalConf),
      classification: isAttention ? 'REQUIRES_ATTENTION' : 'WITHIN_EXPECTED_RANGE',
      classConfidences: {
        normal: Math.round(normalConf * 10000) / 10000,
        reversal: Math.round(reversalConf * 10000) / 10000,
        corrected: Math.round(correctedConf * 10000) / 10000,
      },
      metrics: pred.metrics || {},
      processingTimeMs: raw.processing_time_ms || 0,
    };
  }

  formatSentenceResponse(raw) {
    const pred = raw.prediction || {};
    const confidences = pred.class_confidences || {};
    const lpdConf = confidences.low_potential_dysgraphia ?? (pred.label === 0 ? (pred.confidence || 0.88) : 1 - (pred.dysgraphia_probability || 0.12));
    const pdConf = confidences.potential_dysgraphia ?? (pred.label === 1 ? (pred.confidence || 0.85) : (pred.dysgraphia_probability || 0.12));

    const isAttention = pred.classification === 'REQUIRES_ATTENTION' || pred.label === 1 || (pred.dysgraphia_probability || 0) >= 0.50;

    return {
      success: true,
      status: isAttention ? 'REQUIRES_ATTENTION' : 'WITHIN_EXPECTED_RANGE',
      model: raw.model || 'VMamba2D-Dysgraphia-Sentence-V1',
      prediction: pred.label_name || (isAttention ? 'Potential Dysgraphia (PD)' : 'Low Potential Dysgraphia (LPD)'),
      className: pred.className || (isAttention ? 'POTENTIAL_DYSGRAPHIA' : 'LOW_POTENTIAL_DYSGRAPHIA'),
      label: pred.label ?? (isAttention ? 1 : 0),
      probability: pred.dysgraphia_probability ?? pdConf,
      confidence: pred.confidence ?? (isAttention ? pdConf : lpdConf),
      classification: isAttention ? 'REQUIRES_ATTENTION' : 'WITHIN_EXPECTED_RANGE',
      classConfidences: {
        low_potential_dysgraphia: Math.round(lpdConf * 10000) / 10000,
        potential_dysgraphia: Math.round(pdConf * 10000) / 10000,
      },
      metrics: pred.metrics || {},
      processingTimeMs: raw.processing_time_ms || 0,
    };
  }
}

module.exports = PyTorchModelProvider;
