import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface PharmacyProfile {
  business_legal_name: string;
  trade_name: string;
  drug_license: string;
  contact_name: string;
  contact_designation: string;
  contact_mobile: string;
  city: string;
  state: string;
  email: string;
}

export default function SettingsScreen() {
  const { auth, logout } = useAuth();
  const [profile, setProfile] = useState<PharmacyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!auth?.id || auth.id === 'undefined') {
      console.warn('fetchProfile called without valid auth.id');
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pharmacy_profiles')
        .select('*')
        .eq('user_id', auth.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('pharmacy_profiles')
        .update({
          business_legal_name: profile.business_legal_name,
          trade_name: profile.trade_name,
          drug_license: profile.drug_license,
          contact_name: profile.contact_name,
          contact_designation: profile.contact_designation,
          contact_mobile: profile.contact_mobile,
          city: profile.city,
          state: profile.state,
        })
        .eq('user_id', auth?.id);

      if (error) throw error;
      Alert.alert('Success', 'Profile updated successfully.');
      setEditing(false);
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
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#7C3AED" />
          ) : (
            <Text style={styles.editBtn}>{editing ? 'Save' : 'Edit'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Information</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Legal Name</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={profile?.business_legal_name}
                editable={editing}
                onChangeText={(v) => setProfile(prev => prev ? { ...prev, business_legal_name: v } : null)}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Trade Name</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={profile?.trade_name}
                editable={editing}
                onChangeText={(v) => setProfile(prev => prev ? { ...prev, trade_name: v } : null)}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Drug License</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={profile?.drug_license}
                editable={editing}
                onChangeText={(v) => setProfile(prev => prev ? { ...prev, drug_license: v } : null)}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contact Name</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={profile?.contact_name}
                editable={editing}
                onChangeText={(v) => setProfile(prev => prev ? { ...prev, contact_name: v } : null)}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Number</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={profile?.contact_mobile}
                editable={editing}
                keyboardType="phone-pad"
                onChangeText={(v) => setProfile(prev => prev ? { ...prev, contact_mobile: v } : null)}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={profile?.email}
                editable={false}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={profile?.city}
                editable={editing}
                onChangeText={(v) => setProfile(prev => prev ? { ...prev, city: v } : null)}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={profile?.state}
                editable={editing}
                onChangeText={(v) => setProfile(prev => prev ? { ...prev, state: v } : null)}
              />
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  editBtn: { color: '#7C3AED', fontWeight: '700', fontSize: 16 },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  input: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111827', fontSize: 15 },
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, marginTop: 10 },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 16 },
});