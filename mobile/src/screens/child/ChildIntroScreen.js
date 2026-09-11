import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../theme/colors';

const ChildIntroScreen = ({ route, navigation }) => {
  const { screeningId, student } = route.params || {};

  const handleStart = () => {
    navigation.navigate('CharacterScreening', { screeningId, student });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.childGreeting}>Welcome, {student?.name || 'Friend'}! 🌟</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fun Writing Activity</Text>
        <Text style={styles.bullet}>• This is NOT an exam! There are no marks or scores.</Text>
        <Text style={styles.bullet}>• Take your time and draw/write comfortably.</Text>
        <Text style={styles.bullet}>• Use your finger on the screen to copy letters and numbers.</Text>
      </View>

      <TouchableOpacity style={styles.bigStartButton} onPress={handleStart}>
        <Text style={styles.bigStartText}>Let's Begin! ▶</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childGreeting: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.xl,
    width: '100%',
    marginBottom: spacing.xxl,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  bullet: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 22,
  },
  bigStartButton: {
    backgroundColor: '#16A34A',
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 16,
    elevation: 4,
  },
  bigStartText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
});

export default ChildIntroScreen;
