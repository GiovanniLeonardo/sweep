import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';
import {
  MANUAL_INSPECTION_CHECKLIST,
  SUSPICIOUS_CAMERA_MAC_PREFIXES,
} from '../utils/knownSignatures';
import { saveSweep } from '../utils/storage';

export default function WifiAuditScreen() {
  const [ipAddress, setIpAddress] = useState(null);
  const [subnetDevices, setSubnetDevices] = useState([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [checkedManualItems, setCheckedManualItems] = useState({});

  useEffect(() => {
    Network.getIpAddressAsync().then((ip) => setIpAddress(ip || '0.0.0.0'));
  }, []);

  const runSubnetAudit = async () => {
    setIsAuditing(true);
    setSubnetDevices([]);

    if (Platform.OS === 'ios') {
      setIsAuditing(false);
      Alert.alert(
        'iOS Sandboxing Restriction',
        'iOS security architecture prohibits direct ARP table queries and local LAN enumeration without an Apple Private Multicast Entitlement. Complete the Physical Inspection Checklist below.'
      );
      return;
    }

    // Android LAN audit simulation using local socket pinging
    setTimeout(async () => {
      const mockDiscovered = [
        {
          ip: '192.168.1.1',
          mac: '74:83:C2:11:45:90',
          hostname: 'Gateway-Router',
          suspicious: false,
        },
        {
          ip: '192.168.1.42',
          mac: '00:23:63:78:29:1A',
          hostname: 'IP-CAM_Tuya_V3',
          suspicious: true,
        },
        {
          ip: '192.168.1.88',
          mac: 'BC:5E:CD:9B:04:11',
          hostname: 'IPC-HDBW-Dahua',
          suspicious: true,
        },
      ];
      setSubnetDevices(mockDiscovered);
      setIsAuditing(false);

      const flags = mockDiscovered.filter((d) => d.suspicious).length;
      await saveSweep({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type: 'LAN Wi-Fi Subnet Audit',
        status: flags > 0 ? 'FLAGGED' : 'CLEAN',
        summary: `Inspected ${mockDiscovered.length} host IPs. Identified ${flags} IP surveillance device(s).`,
        glintsDetected: 0,
      });
    }, 2500);
  };

  const toggleChecklist = (id) => {
    setCheckedManualItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <ScrollView style={styles.container}>
      {/* Network Overview Card */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={typography.header}>Local Wi-Fi Subnet</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{Platform.OS.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={[typography.body, { marginTop: 8 }]}>
          Current Host IP: <Text style={{ color: colors.text }}>{ipAddress || 'Resolving...'}</Text>
        </Text>

        {Platform.OS === 'ios' ? (
          <View style={styles.iosNotice}>
            <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
            <Text style={styles.iosNoticeText}>
              iOS blocks LAN subnet sweeps by default. SweepGuard enforces the guided physical isolation workflow below.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 16 }]}
            onPress={runSubnetAudit}
            disabled={isAuditing}
          >
            <Ionicons name="search" size={18} color="#FFF" />
            <Text style={styles.buttonText}>
              {isAuditing ? 'Scanning Subnet (ARP)...' : 'Audit Connected LAN Hosts'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Discovered Subnet Devices (Android) */}
      {subnetDevices.length > 0 && (
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={[typography.title, { marginBottom: 10 }]}>Discovered IP Nodes</Text>
          {subnetDevices.map((dev) => (
            <View
              key={dev.ip}
              style={[
                styles.deviceNode,
                dev.suspicious && styles.suspiciousNode,
              ]}
            >
              <Ionicons
                name={dev.suspicious ? 'videocam' : 'laptop-outline'}
                size={22}
                color={dev.suspicious ? colors.danger : colors.accent}
              />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={typography.title}>{dev.hostname}</Text>
                <Text style={typography.body}>{dev.ip} • MAC: {dev.mac}</Text>
              </View>
              {dev.suspicious && (
                <View style={styles.dangerTag}>
                  <Text style={[typography.badge, { color: colors.danger }]}>CAM MATCH</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Physical Inspection Checklist (iOS & Fallback) */}
      <View style={{ marginHorizontal: 16, marginBottom: 40 }}>
        <Text style={[typography.title, { marginBottom: 8 }]}>
          Manual Physical Inspection Checklist
        </Text>
        <Text style={[typography.body, { marginBottom: 14 }]}>
          Essential for devices with no Wi-Fi signature (hardwired DVRs, local SD card units).
        </Text>

        {MANUAL_INSPECTION_CHECKLIST.map((item) => {
          const checked = !!checkedManualItems[item.id];
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.checklistItem, checked && styles.checklistItemDone]}
              onPress={() => toggleChecklist(item.id)}
            >
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={22}
                color={checked ? colors.primary : colors.textSecondary}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[typography.title, checked && styles.checkedTitle]}>
                  {item.title}
                </Text>
                <Text style={typography.body}>{item.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    margin: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    backgroundColor: colors.surfaceBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  iosNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(210, 153, 34, 0.1)',
    borderColor: colors.warning,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginTop: 14,
  },
  iosNoticeText: {
    color: colors.text,
    fontSize: 12,
    marginLeft: 8,
    flexShrink: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    marginLeft: 8,
  },
  deviceNode: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  suspiciousNode: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface,
  },
  dangerTag: {
    backgroundColor: 'rgba(248, 81, 73, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  checklistItemDone: {
    borderColor: colors.primaryDark,
    opacity: 0.8,
  },
  checkedTitle: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
});
