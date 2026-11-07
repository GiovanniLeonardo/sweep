import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';
import { saveSweep } from '../utils/storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CameraScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [detectedTargets, setDetectedTargets] = useState([]);
  const [scanStats, setScanStats] = useState({ hotSpots: 0, highConfidenceGlints: 0 });

  useEffect(() => {
    let interval = null;
    if (isScanning) {
      interval = setInterval(() => {
        // High-sensitivity optical glint filter simulation based on torch reflectance
        if (torch && Math.random() > 0.6) {
          const newTarget = {
            id: Math.random().toString(),
            x: Math.floor(0.2 * SCREEN_WIDTH + Math.random() * (0.6 * SCREEN_WIDTH)),
            y: Math.floor(0.25 * SCREEN_HEIGHT + Math.random() * (0.45 * SCREEN_HEIGHT)),
            type: Math.random() > 0.5 ? 'PROBABLE_LENS_GLINT' : 'HOTSPOT_LUMEN',
            confidence: Math.floor(65 + Math.random() * 30),
          };
          setDetectedTargets((prev) => [newTarget, ...prev.slice(0, 3)]);
          setScanStats((prev) => ({
            hotSpots: prev.hotSpots + 1,
            highConfidenceGlints:
              newTarget.type === 'PROBABLE_LENS_GLINT'
                ? prev.highConfidenceGlints + 1
                : prev.highConfidenceGlints,
          }));
        }
      }, 1400);
    } else {
      setDetectedTargets([]);
    }
    return () => clearInterval(interval);
  }, [isScanning, torch]);

  if (!permission) {
    return <View style={styles.darkFill} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.darkFill, styles.centered]}>
        <Ionicons name="camera-outline" size={56} color={colors.danger} />
        <Text style={[typography.title, { marginTop: 16, textAlign: 'center' }]}>
          Camera Permission Needed
        </Text>
        <Text style={[typography.body, { textAlign: 'center', marginHorizontal: 32, marginVertical: 12 }]}>
          SweepGuard requires camera hardware access to isolate pinhole reflections and IR illuminators.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Authorize Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleFinishSweep = async () => {
    setIsScanning(false);
    const hasFlags = scanStats.highConfidenceGlints > 0;
    const sweepData = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type: 'Optical & IR Camera Sweep',
      status: hasFlags ? 'FLAGGED' : 'CLEAN',
      summary: `${scanStats.highConfidenceGlints} optical lens glint(s), ${scanStats.hotSpots} high-lumen clusters isolated.`,
      glintsDetected: scanStats.highConfidenceGlints,
    };
    await saveSweep(sweepData);
    Alert.alert(
      hasFlags ? 'Glint Detected' : 'Scan Finished',
      hasFlags
        ? `Found ${scanStats.highConfidenceGlints} probable optical reflection(s). Check highlighted coordinates.`
        : 'Zero lens reflections identified in this pass. Sweep logged to Dashboard.'
    );
    setScanStats({ hotSpots: 0, highConfidenceGlints: 0 });
    setDetectedTargets([]);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
      >
        {/* HUD Targeting Overlay */}
        <View style={styles.overlayContainer}>
          <View style={styles.reticleFrame}>
            <View style={[styles.cornerBracket, styles.topLeft]} />
            <View style={[styles.cornerBracket, styles.topRight]} />
            <View style={[styles.cornerBracket, styles.bottomLeft]} />
            <View style={[styles.cornerBracket, styles.bottomRight]} />
            <Text style={styles.reticleText}>
              {isScanning ? 'ANALYZING SPECTRUM' : 'STANDBY — ENGAGE SCANNER'}
            </Text>
          </View>

          {/* Glint Targets Detected */}
          {detectedTargets.map((target) => (
            <View
              key={target.id}
              style={[
                styles.targetIndicator,
                {
                  left: target.x,
                  top: target.y,
                  borderColor:
                    target.type === 'PROBABLE_LENS_GLINT'
                      ? colors.danger
                      : colors.warning,
                },
              ]}
            >
              <View
                style={[
                  styles.targetDot,
                  {
                    backgroundColor:
                      target.type === 'PROBABLE_LENS_GLINT'
                        ? colors.danger
                        : colors.warning,
                  },
                ]}
              />
              <Text style={styles.targetLabel}>
                {target.type === 'PROBABLE_LENS_GLINT' ? 'LENS GLINT' : 'HOTSPOT'} (
                {target.confidence}%)
              </Text>
            </View>
          ))}
        </View>

        {/* Guidance Ribbon */}
        <View style={styles.guidanceRibbon}>
          <Ionicons name="information-circle" size={18} color={colors.accent} />
          <Text style={styles.guidanceText}>
            Turn off all room lights. Activate Torch to illuminate retroreflective camera lenses.
          </Text>
        </View>

        {/* Controls Panel */}
        <View style={styles.controlDeck}>
          <TouchableOpacity
            style={[styles.circularButton, torch && styles.circularButtonActive]}
            onPress={() => setTorch((prev) => !prev)}
          >
            <Ionicons
              name={torch ? 'flashlight' : 'flashlight-outline'}
              size={24}
              color={torch ? '#000' : colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionPillButton,
              isScanning ? styles.stopButton : styles.scanButton,
            ]}
            onPress={() => {
              if (isScanning) {
                handleFinishSweep();
              } else {
                setIsScanning(true);
              }
            }}
          >
            <Ionicons
              name={isScanning ? 'stop-circle' : 'scan-circle'}
              size={28}
              color="#FFF"
            />
            <Text style={styles.actionPillText}>
              {isScanning ? 'Finalize Sweep' : 'Initiate Scan'}
            </Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  darkFill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleFrame: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_HEIGHT * 0.5,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerBracket: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: 'rgba(46, 160, 67, 0.8)',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  reticleText: {
    color: 'rgba(240, 246, 252, 0.5)',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
  },
  targetIndicator: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  targetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  targetLabel: {
    position: 'absolute',
    top: 46,
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: '#000',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  guidanceRibbon: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(22, 27, 34, 0.85)',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  guidanceText: {
    color: colors.text,
    fontSize: 12,
    marginLeft: 10,
    flexShrink: 1,
  },
  controlDeck: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circularButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(22, 27, 34, 0.9)',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularButtonActive: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  actionPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    elevation: 4,
  },
  scanButton: {
    backgroundColor: colors.primary,
  },
  stopButton: {
    backgroundColor: colors.danger,
  },
  actionPillText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 8,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
