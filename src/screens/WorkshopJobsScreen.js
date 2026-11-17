import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/client";
import { showAlert } from "../utils/notify";
import { colors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

const toIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDay = (d) =>
  d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const formatCreated = (value) =>
  new Date(value + "Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function WorkshopJobsScreen({ navigation }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]); // order = stop order

  const [planVisible, setPlanVisible] = useState(false);
  const [tripDate, setTripDate] = useState(startOfToday());
  const [techs, setTechs] = useState([]);
  const [techsLoading, setTechsLoading] = useState(false);
  const [techIds, setTechIds] = useState([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const response = await api.get("/workshop/unscheduled-jobs");
      setJobs(response.data);
      const stillThere = new Set(response.data.map((j) => j.id));
      setSelectedIds((prev) => prev.filter((id) => stillThere.has(id)));
    } catch (error) {
      console.log("Failed to load workshop jobs:", error.message);
      showAlert("Could not load jobs", "Please check your connection and pull down to try again.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadJobs();
    }, [])
  );

  const toggleJob = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const jobById = useMemo(() => {
    const map = {};
    jobs.forEach((j) => (map[j.id] = j));
    return map;
  }, [jobs]);

  // Centre of the jobs picked so far, used to show how far the other jobs are
  const centroid = useMemo(() => {
    const picked = selectedIds.map((id) => jobById[id]).filter((j) => j && j.latitude != null);
    if (picked.length === 0) return null;
    return {
      lat: picked.reduce((s, j) => s + j.latitude, 0) / picked.length,
      lon: picked.reduce((s, j) => s + j.longitude, 0) / picked.length,
    };
  }, [selectedIds, jobById]);

  const rows = useMemo(() => {
    const withDist = jobs.map((job) => ({
      job,
      distance:
        centroid && job.latitude != null
          ? haversineKm(centroid.lat, centroid.lon, job.latitude, job.longitude)
          : null,
    }));
    if (!centroid) return withDist;
    const selected = selectedIds.map((id) => withDist.find((r) => r.job.id === id)).filter(Boolean);
    const others = withDist
      .filter((r) => !selectedIds.includes(r.job.id))
      .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
    return [...selected, ...others];
  }, [jobs, centroid, selectedIds]);

  // ---------- Plan trip ----------
  const loadTechs = async (date) => {
    setTechsLoading(true);
    try {
      const response = await api.get("/workshop/technicians", { params: { trip_date: toIso(date) } });
      setTechs(response.data);
    } catch (error) {
      console.log("Failed to load technicians:", error.message);
      setTechs([]);
    } finally {
      setTechsLoading(false);
    }
  };

  const openPlan = () => {
    const today = startOfToday();
    setTripDate(today);
    setTechIds([]);
    setNotes("");
    setPlanVisible(true);
    loadTechs(today);
  };

  const changeDay = (delta) => {
    const next = new Date(tripDate);
    next.setDate(next.getDate() + delta);
    if (next < startOfToday()) return;
    setTripDate(next);
    setTechIds([]);
    loadTechs(next);
  };

  const toggleTech = (tech) => {
    if (tech.busy) return;
    setTechIds((prev) => (prev.includes(tech.id) ? prev.filter((x) => x !== tech.id) : [...prev, tech.id]));
  };

  const moveStop = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[target]] = [next[target], next[index]];
    setSelectedIds(next);
  };

  const createTrip = async () => {
    if (techIds.length === 0) {
      showAlert("Select technicians", "Please select at least one technician for this trip.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/workshop/trips", {
        trip_date: toIso(tripDate),
        job_ids: selectedIds,
        technician_ids: techIds,
        notes: notes.trim() || null,
      });
      setPlanVisible(false);
      setSelectedIds([]);
      showAlert(
        "Trip created",
        `${selectedIds.length} job(s) scheduled for ${formatDay(tripDate)}. The technicians have been notified.`
      );
      loadJobs();
    } catch (error) {
      const detail = error.response?.data?.detail || "Could not create the trip.";
      showAlert("Could not create trip", typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setSaving(false);
    }
  };

  if (loading && jobs.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const canGoBack = tripDate > startOfToday();

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.job.id.toString()}
        onRefresh={loadJobs}
        refreshing={loading}
        contentContainerStyle={{ paddingBottom: 110 }}
        ListHeaderComponent={
          jobs.length > 0 ? (
            <Text style={styles.hint}>
              Tap jobs to select them. After you pick one, the others are sorted by distance so you can
              combine jobs on the same route.
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const { job, distance } = item;
          const selected = selectedIds.includes(job.id);
          const order = selectedIds.indexOf(job.id) + 1;
          return (
            <TouchableOpacity
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => toggleJob(job.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <Ionicons
                  name={selected ? "checkbox" : "square-outline"}
                  size={24}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text style={styles.jobNumber}>{job.job_number}</Text>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{job.request_type}</Text>
                </View>
                <View style={[styles.pill, styles.pillAlt]}>
                  <Text style={[styles.pillText, { color: colors.textSecondary }]}>{job.service_type}</Text>
                </View>
                {selected && (
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderBadgeText}>{order}</Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => navigation.navigate("JobDetail", { jobId: job.id })}
                  style={{ marginLeft: "auto" }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.customer}>{job.customer_name}</Text>
              {job.customer_address ? (
                <Text style={styles.address} numberOfLines={2}>
                  {job.customer_address}
                </Text>
              ) : null}
              {job.remarks ? (
                <Text style={styles.remarks} numberOfLines={2}>
                  {job.remarks}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                <Text style={styles.meta}>Created {formatCreated(job.created_at)}</Text>
                {!selected && distance !== null && (
                  <Text style={styles.distance}>≈ {distance < 10 ? distance.toFixed(1) : Math.round(distance)} km from your selection</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.textMuted} />
            <Text style={styles.empty}>No workshop jobs are waiting to be scheduled.</Text>
            <Text style={styles.emptySub}>New workshop jobs created by sales executives will appear here.</Text>
          </View>
        }
      />

      {selectedIds.length > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={() => setSelectedIds([])}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.planButton} onPress={openPlan} activeOpacity={0.85}>
            <Ionicons name="car-outline" size={18} color={colors.surface} />
            <Text style={styles.planButtonText}>Plan Trip ({selectedIds.length})</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={planVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>Plan Trip</Text>
            <ScrollView>
              <Text style={styles.sectionLabel}>Date</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity onPress={() => changeDay(-1)} disabled={!canGoBack} style={styles.dateArrow}>
                  <Ionicons name="chevron-back" size={22} color={canGoBack ? colors.primary : colors.border} />
                </TouchableOpacity>
                <Text style={styles.dateText}>{formatDay(tripDate)}</Text>
                <TouchableOpacity onPress={() => changeDay(1)} style={styles.dateArrow}>
                  <Ionicons name="chevron-forward" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionLabel}>Stops (in visiting order)</Text>
              {selectedIds.map((id, index) => {
                const job = jobById[id];
                if (!job) return null;
                return (
                  <View key={id} style={styles.stopRow}>
                    <View style={styles.orderBadge}>
                      <Text style={styles.orderBadgeText}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stopTitle}>
                        {job.job_number} · {job.customer_name}
                      </Text>
                      {job.customer_address ? (
                        <Text style={styles.stopSub} numberOfLines={1}>
                          {job.customer_address}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity onPress={() => moveStop(index, -1)} style={styles.moveBtn}>
                      <Ionicons name="arrow-up" size={18} color={index === 0 ? colors.border : colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveStop(index, 1)} style={styles.moveBtn}>
                      <Ionicons
                        name="arrow-down"
                        size={18}
                        color={index === selectedIds.length - 1 ? colors.border : colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}

              <Text style={styles.sectionLabel}>Technicians</Text>
              {techsLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
              ) : techs.length === 0 ? (
                <Text style={styles.stopSub}>No technicians found.</Text>
              ) : (
                techs.map((tech) => {
                  const chosen = techIds.includes(tech.id);
                  return (
                    <TouchableOpacity
                      key={tech.id}
                      style={[styles.techRow, tech.busy && { opacity: 0.5 }]}
                      onPress={() => toggleTech(tech)}
                      activeOpacity={tech.busy ? 1 : 0.7}
                    >
                      <Ionicons
                        name={chosen ? "checkbox" : "square-outline"}
                        size={22}
                        color={chosen ? colors.primary : colors.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stopTitle}>{tech.name}</Text>
                        <Text style={styles.stopSub}>
                          {tech.busy ? tech.busy_reason : tech.regional_center_name || "Available"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              <Text style={styles.sectionLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Route plan, tools to take, special instructions..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                maxLength={500}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setPlanVisible(false)} disabled={saving}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, saving && { opacity: 0.6 }]}
                onPress={createTrip}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Text style={styles.modalConfirmText}>Create Trip</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  hint: { color: colors.textMuted, fontSize: fontSize.xs, margin: spacing.lg, marginBottom: 0 },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "transparent",
    ...shadow.card,
  },
  cardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  jobNumber: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  pill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pillAlt: { backgroundColor: colors.neutralLight },
  pillText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.primaryDark, textTransform: "capitalize" },
  orderBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  orderBadgeText: { color: colors.surface, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  customer: { marginTop: spacing.sm, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  address: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  remarks: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, fontStyle: "italic" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  meta: { color: colors.textMuted, fontSize: fontSize.xs },
  distance: { color: colors.primaryDark, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  emptyBox: { alignItems: "center", marginTop: 60, paddingHorizontal: spacing.xxl },
  empty: { textAlign: "center", marginTop: spacing.md, color: colors.textSecondary, fontSize: fontSize.base },
  emptySub: { textAlign: "center", marginTop: spacing.xs, color: colors.textMuted, fontSize: fontSize.sm },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  clearText: { color: colors.textSecondary, fontWeight: fontWeight.semibold, padding: spacing.sm },
  planButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  planButtonText: { color: colors.surface, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: "90%",
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  dateArrow: { padding: spacing.sm },
  dateText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stopTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  stopSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  moveBtn: { padding: 6 },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 70,
    color: colors.textPrimary,
    textAlignVertical: "top",
  },
  modalButtons: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  modalCancel: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  modalCancelText: { color: colors.textSecondary, fontWeight: fontWeight.bold },
  modalConfirm: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  modalConfirmText: { color: colors.surface, fontWeight: fontWeight.bold },
});
