import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { Caretaker, ElderlyUser } from '@/services/api';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { setTheme } = useTheme();

  const {
    caretaker,
    allCaretakers,
    elderlyUsers,
    selectedUser,
    loading,
    error,
    setCaretaker,
    setSelectedUser,
    addCaretaker,
    updateCaretaker,
    deleteCaretaker,
    addElderlyUser,
    updateElderlyUser,
    deleteElderlyUser,
    refreshData,
  } = useApp();

  // Modals state
  const [isAddCaretakerOpen, setIsAddCaretakerOpen] = useState(false);
  const [editingCaretaker, setEditingCaretaker] = useState<Caretaker | null>(null);
  const [isCaretakerManagerOpen, setIsCaretakerManagerOpen] = useState(false);

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ElderlyUser | null>(null);

  // Form States - Caretaker
  const [ctName, setCtName] = useState('');
  const [ctEmail, setCtEmail] = useState('');
  const [ctContact, setCtContact] = useState('');

  // Form States - Elderly User
  const [userName, setUserName] = useState('');
  const [userAge, setUserAge] = useState('');
  const [userRelation, setUserRelation] = useState('');
  const [userContact, setUserContact] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const theme = {
    background: isDark ? '#000000' : '#F2F2F7',
    cardBg: isDark ? '#1C1C1E' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8E8E93' : '#8E8E93',
    accent: '#007AFF',
    purple: '#8B5CF6',
    border: isDark ? '#38383A' : '#C6C6C8',
    danger: '#FF3B30',
    success: '#34C759',
    inputBg: isDark ? '#2C2C2E' : '#E5E5EA',
  };

  // Helper Initials
  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // ==========================================
  // CARETAKER CRUD HANDLERS
  // ==========================================

  const openAddCaretakerModal = () => {
    setCtName('');
    setCtEmail('');
    setCtContact('');
    setIsAddCaretakerOpen(true);
  };

  const openEditCaretakerModal = (c: Caretaker) => {
    setEditingCaretaker(c);
    setCtName(c.name);
    setCtEmail(c.email);
    setCtContact(c.contact);
  };

  const handleSaveAddCaretaker = async () => {
    if (!ctName.trim() || !ctEmail.trim() || !ctContact.trim()) {
      Alert.alert('Missing Fields', 'Please fill in Name, Email, and Contact for Caretaker.');
      return;
    }
    try {
      setSubmitting(true);
      await addCaretaker({
        name: ctName.trim(),
        email: ctEmail.trim(),
        contact: ctContact.trim(),
      });
      setIsAddCaretakerOpen(false);
      Alert.alert('Success', 'New caretaker added and set as active!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add caretaker');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditCaretaker = async () => {
    if (!editingCaretaker) return;
    if (!ctName.trim() || !ctEmail.trim() || !ctContact.trim()) {
      Alert.alert('Missing Fields', 'Please fill in Name, Email, and Contact for Caretaker.');
      return;
    }
    try {
      setSubmitting(true);
      await updateCaretaker(editingCaretaker.id, {
        name: ctName.trim(),
        email: ctEmail.trim(),
        contact: ctContact.trim(),
      });
      setEditingCaretaker(null);
      Alert.alert('Success', 'Caretaker updated successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update caretaker');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCaretaker = (c: Caretaker) => {
    if (allCaretakers.length <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one active caretaker in the system.');
      return;
    }
    Alert.alert('Delete Caretaker', `Are you sure you want to delete caretaker ${c.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCaretaker(c.id);
            Alert.alert('Deleted', 'Caretaker removed.');
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete caretaker');
          }
        },
      },
    ]);
  };

  // ==========================================
  // ELDERLY USER CRUD HANDLERS
  // ==========================================

  const openAddUserModal = () => {
    setUserName('');
    setUserAge('');
    setUserRelation('');
    setUserContact('');
    setIsAddUserOpen(true);
  };

  const openEditUserModal = (u: ElderlyUser) => {
    setEditingUser(u);
    setUserName(u.name);
    setUserAge(u.age ? u.age.toString() : '');
    setUserRelation(u.relation);
    setUserContact(u.contact);
  };

  const handleSaveAddUser = async () => {
    if (!userName.trim() || !userAge.trim() || !userRelation.trim() || !userContact.trim()) {
      Alert.alert('Missing Fields', 'Please fill in Name, Age, Relation, and Contact for Elderly User.');
      return;
    }
    const ageNum = parseInt(userAge, 10);
    if (isNaN(ageNum) || ageNum <= 0) {
      Alert.alert('Invalid Age', 'Please enter a valid age number.');
      return;
    }

    try {
      setSubmitting(true);
      await addElderlyUser({
        name: userName.trim(),
        age: ageNum,
        relation: userRelation.trim(),
        contact: userContact.trim(),
      });
      setIsAddUserOpen(false);
      Alert.alert('Success', 'Elderly user added to Neon database!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add elderly user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditUser = async () => {
    if (!editingUser) return;
    if (!userName.trim() || !userAge.trim() || !userRelation.trim() || !userContact.trim()) {
      Alert.alert('Missing Fields', 'Please fill in Name, Age, Relation, and Contact for Elderly User.');
      return;
    }
    const ageNum = parseInt(userAge, 10);
    if (isNaN(ageNum) || ageNum <= 0) {
      Alert.alert('Invalid Age', 'Please enter a valid age number.');
      return;
    }

    try {
      setSubmitting(true);
      await updateElderlyUser(editingUser.id, {
        name: userName.trim(),
        age: ageNum,
        relation: userRelation.trim(),
        contact: userContact.trim(),
      });
      setEditingUser(null);
      Alert.alert('Success', 'Elderly user profile updated in database!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update elderly user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = (u: ElderlyUser) => {
    Alert.alert('Delete Elderly User', `Are you sure you want to remove ${u.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteElderlyUser(u.id);
            Alert.alert('Deleted', 'Elderly user removed from database.');
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete user');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Profiles & Accounts</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={refreshData}>
          <Feather name="refresh-cw" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* ========================================== */}
        {/* 1. CARETAKER TABLE SECTION (CRUD) */}
        {/* ========================================== */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Caretaker ({allCaretakers.length})
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              style={[styles.headerActionBtn, { backgroundColor: theme.inputBg }]}
              onPress={() => setIsCaretakerManagerOpen(true)}
            >
              <Feather name="users" size={14} color={theme.accent} style={{ marginRight: 4 }} />
              <Text style={[styles.headerActionText, { color: theme.accent }]}>Manage</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerActionBtn, { backgroundColor: theme.accent, marginLeft: 6 }]}
              onPress={openAddCaretakerModal}
            >
              <Feather name="plus" size={14} color="#FFF" style={{ marginRight: 2 }} />
              <Text style={[styles.headerActionText, { color: '#FFF' }]}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: theme.purple }]}>
              <Text style={styles.avatarText}>{getInitials(caretaker?.name || 'Steve Rogers')}</Text>
            </View>
            <View style={styles.profileDetails}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.name, { color: theme.textPrimary }]}>
                  {caretaker?.name || 'Steve Rogers'}
                </Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>ACTIVE CARETAKER</Text>
                </View>
              </View>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>
                {caretaker?.email || 'steve.rogers@example.com'}
              </Text>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>
                {caretaker?.contact || '+91 9876543210'}
              </Text>
            </View>
          </View>

          <View style={[styles.separator, { backgroundColor: theme.border, marginVertical: 14 }]} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity
              style={[styles.caretakerActionBtn, { backgroundColor: theme.inputBg }]}
              onPress={() => caretaker && openEditCaretakerModal(caretaker)}
            >
              <Feather name="edit-2" size={16} color={theme.accent} />
              <Text style={[styles.caretakerActionText, { color: theme.accent }]}>Edit Caretaker</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.caretakerActionBtn, { backgroundColor: theme.inputBg }]}
              onPress={() => setIsCaretakerManagerOpen(true)}
            >
              <Feather name="repeat" size={16} color={theme.purple} />
              <Text style={[styles.caretakerActionText, { color: theme.purple }]}>Switch Caretaker</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================== */}
        {/* 2. ELDERLY USER TABLE SECTION (CRUD) */}
        {/* ========================================== */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Guardian360 Users ({elderlyUsers.length})
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={{ color: theme.textSecondary, marginTop: 8 }}>Fetching DB profiles...</Text>
          </View>
        ) : error ? (
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={{ color: theme.danger, marginBottom: 8 }}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={refreshData}>
              <Text style={{ color: '#FFF', fontWeight: '600' }}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, padding: 0 }]}>
            {elderlyUsers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="person-add-outline" size={48} color={theme.accent} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Guardian360 User Profiles</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary, marginBottom: 16 }]}>
                  Add a user profile to start tracking health metrics and fall risks under Caretaker {caretaker?.name || 'Steve Rogers'}.
                </Text>
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: theme.accent, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4, width: '100%' }]}
                  onPress={openAddUserModal}
                >
                  <Text style={styles.submitBtnText}>+ Add Guardian360 User</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {elderlyUsers.map((user, index) => {
                  const isSelected = selectedUser?.id === user.id;
                  return (
                    <React.Fragment key={user.id}>
                      {index > 0 && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
                      <TouchableOpacity
                        style={[styles.memberRow, isSelected && { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
                        onPress={() => setSelectedUser(user)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.memberAvatar, { backgroundColor: isSelected ? theme.accent : theme.border }]}>
                          <Text style={[styles.memberInitials, { color: '#FFF' }]}>{getInitials(user.name)}</Text>
                        </View>

                        <View style={styles.memberDetails}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.memberName, { color: theme.textPrimary }]}>{user.name}</Text>
                            {isSelected && (
                              <View style={styles.selectedUserBadge}>
                                <Text style={styles.activeBadgeText}>SELECTED</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.memberRelation, { color: theme.textSecondary }]}>
                            {user.relation} • {user.age} yrs
                          </Text>
                          <Text style={[styles.memberContact, { color: theme.textSecondary }]}>{user.contact}</Text>
                        </View>

                        <View style={styles.actionButtonsRow}>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => openEditUserModal(user)}>
                            <Feather name="edit-2" size={18} color={theme.accent} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteUser(user)}>
                            <Feather name="trash-2" size={18} color={theme.danger} />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}

                <View style={[styles.separator, { backgroundColor: theme.border }]} />

                {/* Add User Button */}
                <TouchableOpacity style={styles.addMemberBtn} onPress={openAddUserModal}>
                  <Feather name="user-plus" size={20} color={theme.accent} />
                  <Text style={[styles.addMemberText, { color: theme.accent }]}>
                    Add Guardian360 User
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Settings Card */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Preferences</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border, padding: 0 }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#8B5CF6' }]}>
                <Feather name="moon" size={18} color="#FFF" />
              </View>
              <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
              trackColor={{ false: theme.border, true: theme.accent }}
            />
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ========================================== */}
      {/* MODAL 1: ADD CARETAKER MODAL */}
      {/* ========================================== */}
      <Modal visible={isAddCaretakerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Create New Caretaker</Text>
              <TouchableOpacity onPress={() => setIsAddCaretakerOpen(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                placeholder="e.g. Dr. Hank Pym"
                placeholderTextColor={theme.textSecondary}
                value={ctName}
                onChangeText={setCtName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Email Address</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                placeholder="e.g. hank.pym@example.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                value={ctEmail}
                onChangeText={setCtEmail}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Contact Phone</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                placeholder="e.g. +91 9876543212"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                value={ctContact}
                onChangeText={setCtContact}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: theme.purple }]}
              onPress={handleSaveAddCaretaker}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>Insert Caretaker into DB</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL 2: EDIT CARETAKER MODAL */}
      {/* ========================================== */}
      <Modal visible={!!editingCaretaker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Edit Caretaker Details</Text>
              <TouchableOpacity onPress={() => setEditingCaretaker(null)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                value={ctName}
                onChangeText={setCtName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Email Address</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                keyboardType="email-address"
                autoCapitalize="none"
                value={ctEmail}
                onChangeText={setCtEmail}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Contact Phone</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                keyboardType="phone-pad"
                value={ctContact}
                onChangeText={setCtContact}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: theme.purple }]}
              onPress={handleSaveEditCaretaker}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>Update Caretaker in DB</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL 3: CARETAKER MANAGER & SWITCHER */}
      {/* ========================================== */}
      <Modal visible={isCaretakerManagerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Manage Caretakers</Text>
              <TouchableOpacity onPress={() => setIsCaretakerManagerOpen(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {allCaretakers.map((c) => {
                const isActive = caretaker?.id === c.id;
                return (
                  <View
                    key={c.id}
                    style={[
                      styles.caretakerManagerRow,
                      { backgroundColor: theme.inputBg, borderColor: isActive ? theme.purple : 'transparent' },
                    ]}
                  >
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => {
                        setCaretaker(c);
                        setIsCaretakerManagerOpen(false);
                      }}
                    >
                      <View style={[styles.avatarSmall, { backgroundColor: isActive ? theme.purple : theme.border }]}>
                        <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>{getInitials(c.name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 16 }}>
                          {c.name} {isActive ? '(Active)' : ''}
                        </Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{c.email}</Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{c.contact}</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => {
                          setIsCaretakerManagerOpen(false);
                          openEditCaretakerModal(c);
                        }}
                      >
                        <Feather name="edit-2" size={16} color={theme.accent} />
                      </TouchableOpacity>

                      {!isActive && (
                        <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteCaretaker(c)}>
                          <Feather name="trash-2" size={16} color={theme.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: theme.accent, marginTop: 16 }]}
              onPress={() => {
                setIsCaretakerManagerOpen(false);
                openAddCaretakerModal();
              }}
            >
              <Text style={styles.submitBtnText}>+ Add New Caretaker</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL 4: ADD ELDERLY USER MODAL */}
      {/* ========================================== */}
      <Modal visible={isAddUserOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Add Elderly User</Text>
              <TouchableOpacity onPress={() => setIsAddUserOpen(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                placeholder="e.g. Jane Doe"
                placeholderTextColor={theme.textSecondary}
                value={userName}
                onChangeText={setUserName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Age</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                placeholder="e.g. 78"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={userAge}
                onChangeText={setUserAge}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Relation</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                placeholder="e.g. Mother, Father, Grandparent"
                placeholderTextColor={theme.textSecondary}
                value={userRelation}
                onChangeText={setUserRelation}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Contact Phone</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                placeholder="e.g. +91 9876543210"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                value={userContact}
                onChangeText={setUserContact}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: theme.accent }]}
              onPress={handleSaveAddUser}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>Insert Elderly User into DB</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL 5: EDIT ELDERLY USER MODAL */}
      {/* ========================================== */}
      <Modal visible={!!editingUser} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Edit Elderly User Profile</Text>
              <TouchableOpacity onPress={() => setEditingUser(null)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                value={userName}
                onChangeText={setUserName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Age</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                keyboardType="numeric"
                value={userAge}
                onChangeText={setUserAge}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Relation</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                value={userRelation}
                onChangeText={setUserRelation}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Contact Phone</Text>
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg }]}
                keyboardType="phone-pad"
                value={userContact}
                onChangeText={setUserContact}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: theme.accent }]}
              onPress={handleSaveEditUser}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>Update Elderly User in DB</Text>
              )}
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
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  profileDetails: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
  },
  detail: {
    fontSize: 13,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  activeBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  caretakerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  caretakerActionText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  separator: {
    height: 1,
    width: '100%',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  memberInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectedUserBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  memberRelation: {
    fontSize: 13,
    marginTop: 2,
  },
  memberContact: {
    fontSize: 13,
    marginTop: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 8,
    marginLeft: 4,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  addMemberText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  centerContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  caretakerManagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
