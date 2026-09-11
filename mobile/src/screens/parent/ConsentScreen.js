import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import apiClient from '../../api/client';

const ConsentScreen = ({ route, navigation }) => {
  const { student } = route.params || {};
  const [loading, setLoading] = useState(false);

  const handleAgreeAndProceed = async () => {
    try {
      setLoading(true);
      await apiClient.post('/parents/consent', {
        studentId: student._id,
        consentGiven: true,
      });

      // Initiate Screening session
      const screeningRes = await apiClient.post('/screenings', { studentId: student._id });
      setLoading(false);

      navigation.navigate('ChildIntro', {
        screeningId: screeningRes.data.data._id,
        student,
      });
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', err.response?.data?.error?.message || 'Consent recording failed.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Parental Consent & Authorization</Text>
      <Text style={styles.subtitle}>Screening Subject: {student?.name || 'Child'}</Text>

      <ScrollView style={styles.consentBox}>
        <Text style={styles.sectionHeader}>Purpose of Activity Collection</Text>
        <Text style={styles.paragraph}>
          NeuroScreen collects digital handwriting strokes (individual letters, numbers, and short copied sentences) for
          observational pre-screening review.
        </Text>

        <Text style={styles.sectionHeader}>Important Notice — Non-Diagnostic Tool</Text>
        <Text style={styles.paragraph}>
          This activity is strictly a pre-screening observation tool. It does NOT diagnose dyslexia, dysgraphia, or any medical condition.
          Results highlight observational risk indicators only.
        </Text>

        <Text style={styles.sectionHeader}>Data Privacy & Storage</Text>
        <Text style={styles.paragraph}>
          Handwriting stroke samples are stored securely in protected storage. No personally identifying information is shared publicly.
        </Text>
      </ScrollView>

      <TouchableOpacity style={styles.agreeBtn} onPress={handleAgreeAndProceed} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.agreeText}>I Agree & Start Child Mode ▶</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  consentBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 8,
  },
  agreeBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  agreeText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default ConsentScreen;
