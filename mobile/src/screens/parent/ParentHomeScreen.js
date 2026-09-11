import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../theme/colors';
import DisclaimerBanner from '../../components/DisclaimerBanner';
import StatusBadge from '../../components/StatusBadge';
import apiClient from '../../api/client';

const ParentHomeScreen = ({ navigation }) => {
  const { logout } = useAuth();
  const [childrenList, setChildrenList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchChildren = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/parents/children');
      setChildrenList(res.data.data || []);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      Alert.alert('Error', 'Unable to fetch child profile list.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchChildren();
    }, [fetchChildren])
  );

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to sign out of Parent Workspace?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleStartScreening = (child) => {
    navigation.navigate('ParentConsent', { student: child });
  };

  const handleDeleteChild = (child) => {
    Alert.alert(
      'Delete Child Profile',
      `Are you sure you want to delete ${child.name}? This will permanently delete their profile and all associated screening reports.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Profile',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await apiClient.delete(`/parents/children/${child._id}`);
              fetchChildren();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete child profile');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">
            Parent Workspace
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Handwriting pre-screening activity portal
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutChip} onPress={handleLogout}>
          <Text style={styles.logoutChipText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <DisclaimerBanner />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Registered Children Profiles</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddChild')}>
          <Text style={styles.addText}>+ Add Child</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={childrenList}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <View style={styles.childCard}>
            <View style={styles.cardHeader}>
              <View style={styles.childInfo}>
                <Text style={styles.childName} numberOfLines={1} ellipsizeMode="tail">
                  {item.name}
                </Text>
                <Text style={styles.childMeta} numberOfLines={1}>
                  Age {item.age} • {item.grade || 'Kindergarten'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity onPress={() => handleDeleteChild(item)} style={{ padding: 4 }}>
                  <Text style={{ fontSize: 16 }}>🗑️</Text>
                </TouchableOpacity>
                <StatusBadge status="ANALYSIS_PENDING" />
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.startBtn} onPress={() => handleStartScreening(item)}>
                <Text style={styles.startBtnText}>Start Screening ▶</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reportBtn}
                onPress={() => navigation.navigate('ParentReport', { studentId: item._id })}
              >
                <Text style={styles.reportBtnText}>View Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Children Profiles Found</Text>
              <Text style={styles.emptyText}>Tap '+ Add Child' to register your child's profile for screening.</Text>
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
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.md,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  childCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  childInfo: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  childName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  childMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: 8,
    width: '100%',
  },
  startBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  reportBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  reportBtnText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
});

export default ParentHomeScreen;
