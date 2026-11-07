import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';
import { KNOWN_TRACKER_COMPANIES } from '../utils/knownSignatures';
import { saveSweep } from '../utils/storage';

const bleManager = new BleManager();

export default function BleTrackerScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [threatCount, setThreatCount] = useState(0);

  useEffect(() => {
    return () => {
      bleManager.stopDeviceScan();
    };
  }, []);

  const evaluateDeviceThreat = (device) => {
    let isThreat = false;
    let label = 'Standard Peripheral';

    if (device.manufacturerData) {
      // Decode hex manufacturer signature
      const hex = Buffer.from(device.manufacturerData, 'base64').toString('hex');
      for (const pattern of KNOWN_TRACKER_COMPANIES) {
        if (hex.toLowerCase().startsWith(pattern.id)) {
          isThreat = true;
          label = pattern.name;
          break;
        }
      }
    }

    if (device.name) {
      const lower = device.name.toLowerCase();
      if (lower.includes('airtag') || lower.includes('tile') || lower.includes('smarttag')) {
        isThreat = true;
        label = device.name;
      }
    }

    return { isThreat, label };
  };

  const startBleScan = () => {
    setDevices([]);
    setThreatCount(0);
    setIsScanning(true);

    bleManager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        console.error('BLE Scan Error:', error);
        setIsScanning(false);
        Alert.alert('Scan Issue', 'Check that Bluetooth is enabled in OS settings.');
        return;
      }

      if (device) {
        setDevices((current) => {
          const exists = current.some((d) => d.id === device.id);
          if (exists) return current;

          const evaluation = evaluateDeviceThreat(device);
          if (evaluation.isThreat) {
            setThreatCount((prev) => prev + 1);
          }

          const record = {
            id: device.id,
            name: device.name || 'Anonymous Beacon',
            rssi: device.rssi,
            isThreat: evaluation.isThreat,
            category: evaluation.label,
          };
          return [record, ...current];
        });
      }
    });

    // Auto-timeout after 12 seconds
    setTimeout(() => {
      stopBleScan();
    }, 12000);
  };

  const stopBleScan = async () => {
    bleManager.stopDeviceScan();
    setIsScanning(false);

    const hasFlags = threatCount > 0;
    const sweepData = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type: 'Bluetooth Tracker Sweep',
      status: hasFlags ? 'FLAGGED' : 'CLEAN',
      summary: `${devices.length} BLE devices audited. Identified ${threatCount} tracking tag signature(s).`,
      glintsDetected: 0,
    };
    await saveSweep(sweepData);
  };

  const openNativeTrackerSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.UNKNOWN_TRACKER_SETTINGS').catch(() => {
        Alert.alert('Settings', 'Navigate to Settings -> Safety & Emergency -> Unknown Tracker Alerts.');
      });
    } else {
      Alert.alert(
        'iOS Find My Protection',
        'iOS executes background tracking alerts automatically. Open Settings -> Privacy & Security -> Location Services -> System Services -> Find My iPhone.'
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.banner}>
        <View style={styles.bannerRow}>
          <Ionicons name="bluetooth" size={24} color={colors.accent} />
          <Text style={[typography.header, { marginLeft: 10 }]}>AirTag & BLE Audit</Text>
        </View>
        <Text style={[typography.body, { marginTop: 6 }]}>
          Scans 2.4GHz BLE spectrum for unsolicited Find My beacons, Tiles, and rogue trackers.
        </Text>
        <TouchableOpacity
          style={styles.systemLinkButton}
          onPress={openNativeTrackerSettings}
        >
          <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          <Text style={styles.systemLinkText}>
            Launch {Platform.OS === 'ios' ? 'iOS Find My Settings' : 'Android Tracker Scanner'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, isScanning && styles.buttonDisabled]}
          onPress={isScanning ? stopBleScan : startBleScan}
        >
          <Ionicons
            name={isScanning ? 'stop-circle' : 'refresh-circle'}
            size={22}
            color="#FFF"
          />
          <Text style={styles.buttonText}>
            {isScanning ? 'Stop Spectrum Sweep' : 'Start 12s Discovery Scan'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Discovered Peripherals */}
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Ionicons name="radio-outline" size={44} color={colors.textSecondary} />
            <Text style={[typography.body, { marginTop: 12, textAlign: 'center' }]}>
              {isScanning
                ? 'Listening for BLE advertisements...'
                : 'No peripherals captured. Tap Start to scan your immediate environment.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.deviceCard,
              item.isThreat && styles.threatCard,
            ]}
          >
            <View style={styles.deviceRow}>
              <View style={styles.deviceIcon}>
                <Ionicons
                  name={item.isThreat ? 'alert-triangle' : 'hardware-chip-outline'}
                  size={24}
                  color={item.isThreat ? colors.danger : colors.accent}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={typography.title}>{item.name}</Text>
                <Text style={typography.body}>{item.category}</Text>
                <Text style={[typography.body, { fontSize: 12 }]}>
                  ID: {item.id} | Signal: {item.rssi ? `${item.rssi} dBm` : 'N/A'}
                </Text>
              </View>
              {item.isThreat && (
                <View style={styles.threatBadge}>
                  <Text style={[typography.badge, { color: colors.danger }]}>ALERT</Text>
                </View>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  banner: {
    padding: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  systemLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  systemLinkText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionContainer: {
    padding: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: colors.danger,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  deviceCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  threatCard: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(248, 81, 73, 0.2)',
  },
  emptyView: {
    padding: 40,
    alignItems: 'center',
  },
});
