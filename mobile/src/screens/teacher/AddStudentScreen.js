import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import apiClient from '../../api/client';
import { colors, spacing } from '../../theme/colors';

const AddStudentScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [age, setAge] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingClass, setCreatingClass] = useState(false);
  const [error, setError] = useState('');

  const fetchClasses = async () => {
    try {
      const response = await apiClient.get('/teachers/classes');
      const list = response.data?.data || [];
      setClasses(list);
      if (list.length > 0) {
        setSelectedClassId(list[0]._id);
      }
    } catch (err) {
      console.log('[AddStudent] fetchClasses notice:', err.message);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleQuickCreateClass = async () => {
    setCreatingClass(true);
    setError('');
    try {
      const schoolRes = await apiClient.post('/teachers/schools', {
        name: 'Primary School',
        code: `SCH-${Date.now().toString().slice(-4)}`,
      });
      const schoolId = schoolRes.data?.data?._id;

      const classRes = await apiClient.post('/teachers/classes', {
        schoolId,
        grade: 'Grade 1',
        section: 'Section A',
        academicYear: '2026-2027',
      });
      const newClass = classRes.data?.data;

      if (newClass) {
        setClasses((prev) => [...prev, newClass]);
        setSelectedClassId(newClass._id);
        Alert.alert('Class Configured', 'Default class (Grade 1-Section A) created successfully.');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to auto-create class');
    } finally {
      setCreatingClass(false);
    }
  };

  const handleAddStudent = async () => {
    if (!name.trim() || !rollNumber.trim() || !parentPhone.trim()) {
      setError('Please fill in Student Name, Roll Number, and Parent Phone Number.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await apiClient.post('/teachers/students', {
        name: name.trim(),
        rollNumber: rollNumber.trim(),
        parentPhone: parentPhone.trim(),
        classId: selectedClassId || 'auto',
        age: age ? Number(age) : undefined,
      });

      setLoading(false);
      Alert.alert('Success', 'Student record added successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error?.message || err.message || 'Failed to add student');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Add Student Record</Text>
      <Text style={styles.subtitle}>Enter student information to add them manually to your class roster.</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.label}>Student Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Alex Johnson"
        placeholderTextColor="#94A3B8"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Roll Number *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 101"
        placeholderTextColor="#94A3B8"
        value={rollNumber}
        onChangeText={setRollNumber}
      />

      <Text style={styles.label}>Parent Mobile Phone *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. +15550001111"
        placeholderTextColor="#94A3B8"
        value={parentPhone}
        onChangeText={setParentPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Age (Years)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 6"
        placeholderTextColor="#94A3B8"
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
      />

      <View style={styles.classHeaderRow}>
        <Text style={styles.label}>Assigned Class</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ClassSetup')}>
          <Text style={styles.linkText}>+ Custom Setup</Text>
        </TouchableOpacity>
      </View>

      {classes.length === 0 ? (
        <View style={styles.noClassBox}>
          <Text style={styles.warningText}>No class configured yet. System will auto-create default class, or tap below:</Text>
          <TouchableOpacity
            style={styles.quickClassBtn}
            onPress={handleQuickCreateClass}
            disabled={creatingClass}
          >
            {creatingClass ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.quickClassText}>⚡ Quick Create Default Class (Grade 1-A)</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.classPickerRow}>
          {classes.map((cls) => (
            <TouchableOpacity
              key={cls._id}
              style={[
                styles.classChip,
                selectedClassId === cls._id && styles.classChipSelected,
              ]}
              onPress={() => setSelectedClassId(cls._id)}
            >
              <Text
                style={[
                  styles.classChipText,
                  selectedClassId === cls._id && styles.classChipTextSelected,
                ]}
              >
                Grade {cls.grade}-{cls.section}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleAddStudent}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Save Student</Text>}
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
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  errorText: {
    color: colors.error,
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: spacing.md,
    fontSize: 13,
    width: '100%',
  },
  classHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    width: '100%',
  },
  linkText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  noClassBox: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    padding: 14,
    borderRadius: 10,
    marginBottom: spacing.md,
  },
  warningText: {
    color: '#B45309',
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  quickClassBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickClassText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
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
  classPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
    gap: 8,
    width: '100%',
  },
  classChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  classChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  classChipText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  classChipTextSelected: {
    color: '#FFFFFF',
  },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default AddStudentScreen;
