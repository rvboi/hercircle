import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface Distributor {
    id: string;
    user_id: string;
    email: string;
    display_name?: string;
    contact_name?: string;
    contact_designation?: string;
    contact_mobile?: string;
    address?: string;
    warehouse_address?: string;
    city?: string;
    state?: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}

export default function DistributorsTab() {
    const router = useRouter();
    const [distributors, setDistributors] = useState<Distributor[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

    // Detail Modal State
    const [selectedDist, setSelectedDist] = useState<Distributor | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const fetchDistributors = async () => {
        try {
            let query = supabase
                .from('distributor_profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query;

            if (error) throw error;
            setDistributors(data || []);
        } catch (error) {
            console.error('Error fetching distributors:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDistributors();
    }, [filter]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchDistributors();
    }, [filter]);

    const updateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('distributor_profiles')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            // Update local state if modal is open
            if (selectedDist && selectedDist.id === id) {
                setSelectedDist({ ...selectedDist, status: newStatus });
            }

            fetchDistributors();
            Alert.alert('Success', `Distributor ${newStatus} successfully.`);
        } catch (error) {
            console.error('Error updating status:', error);
            Alert.alert('Error', 'Failed to update status.');
        }
    };

    const removeDistributor = async (id: string) => {
        Alert.alert(
            'Remove Distributor',
            'Are you sure you want to remove this distributor? This will delete their profile record.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const { error } = await supabase
                                .from('distributor_profiles')
                                .delete()
                                .eq('id', id);

                            if (error) throw error;

                            setDistributors(distributors.filter(d => d.id !== id));
                            setModalVisible(false);
                            Alert.alert('Success', 'Distributor removed successfully.');
                        } catch (e: any) {
                            console.error(e);
                            Alert.alert('Error', e.message || 'Failed to remove distributor.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const filteredDistributors = distributors.filter(dist => {
        const searchLower = searchQuery.toLowerCase();
        return (
            dist.display_name?.toLowerCase().includes(searchLower) ||
            dist.contact_name?.toLowerCase().includes(searchLower) ||
            dist.email?.toLowerCase().includes(searchLower) ||
            dist.city?.toLowerCase().includes(searchLower)
        );
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return '#10B981';
            case 'pending': return '#F59E0B';
            case 'rejected': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const stats = {
        total: distributors.length,
        pending: distributors.filter(d => d.status === 'pending').length,
        approved: distributors.filter(d => d.status === 'approved').length,
        rejected: distributors.filter(d => d.status === 'rejected').length,
    };

    const openDetails = (dist: Distributor) => {
        setSelectedDist(dist);
        setModalVisible(true);
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                    <Text style={styles.loadingText}>Loading Distributors...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Feather name="chevron-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.headerTitle}>Distributors</Text>
                        <Text style={styles.headerSubtitle}>{stats.total} Total Registered</Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
                }>

                {/* Stats Cards */}
                <View style={styles.statsRow}>
                    <TouchableOpacity
                        style={[styles.statCard, filter === 'all' && styles.statCardActive]}
                        onPress={() => setFilter('all')}>
                        <View style={[styles.statIconContainer, { backgroundColor: '#EDE9FE' }]}>
                            <Feather name="users" size={20} color="#7C3AED" />
                        </View>
                        <Text style={styles.statValue}>{stats.total}</Text>
                        <Text style={styles.statLabel}>All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.statCard, filter === 'pending' && styles.statCardActive]}
                        onPress={() => setFilter('pending')}>
                        <View style={[styles.statIconContainer, { backgroundColor: '#FEF3C7' }]}>
                            <Feather name="clock" size={20} color="#F59E0B" />
                        </View>
                        <Text style={styles.statValue}>{stats.pending}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.statCard, filter === 'approved' && styles.statCardActive]}
                        onPress={() => setFilter('approved')}>
                        <View style={[styles.statIconContainer, { backgroundColor: '#D1FAE5' }]}>
                            <Feather name="check-circle" size={20} color="#10B981" />
                        </View>
                        <Text style={styles.statValue}>{stats.approved}</Text>
                        <Text style={styles.statLabel}>Approved</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Feather name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search distributors..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#9CA3AF"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Feather name="x" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Distributors List */}
                <View style={styles.listContainer}>
                    {filteredDistributors.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Feather name="inbox" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>No distributors found</Text>
                        </View>
                    ) : (
                        filteredDistributors.map((dist) => (
                            <TouchableOpacity
                                key={dist.id}
                                style={styles.distributorCard}
                                onPress={() => openDetails(dist)}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.avatarContainer}>
                                        <LinearGradient
                                            colors={['#8B5CF6', '#7C3AED']}
                                            style={styles.avatar}>
                                            <Text style={styles.avatarText}>
                                                {(dist.display_name || dist.contact_name || dist.email)?.[0]?.toUpperCase()}
                                            </Text>
                                        </LinearGradient>
                                    </View>
                                    <View style={styles.cardInfo}>
                                        <Text style={styles.distributorName}>
                                            {dist.display_name || dist.contact_name || 'Unnamed Distributor'}
                                        </Text>
                                        <Text style={styles.distributorEmail}>{dist.email}</Text>
                                        {dist.contact_mobile && (
                                            <Text style={styles.distributorPhone}>📱 {dist.contact_mobile}</Text>
                                        )}
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(dist.status) + '20' }]}>
                                        <Text style={[styles.statusText, { color: getStatusColor(dist.status) }]}>
                                            {dist.status}
                                        </Text>
                                    </View>
                                </View>

                                {(dist.city || dist.state) && (
                                    <View style={styles.locationRow}>
                                        <Feather name="map-pin" size={14} color="#9CA3AF" />
                                        <Text style={styles.locationText}>
                                            {[dist.city, dist.state].filter(Boolean).join(', ')}
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.viewDetailsBtn}>
                                    <Text style={styles.viewDetailsText}>View Complete Details</Text>
                                    <Feather name="chevron-right" size={16} color="#4F46E5" />
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Details Modal */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Distributor Profile</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Feather name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        {selectedDist && (
                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                <View style={styles.profileSection}>
                                    <LinearGradient
                                        colors={['#8B5CF6', '#7C3AED']}
                                        style={styles.largeAvatar}>
                                        <Text style={styles.largeAvatarText}>
                                            {(selectedDist.display_name || selectedDist.contact_name || selectedDist.email)?.[0]?.toUpperCase()}
                                        </Text>
                                    </LinearGradient>
                                    <Text style={styles.profileName}>{selectedDist.display_name || 'Unnamed'}</Text>
                                    <Text style={styles.profileEmail}>{selectedDist.email}</Text>
                                    <View style={[styles.profileStatusBadge, { backgroundColor: getStatusColor(selectedDist.status) + '20' }]}>
                                        <Text style={[styles.profileStatusText, { color: getStatusColor(selectedDist.status) }]}>
                                            {selectedDist.status.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.infoSection}>
                                    <Text style={styles.sectionLabel}>CONTACT INFORMATION</Text>
                                    <View style={styles.infoRow}>
                                        <Feather name="user" size={18} color="#6B7280" />
                                        <View style={styles.infoTextContainer}>
                                            <Text style={styles.infoLabel}>Contact Person</Text>
                                            <Text style={styles.infoValue}>{selectedDist.contact_name || 'Not provided'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Feather name="briefcase" size={18} color="#6B7280" />
                                        <View style={styles.infoTextContainer}>
                                            <Text style={styles.infoLabel}>Designation</Text>
                                            <Text style={styles.infoValue}>{selectedDist.contact_designation || 'Not provided'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Feather name="phone" size={18} color="#6B7280" />
                                        <View style={styles.infoTextContainer}>
                                            <Text style={styles.infoLabel}>Mobile Number</Text>
                                            <Text style={styles.infoValue}>{selectedDist.contact_mobile || 'Not provided'}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.infoSection}>
                                    <Text style={styles.sectionLabel}>LOCATION DETAILS</Text>
                                    <View style={styles.infoRow}>
                                        <Feather name="map-pin" size={18} color="#6B7280" />
                                        <View style={styles.infoTextContainer}>
                                            <Text style={styles.infoLabel}>Office Address</Text>
                                            <Text style={styles.infoValue}>{selectedDist.address || 'Not provided'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Feather name="truck" size={18} color="#6B7280" />
                                        <View style={styles.infoTextContainer}>
                                            <Text style={styles.infoLabel}>Warehouse Address</Text>
                                            <Text style={styles.infoValue}>{selectedDist.warehouse_address || 'Not provided'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Feather name="navigation" size={18} color="#6B7280" />
                                        <View style={styles.infoTextContainer}>
                                            <Text style={styles.infoLabel}>City & State</Text>
                                            <Text style={styles.infoValue}>
                                                {[selectedDist.city, selectedDist.state].filter(Boolean).join(', ') || 'Not provided'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.modalActions}>
                                    {selectedDist.status === 'pending' && (
                                        <View style={styles.approvalRow}>
                                            <TouchableOpacity
                                                style={[styles.modalActionBtn, styles.modalApproveBtn]}
                                                onPress={() => updateStatus(selectedDist.id, 'approved')}>
                                                <Feather name="check" size={20} color="#fff" />
                                                <Text style={styles.modalActionText}>Approve</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.modalActionBtn, styles.modalRejectBtn]}
                                                onPress={() => updateStatus(selectedDist.id, 'rejected')}>
                                                <Feather name="x" size={20} color="#fff" />
                                                <Text style={styles.modalActionText}>Reject</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        style={styles.removeBtn}
                                        onPress={() => removeDistributor(selectedDist.id)}>
                                        <Feather name="trash-2" size={20} color="#EF4444" />
                                        <Text style={styles.removeBtnText}>Remove Distributor</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ height: 40 }} />
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 16, fontSize: 16, color: '#6B7280', fontWeight: '600' },
    header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 24 },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
    headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff' },
    headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
    scrollView: { flex: 1 },
    statsRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 20, gap: 12 },
    statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
    statCardActive: { borderWidth: 2, borderColor: '#4F46E5' },
    statIconContainer: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
    statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, marginTop: 20, marginBottom: 16, paddingHorizontal: 16, height: 48, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
    searchIcon: { marginRight: 12 },
    searchInput: { flex: 1, fontSize: 16, color: '#111827' },
    listContainer: { paddingHorizontal: 20, paddingBottom: 100 },
    distributorCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    avatarContainer: { marginRight: 12 },
    avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
    cardInfo: { flex: 1 },
    distributorName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
    distributorEmail: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
    distributorPhone: { fontSize: 13, color: '#6B7280' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
    statusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
    locationText: { fontSize: 13, color: '#6B7280' },
    viewDetailsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    viewDetailsText: { fontSize: 14, fontWeight: '600', color: '#4F46E5' },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyText: { marginTop: 16, fontSize: 16, color: '#9CA3AF' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
    modalBody: { padding: 24 },
    profileSection: { alignItems: 'center', marginBottom: 32 },
    largeAvatar: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 16, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
    largeAvatarText: { fontSize: 40, fontWeight: '800', color: '#fff' },
    profileName: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
    profileEmail: { fontSize: 16, color: '#6B7280', marginBottom: 12 },
    profileStatusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
    profileStatusText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    infoSection: { marginBottom: 32 },
    sectionLabel: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, marginBottom: 16 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 16 },
    infoTextContainer: { flex: 1 },
    infoLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
    infoValue: { fontSize: 16, color: '#111827', fontWeight: '600' },
    modalActions: { gap: 12, marginTop: 8 },
    approvalRow: { flexDirection: 'row', gap: 12 },
    modalActionBtn: { flex: 1, height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    modalApproveBtn: { backgroundColor: '#10B981' },
    modalRejectBtn: { backgroundColor: '#EF4444' },
    modalActionText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    removeBtn: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#FEE2E2', backgroundColor: '#FFF5F5' },
    removeBtnText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
});
