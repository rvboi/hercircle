import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface StockItem {
  id: string;
  name: string;
  sku?: string;
  quantity: number; // Renamed from qty
  moq?: number; // mapped from min_order_quantity
  distributor_id: string;
  products?: {
    name: string;
    sku: string;
    image_url?: string;
    description?: string;
  };
}

export default function DistributorStock() {
  const router = useRouter();
  const { auth } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [form, setForm] = useState({ quantity: '0', moq: '0', sku: '' });

  useFocusEffect(
    useCallback(() => {
      fetchStock();
    }, [])
  );

  const fetchStock = async () => {
    try {
      // Don't set loading to true on every focus to avoid flicker,
      // or maybe just for the first time?
      // If we want "real time" feeling, silent update is better if data exists.
      // But for now, let's keep it simple.
      // setLoading(true);
      const { data, error } = await supabase
        .from('distributor_stock')
        .select(`
          *,
          products (
            name,
            sku,
            image_url,
            description
          )
        `)
        .eq('distributor_id', auth?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map min_order_quantity to moq if needed
      const mappedData = (data || []).map((item: any) => ({
        ...item,
        moq: item.min_order_quantity || item.moq || 0
      }));

      setItems(mappedData);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch stock items.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(i =>
      (i.products?.name || i.name).toLowerCase().includes(s) ||
      (i.products?.sku || i.sku || '').toLowerCase().includes(s)
    );
  }, [items, search]);

  const openEdit = (it: StockItem) => {
    setEditing(it);
    setForm({
      quantity: String(it.quantity || 0),
      moq: String(it.moq || 0),
      sku: it.sku || it.products?.sku || ''
    });
    setModalVisible(true);
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('distributor_stock')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setItems(items.filter(i => i.id !== id));
      setModalVisible(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to delete item.');
    }
  };

  const submit = async () => {
    if (!editing) return;

    const quantity = Math.max(0, parseInt(form.quantity || '0', 10) || 0);
    const moq = Math.max(0, parseInt(form.moq || '0', 10) || 0);
    const sku = form.sku.trim() || null;

    if (moq > quantity) {
      Alert.alert('Invalid MOQ', 'Minimum Order Quantity cannot be greater than available Quantity.');
      return;
    }

    try {
      const { error } = await supabase
        .from('distributor_stock')
        .update({
          quantity,
          min_order_quantity: moq,
          sku
        })
        .eq('id', editing.id);

      if (error) throw error;

      fetchStock();
      setModalVisible(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save item.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Stock</Text>
        <TouchableOpacity onPress={() => router.push('/distributor/add-stock')}>
          <Feather name="plus" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Feather name="search" size={18} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search stock items"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          renderItem={({ item }) => {
            const name = item.products?.name || item.name;
            // Prioritize local SKU (item.sku) over master SKU (item.products.sku)
            const sku = item.sku || item.products?.sku || '-';
            const img = item.products?.image_url;
            const desc = item.products?.description;
            const moq = item.moq || 0;
            const isMoqInvalid = moq > item.quantity;

            return (
              <TouchableOpacity style={styles.card} onPress={() => openEdit(item)}>
                {img ? (
                  <Image source={{ uri: img }} style={styles.cardImage} />
                ) : (
                  <View style={styles.placeholderImage}>
                    <Feather name="image" size={32} color="#9CA3AF" />
                  </View>
                )}

                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{name}</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Qty: {item.quantity}</Text>
                    </View>
                  </View>

                  <Text style={styles.sku}>SKU: {sku}</Text>

                  {desc && (
                    <Text style={styles.desc}>{desc}</Text>
                  )}

                  <View style={styles.footer}>
                    <View style={styles.moqContainer}>
                      <Text style={[styles.moqLabel, isMoqInvalid && styles.errorText]}>
                        MOQ: {moq}
                      </Text>
                      {isMoqInvalid && (
                        <Feather name="alert-circle" size={14} color="#EF4444" style={{ marginLeft: 4 }} />
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Stock</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>SKU</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="SKU"
                value={form.sku}
                onChangeText={v => setForm({ ...form, sku: v })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                keyboardType="number-pad"
                value={form.quantity}
                onChangeText={v => setForm({ ...form, quantity: v })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>MOQ</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                keyboardType="number-pad"
                value={form.moq}
                onChangeText={v => setForm({ ...form, moq: v })}
              />
            </View>

            <View style={styles.modalActions}>
              {editing && (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => {
                  Alert.alert('Delete Item', 'Are you sure?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => remove(editing.id) }
                  ]);
                }}>
                  <Feather name="trash-2" color="#EF4444" size={20} />
                  <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4F46E5', flex: 1 }]} onPress={submit}>
                <Text style={styles.actionText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', margin: 16, paddingHorizontal: 12 },
  searchInput: { flex: 1, height: 48, paddingHorizontal: 8, fontSize: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 4
  },
  cardImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
  },
  sku: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  desc: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 12,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  moqContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moqLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  errorText: {
    color: '#EF4444',
  },

  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  closeBtn: { padding: 4 },
  formGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  modalInput: { height: 48, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, fontSize: 16, backgroundColor: '#F9FAFB' },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  actionBtn: { height: 50, borderRadius: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});