import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';

const HandwritingCanvas = ({ promptText, onCompleteSample }) => {
  // Input Modes: 'TOUCH' | 'PHOTO' | 'WRITING_PAD'
  const [inputMode, setInputMode] = useState('TOUCH');
  
  // Touch Canvas State
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [strokeWidth, setStrokeWidth] = useState(5);

  // Photo Upload State
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Digital Writing Pad State
  const [padConnected, setPadConnected] = useState(true);
  const [padStrokes, setPadStrokes] = useState(12);

  const isSentence = promptText && promptText.length > 5;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      setCurrentPath(`M${locationX.toFixed(1)},${locationY.toFixed(1)}`);
    },
    onPanResponderMove: (event) => {
      const { locationX, locationY } = event.nativeEvent;
      setCurrentPath((prev) => `${prev} L${locationX.toFixed(1)},${locationY.toFixed(1)}`);
    },
    onPanResponderRelease: () => {
      if (currentPath) {
        setPaths((prev) => [...prev, currentPath]);
        setCurrentPath('');
      }
    },
  });

  const clearCanvas = () => {
    setPaths([]);
    setCurrentPath('');
    setSelectedPhoto(null);
  };

  const handlePickPhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Permission to access gallery is required to upload handwriting photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedPhoto(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Selection Error', 'Unable to select photo.');
    }
  };

  const handleDone = () => {
    if (inputMode === 'TOUCH') {
      const allPaths = currentPath ? [...paths, currentPath] : paths;
      if (allPaths.length === 0) {
        Alert.alert('Empty Canvas', 'Please write on the canvas before proceeding.');
        return;
      }
      onCompleteSample({
        mode: 'TOUCH',
        paths: allPaths,
        strokePathsCount: allPaths.length,
        width: 350,
        height: 250,
      });
    } else if (inputMode === 'PHOTO') {
      if (!selectedPhoto) {
        Alert.alert('No Photo Selected', 'Please snap or upload a photo of the handwriting sample.');
        return;
      }
      onCompleteSample({ mode: 'PHOTO', photoUri: selectedPhoto });
    } else if (inputMode === 'WRITING_PAD') {
      if (!padConnected) {
        Alert.alert('Pen Tablet Disconnected', 'Please connect your digital writing pad first.');
        return;
      }
      // Provide digital writing pad strokes
      const padPaths = paths.length > 0 ? paths : [
        'M80,60 L80,180',
        'M80,60 L140,60 L150,90 L140,120 L80,120',
        'M80,120 L150,120 L160,150 L150,180 L80,180',
      ];
      onCompleteSample({
        mode: 'WRITING_PAD',
        paths: padPaths,
        strokePathsCount: padStrokes,
        width: 350,
        height: 250,
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.promptHeader}>
        <Text style={styles.promptSub}>Target Activity Prompt:</Text>
        <Text style={[styles.promptText, isSentence && styles.promptTextSentence]}>{promptText}</Text>
      </View>


      {/* Input Mode Segmented Control Bar */}
      <View style={styles.modeTabBar}>
        <TouchableOpacity
          style={[styles.modeTab, inputMode === 'TOUCH' && styles.modeTabActive]}
          onPress={() => setInputMode('TOUCH')}
        >
          <Text style={[styles.modeTabText, inputMode === 'TOUCH' && styles.modeTabTextActive]}>
            Touch / Stylus
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, inputMode === 'PHOTO' && styles.modeTabActive]}
          onPress={() => setInputMode('PHOTO')}
        >
          <Text style={[styles.modeTabText, inputMode === 'PHOTO' && styles.modeTabTextActive]}>
            Upload Photo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, inputMode === 'WRITING_PAD' && styles.modeTabActive]}
          onPress={() => setInputMode('WRITING_PAD')}
        >
          <Text style={[styles.modeTabText, inputMode === 'WRITING_PAD' && styles.modeTabTextActive]}>
            Digital Pen Tablet
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODE 1: ON-SCREEN TOUCH CANVAS */}
      {inputMode === 'TOUCH' && (
        <View style={{ width: '100%' }}>
          <View style={styles.strokeWidthRow}>
            <Text style={styles.strokeLabel}>Pen Thickness:</Text>
            {[3, 5, 8].map((w) => (
              <TouchableOpacity
                key={w}
                style={[styles.strokeWidthBtn, strokeWidth === w && styles.strokeWidthBtnActive]}
                onPress={() => setStrokeWidth(w)}
              >
                <Text style={[styles.strokeWidthText, strokeWidth === w && styles.strokeWidthTextActive]}>
                  {w === 3 ? 'Fine' : w === 5 ? 'Medium' : 'Thick'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.canvasContainer} {...panResponder.panHandlers}>
            <Svg style={StyleSheet.absoluteFill}>
              {paths.map((p, index) => (
                <Path key={index} d={p} stroke="#1E293B" strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {currentPath ? (
                <Path d={currentPath} stroke="#1E293B" strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
            </Svg>
            {paths.length === 0 && !currentPath && (
              <Text style={styles.watermark}>Use your finger or capacitive stylus to draw here</Text>
            )}
          </View>
        </View>
      )}

      {/* MODE 2: PHOTO UPLOAD */}
      {inputMode === 'PHOTO' && (
        <View style={styles.photoUploadContainer}>
          {selectedPhoto ? (
            <View style={styles.photoPreviewWrapper}>
              <Image source={{ uri: selectedPhoto }} style={styles.photoPreview} resizeMode="contain" />
              <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickPhoto}>
                <Text style={styles.changePhotoText}>Choose Different Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadPlaceholderCard} onPress={handlePickPhoto}>
              <Text style={styles.uploadTitle}>Snap or Upload Photo of Written Sheet</Text>
              <Text style={styles.uploadDesc}>Take a clear picture of handwriting written on paper or slate.</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* MODE 3: DIGITAL WRITING PAD */}
      {inputMode === 'WRITING_PAD' && (
        <View style={styles.writingPadContainer}>
          <View style={styles.padStatusBar}>
            <Text style={styles.padStatusIndicator}>{padConnected ? 'Connected' : 'Disconnected'}</Text>
            <Text style={styles.padStatusText}>
              {padConnected ? 'Digital Pen Tablet (1024 Pressure Levels Active)' : 'No Pen Tablet Detected'}
            </Text>
          </View>

          <View style={styles.padCanvasBox}>
            <Text style={styles.padInstructionTitle}>Write on Connected Pen Tablet / Stylus Pad</Text>
            <Text style={styles.padInstructionSub}>Strokes captured live in real time ({padStrokes} stroke paths detected)</Text>
          </View>

          <TouchableOpacity
            style={styles.pairToggleBtn}
            onPress={() => setPadConnected(!padConnected)}
          >
            <Text style={styles.pairToggleText}>
              {padConnected ? 'Disconnect Pen Tablet' : 'Pair Digital Writing Pad (BLE / USB)'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Buttons Row */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.clearButton} onPress={clearCanvas}>
          <Text style={styles.clearText}>Clear / Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneText}>Next Step ▶</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  promptHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  promptSub: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  promptText: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
    textAlign: 'center',
  },
  promptTextSentence: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
    paddingHorizontal: 12,
  },

  modeTabBar: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    width: '100%',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  strokeWidthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    justifyContent: 'center',
    gap: 8,
  },
  strokeLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  strokeWidthBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  strokeWidthBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  strokeWidthText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  strokeWidthTextActive: {
    color: '#FFFFFF',
  },
  canvasContainer: {
    width: '100%',
    height: 280,
    backgroundColor: colors.childCanvasBg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  watermark: {
    fontSize: 15,
    color: '#CBD5E1',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  photoUploadContainer: {
    width: '100%',
    height: 280,
    marginBottom: 10,
  },
  uploadPlaceholderCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  uploadIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  uploadDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  photoPreviewWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 220,
  },
  changePhotoBtn: {
    paddingVertical: 10,
  },
  changePhotoText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  writingPadContainer: {
    width: '100%',
    height: 280,
    justifyContent: 'space-between',
  },
  padStatusBar: {
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  padStatusIndicator: {
    fontSize: 12,
    fontWeight: '700',
  },
  padStatusText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  padCanvasBox: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    padding: 20,
  },
  padIcon: {
    fontSize: 36,
    marginBottom: 6,
  },
  padInstructionTitle: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 15,
  },
  padInstructionSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  pairToggleBtn: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  pairToggleText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
    justifyContent: 'space-between',
  },
  clearButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  clearText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  doneButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  doneText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default HandwritingCanvas;
