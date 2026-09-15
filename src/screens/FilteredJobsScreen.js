import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import api from "../api/client";
import { colors, statusColors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

export default function FilteredJobsScreen({ route, navigation }) {
  const { title, params } = route.params;
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title });
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const response = await api.get("/jobs/", { params });
      setJobs(response.data);
    } catch (error) {
      console.log("Failed to load filtered jobs:", error.message);
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
        data={jobs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const statusStyle = statusColors[item.status] || statusColors.created;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("JobDetail", { jobId: item.id })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.jobNumber}>{item.job_number}</Text>
                <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.detail}>
                {item.job_type} · {item.service_type}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No jobs match this filter.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  jobNumber: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  detail: { color: colors.textSecondary, marginTop: spacing.xs, fontSize: fontSize.base },
  empty: { textAlign: "center", marginTop: 40, color: colors.textMuted },
});