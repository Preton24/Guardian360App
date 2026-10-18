import React from 'react';
import { View, StyleSheet } from 'react-native';

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

export default function LocationMap({ region }: LocationMapProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <iframe
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${region.longitude - 0.015}%2C${region.latitude - 0.015}%2C${region.longitude + 0.015}%2C${region.latitude + 0.015}&layer=mapnik&marker=${region.latitude}%2C${region.longitude}`}
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        title="Location Map"
      />
    </View>
  );
}

