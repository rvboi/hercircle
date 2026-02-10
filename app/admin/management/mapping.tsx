import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// SQL REQUIRED:
// create table if not exists public.pharmacy_distributors (
//   pharmacy_id uuid references public.pharmacy_profiles(id) on delete cascade,
//   distributor_id uuid references public.distributor_profiles(id) on delete cascade,
//   primary key (pharmacy_id, distributor_id)
// );

interface Pharmacy {
  id: string;
  trade_name?: string;
  business_legal_name?: string;
  city?: string;
  state?: string;
  contact_mobile?: string;
}

interface Distributor {
  id: string;
  display_name?: string;
  contact_name?: string;
  city?: string;
  state?: string;
  contact_mobile?: string;
}

interface Mapping {
  pharmacy_id: string;
  distributor_id: string;
}

export default function MappingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [tempSelectedDistributors, setTempSelectedDistributors] = useState<Set<string>>(new Set());
  const [modalSearch, setModalSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [pharmResult, distResult, mapResult] = await Promise.all([
        supabase.from('pharmacy_profiles').select('id, trade_name, business_legal_name, city, state, contact_mobile').eq('status', 'approved'),
        supabase.from('distributor_profiles').select('id, display_name, contact_name, city, state, contact_mobile').eq('status', 'approved'),
        supabase.from('pharmacy_distributors').select('*'),
      ]);

      if (pharmResult.error) throw pharmResult.error;
      if (distResult.error) throw distResult.error;
      // If map table doesn't exist, this might error. We'll handle it gracefully by assuming empty.
      const fetchedMappings = mapResult.data || [];

      setPharmacies(pharmResult.data || []);
      setDistributors(distResult.data || []);
      setMappings(fetchedMappings);
    } catch (error) {
      console.error('Error fetching mapping data:', error);
      Alert.alert('Error', 'Failed to load data. Ensure database schema is up to date.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Pharmacies
  const filteredPharmacies = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return pharmacies.filter(p =>
      (p.trade_name || '').toLowerCase().includes(q) ||
      (p.business_legal_name || '').toLowerCase().includes(q) ||
      (p.city || '').toLowerCase().includes(q)
    );
  }, [pharmacies, searchQuery]);

  // Compute Counts
  const getDistributorCount = (pharmacyId: string) => {
    return mappings.filter(m => m.pharmacy_id === pharmacyId).length;
  };

  // Modal Logic
  const openMappingModal = (pharmacy: Pharmacy) => {
    setSelectedPharmacy(pharmacy);
    const assignedDistIds = mappings
      .filter(m => m.pharmacy_id === pharmacy.id)
      .map(m => m.distributor_id);
    setTempSelectedDistributors(new Set(assignedDistIds));
    setModalSearch('');
    setModalVisible(true);
  };

  const toggleDistributor = (distId: string) => {
    const newSet = new Set(tempSelectedDistributors);
    if (newSet.has(distId)) {
      newSet.delete(distId);
    } else {
      if (newSet.size >= 5) {
        Alert.alert('Limit Reached', 'You can assign a maximum of 5 distributors to a single pharmacy.');
        return;
      }
      newSet.add(distId);
    }
    setTempSelectedDistributors(newSet);
  };

  const saveMapping = async () => {
    if (!selectedPharmacy) return;
    try {
      setSaving(true);
      const pharmacyId = selectedPharmacy.id;
      const currentAssigned = mappings
        .filter(m => m.pharmacy_id === pharmacyId)
        .map(m => m.distributor_id);

      const newAssigned = Array.from(tempSelectedDistributors);

      const toAdd = newAssigned.filter(id => !currentAssigned.includes(id));
      const toRemove = currentAssigned.filter(id => !newAssigned.includes(id));

      // Perform updates
      if (toRemove.length > 0) {
        await supabase
          .from('pharmacy_distributors')
          .delete()
          .eq('pharmacy_id', pharmacyId)
          .in('distributor_id', toRemove);
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map(distId => ({
          pharmacy_id: pharmacyId,
          distributor_id: distId,
        }));
        await supabase.from('pharmacy_distributors').insert(rows);
      }

      // Refresh local state
      await fetchData();
      setModalVisible(false);
      Alert.alert('Success', 'Mappings updated successfully.');
    } catch (error) {
      console.error('Error saving mapping:', error);
      Alert.alert('Error', 'Failed to save mappings.');
    } finally {
      setSaving(false);
    }
  };

  // Filter Distributors in Modal
  const filteredDistributors = useMemo(() => {
    const q = modalSearch.toLowerCase();
    return distributors.filter(d =>
      (d.display_name || '').toLowerCase().includes(q) ||
      (d.contact_name || '').toLowerCase().includes(q) ||
      (d.city || '').toLowerCase().includes(q)
    );
  }, [distributors, modalSearch]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading Data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#EC4899', '#DB2777']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Network Mapping</Text>
            <Text style={styles.headerSubtitle}>Assign Distributors to Pharmacies</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search pharmacies..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9CA3AF"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <FlatList
        data={filteredPharmacies}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const count = getDistributorCount(item.id);
          const isFull = count >= 5;
          return (
            <TouchableOpacity style={styles.card} onPress={() => openMappingModal(item)}>
              <View style={styles.cardLeft}>
                <View style={[styles.countBadge, isFull ? styles.bgRed : (count > 0 ? styles.bgGreen : styles.bgGray)]}>
                  <Text style={[styles.countText, isFull ? styles.textRed : (count > 0 ? styles.textGreen : styles.textGray)]}>
                    {count}/5
                  </Text>
                </View>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.trade_name || item.business_legal_name || 'Unnamed Pharmacy'}</Text>
                <Text style={styles.cardSubtitle}>
                  {[item.city, item.state].filter(Boolean).join(', ') || 'No location'}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="inbox" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No approved pharmacies found</Text>
          </View>
        }
      />

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Assign Distributors</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedPharmacy?.trade_name || 'Selected Pharmacy'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* Modal Search */}
            <View style={styles.modalSearchContainer}>
              <Feather name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search distributors..."
                value={modalSearch}
                onChangeText={setModalSearch}
              />
            </View>

            <View style={styles.limitInfo}>
              <Text style={styles.limitText}>
                Selected: <Text style={{ fontWeight: '700' }}>{tempSelectedDistributors.size}</Text>/5
              </Text>
            </View>

            <FlatList
              data={filteredDistributors}
              keyExtractor={item => item.id}
              style={styles.modalList}
              renderItem={({ item }) => {
                const isSelected = tempSelectedDistributors.has(item.id);
                const isDisabled = !isSelected && tempSelectedDistributors.size >= 5;

                return (
                  <TouchableOpacity
                    style={[styles.distItem, isSelected && styles.distItemSelected, isDisabled && styles.distItemDisabled]}
                    onPress={() => toggleDistributor(item.id)}
                    disabled={isDisabled}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Feather name="check" size={14} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.distName, isSelected && styles.textSelected, isDisabled && styles.textDisabled]}>
                        {item.display_name || item.contact_name}
                      </Text>
                      <Text style={styles.distLocation}>
                        {[item.city, item.state].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No approved distributors found</Text>
                </View>
              }
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={saveMapping}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="save" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
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
  loadingText: { marginTop: 12, color: '#6B7280' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginTop: 2 },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 20, paddingHorizontal: 16, height: 48, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, color: '#111827' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  cardLeft: { marginRight: 16 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  bgGreen: { backgroundColor: '#D1FAE5' },
  bgRed: { backgroundColor: '#FEE2E2' },
  bgGray: { backgroundColor: '#F3F4F6' },
  countText: { fontSize: 12, fontWeight: '800' },
  textGreen: { color: '#10B981' },
  textRed: { color: '#EF4444' },
  textGray: { color: '#6B7280' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  cardSubtitle: { fontSize: 13, color: '#6B7280' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#9CA3AF', marginTop: 12 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%' },
  modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  modalSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', margin: 16, paddingHorizontal: 12, height: 44, borderRadius: 10 },
  modalSearchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#111827' },

  limitInfo: { paddingHorizontal: 20, paddingBottom: 12 },
  limitText: { fontSize: 13, color: '#6B7280' },

  modalList: { flex: 1 },
  distItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  distItemSelected: { backgroundColor: '#F0FDF4' },
  distItemDisabled: { opacity: 0.5 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkboxSelected: { backgroundColor: '#10B981', borderColor: '#10B981' },
  distName: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 2 },
  distLocation: { fontSize: 12, color: '#9CA3AF' },
  textSelected: { color: '#000' },
  textDisabled: { color: '#9CA3AF' },

  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  saveBtn: { backgroundColor: '#DB2777', paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
