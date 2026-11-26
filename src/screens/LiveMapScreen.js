import React, { useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";
import LiveMapView from "./LiveMapView";
import { colors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

const REFRESH_MS = 20000;

function ago(seconds) {
  if (seconds < 90) return "just now";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ${m % 60} min ago`;
}

export default function LiveMapScreen({ navigation }) {
  const [points, setPoints] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef(null);

  const load = async () => {
    try {
      const res = await api.get("/tracking/live");
      setPoints(res.data);
    } catch (error) {
      console.log("Failed to load live locations:", error.message);
    } finally {
      setLoaded(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
      timer.current = setInterval(load, REFRESH_MS);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }, [])
  );

  const openInMaps = (p) =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`);

  return (
    <View style={styles.container}>
      <View style={styles.mapBox}>
        <LiveMapView points={points} />
      </View>

      <View style={styles.listBox}>
        <Text style={styles.heading}>
          {points.length} {points.length === 1 ? "person" : "people"} sharing location
        </Text>
        <Text style={styles.note}>Only people with a job in progress appear here. Updates every minute.</Text>
        <ScrollView>
          {loaded && points.length === 0 ? (
            <Text style={styles.empty}>No one is sharing a location right now.</Text>
          ) : (
            points.map((p) => (
              <TouchableOpacity key={p.technician_id} style={styles.row} onPress={() => openInMaps(p)} activeOpacity={0.7}>
                <View
                  style={[styles.dot, { backgroundColor: p.seconds_ago > 600 ? colors.textMuted : colors.success }]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {p.job_number}
                    {p.customer_name ? ` · ${p.customer_name}` : ""}
                  </Text>
                </View>
                <Text style={styles.age}>{ago(p.seconds_ago)}</Text>
                <Ionicons name="open-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapBox: { flex: 3, backgroundColor: colors.border },
  listBox: { flex: 2, padding: spacing.lg },
  heading: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  note: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm, marginTop: 2 },
  empty: { color: colors.textMuted, marginTop: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  sub: { fontSize: fontSize.xs, color: colors.textSecondary },
  age: { fontSize: fontSize.xs, color: colors.textMuted },
});
