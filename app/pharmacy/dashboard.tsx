import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface Stats {
  pendingOrders: number;
  lowStock: number;
  outOfStock: number;
  revenueToday: number;
}

interface Distributor {
  id: string;
  display_name?: string;
  contact_name?: string;
  email?: string;
  city?: string;
  state?: string;
  contact_mobile?: string;
}

export default function PharmacyDashboard() {
  const { auth, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ pendingOrders: 0, lowStock: 0, outOfStock: 0, revenueToday: 0 });
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);

  useEffect(() => {
    if (auth?.id) {
      fetchDashboardData();
    }
  }, [auth]);

  const fetchDashboardData = async () => {
    if (!auth?.id || auth.id === 'undefined') {
      return;
    }
    try {
      setLoading(true);

      // 1. Get Pharmacy Profile ID first (Critical step)
      const { data: profile } = await supabase
        .from('pharmacy_profiles')
        .select('id')
        .eq('user_id', auth.id)
        .single();

      const realPharmId = profile?.id;
      if (!realPharmId) {
        console.warn('Pharmacy profile not found for user:', auth.id);
        setLoading(false);
        return;
      }

      // 2. Fetch Stats using Profile ID
      // Orders table uses auth.id for pharmacy_id
      const { data: ordersData } = await supabase
        .from('orders')
        .select('status, total_amount, order_date')
        .eq('pharmacy_id', auth.id);

      const { data: invData } = await supabase
        .from('pharmacy_inventory')
        .select('stock_quantity, reorder_level')
        .eq('pharmacy_id', realPharmId);

      const today = new Date().toISOString().split('T')[0];

      const pendingOrders = ordersData?.filter(o => o.status === 'pending').length || 0;
      const revenueToday = ordersData?.filter(o => o.order_date?.startsWith(today)).reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;

      const lowStock = invData?.filter(i => i.stock_quantity <= i.reorder_level && i.stock_quantity > 0).length || 0;
      const outOfStock = invData?.filter(i => i.stock_quantity === 0).length || 0;

      setStats({ pendingOrders, lowStock, outOfStock, revenueToday });

      // 3. Fetch Assigned Distributors (Many-to-Many via pharmacy_distributors)
      const { data } = await supabase
        .from('pharmacy_distributors')
        .select(`
          distributor:distributor_profiles (
            id,
            display_name,
            contact_name,
            email,
            city,
            state,
            contact_mobile
          )
        `)
        .eq('pharmacy_id', realPharmId);

      const distList = data?.map((item: any) => item.distributor).filter(Boolean) || [];
      setDistributors(distList);

    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Pharmacy</Text>
          <Text style={styles.headerSubtitle}>Dashboard Overview</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Feather name="log-out" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
              <Feather name="clock" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{stats.pendingOrders}</Text>
            <Text style={styles.statTitle}>Pending Orders</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
              <Feather name="alert-triangle" size={20} color="#EF4444" />
            </View>
            <Text style={styles.statValue}>{stats.lowStock}</Text>
            <Text style={styles.statTitle}>Low Stock</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#F3F4F6' }]}>
              <Feather name="slash" size={20} color="#6B7280" />
            </View>
            <Text style={styles.statValue}>{stats.outOfStock}</Text>
            <Text style={styles.statTitle}>Out of Stock</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
              <Feather name="dollar-sign" size={20} color="#10B981" />
            </View>
            <Text style={styles.statValue}>₹{stats.revenueToday.toFixed(0)}</Text>
            <Text style={styles.statTitle}>Revenue Today</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/pharmacy/inventory')}>
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Manage Inventory</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/pharmacy/orders')}>
          <Feather name="list" size={20} color="#7C3AED" />
          <Text style={styles.secondaryButtonText}>View All Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }]}
          onPress={() => router.push('/pharmacy/catalog')}
        >
          <Feather name="shopping-cart" size={20} color="#059669" />
          <Text style={[styles.secondaryButtonText, { color: '#059669' }]}>Browse Catalog</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assigned Distributors</Text>
        </View>

        {distributors.length > 0 ? (
          <View style={{ gap: 12 }}>
            {distributors.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.listItem}
                onPress={() => setSelectedDistributor(item)}
              >
                <View style={styles.distIcon}>
                  <Feather name="truck" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listItemTitle}>{item.display_name || item.contact_name}</Text>
                  <Text style={styles.listItemSubtitle}>
                    {[item.city, item.state].filter(Boolean).join(', ')}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.noDistributor}>
            <Feather name="users" size={48} color="#D1D5DB" />
            <Text style={styles.noDistributorText}>
              No distributor assigned yet. Please contact admin.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Distributor Details Modal */}
      <Modal
        visible={!!selectedDistributor}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDistributor(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Distributor Details</Text>
              <TouchableOpacity onPress={() => setSelectedDistributor(null)}>
                <Feather name="x" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.detailContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{selectedDistributor?.display_name || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Contact Person</Text>
                <Text style={styles.detailValue}>{selectedDistributor?.contact_name || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{selectedDistributor?.email || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{selectedDistributor?.contact_mobile || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>
                  {[selectedDistributor?.city, selectedDistributor?.state].filter(Boolean).join(', ') || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]}
                onPress={() => setSelectedDistributor(null)}
              >
                <Feather name="phone" size={18} color="#fff" />
                <Text style={styles.actionText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#F5F3FF' }]}
                onPress={() => setSelectedDistributor(null)}
              >
                <Feather name="message-square" size={18} color="#7C3AED" />
                <Text style={[styles.actionText, { color: '#7C3AED' }]}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  logoutBtn: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 12 },
  content: { padding: 20, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  statTitle: { fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 16, marginBottom: 12, gap: 10, elevation: 2 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 16, marginBottom: 24, gap: 10, borderWidth: 1, borderColor: '#DDD6FE' },
  secondaryButtonText: { color: '#7C3AED', fontSize: 16, fontWeight: '700' },
  sectionHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  distIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  listItemSubtitle: { fontSize: 13, color: '#6B7280' },
  noDistributor: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  noDistributorText: { textAlign: 'center', color: '#9CA3AF', fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  detailContainer: { gap: 16, marginBottom: 24 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 12 },
  detailLabel: { fontSize: 14, color: '#6B7280', width: 120 },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'right' },
  modalActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});