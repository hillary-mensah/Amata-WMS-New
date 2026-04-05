import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCartStore, generateLocalSaleId } from '../stores/cart';
import { useSyncStore } from '../stores/sync';
import { useAuthStore } from '../stores/auth';

export default function CartScreen() {
  const navigation = useNavigation();
  const { items, paymentMethod, updateQuantity, removeItem, clearCart, setPaymentMethod, getSubtotal, getTax, getTotal } = useCartStore();
  const { addPendingSale, isOnline } = useSyncStore();
  const { user } = useAuthStore();

  const handleCheckout = async () => {
    if (items.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }

    if (!user?.branchId) {
      Alert.alert('Error', 'No branch assigned');
      return;
    }

    const localId = generateLocalSaleId();
    const idempotencyKey = localId;

    await addPendingSale({
      localId,
      idempotencyKey,
      branchId: user.branchId,
      items: items.map((item) => ({
        ...item,
        totalPrice: item.quantity * item.unitPrice - item.discount,
      })),
      paymentMethod,
      totalAmount: getTotal(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    clearCart();
    Alert.alert('Success', 'Sale saved locally. It will sync when online.');
    navigation.goBack();
  };

  const renderItem = ({ item }: { item: typeof items[0] }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.productName}</Text>
        <Text style={styles.itemPrice}>GHS {item.unitPrice.toFixed(2)}</Text>
      </View>
      <View style={styles.quantityControls}>
        <TouchableOpacity style={styles.qtyButton} onPress={() => updateQuantity(item.productId, item.quantity - 1)}>
          <Text style={styles.qtyButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <TouchableOpacity style={styles.qtyButton} onPress={() => updateQuantity(item.productId, item.quantity + 1)}>
          <Text style={styles.qtyButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => removeItem(item.productId)}>
        <Text style={styles.removeButton}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart</Text>
        <TouchableOpacity onPress={clearCart}>
          <Text style={styles.clearButton}>Clear</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.cartList}
      />

      <View style={styles.paymentSection}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.paymentOptions}>
          {(['CASH', 'CARD', 'MOMO'] as const).map((method) => (
            <TouchableOpacity
              key={method}
              style={[styles.paymentOption, paymentMethod === method && styles.paymentOptionSelected]}
              onPress={() => setPaymentMethod(method)}
            >
              <Text style={[styles.paymentOptionText, paymentMethod === method && styles.paymentOptionTextSelected]}>
                {method}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>GHS {getSubtotal().toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax (20%)</Text>
          <Text style={styles.summaryValue}>GHS {getTax().toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>GHS {getTotal().toFixed(2)}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
        <Text style={styles.checkoutButtonText}>Complete Sale</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { fontSize: 16, color: '#2563eb' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  clearButton: { fontSize: 16, color: '#dc2626' },
  cartList: { padding: 16 },
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  itemPrice: { fontSize: 14, color: '#6b7280' },
  quantityControls: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  qtyButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  qtyButtonText: { fontSize: 18, color: '#111827' },
  quantity: { marginHorizontal: 12, fontSize: 16, fontWeight: '600' },
  removeButton: { fontSize: 18 },
  paymentSection: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  paymentOptions: { flexDirection: 'row', gap: 12 },
  paymentOption: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  paymentOptionSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  paymentOptionText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  paymentOptionTextSelected: { color: '#2563eb' },
  summary: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  summaryValue: { fontSize: 14, color: '#111827' },
  totalLabel: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  checkoutButton: { margin: 16, backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
  checkoutButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});