import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import MapView, { UrlTile, Marker } from 'react-native-maps';

import { useApp } from '@/context/AppContext';

const { width } = Dimensions.get('window');

// Default fallback coordinates (Bengaluru, JSS Academy)
const locationData = { latitude: 12.903269, longitude: 77.504899 };

export default function LocationScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { caretaker, elderlyUsers, selectedUser } = useApp();

  // Combine caretaker and elderly users into dynamic family members list
  const familyMembers = [
    {
      id: 'caretaker-1',
      name: caretaker?.name || 'Steve Rogers',
      role: 'Caretaker',
      details: 'Active now • Bengaluru',
      address: 'JSS Academy of Technical Education, Bengaluru',
      distance: '0 km',
      location: { lat: 12.903269, lng: 77.504899 },
    },
    ...elderlyUsers.map((user, idx) => ({
      id: user.id,
      name: user.name,
      role: `${user.relation} (${user.age} yrs)`,
      details: `Monitored • ${user.contact}`,
      address: idx % 2 === 0 ? '42, 8th C Main, Malleshwaram West, Bengaluru' : 'Indiranagar 100ft Rd, Bengaluru',
      distance: `${(idx + 1) * 3} km`,
      location: {
        lat: 12.903269 + (idx + 1) * 0.008,
        lng: 77.504899 + (idx + 1) * 0.008,
      },
    })),
  ];

  const [isAddFamilyVisible, setIsAddFamilyVisible] = useState(false);
  const [isViewingMyLocation, setIsViewingMyLocation] = useState(true);
  const [selectedMember, setSelectedMember] = useState<any>(null);

  
  const [region, setRegion] = useState({
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
  });

  const theme = {
    background: isDark ? '#000000' : '#F2F2F7',
    cardBg: isDark ? '#1C1C1E' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8E8E93' : '#8E8E93',
    accent: '#007AFF',
    border: isDark ? '#38383A' : '#C6C6C8',
    blurTint: isDark ? 'dark' : 'light' as any,
  };

  const focusLocation = (member: any) => {
      setRegion({
          latitude: member.location.lat,
          longitude: member.location.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
      });
      setIsViewingMyLocation(false);
      setSelectedMember(member);
  };

  const focusMyLocation = () => {
      setRegion({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
      });
      setIsViewingMyLocation(true);
      setSelectedMember(null);
  };

  return (
    <View style={styles.container}>
      {/* Interactive OpenStreetMap */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        region={region}
        mapType="none" // Hide default maps
      >
        <UrlTile
          urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        {/* Render Family Member Markers */}
        {familyMembers.map((member) => (
          <Marker
            key={member.id}
            coordinate={{ latitude: member.location.lat, longitude: member.location.lng }}
            title={member.name}
          >
             <View style={[styles.markerPin, { backgroundColor: theme.accent }]}>
                <Ionicons name="person" size={20} color="#FFF" />
             </View>
          </Marker>
        ))}
      </MapView>

      <SafeAreaView style={styles.safeArea} pointerEvents="box-none" edges={['top']}>
        {/* Floating Header Back Button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButtonWrapper}>
            <BlurView intensity={80} tint={theme.blurTint} style={styles.iconButton}>
              <Feather name="arrow-left" size={24} color={theme.textPrimary} />
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Back Button - Shows when viewing family member's location */}
        {!isViewingMyLocation && (
            <View style={styles.focusBackWrapper}>
                <TouchableOpacity activeOpacity={0.8} onPress={focusMyLocation}>
                    <BlurView intensity={80} tint={theme.blurTint} style={styles.iconButton}>
                        <Feather name="crosshair" size={20} color={theme.accent} />
                    </BlurView>
                </TouchableOpacity>
            </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Bottom Sheet - People List */}
        <View style={styles.bottomSheetContainer}>
          <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.bottomSheet}>
            <View style={styles.sheetDragHandle} />
            
            {selectedMember ? (
              <View style={styles.detailView}>
                <View style={styles.detailHeader}>
                  <Text style={[styles.detailTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                    {selectedMember.email}
                  </Text>
                  <TouchableOpacity style={[styles.closeButton, { backgroundColor: isDark ? '#333' : '#E5E5EA' }]} onPress={() => setSelectedMember(null)}>
                    <Feather name="x" size={20} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.locationInfo}>
                  <Text style={[styles.locationTitle, { color: theme.textPrimary }]}>{selectedMember.details.split('•')[0].trim()}</Text>
                  <Text style={[styles.locationAddress, { color: theme.textSecondary }]} numberOfLines={2}>
                    {selectedMember.address}
                  </Text>
                  <Text style={styles.liveText}>Live</Text>
                </View>

                <View style={styles.actionGrid}>
                  <TouchableOpacity style={[styles.actionCard, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
                    <View style={styles.actionIconBgContact}>
                      <Ionicons name="person" size={20} color="#D97757" />
                    </View>
                    <View>
                      <Text style={[styles.actionCardTitle, { color: theme.textPrimary }]}>Contact</Text>
                      <Text style={[styles.actionCardSubtitle, { color: theme.textSecondary }]}>Info</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.actionCard, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
                    <View style={styles.actionIconBgDirections}>
                      <Ionicons name="arrow-undo" size={20} color="#FFFFFF" style={{ transform: [{ rotateY: '180deg' }, { rotateZ: '-45deg' }] }} />
                    </View>
                    <View>
                      <Text style={[styles.actionCardTitle, { color: theme.textPrimary }]}>Directions</Text>
                      <Text style={[styles.actionCardSubtitle, { color: theme.textSecondary }]}>{selectedMember.distance}</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.notificationCard, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
                  <View style={styles.actionIconBgNotification}>
                    <Ionicons name="notifications" size={20} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.actionCardTitle, { color: theme.textPrimary, marginLeft: 16 }]}>Notifications</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>People</Text>
                  <TouchableOpacity style={[styles.addButton, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]} onPress={() => setIsAddFamilyVisible(true)}>
                    <Feather name="plus" size={20} color={theme.textPrimary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.peopleList} contentContainerStyle={styles.peopleListContent}>
                  {familyMembers.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={styles.personRow}
                      onPress={() => focusLocation(member)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.personAvatar, { backgroundColor: isDark ? '#48484A' : '#C7C7CC' }]}>
                        <Ionicons name="person" size={24} color="#FFFFFF" />
                      </View>
                      <View style={styles.personInfo}>
                        <Text style={[styles.personName, { color: theme.textPrimary }]} numberOfLines={1}>{member.name}</Text>
                        <Text style={[styles.personDetails, { color: theme.textSecondary }]}>{member.details}</Text>
                      </View>
                      <Text style={[styles.personDistance, { color: theme.textSecondary }]}>{member.distance}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </BlurView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    zIndex: 10,
  },
  iconButtonWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  iconButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusBackWrapper: {
    position: 'absolute',
    top: 140,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  bottomSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden', // to clip the BlurView
  },
  bottomSheet: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 40, // space for tab bar
  },
  sheetDragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#8E8E93',
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.5,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  peopleList: {
    maxHeight: 250, // limit height so it doesn't take over screen
  },
  peopleListContent: {
    paddingBottom: 20,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(142, 142, 147, 0.3)',
  },
  personAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  personInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  personName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  personDetails: {
    fontSize: 13,
  },
  personDistance: {
    fontSize: 14,
    marginLeft: 12,
  },
  detailView: {
    width: '100%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    marginBottom: 24,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 15,
    marginBottom: 6,
    lineHeight: 20,
  },
  liveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#34C759',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    height: 120,
    justifyContent: 'space-between',
  },
  actionIconBgContact: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(217, 119, 87, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBgDirections: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBgNotification: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionCardSubtitle: {
    fontSize: 14,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  markerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  }
});
