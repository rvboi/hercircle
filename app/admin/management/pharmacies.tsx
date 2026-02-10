import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface Pharmacy {
  id: string;
  user_id: string;
  business_legal_name: string;
  trade_name: string;
  drug_license?: string;
  contact_name: string;
  contact_designation?: string;
  contact_mobile?: string;
  city?: string;
  state?: string;
  status: string;
  email: string;
  distributor_id?: string;
  created_at: string;
}

export default function ManagePharmaciesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Pharmacy | null>(null);

  const [form, setForm] = useState({
    business_legal_name: '',
    trade_name: '',
    drug_license: '',
    contact_name: '',
    contact_designation: '',
    contact_mobile: '',
    city: '',
    state: '',
    status: 'pending'
  });

  useEffect(() => {
    fetchPharmacies();
  }, []);

  const fetchPharmacies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pharmacy_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch pharmacies.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(i =>
      (i.business_legal_name || '').toLowerCase().includes(s) ||
      (i.trade_name || '').toLowerCase().includes(s) ||
      (i.contact_name || '').toLowerCase().includes(s) ||
      (i.email || '').toLowerCase().includes(s) ||
      (i.city || '').toLowerCase().includes(s)
    );
  }, [items, search]);

  const openEdit = (it: Pharmacy) => {
    setEditing(it);
    setForm({
      business_legal_name: it.business_legal_name || '',
      trade_name: it.trade_name || '',
      drug_license: it.drug_license || '',
      contact_name: it.contact_name || '',
      contact_designation: it.contact_designation || '',
      contact_mobile: it.contact_mobile || '',
      city: it.city || '',
      state: it.state || '',
      status: it.status
    });
    setModalVisible(true);
  };

  const removePharmacy = async (id: string) => {
    Alert.alert(
      'Remove Pharmacy',
      'Are you sure you want to remove this pharmacy? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { error } = await supabase
                .from('pharmacy_profiles')
                .delete()
                .eq('id', id);

              if (error) throw error;

              setItems(items.filter(i => i.id !== id));
              setModalVisible(false);
              Alert.alert('Success', 'Pharmacy removed successfully.');
            } catch (e: any) {
              console.error(e);
              Alert.alert('Error', e.message || 'Failed to remove pharmacy.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const submit = async () => {
    if (!editing) return;
    try {
      const { error } = await supabase
        .from('pharmacy_profiles')
        .update({
          business_legal_name: form.business_legal_name.trim(),
          trade_name: form.trade_name.trim(),
          drug_license: form.drug_license.trim(),
          contact_name: form.contact_name.trim(),
          contact_designation: form.contact_designation.trim(),
          contact_mobile: form.contact_mobile.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          status: form.status
        })
        .eq('id', editing.id);

      if (error) throw error;
      fetchPharmacies();
      setModalVisible(false);
      Alert.alert('Success', 'Pharmacy updated successfully.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update pharmacy.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Pharmacies</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <Feather name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email or license..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading pharmacies...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openEdit(item)}>
              <View style={styles.cardContent}>
                <View style={styles.avatarContainer}>
                  <View style={[styles.avatar, { backgroundColor: item.status === 'approved' ? '#D1FAE5' : '#FFFBEB' }]}>
                    <Text style={[styles.avatarText, { color: item.status === 'approved' ? '#10B981' : '#D97706' }]}>
                      {(item.trade_name || item.business_legal_name || item.email)[0].toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoContainer}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.name} numberOfLines={1}>{item.trade_name || item.business_legal_name || 'Unnamed'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: item.status === 'approved' ? '#ECFDF5' : '#FFFBEB' }]}>
                      <Text style={[styles.statusText, { color: item.status === 'approved' ? '#10B981' : '#D97706' }]}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.email}>{item.email}</Text>
                  <View style={styles.metaRow}>
                    <Feather name="file-text" size={12} color="#9CA3AF" />
                    <Text style={styles.metaText}>License: {item.drug_license || 'N/A'}</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color="#D1D5DB" />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="plus-square" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No pharmacies found</Text>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pharmacy Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Business Information</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Trade Name (Store Name)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.trade_name}
                    onChangeText={v => setForm({ ...form, trade_name: v })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Business Legal Name</Text>
                  <TextInput
                    style={styles.input}
                    value={form.business_legal_name}
                    onChangeText={v => setForm({ ...form, business_legal_name: v })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Drug License Number</Text>
                  <TextInput
                    style={styles.input}
                    value={form.drug_license}
                    onChangeText={v => setForm({ ...form, drug_license: v })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email (Read-only)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: '#F3F4F6', color: '#6B7280' }]}
                    value={editing?.email}
                    editable={false}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact Person</Text>
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={form.contact_name}
                      onChangeText={v => setForm({ ...form, contact_name: v })}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Designation</Text>
                    <TextInput
                      style={styles.input}
                      value={form.contact_designation}
                      onChangeText={v => setForm({ ...form, contact_designation: v })}
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  <TextInput
                    style={styles.input}
                    value={form.contact_mobile}
                    keyboardType="phone-pad"
                    onChangeText={v => setForm({ ...form, contact_mobile: v })}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Location Details</Text>
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>City</Text>
                    <TextInput
                      style={styles.input}
                      value={form.city}
                      onChangeText={v => setForm({ ...form, city: v })}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>State</Text>
                    <TextInput
                      style={styles.input}
                      value={form.state}
                      onChangeText={v => setForm({ ...form, state: v })}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Status</Text>
                <View style={styles.statusRow}>
                  {['pending', 'approved', 'rejected'].map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.statusBtn, form.status === s && styles.statusBtnActive]}
                      onPress={() => setForm({ ...form, status: s })}
                    >
                      <Text style={[styles.statusBtnText, form.status === s && styles.statusBtnTextActive]}>
                        {s.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => editing && removePharmacy(editing.id)}
              >
                <Feather name="trash-2" size={18} color="#EF4444" />
                <Text style={styles.removeBtnText}>Remove Pharmacy</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={submit}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  searchContainer: { padding: 16, backgroundColor: '#fff' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#1F2937' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6B7280', fontWeight: '600' },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardContent: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  avatarContainer: { marginRight: 16 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  infoContainer: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  email: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#9CA3AF' },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { marginTop: 12, color: '#9CA3AF', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  modalBody: { padding: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#10B981', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 0.5 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    fontSize: 15,
    color: '#111827',
  },
  row: { flexDirection: 'row', gap: 12 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  statusBtnActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  statusBtnText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  statusBtnTextActive: { color: '#fff' },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    marginTop: 8,
  },
  removeBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  saveBtn: {
    flex: 2,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});