import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, RefreshControl } from 'react-native';
import { useSyncStore } from '../stores/sync';

export default function OrdersScreen() {
  const { pendingSales, getPendingSales, isOnline } = useSyncStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadSales = async () => {
    const sales = await getPendingSales();
    setRefreshing(false);
  };

  useEffect(() => {
    loadSales();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadSales();
  };

  const renderSale = ({ item }: { item: typeof pendingSales[0] }) => (
    <View style={styles.saleCard}>
      <View style={styles.saleHeader}>
        <Text style={styles.saleId}>Order #{item.localId.slice(0, 8)}</Text>
        <View style={[styles.statusBadge, item.status === 'synced' && styles.statusSynced, item.status === 'failed' && styles.statusFailed]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.saleDate}>{new Date(item.createdAt).toLocaleString()}</Text>
      <View style={styles.saleItems}>
        <Text style={styles.itemsCount}>{item.items.length} items</Text>
        <Text style={styles.saleTotal}>GHS {item.totalAmount.toFixed(2)}</Text>
      </View>
      <View style={styles.paymentMethod}>
        <Text style={styles.paymentLabel}>Payment: {item.paymentMethod}</Text>
      </View>
      {item.error && <Text style={styles.errorText}>Error: {item.error}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <View style={[styles.onlineBadge, isOnline && styles.onlineBadgeActive]}>
          <Text style={[styles.onlineText, isOnline && styles.onlineTextActive]}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
      </View>

      <FlatList
        data={pendingSales}
        renderItem={renderSale}
        keyExtractor={(item) => item.localId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>📋 No pending orders</Text>
            <Text style={styles.emptySubtext}>Orders will appear here when offline</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  onlineBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fee2e2' },
  onlineBadgeActive: { backgroundColor: '#dcfce7' },
  onlineText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  onlineTextActive: { color: '#059669' },
  list: { padding: 16 },
  saleCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  saleId: { fontSize: 16, fontWeight: '600', color: '#111827' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fef3c7' },
  statusSynced: { backgroundColor: '#dcfce7' },
  statusFailed: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#92400e' },
  saleDate: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  saleItems: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemsCount: { fontSize: 14, color: '#6b7280' },
  saleTotal: { fontSize: 16, fontWeight: '600', color: '#111827' },
  paymentMethod: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8 },
  paymentLabel: { fontSize: 12, color: '#6b7280' },
  errorText: { marginTop: 8, fontSize: 12, color: '#dc2626' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: 18, color: '#6b7280' },
  emptySubtext: { fontSize: 14, color: '#9ca3af', marginTop: 8 },
});