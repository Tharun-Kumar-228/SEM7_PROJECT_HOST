import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { colors, spacing } from '../../theme/colors';

const ExcelImportScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [validationData, setValidationData] = useState(null);

  // Mock upload test preview for UI demonstration
  const handleSimulateValidation = () => {
    setLoading(true);
    setTimeout(() => {
      setValidationData({
        totalRows: 4,
        validRowsCount: 3,
        invalidRowsCount: 1,
        summary: '3 valid student records, 1 invalid row detected',
        preview: [
          { rowNumber: 2, name: 'Alice Green', rollNumber: 'R001', parentPhone: '+15551234567', isValid: true, errors: [] },
          { rowNumber: 3, name: 'Bob White', rollNumber: 'R002', parentPhone: '+15552345678', isValid: true, errors: [] },
          { rowNumber: 4, name: 'Charlie Brown', rollNumber: 'R003', parentPhone: '+15553456789', isValid: true, errors: [] },
          {
            rowNumber: 5,
            name: 'Invalid Student',
            rollNumber: 'R001',
            parentPhone: '123',
            isValid: false,
            errors: ['Duplicate Roll Number R001', 'Invalid Phone Number format'],
          },
        ],
        validDataToImport: [
          { name: 'Alice Green', rollNumber: 'R001', parentPhone: '+15551234567', age: 6 },
          { name: 'Bob White', rollNumber: 'R002', parentPhone: '+15552345678', age: 7 },
          { name: 'Charlie Brown', rollNumber: 'R003', parentPhone: '+15553456789', age: 6 },
        ],
      });
      setLoading(false);
    }, 1000);
  };

  const handleConfirmImport = () => {
    Alert.alert('Import Confirmed', '3 Valid student records imported successfully. Linked to parent accounts matching phone numbers.');
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Excel Student Import Engine</Text>
      <Text style={styles.subtitle}>
        Upload .xlsx roster. Required columns: 'Student Name', 'Roll Number', 'Parent Phone Number'.
      </Text>

      <TouchableOpacity style={styles.uploadBox} onPress={handleSimulateValidation} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (
          <>
            <Text style={styles.uploadIcon}>📄</Text>
            <Text style={styles.uploadTitle} numberOfLines={2}>Tap to Select .xlsx File for Validation</Text>
            <Text style={styles.uploadSub}>Executes 12-step validation checks before import</Text>
          </>
        )}
      </TouchableOpacity>

      {validationData && (
        <View style={styles.resultsContainer}>
          <Text style={styles.sectionHeader}>Validation Report Preview</Text>
          <Text style={styles.summaryText}>{validationData.summary}</Text>

          {validationData.preview.map((item, idx) => (
            <View
              key={idx}
              style={[
                styles.rowCard,
                { borderColor: item.isValid ? colors.cardBorder : colors.error, backgroundColor: item.isValid ? '#FFFFFF' : '#FEF2F2' },
              ]}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle} numberOfLines={1} ellipsizeMode="tail">
                  Row #{item.rowNumber}: {item.name || 'Unnamed'}
                </Text>
                <Text style={{ color: item.isValid ? colors.success : colors.error, fontWeight: '700', fontSize: 12, flexShrink: 0 }}>
                  {item.isValid ? 'VALID' : 'INVALID'}
                </Text>
              </View>

              <Text style={styles.rowMeta} numberOfLines={1} ellipsizeMode="tail">
                Roll #{item.rollNumber} • Parent: {item.parentPhone}
              </Text>

              {item.errors.length > 0 && (
                <View style={styles.errorBox}>
                  {item.errors.map((err, errIdx) => (
                    <Text key={errIdx} style={styles.errorText}>
                      • {err}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmImport}>
            <Text style={styles.confirmText} numberOfLines={1}>Confirm Import ({validationData.validRowsCount} Valid Records) ▶</Text>
          </TouchableOpacity>
        </View>
      )}
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
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  uploadBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  uploadSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  resultsContainer: {
    marginTop: spacing.sm,
    width: '100%',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  rowCard: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  rowTitle: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  errorBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#FCA5A5',
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
  },
  confirmBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  confirmText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default ExcelImportScreen;
