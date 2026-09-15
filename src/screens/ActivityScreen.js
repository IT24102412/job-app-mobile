import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";
import { colors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

export default function ActivityScreen({ navigation }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, []);

  const loadActivity = async () => {
    setLoading(true);
    try {
      const response = await api.get("/notifications/recent-activity", { params: { limit: 50 } });
      setActivity(response.data);
    } catch (error) {
      console.log("Failed to load activity:", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={activity}
        keyExtractor={(item) => item.id.toString()}
        onRefresh={loadActivity}
        refreshing={loading}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("JobDetail", { jobId: item.job_id })}
            activeOpacity={0.7}
          >
            <View style={styles.row}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name={item.recipient_admin_id ? "document-attach" : "person-add"}
                  size={16}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.time}>
                  {new Date(item.created_at + "Z").toLocaleString()}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No activity yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  message: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  time: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
});