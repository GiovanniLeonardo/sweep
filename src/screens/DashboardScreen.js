import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';
import { getSweeps, deleteSweep, clearAllSweeps } from '../utils/storage';

export default function DashboardScreen({ navigation }) {
  const [sweeps, setSweeps] = useState([]);

  const reloadData = async () => {
    const list = await getSweeps();
    setSweeps(list);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      reloadData();
    });
    return unsubscribe;
  }, [navigation]);

  const handleDelete = async (id) => {
    const updated = await deleteSweep(id);
    setSweeps(updated);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Purge Sweep Log',
      'Permanently delete all historical inspection records?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge',
          style: 'destructive',
          onPress: async () => {
            await clearAllSweeps();
            setSweeps([]);
          },
        },
      ]
    );
  };

  const cleanSweepsCount = sweeps.filter((s) => s.status === 'CLEAN').length;
  const flaggedSweepsCount = sweeps.filter((s) => s.status === 'FLAGGED').length;

  return (
    <View style={styles.container}>
      {/* Metric Tiles */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{sweeps.length}</Text>
          <Text style={styles.statLabel}>Total Audits</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: colors.primary }]}>{cleanSweepsCount}</Text>
          <Text style={styles.statLabel}>Passed Clean</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: colors.danger }]}>{flaggedSweepsCount}</Text>
          <Text style={styles.statLabel}>Flagged Anomaly</Text>
        </View>
      </View>

      <View style={styles.headerBar}>
        <Text style={typography.header}>Inspection History</Text>
        {sweeps.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.purgeText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={sweeps}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Ionicons name="shield-outline" size={48} color={colors.textSecondary} />
            <Text style={[typography.title, { marginTop: 12 }]}>No Audits Logged</Text>
            <Text style={[typography.body, { textAlign: 'center', marginTop: 4 }]}>
              Perform a Camera glint scan, BLE tracker audit, or Wi-Fi inspection to record room data.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.sweepCard}>
            <View style={styles.sweepHeader}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>{item.type}</Text>
              </View>
              <View
                style={[
                  styles.statusTag,
                  item.status === 'FLAGGED' ? styles.statusFlagged : styles.statusClean,
                ]}
              >
                <Text
                  style={[
                    typography.badge,
                    { color: item.status === 'FLAGGED' ? colors.danger : colors.primary },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </View>

            <Text style={[typography.body, { color: colors.text, marginVertical: 8 }]}>
              {item.summary}
            </Text>

            <View style={styles.sweepFooter}>
              <Text style={styles.dateText}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  purgeText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  sweepCard: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  sweepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusClean: {
    backgroundColor: 'rgba(46, 160, 67, 0.15)',
  },
  statusFlagged: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
  },
  sweepFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  dateText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  emptyView: {
    alignItems: 'center',
    padding: 40,
  },
});
