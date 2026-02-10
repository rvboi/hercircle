import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface CartItem {
    id: string;
    product_id: string;
    quantity: number;
    products: {
        name: string;
        distributor_price?: number;
        price?: number;
        sku: string;
        image_url?: string;
        moq?: number;
    };
}

export default function DistributorCart() {
    const { auth } = useAuth();
    const router = useRouter();
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [placingOrder, setPlacingOrder] = useState(false);
    const [paymentVisible, setPaymentVisible] = useState(false);

    const [distributorId, setDistributorId] = useState<string | null>(null);

    useEffect(() => {
        if (auth?.id) {
            setDistributorId(auth.id);
            fetchCart(auth.id);
        }
    }, [auth]);

    const fetchCart = async (distId: string) => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('distributor_cart_items')
                .select(`
                  id,
                  product_id,
                  quantity,
                  products (
                    name,
                    distributor_price,
                    sku,
                    image_url,
                    moq
                  )
                `)
                .eq('distributor_id', distId);

            if (error) throw error;
            setCartItems((data as unknown) as CartItem[] || []);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to fetch cart.');
        } finally {
            setLoading(false);
        }
    };

    const updateQuantity = async (itemId: string, newQty: number) => {
        if (newQty < 1) {
            removeFromCart(itemId);
            return;
        }
        setCartItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: newQty } : i));

        try {
            const { error } = await supabase
                .from('distributor_cart_items')
                .update({ quantity: newQty })
                .eq('id', itemId);
            if (error) throw error;
        } catch (e) {
            console.error(e);
            if (auth?.id) fetchCart(auth.id);
        }
    };

    const removeFromCart = async (itemId: string) => {
        Alert.alert('Remove Item', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const { error } = await supabase.from('distributor_cart_items').delete().eq('id', itemId);
                        if (error) throw error;
                        setCartItems(prev => prev.filter(i => i.id !== itemId));
                    } catch (e) {
                        console.error(e);
                        Alert.alert('Error', 'Failed to remove item.');
                    }
                }
            }
        ]);
    };

    const placeOrder = async () => {
        if (!auth?.id || cartItems.length === 0) return;

        // Validate MOQ
        const itemsBelowMoq = cartItems.filter(item => {
            const moq = item.products?.moq || 1;
            return item.quantity < moq;
        });

        if (itemsBelowMoq.length > 0) {
            const itemsList = itemsBelowMoq.map(item =>
                `• ${item.products?.name}: ${item.quantity} units (MOQ: ${item.products?.moq || 1})`
            ).join('\n');

            Alert.alert(
                'Minimum Order Quantity Not Met',
                `The following items do not meet the minimum order quantity:\n\n${itemsList}\n\nPlease update quantities to proceed.`,
                [{ text: 'OK' }]
            );
            return;
        }

        setPaymentVisible(true);

        setTimeout(async () => {
            try {
                const totalAmount = cartItems.reduce((sum, item) => {
                    const price = Number(item.products?.distributor_price) || 0;
                    return sum + (item.quantity * price);
                }, 0);

                // 1. Create Order
                const { data: orderData, error: orderError } = await supabase
                    .from('distributor_admin_orders')
                    .insert({
                        distributor_id: auth.id,
                        total_amount: totalAmount,
                        status: 'Pending'
                    })
                    .select()
                    .single();

                if (orderError) throw orderError;

                // 2. Create Order Items
                const orderItems = cartItems.map(item => ({
                    order_id: orderData.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: Number(item.products?.distributor_price) || 0
                }));

                const { error: itemsError } = await supabase
                    .from('distributor_admin_order_items')
                    .insert(orderItems);

                if (itemsError) throw itemsError;

                // 3. Clear Cart
                const { error: clearError } = await supabase
                    .from('distributor_cart_items')
                    .delete()
                    .eq('distributor_id', auth.id);

                if (clearError) throw clearError;

                setPaymentVisible(false);
                Alert.alert('Success', 'Order placed successfully!');
                router.replace('/distributor/orders-to-admin');
            } catch (e) {
                console.error(e);
                setPaymentVisible(false);
                Alert.alert('Error', 'Failed to place order.');
            }
        }, 2000);
    };

    const total = cartItems.reduce((sum, item) => {
        const price = Number(item.products?.distributor_price) || 0;
        return sum + (item.quantity * price);
    }, 0);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#059669" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Feather name="chevron-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Cart</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={cartItems}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Feather name="shopping-cart" size={48} color="#D1D5DB" />
                        <Text style={styles.emptyText}>Your cart is empty</Text>
                        <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/distributor/catalogue')}>
                            <Text style={styles.browseBtnText}>Browse Catalogue</Text>
                        </TouchableOpacity>
                    </View>
                }
                renderItem={({ item }) => {
                    const moq = item.products?.moq || 1;
                    const isBelowMoq = item.quantity < moq;

                    return (
                        <View style={styles.card}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.name}>{item.products?.name}</Text>
                                <Text style={styles.price}>${Number(item.products?.distributor_price || 0).toFixed(2)} / unit</Text>
                                {isBelowMoq && (
                                    <View style={styles.moqWarningContainer}>
                                        <Feather name="alert-circle" size={14} color="#DC2626" />
                                        <Text style={styles.moqWarningText}>
                                            MOQ: {moq} units required
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.controls}>
                                <TouchableOpacity
                                    style={styles.qtyBtn}
                                    onPress={() => updateQuantity(item.id, item.quantity - 1)}
                                >
                                    <Feather name="minus" size={16} color="#4B5563" />
                                </TouchableOpacity>
                                <Text style={styles.qty}>{item.quantity}</Text>
                                <TouchableOpacity
                                    style={styles.qtyBtn}
                                    onPress={() => updateQuantity(item.id, item.quantity + 1)}
                                >
                                    <Feather name="plus" size={16} color="#4B5563" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }}
            />

            {cartItems.length > 0 && (
                <View style={styles.footer}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.checkoutBtn, placingOrder && styles.disabledBtn]}
                        onPress={placeOrder}
                        disabled={placingOrder || paymentVisible}
                    >
                        {paymentVisible ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.checkoutBtnText}>Place Order</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Payment Modal */}
            {paymentVisible && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ActivityIndicator size="large" color="#059669" />
                        <Text style={styles.modalText}>Processing Payment...</Text>
                    </View>
                </View>
            )}
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
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
    list: { padding: 16, gap: 12, flexGrow: 1 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 2,
    },
    name: { fontSize: 16, fontWeight: '700', color: '#111827' },
    price: { fontSize: 14, color: '#6B7280', marginTop: 4 },
    moqWarningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    moqWarningText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F3F4F6', borderRadius: 8, padding: 4 },
    qtyBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    qty: { fontSize: 16, fontWeight: '700', color: '#111827', minWidth: 20, textAlign: 'center' },
    footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    totalLabel: { fontSize: 16, color: '#6B7280' },
    totalValue: { fontSize: 24, fontWeight: '800', color: '#059669' },
    checkoutBtn: { backgroundColor: '#059669', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    disabledBtn: { opacity: 0.7 },
    checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyText: { fontSize: 18, color: '#9CA3AF', marginTop: 16, marginBottom: 24 },
    browseBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#E5E7EB', borderRadius: 10 },
    browseBtnText: { color: '#374151', fontWeight: '700' },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    modalText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
});
