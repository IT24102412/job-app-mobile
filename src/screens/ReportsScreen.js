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
import { colors, statusColors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ReportsScreen({ navigation }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [centerNameToId, setCenterNameToId] = useState({});

  const loadReport = async (y, m) => {
    setLoading(true);
    try {
      const response = await api.get("/reports/monthly", { params: { year: y, month: m } });
      setReport(response.data);
    } catch (error) {
      console.log("Failed to load report:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCenters = async () => {
    try {
      const response = await api.get("/regional-centers/");
      const map = {};
      response.data.forEach((c) => {
        map[c.name] = c.id;
      });
      setCenterNameToId(map);
    } catch (error) {
      console.log("Failed to load regional centers:", error.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadReport(year, month);
      loadCenters();
    }, [year, month])
  );

  const changeMonth = (delta) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    setMonth(newMonth);
    setYear(newYear);
  };

  const openFiltered = (title, extraParams) => {
    navigation.navigate("FilteredJobs", {
      title,
      params: { year, month, ...extraParams },
    });
  };

  const BarBreakdown = ({ title, icon, data, getFilterParams, colorMap }) => {
    const entries = Object.entries(data);
    const max = Math.max(...entries.map(([, v]) => v), 1);

    return (
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name={icon} size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {entries.length === 0 ? (
          <Text style={styles.emptyText}>No data</Text>
        ) : (
          entries.map(([key, value]) => {
            const barColor = colorMap ? colorMap[key]?.text || colors.primary : colors.primary;
            return (
              <TouchableOpacity
                key={key}
                style={styles.barRow}
                onPress={() => openFiltered(`${title}: ${key}`, getFilterParams(key))}
                activeOpacity={0.6}
              >
                <View style={styles.barLabelRow}>
                  <Text style={styles.barLabel}>{key}</Text>
                  <Text style={styles.barValue}>{value}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${(value / max) * 100}%`, backgroundColor: barColor },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => changeMonth(-1)}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthText}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <TouchableOpacity onPress={() => changeMonth(1)}>
          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : report ? (
        <>
          <View style={styles.summaryRow}>
            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => openFiltered("All Jobs This Month", {})}
              activeOpacity={0.7}
            >
              <Text style={styles.summaryNumber}>{report.total_jobs}</Text>
              <Text style={styles.summaryLabel}>Total Jobs</Text>
              <Text style={styles.tapHint}>Tap to view</Text>
            </TouchableOpacity>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryNumber}>
                {report.average_hours_to_close !== null ? `${report.average_hours_to_close}h` : "—"}
              </Text>
              <Text style={styles.summaryLabel}>Avg. Time to Close</Text>
            </View>
          </View>

          <BarBreakdown
            title="By Status"
            icon="flag-outline"
            data={report.by_status}
            getFilterParams={(key) => ({ status: key })}
            colorMap={statusColors}
          />
          <BarBreakdown
            title="By Service Type"
            icon="construct-outline"
            data={report.by_service_type}
            getFilterParams={(key) => ({ service_type: key })}
          />
          <BarBreakdown
            title="By Regional Center"
            icon="location-outline"
            data={report.by_regional_center}
            getFilterParams={(key) => ({ regional_center_id: centerNameToId[key] })}
          />

          <Text style={styles.hint}>Tap any bar to see the jobs behind that number.</Text>
        </>
      ) : (
        <Text style={styles.emptyText}>No report data.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  monthText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  summaryRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadow.card,
  },
  summaryNumber: { fontSize: 32, fontWeight: fontWeight.bold, color: colors.primary },
  summaryLabel: { color: colors.textSecondary, marginTop: spacing.xs, fontSize: fontSize.sm, textAlign: "center" },
  tapHint: { color: colors.primary, fontSize: fontSize.xs, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  barRow: { marginBottom: spacing.md },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  barLabel: { color: colors.textSecondary, textTransform: "capitalize", fontSize: fontSize.sm },
  barValue: { fontWeight: fontWeight.bold, color: colors.textPrimary, fontSize: fontSize.sm },
  barTrack: {
    height: 10,
    backgroundColor: colors.neutralLight,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  emptyText: { textAlign: "center", color: colors.textMuted, marginVertical: 20 },
  hint: { textAlign: "center", color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 30 },
});