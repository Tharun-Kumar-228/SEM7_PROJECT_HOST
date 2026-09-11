import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client';
import { colors } from '../../theme/colors';

const ParentHistoryScreen = ({ navigation }) => {
  const [screenings, setScreenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    try {
      setError('');
      const response = await apiClient.get('/screenings');
      setScreenings(response.data?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load screening history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const handleDeleteSession = (screeningId, childName) => {
    Alert.alert(
      'Delete Screening Session',
      `Are you sure you want to permanently delete this screening report for ${childName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await apiClient.delete(`/screenings/${screeningId}`);
              fetchHistory();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete screening session');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const totalCount = screenings.length;
  const completedCount = screenings.filter((s) => s.status === 'COMPLETED').length;
  const pendingCount = totalCount - completedCount;

  const renderItem = ({ item, index }) => {
    const isCompleted = item.status === 'COMPLETED';
    const progressPercent = isCompleted ? 100 : item.status === 'IN_PROGRESS' ? 50 : 25;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ParentReport', { studentId: item.studentId })}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.childName}>{item.studentName || 'Child Screening'}</Text>
            <Text style={styles.sessionTag}>Session #{totalCount - index}</Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: isCompleted ? '#DCFCE7' : '#FEF3C7' },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: isCompleted ? '#166534' : '#92400E' },
              ]}
            >
              {item.status}
            </Text>
          </View>
        </View>

        {/* Visual Progress Bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${progressPercent}%`,
                backgroundColor: isCompleted ? colors.success : colors.secondary,
              },
            ]}
          />
        </View>

        <View style={styles.cardFooterRow}>
          <Text style={styles.dateText}>
            📅 {new Date(item.createdAt).toLocaleDateString()}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => handleDeleteSession(item._id, item.studentName || 'Child')}
              style={{ marginRight: 14, padding: 4 }}
            >
              <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: '700' }}>🗑️ Delete</Text>
            </TouchableOpacity>

            <Text style={styles.actionLink}>View Report →</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Screening History</Text>
      <Text style={styles.headerSubtitle}>
        View all completed and pending pre-screening sessions for your registered children.
      </Text>

      {/* Visual Analytics Summary Card */}
      {screenings.length > 0 && (
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsTitle}>Activity & Session Analytics</Text>
          <View style={styles.analyticsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{totalCount}</Text>
              <Text style={styles.statLabel}>Total Sessions</Text>
            </View>
            <View style={[styles.statBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#CBD5E1' }]}>
              <Text style={[styles.statNumber, { color: colors.success }]}>{completedCount}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: colors.secondary }]}>{pendingCount}</Text>
              <Text style={styles.statLabel}>Pending / Review</Text>
            </View>
          </View>
        </View>
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={screenings}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Screenings Completed</Text>
              <Text style={styles.emptySubtitle}>
                Select a child profile from the Parent Dashboard to start a pre-screening writing activity.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  analyticsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  analyticsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  analyticsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  childName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sessionTag: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actionLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ParentHistoryScreen;
