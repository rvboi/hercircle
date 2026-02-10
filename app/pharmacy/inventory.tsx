import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import * as RN from 'react-native';

interface InventoryItem {
  id: string;
  pharmacy_id: string;
  product_id: string;
  stock_quantity: number;
  reorder_level: number;
  products: {
    name: string;
    sku: string;
  };
}

export default function InventoryScreen() {
  const { auth } = useAuth();
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({
    stock_quantity: '0',
    reorder_level: '10',
  });

  useEffect(() => {
    if (auth?.id) {
      fetchData();
    }
  }, [auth]);

  const fetchData = async () => {
    if (!auth?.id || auth.id === 'undefined') {
      console.warn('fetchData called without valid auth.id');
      return;
    }
    try {
      setLoading(true);
      const { data: invData, error: invError } = await supabase
        .from('pharmacy_inventory')
        .select(`
          *,
          products (
            name,
            sku,
            price
          )
        `)
        .eq('pharmacy_id', auth.id)
        .order('created_at', { ascending: false });

      if (invError) throw invError;
      setInventory(invData || []);
    } catch (e) {
      console.error(e);
      RN.Alert.alert('Error', 'Failed to fetch inventory data.');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setForm({
      stock_quantity: String(item.stock_quantity),
      reorder_level: String(item.reorder_level),
    });
    setModalVisible(true);
  };

  const remove = (id: string) => {
    RN.Alert.alert('Delete Item', 'Are you sure you want to remove this from your inventory?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase
              .from('pharmacy_inventory')
              .delete()
              .eq('id', id);
            if (error) throw error;
            setInventory(inventory.filter(p => p.id !== id));
          } catch (e) {
            console.error(e);
            RN.Alert.alert('Error', 'Failed to delete item.');
          }
        }
      }
    ]);
  };

  const submitEdit = async () => {
    if (!editing || !auth?.id) return;
    try {
      const payload = {
        stock_quantity: parseInt(form.stock_quantity) || 0,
        reorder_level: parseInt(form.reorder_level) || 0,
      };

      const { error } = await supabase
        .from('pharmacy_inventory')
        .update(payload)
        .eq('id', editing.id);

      if (error) throw error;
      fetchData();
      setModalVisible(false);
    } catch (e) {
      console.error(e);
      RN.Alert.alert('Error', 'Failed to update inventory item.');
    }
  };

  const Item = ({ item }: { item: InventoryItem }) => (
    <RN.View style={styles.item}>
      <RN.View style={{ flex: 1 }}>
        <RN.Text style={styles.itemName}>{item.products?.name || 'Unknown Product'}</RN.Text>
        <RN.Text style={styles.itemMeta}>SKU {item.products?.sku || '-'}</RN.Text>
        <RN.Text style={styles.itemMeta}>Cost: ₹{(item.products?.price || 0).toLocaleString()} · Stock: {item.stock_quantity} (Min: {item.reorder_level})</RN.Text>
        {item.stock_quantity <= item.reorder_level && (
          <RN.Text style={styles.lowStock}>Low Stock Alert!</RN.Text>
        )}
      </RN.View>
      <RN.TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
        <Ionicons name="create-outline" size={18} color="#111827" />
      </RN.TouchableOpacity>
      <RN.TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => remove(item.id)}>
        <Ionicons name="trash-outline" size={18} color="#DC2626" />
      </RN.TouchableOpacity>
    </RN.View>
  );

  return (
    <RN.SafeAreaView style={styles.container}>
      <RN.View style={styles.header}>
        <RN.Text style={styles.headerTitle}>Inventory Management</RN.Text>
        <RN.TouchableOpacity style={styles.addBtn} onPress={() => router.push('/pharmacy/add-inventory')}>
          <Ionicons name="add" size={20} color="#fff" />
          <RN.Text style={styles.addText}>Add Product</RN.Text>
        </RN.TouchableOpacity>
      </RN.View>

      {loading ? (
        <RN.ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 20 }} />
      ) : (
        <RN.FlatList
          data={inventory}
          keyExtractor={(i) => i.id}
          renderItem={Item}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={<RN.Text style={styles.emptyText}>No items in inventory.</RN.Text>}
          onRefresh={fetchData}
          refreshing={loading}
        />
      )}

      <RN.Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <RN.View style={styles.modalOverlay}>
          <RN.View style={styles.modalContent}>
            <RN.Text style={styles.modalTitle}>Edit Inventory</RN.Text>
            <RN.Text style={styles.editingName}>{editing?.products?.name}</RN.Text>

            <RN.Text style={styles.label}>Stock Quantity</RN.Text>
            <RN.TextInput style={styles.input} placeholder="Quantity" keyboardType="numeric" value={form.stock_quantity} onChangeText={(v) => setForm({ ...form, stock_quantity: v })} />

            <RN.Text style={styles.label}>Reorder Level</RN.Text>
            <RN.TextInput style={styles.input} placeholder="Reorder Level" keyboardType="numeric" value={form.reorder_level} onChangeText={(v) => setForm({ ...form, reorder_level: v })} />

            <RN.View style={styles.modalActions}>
              <RN.TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <RN.Text style={styles.cancelText}>Cancel</RN.Text>
              </RN.TouchableOpacity>
              <RN.TouchableOpacity style={styles.saveBtn} onPress={submitEdit}>
                <RN.Text style={styles.saveText}>Update</RN.Text>
              </RN.TouchableOpacity>
            </RN.View>
          </RN.View>
        </RN.View>
      </RN.Modal>
    </RN.SafeAreaView>
  );
}

const styles = RN.StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7C3AED', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  addText: { color: '#fff', fontWeight: '700' },
  item: { backgroundColor: '#fff', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  itemName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  itemMeta: { fontSize: 12, color: '#6B7280' },
  lowStock: { fontSize: 12, color: '#DC2626', fontWeight: '700', marginTop: 4 },
  iconBtn: { backgroundColor: '#EEF2FF', padding: 8, borderRadius: 8 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#6B7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  editingName: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#4B5563', marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, color: '#111827' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#F3F4F6' },
  cancelText: { color: '#374151', fontWeight: '700' },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#7C3AED' },
  saveText: { color: '#fff', fontWeight: '700' },
});