import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  moq: number;
  distributor_price: number;
  price: number;
  sku?: string;
  created_at?: string;
}

// Simple atob polyfill for React Native if not present
if (typeof atob === 'undefined') {
  global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

export default function ManageProductsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [choiceModalVisible, setChoiceModalVisible] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    image_url: '',
    moq: '1',
    distributor_price: '0',
    price: '0',
    sku: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch products.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(i =>
      i.name.toLowerCase().includes(s) ||
      (i.sku || '').toLowerCase().includes(s) ||
      (i.description || '').toLowerCase().includes(s)
    );
  }, [items, search]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      uploadProductImage(result.assets[0].uri);
    }
  };

  const uploadProductImage = async (uri: string) => {
    try {
      setUploading(true);
      const fileName = `product_${Date.now()}.jpg`;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const filePath = `products/${fileName}`;

      // Convert base64 to ArrayBuffer
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;

      const { data, error } = await supabase.storage
        .from('hercircle_assets')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('hercircle_assets')
        .getPublicUrl(filePath);

      setForm({ ...form, image_url: publicUrl });
      Alert.alert('Success', 'Image uploaded successfully');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Upload Failed', 'Make sure the "hercircle_assets" bucket exists in Supabase Storage and is set to Public.');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const template = [
        ['name', 'description', 'image_url', 'moq', 'distributor_price', 'price', 'sku'],
        ['Sample Product', 'Product description here', 'https://example.com/image.jpg', '10', '100.00', '150.00', 'SKU001']
      ];

      const ws = XLSX.utils.aoa_to_sheet(template);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'csv' });

      const fileUri = FileSystem.documentDirectory + 'product_template.csv';
      await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });

      const isSharingAvailable = await require('expo-sharing').isAvailableAsync();
      if (isSharingAvailable) {
        await require('expo-sharing').shareAsync(fileUri);
      } else {
        Alert.alert('Success', 'Template saved to: ' + fileUri);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to generate template');
    }
  };

  const handleCSVUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      });

      if (result.canceled) return;

      setLoading(true);
      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });

      const workbook = XLSX.read(fileContent, { type: 'base64' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      if (data.length === 0) {
        Alert.alert('Error', 'CSV file is empty');
        return;
      }

      // Map CSV data to product payload
      const productsToInsert = data.map((row: any) => ({
        name: row.name || row.Name,
        description: row.description || row.Description || null,
        image_url: row.image_url || row.ImageUrl || null,
        moq: parseInt(row.moq || row.MOQ) || 1,
        distributor_price: parseFloat(row.distributor_price || row.DistributorPrice) || 0,
        price: parseFloat(row.price || row.Price) || 0,
        sku: row.sku || row.SKU || null,
      }));

      const { error } = await supabase.from('products').insert(productsToInsert);

      if (error) throw error;

      Alert.alert('Success', `${productsToInsert.length} products imported successfully`);
      fetchProducts();
      setChoiceModalVisible(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to process CSV. Ensure headers match: name, description, image_url, moq, distributor_price, price, sku');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      description: '',
      image_url: '',
      moq: '1',
      distributor_price: '0',
      price: '0',
      sku: '',
    });
    setChoiceModalVisible(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || '',
      image_url: p.image_url || '',
      moq: String(p.moq),
      distributor_price: String(p.distributor_price),
      price: String(p.price || 0),
      sku: p.sku || '',
    });
    setModalVisible(true);
  };

  const remove = async (id: string) => {
    Alert.alert('Delete Product', 'Are you sure? This will delete all order history, cart items, and inventory related to this product.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Everything',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);

            // Delete from all tables referencing this product
            await Promise.all([
              supabase.from('distributor_admin_order_items').delete().eq('product_id', id),
              supabase.from('distributor_cart_items').delete().eq('product_id', id),
              supabase.from('pharmacy_inventory').delete().eq('product_id', id),
            ]);

            // Now delete the product
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;

            setItems(items.filter(i => i.id !== id));
            Alert.alert('Success', 'Product and related records deleted.');
          } catch (e: any) {
            console.error(e);
            Alert.alert('Error', e.message || 'Failed to delete product.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Name is required.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      moq: parseInt(form.moq) || 1,
      distributor_price: parseFloat(form.distributor_price) || 0,
      price: parseFloat(form.price) || 0,
      sku: form.sku.trim() || null,
    };

    try {
      if (editing) {
        const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
      }
      fetchProducts();
      setModalVisible(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save product.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Management</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <Feather name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, SKU or description..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Processing...</Text>
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
                <View style={styles.imageContainer}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.productImage} />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <Feather name="box" size={24} color="#D1D5DB" />
                    </View>
                  )}
                </View>
                <View style={styles.infoContainer}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.skuBadge}>
                      <Text style={styles.skuText}>{item.sku || 'NO SKU'}</Text>
                    </View>
                  </View>

                  <Text style={styles.description} numberOfLines={2}>
                    {item.description || 'No description provided.'}
                  </Text>

                  <View style={styles.priceRow}>
                    <View style={styles.priceItem}>
                      <Text style={styles.priceLabel}>Distributor</Text>
                      <Text style={styles.distPrice}>₹{(item.distributor_price || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.priceItem}>
                      <Text style={styles.priceLabel}>Retail (MSRP)</Text>
                      <Text style={styles.retailPrice}>₹{(item.price || 0).toLocaleString()}</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.moqBadge}>
                      <Feather name="layers" size={12} color="#4F46E5" />
                      <Text style={styles.moqBadgeText}>MOQ: {item.moq}</Text>
                    </View>
                    <TouchableOpacity onPress={() => remove(item.id)}>
                      <Feather name="trash-2" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="package" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
        />
      )}

      {/* Choice Modal */}
      <Modal visible={choiceModalVisible} transparent animationType="fade" onRequestClose={() => setChoiceModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setChoiceModalVisible(false)}>
          <View style={styles.choiceCard}>
            <Text style={styles.choiceTitle}>Add Product</Text>
            <TouchableOpacity
              style={styles.choiceBtn}
              onPress={() => {
                setChoiceModalVisible(false);
                setModalVisible(true);
              }}>
              <View style={[styles.choiceIcon, { backgroundColor: '#EEF2FF' }]}>
                <Feather name="edit-3" size={20} color="#4F46E5" />
              </View>
              <View>
                <Text style={styles.choiceBtnText}>Manual Entry</Text>
                <Text style={styles.choiceSubtext}>Fill form and upload photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.choiceBtn} onPress={handleCSVUpload}>
              <View style={[styles.choiceIcon, { backgroundColor: '#ECFDF5' }]}>
                <Feather name="file-text" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.choiceBtnText}>Bulk Upload (CSV)</Text>
                <Text style={styles.choiceSubtext}>Import from Excel or CSV</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.choiceBtn, { borderStyle: 'dashed', backgroundColor: '#fff' }]} onPress={downloadTemplate}>
              <View style={[styles.choiceIcon, { backgroundColor: '#F3F4F6' }]}>
                <Feather name="download" size={20} color="#6B7280" />
              </View>
              <View>
                <Text style={styles.choiceBtnText}>Download Template</Text>
                <Text style={styles.choiceSubtext}>Get the correct CSV format</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Manual Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Product' : 'Manual Add'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Image Picker Section */}
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                {form.image_url ? (
                  <Image source={{ uri: form.image_url }} style={styles.pickedImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    {uploading ? (
                      <ActivityIndicator color="#4F46E5" />
                    ) : (
                      <>
                        <Feather name="camera" size={32} color="#9CA3AF" />
                        <Text style={styles.imagePlaceholderText}>Upload Product Photo</Text>
                      </>
                    )}
                  </View>
                )}
                {form.image_url && (
                  <View style={styles.editImageBadge}>
                    <Feather name="edit-2" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Paracetamol 500mg"
                  value={form.name}
                  onChangeText={v => setForm({ ...form, name: v })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>SKU / Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. PARA-500-10"
                  value={form.sku}
                  onChangeText={v => setForm({ ...form, sku: v })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
                  placeholder="Enter product details..."
                  multiline
                  value={form.description}
                  onChangeText={v => setForm({ ...form, description: v })}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Distributor Price (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={form.distributor_price}
                    onChangeText={v => setForm({ ...form, distributor_price: v })}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Retail Price (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={form.price}
                    onChangeText={v => setForm({ ...form, price: v })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Minimum Order Quantity (MOQ)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  keyboardType="number-pad"
                  value={form.moq}
                  onChangeText={v => setForm({ ...form, moq: v })}
                />
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={submit} disabled={uploading}>
                <Text style={styles.saveBtnText}>{editing ? 'Update Product' : 'Create Product'}</Text>
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
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
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardContent: { flexDirection: 'row', padding: 12 },
  imageContainer: {
    width: 100,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  infoContainer: { flex: 1, marginLeft: 16, justifyContent: 'space-between' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  skuBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  skuText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  description: { fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 18 },
  priceRow: { flexDirection: 'row', marginTop: 12, gap: 16 },
  priceItem: { flex: 1 },
  priceLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase' },
  distPrice: { fontSize: 15, fontWeight: '700', color: '#111827' },
  retailPrice: { fontSize: 15, fontWeight: '700', color: '#4F46E5' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  moqBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  moqBadgeText: { fontSize: 11, fontWeight: '700', color: '#4F46E5' },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { marginTop: 12, color: '#9CA3AF', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%' },
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
  imagePickerBtn: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  pickedImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { marginTop: 12, color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  editImageBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#4F46E5',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
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
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  choiceCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    marginBottom: 100, // Center it a bit more
  },
  choiceTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 16,
  },
  choiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBtnText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  choiceSubtext: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});