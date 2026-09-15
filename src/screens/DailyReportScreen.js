import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import api from "../api/client";
import { colors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

function formatDate(d) {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function formatDisplayDate(d) {
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function isSameDay(a, b) {
  return formatDate(a) === formatDate(b);
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function DailyReportScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadReport = async (d) => {
    setLoading(true);
    try {
      const response = await api.get("/reports/daily-technicians", {
        params: { report_date: formatDate(d) },
      });
      setReport(response.data);
    } catch (error) {
      console.log("Failed to load daily report:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadReport(selectedDate);
    }, [selectedDate])
  );

  const changeDay = (delta) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + delta);
    setSelectedDate(newDate);
  };

  const handleExport = async () => {
    setExporting(true);
    const filename = `daily_technician_report_${formatDate(selectedDate)}.xlsx`;

    try {
      if (Platform.OS === "web") {
        // Browser (laptop): fetch as a blob and trigger a normal browser download
        const response = await api.get("/reports/daily-technicians/export", {
          params: { report_date: formatDate(selectedDate) },
          responseType: "blob",
        });

        const blob = new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Phone: save locally, then open the native share sheet
        const response = await api.get("/reports/daily-technicians/export", {
          params: { report_date: formatDate(selectedDate) },
          responseType: "arraybuffer",
        });

        const base64Data = arrayBufferToBase64(response.data);
        const fileUri = FileSystem.documentDirectory + filename;

        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dialogTitle: "Share Daily Technician Report",
          });
        } else {
          Alert.alert("Saved", `File saved to: ${fileUri}`);
        }
      }
    } catch (error) {
      console.log("Export failed:", error.message);
      Alert.alert("Export failed", "Could not generate the Excel file. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const totalJobs = report.reduce((sum, e) => sum + e.jobs_closed, 0);
  const totalHours = report.reduce((sum, e) => sum + e.total_hours, 0);
  const totalKm = report.reduce((sum, e) => sum + e.total_km, 0);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={() => changeDay(-1)}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
          {isSameDay(selectedDate, new Date()) && <Text style={styles.todayTag}>Today</Text>}
        </View>
        <TouchableOpacity onPress={() => changeDay(1)}>
          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.exportButton}
        onPress={handleExport}
        disabled={exporting}
        activeOpacity={0.85}
      >
        <Ionicons name="download-outline" size={18} color={colors.surface} />
        <Text style={styles.exportButtonText}>
          {exporting ? "Generating..." : "Export to Excel"}
        </Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNumber}>{totalJobs}</Text>
              <Text style={styles.summaryLabel}>Jobs Closed</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNumber}>{totalHours.toFixed(1)}h</Text>
              <Text style={styles.summaryLabel}>Total Time</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNumber}>{totalKm.toFixed(1)}</Text>
              <Text style={styles.summaryLabel}>Total km</Text>
            </View>
          </View>

          {report.length === 0 ? (
            <Text style={styles.emptyText}>No jobs were closed on this day.</Text>
          ) : (
            report.map((entry, index) => (
              <View key={index} style={styles.techCard}>
                <View style={styles.techHeader}>
                  <View style={styles.techNameRow}>
                    <Ionicons name="person-circle" size={22} color={colors.primary} />
                    <Text style={styles.techName}>{entry.technician_name}</Text>
                  </View>
                  {entry.regional_center && (
                    <View style={styles.regionBadge}>
                      <Text style={styles.regionBadgeText}>{entry.regional_center}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Ionicons name="checkmark-done-outline" size={16} color={colors.success} />
                    <Text style={styles.statText}>{entry.jobs_closed} jobs</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={styles.statText}>{entry.total_hours}h</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="navigate-outline" size={16} color={colors.accentTeal} />
                    <Text style={styles.statText}>{entry.total_km} km</Text>
                  </View>
                </View>

                <View style={styles.jobNumbersRow}>
                  {entry.job_numbers.map((jn, i) => (
                    <View key={i} style={styles.jobTag}>
                      <Text style={styles.jobTagText}>{jn}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  dateText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  todayTag: { color: colors.primary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginTop: 2 },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.accentTeal,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  exportButtonText: { color: colors.surface, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    ...shadow.card,
  },
  summaryNumber: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  emptyText: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  techCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  techHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  techNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  techName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  regionBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  regionBadgeText: { color: colors.primaryDark, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  statsRow: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.sm },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  jobNumbersRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.xs },
  jobTag: {
    backgroundColor: colors.neutralLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  jobTagText: { color: colors.textSecondary, fontSize: fontSize.xs },
});