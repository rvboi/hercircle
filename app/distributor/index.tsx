import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface Pharmacy {
  id: string;
  business_legal_name?: string;
  trade_name?: string;
  contact_name?: string;
  email?: string;
  city?: string;
  state?: string;
  contact_mobile?: string;
}

export default function DistributorDashboard() {
  const { auth, logout } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    stockCount: 0,
    pendingOrders: 0,
    totalSales: 0,
  });
  const [assignedPharmacies, setAssignedPharmacies] = useState<Pharmacy[]>([]);
  const [distributorId, setDistributorId] = useState<string | null>(null);

  // Modal State
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);

  const fetchStats = async () => {
    if (!auth?.id) return;
    try {
      // 1. Get Distributor Profile ID first
      const { data: profile } = await supabase
        .from('distributor_profiles')
        .select('id')
        .eq('user_id', auth.id)
        .single();

      const realDistId = profile?.id;
      setDistributorId(realDistId);

      if (!realDistId) return;

      // 2. Stock Count
      const { count: stockCount } = await supabase
        .from('distributor_stock')
        .select('*', { count: 'exact', head: true })
        .eq('distributor_id', auth.id);

      // 3. Pending Orders (from Pharmacies)
      const { count: pendingOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('distributor_id', realDistId)
        .eq('status', 'pending');

      // 4. Total Sales (Completed Orders)
      const { data: salesData } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('distributor_id', realDistId)
        .neq('status', 'cancelled');

      const totalSales = (salesData || []).reduce((sum, order) => sum + (order.total_amount || 0), 0);

      setStats({
        stockCount: stockCount || 0,
        pendingOrders: pendingOrders || 0,
        totalSales: totalSales || 0,
      });

      // 5. Fetch Assigned Pharmacies
      const { data: pharmData } = await supabase
        .from('pharmacy_distributors')
        .select(`
          pharmacy:pharmacy_profiles (
            id,
            business_legal_name,
            trade_name,
            contact_name,
            email,
            city,
            state,
            contact_mobile
          )
        `)
        .eq('distributor_id', realDistId)
        .limit(5);

      const list = pharmData?.map((p: any) => p.pharmacy).filter(Boolean) || [];
      setAssignedPharmacies(list);

    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [auth])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Welcome back,</Text>
          <Text style={styles.headerTitle}>Distributor Hub</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Feather name="log-out" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#E0E7FF' }]}>
              <Feather name="dollar-sign" size={20} color="#4F46E5" />
            </View>
            <View>
              <Text style={styles.statValue}>${stats.totalSales.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Sales</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
              <Feather name="clock" size={20} color="#D97706" />
            </View>
            <View>
              <Text style={styles.statValue}>{stats.pendingOrders}</Text>
              <Text style={styles.statLabel}>Pending Orders</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
              <Feather name="package" size={20} color="#059669" />
            </View>
            <View>
              <Text style={styles.statValue}>{stats.stockCount}</Text>
              <Text style={styles.statLabel}>Stock Items</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions Grid */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          {/* Catalogue */}
          <TouchableOpacity style={styles.card} onPress={() => router.push('/distributor/catalogue')}>
            <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.cardGradient}>
              <View style={styles.iconCircle}>
                <Feather name="book-open" size={24} color="#7C3AED" />
              </View>
              <Text style={styles.cardTitle}>Catalogue</Text>
              <Text style={styles.cardDesc}>Browse Master List</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Cart */}
          <TouchableOpacity style={styles.card} onPress={() => router.push('/distributor/cart')}>
            <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.cardGradient}>
              <View style={styles.iconCircle}>
                <Feather name="shopping-cart" size={24} color="#D97706" />
              </View>
              <Text style={styles.cardTitle}>My Cart</Text>
              <Text style={styles.cardDesc}>View Cart Items</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Pharmacy Orders */}
          <TouchableOpacity style={styles.card} onPress={() => router.push('/distributor/orders')}>
            <LinearGradient colors={['#10B981', '#059669']} style={styles.cardGradient}>
              <View style={styles.iconCircle}>
                <Feather name="clipboard" size={24} color="#059669" />
              </View>
              <Text style={styles.cardTitle}>Orders</Text>
              <Text style={styles.cardDesc}>From Pharmacies</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Pharmacies */}
          <TouchableOpacity style={styles.card} onPress={() => router.push('/distributor/pharmacies')}>
            <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.cardGradient}>
              <View style={styles.iconCircle}>
                <Feather name="users" size={24} color="#2563EB" />
              </View>
              <Text style={styles.cardTitle}>Pharmacies</Text>
              <Text style={styles.cardDesc}>Manage Clients</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Assigned Pharmacies Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assigned Pharmacies</Text>
            <TouchableOpacity onPress={() => router.push('/distributor/pharmacies')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {assignedPharmacies.length > 0 ? (
            <View style={{ gap: 12 }}>
              {assignedPharmacies.map((pharm) => (
                <TouchableOpacity
                  key={pharm.id}
                  style={styles.pharmacyCard}
                  onPress={() => setSelectedPharmacy(pharm)}
                >
                  <View style={styles.pharmacyIcon}>
                    <Feather name="home" size={20} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pharmacyName}>
                      {pharm.trade_name || pharm.business_legal_name || 'Unnamed Pharmacy'}
                    </Text>
                    <Text style={styles.pharmacyLoc}>
                      {[pharm.city, pharm.state].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="users" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No pharmacies assigned yet.</Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Pharmacy Details Modal */}
      <Modal
        visible={!!selectedPharmacy}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPharmacy(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pharmacy Details</Text>
              <TouchableOpacity onPress={() => setSelectedPharmacy(null)}>
                <Feather name="x" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.detailContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Trade Name</Text>
                <Text style={styles.detailValue}>{selectedPharmacy?.trade_name || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Business Name</Text>
                <Text style={styles.detailValue}>{selectedPharmacy?.business_legal_name || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Contact Person</Text>
                <Text style={styles.detailValue}>{selectedPharmacy?.contact_name || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{selectedPharmacy?.email || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{selectedPharmacy?.contact_mobile || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>
                  {[selectedPharmacy?.city, selectedPharmacy?.state].filter(Boolean).join(', ') || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]}
                onPress={() => setSelectedPharmacy(null)}
              >
                <Feather name="phone" size={18} color="#fff" />
                <Text style={styles.actionText}>Call Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#F5F3FF' }]}
                onPress={() => setSelectedPharmacy(null)}
              >
                <Feather name="mail" size={18} color="#7C3AED" />
                <Text style={[styles.actionText, { color: '#7C3AED' }]}>Email</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  logoutBtn: {
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    alignItems: 'center',
    gap: 8,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    width: '47%',
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  cardDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  section: {
    marginTop: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAll: {
    color: '#059669',
    fontWeight: '600',
  },
  pharmacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  pharmacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pharmacyName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  pharmacyLoc: {
    fontSize: 13,
    color: '#6B7280',
  },
  emptyState: { alignItems: 'center', padding: 24 },
  emptyText: { color: '#9CA3AF', marginTop: 12 },

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
