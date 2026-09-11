import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const DisclaimerBanner = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pre-Screening Information & Disclaimer</Text>
      <Text style={styles.text}>
        NeuroScreen is an observational early learning support tool designed to assist parents and teachers in reviewing
        handwriting stroke activities. This tool does NOT provide medical, clinical, or formal educational diagnosis.
        For developmental concerns, please consult a qualified specialist.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.disclaimerBg,
    borderColor: colors.disclaimerBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.disclaimerText,
    marginBottom: 4,
  },
  text: {
    fontSize: 12,
    color: colors.disclaimerText,
    lineHeight: 18,
  },
});

export default DisclaimerBanner;
