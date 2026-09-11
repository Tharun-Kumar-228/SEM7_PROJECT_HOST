import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import StatusBadge from '../../components/StatusBadge';
import DisclaimerBanner from '../../components/DisclaimerBanner';
import ExplainableAiCard from '../../components/ExplainableAiCard';
import apiClient from '../../api/client';

const ParentReportScreen = ({ route }) => {
  const { studentId } = route.params || {};
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/reports/student/${studentId}`);
        setReport(res.data.data);
        setLoading(false);
      } catch (err) {
        setLoading(false);
        Alert.alert('Report Error', 'Unable to load pre-screening report.');
      }
    };
    fetchReport();
  }, [studentId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Pre-Screening & XAI Report...</Text>
      </View>
    );
  }

  const student = report?.student;
  const latest = report?.latestReport;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Observational Screening Report</Text>
      <Text style={styles.subtitle}>Subject: {student?.name || 'Child'}</Text>

      <View style={styles.metaCard}>
        <Text style={styles.metaText}>Roll Number: {student?.rollNumber}</Text>
        <Text style={styles.metaText}>Age: {student?.age} Years</Text>
        <Text style={styles.metaText}>Grade Level: {student?.grade}</Text>
      </View>

      <DisclaimerBanner />

      {/* Dual AI Models & Gemini Explainable AI (XAI) Synthesis Component */}
      <ExplainableAiCard
        xaiData={latest?.xaiExplanation}
        dyslexiaConfidence={latest?.dyslexiaConfidence}
        dysgraphiaConfidence={latest?.dysgraphiaConfidence}
        characterStatus={latest?.characterStatus}
        sentenceStatus={latest?.sentenceStatus}
      />

      <View style={styles.reportCard}>
        <Text style={styles.cardHeader}>Character-Level Activity (Dyslexia)</Text>
        <StatusBadge status={latest ? latest.characterStatus : 'ANALYSIS_PENDING'} />
        <Text style={styles.descText}>
          Evaluates single letter (A-Z) and number (0-9) handwriting strokes for reversal & formation using VisionMamba.
        </Text>
      </View>

      <View style={styles.reportCard}>
        <Text style={styles.cardHeader}>Sentence-Level Copy Activity (Dysgraphia)</Text>
        <StatusBadge status={latest ? latest.sentenceStatus : 'ANALYSIS_PENDING'} />
        <Text style={styles.descText}>
          Evaluates full sentence copy writing for word spacing, line alignment, and fine-motor control using VMamba2D.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  metaCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  metaText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  reportCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  descText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
});

export default ParentReportScreen;
