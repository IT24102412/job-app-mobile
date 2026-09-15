import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";
import { getCurrentUserId, getCurrentUserRole, getCurrentUserName } from "../api/auth";
import { colors, statusColors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

function isToday(dateString) {
  const d = new Date(dateString + "Z");
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ROLE_LABELS = {
  admin: "Administrator",
  sales_executive: "Sales Executive",
  technician: "Technician",
};

export default function DashboardScreen({ navigation }) {
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [name, setName] = useState(null);
  const [loading, setLoading] = useState(true);

  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [activity, setActivity] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getCurrentUserRole();
      const uid = await getCurrentUserId();
      const n = await getCurrentUserName();
      setRole(r);
      setUserId(uid);
      setName(n);

      const jobsRes = await api.get("/jobs/");
      setJobs(jobsRes.data);

      if (r === "admin") {
        const [techRes, activityRes] = await Promise.all([
          api.get("/technicians/"),
          api.get("/notifications/recent-activity", { params: { limit: 8 } }),
        ]);
        setTechnicians(techRes.data);
        setActivity(activityRes.data);
      }
    } catch (error) {
      console.log("Failed to load dashboard:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const Header = () => (
    <View style={styles.header}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.userName}>{name || "there"}</Text>
      </View>
      <View style={styles.roleBadge}>
        <Text style={styles.roleBadgeText}>{ROLE_LABELS[role] || role}</Text>
      </View>
    </View>
  );

  const StatCard = ({ icon, number, label, accent, accentLight }) => (
    <View style={[styles.statCard, { borderTopColor: accent }]}>
      <View style={[styles.statIconCircle, { backgroundColor: accentLight }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.statNumber}>{number}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  // ---------- ADMIN DASHBOARD ----------
  if (role === "admin") {
    const todaysJobs = jobs.filter((j) => isToday(j.created_at));
    const pending = todaysJobs.filter((j) => j.status === "created" || j.status === "assigned").length;
    const inProgress = todaysJobs.filter((j) => j.status === "started").length;
    const closedToday = todaysJobs.filter((j) => j.status === "closed").length;
    const availableCount = technicians.filter((t) => t.is_available).length;

    return (
      <ScrollView style={styles.container}>
        <Header />

        <Text style={styles.sectionTitle}>Today</Text>
        <View style={styles.statsRow}>
          <StatCard icon="briefcase" number={todaysJobs.length} label="Jobs Today" accent={colors.primary} accentLight={colors.primaryLight} />
          <StatCard icon="hourglass" number={pending} label="Pending" accent={colors.warning} accentLight={colors.warningLight} />
        </View>
        <View style={styles.statsRow}>
          <StatCard icon="play" number={inProgress} label="In Progress" accent={colors.accentTeal} accentLight={colors.accentTealLight} />
          <StatCard icon="checkmark-circle" number={closedToday} label="Closed Today" accent={colors.success} accentLight={colors.successLight} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="people" size={18} color={colors.accentPurple} />
            <Text style={styles.cardTitle}>Technician Availability</Text>
          </View>
          <Text style={styles.availabilityText}>
            {availableCount} of {technicians.length} available right now
          </Text>
          <View style={styles.availabilityBarTrack}>
            <View
              style={[
                styles.availabilityBarFill,
                { width: `${technicians.length ? (availableCount / technicians.length) * 100 : 0}%` },
              ]}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate("Activity")}
          activeOpacity={0.7}
        >
          <View style={styles.cardTitleRow}>
            <Ionicons name="pulse" size={18} color={colors.accentOrange} />
            <Text style={styles.cardTitle}>Recent Activity</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: "auto" }} />
          </View>
          {activity.length === 0 ? (
            <Text style={styles.emptyText}>No recent activity.</Text>
          ) : (
            activity.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.activityRow}>
                <Ionicons
                  name={item.recipient_admin_id ? "document-attach-outline" : "person-add-outline"}
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.activityMessageCompact} numberOfLines={1}>
                  {item.message}
                </Text>
              </View>
            ))
          )}
          <Text style={styles.viewAllText}>Tap to view all activity</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate("Reports")}>
          <Ionicons name="stats-chart" size={18} color={colors.primary} />
          <Text style={styles.linkButtonText}>View Monthly Report</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate("DailyReport")}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.linkButtonText}>View Daily Technician Report</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButtonOutline} onPress={() => navigation.navigate("JobList")}>
          <Text style={styles.linkButtonOutlineText}>View All Jobs</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---------- TECHNICIAN DASHBOARD ----------
  if (role === "technician") {
    const activeJob = jobs.find((j) => j.status === "assigned" || j.status === "started");
    const closedThisMonth = jobs.filter((j) => {
      if (j.status !== "closed" || !j.closed_at) return false;
      const now = new Date();
      const d = new Date(j.closed_at + "Z");
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const avgHours =
      closedThisMonth.length > 0
        ? (
            closedThisMonth.reduce((sum, j) => {
              const start = new Date(j.created_at + "Z");
              const end = new Date(j.closed_at + "Z");
              return sum + (end - start) / (1000 * 60 * 60);
            }, 0) / closedThisMonth.length
          ).toFixed(1)
        : null;

    return (
      <ScrollView style={styles.container}>
        <Header />

        <Text style={styles.sectionTitle}>Your Day</Text>

        {activeJob ? (
          <TouchableOpacity
            style={styles.activeJobCard}
            onPress={() => navigation.navigate("JobDetail", { jobId: activeJob.id })}
            activeOpacity={0.85}
          >
            <View style={styles.activeJobHeader}>
              <Ionicons name="flash" size={20} color={colors.surface} />
              <Text style={styles.activeJobLabel}>ACTIVE JOB</Text>
            </View>
            <Text style={styles.activeJobNumber}>{activeJob.job_number}</Text>
            <Text style={styles.activeJobDetail}>
              {activeJob.job_type} · {activeJob.service_type}
            </Text>
            <Text style={styles.activeJobStatus}>
              Status: {activeJob.status.toUpperCase()} — tap to open
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.noActiveJobCard}>
            <Ionicons name="cafe-outline" size={28} color={colors.textMuted} />
            <Text style={styles.noActiveJobText}>No active job right now.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>This Month</Text>
        <View style={styles.statsRow}>
          <StatCard icon="checkmark-done" number={closedThisMonth.length} label="Completed" accent={colors.success} accentLight={colors.successLight} />
          <StatCard
            icon="timer"
            number={avgHours !== null ? `${avgHours}h` : "—"}
            label="Avg. per Job"
            accent={colors.accentTeal}
            accentLight={colors.accentTealLight}
          />
        </View>

        <TouchableOpacity style={styles.linkButtonOutline} onPress={() => navigation.navigate("JobList")}>
          <Text style={styles.linkButtonOutlineText}>View All My Jobs</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButtonOutline} onPress={() => navigation.navigate("Notifications")}>
          <Text style={styles.linkButtonOutlineText}>View Notifications</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---------- SALES EXECUTIVE DASHBOARD ----------
  const myJobs = jobs.filter((j) => j.sales_executive_id === userId);
  const now = new Date();
  const myJobsThisMonth = myJobs.filter((j) => {
    const d = new Date(j.created_at + "Z");
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const pendingAssignment = myJobsThisMonth.filter((j) => j.status === "created").length;
  const recentJobs = [...myJobs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <ScrollView style={styles.container}>
      <Header />

      <Text style={styles.sectionTitle}>This Month</Text>
      <View style={styles.statsRow}>
        <StatCard icon="briefcase" number={myJobsThisMonth.length} label="Jobs Created" accent={colors.primary} accentLight={colors.primaryLight} />
        <StatCard icon="hourglass" number={pendingAssignment} label="Awaiting Assignment" accent={colors.warning} accentLight={colors.warningLight} />
      </View>

      <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate("CreateJob")}>
        <Ionicons name="add-circle" size={18} color={colors.primary} />
        <Text style={styles.linkButtonText}>Create New Job</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="time" size={18} color={colors.accentPurple} />
          <Text style={styles.cardTitle}>Recently Created</Text>
        </View>
        {recentJobs.length === 0 ? (
          <Text style={styles.emptyText}>No jobs created yet.</Text>
        ) : (
          recentJobs.map((item) => {
            const statusStyle = statusColors[item.status] || statusColors.created;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.recentJobRow}
                onPress={() => navigation.navigate("JobDetail", { jobId: item.id })}
              >
                <Text style={styles.recentJobNumber}>{item.job_number}</Text>
                <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <TouchableOpacity style={styles.linkButtonOutline} onPress={() => navigation.navigate("JobList")}>
        <Text style={styles.linkButtonOutlineText}>View All Jobs</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  avatarText: { color: colors.surface, fontWeight: fontWeight.bold, fontSize: fontSize.lg },
  greeting: { color: colors.textSecondary, fontSize: fontSize.sm },
  userName: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  roleBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  roleBadgeText: { color: colors.primaryDark, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  statsRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    borderTopWidth: 3,
    ...shadow.card,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  statNumber: { fontSize: 26, fontWeight: fontWeight.bold, color: colors.textPrimary },
  statLabel: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  availabilityText: { fontSize: fontSize.base, color: colors.textPrimary, marginBottom: spacing.sm },
  availabilityBarTrack: {
    height: 10,
    backgroundColor: colors.neutralLight,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  availabilityBarFill: { height: "100%", backgroundColor: colors.success, borderRadius: radius.pill },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  activityMessageCompact: { color: colors.textPrimary, fontSize: fontSize.sm, flex: 1 },
  viewAllText: { color: colors.primary, fontSize: fontSize.xs, marginTop: spacing.sm, textAlign: "center", fontWeight: fontWeight.semibold },
  emptyText: { textAlign: "center", color: colors.textMuted, marginVertical: 12 },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  linkButtonText: { color: colors.primaryDark, fontWeight: fontWeight.bold },
  linkButtonOutline: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  linkButtonOutlineText: { color: colors.textPrimary, fontWeight: fontWeight.semibold },
  activeJobCard: {
    backgroundColor: colors.primary,
    padding: spacing.xl,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  activeJobHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  activeJobLabel: { color: colors.primaryLight, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  activeJobNumber: { color: colors.surface, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  activeJobDetail: { color: colors.primaryLight, fontSize: fontSize.sm, marginTop: 4 },
  activeJobStatus: { color: colors.surface, fontSize: fontSize.sm, marginTop: spacing.sm, fontWeight: fontWeight.semibold },
  noActiveJobCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radius.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  noActiveJobText: { color: colors.textMuted, marginTop: spacing.sm },
  recentJobRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recentJobNumber: { fontWeight: fontWeight.semibold, color: colors.textPrimary },
  badge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
});