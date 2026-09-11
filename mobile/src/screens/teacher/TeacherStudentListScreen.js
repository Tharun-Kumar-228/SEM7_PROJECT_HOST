import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api/client';
import { colors, spacing } from '../../theme/colors';

const TeacherStudentListScreen = ({ navigation }) => {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStudents = useCallback(async () => {
    try {
      setError(null);
      const response = await apiClient.get('/teachers/students', {
        params: { search: search.trim() },
      });
      setStudents(response.data?.data?.students || []);
    } catch (err) {
      setError(err.message || 'Failed to load class roster');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      fetchStudents();
    }, [fetchStudents])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const handleDeleteStudent = (studentId, studentName) => {
    Alert.alert(
      'Delete Student Record',
      `Are you sure you want to delete ${studentName}? This will permanently remove the student from your class roster and delete all associated screening history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Student',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await apiClient.delete(`/teachers/students/${studentId}`);
              fetchStudents();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete student record');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderStudentItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('StudentDetail', { studentId: item._id })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name ? item.name[0].toUpperCase() : 'S'}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.studentName} numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Text>
        <Text style={styles.rollNumber} numberOfLines={1} ellipsizeMode="tail">
          Roll No: {item.rollNumber}
        </Text>
        <Text style={styles.parentPhone} numberOfLines={1} ellipsizeMode="tail">
          Parent: {item.parentPhone || 'Not Registered'}
        </Text>
      </View>
      <View style={styles.badgeContainer}>
        <TouchableOpacity
          onPress={() => handleDeleteStudent(item._id, item.name)}
          style={{ padding: 4, marginBottom: 4, alignSelf: 'flex-end' }}
        >
          <Text style={{ fontSize: 16 }}>🗑️</Text>
        </TouchableOpacity>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: item.parentId ? '#E8F5E9' : '#FFF3E0' },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: item.parentId ? '#2E7D32' : '#EF6C00' },
            ]}
            numberOfLines={1}
          >
            {item.parentId ? 'Linked' : 'Pending'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by student name, roll no, phone..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity style={styles.clearButton} onPress={() => setSearch('')}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddStudent')}
      >
        <Text style={styles.addButtonText}>+ Add Student Manually</Text>
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStudents}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item._id}
          renderItem={renderStudentItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Students Found</Text>
              <Text style={styles.emptySubtitle}>
                Add students manually or import your class roster from an Excel sheet.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    width: '100%',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  clearButton: {
    marginLeft: 8,
    padding: 10,
    flexShrink: 0,
  },
  clearText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: spacing.md,
    width: '100%',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    width: '100%',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 18,
  },
  cardInfo: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 8,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rollNumber: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  parentPhone: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgeContainer: {
    flexShrink: 0,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    flex: 1,
    flexShrink: 1,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  retryText: {
    color: colors.primary,
    fontWeight: '700',
  },
});

export default TeacherStudentListScreen;
