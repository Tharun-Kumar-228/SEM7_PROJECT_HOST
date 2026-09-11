import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const OTPVerifyScreen = ({ route }) => {
  const { phone } = route.params || { phone: '' };
  const [otpCode, setOtpCode] = useState('');
  const [parentName, setParentName] = useState('');
  const { verifyParentOtp, loading } = useAuth();

  const handleVerify = async () => {
    if (!otpCode || otpCode.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit verification code.');
      return;
    }
    try {
      await verifyParentOtp(phone, otpCode.trim(), parentName.trim());
    } catch (err) {
      Alert.alert('Verification Failed', err.message);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Verify One-Time Passcode</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {phone}. (Test code: 123456)</Text>

      <Text style={styles.label}>Parent Full Name (Optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Jane Doe"
        placeholderTextColor="#94A3B8"
        value={parentName}
        onChangeText={setParentName}
      />

      <Text style={styles.label}>6-Digit Verification Code *</Text>
      <TextInput
        style={styles.input}
        placeholder="123456"
        placeholderTextColor="#94A3B8"
        value={otpCode}
        onChangeText={setOtpCode}
        keyboardType="number-pad"
        maxLength={6}
      />

      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Verify & Complete Sign In</Text>}
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
    fontSize: 24,
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
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default OTPVerifyScreen;
