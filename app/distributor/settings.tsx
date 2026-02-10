import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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

export default function DistributorSettings() {
    const { auth, logout } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({
        display_name: '',
        address: '',
        warehouse_address: '',
        contact_name: '',
        contact_designation: '',
        contact_mobile: '',
        city: '',
        state: '',
    });

    useEffect(() => {
        if (auth?.id) {
            fetchProfile();
        }
    }, [auth]);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('distributor_profiles')
                .select('*')
                .eq('user_id', auth?.id)
                .single();

            if (error) throw error;
            if (data) {
                setProfile({
                    display_name: data.display_name || '',
                    address: data.address || '',
                    warehouse_address: data.warehouse_address || '',
                    contact_name: data.contact_name || '',
                    contact_designation: data.contact_designation || '',
                    contact_mobile: data.contact_mobile || '',
                    city: data.city || '',
                    state: data.state || '',
                });
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to fetch profile.');
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async () => {
        try {
            setSaving(true);
            const { error } = await supabase
                .from('distributor_profiles')
                .update({
                    display_name: profile.display_name,
                    address: profile.address,
                    warehouse_address: profile.warehouse_address,
                    contact_name: profile.contact_name,
                    contact_designation: profile.contact_designation,
                    contact_mobile: profile.contact_mobile,
                    city: profile.city,
                    state: profile.state,
                })
                .eq('user_id', auth?.id);

            if (error) throw error;
            Alert.alert('Success', 'Profile updated successfully.');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#059669" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
                <TouchableOpacity onPress={logout}>
                    <Feather name="log-out" size={24} color="#EF4444" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Business Details</Text>

                        <Text style={styles.label}>Display Name</Text>
                        <TextInput
                            style={styles.input}
                            value={profile.display_name}
                            onChangeText={(v) => setProfile({ ...profile, display_name: v })}
                            placeholder="Business Name"
                        />

                        <Text style={styles.label}>Address</Text>
                        <TextInput
                            style={styles.input}
                            value={profile.address}
                            onChangeText={(v) => setProfile({ ...profile, address: v })}
                            placeholder="Registered Address"
                        />

                        <Text style={styles.label}>Warehouse Address</Text>
                        <TextInput
                            style={styles.input}
                            value={profile.warehouse_address}
                            onChangeText={(v) => setProfile({ ...profile, warehouse_address: v })}
                            placeholder="Warehouse Address"
                        />

                        <View style={styles.row}>
                            <View style={styles.halfInput}>
                                <Text style={styles.label}>City</Text>
                                <TextInput
                                    style={styles.input}
                                    value={profile.city}
                                    onChangeText={(v) => setProfile({ ...profile, city: v })}
                                    placeholder="City"
                                />
                            </View>
                            <View style={styles.halfInput}>
                                <Text style={styles.label}>State</Text>
                                <TextInput
                                    style={styles.input}
                                    value={profile.state}
                                    onChangeText={(v) => setProfile({ ...profile, state: v })}
                                    placeholder="State"
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contact Person</Text>

                        <Text style={styles.label}>Contact Name</Text>
                        <TextInput
                            style={styles.input}
                            value={profile.contact_name}
                            onChangeText={(v) => setProfile({ ...profile, contact_name: v })}
                            placeholder="Full Name"
                        />

                        <Text style={styles.label}>Designation</Text>
                        <TextInput
                            style={styles.input}
                            value={profile.contact_designation}
                            onChangeText={(v) => setProfile({ ...profile, contact_designation: v })}
                            placeholder="Job Title"
                        />

                        <Text style={styles.label}>Mobile Number</Text>
                        <TextInput
                            style={styles.input}
                            value={profile.contact_mobile}
                            onChangeText={(v) => setProfile({ ...profile, contact_mobile: v })}
                            placeholder="Phone Number"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.saveBtn, saving && styles.disabledBtn]}
                        onPress={saveProfile}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveBtnText}>Save Changes</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
    content: { padding: 20 },
    section: { marginBottom: 24, backgroundColor: '#fff', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#4B5563', marginBottom: 6 },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: '#111827',
        marginBottom: 16,
    },
    row: { flexDirection: 'row', gap: 12 },
    halfInput: { flex: 1 },
    saveBtn: {
        backgroundColor: '#059669',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#059669',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledBtn: { opacity: 0.7 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
