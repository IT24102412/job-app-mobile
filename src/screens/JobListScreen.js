import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";
import { clearToken, getCurrentUserRole } from "../api/auth";
import { colors, statusColors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";
import ChatBot from "../components/ChatBot";

export default function JobListScreen({ navigation }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const response = await api.get("/jobs/");
      setJobs(response.data);
    } catch (error) {
      console.log("Failed to load jobs:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await api.get("/notifications/me");
      const unread = response.data.filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.log("Failed to load notifications:", error.message);
    }
  };

  const handleLogout = async () => {
    await clearToken();
    navigation.replace("Login");
  };

  useFocusEffect(
    useCallback(() => {
      loadJobs();
      loadUnreadCount();
      getCurrentUserRole().then((r) => {
        setRole(r);
        const canCreate = r === "sales_executive" || r === "admin";
        const isAdmin = r === "admin";
        navigation.setOptions({
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {isAdmin && (
                <TouchableOpacity
                  onPress={() => navigation.navigate("Reports")}
                  style={styles.iconBadge}
                  activeOpacity={0.7}
                >
                  <Ionicons name="stats-chart" size={17} color={colors.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => navigation.navigate("Notifications")}
                style={styles.bellButton}
              >
                <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
                {unreadCount > 0 && (
                  <View style={styles.unreadDot}>
                    <Text style={styles.unreadDotText}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              {canCreate && (
                <TouchableOpacity
                  onPress={() => navigation.navigate("CreateJob")}
                  style={{ marginRight: 16 }}
                >
                  <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleLogout} style={{ marginRight: 12 }}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>Logout</Text>
              </TouchableOpacity>
            </View>
          ),
        });
      });
    }, [unreadCount])
  );

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
        onRefresh={loadJobs}
        refreshing={loading}
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
              {item.customer_name && (
                <View style={styles.customerRow}>
                  <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.customerName}>{item.customer_name}</Text>
                </View>
              )}
              <Text style={styles.detail}>
                {item.job_type} · {item.service_type}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No jobs found.</Text>}
      />
      <ChatBot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  bellButton: {
    marginRight: 16,
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  unreadDotText: { color: colors.surface, fontSize: 9, fontWeight: fontWeight.bold },
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
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  customerName: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  detail: { color: colors.textSecondary, marginTop: 2, fontSize: fontSize.base },
  empty: { textAlign: "center", marginTop: 40, color: colors.textMuted },
});