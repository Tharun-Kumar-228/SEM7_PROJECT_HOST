import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const ScreeningCompleteScreen = ({ route, navigation }) => {
  const { student } = route.params || {};
  const { role } = useAuth();

  const handleFinish = () => {
    if (role === 'TEACHER') {
      navigation.navigate('TeacherDashboard');
    } else {
      navigation.navigate('ParentHome');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🎉</Text>
      <Text style={styles.title}>Great Job, {student?.name || 'Friend'}!</Text>
      <Text style={styles.message}>
        You have completed all writing activities! Your samples have been saved safely.
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleFinish}>
        <Text style={styles.buttonText}>Return to Home ▶</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#16A34A',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  button: {
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default ScreeningCompleteScreen;
