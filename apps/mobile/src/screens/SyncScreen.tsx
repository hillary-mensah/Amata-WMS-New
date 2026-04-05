import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useSyncStore } from '../stores/sync';
import { useAuthStore } from '../stores/auth';

export default function SyncScreen() {
  const { pendingSales, getPendingSales, isOnline, lastSyncAt, updateSaleStatus } = useSyncStore();
  const { accessToken } = useAuthStore();
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({ pending: 0, synced: 0, failed: 0 });

  useEffect(() => {
    loadStats();
  }, [pendingSales]);

  const loadStats = async () => {
    const sales = await getPendingSales();
    setStats({
      pending: sales.filter((s) => s.status === 'pending').length,
      synced: sales.filter((s) => s.status === 'synced').length,
      failed: sales.filter((s) => s.status === 'failed').length,
    });
  };

  const handleSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot sync while offline');
      return;
    }

    setSyncing(true);
    try {
      const sales = await getPendingSales();
      for (const sale of sales) {
        try {
          const response = await fetch('http://localhost:3001/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              deviceId: 'mobile-device',
              sales: [
                {
                  localId: sale.localId,
                  idempotencyKey: sale.idempotencyKey,
                  branchId: sale.branchId,
                  items: sale.items.map((i) => ({
                    productId: i.productId,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    discount: i.discount,
                  })),
                  paymentMethod: sale.paymentMethod,
                  createdAt: sale.createdAt,
                },
              ],
            }),
          });

          const data = await response.json();
          if (data.success) {
            await updateSaleStatus(sale.localId, 'synced');
          } else {
            await updateSaleStatus(sale.localId, 'failed', data.message);
          }
        } catch (error) {
          await updateSaleStatus(sale.localId, 'failed', 'Network error');
        }
      }
      await loadStats();
      Alert.alert('Sync Complete', 'All pending sales have been synced');
    } catch (error) {
      Alert.alert('Sync Error', 'Failed to sync sales');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sync</Text>
        <View style={[styles.statusBadge, isOnline && styles.statusBadgeActive]}>
          <Text style={[styles.statusText, isOnline && styles.statusTextActive]}>{isOnline ? '🟢 Online' : '🔴 Offline'}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Sync Status</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#059669' }]}>{stats.synced}</Text>
              <Text style={styles.statLabel}>Synced</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#dc2626' }]}>{stats.failed}</Text>
              <Text style={styles.statLabel}>Failed</Text>
            </View>
          </View>
        </View>

        <View style={styles.lastSyncCard}>
          <Text style={styles.lastSyncLabel}>Last Sync</Text>
          <Text style={styles.lastSyncValue}>
            {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Never'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.syncButton, (!isOnline || syncing) && styles.syncButtonDisabled]}
          onPress={handleSync}
          disabled={!isOnline || syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.syncButtonText}>🔄 Sync Now</Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How Sync Works</Text>
          <Text style={styles.infoText}>• Sales are saved locally when offline</Text>
          <Text style={styles.infoText}>• Automatically syncs when online</Text>
          <Text style={styles.infoText}>• Pull down to manual sync</Text>
          <Text style={styles.infoText}>• Conflicts are resolved server-side</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fee2e2' },
  statusBadgeActive: { backgroundColor: '#dcfce7' },
  statusText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  statusTextActive: { color: '#059669' },
  content: { padding: 16 },
  statsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 16 },
  statsTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#f59e0b' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  lastSyncCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  lastSyncLabel: { fontSize: 12, color: '#6b7280' },
  lastSyncValue: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 4 },
  syncButton: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  syncButtonDisabled: { backgroundColor: '#93c5fd' },
  syncButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoCard: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 16 },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#1e40af', marginBottom: 12 },
  infoText: { fontSize: 12, color: '#1e3a8a', marginBottom: 4 },
});