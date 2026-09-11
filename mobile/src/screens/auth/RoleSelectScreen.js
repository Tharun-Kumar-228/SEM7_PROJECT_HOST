import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors, spacing } from '../../theme/colors';

const RoleSelectScreen = ({ navigation }) => {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.appTitle}>NEUROSCREEN</Text>
        <Text style={styles.subtitle}>Educational Pre-Screening System</Text>
        <Text style={styles.tagline}>Child-friendly handwriting observational assessment portal</Text>
      </View>

      <Text style={styles.prompt}>Select Application Role to Continue:</Text>

      <TouchableOpacity
        style={[styles.roleCard, { borderColor: colors.primary }]}
        onPress={() => navigation.navigate('ParentLogin')}
      >
        <View style={styles.roleHeaderRow}>
          <Text style={styles.roleTitle}>Parent Workspace</Text>
          <Text style={styles.roleAction}>Sign In ▶</Text>
        </View>
        <Text style={styles.roleDesc}>
          Register child profiles, grant pre-screening consent, launch interactive writing exercises, and view progress reports.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.roleCard, { borderColor: colors.secondary }]}
        onPress={() => navigation.navigate('TeacherLogin')}
      >
        <View style={styles.roleHeaderRow}>
          <Text style={styles.roleTitle}>Teacher Portal</Text>
          <Text style={styles.roleAction}>Sign In ▶</Text>
        </View>
        <Text style={styles.roleDesc}>
          Configure school classes, import student rosters via Excel, manage screening sessions, and access class analytics.
        </Text>
      </TouchableOpacity>

      <View style={styles.footerNote}>
        <Text style={styles.footerText}>Secure Educational Pre-Screening Platform • Non-Diagnostic</Text>
      </View>
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
    justifyContent: 'center',
    width: '100%',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    width: '100%',
  },
  appTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  prompt: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  roleCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: spacing.lg,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    width: '100%',
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  roleAction: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  roleDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  footerNote: {
    marginTop: spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default RoleSelectScreen;
