import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/context/ThemeContext';

const { width } = Dimensions.get('window');

const routines = [
  { id: 'all', title: 'Overall', icon: 'border-all', type: 'material' },
  { id: 'workout', title: 'Workout', icon: 'dumbbell', type: 'font-awesome' },
  { id: 'skincare', title: 'Skincare', icon: 'face-woman', type: 'material' },
  { id: 'diet', title: 'Eating Clean', icon: 'food-apple', type: 'material' },
  { id: 'travel', title: 'Travel', icon: 'airplane', type: 'material' },
];

export default function StatsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { activeTheme } = useTheme();
  
  const [activeRoutine, setActiveRoutine] = useState('all');

  const theme = {
    background: isDark ? '#0F172A' : '#F9FAFB',
    cardBg: isDark ? '#1E293B' : '#FFFFFF',
    textPrimary: isDark ? '#F8FAFC' : '#111827',
    textSecondary: isDark ? '#94A3B8' : '#6B7280',
    primary: '#FF477E', // pinkish-red from mockup
    primaryLight: 'rgba(255, 71, 126, 0.1)',
    border: isDark ? '#334155' : '#F3F4F6',
    calendarDay: isDark ? '#F8FAFC' : '#374151',
    calendarMuted: isDark ? '#475569' : '#D1D5DB',
    orange: '#F59E0B',
    blue: '#3B82F6',
    teal: '#10B981',
    purple: '#8B5CF6',
  };

  const currentRoutineObj = routines.find(r => r.id === activeRoutine) || routines[0];

  // Calendar rendering helper
  const renderCalendar = () => {
    const daysOfWeek = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
    
    // Hardcoded highlighted days to match mockup
    const highlightedDays = [15, 24, 30]; 

    return (
      <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity><Feather name="chevron-left" size={20} color={theme.textSecondary} /></TouchableOpacity>
          <Text style={[styles.calendarMonth, { color: theme.textPrimary }]}>08/2026</Text>
          <TouchableOpacity><Feather name="chevron-right" size={20} color={theme.textSecondary} /></TouchableOpacity>
        </View>

        <View style={styles.calendarDaysRow}>
          {daysOfWeek.map((day, i) => (
            <Text key={i} style={[styles.calendarDayText, { color: theme.textPrimary }]}>{day}</Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {/* Padding days */}
          {[27, 28, 29, 30, 31].map(day => (
             <View key={`pad-${day}`} style={styles.calendarCell}>
               <Text style={[styles.calendarDate, { color: theme.calendarMuted }]}>{day}</Text>
             </View>
          ))}
          {/* Actual month days */}
          {daysInMonth.map(day => {
            const isHighlighted = highlightedDays.includes(day);
            return (
              <View key={day} style={styles.calendarCell}>
                <View style={[styles.dateCircle, isHighlighted && { borderColor: theme.primary, borderWidth: 1 }]}>
                  <Text style={[styles.calendarDate, { color: theme.calendarDay }, isHighlighted && { color: theme.primary }]}>{day}</Text>
                </View>
                {day === 24 && <View style={styles.todayDot} />}
              </View>
            );
          })}
          {/* Next month padding */}
          {[1, 2, 3, 4, 5, 6].map(day => (
             <View key={`next-${day}`} style={styles.calendarCell}>
               <Text style={[styles.calendarDate, { color: theme.calendarMuted }]}>{day}</Text>
             </View>
          ))}
        </View>
      </View>
    );
  };

  // Yearly Status helper (GitHub style)
  const renderYearlyStatus = () => {
    return (
      <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
        <View style={styles.yearlyHeader}>
          <Text style={[styles.yearlyTitle, { color: theme.textPrimary }]}>Yearly Status</Text>
          <View style={styles.yearDropdown}>
             <Text style={styles.yearText}>2026</Text>
             <Feather name="chevron-down" size={14} color="#888" style={{marginLeft: 4}}/>
          </View>
        </View>
        
        {/* Mocking the contribution graph */}
        <View style={styles.matrixContainer}>
          {Array.from({ length: 7 }).map((_, row) => (
            <View key={row} style={styles.matrixRow}>
              {Array.from({ length: 24 }).map((_, col) => {
                // Randomize some blocks
                const isActive = Math.random() > 0.85;
                return (
                  <View 
                    key={col} 
                    style={[
                      styles.matrixBlock, 
                      { backgroundColor: isActive ? theme.primary : (isDark ? '#334155' : '#F1F5F9') }
                    ]} 
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.primaryLight }]}>
          <Feather name="menu" size={20} color={theme.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.titleDropdown}>
           {currentRoutineObj.type === 'material' ? (
             <MaterialCommunityIcons name={currentRoutineObj.icon as any} size={20} color={theme.primary} />
           ) : (
             <FontAwesome5 name={currentRoutineObj.icon} size={18} color={theme.primary} />
           )}
           <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{currentRoutineObj.title}</Text>
           <Feather name="chevron-down" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.primaryLight }]}>
          <Feather name="plus" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Routine Tabs */}
      <View style={styles.routineTabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {routines.map((routine) => {
            const isActive = activeRoutine === routine.id;
            return (
              <TouchableOpacity 
                key={routine.id} 
                style={styles.tabIconWrapper}
                onPress={() => setActiveRoutine(routine.id)}
              >
                <View style={styles.tabIcon}>
                  {routine.type === 'material' ? (
                    <MaterialCommunityIcons 
                      name={routine.icon as any} 
                      size={24} 
                      color={isActive ? theme.primary : theme.calendarMuted} 
                    />
                  ) : (
                    <FontAwesome5 
                      name={routine.icon} 
                      size={22} 
                      color={isActive ? theme.primary : theme.calendarMuted} 
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCalendar()}

        {activeRoutine === 'all' ? (
          /* Overall View Content */
          <View style={[styles.card, { backgroundColor: theme.cardBg, paddingVertical: 40 }]}>
            {/* Circular Progress Mock */}
            <View style={styles.circularProgressContainer}>
               <View style={[styles.progressCircleBg, { borderColor: theme.primaryLight }]}>
                 <View style={styles.progressCircleInner}>
                    <Text style={[styles.progressPercentage, { color: theme.textPrimary }]}>19.83%</Text>
                    <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Overall Rate</Text>
                    <Feather name="repeat" size={16} color={theme.textSecondary} style={{marginTop: 8}} />
                 </View>
               </View>
               {/* Simulating the progress stroke using absolute positioning for a mock */}
               <View style={[styles.progressStrokeMock, { borderTopColor: theme.primary, borderRightColor: theme.primary }]} />
            </View>

            <View style={styles.overallStatsRow}>
               <View style={styles.overallStatItem}>
                 <View style={[styles.statIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                   <Feather name="award" size={18} color={theme.orange} />
                 </View>
                 <Text style={[styles.statValue, { color: theme.textPrimary }]}>4<Text style={styles.statUnit}>Days</Text></Text>
                 <Text style={[styles.statDesc, { color: theme.textSecondary }]}>Best Streaks</Text>
               </View>
               <View style={styles.overallStatItem}>
                 <View style={[styles.statIconBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                   <Feather name="calendar" size={18} color={theme.blue} />
                 </View>
                 <Text style={[styles.statValue, { color: theme.textPrimary }]}>11<Text style={styles.statUnit}>Days</Text></Text>
                 <Text style={[styles.statDesc, { color: theme.textSecondary }]}>Perfect Days</Text>
               </View>
            </View>

            {/* Task Breakdown Section */}
            <View style={[styles.taskBreakdownContainer, { borderTopColor: theme.border }]}>
              <Text style={[styles.taskBreakdownTitle, { color: theme.textPrimary }]}>Routine Completion</Text>
              
              {/* Task 1 */}
              <View style={styles.taskBreakdownItem}>
                <View style={[styles.taskIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Feather name="droplet" size={16} color={theme.blue} />
                </View>
                <View style={styles.taskBreakdownDetails}>
                  <View style={styles.taskBreakdownHeader}>
                    <Text style={[styles.taskBreakdownName, { color: theme.textPrimary }]}>Drink Water</Text>
                    <Text style={[styles.taskBreakdownPct, { color: theme.blue }]}>100%</Text>
                  </View>
                  <View style={[styles.taskProgressBarBg, { backgroundColor: theme.border }]}>
                    <View style={[styles.taskProgressBarFill, { width: '100%', backgroundColor: theme.blue }]} />
                  </View>
                </View>
              </View>

              {/* Task 2 */}
              <View style={styles.taskBreakdownItem}>
                <View style={[styles.taskIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <MaterialCommunityIcons name="pill" size={16} color={theme.teal} />
                </View>
                <View style={styles.taskBreakdownDetails}>
                  <View style={styles.taskBreakdownHeader}>
                    <Text style={[styles.taskBreakdownName, { color: theme.textPrimary }]}>Take Meds</Text>
                    <Text style={[styles.taskBreakdownPct, { color: theme.teal }]}>85%</Text>
                  </View>
                  <View style={[styles.taskProgressBarBg, { backgroundColor: theme.border }]}>
                    <View style={[styles.taskProgressBarFill, { width: '85%', backgroundColor: theme.teal }]} />
                  </View>
                </View>
              </View>

              {/* Task 3 */}
              <View style={styles.taskBreakdownItem}>
                <View style={[styles.taskIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <MaterialCommunityIcons name="silverware-fork-knife" size={16} color={theme.orange} />
                </View>
                <View style={styles.taskBreakdownDetails}>
                  <View style={styles.taskBreakdownHeader}>
                    <Text style={[styles.taskBreakdownName, { color: theme.textPrimary }]}>Lunch on time</Text>
                    <Text style={[styles.taskBreakdownPct, { color: theme.orange }]}>60%</Text>
                  </View>
                  <View style={[styles.taskProgressBarBg, { backgroundColor: theme.border }]}>
                    <View style={[styles.taskProgressBarFill, { width: '60%', backgroundColor: theme.orange }]} />
                  </View>
                </View>
              </View>

              {/* Task 4 */}
              <View style={styles.taskBreakdownItem}>
                <View style={[styles.taskIconBg, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                  <FontAwesome5 name="dumbbell" size={14} color={theme.purple} />
                </View>
                <View style={styles.taskBreakdownDetails}>
                  <View style={styles.taskBreakdownHeader}>
                    <Text style={[styles.taskBreakdownName, { color: theme.textPrimary }]}>Gym Routine</Text>
                    <Text style={[styles.taskBreakdownPct, { color: theme.purple }]}>40%</Text>
                  </View>
                  <View style={[styles.taskProgressBarBg, { backgroundColor: theme.border }]}>
                    <View style={[styles.taskProgressBarFill, { width: '40%', backgroundColor: theme.purple }]} />
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          /* Specific Routine View Content */
          <View>
            {renderYearlyStatus()}
            
            <View style={styles.gridCards}>
              <View style={[styles.smallCard, { backgroundColor: theme.cardBg }]}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)', alignSelf: 'flex-start' }]}>
                   <Feather name="check-circle" size={18} color={theme.blue} />
                 </View>
                 <Text style={[styles.smallCardValue, { color: theme.textPrimary }]}>0 <Text style={styles.smallCardUnit}>Day</Text></Text>
                 <Text style={[styles.smallCardLabel, { color: theme.textSecondary }]}>success in February</Text>
              </View>
              
              <View style={[styles.smallCard, { backgroundColor: theme.cardBg }]}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)', alignSelf: 'flex-start' }]}>
                   <Feather name="check-square" size={18} color={theme.teal} />
                 </View>
                 <Text style={[styles.smallCardValue, { color: theme.textPrimary }]}>0 <Text style={styles.smallCardUnit}>Day</Text></Text>
                 <Text style={[styles.smallCardLabel, { color: theme.textSecondary }]}>Total Success</Text>
              </View>

              <View style={[styles.smallCard, { backgroundColor: theme.cardBg }]}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(139, 92, 246, 0.1)', alignSelf: 'flex-start' }]}>
                   <Feather name="layers" size={18} color={theme.purple} />
                 </View>
                 <Text style={[styles.smallCardValue, { color: theme.textPrimary }]}>0 <Text style={styles.smallCardUnit}>Day</Text></Text>
                 <Text style={[styles.smallCardLabel, { color: theme.textSecondary }]}>Current Streak</Text>
              </View>

              <View style={[styles.smallCard, { backgroundColor: theme.cardBg }]}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.1)', alignSelf: 'flex-start' }]}>
                   <Feather name="award" size={18} color={theme.orange} />
                 </View>
                 <Text style={[styles.smallCardValue, { color: theme.textPrimary }]}>0 <Text style={styles.smallCardUnit}>Day</Text></Text>
                 <Text style={[styles.smallCardLabel, { color: theme.textSecondary }]}>Best Streak</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  routineTabs: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tabsScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tabIconWrapper: {
    paddingHorizontal: 16,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarMonth: {
    fontSize: 16,
    fontWeight: '600',
  },
  calendarDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '600',
    width: 30,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDate: {
    fontSize: 15,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151', // Assuming dark gray dot for today
    position: 'absolute',
    bottom: -2,
  },
  circularProgressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  progressCircleBg: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStrokeMock: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 12,
    borderColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  progressCircleInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercentage: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 14,
  },
  overallStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  overallStatItem: {
    alignItems: 'center',
  },
  statIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statUnit: {
    fontSize: 12,
    fontWeight: 'normal',
    marginLeft: 2,
  },
  statDesc: {
    fontSize: 12,
  },
  yearlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  yearlyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  yearDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  yearText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  matrixContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  matrixRow: {
    flexDirection: 'row',
    gap: 4,
  },
  matrixBlock: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  gridCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  smallCard: {
    width: '48%',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  smallCardValue: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 12,
  },
  smallCardUnit: {
    fontSize: 14,
    fontWeight: 'normal',
  },
  smallCardLabel: {
    fontSize: 12,
  },
  taskBreakdownContainer: {
    marginTop: 40,
    borderTopWidth: 1,
    paddingTop: 24,
  },
  taskBreakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  taskBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  taskIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  taskBreakdownDetails: {
    flex: 1,
  },
  taskBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskBreakdownName: {
    fontSize: 15,
    fontWeight: '600',
  },
  taskBreakdownPct: {
    fontSize: 14,
    fontWeight: '700',
  },
  taskProgressBarBg: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  taskProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
