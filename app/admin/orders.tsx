import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
} from 'react-native';

interface AdminOrder {
    id: string;
    distributor_id?: string;
    pharmacy_id?: string;
    order_date?: string;
    created_at?: string;
    status: string;
    total_amount: number;
    delivery_otp?: string;
    profile?: {
        display_name?: string;
        contact_name?: string;
        business_legal_name?: string;
        trade_name?: string;
        email?: string;
    };
}

interface OrderItem {
    id: string;
    quantity: number;
    price: number;
    products: {
        name: string;
        sku?: string;
        image_url?: string;
    };
}

export default function OrdersTab() {
    const router = useRouter();
    const [orders, setOrders] = useState<AdminOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<string>('all');
    const [orderSource, setOrderSource] = useState<'distributor' | 'pharmacy'>('distributor');

    // Modal
    const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Delivery Modal
    const [otpModalVisible, setOtpModalVisible] = useState(false);
    const [otpInput, setOtpInput] = useState('');
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [currentDeliveryOrder, setCurrentDeliveryOrder] = useState<AdminOrder | null>(null);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            let finalData: any[] = [];

            if (orderSource === 'distributor') {
                // Fetch Distributor -> Admin Orders
                let query = supabase
                    .from('distributor_admin_orders')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (filter !== 'all') query = query.eq('status', filter);

                const { data: distOrders, error } = await query;
                if (error) throw error;

                if (distOrders && distOrders.length > 0) {
                    const distIds = [...new Set(distOrders.map(o => o.distributor_id))];
                    const { data: distProfiles } = await supabase
                        .from('distributor_profiles')
                        .select('id, user_id, display_name, contact_name')
                        .in('user_id', distIds); // Assuming distributor_id is user_id based on previous logic

                    finalData = distOrders.map(order => ({
                        ...order,
                        profile: distProfiles?.find(p => p.user_id === order.distributor_id)
                    }));
                }
            } else {
                // Fetch Pharmacy -> Admin Orders (Direct)
                let query = supabase
                    .from('orders')
                    .select('*')
                    .is('distributor_id', null)
                    .order('order_date', { ascending: false });

                if (filter !== 'all') query = query.eq('status', filter.toLowerCase());

                const { data: pharmOrders, error } = await query;
                if (error) throw error;

                if (pharmOrders && pharmOrders.length > 0) {
                    const pharmUserIds = [...new Set(pharmOrders.map(o => o.pharmacy_id))];
                    const { data: pharmProfiles } = await supabase
                        .from('pharmacy_profiles')
                        .select('user_id, business_legal_name, trade_name, contact_name')
                        .in('user_id', pharmUserIds);

                    finalData = pharmOrders.map(order => ({
                        ...order,
                        profile: pharmProfiles?.find(p => p.user_id === order.pharmacy_id)
                    }));
                }
            }

            setOrders(finalData);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [filter, orderSource]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchOrders();
    }, [filter, orderSource]);


    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        try {
            const table = orderSource === 'distributor' ? 'distributor_admin_orders' : 'orders';
            const { error } = await supabase
                .from(table)
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;
            fetchOrders();
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
            }

            if (newStatus === 'confirmed') showToast('Order Accepted');
            if (newStatus === 'cancelled') showToast('Order Declined');
        } catch (error) {
            console.error('Error updating order status:', error);
            Alert.alert('Error', 'Failed to update status');
        }
    };

    const initiateDelivery = async (order: AdminOrder) => {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const table = orderSource === 'distributor' ? 'distributor_admin_orders' : 'orders';

        try {
            const { error } = await supabase
                .from(table)
                .update({ delivery_otp: otp })
                .eq('id', order.id);

            if (error) throw error;

            setCurrentDeliveryOrder({ ...order, delivery_otp: otp });
            setOtpInput('');
            setOtpModalVisible(true);
            Alert.alert('OTP Generated', 'OTP sent to the buyer. Verify to complete delivery.');
        } catch (error) {
            console.error('Error generating OTP:', error);
            Alert.alert('Error', 'Failed to initiate delivery');
        }
    };

    const verifyOtp = async () => {
        if (!currentDeliveryOrder) return;

        if (otpInput.trim() !== currentDeliveryOrder.delivery_otp) {
            Alert.alert('Invalid OTP', 'Incorrect OTP.');
            return;
        }

        try {
            setVerifyingOtp(true);
            await handleUpdateStatus(currentDeliveryOrder.id, 'delivered');
            setOtpModalVisible(false);
            setCurrentDeliveryOrder(null);
            showToast('Order Delivered Successfully');
            if (selectedOrder) setSelectedOrder(prev => prev ? { ...prev, status: 'delivered' } : null);
        } catch (error) {
            console.error('Error verifying OTP:', error);
            Alert.alert('Error', 'Failed to verify');
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

    const fetchOrderDetails = async (order: AdminOrder) => {
        setSelectedOrder(order);
        setLoadingItems(true);
        try {
            if (orderSource === 'distributor') {
                const { data, error } = await supabase
                    .from('distributor_admin_order_items')
                    .select(`
                        id, quantity, price,
                        products ( name, sku, image_url )
                    `)
                    .eq('order_id', order.id);
                if (error) throw error;
                setOrderItems((data as any) || []);
            } else {
                const { data, error } = await supabase
                    .from('order_items')
                    .select(`
                        id, quantity, price,
                        products ( name, sku, image_url )
                    `)
                    .eq('order_id', order.id);
                if (error) throw error;
                setOrderItems((data as any) || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingItems(false);
        }
    };

    const filteredOrders = orders.filter(order => {
        const searchLower = searchQuery.toLowerCase();
        const name = (order.profile?.display_name || order.profile?.business_legal_name || order.profile?.contact_name || '').toLowerCase();
        const orderId = order.id.toLowerCase();
        return name.includes(searchLower) || orderId.includes(searchLower);
    });

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending': return '#F59E0B';
            case 'processing':
            case 'confirmed': return '#3B82F6';
            case 'shipped': return '#8B5CF6';
            case 'completed':
            case 'delivered':
            case 'fulfilled': return '#10B981';
            case 'cancelled':
            case 'rejected': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const stats = {
        total: orders.length,
        // Match both 'pending' and 'Pending'
        pending: orders.filter(o => o.status.toLowerCase() === 'pending').length,
        revenue: orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}>
                <Text style={styles.headerTitle}>Order Management</Text>
                <Text style={styles.headerSubtitle}>₹{stats.revenue.toLocaleString()} Total Revenue</Text>
            </LinearGradient>

            {/* Source Segment Control */}
            <View style={styles.segmentContainer}>
                <TouchableOpacity
                    style={[styles.segmentBtn, orderSource === 'distributor' && styles.segmentBtnActive]}
                    onPress={() => setOrderSource('distributor')}
                >
                    <Text style={[styles.segmentText, orderSource === 'distributor' && styles.segmentTextActive]}>Distributor Orders</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.segmentBtn, orderSource === 'pharmacy' && styles.segmentBtnActive]}
                    onPress={() => setOrderSource('pharmacy')}
                >
                    <Text style={[styles.segmentText, orderSource === 'pharmacy' && styles.segmentTextActive]}>Direct Pharmacy</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
                }>

                {/* Filter Chips */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}>
                    {['all', 'Pending', 'Processing', 'Shipped', 'Completed', 'Cancelled'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterChip, filter === f && styles.filterChipActive]}
                            onPress={() => setFilter(f)}>
                            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                                {f}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Feather name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by ID or Name..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#9CA3AF"
                    />
                </View>

                {/* Orders List */}
                <View style={styles.listContainer}>
                    {loading ? (
                        <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 40 }} />
                    ) : filteredOrders.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Feather name="shopping-bag" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>No orders found</Text>
                            <Text style={{ color: '#9CA3AF', fontSize: 12 }}>
                                Order Source: {orderSource === 'distributor' ? 'Distributor -> Admin' : 'Pharmacy -> Admin (Direct)'}
                            </Text>
                        </View>
                    ) : (
                        filteredOrders.map((order) => (
                            <View key={order.id} style={styles.orderCard}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.orderInfo}>
                                        <Text style={styles.orderId}>Order #{order.id.slice(0, 8).toUpperCase()}</Text>
                                        <Text style={styles.distributorName}>
                                            {order.profile?.trade_name || order.profile?.business_legal_name || order.profile?.display_name || order.profile?.contact_name || 'Unknown'}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                                        <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                                            {order.status}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.cardDetails}>
                                    <View style={styles.detailItem}>
                                        <Feather name="calendar" size={14} color="#9CA3AF" />
                                        <Text style={styles.detailText}>
                                            {new Date(order.order_date || order.created_at || '').toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <View style={styles.detailItem}>
                                        <Feather name="credit-card" size={14} color="#9CA3AF" />
                                        <Text style={styles.amountText}>₹{Number(order.total_amount).toLocaleString()}</Text>
                                    </View>
                                </View>

                                <View style={styles.actionsRow}>
                                    {order.status.toLowerCase() === 'pending' && (
                                        <>
                                            <TouchableOpacity
                                                style={[styles.actionBtn, { backgroundColor: '#EF4444', marginRight: 4 }]}
                                                onPress={() => Alert.alert('Decline', 'Decline order?', [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    { text: 'Decline', style: 'destructive', onPress: () => handleUpdateStatus(order.id, 'cancelled') }
                                                ])}>
                                                <Text style={styles.actionBtnText}>Decline</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.actionBtn, { backgroundColor: '#10B981', marginRight: 4 }]}
                                                onPress={() => handleUpdateStatus(order.id, 'confirmed')}>
                                                <Text style={styles.actionBtnText}>Accept</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    {(order.status.toLowerCase() === 'confirmed' || order.status.toLowerCase() === 'processing') && (
                                        <TouchableOpacity
                                            style={[styles.actionBtn, { backgroundColor: '#3B82F6', marginRight: 4 }]}
                                            onPress={() => initiateDelivery(order)}>
                                            <Text style={styles.actionBtnText}>Deliver</Text>
                                        </TouchableOpacity>
                                    )}

                                    <TouchableOpacity
                                        style={styles.detailsBtn}
                                        onPress={() => fetchOrderDetails(order)}>
                                        <Text style={styles.detailsBtnText}>View</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            <Modal visible={!!selectedOrder} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedOrder(null)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Order Details</Text>
                        <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.closeBtn}>
                            <Feather name="x" size={24} color="#111827" />
                        </TouchableOpacity>
                    </View>

                    {selectedOrder && (
                        <View style={styles.orderDetails}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Source:</Text>
                                <Text style={styles.detailValue}>{orderSource === 'distributor' ? 'Distributor' : 'Pharmacy (Direct)'}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Client:</Text>
                                <Text style={styles.detailValue}>{selectedOrder.profile?.trade_name || selectedOrder.profile?.display_name || 'N/A'}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Status:</Text>
                                <Text style={[styles.detailValue, { color: getStatusColor(selectedOrder.status), fontWeight: '700' }]}>
                                    {selectedOrder.status.toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.divider} />

                    {loadingItems ? (
                        <ActivityIndicator size="large" color="#059669" style={{ marginTop: 40 }} />
                    ) : (
                        <FlatList
                            data={orderItems}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.itemsList}
                            renderItem={({ item }) => (
                                <View style={styles.itemCard}>
                                    {item.products?.image_url ? (
                                        <Image source={{ uri: item.products.image_url }} style={styles.itemImage} />
                                    ) : (
                                        <View style={styles.placeholderImage}>
                                            <Feather name="image" size={20} color="#9CA3AF" />
                                        </View>
                                    )}
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemName}>{item.products?.name}</Text>
                                        <Text style={styles.itemSku}>SKU: {item.products?.sku || 'N/A'}</Text>
                                        <View style={styles.itemMeta}>
                                            <Text style={styles.itemQty}>x{item.quantity}</Text>
                                            <Text style={styles.itemPrice}>₹{item.price.toFixed(2)}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.itemTotal}>₹{(item.quantity * item.price).toFixed(2)}</Text>
                                </View>
                            )}
                        />
                    )}


                    {selectedOrder && (
                        <View style={styles.modalFooter}>
                            {selectedOrder.status.toLowerCase() === 'pending' && (
                                <View style={styles.modalActions}>
                                    <TouchableOpacity
                                        style={[styles.modalBtn, styles.declineButton]}
                                        onPress={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                                    >
                                        <Text style={styles.declineText}>Decline</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalBtn, styles.acceptButton]}
                                        onPress={() => handleUpdateStatus(selectedOrder.id, 'confirmed')}
                                    >
                                        <Text style={styles.acceptText}>Accept</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {(selectedOrder.status.toLowerCase() === 'confirmed' || selectedOrder.status.toLowerCase() === 'processing') && (
                                <TouchableOpacity
                                    style={[styles.modalBtn, styles.deliverButton]}
                                    onPress={() => initiateDelivery(selectedOrder)}
                                >
                                    <Text style={styles.deliverText}>Deliver Order</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>
            </Modal>

            {/* OTP Modal */}
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
                            Ask the buyer for the delivery OTP and enter it below.
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
                            {verifyingOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyButtonText}>Verify & Deliver</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 24,
        paddingHorizontal: 24,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '600',
    },
    segmentContainer: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 20, marginTop: -20, borderRadius: 12, padding: 4, elevation: 4 },
    segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
    segmentBtnActive: { backgroundColor: '#EFF6FF' },
    segmentText: { fontWeight: '600', color: '#6B7280' },
    segmentTextActive: { color: '#3B82F6' },
    scrollView: {
        flex: 1,
        marginTop: 10
    },
    filterRow: {
        paddingHorizontal: 20,
        paddingTop: 10,
        gap: 8,
        paddingBottom: 4,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterChipActive: {
        backgroundColor: '#4F46E5',
        borderColor: '#4F46E5',
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    filterChipTextActive: {
        color: '#fff',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 16,
        paddingHorizontal: 16,
        height: 48,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    listContainer: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    orderCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    orderInfo: {
        flex: 1,
    },
    orderId: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    distributorName: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    cardDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#F3F4F6',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 13,
        color: '#6B7280',
    },
    amountText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#4F46E5',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    detailsBtn: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailsBtnText: {
        color: '#4B5563',
        fontSize: 13,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#9CA3AF',
    },

    // Modal Styles
    modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    modalHeader: {
        padding: 20,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
    closeBtn: { padding: 4 },
    orderDetails: { padding: 20, backgroundColor: '#fff' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    detailLabel: { fontSize: 14, color: '#6B7280' },
    detailValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
    divider: { height: 1, backgroundColor: '#E5E7EB' },
    itemsList: { padding: 16, gap: 12 },
    itemCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    itemImage: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
    placeholderImage: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
    itemSku: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    itemMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
    itemQty: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
    itemPrice: { fontSize: 12, color: '#6B7280' },
    itemTotal: { fontSize: 14, fontWeight: '700', color: '#111827' },
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingBottom: 40,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLabel: { fontSize: 16, fontWeight: '600', color: '#111827' },
    totalValue: { fontSize: 20, fontWeight: '800', color: '#059669' },

    // Modal Actions
    modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#fff' },
    modalActions: { flexDirection: 'row', gap: 12 },
    modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    declineButton: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
    acceptButton: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
    declineText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
    acceptText: { color: '#10B981', fontWeight: '700', fontSize: 14 },
    deliverButton: { backgroundColor: '#3B82F6', borderWidth: 0 },
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
