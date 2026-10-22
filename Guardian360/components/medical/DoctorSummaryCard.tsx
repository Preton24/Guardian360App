import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { api, HealthSummaryItem } from '@/services/api';

interface DoctorSummaryCardProps {
  userId: string;
  userName: string;
  userAge: number;
  userGender?: string;
  chronicConditions?: string[];
  theme: any;
  isDark: boolean;
  refreshTrigger?: number;
}

export default function DoctorSummaryCard({
  userId,
  userName,
  userAge,
  userGender,
  chronicConditions,
  theme,
  isDark,
  refreshTrigger,
}: DoctorSummaryCardProps) {
  const [summary, setSummary] = useState<HealthSummaryItem | null>(null);
  const [pastSummaries, setPastSummaries] = useState<HealthSummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Citation highlighting
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);
  const [pastSummariesModalOpen, setPastSummariesModalOpen] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  // Load existing / past summaries
  const loadSummaries = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const past = await api.getUserSummaries(userId).catch(() => []);
      setPastSummaries(past);
      if (past.length > 0) {
        setSummary(past[0]);
      }
    } catch (err: any) {
      console.warn('[DoctorSummaryCard] Error loading summaries:', err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries, refreshTrigger]);

  // Generate / Prepare Summary
  const handlePrepareSummary = async () => {
    try {
      setGenerating(true);
      setError(null);
      const result = await api.generateDoctorSummary(userId);
      setSummary(result);
      await loadSummaries();
    } catch (err: any) {
      console.error('[DoctorSummaryCard] Generation error:', err);
      setError(err.message || 'Failed to generate doctor summary. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Generate HTML for 1-Page PDF
  const generatePdfHtml = (sum: HealthSummaryItem) => {
    const dateFormatted = new Date(sum.createdAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const activeMedsHtml =
      sum.sections?.activeMeds?.length > 0
        ? sum.sections.activeMeds
            .map((m) => `<li style="margin-bottom: 5px;">${m.text}</li>`)
            .join('')
        : '<li>No active medications documented.</li>';

    const allergiesHtml =
      sum.sections?.allergies?.length > 0
        ? sum.sections.allergies
            .map((a) => `<li style="margin-bottom: 5px; color: #b91c1c;"><strong>${a.text}</strong></li>`)
            .join('')
        : '<li>No known allergies documented.</li>';

    const recentEventsHtml =
      sum.sections?.recentEvents?.length > 0
        ? sum.sections.recentEvents
            .map((e) => `<li style="margin-bottom: 5px;">${e.text}</li>`)
            .join('')
        : '<li>No acute events recorded.</li>';

    const flagsHtml =
      sum.sections?.flagsToVerify?.length > 0
        ? `<div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 6px; margin-top: 14px;">
            <strong style="color: #b45309; font-size: 13px;">ITEMS TO VERIFY IN CONSULTATION:</strong>
            <ul style="margin: 6px 0 0 16px; padding: 0; color: #92400e; font-size: 12px;">
              ${sum.sections.flagsToVerify.map((f) => `<li style="margin-bottom: 4px;">${f.text}</li>`).join('')}
            </ul>
           </div>`
        : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Doctor Summary - ${userName}</title>
          <style>
            @page {
              size: A4;
              margin: 20mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              line-height: 1.5;
              font-size: 13px;
              margin: 0;
              padding: 0;
            }
            .header {
              border-bottom: 2px solid #0ea5e9;
              padding-bottom: 12px;
              margin-bottom: 16px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .header h1 {
              margin: 0;
              color: #0f172a;
              font-size: 22px;
            }
            .header-subtitle {
              color: #0ea5e9;
              font-weight: 700;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .meta-bar {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 10px 14px;
              margin-bottom: 16px;
              display: flex;
              flex-wrap: wrap;
              gap: 20px;
            }
            .meta-item {
              font-size: 12px;
            }
            .meta-label {
              color: #64748b;
              font-weight: 600;
              font-size: 10px;
              text-transform: uppercase;
              display: block;
            }
            .meta-value {
              color: #0f172a;
              font-weight: 700;
              font-size: 13px;
            }
            .section-title {
              font-size: 13px;
              font-weight: 700;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
              margin-top: 16px;
              margin-bottom: 8px;
            }
            .paragraph-box {
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-left: 4px solid #10b981;
              padding: 14px;
              border-radius: 6px;
              font-size: 13.5px;
              line-height: 1.6;
              color: #0f172a;
              margin-bottom: 12px;
            }
            .disclaimer-box {
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
              border-radius: 6px;
              font-size: 11px;
              color: #475569;
              font-style: italic;
              margin-top: 20px;
              text-align: center;
            }
            .columns {
              display: flex;
              gap: 16px;
              margin-top: 8px;
            }
            .column {
              flex: 1;
            }
            ul {
              margin: 4px 0 0 16px;
              padding: 0;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="header-subtitle">Guardian 360 Health System</div>
              <h1>Pre-Consultation Clinical Summary</h1>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              Generated: ${dateFormatted}
            </div>
          </div>

          <div class="meta-bar">
            <div class="meta-item">
              <span class="meta-label">Patient Name</span>
              <span class="meta-value">${userName}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Age / Gender</span>
              <span class="meta-value">${userAge} yrs • ${userGender || 'Unspecified'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Documented Chronic Conditions</span>
              <span class="meta-value">${chronicConditions?.length ? chronicConditions.join(', ') : 'None documented'}</span>
            </div>
          </div>

          <div class="section-title">Clinical History & Wearable Telemetry Review</div>
          <div class="paragraph-box">
            ${sum.paragraph}
          </div>

          ${flagsHtml}

          <div class="columns">
            <div class="column">
              <div class="section-title">Active Medications</div>
              <ul>
                ${activeMedsHtml}
              </ul>

              <div class="section-title" style="margin-top: 14px;">Allergies & Sensitivities</div>
              <ul>
                ${allergiesHtml}
              </ul>
            </div>

            <div class="column">
              <div class="section-title">Recent Telemetry & Observations</div>
              <ul>
                ${recentEventsHtml}
              </ul>
            </div>
          </div>

          <div class="disclaimer-box">
            AI-generated from records entered in Guardian 360 and home-wearable data, to support the consultation. Not a diagnosis. Verify against the source documents.
          </div>
        </body>
      </html>
    `;
  };

  // Export / Share PDF
  const handleSharePdf = async () => {
    if (!summary) return;
    try {
      setExportingPdf(true);
      const html = generatePdfHtml(summary);

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: `Doctor Summary - ${userName}.pdf`,
          });
        } else {
          await Print.printAsync({ uri });
        }
      }
    } catch (err: any) {
      Alert.alert('PDF Export Error', err.message || 'Could not export doctor summary PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <View style={[styles.cardContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.titleWrapper}>
          <View style={[styles.headerIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <MaterialCommunityIcons name="stethoscope" size={24} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Doctor Summary</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
              Pre-Consultation Clinical Briefing
            </Text>
          </View>
        </View>

        {/* Prepare / Refresh Summary Button */}
        <TouchableOpacity
          style={[styles.prepareBtn, { backgroundColor: generating ? theme.inputBg : '#10B981' }]}
          onPress={handlePrepareSummary}
          disabled={generating}
          activeOpacity={0.8}
        >
          {generating ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <>
              <Ionicons name="sparkles" size={15} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.prepareBtnText}>{summary ? 'Refresh' : 'Prepare'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Loading state while generating */}
      {generating && (
        <View style={[styles.generatingCallout, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
          <ActivityIndicator size="small" color="#10B981" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.generatingTitle, { color: theme.textPrimary }]}>
              Synthesizing Clinical Summary...
            </Text>
            <Text style={[styles.generatingSubtitle, { color: theme.textSecondary }]}>
              Gathering records, active meds, wearable telemetry, and adherence (10–20s)
            </Text>
          </View>
        </View>
      )}

      {/* Error state */}
      {error && !generating && (
        <View style={[styles.errorBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#EF4444' }]}>
          <Feather name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 8, marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444' }}>Summary Generation Error</Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>{error}</Text>
            <TouchableOpacity onPress={handlePrepareSummary} style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.accent }}>Tap to Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Content */}
      {summary && !generating && (
        (summary.noRecords || (summary.paragraph && summary.paragraph.toLowerCase().includes('no records found'))) ? (
          <View style={[styles.noRecordsCard, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <View style={[styles.noRecordsIconWrap, { backgroundColor: 'rgba(100, 116, 139, 0.12)' }]}>
              <Feather name="folder" size={26} color={theme.textSecondary} />
            </View>
            <Text style={[styles.noRecordsTitle, { color: theme.textPrimary }]}>No Records Found</Text>
            <Text style={[styles.noRecordsSubtitle, { color: theme.textSecondary }]}>
              No consultations, prescriptions, or reports have been recorded for {userName} yet. Add records in the Medical History Vault above to generate a pre-consultation summary.
            </Text>
          </View>
        ) : (
          <View style={styles.contentWrap}>
            {/* Metadata pill row */}
            <View style={styles.metaRow}>
              <View style={[styles.modelBadge, { backgroundColor: theme.inputBg }]}>
                <MaterialCommunityIcons name="robot" size={12} color={theme.accent} style={{ marginRight: 4 }} />
                <Text style={[styles.modelBadgeText, { color: theme.textSecondary }]}>
                  {summary.model || 'Claude Sonnet'}
                </Text>
              </View>

              {summary.cached && (
              <View style={[styles.cachedBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Feather name="zap" size={11} color="#10B981" style={{ marginRight: 3 }} />
                <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '700' }}>Cached Facts</Text>
              </View>
            )}

            <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
              {new Date(summary.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
              {new Date(summary.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {/* Clinical Summary Paragraph */}
          <View style={[styles.paragraphCard, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <Text style={[styles.paragraphText, { color: theme.textPrimary }]}>
              {summary.paragraph}
            </Text>
          </View>

          {/* Mandatory Clinical Disclaimer Label */}
          <View style={styles.disclaimerRow}>
            <Feather name="shield" size={13} color={theme.textSecondary} style={{ marginRight: 6, marginTop: 1 }} />
            <Text style={[styles.disclaimerText, { color: theme.textSecondary }]}>
              AI-generated from records entered in Guardian 360 and home-wearable data, to support the consultation. Not a diagnosis. Verify against the source documents.
            </Text>
          </View>

          {/* Flags to Verify Section */}
          {summary.sections?.flagsToVerify && summary.sections.flagsToVerify.length > 0 && (
            <View style={[styles.flagsCard, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <MaterialCommunityIcons name="alert-octagon-outline" size={18} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={styles.flagsCardTitle}>ITEMS TO VERIFY IN CONSULTATION</Text>
              </View>
              {summary.sections.flagsToVerify.map((f, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.flagItemRow}
                  onPress={() => setSelectedFactId(f.factIds[0] || null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.flagBullet}>•</Text>
                  <Text style={[styles.flagText, { color: isDark ? '#FDE68A' : '#92400E' }]}>{f.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Structured Sections Grid */}
          <View style={styles.sectionsGrid}>
            {/* Active Meds */}
            {summary.sections?.activeMeds && summary.sections.activeMeds.length > 0 && (
              <View style={[styles.sectionBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <Feather name="package" size={14} color="#8B5CF6" style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Active Medications</Text>
                </View>
                {summary.sections.activeMeds.map((m, idx) => {
                  const isHighlighted = selectedFactId && m.factIds.includes(selectedFactId);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.sectionListItem,
                        isHighlighted && { backgroundColor: 'rgba(139, 92, 246, 0.2)', borderRadius: 6 },
                      ]}
                      onPress={() => setSelectedFactId(isHighlighted ? null : m.factIds[0] || null)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.sectionItemText, { color: theme.textSecondary }]}>• {m.text}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Allergies */}
            {summary.sections?.allergies && summary.sections.allergies.length > 0 && (
              <View style={[styles.sectionBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <MaterialCommunityIcons name="alert-decagram-outline" size={14} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Documented Allergies</Text>
                </View>
                {summary.sections.allergies.map((a, idx) => (
                  <View key={idx} style={styles.sectionListItem}>
                    <Text style={[styles.sectionItemText, { color: '#EF4444' }]}>• {a.text}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recent Wearable Events */}
            {summary.sections?.recentEvents && summary.sections.recentEvents.length > 0 && (
              <View style={[styles.sectionBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <Feather name="activity" size={14} color={theme.accent} style={{ marginRight: 6 }} />
                  <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Recent Observations</Text>
                </View>
                {summary.sections.recentEvents.map((e, idx) => {
                  const isHighlighted = selectedFactId && e.factIds.includes(selectedFactId);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.sectionListItem,
                        isHighlighted && { backgroundColor: 'rgba(14, 165, 233, 0.2)', borderRadius: 6 },
                      ]}
                      onPress={() => setSelectedFactId(isHighlighted ? null : e.factIds[0] || null)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.sectionItemText, { color: theme.textSecondary }]}>• {e.text}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Interactive Citations Accordion */}
          {summary.citations && summary.citations.length > 0 && (
            <View style={[styles.citationsBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <Text style={[styles.citationsTitle, { color: theme.textSecondary }]}>FACT CITATIONS (TAP TO VERIFY)</Text>
              {summary.citations.map((cite, idx) => (
                <View key={idx} style={styles.citationRow}>
                  <Text style={[styles.citationSentence, { color: theme.textPrimary }]}>
                    "{cite.sentence}"
                  </Text>
                  <View style={styles.citationFactsWrap}>
                    {cite.factIds.map((fId) => (
                      <View key={fId} style={[styles.citationFactPill, { backgroundColor: theme.cardBg }]}>
                        <Text style={[styles.citationFactPillText, { color: theme.accent }]}>#{fId}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons: Share PDF & Past Summaries */}
          <View style={[styles.bottomActionsRow, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.pastSummariesBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
              onPress={() => setPastSummariesModalOpen(true)}
              activeOpacity={0.7}
            >
              <Feather name="clock" size={14} color={theme.textPrimary} style={{ marginRight: 4 }} />
              <Text style={[styles.pastSummariesText, { color: theme.textPrimary }]}>
                Past Summaries ({pastSummaries.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sharePdfBtn, { backgroundColor: theme.accent }]}
              onPress={handleSharePdf}
              disabled={exportingPdf}
              activeOpacity={0.8}
            >
              {exportingPdf ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Feather name="share-2" size={14} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.sharePdfText}>Share PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
        )
      )}

      {/* Empty State (No summary yet) */}
      {!summary && !generating && !error && (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="doctor" size={44} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Doctor Summary Prepared</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Guardian 360 can gather {userName}'s consultations, active medicines, falls, vitals, and adherence into a 1-page clinical summary for their physician.
          </Text>
          <TouchableOpacity
            style={[styles.emptyActionBtn, { backgroundColor: '#10B981' }]}
            onPress={handlePrepareSummary}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyActionBtnText}>Prepare Doctor Summary</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================================= */}
      {/* PAST SUMMARIES MODAL */}
      {/* ========================================================= */}
      <Modal visible={pastSummariesModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: theme.textPrimary }]}>Past Doctor Summaries</Text>
              <TouchableOpacity onPress={() => setPastSummariesModalOpen(false)}>
                <Feather name="x" size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {pastSummaries.length === 0 ? (
                <Text style={{ color: theme.textSecondary, textAlign: 'center', padding: 20 }}>
                  No previous summaries recorded.
                </Text>
              ) : (
                pastSummaries.map((ps) => {
                  const isCurrent = summary?.id === ps.id;
                  const psDate = new Date(ps.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const psTime = new Date(ps.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <TouchableOpacity
                      key={ps.id}
                      style={[
                        styles.pastItemCard,
                        {
                          backgroundColor: isCurrent ? 'rgba(16, 185, 129, 0.1)' : theme.inputBg,
                          borderColor: isCurrent ? '#10B981' : theme.border,
                        },
                      ]}
                      onPress={() => {
                        setSummary(ps);
                        setPastSummariesModalOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={[styles.pastItemDate, { color: theme.textPrimary }]}>
                          {psDate} • {psTime}
                        </Text>
                        {isCurrent && (
                          <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '700' }}>Active</Text>
                        )}
                      </View>
                      <Text style={[styles.pastItemSnippet, { color: theme.textSecondary }]} numberOfLines={2}>
                        {ps.paragraph}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
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
  prepareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  prepareBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  generatingCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  generatingTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  generatingSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modelBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timestampText: {
    fontSize: 11,
    marginLeft: 'auto',
  },
  paragraphCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  paragraphText: {
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  flagsCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  flagsCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  flagItemRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  flagBullet: {
    color: '#D97706',
    fontWeight: '700',
    marginRight: 6,
  },
  flagText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionsGrid: {
    gap: 10,
    marginBottom: 12,
  },
  sectionBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionListItem: {
    paddingVertical: 3,
  },
  sectionItemText: {
    fontSize: 12,
    lineHeight: 17,
  },
  citationsBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  citationsTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  citationRow: {
    marginBottom: 8,
  },
  citationSentence: {
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  citationFactsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  citationFactPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  citationFactPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    gap: 10,
  },
  pastSummariesBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  pastSummariesText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sharePdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  sharePdfText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  noRecordsCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
  },
  noRecordsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  noRecordsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  noRecordsSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyContainer: {
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
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitleText: {
    fontSize: 17,
    fontWeight: '700',
  },
  pastItemCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  pastItemDate: {
    fontSize: 13,
    fontWeight: '700',
  },
  pastItemSnippet: {
    fontSize: 12,
    lineHeight: 16,
  },
});
