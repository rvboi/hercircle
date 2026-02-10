import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface Product {
    id: string;
    name: string;
    description?: string;
    distributor_price?: number;
    price?: number;
    sku?: string;
    image_url?: string;
    moq?: number;
}

export default function DistributorCatalogue() {
    const router = useRouter();
    const { auth } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name');

            if (error) throw error;
            setProducts(data || []);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to fetch catalogue.');
        } finally {
            setLoading(false);
        }
    };

    const addToCart = async (product: Product) => {
        if (!auth?.id) return;

        const moq = product.moq || 1;

        try {
            // 1. Get Distributor Profile ID
            const { data: profile } = await supabase
                .from('distributor_profiles')
                .select('id')
                .eq('user_id', auth.id)
                .single();

            if (!profile) {
                Alert.alert('Error', 'Distributor profile not found.');
                return;
            }

            const { data: existing } = await supabase
                .from('distributor_cart_items')
                .select('id, quantity')
                .eq('distributor_id', auth.id)
                .eq('product_id', product.id)
                .maybeSingle();

            if (existing) {
                const newQuantity = existing.quantity + 1;
                const { error } = await supabase
                    .from('distributor_cart_items')
                    .update({ quantity: newQuantity })
                    .eq('id', existing.id);
                if (error) throw error;
                Alert.alert('Updated', `Quantity increased to ${newQuantity} units.`);
            } else {
                if (moq > 1) {
                    Alert.alert(
                        'Minimum Order Quantity',
                        `This product requires a minimum order of ${moq} units.\n\nWould you like to add ${moq} units to your cart?`,
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: `Add ${moq} Units`,
                                onPress: async () => {
                                    try {
                                        const { error } = await supabase
                                            .from('distributor_cart_items')
                                            .insert({
                                                distributor_id: auth.id,
                                                product_id: product.id,
                                                quantity: moq
                                            });
                                        if (error) throw error;
                                        Alert.alert('Success', `${moq} units added to cart.`);
                                    } catch (e) {
                                        console.error(e);
                                        Alert.alert('Error', 'Failed to add to cart.');
                                    }
                                }
                            }
                        ]
                    );
                    return;
                }

                const { error } = await supabase
                    .from('distributor_cart_items')
                    .insert({
                        distributor_id: auth.id,
                        product_id: product.id,
                        quantity: 1
                    });
                if (error) throw error;
                Alert.alert('Success', 'Item added to cart.');
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to add to cart.');
        }
    };

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Feather name="chevron-left" size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Master Catalogue</Text>
                <TouchableOpacity onPress={() => router.push('/distributor/cart')} style={styles.cartBtn}>
                    <Feather name="shopping-cart" size={24} color="#1F2937" />
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchRow}>
                    <Feather name="search" size={18} color="#9CA3AF" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search products by name or SKU..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor="#9CA3AF"
                    />
                </View>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                    <Text style={styles.loadingText}>Loading catalogue...</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <View style={styles.imageContainer}>
                                {item.image_url ? (
                                    <Image source={{ uri: item.image_url }} style={styles.productImage} />
                                ) : (
                                    <View style={styles.placeholderImage}>
                                        <Feather name="box" size={32} color="#D1D5DB" />
                                    </View>
                                )}
                                {item.moq && item.moq > 1 && (
                                    <View style={styles.moqFloatBadge}>
                                        <Text style={styles.moqFloatText}>MOQ: {item.moq}</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.cardInfo}>
                                <View style={styles.cardHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                                        <Text style={styles.sku}>SKU: {item.sku || 'N/A'}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(item)}>
                                        <Feather name="plus" size={20} color="#fff" />
                                    </TouchableOpacity>
                                </View>

                                {item.description && (
                                    <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
                                )}

                                <View style={styles.priceContainer}>
                                    <View style={styles.priceItem}>
                                        <Text style={styles.priceLabel}>Your Cost</Text>
                                        <Text style={styles.costPrice}>₹{(item.distributor_price || 0).toLocaleString()}</Text>
                                    </View>
                                    <View style={styles.priceItem}>
                                        <Text style={styles.priceLabel}>Retail (MSRP)</Text>
                                        <Text style={styles.retailPrice}>₹{(item.price || 0).toLocaleString()}</Text>
                                    </View>
                                    <View style={styles.marginItem}>
                                        <Text style={styles.priceLabel}>Margin</Text>
                                        <Text style={styles.marginText}>
                                            ₹{((item.price || 0) - (item.distributor_price || 0)).toLocaleString()}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Feather name="package" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>No products found</Text>
                        </View>
                    }
                />
            )}
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
        borderBottomColor: '#E5E7EB',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
    },
    cartBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
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
        borderRadius: 20,
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    imageContainer: {
        width: '100%',
        height: 180,
        backgroundColor: '#F9FAFB',
        position: 'relative',
    },
    productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    placeholderImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    moqFloatBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(79, 70, 229, 0.9)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    moqFloatText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    cardInfo: { padding: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    name: { fontSize: 18, fontWeight: '800', color: '#111827', flex: 1 },
    sku: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
    addBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#4F46E5',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#4F46E5',
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    desc: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 16 },
    priceContainer: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        gap: 12,
    },
    priceItem: { flex: 1 },
    marginItem: { flex: 1, alignItems: 'flex-end' },
    priceLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    costPrice: { fontSize: 16, fontWeight: '800', color: '#111827' },
    retailPrice: { fontSize: 16, fontWeight: '800', color: '#4F46E5' },
    marginText: { fontSize: 16, fontWeight: '800', color: '#10B981' },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyText: { marginTop: 12, color: '#9CA3AF', fontSize: 16 },
});
