import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View
} from 'react-native';

interface Order {
    id: string;
    order_date: string;
    status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
    total_amount: number;
    notes: string;
    delivery_otp?: string;
    pharmacy_profiles: {
        business_legal_name: string;
        trade_name: string;
        city: string;
    };
}

interface OrderItem {
    id: string;
    quantity: number;
    unit_price: number;
    products: {
        name: string;
        image_url?: string;
    };
}

export default function DistributorOrders() {
    const { auth } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    // Details Modal
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Delivery Modal
    const [otpModalVisible, setOtpModalVisible] = useState(false);
    const [otpInput, setOtpInput] = useState('');
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [currentDeliveryOrder, setCurrentDeliveryOrder] = useState<Order | null>(null);

    useEffect(() => {
        if (auth?.id) fetchOrders();
    }, [auth]);

    const fetchOrders = async () => {
        try {
            setLoading(true);

            // 1. Get Distributor Profile
            const { data: profile } = await supabase
                .from('distributor_profiles')
                .select('id')
                .eq('user_id', auth?.id)
                .single();

            if (!profile) {
                setLoading(false);
                return;
            }

            // 2. Fetch Orders (without direct join to avoid FK issues if implied)
            // Orders table pharmacy_id is User ID. Pharmacy Profiles table has user_id.
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*')
                .eq('distributor_id', profile.id)
                .order('order_date', { ascending: false });

            if (ordersError) throw ordersError;

            if (!ordersData || ordersData.length === 0) {
                setOrders([]);
                return;
            }

            // 3. Fetch Pharmacy Profiles manually
            const pharmacyUserIds = [...new Set(ordersData.map((o: any) => o.pharmacy_id))];

            const { data: profilesData } = await supabase
                .from('pharmacy_profiles')
                .select('user_id, business_legal_name, trade_name, city')
                .in('user_id', pharmacyUserIds);

            // 4. Map profiles to orders
            const ordersWithProfiles = ordersData.map((order: any) => {
                const p = profilesData?.find((prof: any) => prof.user_id === order.pharmacy_id);
                return {
                    ...order,
                    pharmacy_profiles: p || { business_legal_name: 'Unknown', trade_name: 'Unknown', city: '' }
                };
            });

            setOrders(ordersWithProfiles);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchOrderDetails = async (order: Order) => {
        setSelectedOrder(order);
        try {
            setLoadingDetails(true);
            const { data, error } = await supabase
                .from('order_items')
                .select(`
                  id, quantity, unit_price,
                  products ( name, image_url )
                `)
                .eq('order_id', order.id);

            if (error) throw error;
            setOrderItems((data as any) || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDetails(false);
        }
    };

    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;

            // Update local state
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null);
            }

            if (newStatus === 'confirmed') {
                showToast('Order Accepted');
            } else if (newStatus === 'cancelled') {
                showToast('Order Declined');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            Alert.alert('Error', 'Failed to update order status');
        }
    };

    const initiateDelivery = async (order: Order) => {
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        try {
            // Update order with OTP
            const { error } = await supabase
                .from('orders')
                .update({ delivery_otp: otp })
                .eq('id', order.id);

            if (error) throw error;

            setCurrentDeliveryOrder({ ...order, delivery_otp: otp });
            setOtpInput('');
            setOtpModalVisible(true);

            // In a real app, this would trigger an SMS/Email to the pharmacy
            Alert.alert('OTP Generated', `An OTP has been sent to the pharmacy. Ask them for the code to verify delivery.`);
        } catch (error) {
            console.error('Error generating OTP:', error);
            Alert.alert('Error', 'Failed to initiate delivery');
        }
    };

    const verifyOtp = async () => {
        if (!currentDeliveryOrder) return;

        if (otpInput.trim() !== currentDeliveryOrder.delivery_otp) {
            Alert.alert('Invalid OTP', 'The OTP entered is incorrect. Please try again.');
            return;
        }

        try {
            setVerifyingOtp(true);
            await updateOrderStatus(currentDeliveryOrder.id, 'delivered');
            setOtpModalVisible(false);
            setCurrentDeliveryOrder(null);
            showToast('Order Delivered Successfully');
            // Close details modal if open
            setSelectedOrder(null);
        } catch (error) {
            console.error('Error verifying OTP:', error);
            Alert.alert('Error', 'Failed to verify delivery');
        } finally {
            setVerifyingOtp(false);
        }
    };

    const showToast = (message: string) => {
        if (Platform.OS === 'android') {
            ToastAndroid.show(message, ToastAndroid.SHORT);
        } else {
            Alert.alert('Success', message);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return '#F59E0B';
            case 'confirmed': return '#3B82F6';
            case 'shipped': return '#8B5CF6';
            case 'delivered': return '#10B981';
            case 'cancelled': return '#EF4444';
            default: return '#6B7280';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Feather name="chevron-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Pharmacy Orders</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Feather name="inbox" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>No orders received yet.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.card}
                            onPress={() => fetchOrderDetails(item)}
                        >
                            <View style={styles.cardHeader}>
                                <View>
                                    <Text style={styles.orderId}>Order #{item.id.slice(0, 8).toUpperCase()}</Text>
                                    <Text style={styles.date}>{new Date(item.order_date).toLocaleDateString()}</Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                                    <Text style={[styles.badgeText, { color: getStatusColor(item.status) }]}>
                                        {item.status.toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.infoRow}>
                                <Feather name="user" size={16} color="#6B7280" />
                                <Text style={styles.infoText}>
                                    {item.pharmacy_profiles?.trade_name || item.pharmacy_profiles?.business_legal_name || 'Unknown Pharmacy'}
                                </Text>
                            </View>

                            {item.pharmacy_profiles?.city && (
                                <View style={styles.infoRow}>
                                    <Feather name="map-pin" size={16} color="#6B7280" />
                                    <Text style={styles.infoText} numberOfLines={1}>
                                        {item.pharmacy_profiles.city}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.footer}>
                                <Text style={styles.totalLabel}>Total Amount</Text>
                                <Text style={styles.totalValue}>₹{item.total_amount.toFixed(2)}</Text>
                            </View>

                            {/* Quick Actions in List */}
                            {item.status === 'pending' && (
                                <View style={styles.quickActions}>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.declineButton]}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            Alert.alert('Decline Order', 'Are you sure you want to decline this order?', [
                                                { text: 'Cancel', style: 'cancel' },
                                                { text: 'Decline', style: 'destructive', onPress: () => updateOrderStatus(item.id, 'cancelled') }
                                            ]);
                                        }}
                                    >
                                        <Text style={styles.declineText}>Decline</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.acceptButton]}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            updateOrderStatus(item.id, 'confirmed');
                                        }}
                                    >
                                        <Text style={styles.acceptText}>Accept</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* Order Details Modal */}
            <Modal
                visible={!!selectedOrder}
                animationType="slide"
                presentationStyle="formSheet"
                onRequestClose={() => setSelectedOrder(null)}
            >
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Order Details</Text>
                    <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                        <Feather name="x" size={24} color="#000" />
                    </TouchableOpacity>
                </View>

                {loadingDetails ? (
                    <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
                ) : (
                    <>
                        <FlatList
                            data={orderItems}
                            keyExtractor={i => i.id}
                            contentContainerStyle={{ padding: 16 }}
                            ListHeaderComponent={
                                <View style={styles.detailSummary}>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Pharmacy:</Text>
                                        <Text style={styles.summaryValue}>{selectedOrder?.pharmacy_profiles?.trade_name}</Text>
                                    </View>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Total:</Text>
                                        <Text style={styles.summaryValue}>₹{Number(selectedOrder?.total_amount).toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Status:</Text>
                                        <Text style={styles.summaryValue}>{selectedOrder?.status.toUpperCase()}</Text>
                                    </View>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <View style={styles.itemRow}>
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemName}>{item.products?.name || 'Unknown Product'}</Text>
                                        <Text style={styles.itemSub}>Qty: {item.quantity}</Text>
                                    </View>
                                    <Text style={styles.itemPrice}>₹{(item.unit_price * item.quantity).toFixed(2)}</Text>
                                </View>
                            )}
                        />


                        {/* Modal Action Buttons */}
                        <View style={styles.modalFooter}>
                            {selectedOrder?.status === 'pending' && (
                                <View style={styles.modalActions}>
                                    <TouchableOpacity
                                        style={[styles.modalBtn, styles.declineButton]}
                                        onPress={() => Alert.alert('Decline', 'Decline this order?', [
                                            { text: 'No', style: 'cancel' },
                                            { text: 'Yes', style: 'destructive', onPress: () => updateOrderStatus(selectedOrder.id, 'cancelled') }
                                        ])}
                                    >
                                        <Text style={styles.declineText}>Decline Order</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalBtn, styles.acceptButton]}
                                        onPress={() => updateOrderStatus(selectedOrder.id, 'confirmed')}
                                    >
                                        <Text style={styles.acceptText}>Accept Order</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {selectedOrder?.status === 'confirmed' && (
                                <TouchableOpacity
                                    style={[styles.modalBtn, styles.deliverButton]}
                                    onPress={() => initiateDelivery(selectedOrder)}
                                >
                                    <Text style={styles.deliverText}>Deliver Order</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </>
                )}
            </Modal>

            {/* OTP Verification Modal */}
            <Modal
                visible={otpModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setOtpModalVisible(false)}
            >
                <View style={styles.otpModalOverlay}>
                    <View style={styles.otpModalContent}>
                        <View style={styles.otpHeader}>
                            <Text style={styles.otpTitle}>Verify Delivery</Text>
                            <TouchableOpacity onPress={() => setOtpModalVisible(false)}>
                                <Feather name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.otpInstruction}>
                            Ask the pharmacy for the delivery OTP and enter it below to complete the order.
                        </Text>

                        <TextInput
                            style={styles.otpInput}
                            value={otpInput}
                            onChangeText={setOtpInput}
                            placeholder="Enter 6-digit OTP"
                            keyboardType="number-pad"
                            maxLength={6}
                            textAlign="center"
                        />

                        <TouchableOpacity
                            style={[styles.verifyButton, (!otpInput || verifyingOtp) && styles.disabledButton]}
                            disabled={!otpInput || verifyingOtp}
                            onPress={verifyOtp}
                        >
                            {verifyingOtp ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.verifyButtonText}>Verify & Deliver</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
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
    list: { padding: 16, gap: 16 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    orderId: { fontSize: 16, fontWeight: '700', color: '#111827' },
    date: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 11, fontWeight: '800' },
    divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    infoText: { fontSize: 14, color: '#4B5563', flex: 1 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    totalLabel: { fontSize: 14, color: '#6B7280' },
    totalValue: { fontSize: 18, fontWeight: '800', color: '#7C3AED' },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60, gap: 16 },
    emptyText: { fontSize: 16, color: '#9CA3AF' },

    // Modal
    modalHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee', paddingTop: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    detailSummary: { marginBottom: 20, padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, gap: 8 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryLabel: { color: '#64748B', fontWeight: '500' },
    summaryValue: { color: '#1E293B', fontWeight: '700' },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F3F4F6' },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
    itemSub: { fontSize: 14, color: '#6B7280', marginTop: 2 },
    itemPrice: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },

    // Quick Actions
    quickActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
    actionButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    declineButton: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
    acceptButton: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
    declineText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
    acceptText: { color: '#10B981', fontWeight: '700', fontSize: 14 },

    // Modal Footer
    modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#fff' },
    modalActions: { flexDirection: 'row', gap: 12 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    deliverButton: { backgroundColor: '#3B82F6' },
    deliverText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    // OTP Modal
    otpModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    otpModalContent: { backgroundColor: '#fff', width: '100%', maxWidth: 340, borderRadius: 20, padding: 24, alignItems: 'center' },
    otpHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    otpTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    otpInstruction: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
    otpInput: { width: '100%', height: 50, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 24, letterSpacing: 8 },
    verifyButton: { width: '100%', height: 48, backgroundColor: '#10B981', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    disabledButton: { opacity: 0.5 },
    verifyButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
