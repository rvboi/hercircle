import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import * as XLSX from 'xlsx';

type Flow = 'select' | 'manual' | 'bulk' | 'review';

interface NewInventoryItem {
    product_name: string;
    sku: string;
    stock_quantity: number;
    reorder_level: number;
    product_id?: string; // Found after searching
}

export default function AddInventoryScreen() {
    const { auth } = useAuth();
    const [flow, setFlow] = useState<Flow>('select');
    const [loading, setLoading] = useState(false);
    const [manualForm, setManualForm] = useState({
        product_name: '',
        sku: '',
        stock_quantity: '',
        reorder_level: '10',
    });
    const [reviewItems, setReviewItems] = useState<NewInventoryItem[]>([]);

    // --- Excel Template ---
    const downloadTemplate = async () => {
        const data = [
            ['product_name', 'sku', 'stock_quantity', 'reorder_level'],
            ['Paracetamol 500mg', 'PARA500', 100, 20],
            ['Amoxicillin 250mg', 'AMOX250', 50, 10]
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventory");
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const fileUri = FileSystem.cacheDirectory + 'inventory_template.xlsx';
        try {
            await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
            } else {
                Alert.alert('Error', 'Sharing is not available on this device');
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to generate template');
        }
    };

    // --- Bulk Upload ---
    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'text/csv',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel'
                ],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const fileUri = result.assets[0].uri;
            const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
            const workbook = XLSX.read(base64, { type: 'base64' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const data = XLSX.utils.sheet_to_json(worksheet) as any[];

            const items: NewInventoryItem[] = data.map(row => ({
                product_name: row.product_name || '',
                sku: row.sku || '',
                stock_quantity: parseInt(row.stock_quantity) || 0,
                reorder_level: parseInt(row.reorder_level) || 0,
            })).filter(i => i.product_name || i.sku);

            if (items.length === 0) {
                Alert.alert('Error', 'No valid items found in the file');
                return;
            }

            setReviewItems(items);
            setFlow('review');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to pick or read file');
        }
    };

    // --- Manual Flow ---
    const handleManualSubmit = () => {
        if (!manualForm.product_name && !manualForm.sku) {
            Alert.alert('Error', 'Please provide at least a Product Name or SKU');
            return;
        }
        const item: NewInventoryItem = {
            product_name: manualForm.product_name,
            sku: manualForm.sku,
            stock_quantity: parseInt(manualForm.stock_quantity) || 0,
            reorder_level: parseInt(manualForm.reorder_level) || 0,
        };
        setReviewItems([item]);
        setFlow('review');
    };

    // --- Final Save ---
    const saveInventory = async () => {
        if (!auth?.id) return;
        setLoading(true);
        try {
            // For each item, we need to find the product_id from the products table
            // If not found, we might need to handle it (e.g. alert the user)
            const finalPayload = [];

            for (const item of reviewItems) {
                let query = supabase.from('products').select('id');
                if (item.sku) {
                    query = query.eq('sku', item.sku);
                } else {
                    query = query.ilike('name', item.product_name);
                }

                const { data: prodData } = await query.maybeSingle();

                if (prodData) {
                    finalPayload.push({
                        pharmacy_id: auth.id,
                        product_id: prodData.id,
                        stock_quantity: item.stock_quantity,
                        reorder_level: item.reorder_level,
                    });
                } else {
                    console.warn(`Product not found: ${item.product_name} / ${item.sku}`);
                }
            }

            if (finalPayload.length === 0) {
                Alert.alert('Error', 'None of the products were found in the master catalog. Please check names/SKUs.');
                setLoading(false);
                return;
            }

            const { error } = await supabase.from('pharmacy_inventory').insert(finalPayload);
            if (error) throw error;

            Alert.alert('Success', `Successfully added ${finalPayload.length} items to inventory.`);
            router.back();
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to save inventory');
        } finally {
            setLoading(false);
        }
    };

    // --- Renderers ---

    if (flow === 'select') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Add Inventory</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.selectionContent}>
                    <Text style={styles.selectionTitle}>How would you like to add stock?</Text>

                    <TouchableOpacity style={styles.selectionCard} onPress={() => setFlow('manual')}>
                        <View style={[styles.iconCircle, { backgroundColor: '#EDE9FE' }]}>
                            <Feather name="edit" size={24} color="#7C3AED" />
                        </View>
                        <View style={styles.cardText}>
                            <Text style={styles.cardTitle}>Manual Entry</Text>
                            <Text style={styles.cardDesc}>Add items one by one using a form</Text>
                        </View>
                        <Feather name="chevron-right" size={20} color="#9CA3AF" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.selectionCard} onPress={() => setFlow('bulk')}>
                        <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                            <Feather name="file-text" size={24} color="#0EA5E9" />
                        </View>
                        <View style={styles.cardText}>
                            <Text style={styles.cardTitle}>Bulk Upload (Excel/CSV)</Text>
                            <Text style={styles.cardDesc}>Upload an Excel or CSV file for multiple items</Text>
                        </View>
                        <Feather name="chevron-right" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (flow === 'manual') {
        return (
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => setFlow('select')}>
                            <Ionicons name="arrow-back" size={24} color="#111827" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Manual Entry</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    <ScrollView contentContainerStyle={styles.formScroll}>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Product Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Paracetamol 500mg"
                                value={manualForm.product_name}
                                onChangeText={v => setManualForm({ ...manualForm, product_name: v })}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>SKU (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. PARA500"
                                value={manualForm.sku}
                                onChangeText={v => setManualForm({ ...manualForm, sku: v })}
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Stock Quantity</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={manualForm.stock_quantity}
                                    onChangeText={v => setManualForm({ ...manualForm, stock_quantity: v })}
                                />
                            </View>
                            <View style={{ width: 16 }} />
                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Reorder Level</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="10"
                                    keyboardType="numeric"
                                    value={manualForm.reorder_level}
                                    onChangeText={v => setManualForm({ ...manualForm, reorder_level: v })}
                                />
                            </View>
                        </View>

                        <TouchableOpacity style={styles.primaryBtn} onPress={handleManualSubmit}>
                            <Text style={styles.primaryBtnText}>Review & Confirm</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    if (flow === 'bulk') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setFlow('select')}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Bulk Upload</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.bulkContent}>
                    <View style={styles.infoBox}>
                        <Feather name="info" size={20} color="#7C3AED" />
                        <Text style={styles.infoText}>
                            Upload an Excel (.xlsx) or CSV file with headers: product_name, sku, stock_quantity, reorder_level.
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.templateBtn} onPress={downloadTemplate}>
                        <Feather name="download" size={18} color="#7C3AED" />
                        <Text style={styles.templateBtnText}>Download Excel Template</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.uploadBox} onPress={handlePickDocument}>
                        <View style={styles.uploadIconCircle}>
                            <Feather name="upload-cloud" size={32} color="#7C3AED" />
                        </View>
                        <Text style={styles.uploadTitle}>Choose Excel/CSV File</Text>
                        <Text style={styles.uploadSubtitle}>Select a file from your device</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (flow === 'review') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setFlow(reviewItems.length > 1 ? 'bulk' : 'manual')}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Review Items</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.reviewHeader}>
                    <Text style={styles.reviewCount}>{reviewItems.length} items to be added</Text>
                </View>

                <FlatList
                    data={reviewItems}
                    keyExtractor={(_, index) => index.toString()}
                    contentContainerStyle={styles.reviewList}
                    renderItem={({ item }) => (
                        <View style={styles.reviewCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.reviewName}>{item.product_name || 'No Name'}</Text>
                                <Text style={styles.reviewMeta}>SKU: {item.sku || 'N/A'}</Text>
                            </View>
                            <View style={styles.reviewStats}>
                                <Text style={styles.reviewStatValue}>{item.stock_quantity}</Text>
                                <Text style={styles.reviewStatLabel}>Stock</Text>
                            </View>
                        </View>
                    )}
                />

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.primaryBtn, loading && styles.btnDisabled]}
                        onPress={saveInventory}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Confirm & Add to Inventory</Text>}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB'
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    selectionContent: { padding: 24, flex: 1 },
    selectionTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 24 },
    selectionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2
    },
    iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    cardText: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    cardDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    formScroll: { padding: 24 },
    formGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#4B5563', marginBottom: 8 },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827'
    },
    row: { flexDirection: 'row' },
    primaryBtn: {
        backgroundColor: '#7C3AED',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7C3AED',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
    },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    btnDisabled: { opacity: 0.6 },
    bulkContent: { padding: 24, flex: 1 },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: '#F5F3FF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        gap: 12,
        marginBottom: 24
    },
    infoText: { flex: 1, fontSize: 13, color: '#5B21B6', lineHeight: 18 },
    templateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 24
    },
    templateBtnText: { color: '#7C3AED', fontWeight: '700', fontSize: 14 },
    uploadBox: {
        flex: 1,
        borderWidth: 2,
        borderColor: '#DDD6FE',
        borderStyle: 'dashed',
        borderRadius: 24,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40
    },
    uploadIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    uploadTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    uploadSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
    reviewHeader: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    reviewCount: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
    reviewList: { padding: 16, gap: 12 },
    reviewCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1
    },
    reviewName: { fontSize: 15, fontWeight: '700', color: '#111827' },
    reviewMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    reviewStats: { alignItems: 'flex-end' },
    reviewStatValue: { fontSize: 16, fontWeight: '800', color: '#7C3AED' },
    reviewStatLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' },
    footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
});
