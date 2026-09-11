import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { colors, spacing } from '../theme/colors';

const SidebarDrawer = ({ visible, onClose, navigation, role, onLogout }) => {
  const isTeacher = role === 'TEACHER';

  const handleNavigate = (screenName) => {
    onClose();
    if (navigation && screenName) {
      navigation.navigate(screenName);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <SafeAreaView style={styles.drawerContainer}>
          <View style={styles.header}>
            <Text style={styles.appTitle}>NEUROSCREEN</Text>
            <Text style={styles.menuTitle}>{isTeacher ? 'Teacher Portal Menu' : 'Parent Workspace Menu'}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.menuList}>
            {isTeacher ? (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('TeacherDashboard')}>
                  <Text style={styles.menuItemText}>Dashboard Overview</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('TeacherStudentList')}>
                  <Text style={styles.menuItemText}>Class Roster Management</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('AddStudent')}>
                  <Text style={styles.menuItemText}>+ Add Student Record</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('ExcelImport')}>
                  <Text style={styles.menuItemText}>Import Roster via Excel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('ClassSetup')}>
                  <Text style={styles.menuItemText}>School & Class Setup</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('TeacherProfile')}>
                  <Text style={styles.menuItemText}>Teacher Profile & Account</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('ParentHome')}>
                  <Text style={styles.menuItemText}>Parent Dashboard</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('AddChild')}>
                  <Text style={styles.menuItemText}>Register Child Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('ParentHistory')}>
                  <Text style={styles.menuItemText}>Screening History & Reports</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('ParentProfile')}>
                  <Text style={styles.menuItemText}>Parent Account Settings</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.divider} />

            <TouchableOpacity style={styles.logoutItem} onPress={() => { onClose(); if (onLogout) onLogout(); }}>
              <Text style={styles.logoutItemText}>Log Out / Sign Out</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>NeuroScreen Pre-Screening System v1.0</Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  backdrop: {
    flex: 1,
  },
  drawerContainer: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    height: '100%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  menuTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  menuList: {
    padding: spacing.md,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: spacing.md,
  },
  logoutItem: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutItemText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});

export default SidebarDrawer;
