import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import apiClient from '../../api/client';
import { colors } from '../../theme/colors';

const StudentDetailScreen = ({ route, navigation }) => {
  const { studentId } = route.params;
  const [student, setStudent] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit Student Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRoll, setEditRoll] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAge, setEditAge] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchStudentAndReport();
  }, [studentId]);

  const fetchStudentAndReport = async () => {
    try {
      setLoading(true);
      const studentRes = await apiClient.get(`/teachers/students/${studentId}`);
      const stdData = studentRes.data?.data;
      setStudent(stdData);

      if (stdData) {
        setEditName(stdData.name || '');
        setEditRoll(stdData.rollNumber || '');
        setEditPhone(stdData.parentPhone || '');
        setEditAge(stdData.age ? String(stdData.age) : '6');
      }

      const reportRes = await apiClient.get(`/reports/student/${studentId}`);
      setReport(reportRes.data?.data);
    } catch (err) {
      setError(err.message || 'Failed to load student record');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = () => {
    if (student) {
      setEditName(student.name || '');
      setEditRoll(student.rollNumber || '');
      setEditPhone(student.parentPhone || '');
      setEditAge(student.age ? String(student.age) : '6');
    }
    setEditModalVisible(true);
  };

  const handleSaveStudentEdit = async () => {
    if (!editName.trim() || !editRoll.trim() || !editPhone.trim()) {
      Alert.alert('Required Fields', 'Name, Roll Number, and Parent Phone are required.');
      return;
    }

    try {
      setSavingEdit(true);
      const response = await apiClient.put(`/teachers/students/${studentId}`, {
        name: editName.trim(),
        rollNumber: editRoll.trim(),
        parentPhone: editPhone.trim(),
        age: editAge ? Number(editAge) : 6,
      });

      const updated = response.data?.data;
      setStudent(updated);
      setEditModalVisible(false);
      Alert.alert('Success', 'Student details updated successfully.');
    } catch (err) {
      Alert.alert('Update Error', err.message || 'Failed to update student details');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleStartScreening = async () => {
    try {
      const response = await apiClient.post('/screenings', { studentId });
      const screening = response.data?.data;
      navigation.navigate('ChildIntro', {
        studentId,
        screeningId: screening._id,
        childName: student?.name,
      });
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to initiate screening session');
    }
  };

  const handleDeleteStudent = () => {
    Alert.alert(
      'Delete Student Record',
      `Are you sure you want to delete ${student?.name}? This will permanently remove the student from your class roster and delete all associated screening history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Student',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await apiClient.delete(`/teachers/students/${studentId}`);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete student record');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteScreening = (screeningId) => {
    Alert.alert(
      'Delete Screening Session',
      'Are you sure you want to delete this screening report?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await apiClient.delete(`/screenings/${screeningId}`);
              fetchStudentAndReport();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete screening session');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !student) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Student not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{student.name ? student.name[0].toUpperCase() : 'S'}</Text>
        </View>
        <Text style={styles.studentName}>{student.name}</Text>
        <Text style={styles.rollNumber}>Roll Number: {student.rollNumber}</Text>
        <Text style={styles.classText}>
          Class: {student.classId ? `Grade ${student.classId.grade}-${student.classId.section}` : 'Unassigned'}
        </Text>
        
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity style={styles.editCardButton} onPress={handleOpenEditModal}>
            <Text style={styles.editCardButtonText}>Edit Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.editCardButton, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
            onPress={handleDeleteStudent}
          >
            <Text style={[styles.editCardButtonText, { color: colors.error }]}>🗑️ Delete Student</Text>
          </TouchableOpacity>
        </View>
      </View>


      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Parent Contact Details</Text>
        <Text style={styles.detailLabel}>Registered Parent Phone</Text>
        <Text style={styles.detailValue}>{student.parentPhone || 'Not Registered'}</Text>

        <Text style={styles.detailLabel}>Parent Account Status</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{student.parentId ? 'Parent Account Linked' : 'Awaiting Parent Signup'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleStartScreening}>
        <Text style={styles.primaryButtonText}>Launch Child Screening</Text>
      </TouchableOpacity>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Screening History & Sessions ({report?.screeningHistory?.length || 0})</Text>
        {report?.screeningHistory && report.screeningHistory.length > 0 ? (
          report.screeningHistory.map((item, idx) => {
            const isCompleted = item.status === 'COMPLETED';
            const progressPercent = isCompleted ? 100 : item.status === 'IN_PROGRESS' ? 50 : 25;
            return (
              <View key={idx} style={styles.historyCardItem}>
                <View style={styles.historyRowHeader}>
                  <View style={styles.historyTextCol}>
                    <Text style={styles.historySessionTag} numberOfLines={1} ellipsizeMode="tail">
                      Session #{report.screeningHistory.length - idx} • {new Date(item.date).toLocaleDateString()}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity onPress={() => handleDeleteScreening(item.screeningId)} style={{ padding: 2 }}>
                      <Text style={{ fontSize: 14 }}>🗑️</Text>
                    </TouchableOpacity>
                    <View
                      style={[
                        styles.pendingBadge,
                        { backgroundColor: isCompleted ? '#DCFCE7' : '#FEF3C7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pendingBadgeText,
                          { color: isCompleted ? '#166534' : '#92400E' },
                        ]}
                        numberOfLines={1}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.miniTrack}>
                  <View
                    style={[
                      styles.miniBar,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: isCompleted ? colors.success : colors.secondary,
                      },
                    ]}
                  />
                </View>

                <View style={styles.subStatusRow}>
                  <Text style={styles.subStatusText}>Letter/Number: {item.characterStatus}</Text>
                  <Text style={styles.subStatusText}>Sentence: {item.sentenceStatus}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No pre-screening activities completed for this student yet.</Text>
        )}
      </View>

      <Text style={styles.disclaimerText}>
        Disclaimer: NEUROSCREEN is an observational pre-screening educational tool. Results are pending ML model service connection and do not constitute a medical diagnosis.
      </Text>

      {/* EDIT STUDENT DETAILS MODAL */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Update Student Record</Text>
            <Text style={styles.modalSub}>Modify student details and guardian contact info.</Text>

            <Text style={styles.fieldLabel}>Student Full Name *</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Roll Number *</Text>
            <TextInput
              style={styles.textInput}
              value={editRoll}
              onChangeText={setEditRoll}
              placeholder="e.g. 101"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Parent Phone Number *</Text>
            <TextInput
              style={styles.textInput}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="e.g. 9876543210"
              keyboardType="phone-pad"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Age (Years)</Text>
            <TextInput
              style={styles.textInput}
              value={editAge}
              onChangeText={setEditAge}
              placeholder="e.g. 6"
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={savingEdit}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveModalBtn}
                onPress={handleSaveStudentEdit}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveModalText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editCardButton: {
    marginTop: 12,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  editCardButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  modalSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  cancelModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  cancelModalText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  saveModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  saveModalText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  studentName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rollNumber: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  classText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  historyCardItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    width: '100%',
  },
  historyTextCol: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  historySessionTag: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  miniTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  miniBar: {
    height: '100%',
    borderRadius: 3,
  },
  subStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subStatusText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexShrink: 0,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
    marginVertical: 12,
  },
});

export default StudentDetailScreen;
