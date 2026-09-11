import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import HandwritingCanvas from '../../components/HandwritingCanvas';
import apiClient from '../../api/client';

const SENTENCE_PROMPT = 'The boy is playing with a ball.';

const SentenceScreeningScreen = ({ route, navigation }) => {
  const { screeningId, student } = route.params || {};
  const [submitting, setSubmitting] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  const handleCompleteSample = async (sampleData) => {
    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('expectedSentence', SENTENCE_PROMPT);

      if (sampleData?.paths && sampleData.paths.length > 0) {
        formData.append('paths', JSON.stringify(sampleData.paths));
      }

      if (sampleData?.mode === 'PHOTO' && sampleData?.photoUri) {
        formData.append('sample', {
          uri: sampleData.photoUri,
          name: 'sentence_stroke.png',
          type: 'image/png',
        });
      }

      const res = await apiClient.post(`/screenings/${screeningId}/sentence-sample`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Trigger full dual model + Gemini XAI analysis
      await apiClient.post(`/screenings/${screeningId}/analyze`);

      setSubmitting(false);

      if (res.data && res.data.analysis) {
        setLastAnalysis(res.data.analysis);
        setShowAnalysisModal(true);
      } else {
        finishScreening();
      }
    } catch (err) {
      setSubmitting(false);
      finishScreening();
    }
  };

  const finishScreening = () => {
    setShowAnalysisModal(false);
    navigation.navigate('ScreeningComplete', { student });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sentence Copy Activity</Text>
        <Text style={styles.headerSub}>Copy the complete sentence below on the drawing area.</Text>
      </View>

      {submitting ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Executing VMamba2D Dysgraphia Sentence Analysis & Gemini XAI...</Text>
        </View>
      ) : (
        <HandwritingCanvas promptText={SENTENCE_PROMPT} onCompleteSample={handleCompleteSample} />
      )}

      {/* Analysis Result Modal */}
      <Modal visible={showAnalysisModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sentence Motor & Alignment Analysis</Text>

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

            {lastAnalysis?.prediction?.confidence !== undefined && (
              <Text style={styles.detailText}>
                Confidence: <Text style={styles.boldText}>{(lastAnalysis.prediction.confidence * 100).toFixed(1)}%</Text>
              </Text>
            )}

            {lastAnalysis?.prediction?.class_confidences && (
              <View style={{ width: '100%', marginVertical: 8, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }}>Class Breakdown:</Text>
                <Text style={{ fontSize: 12, color: colors.textPrimary }}>
                  • Low Potential (LPD): {(lastAnalysis.prediction.class_confidences.low_potential_dysgraphia * 100).toFixed(1)}%
                </Text>
                <Text style={{ fontSize: 12, color: colors.textPrimary }}>
                  • Potential Dysgraphia (PD): {(lastAnalysis.prediction.class_confidences.potential_dysgraphia * 100).toFixed(1)}%
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.continueButton} onPress={finishScreening}>
              <Text style={styles.continueButtonText}>Complete Screening & View Report</Text>
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
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  headerSub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
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

export default SentenceScreeningScreen;
