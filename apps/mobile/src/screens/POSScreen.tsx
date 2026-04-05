import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, SafeAreaView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCartStore } from '../stores/cart';
import { useSyncStore } from '../stores/sync';
import { useAuthStore } from '../stores/auth';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  unitPrice: number;
  quantity: number;
}

export default function POSScreen() {
  const navigation = useNavigation<any>();
  const { addItem, items } = useCartStore();
  const { products, getProducts, isOnline, saveProducts } = useSyncStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      if (isOnline) {
        const response = await fetch('http://localhost:3001/sync/changes', {
          headers: { Authorization: `Bearer ` },
        });
        const data = await response.json();
        if (data.success && data.data) {
          const prods = data.data.filter((c: { type: string }) => c.type === 'PRODUCT').map((c: { data: Product }) => c.data);
          await saveProducts(prods);
        }
      }
      const localProducts = await getProducts();
      if (localProducts.length === 0 && isOnline) {
        const [resp] = await Promise.all([
          fetch('http://localhost:3001/inventory', {
            headers: { Authorization: `Bearer ` },
          }),
        ]);
        const resData = await resp.json();
        if (resData.success) {
          const prods = resData.data.items?.map((i: { product: Product; quantity: number }) => ({
            ...i.product,
            quantity: i.quantity,
          })) || [];
          await saveProducts(prods);
        }
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleAddToCart = (product: Product) => {
    addItem({
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: product.unitPrice,
    });
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.productCard} onPress={() => handleAddToCart(item)}>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.productSku}>{item.sku}</Text>
        <Text style={styles.productPrice}>GHS {item.unitPrice.toFixed(2)}</Text>
      </View>
      <View style={styles.addButton}>
        <Text style={styles.addButtonText}>+</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>POS</Text>
          <Text style={styles.headerSubtitle}>{user?.branchName || 'Select Branch'}</Text>
        </View>
        <View style={styles.onlineIndicator}>
          <Text style={styles.onlineText}>{isOnline ? '🟢 Online' : '🔴 Offline'}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productList}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('Cart')}>
        <Text style={styles.cartButtonText}>🛒 View Cart</Text>
        {cartCount > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6b7280' },
  onlineIndicator: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#ecfdf5', borderRadius: 16 },
  onlineText: { fontSize: 12, color: '#059669', fontWeight: '600' },
  searchContainer: { padding: 16 },
  searchInput: { backgroundColor: '#fff', padding: 12, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  productList: { padding: 8 },
  productCard: { flex: 1, margin: 8, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  productSku: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  productPrice: { fontSize: 16, fontWeight: 'bold', color: '#2563eb' },
  addButton: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  cartButton: { position: 'absolute', bottom: 24, left: 24, right: 24, backgroundColor: '#2563eb', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  cartButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cartBadge: { position: 'absolute', right: 16, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  cartBadgeText: { color: '#2563eb', fontSize: 14, fontWeight: 'bold' },
});