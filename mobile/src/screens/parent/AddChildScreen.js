import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import apiClient from '../../api/client';

const AddChildScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !age) {
      Alert.alert('Required Fields', 'Please enter child name and age.');
      return;
    }
    try {
      setLoading(true);
      await apiClient.post('/parents/children', {
        name: name.trim(),
        age: Number(age),
        grade: grade.trim() || 'Kindergarten',
      });
      setLoading(false);
      Alert.alert('Success', 'Child profile added successfully.');
      navigation.goBack();
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', err.response?.data?.error?.message || 'Failed to add child profile.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Child Profile</Text>
      <Text style={styles.subtitle}>Enter basic details for early learning pre-screening.</Text>

      <Text style={styles.label}>Child Name / Nickname</Text>
      <TextInput style={styles.input} placeholder="e.g. Leo" value={name} onChangeText={setName} />

      <Text style={styles.label}>Age (Years)</Text>
      <TextInput style={styles.input} placeholder="e.g. 6" value={age} onChangeText={setAge} keyboardType="number-pad" />

      <Text style={styles.label}>Grade / Level</Text>
      <TextInput style={styles.input} placeholder="e.g. Grade 1" value={grade} onChangeText={setGrade} />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Save Profile</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default AddChildScreen;
