import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";
import { showAlert } from "../utils/notify";
import { colors, statusColors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

const toIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const formatDay = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function tripProgress(trip) {
  const total = trip.jobs.length;
  const finished = trip.jobs.filter((j) => j.status === "closed" || j.status === "cancelled").length;
  const started = trip.jobs.some((j) => j.status !== "assigned");
  if (total > 0 && finished === total) return { label: "Completed", color: colors.success, bg: colors.successLight };
  if (started) return { label: "In progress", color: colors.accentTeal, bg: colors.accentTealLight };
  return { label: "Scheduled", color: colors.warning, bg: colors.warningLight };
}

export default function TripsScreen({ navigation, route }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const filter = route?.params?.filter || null; // "open" | "today" | "upcoming" | null

  useEffect(() => {
    const titles = { open: "Open Trips", today: "Trips Today", upcoming: "Upcoming Trips" };
    if (filter && titles[filter]) navigation.setOptions({ title: titles[filter] });
  }, [filter]);

  const loadTrips = async () => {
    setLoading(true);
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - (filter ? 60 : 7));
      const response = await api.get("/workshop/trips", { params: { date_from: toIso(weekAgo) } });
      setTrips(response.data);
    } catch (error) {
      console.log("Failed to load trips:", error.message);
      showAlert("Could not load trips", "Please check your connection and pull down to try again.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [])
  );

  const cancelTrip = (trip) => {
    showAlert(
      "Cancel this trip?",
      "The jobs go back to the waiting list and the technicians are notified.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, cancel trip",
          style: "destructive",
          onPress: async () => {
            setBusyId(trip.id);
            try {
              await api.post(`/workshop/trips/${trip.id}/cancel`);
              showAlert("Trip cancelled", "The jobs are back on the waiting list.");
              loadTrips();
            } catch (error) {
              const detail = error.response?.data?.detail || "Could not cancel this trip.";
              showAlert("Cancel failed", typeof detail === "string" ? detail : JSON.stringify(detail));
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const today = toIso(new Date());
  const isFinished = (t) => tripProgress(t).label === "Completed";
  const upcomingList = trips.filter((t) => t.trip_date > today).sort((a, b) => (a.trip_date < b.trip_date ? -1 : 1));
  const todayList = trips.filter((t) => t.trip_date === today);
  // Planned for a past date but never finished
  const overdueList = trips.filter((t) => t.trip_date < today && !isFinished(t));
  const recentList = trips.filter((t) => t.trip_date < today && isFinished(t));

  let allSections;
  if (filter === "today") allSections = [{ title: "Today", data: todayList }];
  else if (filter === "upcoming") allSections = [{ title: "Upcoming", data: upcomingList }];
  else if (filter === "open")
    allSections = [
      { title: "Overdue (planned earlier, not finished)", data: overdueList },
      { title: "Today", data: todayList.filter((t) => !isFinished(t)) },
      { title: "Upcoming", data: upcomingList },
    ];
  else
    allSections = [
      { title: "Today", data: todayList },
      { title: "Upcoming", data: upcomingList },
      { title: "Overdue (planned earlier, not finished)", data: overdueList },
      { title: "Recent", data: recentList },
    ];
  const sections = allSections.filter((s) => s.data.length > 0);

  if (loading && trips.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        onRefresh={loadTrips}
        refreshing={loading}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item: trip }) => {
          const progress = tripProgress(trip);
          const expanded = expandedId === trip.id;
          const overdue = trip.trip_date < today && progress.label === "Scheduled";
          const canCancel = trip.jobs.length > 0 && trip.jobs.every((j) => j.status === "assigned");
          return (
            <View style={styles.card}>
              <TouchableOpacity onPress={() => setExpandedId(expanded ? null : trip.id)} activeOpacity={0.8}>
                <View style={styles.cardHeader}>
                  <Text style={styles.tripDate}>{formatDay(trip.trip_date)}</Text>
                  <View style={[styles.badge, { backgroundColor: overdue ? colors.dangerLight || colors.warningLight : progress.bg }]}>
                    <Text style={[styles.badgeText, { color: overdue ? colors.danger : progress.color }]}>{(overdue ? "Overdue" : progress.label).toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.summary}>
                  Trip #{trip.id} · {trip.jobs.length} job(s) · {trip.technicians.map((t) => t.name).join(", ") || "no technicians"}
                </Text>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textMuted}
                  style={{ alignSelf: "center", marginTop: 4 }}
                />
              </TouchableOpacity>

              {expanded && (
                <View style={{ marginTop: spacing.sm }}>
                  {trip.notes ? <Text style={styles.notes}>Notes: {trip.notes}</Text> : null}
                  {trip.jobs.map((job) => {
                    const statusStyle = statusColors[job.status] || statusColors.created;
                    return (
                      <TouchableOpacity
                        key={job.job_id}
                        style={styles.jobRow}
                        onPress={() => navigation.navigate("JobDetail", { jobId: job.job_id })}
                      >
                        <View style={styles.stopBadge}>
                          <Text style={styles.stopBadgeText}>{job.stop_order}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.jobTitle}>
                            {job.job_number} · {job.customer_name}
                          </Text>
                          {job.customer_address ? (
                            <Text style={styles.jobSub} numberOfLines={1}>
                              {job.customer_address}
                            </Text>
                          ) : null}
                        </View>
                        <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                          <Text style={[styles.badgeText, { color: statusStyle.text }]}>{job.status.toUpperCase()}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {canCancel && (
                    <TouchableOpacity
                      style={[styles.cancelButton, busyId === trip.id && { opacity: 0.6 }]}
                      onPress={() => cancelTrip(trip)}
                      disabled={busyId === trip.id}
                    >
                      <Text style={styles.cancelButtonText}>
                        {busyId === trip.id ? "Cancelling..." : "Cancel Trip"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="car-outline" size={40} color={colors.textMuted} />
            <Text style={styles.empty}>{filter ? "No trips here." : "No trips yet."}</Text>
            <Text style={styles.emptySub}>Plan a trip from the Workshop Jobs list.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tripDate: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  summary: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.xs },
  badge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  notes: { color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.sm, fontStyle: "italic" },
  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stopBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  stopBadgeText: { color: colors.surface, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  jobTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  jobSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  cancelButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  cancelButtonText: { color: colors.danger, fontWeight: fontWeight.bold },
  emptyBox: { alignItems: "center", marginTop: 60, paddingHorizontal: spacing.xxl },
  empty: { textAlign: "center", marginTop: spacing.md, color: colors.textSecondary, fontSize: fontSize.base },
  emptySub: { textAlign: "center", marginTop: spacing.xs, color: colors.textMuted, fontSize: fontSize.sm },
});
