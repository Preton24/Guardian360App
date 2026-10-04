import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { UrlTile, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

export interface LocationMapProps {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  familyMembers: Array<{
    id: string;
    name: string;
    location: { lat: number; lng: number };
  }>;
  accentColor: string;
}

export default function LocationMap({ region, familyMembers, accentColor }: LocationMapProps) {
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      region={region}
      showsUserLocation={true}
      showsCompass={true}
    >
      <UrlTile
        urlTemplate="https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        maximumZ={19}
        tileSize={256}
      />
      {familyMembers.map((member) => (
        <Marker
          key={member.id}
          coordinate={{ latitude: member.location.lat, longitude: member.location.lng }}
          title={member.name}
        >
          <View style={[styles.markerPin, { backgroundColor: accentColor }]}>
            <Ionicons name="person" size={20} color="#FFF" />
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
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
  },
});
