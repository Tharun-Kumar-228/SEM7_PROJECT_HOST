import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../theme/colors';
import StatusBadge from '../../components/StatusBadge';
import DisclaimerBanner from '../../components/DisclaimerBanner';
import apiClient from '../../api/client';

const TeacherDashboardScreen = ({ navigation }) => {
  const { logout } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await apiClient.get('/teachers/classes');
      setClasses(res.data?.data || []);
    } catch (e) {}
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const params = { search: search.trim() };
      if (selectedClassId) params.classId = selectedClassId;
      const res = await apiClient.get('/teachers/students', { params });
      setStudents(res.data.data.students || []);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  }, [search, selectedClassId]);

  useFocusEffect(
    useCallback(() => {
      fetchClasses();
      fetchStudents();
    }, [fetchClasses, fetchStudents])
  );

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to sign out of Teacher Portal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const totalCount = students.length;
  const linkedCount = students.filter((s) => s.parentId).length;

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            Teacher Portal Dashboard
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            Student Rosters, Pre-Screenings & Excel Import
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutChip} onPress={handleLogout}>
          <Text style={styles.logoutChipText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <DisclaimerBanner />

      {/* Class Overview Visual Metric Gauge */}
      <View style={styles.classMetricCard}>
        <View style={styles.classMetricHeader}>
          <Text style={styles.classMetricTitle} numberOfLines={1}>
            Class Roster Overview
          </Text>
          <Text style={styles.classMetricRatio}>
            {linkedCount} / {totalCount} Linked
          </Text>
        </View>
        <View style={styles.trackGauge}>
          <View
            style={[
              styles.fillGauge,
              { width: `${totalCount > 0 ? (linkedCount / totalCount) * 100 : 0}%` },
            ]}
          />
        </View>
      </View>

      {/* Action Buttons Grid */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('ClassSetup')}>
          <Text style={styles.actionBtnText} numberOfLines={1}>Class Setup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
          onPress={() => navigation.navigate('ExcelImport')}
        >
          <Text style={styles.actionBtnText} numberOfLines={1}>Import Excel Roster</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#475569' }]}
          onPress={() => navigation.navigate('AddStudent')}
        >
          <Text style={styles.actionBtnText} numberOfLines={1}>Add Student</Text>
        </TouchableOpacity>
      </View>

      {classes.length > 0 && (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filter Roster by Class:</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ _id: '', grade: 'All', section: 'Classes' }, ...classes]}
            keyExtractor={(item) => item._id || 'all'}
            renderItem={({ item }) => {
              const isSelected = selectedClassId === item._id;
              return (
                <TouchableOpacity
                  style={[styles.filterChip, isSelected && styles.filterChipActive]}
                  onPress={() => setSelectedClassId(item._id)}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                    {item._id ? `Grade ${item.grade}-${item.section}` : 'All Classes'}
                  </Text>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ gap: 8, paddingBottom: 6 }}
          />
        </View>
      )}

      <TextInput
        style={styles.searchInput}
        placeholder="Search student name, roll number or phone..."
        placeholderTextColor="#94A3B8"
        value={search}
        onChangeText={setSearch}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={students}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.studentRow}
            onPress={() => navigation.navigate('StudentDetail', { studentId: item._id })}
          >
            <View style={styles.studentInfo}>
              <Text style={styles.studentName} numberOfLines={1} ellipsizeMode="tail">
                {item.name}
              </Text>
              <Text style={styles.studentMeta} numberOfLines={1} ellipsizeMode="tail">
                Roll #{item.rollNumber} • Parent: {item.parentPhone}
              </Text>
            </View>
            <StatusBadge status="ANALYSIS_PENDING" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Student Records Found</Text>
              <Text style={styles.emptyDesc}>Use 'Import Excel Roster' or '+ Add Student' to register student records.</Text>
            </View>
          )
        }
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerContainer: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    width: '100%',
  },
  titleContainer: {
    flex: 1,
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  logoutChip: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  logoutChipText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: 12,
  },
  classMetricCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginVertical: spacing.xs,
  },
  classMetricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  classMetricTitle: {
    flex: 1,
    flexShrink: 1,
    marginRight: spacing.sm,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  classMetricRatio: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  trackGauge: {
    width: '100%',
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fillGauge: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: spacing.md,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: spacing.sm,
    width: '100%',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  searchInput: {
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
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  studentRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  studentInfo: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  studentMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

export default TeacherDashboardScreen;
