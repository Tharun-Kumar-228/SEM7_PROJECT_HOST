const ModelProvider = require('./ModelProvider');

class DisabledModelProvider extends ModelProvider {
  async predictCharacter(sampleData) {
    return {
      success: true,
      status: 'ANALYSIS_PENDING',
      message: 'MODEL_SERVICE_NOT_CONNECTED',
      model: 'character-model-v1',
      prediction: null,
      probability: null,
    };
  }

  async predictSentence(sampleData) {
    return {
      success: true,
      status: 'ANALYSIS_PENDING',
      message: 'MODEL_SERVICE_NOT_CONNECTED',
      model: 'sentence-model-v1',
      prediction: null,
      probability: null,
    };
  }
}

module.exports = DisabledModelProvider;
