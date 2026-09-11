import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import apiClient from '../../api/client';

const ClassSetupScreen = ({ navigation }) => {
  const [schoolName, setSchoolName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveClass = async () => {
    if (!schoolName.trim() || !schoolCode.trim() || !grade.trim() || !section.trim()) {
      Alert.alert('Required Fields', 'Please complete all school and class setup fields.');
      return;
    }

    try {
      setLoading(true);
      // 1. Create/link school
      const schoolRes = await apiClient.post('/teachers/schools', {
        name: schoolName.trim(),
        code: schoolCode.trim().toUpperCase(),
      });
      const schoolId = schoolRes.data.data._id;

      // 2. Create class
      await apiClient.post('/teachers/classes', {
        schoolId,
        grade: grade.trim(),
        section: section.trim(),
        academicYear: '2026-2027',
      });

      setLoading(false);
      Alert.alert('Success', 'School & Class configured successfully.');
      navigation.goBack();
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', err.response?.data?.error?.message || 'Setup failed.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>School & Class Setup</Text>
      <Text style={styles.subtitle}>Configure school details and assign grade section.</Text>

      <Text style={styles.label}>School Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Greenwood Elementary"
        placeholderTextColor="#94A3B8"
        value={schoolName}
        onChangeText={setSchoolName}
      />

      <Text style={styles.label}>Unique School Code *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. GW101"
        placeholderTextColor="#94A3B8"
        value={schoolCode}
        onChangeText={setSchoolCode}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Grade / Level *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Grade 1"
        placeholderTextColor="#94A3B8"
        value={grade}
        onChangeText={setGrade}
      />

      <Text style={styles.label}>Section *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Section A"
        placeholderTextColor="#94A3B8"
        value={section}
        onChangeText={setSection}
      />

      <TouchableOpacity style={styles.button} onPress={handleSaveClass} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Save Configuration</Text>}
      </TouchableOpacity>
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
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  button: {
    width: '100%',
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default ClassSetupScreen;
