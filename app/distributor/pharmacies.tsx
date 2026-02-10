import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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

export default function DistributorPharmacies() {
  const router = useRouter();
  const { auth } = useAuth();
  const [items, setItems] = useState<Pharmacy[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Pharmacy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth?.id) {
      fetchPharmacies();
    }
  }, [auth]);

  const fetchPharmacies = async () => {
    try {
      setLoading(true);

      // 1. Get Distributor Profile ID first
      const { data: profile } = await supabase
        .from('distributor_profiles')
        .select('id')
        .eq('user_id', auth?.id)
        .single();

      const realDistId = profile?.id;

      if (!realDistId) {
        console.warn('No distributor profile found for current user');
        setLoading(false);
        return;
      }

      // 2. Fetch pharmacies assigned to this distributor
      const { data, error } = await supabase
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
        .eq('distributor_id', realDistId);

      if (error) throw error;

      // Extract pharmacy objects from the result
      const pharmacyList = data?.map((item: any) => item.pharmacy).filter(Boolean) || [];
      setItems(pharmacyList);
    } catch (err) {
      console.error('Error fetching pharmacies:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((p) =>
      (p.trade_name || '').toLowerCase().includes(s) ||
      (p.business_legal_name || '').toLowerCase().includes(s) ||
      (p.contact_name || '').toLowerCase().includes(s) ||
      (p.city || '').toLowerCase().includes(s) ||
      (p.contact_mobile || '').toLowerCase().includes(s)
    );
  }, [items, search]);

  const Row = ({ item }: { item: Pharmacy }) => (
    <TouchableOpacity style={styles.row} onPress={() => setSelected(item)}>
      <View style={styles.iconContainer}>
        <Feather name="home" size={24} color={Colors.light.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.title}>{item.trade_name || item.business_legal_name || 'Unnamed Pharmacy'}</Text>
        <Text style={styles.subtitle}>
          {item.contact_name || 'No Contact'} · {item.city || '—'} · {item.contact_mobile || '—'}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={Colors.light.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color={Colors.light.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assigned Pharmacies</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchRow}>
        <Feather name="search" size={20} color={Colors.light.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, city or phone"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={48} color={Colors.light.textSecondary} />
              <Text style={styles.emptyText}>No pharmacies assigned yet.</Text>
            </View>
          }
          renderItem={({ item }) => <Row item={item} />}
        />
      )}

      {/* Details Modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pharmacy Details</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Feather name="x" size={24} color={Colors.light.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.detailContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Trade Name</Text>
                <Text style={styles.detailValue}>{selected?.trade_name || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Business Name</Text>
                <Text style={styles.detailValue}>{selected?.business_legal_name || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Contact Person</Text>
                <Text style={styles.detailValue}>{selected?.contact_name || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{selected?.email || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{selected?.contact_mobile || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>
                  {[selected?.city, selected?.state].filter(Boolean).join(', ') || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.light.primary }]}
                onPress={() => setSelected(null)}
              >
                <Feather name="phone" size={18} color="#fff" />
                <Text style={styles.actionText}>Call Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.light.primaryMuted }]}
                onPress={() => setSelected(null)}
              >
                <Feather name="mail" size={18} color="#fff" />
                <Text style={styles.actionText}>Email</Text>
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
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 16,
    height: 50,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  searchInput: { flex: 1, height: 50, marginLeft: 10, fontSize: 16, color: '#111827' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#6B7280' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#9CA3AF', marginTop: 16, fontSize: 16 },

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