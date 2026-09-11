/**
 * Abstract interface definition for future ML Providers.
 * Do not instantiate fake model predictions.
 */

class ModelProvider {
  /**
   * Analyze character-level handwriting sample
   * @param {Object} sampleData - { sampleId, expectedCharacter, characterType, imagePath }
   * @returns {Promise<Object>} Result object with status, prediction, probability
   */
  async predictCharacter(sampleData) {
    throw new Error('predictCharacter must be implemented by concrete provider');
  }

  /**
   * Analyze sentence-level handwriting sample
   * @param {Object} sampleData - { sampleId, expectedSentence, imagePath }
   * @returns {Promise<Object>} Result object with status, prediction, probability
   */
  async predictSentence(sampleData) {
    throw new Error('predictSentence must be implemented by concrete provider');
  }
}

module.exports = ModelProvider;
