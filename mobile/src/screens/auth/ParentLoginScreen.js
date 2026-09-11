import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const ParentLoginScreen = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const { loginParentOtp, loading } = useAuth();

  const handleContinue = async () => {
    if (!phone || phone.trim().length < 7) {
      Alert.alert('Invalid Input', 'Please enter a valid mobile phone number.');
      return;
    }
    try {
      await loginParentOtp(phone.trim());
      navigation.navigate('OTPVerify', { phone: phone.trim() });
    } catch (err) {
      Alert.alert('Login Error', err.message);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Parent Mobile Login</Text>
      <Text style={styles.subtitle}>Enter your registered mobile phone number to receive a one-time verification code.</Text>

      <Text style={styles.label}>Mobile Phone Number *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 9876543210 or +15550001111"
        placeholderTextColor="#94A3B8"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Send One-Time Passcode</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.devFillBtn}
        onPress={() => setPhone('+15550001111')}
      >
        <Text style={styles.devFillText}>Auto-Fill Test Mobile Number (+15550001111)</Text>
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
    marginBottom: spacing.lg,
  },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  devFillBtn: {
    width: '100%',
    marginTop: spacing.lg,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  devFillText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ParentLoginScreen;
