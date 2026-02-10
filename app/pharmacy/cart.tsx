import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    FlatList,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface CartItem {
    product_id: string;
    name: string;
    price: number;
    image_url?: string;
    quantity: number;
}

interface Distributor {
    id: string;
    display_name?: string;
    contact_name?: string;
}

export default function PharmacyCartScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const { auth } = useAuth();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [distributors, setDistributors] = useState<Distributor[]>([]);
    const [checkoutVisible, setCheckoutVisible] = useState(false);
    const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);

    // Disable swipe back to prevent accidental exit from Pharmacy tab group, 
    // and handle hardware back button to ensure redirection to Catalog.
    useEffect(() => {
        navigation.setOptions({ gestureEnabled: false });

        const onBackPress = () => {
            router.replace('/pharmacy/catalog');
            return true;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [navigation, router]);

    // Reload cart when the screen comes into focus layout-wise or essentially just on mount
    useFocusEffect(
        useCallback(() => {
            loadCart();
        }, [])
    );

    const loadCart = async () => {
        const json = await AsyncStorage.getItem('pharmacy_cart');
        console.log('Cart Loaded:', json);
        if (json) setCart(JSON.parse(json));
    };

    const handleBack = () => {
        router.replace('/pharmacy/catalog');
    };

    const updateQuantity = async (productId: string, delta: number) => {
        const newCart = cart.map(item => {
            if (item.product_id === productId) {
                return { ...item, quantity: Math.max(0, item.quantity + delta) };
            }
            return item;
        }).filter(i => i.quantity > 0);

        setCart(newCart);
        await AsyncStorage.setItem('pharmacy_cart', JSON.stringify(newCart));
    };

    const prepareCheckout = async () => {
        if (cart.length === 0) return;
        setLoading(true);

        try {
            // Fetch assigned distributors
            // 1. Get Pharmacy Profile ID
            const { data: profile } = await supabase
                .from('pharmacy_profiles')
                .select('id')
                .eq('user_id', auth?.id)
                .single();

            if (!profile) {
                Alert.alert('Error', 'Pharmacy profile not found');
                return;
            }

            // 2. Fetch Distributors
            const { data } = await supabase
                .from('pharmacy_distributors')
                .select(`
          distributor:distributor_profiles (
            id,
            display_name,
            contact_name
          )
        `)
                .eq('pharmacy_id', profile.id);

            const dists = data?.map((d: any) => d.distributor).filter(Boolean) || [];
            setDistributors(dists);

            // Auto-select first distributor if available, otherwise default to Admin (null)
            if (dists.length > 0) {
                setSelectedDistributor(dists[0]);
            } else {
                setSelectedDistributor(null);
            }

            setCheckoutVisible(true);

        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to prepare checkout');
        } finally {
            setLoading(false);
        }
    };

    const placeOrder = async () => {
        if (!auth?.id) return;

        try {
            setLoading(true);

            const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // Distributor ID is null if "Direct to Admin"
            const distId = selectedDistributor?.id || null;

            // 1. Create Order
            // Using auth.id for pharmacy_id as per schema constraint referencing users table
            // If placed to distributor (distId exists), status is 'confirmed'. If Admin (null), 'pending'.
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    pharmacy_id: auth.id,
                    distributor_id: distId,
                    total_amount: totalAmount,
                    status: distId ? 'confirmed' : 'pending'
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Create Order Items
            // Column name is 'unit_price' in the database schema
            const orderItems = cart.map(item => ({
                order_id: order.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.price
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // 3. Clear Cart
            await AsyncStorage.removeItem('pharmacy_cart');
            setCart([]);
            setCheckoutVisible(false);
            Alert.alert('Success', 'Order placed successfully!');
            router.replace('/pharmacy/orders');

        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to place order.');
        } finally {
            setLoading(false);
        }
    };

    const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack}>
                    <Feather name="chevron-left" size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Cart</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={cart}
                keyExtractor={item => item.product_id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Feather name="shopping-cart" size={48} color="#D1D5DB" />
                        <Text style={styles.emptyText}>Cart is empty</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.name}>{item.name}</Text>
                            <Text style={styles.price}>₹{item.price.toFixed(2)}</Text>
                        </View>
                        <View style={styles.controls}>
                            <TouchableOpacity onPress={() => updateQuantity(item.product_id, -1)} style={styles.qtyBtn}>
                                <Feather name="minus" size={16} />
                            </TouchableOpacity>
                            <Text style={styles.qty}>{item.quantity}</Text>
                            <TouchableOpacity onPress={() => updateQuantity(item.product_id, 1)} style={styles.qtyBtn}>
                                <Feather name="plus" size={16} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />

            {cart.length > 0 && (
                <View style={styles.footer}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
                    </View>
                    <TouchableOpacity style={styles.checkoutBtn} onPress={prepareCheckout}>
                        <Text style={styles.checkoutText}>Proceed to Checkout</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Checkout Modal */}
            <Modal visible={checkoutVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <TouchableOpacity onPress={() => setCheckoutVisible(false)} style={styles.closeBtn}>
                            <Feather name="x" size={24} />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>Select Distributor</Text>
                        <Text style={styles.modalSubtitle}>
                            Who should fulfill this order?
                        </Text>

                        <ScrollView style={{ maxHeight: 300, marginVertical: 16 }}>
                            {distributors.length === 0 && (
                                <TouchableOpacity
                                    style={[
                                        styles.distOption,
                                        selectedDistributor === null && styles.distSelected
                                    ]}
                                    onPress={() => setSelectedDistributor(null)}
                                >
                                    <View style={styles.radio}>
                                        {selectedDistributor === null && <View style={styles.radioInner} />}
                                    </View>
                                    <View>
                                        <Text style={styles.distName}>Direct to Admin</Text>
                                        <Text style={styles.distSub}>Standard handling</Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {distributors.map(d => (
                                <TouchableOpacity
                                    key={d.id}
                                    style={[
                                        styles.distOption,
                                        selectedDistributor?.id === d.id && styles.distSelected
                                    ]}
                                    onPress={() => setSelectedDistributor(d)}
                                >
                                    <View style={styles.radio}>
                                        {selectedDistributor?.id === d.id && <View style={styles.radioInner} />}
                                    </View>
                                    <View>
                                        <Text style={styles.distName}>{d.display_name || d.contact_name}</Text>
                                        <Text style={styles.distSub}>Assigned Distributor</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.placeBtn, loading && { opacity: 0.7 }]}
                            onPress={placeOrder}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.placeText}>Place Order (₹{total.toFixed(2)})</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {loading && !checkoutVisible && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#7C3AED" />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        padding: 20,
        paddingTop: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    list: { padding: 16 },
    empty: { alignItems: 'center', marginTop: 60 },
    emptyText: { color: '#9CA3AF', marginTop: 16 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        elevation: 2,
    },
    name: { fontSize: 16, fontWeight: '600', color: '#111827' },
    price: { fontSize: 14, color: '#7C3AED', fontWeight: 'bold', marginTop: 4 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F3F4F6', borderRadius: 8, padding: 4 },
    qtyBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 6 },
    qty: { fontWeight: 'bold', minWidth: 20, textAlign: 'center' },
    footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    totalLabel: { fontSize: 16, color: '#64748B' },
    totalValue: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    checkoutBtn: { backgroundColor: '#7C3AED', padding: 16, borderRadius: 12, alignItems: 'center' },
    checkoutText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    closeBtn: { alignSelf: 'flex-end', padding: 4 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 8 },
    modalSubtitle: { color: '#64748B', marginTop: 4, marginBottom: 16 },
    distOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12, gap: 12 },
    distSelected: { borderColor: '#7C3AED', backgroundColor: '#F5F3FF' },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7C3AED' },
    distName: { fontWeight: '600', color: '#1E293B' },
    distSub: { fontSize: 12, color: '#64748B' },
    placeBtn: { backgroundColor: '#059669', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    placeText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' }
});
