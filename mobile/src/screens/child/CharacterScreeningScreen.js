import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import HandwritingCanvas from '../../components/HandwritingCanvas';
import apiClient from '../../api/client';

const CHARACTER_STEPS = [
  { char: 'B', type: 'LETTER' },
  { char: '7', type: 'NUMBER' },
  { char: 'd', type: 'LETTER' },
];

const CharacterScreeningScreen = ({ route, navigation }) => {
  const { screeningId, student } = route.params || {};
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  const currentStep = CHARACTER_STEPS[stepIndex];

  const handleCompleteSample = async (sampleData) => {
    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('expectedCharacter', currentStep.char);
      formData.append('characterType', currentStep.type);

      if (sampleData?.paths && sampleData.paths.length > 0) {
        formData.append('paths', JSON.stringify(sampleData.paths));
      }

      if (sampleData?.mode === 'PHOTO' && sampleData?.photoUri) {
        formData.append('sample', {
          uri: sampleData.photoUri,
          name: `character_${currentStep.char}.png`,
          type: 'image/png',
        });
      }

      const res = await apiClient.post(`/screenings/${screeningId}/character-samples`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSubmitting(false);

      if (res.data && res.data.analysis) {
        setLastAnalysis(res.data.analysis);
        setShowAnalysisModal(true);
      } else {
        advanceStep();
      }
    } catch (err) {
      setSubmitting(false);
      advanceStep();
    }
  };

  const advanceStep = () => {
    setShowAnalysisModal(false);
    setLastAnalysis(null);
    if (stepIndex + 1 < CHARACTER_STEPS.length) {
      setStepIndex(stepIndex + 1);
    } else {
      navigation.navigate('SentenceScreening', { screeningId, student });
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>
          Character Activity {stepIndex + 1} of {CHARACTER_STEPS.length}
        </Text>
      </View>

      {submitting ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Analyzing handwriting strokes with VisionMamba...</Text>
        </View>
      ) : (
        <HandwritingCanvas promptText={currentStep.char} onCompleteSample={handleCompleteSample} />
      )}

      {/* Analysis Result Modal */}
      <Modal visible={showAnalysisModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Character Formation Analysis</Text>

            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    lastAnalysis?.prediction?.classification === 'REQUIRES_ATTENTION' ? '#FEE2E2' : '#DCFCE7',
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      lastAnalysis?.prediction?.classification === 'REQUIRES_ATTENTION' ? '#991B1B' : '#166534',
                  },
                ]}
              >
                {lastAnalysis?.prediction?.label_name ||
                  (lastAnalysis?.prediction?.classification === 'REQUIRES_ATTENTION'
                    ? 'Attention Required'
                    : 'Within Expected Range')}
              </Text>
            </View>

            <Text style={styles.detailText}>
              Target Character: <Text style={styles.boldText}>{currentStep.char}</Text>
            </Text>

            {lastAnalysis?.prediction?.confidence !== undefined && (
              <Text style={styles.detailText}>
                Confidence: <Text style={styles.boldText}>{(lastAnalysis.prediction.confidence * 100).toFixed(1)}%</Text>
              </Text>
            )}

            {lastAnalysis?.prediction?.class_confidences && (
              <View style={{ width: '100%', marginVertical: 8, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }}>Class Breakdown:</Text>
                <Text style={{ fontSize: 12, color: colors.textPrimary }}>
                  • Normal: {(lastAnalysis.prediction.class_confidences.normal * 100).toFixed(1)}%
                </Text>
                <Text style={{ fontSize: 12, color: colors.textPrimary }}>
                  • Reversal: {(lastAnalysis.prediction.class_confidences.reversal * 100).toFixed(1)}%
                </Text>
                <Text style={{ fontSize: 12, color: colors.textPrimary }}>
                  • Corrected: {(lastAnalysis.prediction.class_confidences.corrected * 100).toFixed(1)}%
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.continueButton} onPress={advanceStep}>
              <Text style={styles.continueButtonText}>
                {stepIndex + 1 < CHARACTER_STEPS.length ? 'Continue to Next Character' : 'Proceed to Sentence Step'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  progressHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginVertical: spacing.md,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  boldText: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  continueButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default CharacterScreeningScreen;
