import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const getBadgeStyle = (status) => {
  switch (status) {
    case 'COMPLETED':
    case 'WITHIN_EXPECTED_RANGE':
      return { bg: '#DCFCE7', text: '#15803D', label: 'Within Expected Range' };
    case 'REQUIRES_ATTENTION':
      return { bg: '#FEF3C7', text: '#B45309', label: 'Requires Attention' };
    case 'ANALYSIS_PENDING':
    case 'MODEL_SERVICE_NOT_CONNECTED':
      return { bg: '#E0E7FF', text: '#3730A3', label: 'Analysis Pending' };
    case 'IN_PROGRESS':
    case 'PROCESSING':
      return { bg: '#DBEAFE', text: '#1E40AF', label: 'In Progress' };
    default:
      return { bg: '#F1F5F9', text: '#475569', label: status || 'Not Started' };
  }
};

const StatusBadge = ({ status }) => {
  const badge = getBadgeStyle(status);
  return (
    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
      <Text style={[styles.text, { color: badge.text }]} numberOfLines={1} ellipsizeMode="tail">
        {badge.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    flexShrink: 0,
    maxWidth: 165,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});

export default StatusBadge;
