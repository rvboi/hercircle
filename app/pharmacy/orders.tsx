import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Order {
  id: string;
  distributor_id?: string;
  order_date: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: number;
  notes: string;
  distributor_profiles: any;
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  products: {
    name: string;
    image_url?: string;
  };
}

export default function OrdersScreen() {
  const { auth } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Details Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (auth?.id) {
      fetchOrders();
    }
  }, [auth]);

  const fetchOrders = async () => {
    if (!auth?.id) return;
    try {
      setLoading(true);

      // Using auth.id (User ID) directly as pharmacy_id in orders table refers to users table
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('pharmacy_id', auth.id)
        .order('order_date', { ascending: false });

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      // Fetch Distributor Profiles manually
      const distIds = [...new Set(ordersData.map((o: any) => o.distributor_id).filter(Boolean))];

      let profilesData: any[] = [];
      if (distIds.length > 0) {
        const { data } = await supabase
          .from('distributor_profiles')
          .select('id, display_name, contact_name')
          .in('id', distIds);
        profilesData = data || [];
      }

      // Map profiles to orders
      const ordersWithProfiles = ordersData.map((order: any) => {
        const p = profilesData.find((prof: any) => prof.id === order.distributor_id);
        return {
          ...order,
          distributor_profiles: p || null
        };
      });

      setOrders(ordersWithProfiles);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch orders.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    try {
      setLoadingDetails(true);
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          id, quantity, unit_price,
          products ( name, image_url )
        `)
        .eq('order_id', order.id);

      if (error) throw error;
      setOrderItems(data || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'confirmed': return '#3B82F6';
      case 'shipped': return '#8B5CF6';
      case 'delivered': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const renderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => fetchOrderDetails(item)}
    >
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderId}>Order #{item.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.orderDate}>{new Date(item.order_date).toLocaleDateString()}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.orderBody}>
        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            Distributor: {item.distributor_profiles?.display_name || item.distributor_profiles?.contact_name || (item.distributor_id ? 'Assigned Distributor' : 'Direct to Admin')}
          </Text>
        </View>
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalValue}>₹{Number(item.total_amount).toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <TouchableOpacity onPress={fetchOrders}>
          <Ionicons name="refresh" size={24} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cart-outline" size={64} color="#E5E7EB" />
              <Text style={styles.emptyText}>No orders found.</Text>
            </View>
          }
        />
      )}

      {/* Order Details Modal */}
      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Order Details</Text>
          <TouchableOpacity onPress={() => setSelectedOrder(null)}>
            <Feather name="x" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {loadingDetails ? (
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={orderItems}
            keyExtractor={i => i.id}
            contentContainerStyle={{ padding: 16 }}
            ListHeaderComponent={
              <View style={styles.detailSummary}>
                <Text style={styles.detailTotal}>Total: ₹{Number(selectedOrder?.total_amount).toFixed(2)}</Text>
                <Text style={styles.detailStatus}>Status: {selectedOrder?.status.toUpperCase()}</Text>
                {/* Display OTP if available */}
                {/* @ts-ignore */}
                {selectedOrder?.delivery_otp && (
                  <View style={styles.otpContainer}>
                    <Text style={styles.otpLabel}>Delivery OTP:</Text>
                    <Text style={styles.otpValue}>{selectedOrder.delivery_otp}</Text>
                    <Text style={styles.otpNote}>Share this code with the delivery person.</Text>
                  </View>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.products?.name || 'Unknown Product'}</Text>
                  <Text style={styles.itemSub}>Qty: {item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>₹{(item.unit_price * item.quantity).toFixed(2)}</Text>
              </View>
            )}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingTop: 50 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  orderCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  orderId: { fontSize: 15, fontWeight: '700', color: '#111827' },
  orderDate: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800' },
  orderBody: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6', paddingVertical: 12, gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, color: '#4B5563', flex: 1 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  totalLabel: { fontSize: 14, color: '#6B7280' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#7C3AED' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#9CA3AF' },

  // Modal
  modalHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee', paddingTop: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  detailSummary: { marginBottom: 20, padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12 },
  detailTotal: { fontSize: 20, fontWeight: 'bold', color: '#7C3AED' },
  detailStatus: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  itemSub: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  itemPrice: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  otpContainer: { marginTop: 12, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 8, borderColor: '#BFDBFE', borderWidth: 1 },
  otpLabel: { fontSize: 13, color: '#1E40AF', fontWeight: '600' },
  otpValue: { fontSize: 24, fontWeight: 'bold', color: '#1E3A8A', marginVertical: 4, letterSpacing: 4 },
  otpNote: { fontSize: 12, color: '#60A5FA' },
});