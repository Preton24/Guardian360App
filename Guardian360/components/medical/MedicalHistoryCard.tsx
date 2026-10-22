import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  api,
  MedicalRecordItem,
  MedicationItem,
  AllergyItem,
  RecordType,
} from '@/services/api';

const RECORD_TYPES: { key: string; label: string; icon: any; color: string; bg: string }[] = [
  { key: 'ALL', label: 'All', icon: 'layers', color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)' },
  { key: 'CONSULTATION', label: 'Consult', icon: 'user-check', color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.15)' },
  { key: 'PRESCRIPTION', label: 'Rx', icon: 'file-text', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' },
  { key: 'LAB_REPORT', label: 'Lab', icon: 'activity', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  { key: 'IMAGING', label: 'Imaging', icon: 'image', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  { key: 'DISCHARGE', label: 'Discharge', icon: 'log-out', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)' },
  { key: 'VACCINATION', label: 'Vaccine', icon: 'shield', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)' },
  { key: 'OTHER', label: 'Other', icon: 'paperclip', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.15)' },
];

interface MedicalHistoryCardProps {
  userId: string;
  theme: any;
  isDark: boolean;
  onRecordsUpdated?: () => void;
}

export default function MedicalHistoryCard({
  userId,
  theme,
  isDark,
  onRecordsUpdated,
}: MedicalHistoryCardProps) {
  const [records, setRecords] = useState<MedicalRecordItem[]>([]);
  const [activeMeds, setActiveMeds] = useState<MedicationItem[]>([]);
  const [allergies, setAllergies] = useState<AllergyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecordItem | null>(null);
  const [formModalOpen, setFormModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [allergyModalOpen, setAllergyModalOpen] = useState<boolean>(false);
  const [activeMedsModalOpen, setActiveMedsModalOpen] = useState<boolean>(false);

  // Form Fields
  const [formType, setFormType] = useState<RecordType>('CONSULTATION');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formDoctor, setFormDoctor] = useState<string>('');
  const [formSpecialty, setFormSpecialty] = useState<string>('');
  const [formFacility, setFormFacility] = useState<string>('');
  const [formDiagnosis, setFormDiagnosis] = useState<string>('');
  const [formComplaints, setFormComplaints] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formFollowUp, setFormFollowUp] = useState<string>('');
  const [formMeds, setFormMeds] = useState<MedicationItem[]>([]);
  const [attachedFile, setAttachedFile] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);
  const [savingRecord, setSavingRecord] = useState<boolean>(false);

  // Allergy Form Field
  const [allergySubstance, setAllergySubstance] = useState<string>('');
  const [allergyReaction, setAllergyReaction] = useState<string>('');
  const [savingAllergy, setSavingAllergy] = useState<boolean>(false);

  // Reminders conversion loading
  const [convertingReminders, setConvertingReminders] = useState<boolean>(false);

  // Load Data
  const loadVaultData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const [recs, meds, alls] = await Promise.all([
        api.getUserRecords(userId, { type: selectedType }),
        api.getActiveMedications(userId).catch(() => []),
        api.getUserAllergies(userId).catch(() => []),
      ]);
      setRecords(recs);
      setActiveMeds(meds);
      setAllergies(alls);
    } catch (err: any) {
      console.warn('[MedicalHistoryCard] Load error:', err.message || err);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedType]);

  useEffect(() => {
    loadVaultData();
  }, [loadVaultData]);

  // Open Add Record Form
  const openAddForm = () => {
    setIsEditing(false);
    setEditingRecordId(null);
    setFormType('CONSULTATION');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDoctor('');
    setFormSpecialty('');
    setFormFacility('');
    setFormDiagnosis('');
    setFormComplaints('');
    setFormNotes('');
    setFormFollowUp('');
    setFormMeds([]);
    setAttachedFile(null);
    setFormModalOpen(true);
  };

  // Open Edit Record Form
  const openEditForm = (rec: MedicalRecordItem) => {
    setIsEditing(true);
    setEditingRecordId(rec.id);
    setFormType(rec.type);
    setFormDate(new Date(rec.recordDate).toISOString().split('T')[0]);
    setFormDoctor(rec.doctorName || '');
    setFormSpecialty(rec.specialty || '');
    setFormFacility(rec.facility || '');
    setFormDiagnosis(rec.diagnosis || '');
    setFormComplaints(rec.complaints || '');
    setFormNotes(rec.notes || '');
    setFormFollowUp(rec.followUpDate ? new Date(rec.followUpDate).toISOString().split('T')[0] : '');
    setFormMeds(
      rec.medications
        ? rec.medications.map((m) => ({
            name: m.name,
            genericName: m.genericName || '',
            strength: m.strength || '',
            dosePattern: m.dosePattern || '1-0-1',
            timing: m.timing || 'after food',
            durationDays: m.durationDays || 30,
          }))
        : []
    );
    setAttachedFile(null);
    setDetailModalOpen(false);
    setFormModalOpen(true);
  };

  // Add Medication Row to Form
  const addMedRow = () => {
    setFormMeds((prev) => [
      ...prev,
      {
        name: '',
        genericName: '',
        strength: '',
        dosePattern: '1-0-1',
        timing: 'after food',
        durationDays: 30,
      },
    ]);
  };

  const updateMedRow = (index: number, key: keyof MedicationItem, value: any) => {
    setFormMeds((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  const removeMedRow = (index: number) => {
    setFormMeds((prev) => prev.filter((_, i) => i !== index));
  };

  // Attach Image via expo-image-picker
  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.uri;
        const name = asset.fileName || `prescription_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || 'image/jpeg';
        setAttachedFile({ uri, name, mimeType });
      }
    } catch (err: any) {
      Alert.alert('Error', 'Could not open photo library: ' + err.message);
    }
  };

  // Attach Document via expo-document-picker
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAttachedFile({
          uri: asset.uri,
          name: asset.name || 'medical_report.pdf',
          mimeType: asset.mimeType || 'application/pdf',
        });
      }
    } catch (err: any) {
      Alert.alert('Error', 'Could not pick document: ' + err.message);
    }
  };

  // Submit Save Record
  const handleSaveRecord = async () => {
    if (!formDiagnosis.trim() && !formDoctor.trim() && formMeds.length === 0) {
      Alert.alert('Incomplete Record', 'Please enter at least a doctor name, diagnosis, or medication.');
      return;
    }

    try {
      setSavingRecord(true);
      const payload = {
        type: formType,
        recordDate: formDate,
        doctorName: formDoctor.trim() || null,
        specialty: formSpecialty.trim() || null,
        facility: formFacility.trim() || null,
        diagnosis: formDiagnosis.trim() || null,
        complaints: formComplaints.trim() || null,
        notes: formNotes.trim() || null,
        followUpDate: formFollowUp.trim() || null,
        medications: formMeds.filter((m) => m.name.trim().length > 0),
      };

      let savedRecord: MedicalRecordItem;
      if (isEditing && editingRecordId) {
        savedRecord = await api.updateRecord(editingRecordId, payload);
      } else {
        savedRecord = await api.createRecord(userId, payload);
      }

      // If a file was attached, upload it
      if (attachedFile && savedRecord.id) {
        try {
          await api.uploadRecordFile(
            savedRecord.id,
            attachedFile.uri,
            attachedFile.mimeType,
            attachedFile.name
          );
        } catch (uploadErr: any) {
          console.warn('File upload error:', uploadErr.message);
        }
      }

      setFormModalOpen(false);
      await loadVaultData();
      if (onRecordsUpdated) onRecordsUpdated();
      Alert.alert('Success', `Medical record ${isEditing ? 'updated' : 'saved'} successfully.`);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save record');
    } finally {
      setSavingRecord(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async (recordId: string) => {
    Alert.alert(
      'Delete Medical Record',
      'Are you sure you want to delete this record? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteRecord(recordId);
              setDetailModalOpen(false);
              await loadVaultData();
              if (onRecordsUpdated) onRecordsUpdated();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete record');
            }
          },
        },
      ]
    );
  };

  // Convert Record Medications to Reminders
  const handleCreateReminders = async (recordId: string) => {
    try {
      setConvertingReminders(true);
      const res = await api.createRemindersFromRecord(recordId);
      Alert.alert(
        'Reminders Created',
        res.message || 'Medication reminders added to daily schedule.'
      );
    } catch (err: any) {
      Alert.alert('Reminder Conversion', err.message || 'Failed to create reminders');
    } finally {
      setConvertingReminders(false);
    }
  };

  // Add Allergy
  const handleSaveAllergy = async () => {
    if (!allergySubstance.trim()) {
      Alert.alert('Required', 'Please enter allergen substance name.');
      return;
    }
    try {
      setSavingAllergy(true);
      await api.createAllergy(userId, {
        substance: allergySubstance.trim(),
        reaction: allergyReaction.trim() || null,
      });
      setAllergySubstance('');
      setAllergyReaction('');
      setAllergyModalOpen(false);
      await loadVaultData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not add allergy');
    } finally {
      setSavingAllergy(false);
    }
  };

  // Delete Allergy
  const handleDeleteAllergy = (allergyId: string, substance: string) => {
    Alert.alert('Remove Allergy', `Remove allergy record for "${substance}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAllergy(userId, allergyId);
            await loadVaultData();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not delete allergy');
          }
        },
      },
    ]);
  };

  // Group Records by Month
  const groupRecordsByMonth = () => {
    const groups: { [monthKey: string]: MedicalRecordItem[] } = {};
    for (const rec of records) {
      const d = new Date(rec.recordDate);
      const monthKey = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(rec);
    }
    return Object.entries(groups);
  };

  const monthGroups = groupRecordsByMonth();

  const getTypeStyle = (type: string) => {
    return (
      RECORD_TYPES.find((t) => t.key === type) || {
        key: type,
        label: type,
        icon: 'file-text',
        color: theme.accent,
        bg: 'rgba(14, 165, 233, 0.15)',
      }
    );
  };

  return (
    <View style={[styles.cardContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.titleWrapper}>
          <View style={[styles.headerIconContainer, { backgroundColor: 'rgba(14, 165, 233, 0.15)' }]}>
            <MaterialCommunityIcons name="folder-text-outline" size={24} color={theme.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Medical History Vault</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
              {records.length} records • Consultations, Rx & Reports
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addRecordBtn, { backgroundColor: theme.accent }]}
          onPress={openAddForm}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color="#FFF" style={{ marginRight: 4 }} />
          <Text style={styles.addRecordBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Top Banner: Active Meds & Allergies Highlights */}
      <View style={[styles.topSummaryBar, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
        {/* Active Meds Chip */}
        <TouchableOpacity
          style={styles.summaryBadge}
          onPress={() => setActiveMedsModalOpen(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.badgeDot, { backgroundColor: '#10B981' }]} />
          <Text style={[styles.summaryBadgeText, { color: theme.textPrimary }]}>
            <Text style={{ fontWeight: '700' }}>{activeMeds.length}</Text> Active Meds
          </Text>
          <Feather name="chevron-right" size={13} color={theme.textSecondary} style={{ marginLeft: 2 }} />
        </TouchableOpacity>

        <View style={[styles.verticalDivider, { backgroundColor: theme.border }]} />

        {/* Allergies Chip */}
        <View style={styles.allergiesQuickWrapper}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons
              name="alert-decagram-outline"
              size={15}
              color={allergies.length > 0 ? '#EF4444' : theme.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.summaryBadgeText, { color: theme.textPrimary }]}>
              <Text style={{ fontWeight: '700' }}>{allergies.length}</Text> Allergies
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.smallAddAllergyBtn, { borderColor: theme.accent }]}
            onPress={() => setAllergyModalOpen(true)}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={12} color={theme.accent} />
            <Text style={[styles.smallAddAllergyText, { color: theme.accent }]}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Allergies Badges List if any */}
      {allergies.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.allergiesScrollRow}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6 }}
        >
          {allergies.map((all) => (
            <TouchableOpacity
              key={all.id}
              style={[styles.allergyTag, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
              onPress={() => handleDeleteAllergy(all.id, all.substance)}
              activeOpacity={0.7}
            >
              <Text style={styles.allergyTagText}>⚠️ {all.substance}</Text>
              <Feather name="x" size={11} color="#EF4444" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {RECORD_TYPES.map((t) => {
          const isSelected = selectedType === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isSelected ? theme.accent : theme.inputBg,
                  borderColor: isSelected ? theme.accent : theme.border,
                },
              ]}
              onPress={() => setSelectedType(t.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: isSelected ? '#FFF' : theme.textSecondary, fontWeight: isSelected ? '700' : '500' },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Timeline Section */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading records...</Text>
        </View>
      ) : records.length === 0 ? (
        <View style={styles.emptyVaultContainer}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={44} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No medical records found</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {selectedType !== 'ALL'
              ? `No ${selectedType.toLowerCase().replace('_', ' ')} records entered yet.`
              : 'Keep consultations, prescriptions and lab reports organized in one place.'}
          </Text>
          <TouchableOpacity
            style={[styles.emptyAddBtn, { backgroundColor: theme.accent }]}
            onPress={openAddForm}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyAddBtnText}>Add First Record</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.timelineContainer}>
          {monthGroups.map(([monthName, monthRecords]) => (
            <View key={monthName} style={styles.monthSection}>
              {/* Month Header */}
              <View style={styles.monthHeaderRow}>
                <View style={[styles.monthDot, { backgroundColor: theme.accent }]} />
                <Text style={[styles.monthHeaderText, { color: theme.textSecondary }]}>{monthName}</Text>
                <View style={[styles.monthLine, { backgroundColor: theme.border }]} />
              </View>

              {/* Records in this month */}
              {monthRecords.map((rec) => {
                const typeStyle = getTypeStyle(rec.type);
                const recDate = new Date(rec.recordDate);
                const dayStr = recDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });

                return (
                  <TouchableOpacity
                    key={rec.id}
                    style={[styles.recordRow, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                    onPress={() => {
                      setSelectedRecord(rec);
                      setDetailModalOpen(true);
                    }}
                    activeOpacity={0.7}
                  >
                    {/* Left: Date & Type Badge */}
                    <View style={styles.rowLeft}>
                      <View style={[styles.typeBadge, { backgroundColor: typeStyle.bg }]}>
                        <Feather name={typeStyle.icon as any} size={14} color={typeStyle.color} />
                        <Text style={[styles.typeBadgeText, { color: typeStyle.color }]}>
                          {typeStyle.label}
                        </Text>
                      </View>
                      <Text style={[styles.recordDateText, { color: theme.textSecondary }]}>{dayStr}</Text>
                    </View>

                    {/* Middle: Details */}
                    <View style={styles.rowMiddle}>
                      <Text style={[styles.recordMainTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                        {rec.diagnosis || rec.doctorName || `${typeStyle.label} Record`}
                      </Text>

                      <View style={styles.doctorRow}>
                        {rec.doctorName ? (
                          <Text style={[styles.doctorText, { color: theme.textSecondary }]} numberOfLines={1}>
                            {rec.doctorName}
                            {rec.specialty ? ` • ${rec.specialty}` : ''}
                          </Text>
                        ) : rec.facility ? (
                          <Text style={[styles.doctorText, { color: theme.textSecondary }]} numberOfLines={1}>
                            {rec.facility}
                          </Text>
                        ) : null}
                      </View>

                      {/* Footer tags (meds count, file count) */}
                      <View style={styles.recordFooterTags}>
                        {rec.medications && rec.medications.length > 0 && (
                          <View style={[styles.miniTag, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                            <Feather name="package" size={11} color="#8B5CF6" />
                            <Text style={[styles.miniTagText, { color: '#8B5CF6' }]}>
                              {rec.medications.length} {rec.medications.length === 1 ? 'med' : 'meds'}
                            </Text>
                          </View>
                        )}
                        {rec.files && rec.files.length > 0 && (
                          <View style={[styles.miniTag, { backgroundColor: 'rgba(14, 165, 233, 0.12)', marginLeft: 6 }]}>
                            <Feather name="paperclip" size={11} color="#0EA5E9" />
                            <Text style={[styles.miniTagText, { color: '#0EA5E9' }]}>
                              {rec.files.length} {rec.files.length === 1 ? 'file' : 'files'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Right Chevron */}
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {/* ========================================================= */}
      {/* RECORD DETAIL MODAL */}
      {/* ========================================================= */}
      <Modal visible={detailModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            {selectedRecord && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <View
                        style={[
                          styles.typeBadge,
                          { backgroundColor: getTypeStyle(selectedRecord.type).bg, marginRight: 8 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeBadgeText,
                            { color: getTypeStyle(selectedRecord.type).color },
                          ]}
                        >
                          {getTypeStyle(selectedRecord.type).label}
                        </Text>
                      </View>
                      <Text style={[styles.modalDate, { color: theme.textSecondary }]}>
                        {new Date(selectedRecord.recordDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                    <Text style={[styles.modalMainTitle, { color: theme.textPrimary }]}>
                      {selectedRecord.diagnosis || 'Medical Consultation & Record'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetailModalOpen(false)} style={styles.closeModalBtn}>
                    <Feather name="x" size={20} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                  {/* Doctor & Facility */}
                  {(selectedRecord.doctorName || selectedRecord.facility) && (
                    <View style={[styles.detailSection, { backgroundColor: theme.inputBg }]}>
                      <Feather name="user" size={16} color={theme.accent} style={{ marginRight: 8, marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        {selectedRecord.doctorName && (
                          <Text style={[styles.detailValueBold, { color: theme.textPrimary }]}>
                            {selectedRecord.doctorName}
                            {selectedRecord.specialty ? ` (${selectedRecord.specialty})` : ''}
                          </Text>
                        )}
                        {selectedRecord.facility && (
                          <Text style={[styles.detailSubValue, { color: theme.textSecondary }]}>
                            {selectedRecord.facility}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Complaints & Notes */}
                  {selectedRecord.complaints && (
                    <View style={styles.infoBlock}>
                      <Text style={[styles.infoBlockLabel, { color: theme.textSecondary }]}>CHIEF COMPLAINTS</Text>
                      <Text style={[styles.infoBlockText, { color: theme.textPrimary }]}>
                        {selectedRecord.complaints}
                      </Text>
                    </View>
                  )}

                  {selectedRecord.notes && (
                    <View style={styles.infoBlock}>
                      <Text style={[styles.infoBlockLabel, { color: theme.textSecondary }]}>CLINICAL NOTES</Text>
                      <Text style={[styles.infoBlockText, { color: theme.textPrimary }]}>
                        {selectedRecord.notes}
                      </Text>
                    </View>
                  )}

                  {/* Vitals on slip */}
                  {selectedRecord.vitals && typeof selectedRecord.vitals === 'object' && (
                    <View style={styles.infoBlock}>
                      <Text style={[styles.infoBlockLabel, { color: theme.textSecondary }]}>RECORDED VITALS</Text>
                      <View style={styles.vitalsWrap}>
                        {Object.entries(selectedRecord.vitals).map(([k, v]) => (
                          <View key={k} style={[styles.vitalChip, { backgroundColor: theme.inputBg }]}>
                            <Text style={[styles.vitalKey, { color: theme.textSecondary }]}>{k.toUpperCase()}:</Text>
                            <Text style={[styles.vitalVal, { color: theme.textPrimary }]}> {String(v)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Medications List */}
                  {selectedRecord.medications && selectedRecord.medications.length > 0 && (
                    <View style={styles.infoBlock}>
                      <Text style={[styles.infoBlockLabel, { color: theme.textSecondary }]}>
                        PRESCRIBED MEDICINES ({selectedRecord.medications.length})
                      </Text>
                      {selectedRecord.medications.map((m, idx) => (
                        <View key={idx} style={[styles.medCard, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.medCardName, { color: theme.textPrimary }]}>
                              {m.name} {m.strength ? `(${m.strength})` : ''}
                            </Text>
                            {m.genericName && (
                              <Text style={[styles.medCardGeneric, { color: theme.textSecondary }]}>
                                Generic: {m.genericName}
                              </Text>
                            )}
                            <Text style={[styles.medCardDosage, { color: theme.accent }]}>
                              Pattern: {m.dosePattern || '1-0-1'} • {m.timing || 'after food'}
                              {m.durationDays ? ` • ${m.durationDays} days` : ''}
                            </Text>
                          </View>
                        </View>
                      ))}

                      {/* Convert to Reminders Action */}
                      <TouchableOpacity
                        style={[styles.createRemindersActionBtn, { borderColor: theme.accent }]}
                        onPress={() => handleCreateReminders(selectedRecord.id)}
                        disabled={convertingReminders}
                        activeOpacity={0.8}
                      >
                        {convertingReminders ? (
                          <ActivityIndicator size="small" color={theme.accent} />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="bell-ring-outline" size={16} color={theme.accent} style={{ marginRight: 6 }} />
                            <Text style={[styles.createRemindersText, { color: theme.accent }]}>
                              Set Medication Reminders from this Prescription
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Attached Files */}
                  {selectedRecord.files && selectedRecord.files.length > 0 && (
                    <View style={styles.infoBlock}>
                      <Text style={[styles.infoBlockLabel, { color: theme.textSecondary }]}>
                        ATTACHED DOCUMENTS ({selectedRecord.files.length})
                      </Text>
                      {selectedRecord.files.map((f) => (
                        <View key={f.id} style={[styles.fileAttachmentRow, { backgroundColor: theme.inputBg }]}>
                          <Feather
                            name={f.mimeType.includes('pdf') ? 'file' : 'image'}
                            size={18}
                            color={theme.accent}
                            style={{ marginRight: 8 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.fileRowName, { color: theme.textPrimary }]} numberOfLines={1}>
                              {f.storageKey}
                            </Text>
                            <Text style={[styles.fileRowMeta, { color: theme.textSecondary }]}>
                              {f.mimeType} • Authenticated storage
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>

                {/* Actions Footer */}
                <View style={[styles.modalFooterActions, { borderTopColor: theme.border }]}>
                  <TouchableOpacity
                    style={[styles.deleteBtn, { borderColor: theme.danger }]}
                    onPress={() => handleDeleteRecord(selectedRecord.id)}
                    activeOpacity={0.7}
                  >
                    <Feather name="trash-2" size={15} color={theme.danger} style={{ marginRight: 4 }} />
                    <Text style={[styles.deleteBtnText, { color: theme.danger }]}>Delete</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.editBtn, { backgroundColor: theme.accent }]}
                    onPress={() => openEditForm(selectedRecord)}
                    activeOpacity={0.8}
                  >
                    <Feather name="edit-2" size={15} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.editBtnText}>Edit Record</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* ADD / EDIT RECORD MODAL FORM */}
      {/* ========================================================= */}
      <Modal visible={formModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentLarge, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: theme.textPrimary }]}>
                {isEditing ? 'Edit Medical Record' : 'Add Medical Record'}
              </Text>
              <TouchableOpacity onPress={() => setFormModalOpen(false)} style={styles.closeModalBtn}>
                <Feather name="x" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Record Type Picker */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>RECORD TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {RECORD_TYPES.filter((t) => t.key !== 'ALL').map((t) => {
                  const isCur = formType === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[
                        styles.formTypeChip,
                        {
                          backgroundColor: isCur ? theme.accent : theme.inputBg,
                          borderColor: isCur ? theme.accent : theme.border,
                        },
                      ]}
                      onPress={() => setFormType(t.key as RecordType)}
                    >
                      <Text style={[styles.formTypeChipText, { color: isCur ? '#FFF' : theme.textPrimary }]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Date */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>RECORD DATE (YYYY-MM-DD)</Text>
              <View style={styles.dateRow}>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border, flex: 1 }]}
                  value={formDate}
                  onChangeText={setFormDate}
                  placeholder="2026-10-21"
                  placeholderTextColor={theme.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.quickTodayBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={() => setFormDate(new Date().toISOString().split('T')[0])}
                >
                  <Text style={[styles.quickTodayText, { color: theme.accent }]}>Today</Text>
                </TouchableOpacity>
              </View>

              {/* Doctor Name & Specialty */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DOCTOR NAME</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }]}
                value={formDoctor}
                onChangeText={setFormDoctor}
                placeholder="Dr. Anita Rao"
                placeholderTextColor={theme.textSecondary}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>SPECIALTY</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }]}
                value={formSpecialty}
                onChangeText={setFormSpecialty}
                placeholder="Cardiology, General Physician, etc."
                placeholderTextColor={theme.textSecondary}
              />

              {/* Facility / Clinic */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>FACILITY / CLINIC / HOSPITAL</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }]}
                value={formFacility}
                onChangeText={setFormFacility}
                placeholder="Apollo Clinics, City Hospital, etc."
                placeholderTextColor={theme.textSecondary}
              />

              {/* Diagnosis */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DIAGNOSIS (AS WRITTEN ON SLIP)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }]}
                value={formDiagnosis}
                onChangeText={setFormDiagnosis}
                placeholder="e.g. Essential Hypertension, Type 2 Diabetes"
                placeholderTextColor={theme.textSecondary}
              />

              {/* Complaints & Notes */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>CHIEF COMPLAINTS</Text>
              <TextInput
                style={[styles.textInputArea, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }]}
                value={formComplaints}
                onChangeText={setFormComplaints}
                placeholder="Dizziness, headaches, knee pain, etc."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={2}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>CLINICAL NOTES / ADVICE</Text>
              <TextInput
                style={[styles.textInputArea, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Dietary instructions, exercise advice, etc."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={2}
              />

              {/* Follow-up Date */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>FOLLOW-UP DATE (OPTIONAL)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }]}
                value={formFollowUp}
                onChangeText={setFormFollowUp}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textSecondary}
              />

              {/* Repeatable Medication Rows */}
              <View style={styles.medsHeaderRow}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 0 }]}>
                  PRESCRIBED MEDICINES
                </Text>
                <TouchableOpacity onPress={addMedRow} style={[styles.addMedRowBtn, { borderColor: theme.accent }]}>
                  <Feather name="plus" size={13} color={theme.accent} />
                  <Text style={[styles.addMedRowText, { color: theme.accent }]}>Add Med</Text>
                </TouchableOpacity>
              </View>

              {formMeds.map((med, idx) => (
                <View key={idx} style={[styles.medFormCard, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}>
                      Medicine #{idx + 1}
                    </Text>
                    <TouchableOpacity onPress={() => removeMedRow(idx)}>
                      <Feather name="trash-2" size={14} color={theme.danger} />
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[styles.subInput, { backgroundColor: theme.cardBg, color: theme.textPrimary, borderColor: theme.border }]}
                    placeholder="Medicine Name (e.g. Telma 40)"
                    placeholderTextColor={theme.textSecondary}
                    value={med.name}
                    onChangeText={(val) => updateMedRow(idx, 'name', val)}
                  />

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <TextInput
                      style={[styles.subInput, { backgroundColor: theme.cardBg, color: theme.textPrimary, borderColor: theme.border, flex: 1 }]}
                      placeholder="Strength (e.g. 40 mg)"
                      placeholderTextColor={theme.textSecondary}
                      value={med.strength || ''}
                      onChangeText={(val) => updateMedRow(idx, 'strength', val)}
                    />
                    <TextInput
                      style={[styles.subInput, { backgroundColor: theme.cardBg, color: theme.textPrimary, borderColor: theme.border, flex: 1 }]}
                      placeholder="Pattern (e.g. 1-0-1)"
                      placeholderTextColor={theme.textSecondary}
                      value={med.dosePattern || ''}
                      onChangeText={(val) => updateMedRow(idx, 'dosePattern', val)}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <TextInput
                      style={[styles.subInput, { backgroundColor: theme.cardBg, color: theme.textPrimary, borderColor: theme.border, flex: 1 }]}
                      placeholder="Timing (after food)"
                      placeholderTextColor={theme.textSecondary}
                      value={med.timing || ''}
                      onChangeText={(val) => updateMedRow(idx, 'timing', val)}
                    />
                    <TextInput
                      style={[styles.subInput, { backgroundColor: theme.cardBg, color: theme.textPrimary, borderColor: theme.border, flex: 1 }]}
                      placeholder="Days (30)"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={med.durationDays ? String(med.durationDays) : ''}
                      onChangeText={(val) => updateMedRow(idx, 'durationDays', parseInt(val, 10) || null)}
                    />
                  </View>
                </View>
              ))}

              {/* File Attachment Section */}
              <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: 14 }]}>
                ATTACH PRESCRIPTION / LAB REPORT
              </Text>
              <View style={styles.attachmentButtonsRow}>
                <TouchableOpacity
                  style={[styles.attachmentPickBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={handlePickPhoto}
                  activeOpacity={0.7}
                >
                  <Feather name="camera" size={16} color={theme.accent} style={{ marginRight: 6 }} />
                  <Text style={[styles.attachmentPickText, { color: theme.textPrimary }]}>Photo / Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.attachmentPickBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  onPress={handlePickDocument}
                  activeOpacity={0.7}
                >
                  <Feather name="file-text" size={16} color="#8B5CF6" style={{ marginRight: 6 }} />
                  <Text style={[styles.attachmentPickText, { color: theme.textPrimary }]}>Pick PDF</Text>
                </TouchableOpacity>
              </View>

              {attachedFile && (
                <View style={[styles.selectedFilePreview, { backgroundColor: theme.inputBg }]}>
                  <Feather name="check-circle" size={16} color="#10B981" style={{ marginRight: 8 }} />
                  <Text style={[styles.selectedFileName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {attachedFile.name}
                  </Text>
                  <TouchableOpacity onPress={() => setAttachedFile(null)}>
                    <Feather name="x" size={16} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {/* Modal Bottom Save */}
            <View style={[styles.formModalFooter, { borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.submitRecordBtn, { backgroundColor: theme.accent }]}
                onPress={handleSaveRecord}
                disabled={savingRecord}
                activeOpacity={0.8}
              >
                {savingRecord ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitRecordBtnText}>
                    {isEditing ? 'Update Record' : 'Save to Vault'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* ACTIVE MEDICATIONS LIST MODAL */}
      {/* ========================================================= */}
      <Modal visible={activeMedsModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: theme.textPrimary }]}>
                Active Prescribed Medications
              </Text>
              <TouchableOpacity onPress={() => setActiveMedsModalOpen(false)} style={styles.closeModalBtn}>
                <Feather name="x" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {activeMeds.length === 0 ? (
                <Text style={{ color: theme.textSecondary, textAlign: 'center', padding: 20 }}>
                  No active ongoing medications found.
                </Text>
              ) : (
                activeMeds.map((m, idx) => (
                  <View key={idx} style={[styles.activeMedItemCard, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                    <View style={styles.activeMedDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activeMedName, { color: theme.textPrimary }]}>
                        {m.name} {m.strength ? `(${m.strength})` : ''}
                      </Text>
                      {m.genericName && (
                        <Text style={[styles.activeMedGeneric, { color: theme.textSecondary }]}>
                          Generic: {m.genericName}
                        </Text>
                      )}
                      <Text style={[styles.activeMedTiming, { color: theme.accent }]}>
                        {m.dosePattern || '1-0-1'} • {m.timing || 'after food'}
                      </Text>
                      {m.record?.doctorName && (
                        <Text style={[styles.activeMedPrescriber, { color: theme.textSecondary }]}>
                          Prescribed by {m.record.doctorName}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* ADD ALLERGY MODAL */}
      {/* ========================================================= */}
      <Modal visible={allergyModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: theme.textPrimary }]}>Document Allergy</Text>
              <TouchableOpacity onPress={() => setAllergyModalOpen(false)} style={styles.closeModalBtn}>
                <Feather name="x" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>SUBSTANCE / DRUG NAME</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }]}
              value={allergySubstance}
              onChangeText={setAllergySubstance}
              placeholder="e.g. Penicillin, Sulfa, Aspirin"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>ALLERGIC REACTION</Text>
            <TextInput
              style={[styles.textInputArea, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }]}
              value={allergyReaction}
              onChangeText={setAllergyReaction}
              placeholder="Skin rash, facial edema, wheezing, etc."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={2}
            />

            <TouchableOpacity
              style={[styles.submitRecordBtn, { backgroundColor: '#EF4444', marginTop: 16 }]}
              onPress={handleSaveAllergy}
              disabled={savingAllergy}
              activeOpacity={0.8}
            >
              {savingAllergy ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.submitRecordBtnText}>Add to Allergy Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addRecordBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  topSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  summaryBadgeText: {
    fontSize: 12,
  },
  verticalDivider: {
    width: 1,
    height: 18,
    marginHorizontal: 8,
  },
  allergiesQuickWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1.2,
  },
  smallAddAllergyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  smallAddAllergyText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 2,
  },
  allergiesScrollRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  allergyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  allergyTagText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 12,
  },
  centerLoading: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    marginTop: 8,
  },
  emptyVaultContainer: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  timelineContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  monthSection: {
    marginTop: 8,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  monthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  monthHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthLine: {
    flex: 1,
    height: 1,
    marginLeft: 8,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  rowLeft: {
    alignItems: 'flex-start',
    width: 80,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 3,
  },
  recordDateText: {
    fontSize: 11,
    fontWeight: '500',
  },
  rowMiddle: {
    flex: 1,
    marginLeft: 8,
  },
  recordMainTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorText: {
    fontSize: 12,
  },
  recordFooterTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  miniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  modalContentLarge: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalDate: {
    fontSize: 12,
  },
  modalMainTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeModalBtn: {
    padding: 6,
  },
  detailSection: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  detailValueBold: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailSubValue: {
    fontSize: 12,
    marginTop: 2,
  },
  infoBlock: {
    marginBottom: 14,
  },
  infoBlockLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoBlockText: {
    fontSize: 13,
    lineHeight: 18,
  },
  vitalsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  vitalChip: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  vitalKey: {
    fontSize: 11,
    fontWeight: '700',
  },
  vitalVal: {
    fontSize: 11,
    fontWeight: '600',
  },
  medCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  medCardName: {
    fontSize: 13,
    fontWeight: '700',
  },
  medCardGeneric: {
    fontSize: 11,
    marginTop: 2,
  },
  medCardDosage: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  createRemindersActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  createRemindersText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fileAttachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  fileRowName: {
    fontSize: 12,
    fontWeight: '600',
  },
  fileRowMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  modalFooterActions: {
    flexDirection: 'row',
    paddingTop: 14,
    marginTop: 8,
    borderTopWidth: 1,
    gap: 12,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  editBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  formTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 6,
  },
  formTypeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickTodayBtn: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  quickTodayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  textInputArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    minHeight: 54,
  },
  subInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },
  medsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  addMedRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  addMedRowText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 2,
  },
  medFormCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  attachmentButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  attachmentPickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  attachmentPickText: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedFilePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
  },
  selectedFileName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  formModalFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
  submitRecordBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  submitRecordBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  activeMedItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  activeMedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginTop: 5,
    marginRight: 10,
  },
  activeMedName: {
    fontSize: 14,
    fontWeight: '700',
  },
  activeMedGeneric: {
    fontSize: 12,
    marginTop: 2,
  },
  activeMedTiming: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  activeMedPrescriber: {
    fontSize: 11,
    marginTop: 2,
  },
});
