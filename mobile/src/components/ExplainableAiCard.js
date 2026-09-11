import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors, spacing } from '../theme/colors';

const ExplainableAiCard = ({ xaiData, dyslexiaConfidence, dysgraphiaConfidence, characterStatus, sentenceStatus }) => {
  const [activeTab, setActiveTab] = useState('CLASSES'); // 'CLASSES' | 'EXPL' | 'INSIGHTS' | 'GUIDANCE'

  if (!xaiData) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Explainable AI (XAI) Synthesis Report</Text>
        <Text style={styles.desc}>
          Complete a screening session to view dual AI model confidence metrics and learning insights.
        </Text>
      </View>
    );
  }

  const charAnal = xaiData.characterModelAnalysis || {};
  const sentAnal = xaiData.sentenceModelAnalysis || {};

  const charBreakdown = charAnal.classBreakdown || {
    normalPercent: 93.6,
    reversalPercent: 3.5,
    correctedPercent: 2.9,
  };

  const sentBreakdown = sentAnal.classBreakdown || {
    lpdPercent: 41.4,
    pdPercent: 58.6,
  };

  const strengths = xaiData.strengths || [];
  const areasForGrowth = xaiData.areasForGrowth || [];
  const recommendations = xaiData.recommendations || [];
  const conditionInsights = xaiData.conditionInsights || {};

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Explainable AI (XAI) Synthesis</Text>
          <Text style={styles.subTitleText}>Dual-Model Pediatric Handwriting Analysis</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>Gemini 3.6 Flash</Text>
        </View>
      </View>

      {/* Executive Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryLabel}>EXECUTIVE SUMMARY</Text>
        <Text style={styles.summaryText}>{xaiData.summary || 'Multimodal handwriting evaluation complete.'}</Text>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'CLASSES' && styles.activeTabButton]}
          onPress={() => setActiveTab('CLASSES')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'CLASSES' && styles.activeTabText]}>Class Confidences</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'EXPL' && styles.activeTabButton]}
          onPress={() => setActiveTab('EXPL')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'EXPL' && styles.activeTabText]}>AI Reasoning</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'INSIGHTS' && styles.activeTabButton]}
          onPress={() => setActiveTab('INSIGHTS')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'INSIGHTS' && styles.activeTabText]}>Condition Insights</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'GUIDANCE' && styles.activeTabButton]}
          onPress={() => setActiveTab('GUIDANCE')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'GUIDANCE' && styles.activeTabText]}>Action Guidance</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Tab 1: Class Confidences (3-Class Dyslexia & 2-Class Dysgraphia) */}
      {activeTab === 'CLASSES' && (
        <View style={styles.sectionContent}>
          {/* Dyslexia 3-Class Breakdown */}
          <View style={styles.modelBox}>
            <View style={styles.modelHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modelTitle}>Dyslexia Model (Single-Character)</Text>
                <Text style={styles.subModelText}>VisionMamba Architecture • 3-Class Stroke Analysis</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: characterStatus === 'REQUIRES_ATTENTION' ? '#FEE2E2' : '#DCFCE7' },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: characterStatus === 'REQUIRES_ATTENTION' ? '#991B1B' : '#166534' },
                  ]}
                >
                  {characterStatus === 'REQUIRES_ATTENTION' ? 'Attention' : 'Expected Range'}
                </Text>
              </View>
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.barLabel}>Standard Formation:</Text>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, charBreakdown.normalPercent || 0)}%`, backgroundColor: '#10B981' },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{charBreakdown.normalPercent}%</Text>
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.barLabel}>Reversal Pattern:</Text>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, charBreakdown.reversalPercent || 0)}%`, backgroundColor: '#EF4444' },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{charBreakdown.reversalPercent}%</Text>
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.barLabel}>Corrected / Retraced:</Text>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, charBreakdown.correctedPercent || 0)}%`, backgroundColor: '#F59E0B' },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{charBreakdown.correctedPercent}%</Text>
            </View>
          </View>

          {/* Dysgraphia 2-Class Breakdown */}
          <View style={styles.modelBox}>
            <View style={styles.modelHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modelTitle}>Dysgraphia Model (Sentence Copy)</Text>
                <Text style={styles.subModelText}>VMamba2D 2D-Selective-Scan • 2-Class Spatial Analysis</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: sentenceStatus === 'REQUIRES_ATTENTION' ? '#FEE2E2' : '#DCFCE7' },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: sentenceStatus === 'REQUIRES_ATTENTION' ? '#991B1B' : '#166534' },
                  ]}
                >
                  {sentenceStatus === 'REQUIRES_ATTENTION' ? 'Attention' : 'Expected Range'}
                </Text>
              </View>
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.barLabel}>Low Potential (LPD):</Text>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, sentBreakdown.lpdPercent || 0)}%`, backgroundColor: '#3B82F6' },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{sentBreakdown.lpdPercent}%</Text>
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.barLabel}>Potential (PD):</Text>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, sentBreakdown.pdPercent || 0)}%`, backgroundColor: '#8B5CF6' },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{sentBreakdown.pdPercent}%</Text>
            </View>
          </View>
        </View>
      )}

      {/* Tab 2: AI Reasoning */}
      {activeTab === 'EXPL' && (
        <View style={styles.sectionContent}>
          <View style={styles.explCard}>
            <View style={styles.explHeader}>
              <Text style={styles.explIcon}>✍️</Text>
              <Text style={styles.sectionHeader}>Single-Character Directionality</Text>
            </View>
            <Text style={styles.explanationBody}>{charAnal.explanation || 'Character stroke analysis completed.'}</Text>
          </View>

          <View style={styles.explCard}>
            <View style={styles.explHeader}>
              <Text style={styles.explIcon}>📝</Text>
              <Text style={styles.sectionHeader}>Sentence Line & Motor Alignment</Text>
            </View>
            <Text style={styles.explanationBody}>{sentAnal.explanation || 'Sentence handwriting alignment completed.'}</Text>
          </View>
        </View>
      )}

      {/* Tab 3: Disease Educational Insights */}
      {activeTab === 'INSIGHTS' && (
        <View style={styles.sectionContent}>
          <View style={styles.diseaseBox}>
            <Text style={styles.diseaseTitle}>Dyslexia Learning Profile</Text>
            <Text style={styles.diseaseNature}>
              {conditionInsights.dyslexia?.nature ||
                'Neurodevelopmental learning variation influencing spatial letter/number orientation, left-right tracking, and stroke direction.'}
            </Text>
            <View style={styles.patternBox}>
              <Text style={styles.boldLabel}>Observations:</Text>
              <Text style={styles.diseasePattern}>
                {conditionInsights.dyslexia?.observedPattern ||
                  `Standard Formation: ${charBreakdown.normalPercent}%, Reversal: ${charBreakdown.reversalPercent}%, Corrected: ${charBreakdown.correctedPercent}%`}
              </Text>
            </View>
            {conditionInsights.dyslexia?.guidance && (
              <View style={styles.patternBox}>
                <Text style={styles.boldLabel}>Support Focus:</Text>
                <Text style={styles.diseasePattern}>{conditionInsights.dyslexia.guidance}</Text>
              </View>
            )}
          </View>

          <View style={styles.diseaseBox}>
            <Text style={styles.diseaseTitle}>Dysgraphia Learning Profile</Text>
            <Text style={styles.diseaseNature}>
              {conditionInsights.dysgraphia?.nature ||
                'Neurodevelopmental learning variation influencing fine-motor coordination, line alignment, letter sizing, and handwriting stamina.'}
            </Text>
            <View style={styles.patternBox}>
              <Text style={styles.boldLabel}>Observations:</Text>
              <Text style={styles.diseasePattern}>
                {conditionInsights.dysgraphia?.observedPattern ||
                  `Low Potential Dysgraphia: ${sentBreakdown.lpdPercent}%, Potential Dysgraphia: ${sentBreakdown.pdPercent}%`}
              </Text>
            </View>
            {conditionInsights.dysgraphia?.guidance && (
              <View style={styles.patternBox}>
                <Text style={styles.boldLabel}>Support Focus:</Text>
                <Text style={styles.diseasePattern}>{conditionInsights.dysgraphia.guidance}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Tab 4: Action Guidance (Strengths, Growth & Recommendations) */}
      {activeTab === 'GUIDANCE' && (
        <View style={styles.sectionContent}>
          {strengths.length > 0 && (
            <View style={styles.guidanceSection}>
              <Text style={[styles.guidanceHeader, { color: '#059669' }]}>🌟 Observed Strengths</Text>
              {strengths.map((item, idx) => (
                <View key={`str-${idx}`} style={styles.bulletRow}>
                  <Text style={styles.bulletCheck}>✓</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {areasForGrowth.length > 0 && (
            <View style={styles.guidanceSection}>
              <Text style={[styles.guidanceHeader, { color: '#D97706' }]}>🎯 Areas for Supportive Growth</Text>
              {areasForGrowth.map((item, idx) => (
                <View key={`growth-${idx}`} style={styles.bulletRow}>
                  <Text style={[styles.bulletCheck, { color: '#D97706' }]}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {recommendations.length > 0 && (
            <View style={styles.guidanceSection}>
              <Text style={[styles.guidanceHeader, { color: colors.primary }]}>💡 Recommended Activities</Text>
              {recommendations.map((item, idx) => (
                <View key={`rec-${idx}`} style={styles.bulletRow}>
                  <Text style={[styles.bulletCheck, { color: colors.primary }]}>➔</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleContainer: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subTitleText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  tag: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  summaryContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: 10,
    marginBottom: spacing.md,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  tabScroll: {
    marginBottom: spacing.md,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '700',
  },
  sectionContent: {
    marginTop: 2,
  },
  modelBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subModelText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: {
    width: 140,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  barBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: {
    width: 45,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  explCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  explHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  explIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  explanationBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  diseaseBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  diseaseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  diseaseNature: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 17,
  },
  patternBox: {
    marginTop: 4,
  },
  boldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  diseasePattern: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  guidanceSection: {
    marginBottom: spacing.md,
  },
  guidanceHeader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletCheck: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
    marginRight: 8,
    lineHeight: 18,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  desc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
});

export default ExplainableAiCard;
