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
import { colors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await api.get("/notifications/me");
      setNotifications(response.data);
    } catch (error) {
      console.log("Failed to load notifications:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const handleTap = async (notification) => {
    if (!notification.is_read) {
      try {
        await api.post(`/notifications/${notification.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        );
      } catch (error) {
        console.log("Failed to mark as read:", error.message);
      }
    }
    navigation.navigate("JobDetail", { jobId: notification.job_id });
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
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        onRefresh={loadNotifications}
        refreshing={loading}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.is_read && styles.unreadCard]}
            onPress={() => handleTap(item)}
            activeOpacity={0.7}
          >
            <View style={styles.row}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: item.recipient_admin_id ? colors.accentTealLight : colors.primaryLight },
                ]}
              >
                <Ionicons
                  name={item.recipient_admin_id ? "document-attach" : "person-add"}
                  size={16}
                  color={item.recipient_admin_id ? colors.accentTeal : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.messageRow}>
                  {!item.is_read && <View style={styles.unreadDot} />}
                  <Text style={[styles.message, !item.is_read && styles.unreadMessage]}>
                    {item.message}
                  </Text>
                </View>
                <Text style={styles.time}>
                  {new Date(item.created_at + "Z").toLocaleString()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
            <Text style={styles.empty}>No notifications yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  messageRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.dangerLight,
  },
  message: { fontSize: fontSize.sm, fontWeight: fontWeight.regular, color: colors.textSecondary, flex: 1 },
  unreadMessage: { fontWeight: fontWeight.bold, color: colors.textPrimary },
  time: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 },
  emptyContainer: { alignItems: "center", marginTop: 60 },
  empty: { textAlign: "center", marginTop: spacing.md, color: colors.textMuted },
});