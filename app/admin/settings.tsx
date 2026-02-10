import { useAuth } from '@/context/AuthContext';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function SettingsTab() {
    const { auth, logout } = useAuth();
    const router = useRouter();

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Logout', style: 'destructive', onPress: logout },
            ]
        );
    };

    const menuItems = [
        {
            title: 'Management',
            items: [
                { id: 'products', title: 'Manage Products', icon: 'box', route: '/admin/management/products' },
                { id: 'mapping', title: 'Distributor Mapping', icon: 'link', route: '/admin/management/mapping' },
                { id: 'brochures', title: 'Manage Brochures', icon: 'file-text', route: '/admin/management/brochures' },
            ]
        },
        {
            title: 'Support & Help',
            items: [
                { id: 'help', title: 'Help Center', icon: 'help-circle', route: null },
                { id: 'contact', title: 'Contact Support', icon: 'mail', route: null },
                { id: 'privacy', title: 'Privacy Policy', icon: 'shield', route: null },
            ]
        }
    ];

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={['#4B5563', '#1F2937']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}>
                <View style={styles.profileSection}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>A</Text>
                    </View>
                    <View>
                        <Text style={styles.adminName}>Administrator</Text>
                        <Text style={styles.adminEmail}>{auth?.email || 'admin@hercircle.com'}</Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView style={styles.scrollView}>
                <View style={styles.content}>
                    {menuItems.map((section, idx) => (
                        <View key={idx} style={styles.section}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            <View style={styles.menuCard}>
                                {section.items.map((item, itemIdx) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[
                                            styles.menuItem,
                                            itemIdx === section.items.length - 1 && { borderBottomWidth: 0 }
                                        ]}
                                        onPress={() => item.route && router.push(item.route as any)}>
                                        <View style={styles.menuItemLeft}>
                                            <View style={styles.iconContainer}>
                                                <Feather name={item.icon as any} size={18} color="#4F46E5" />
                                            </View>
                                            <Text style={styles.menuItemText}>{item.title}</Text>
                                        </View>
                                        <Feather name="chevron-right" size={18} color="#9CA3AF" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                        <Feather name="log-out" size={20} color="#EF4444" />
                        <Text style={styles.logoutText}>Logout from Account</Text>
                    </TouchableOpacity>

                    <Text style={styles.versionText}>Version 1.0.0 (Build 20260118)</Text>
                </View>
            </ScrollView>
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
        paddingBottom: 30,
        paddingHorizontal: 24,
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
    },
    adminName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    adminEmail: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 100,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
        marginLeft: 4,
    },
    menuCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuItemText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#FEF2F2',
        paddingVertical: 16,
        borderRadius: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
    },
    versionText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 24,
    },
});
