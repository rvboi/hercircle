import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface AdminOrder {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  delivery_otp?: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  products: {
    name: string;
    sku: string;
    image_url?: string;
  };
}

export default function AdminOrdersStatus() {
  const { auth } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (auth?.id) fetchOrders();
  }, [auth]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('distributor_admin_orders')
        .select('*')
        .eq('distributor_id', auth?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    try {
      setLoadingItems(true);
      const { data, error } = await supabase
        .from('distributor_admin_order_items')
        .select(`
          id,
          quantity,
          price,
          products (
            name,
            sku,
            image_url
          )
        `)
        .eq('order_id', orderId);

      if (error) throw error;
      // @ts-ignore
      setOrderItems(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleOrderPress = (order: AdminOrder) => {
    setSelectedOrder(order);
    fetchOrderItems(order.id);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return '#F59E0B';
      case 'approved':
      case 'confirmed': return '#10B981';
      case 'rejected':
      case 'cancelled': return '#EF4444';
      case 'fulfilled':
      case 'delivered': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#059669" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No orders placed yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => handleOrderPress(item)}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>Order #{item.id.slice(0, 8)}</Text>
                <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                  <Text style={[styles.badgeText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
              <Text style={styles.amount}>Total: ${item.total_amount.toFixed(2)}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={!!selectedOrder} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Order Details</Text>
            <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          {selectedOrder && (
            <View style={styles.orderDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order ID:</Text>
                <Text style={styles.detailValue}>#{selectedOrder.id.slice(0, 8)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date:</Text>
                <Text style={styles.detailValue}>{new Date(selectedOrder.created_at).toLocaleString()}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status:</Text>
                <Text style={[styles.detailValue, { color: getStatusColor(selectedOrder.status), fontWeight: '700' }]}>
                  {selectedOrder.status}
                </Text>
              </View>
              {/* @ts-ignore */}
              {selectedOrder.delivery_otp && (selectedOrder.status.toLowerCase() === 'confirmed' || selectedOrder.status.toLowerCase() === 'processing') && (
                <View style={styles.otpContainer}>
                  <Text style={styles.otpLabel}>Delivery OTP:</Text>
                  <Text style={styles.otpValue}>{selectedOrder.delivery_otp}</Text>
                  <Text style={styles.otpNote}>Share this code with the Admin for delivery.</Text>
                </View>
              )}
            </View>

          )}

          <View style={styles.divider} />

          {loadingItems ? (
            <ActivityIndicator size="large" color="#059669" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={orderItems}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.itemsList}
              renderItem={({ item }) => (
                <View style={styles.itemCard}>
                  {item.products?.image_url ? (
                    <Image source={{ uri: item.products.image_url }} style={styles.itemImage} />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <Feather name="image" size={20} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.products?.name}</Text>
                    <Text style={styles.itemSku}>SKU: {item.products?.sku}</Text>
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemQty}>x{item.quantity}</Text>
                      <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                    </View>
                  </View>
                  <Text style={styles.itemTotal}>${(item.quantity * item.price).toFixed(2)}</Text>
                </View>
              )}
            />
          )}

          {selectedOrder && (
            <View style={styles.footer}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Grand Total</Text>
                <Text style={styles.totalValue}>${selectedOrder.total_amount.toFixed(2)}</Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 16, fontWeight: '700', color: '#111827' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  date: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  amount: { fontSize: 16, fontWeight: '700', color: '#059669' },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#9CA3AF', fontSize: 16 },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: {
    padding: 20,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  closeBtn: { padding: 4 },
  orderDetails: { padding: 20, backgroundColor: '#fff' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLabel: { fontSize: 14, color: '#6B7280' },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#E5E7EB' },
  itemsList: { padding: 16, gap: 12 },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  itemImage: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
  placeholderImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemSku: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  itemMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  itemQty: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
  itemPrice: { fontSize: 12, color: '#6B7280' },
  itemTotal: { fontSize: 14, fontWeight: '700', color: '#111827' },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingBottom: 40,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#111827' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#059669' },
  otpContainer: { marginTop: 12, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 8, borderColor: '#BFDBFE', borderWidth: 1 },
  otpLabel: { fontSize: 13, color: '#1E40AF', fontWeight: '600' },
  otpValue: { fontSize: 24, fontWeight: 'bold', color: '#1E3A8A', marginVertical: 4, letterSpacing: 4 },
  otpNote: { fontSize: 12, color: '#60A5FA' },
});