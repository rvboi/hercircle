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

interface Pharmacy {
    id: string;
    user_id: string;
    role: string;
    status: 'pending' | 'approved' | 'rejected';
    email: string;
    business_legal_name?: string;
    trade_name?: string;
    drug_license?: string;
    contact_name?: string;
    contact_designation?: string;
    contact_mobile?: string;
    city?: string;
    state?: string;
    distributor_id?: string;
    created_at: string;
}

export default function PharmaciesTab() {
    const router = useRouter();
    const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

    // Detail Modal State
    const [selectedPharm, setSelectedPharm] = useState<Pharmacy | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const fetchPharmacies = async () => {
        try {
            let query = supabase
                .from('pharmacy_profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query;

            if (error) throw error;
            setPharmacies(data || []);
        } catch (error) {
            console.error('Error fetching pharmacies:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPharmacies();
    }, [filter]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPharmacies();
    }, [filter]);

    const updateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('pharmacy_profiles')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            if (selectedPharm && selectedPharm.id === id) {
                setSelectedPharm({ ...selectedPharm, status: newStatus });
            }

            fetchPharmacies();
            Alert.alert('Success', `Pharmacy ${newStatus} successfully.`);
        } catch (error) {
            console.error('Error updating status:', error);
            Alert.alert('Error', 'Failed to update status.');
        }
    };

    const removePharmacy = async (id: string) => {
        Alert.alert(
            'Remove Pharmacy',
            'Are you sure you want to remove this pharmacy? This will delete their profile record.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const { error } = await supabase
                                .from('pharmacy_profiles')
                                .delete()
                                .eq('id', id);

                            if (error) throw error;

                            setPharmacies(pharmacies.filter(p => p.id !== id));
                            setModalVisible(false);
                            Alert.alert('Success', 'Pharmacy removed successfully.');
                        } catch (e: any) {
                            console.error(e);
                            Alert.alert('Error', e.message || 'Failed to remove pharmacy.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const filteredPharmacies = pharmacies.filter(pharm => {
        const searchLower = searchQuery.toLowerCase();
        return (
            pharm.business_legal_name?.toLowerCase().includes(searchLower) ||
            pharm.trade_name?.toLowerCase().includes(searchLower) ||
            pharm.contact_name?.toLowerCase().includes(searchLower) ||
            pharm.email?.toLowerCase().includes(searchLower) ||
            pharm.city?.toLowerCase().includes(searchLower)
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
        total: pharmacies.length,
        pending: pharmacies.filter(p => p.status === 'pending').length,
        approved: pharmacies.filter(p => p.status === 'approved').length,
        rejected: pharmacies.filter(p => p.status === 'rejected').length,
    };

    const openDetails = (pharm: Pharmacy) => {
        setSelectedPharm(pharm);
        setModalVisible(true);
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={styles.loadingText}>Loading Pharmacies...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Feather name="chevron-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.headerTitle}>Pharmacies</Text>
                        <Text style={styles.headerSubtitle}>{stats.total} Total Registered</Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
                }>

                {/* Stats Cards */}
                <View style={styles.statsRow}>
                    <TouchableOpacity
                        style={[styles.statCard, filter === 'all' && styles.statCardActive]}
                        onPress={() => setFilter('all')}>
                        <View style={[styles.statIconContainer, { backgroundColor: '#D1FAE5' }]}>
                            <Feather name="plus-square" size={20} color="#10B981" />
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
                        <View style={[styles.statIconContainer, { backgroundColor: '#DBEAFE' }]}>
                            <Feather name="check-circle" size={20} color="#3B82F6" />
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
                        placeholder="Search pharmacies..."
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

                {/* Pharmacies List */}
                <View style={styles.listContainer}>
                    {filteredPharmacies.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Feather name="inbox" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>No pharmacies found</Text>
                        </View>
                    ) : (
                        filteredPharmacies.map((pharm) => (
                            <TouchableOpacity
                                key={pharm.id}
                                style={styles.pharmacyCard}
                                onPress={() => openDetails(pharm)}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.avatarContainer}>
                                        <LinearGradient
                                            colors={['#10B981', '#059669']}
                                            style={styles.avatar}>
                                            <Text style={styles.avatarText}>
                                                {(pharm.trade_name || pharm.business_legal_name || pharm.email)?.[0]?.toUpperCase()}
                                            </Text>
                                        </LinearGradient>
                                    </View>
                                    <View style={styles.cardInfo}>
                                        <Text style={styles.pharmacyName}>
                                            {pharm.trade_name || pharm.business_legal_name || 'Unnamed Pharmacy'}
                                        </Text>
                                        <Text style={styles.pharmacyEmail}>{pharm.email}</Text>
                                        {pharm.contact_mobile && (
                                            <Text style={styles.pharmacyPhone}>📱 {pharm.contact_mobile}</Text>
                                        )}
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(pharm.status) + '20' }]}>
                                        <Text style={[styles.statusText, { color: getStatusColor(pharm.status) }]}>
                                            {pharm.status}
                                        </Text>
                                    </View>
                                </View>

                                {(pharm.city || pharm.state) && (
                                    <View style={styles.locationRow}>
                                        <Feather name="map-pin" size={14} color="#9CA3AF" />
                                        <Text style={styles.locationText}>
                                            {[pharm.city, pharm.state].filter(Boolean).join(', ')}
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.viewDetailsBtn}>
                                    <Text style={styles.viewDetailsText}>View Complete Details</Text>
                                    <Feather name="chevron-right" size={16} color="#10B981" />
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
                            <Text style={styles.modalTitle}>Pharmacy Profile</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Feather name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        {selectedPharm && (
                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                <View style={styles.profileSection}>
                                    <LinearGradient
                                        colors={['#10B981', '#059669']}
                                        style={styles.largeAvatar}>
                                        <Text style={styles.largeAvatarText}>
                                            {(selectedPharm.trade_name || selectedPharm.business_legal_name || selectedPharm.email)?.[0]?.toUpperCase()}
                                        </Text>
                                    </LinearGradient>
                                    <Text style={styles.profileName}>{selectedPharm.trade_name || 'Unnamed'}</Text>
                                    <Text style={styles.profileEmail}>{selectedPharm.email}</Text>
                                    <View style={[styles.profileStatusBadge, { backgroundColor: getStatusColor(selectedPharm.status) + '20' }]}>
                                        <Text style={[styles.profileStatusText, { color: getStatusColor(selectedPharm.status) }]}>
                                            {selectedPharm.status.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.infoSection}>
                                    <Text style={styles.sectionLabel}>BUSINESS INFORMATION</Text>
                                    <View style={styles.infoRow}>
                                        <Feather name="file-text" size={18} color="#6B7280" />
                                        <View style={styles.infoTextContainer}>
                                            <Text style={styles.infoLabel}>Legal Business Name</Text>
                                            <Text style={styles.infoValue}>{selectedPharm.business_legal_name || 'Not provided'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Feather name="award" size={18} color="#6B7280" />
                                        <View style={styles.infoTextContainer}>
                                            <Text style={styles.infoLabel}>Drug License Number</Text>
                                            <Text style={styles.infoValue}>{selectedPharm.drug_license || 'Not provided'}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.infoSection}>
                                    <Text style={styles.sectionLabel}>CONTACT INFORMATION</Text>
                                    <View style={styles.infoRow}>
                                        <Feather name="user" size={18} color="#6B7280" />
                                        <View style={styles.infoTextContainer}>
                                            <Text style={styles.infoLabel}>Contact Person</Text>
                                            <Text style={styles.infoValue}>{selectedPharm.contact_name || 'Not provided'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Feather name="briefcase" size={18} color="#6B7280" />
                                        <View style={styles.infoTextContainer}>
                                            <Text style={styles.infoLabel}>Designation</Text>
                                            <Text style={styles.infoValue}>{selectedPharm.contact_designation || 'Not provided'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Feather name="phone" size={18} color="#6B7280" />
                                        <View style={styles.infoTextContainer}>
                                            <Text style={styles.infoLabel}>Mobile Number</Text>
                                            <Text style={styles.infoValue}>{selectedPharm.contact_mobile || 'Not provided'}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.infoSection}>
                                    <Text style={styles.sectionLabel}>LOCATION DETAILS</Text>
                                    <View style={styles.infoRow}>
                                        <Feather name="navigation" size={18} color="#6B7280" />
                                        <View style={styles.infoTextContainer}>
                                            <Text style={styles.infoLabel}>City & State</Text>
                                            <Text style={styles.infoValue}>
                                                {[selectedPharm.city, selectedPharm.state].filter(Boolean).join(', ') || 'Not provided'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.modalActions}>
                                    {selectedPharm.status === 'pending' && (
                                        <View style={styles.approvalRow}>
                                            <TouchableOpacity
                                                style={[styles.modalActionBtn, styles.modalApproveBtn]}
                                                onPress={() => updateStatus(selectedPharm.id, 'approved')}>
                                                <Feather name="check" size={20} color="#fff" />
                                                <Text style={styles.modalActionText}>Approve</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.modalActionBtn, styles.modalRejectBtn]}
                                                onPress={() => updateStatus(selectedPharm.id, 'rejected')}>
                                                <Feather name="x" size={20} color="#fff" />
                                                <Text style={styles.modalActionText}>Reject</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        style={styles.removeBtn}
                                        onPress={() => removePharmacy(selectedPharm.id)}>
                                        <Feather name="trash-2" size={20} color="#EF4444" />
                                        <Text style={styles.removeBtnText}>Remove Pharmacy</Text>
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
    statCardActive: { borderWidth: 2, borderColor: '#10B981' },
    statIconContainer: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
    statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, marginTop: 20, marginBottom: 16, paddingHorizontal: 16, height: 48, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
    searchIcon: { marginRight: 12 },
    searchInput: { flex: 1, fontSize: 16, color: '#111827' },
    listContainer: { paddingHorizontal: 20, paddingBottom: 100 },
    pharmacyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    avatarContainer: { marginRight: 12 },
    avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
    cardInfo: { flex: 1 },
    pharmacyName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
    pharmacyEmail: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
    pharmacyPhone: { fontSize: 13, color: '#6B7280' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
    statusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
    locationText: { fontSize: 13, color: '#6B7280' },
    viewDetailsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    viewDetailsText: { fontSize: 14, fontWeight: '600', color: '#10B981' },
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
