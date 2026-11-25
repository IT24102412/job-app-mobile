import React, { useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";
import { colors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Drivers are named "Calling name - Vehicle number", e.g. "Nuwan - PA-5931"
const isDriverName = (name) => /\s-\s[A-Za-z]{1,4}-?\d{3,4}\s*$/.test(name || "");

export default function WorkshopTeamScreen({ navigation, route }) {
  const kind = route?.params?.kind === "drivers" ? "drivers" : "technicians";
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/workshop/technicians", { params: { trip_date: todayIso() } });
      const wantDrivers = kind === "drivers";
      setPeople(res.data.filter((t) => isDriverName(t.name) === wantDrivers));
    } catch (error) {
      console.log("Failed to load workshop team:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: kind === "drivers" ? "Workshop Drivers" : "Workshop Technicians" });
      load();
    }, [kind])
  );

  if (loading && people.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const free = people.filter((p) => !p.busy).length;

  return (
    <View style={styles.container}>
      <Text style={styles.summary}>
        {free} of {people.length} free today
      </Text>
      <FlatList
        data={people}
        keyExtractor={(item) => item.id.toString()}
        onRefresh={load}
        refreshing={loading}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Ionicons
              name={kind === "drivers" ? "car-sport" : "person"}
              size={20}
              color={colors.textSecondary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
            </View>
            <View
              style={[
                styles.badge,
                { backgroundColor: item.busy ? colors.warningLight : colors.successLight },
              ]}
            >
              <Text style={[styles.badgeText, { color: item.busy ? colors.warning : colors.success }]}>
                {item.busy ? "ON A TRIP" : "FREE"}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No one to show.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  summary: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    color: colors.textSecondary,
    fontSize: fontSize.base,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  phone: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  empty: { textAlign: "center", marginTop: 40, color: colors.textMuted },
});
