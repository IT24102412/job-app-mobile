import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { WebView } from "react-native-webview";
import api from "../api/client";
import { getCurrentUserRole, getCurrentUserId } from "../api/auth";
import { colors, statusColors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

const TECH_COLORS = ["#2563eb", "#7c3aed", "#059669", "#ea580c", "#db2777", "#0891b2"];

function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
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

export default function JobDetailScreen({ route, navigation }) {
  const { jobId } = route.params;
  const [job, setJob] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [locations, setLocations] = useState([]);
  const [role, setRole] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [availableTechs, setAvailableTechs] = useState([]);
  const [selectedTechIds, setSelectedTechIds] = useState([]);
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [now, setNow] = useState(Date.now());
  const [jobSummary, setJobSummary] = useState(null);
  const [assignedTechs, setAssignedTechs] = useState([]);
  const [downloadingAttachment, setDownloadingAttachment] = useState(false);
  const trackingInterval = useRef(null);
  const locationsRefreshInterval = useRef(null);
  const clockInterval = useRef(null);

  const loadJob = async () => {
    setLoading(true);
    try {
      const response = await api.get("/jobs/");
      const found = response.data.find((j) => j.id === jobId);
      setJob(found);
      if (found?.customer_id) {
        try {
          const custResponse = await api.get(`/customers/${found.customer_id}`);
          setCustomer(custResponse.data);
        } catch (error) {
          console.log("Failed to load customer:", error.message);
        }
      }
      if (found && found.status !== "created" && found.status !== "cancelled") {
        try {
          const techsResponse = await api.get(`/jobs/${jobId}/assigned-technicians`);
          setAssignedTechs(techsResponse.data);
        } catch (error) {
          console.log("Failed to load assigned technicians:", error.message);
        }
      }
      if (found?.status === "closed") {
        try {
          const summaryResponse = await api.get(`/jobs/${jobId}/summary`);
          setJobSummary(summaryResponse.data);
        } catch (error) {
          console.log("Failed to load job summary:", error.message);
        }
      }
    } catch (error) {
      console.log("Failed to load job:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const response = await api.get(`/jobs/${jobId}/locations`);
      setLocations(response.data);
    } catch (error) {
      console.log("Failed to load locations:", error.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadJob();
      loadLocations();
      getCurrentUserRole().then(setRole);
      getCurrentUserId().then(setCurrentUserId);
    }, [jobId])
  );

  const myAssignment = assignedTechs.find((t) => t.user_id === currentUserId) || null;
  const iHaveStarted = !!myAssignment?.started_at;

  useEffect(() => {
    if (role === "technician" && iHaveStarted && job?.status !== "closed" && job?.status !== "cancelled") {
      startTracking();
      locationsRefreshInterval.current = setInterval(loadLocations, 20000);
    } else {
      stopTracking();
      if (locationsRefreshInterval.current) {
        clearInterval(locationsRefreshInterval.current);
        locationsRefreshInterval.current = null;
      }
    }
    return () => {
      stopTracking();
      if (locationsRefreshInterval.current) {
        clearInterval(locationsRefreshInterval.current);
        locationsRefreshInterval.current = null;
      }
    };
  }, [role, iHaveStarted, job?.status]);

  useEffect(() => {
    const anyoneStarted = assignedTechs.some((t) => t.started_at) && job?.status !== "closed";
    if (clockInterval.current) {
      clearInterval(clockInterval.current);
      clockInterval.current = null;
    }
    if (anyoneStarted) {
      clockInterval.current = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => {
      if (clockInterval.current) {
        clearInterval(clockInterval.current);
        clockInterval.current = null;
      }
    };
  }, [assignedTechs, job?.status]);

  const startTracking = async () => {
    if (trackingInterval.current) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Location permission is required to track this job.");
      return;
    }

    setTracking(true);
    sendLocationPing();
    trackingInterval.current = setInterval(sendLocationPing, 20000);
  };

  const stopTracking = () => {
    if (trackingInterval.current) {
      clearInterval(trackingInterval.current);
      trackingInterval.current = null;
    }
    setTracking(false);
  };

  const sendLocationPing = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({});
      await api.post(`/jobs/${jobId}/location`, {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      loadLocations();
    } catch (error) {
      console.log("Location ping failed:", error.message);
    }
  };

  const openTechnicianPicker = async () => {
    setSelectedTechIds([]);
    setLoadingTechs(true);
    setPickerVisible(true);
    try {
      const response = await api.get("/technicians/available");
      setAvailableTechs(response.data);
    } catch (error) {
      console.log("Failed to load technicians:", error.message);
    } finally {
      setLoadingTechs(false);
    }
  };

  const toggleTechSelection = (id) => {
    setSelectedTechIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleAssignSelected = async () => {
    if (selectedTechIds.length === 0) {
      Alert.alert("No one selected", "Please select at least one technician.");
      return;
    }
    setPickerVisible(false);
    setActionLoading(true);
    let failed = [];
    for (const techId of selectedTechIds) {
      try {
        await api.post(`/assignments/jobs/${jobId}/assign-technician/${techId}`);
      } catch (error) {
        const tech = availableTechs.find((t) => t.id === techId);
        failed.push(tech ? tech.name : techId);
      }
    }
    setActionLoading(false);
    if (failed.length > 0) {
      Alert.alert("Some assignments failed", `Could not assign: ${failed.join(", ")}`);
    } else {
      Alert.alert("Assigned", "Technician(s) assigned to this job.");
    }
    loadJob();
  };

  const handleStartJob = async () => {
    setActionLoading(true);
    try {
      await api.post(`/jobs/${jobId}/start`);
      Alert.alert("Job started", "You can now begin working on this job.");
      loadJob();
    } catch (error) {
      const detail = error.response?.data?.detail || "Something went wrong.";
      Alert.alert("Could not start job", detail);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadJobsheet = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;
    const file = result.assets[0];

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: "application/pdf",
      });

      await api.post(`/jobs/${jobId}/upload-jobsheet`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert("Success", "Job sheet uploaded. Job is now closed.");
      loadJob();
    } catch (error) {
      const detail = error.response?.data?.detail || "Upload failed.";
      Alert.alert("Could not upload", detail);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelJob = () => {
    Alert.alert(
      "Cancel this job?",
      "This cannot be undone. The assigned technician (if any) will be freed up.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, cancel job",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.post(`/jobs/${jobId}/cancel`);
              Alert.alert("Job cancelled");
              loadJob();
            } catch (error) {
              const detail = error.response?.data?.detail || "Could not cancel this job.";
              Alert.alert("Cancel failed", detail);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAdminClose = async () => {
    if (closeReason.trim().length < 5) {
      Alert.alert("Reason required", "Please enter a reason of at least 5 characters.");
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/jobs/${jobId}/admin-close`, { reason: closeReason.trim() });
      setCloseModalVisible(false);
      setCloseReason("");
      Alert.alert("Job closed", "The job has been closed without a job sheet.");
      loadJob();
    } catch (error) {
      const detail = error.response?.data?.detail || "Could not close this job.";
      Alert.alert("Close failed", detail);
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewAttachment = async () => {
    setDownloadingAttachment(true);
    try {
      if (Platform.OS === "web") {
        const response = await api.get(`/jobs/${jobId}/attachment`, { responseType: "blob" });
        const contentType = response.headers["content-type"] || "application/octet-stream";
        const extension = contentType.includes("pdf") ? "pdf" : contentType.includes("png") ? "png" : "jpg";
        const filename = `sr_attachment_${job.job_number}.${extension}`;
        const blob = new Blob([response.data], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const response = await api.get(`/jobs/${jobId}/attachment`, { responseType: "arraybuffer" });
        const contentType = response.headers["content-type"] || "application/octet-stream";
        const extension = contentType.includes("pdf") ? "pdf" : contentType.includes("png") ? "png" : "jpg";
        const filename = `sr_attachment_${job.job_number}.${extension}`;
        const base64Data = arrayBufferToBase64(response.data);
        const fileUri = FileSystem.documentDirectory + filename;

        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, { mimeType: contentType, dialogTitle: "SR Attachment" });
        } else {
          Alert.alert("Saved", `File saved to: ${fileUri}`);
        }
      }
    } catch (error) {
      console.log("Failed to load attachment:", error.message);
      Alert.alert("Error", "Could not load the attachment.");
    } finally {
      setDownloadingAttachment(false);
    }
  };

  if (loading || !job) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const canManage = role === "admin";
  const canCancel = canManage && (job.status === "created" || job.status === "assigned");
  const canForceClose = canManage && (job.status === "assigned" || job.status === "started");

  const myPersonalStatus =
    role === "technician" && myAssignment
      ? myAssignment.started_at
        ? "started"
        : "assigned"
      : job.status;
  const statusStyle = statusColors[myPersonalStatus] || statusColors.created;

  const myElapsedSeconds =
    role === "technician" && myAssignment?.started_at
      ? Math.max(0, Math.floor((now - new Date(myAssignment.started_at + "Z").getTime()) / 1000))
      : 0;

  const canIStart =
    role === "technician" &&
    myAssignment &&
    !myAssignment.started_at &&
    (job.status === "assigned" || job.status === "started");

  const canIUpload = role === "technician" && myAssignment && job.status === "started";

  const techIdToColor = {};
  assignedTechs.forEach((t, i) => {
    techIdToColor[t.id] = TECH_COLORS[i % TECH_COLORS.length];
  });
  const locationsByTech = {};
  locations.forEach((l) => {
    if (!locationsByTech[l.technician_id]) locationsByTech[l.technician_id] = [];
    locationsByTech[l.technician_id].push(l);
  });
  const mostRecentLocation = locations[locations.length - 1];

  const mapHtml =
    locations.length > 0 || customer
      ? `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          html, body, #map { height: 100%; margin: 0; padding: 0; touch-action: none; }
          #status {
            position: absolute;
            top: 8px;
            left: 8px;
            z-index: 1000;
            background: #ffffff;
            padding: 6px 12px;
            border-radius: 8px;
            font: bold 15px -apple-system, sans-serif;
            color: #111827;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            border: 2px solid #ef4444;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div id="status"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const techGroups = ${JSON.stringify(
            Object.entries(locationsByTech).map(([techId, pings]) => ({
              techId: Number(techId),
              name: (assignedTechs.find((t) => t.id === Number(techId)) || {}).name || "Technician",
              color: techIdToColor[techId] || "#2563eb",
              points: pings.map((p) => [p.latitude, p.longitude]),
            }))
          )};
          const latestOverall = ${
            mostRecentLocation ? JSON.stringify([mostRecentLocation.latitude, mostRecentLocation.longitude]) : "null"
          };
          const customerPoint = ${
            customer ? JSON.stringify([customer.latitude, customer.longitude]) : "null"
          };

          const centerPoint = latestOverall || customerPoint;
          const map = L.map('map', { zoomControl: false, touchZoom: true }).setView(centerPoint, 13);
          L.control.zoom({ position: 'bottomleft' }).addTo(map);

          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 19,
          }).addTo(map);

          techGroups.forEach(function(group) {
            if (group.points.length > 1) {
              L.polyline(group.points, { color: group.color, weight: 4 }).addTo(map);
            }
            const last = group.points[group.points.length - 1];
            if (last) {
              const icon = L.divIcon({
                html: '<div style="background:' + group.color + ';width:16px;height:16px;border-radius:8px;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>',
                className: '',
                iconSize: [16, 16],
              });
              L.marker(last, { icon: icon }).addTo(map).bindPopup(group.name);
            }
          });

          if (customerPoint) {
            const customerIcon = L.divIcon({
              html: '<div style="background:#ef4444;width:16px;height:16px;border-radius:8px;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>',
              className: '',
              iconSize: [16, 16],
            });
            L.marker(customerPoint, { icon: customerIcon }).addTo(map).bindPopup('Customer location');
          }

          const statusEl = document.getElementById('status');

          async function drawRoute() {
            if (!latestOverall || !customerPoint) return;

            statusEl.textContent = 'Loading route...';
            try {
              const url = 'https://router.project-osrm.org/route/v1/driving/'
                + latestOverall[1] + ',' + latestOverall[0] + ';'
                + customerPoint[1] + ',' + customerPoint[0]
                + '?overview=full&geometries=geojson';

              const response = await fetch(url);
              const data = await response.json();

              if (data.code === 'Ok' && data.routes && data.routes[0]) {
                const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                const routeLine = L.polyline(coords, { color: '#ef4444', weight: 5, dashArray: '10, 8' }).addTo(map);
                map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

                const km = (data.routes[0].distance / 1000).toFixed(1);
                const mins = Math.round(data.routes[0].duration / 60);
                statusEl.textContent = km + ' km \u00b7 ~' + mins + ' min';
              } else {
                throw new Error('No route found');
              }
            } catch (error) {
              L.polyline([latestOverall, customerPoint], {
                color: '#ef4444',
                weight: 4,
                dashArray: '8, 6',
              }).addTo(map);
              const bounds = L.latLngBounds([latestOverall, customerPoint]);
              map.fitBounds(bounds, { padding: [40, 40] });
              statusEl.textContent = 'Route unavailable';
            }
          }

          drawRoute();
        </script>
      </body>
    </html>
  `
      : null;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.jobNumber}>{job.job_number}</Text>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>
              {myPersonalStatus.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.label}>Request Type</Text>
          </View>
          <Text style={styles.value}>{job.request_type}</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Ionicons name="briefcase-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.label}>Job Allocation</Text>
          </View>
          <Text style={styles.value}>{job.job_type}</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Ionicons name="construct-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.label}>Service Type</Text>
          </View>
          <Text style={styles.value}>{job.service_type}</Text>
        </View>
        {job.remarks ? (
          <View style={styles.remarksBox}>
            <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.remarksText}>{job.remarks}</Text>
          </View>
        ) : null}
        {job.has_sr_attachment && (
          <TouchableOpacity
            style={styles.attachmentRow}
            onPress={handleViewAttachment}
            disabled={downloadingAttachment}
            activeOpacity={0.7}
          >
            <Ionicons name="document-attach" size={18} color={colors.primary} />
            <Text style={styles.attachmentRowText}>
              {downloadingAttachment ? "Loading..." : "View SR Attachment"}
            </Text>
            <Ionicons name="download-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
        {customer && (
          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.label}>Customer</Text>
            </View>
            <Text style={styles.value}>{customer.name}</Text>
          </View>
        )}
        {assignedTechs.length > 0 && (
          <View style={styles.assignedTechsBox}>
            <View style={styles.rowLabel}>
              <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.label}>
                {assignedTechs.length > 1 ? "Assigned Technicians" : "Assigned Technician"}
              </Text>
            </View>
            <View style={styles.assignedTechsList}>
              {assignedTechs.map((t) => {
                const theirElapsed = t.started_at
                  ? Math.max(0, Math.floor((now - new Date(t.started_at + "Z").getTime()) / 1000))
                  : null;
                return (
                  <View key={t.id} style={styles.assignedTechChip}>
                    <View style={[styles.techColorDot, { backgroundColor: techIdToColor[t.id] }]} />
                    <Text style={styles.assignedTechName}>{t.name}</Text>
                    {t.regional_center_name && (
                      <Text style={styles.assignedTechRegion}>· {t.regional_center_name}</Text>
                    )}
                    {canManage && (
                      <Text style={styles.assignedTechTimer}>
                        {theirElapsed !== null ? `· ${formatElapsed(theirElapsed)}` : "· Not started yet"}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.label}>Created</Text>
          </View>
          <Text style={styles.value}>
            {new Date(job.created_at + "Z").toLocaleString()}
          </Text>
        </View>
        {job.closed_by_admin && job.closed_reason && (
          <View style={styles.adminCloseNote}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.dangerDark} />
            <Text style={styles.adminCloseNoteText}>
              Force-closed by admin: {job.closed_reason}
            </Text>
          </View>
        )}
      </View>

      {role === "technician" && iHaveStarted && (
        <View style={styles.stopwatchBox}>
          <Ionicons name="stopwatch-outline" size={22} color={colors.surface} />
          <Text style={styles.stopwatchText}>{formatElapsed(myElapsedSeconds)}</Text>
          <Text style={styles.stopwatchLabel}>your elapsed time</Text>
        </View>
      )}

      {job.status === "closed" && jobSummary && (
        <View style={styles.summaryCard}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="analytics-outline" size={18} color={colors.accentTeal} />
            <Text style={styles.summaryTitle}>Job Summary</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={styles.summaryValue}>
                {jobSummary.duration_hours !== null ? `${jobSummary.duration_hours}h` : "N/A"}
              </Text>
              <Text style={styles.summaryLabel}>Total Time</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Ionicons name="navigate-outline" size={20} color={colors.accentTeal} />
              <Text style={styles.summaryValue}>
                {jobSummary.total_distance_km !== null ? `${jobSummary.total_distance_km} km` : "N/A"}
              </Text>
              <Text style={styles.summaryLabel}>Distance Traveled</Text>
            </View>
          </View>
        </View>
      )}

      {tracking && (
        <View style={styles.trackingBox}>
          <Ionicons name="location" size={16} color={colors.warningDark} />
          <Text style={styles.trackingText}>Location tracking active</Text>
        </View>
      )}

      {mapHtml && (
        <View style={styles.mapContainer}>
          {Platform.OS === "web" ? (
            <iframe
              srcDoc={mapHtml}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            <WebView
              originWhitelist={["*"]}
              source={{ html: mapHtml }}
              style={styles.map}
            />
          )}
        </View>
      )}

      {canManage && (job.status === "created" || job.status === "assigned") && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={openTechnicianPicker}
          disabled={actionLoading}
          activeOpacity={0.85}
        >
          <Ionicons name="people-outline" size={18} color={colors.surface} />
          <Text style={styles.actionButtonText}>
            {actionLoading
              ? "Assigning..."
              : job.status === "assigned"
              ? "Add Another Technician"
              : "Assign Technician(s)"}
          </Text>
        </TouchableOpacity>
      )}

      {job.status === "created" && !canManage && (
        <View style={styles.waitingBox}>
          <Ionicons name="hourglass-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.waitingText}>Waiting to be assigned to a technician.</Text>
        </View>
      )}

      {canIStart && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleStartJob}
          disabled={actionLoading}
          activeOpacity={0.85}
        >
          <Ionicons name="play-outline" size={18} color={colors.surface} />
          <Text style={styles.actionButtonText}>
            {actionLoading ? "Starting..." : "Start Job"}
          </Text>
        </TouchableOpacity>
      )}

      {canIUpload && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleUploadJobsheet}
          disabled={actionLoading}
          activeOpacity={0.85}
        >
          <Ionicons name="document-attach-outline" size={18} color={colors.surface} />
          <Text style={styles.actionButtonText}>
            {actionLoading ? "Uploading..." : "Upload Job Sheet (PDF)"}
          </Text>
        </TouchableOpacity>
      )}

      {job.status === "closed" && (
        <View style={styles.closedBox}>
          <Ionicons name="checkmark-circle" size={18} color={colors.successDark} />
          <Text style={styles.closedText}>This job is closed.</Text>
        </View>
      )}

      {job.status === "cancelled" && (
        <View style={styles.cancelledBox}>
          <Ionicons name="close-circle" size={18} color={colors.dangerDark} />
          <Text style={styles.cancelledText}>This job was cancelled.</Text>
        </View>
      )}

      {canForceClose && (
        <TouchableOpacity
          style={styles.forceCloseButton}
          onPress={() => setCloseModalVisible(true)}
          disabled={actionLoading}
          activeOpacity={0.85}
        >
          <Ionicons name="lock-closed-outline" size={16} color={colors.warningDark} />
          <Text style={styles.forceCloseButtonText}>Close Without Job Sheet</Text>
        </TouchableOpacity>
      )}

      {canCancel && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancelJob}
          disabled={actionLoading}
          activeOpacity={0.85}
        >
          <Text style={styles.cancelButtonText}>Cancel Job</Text>
        </TouchableOpacity>
      )}

      <Modal visible={pickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Technician(s)</Text>
            <Text style={styles.modalSubtitle}>
              Tap to select one or more — technicians from any region can be added.
            </Text>
            {loadingTechs ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={availableTechs}
                keyExtractor={(item) => item.id.toString()}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No available technicians right now.</Text>
                }
                renderItem={({ item }) => {
                  const selected = selectedTechIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.techRow, selected && styles.techRowSelected]}
                      onPress={() => toggleTechSelection(item.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={22}
                        color={selected ? colors.primary : colors.textMuted}
                      />
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <Text style={styles.techName}>{item.name}</Text>
                        {item.regional_center_name && (
                          <Text style={styles.techDetail}>{item.regional_center_name}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity
              style={[styles.confirmCloseButton, selectedTechIds.length === 0 && styles.buttonDisabled]}
              onPress={handleAssignSelected}
              disabled={selectedTechIds.length === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmCloseButtonText}>
                Assign Selected ({selectedTechIds.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setPickerVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={closeModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Close Without Job Sheet</Text>
            <Text style={styles.modalSubtitle}>
              This closes the job directly without requiring the technician to upload a PDF.
              Please explain why.
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. Customer cancelled on-site, duplicate job, technician unreachable..."
              placeholderTextColor={colors.textMuted}
              value={closeReason}
              onChangeText={setCloseReason}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              style={styles.confirmCloseButton}
              onPress={handleAdminClose}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmCloseButtonText}>
                {actionLoading ? "Closing..." : "Confirm Close"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setCloseModalVisible(false);
                setCloseReason("");
              }}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: colors.surface,
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  jobNumber: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  rowLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { color: colors.textSecondary, fontSize: fontSize.base },
  value: { fontWeight: fontWeight.semibold, color: colors.textPrimary, fontSize: fontSize.base },
  remarksBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: colors.neutralLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginVertical: spacing.sm,
  },
  remarksText: { color: colors.textPrimary, fontSize: fontSize.sm, flex: 1 },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginVertical: spacing.sm,
  },
  attachmentRowText: { color: colors.primaryDark, fontWeight: fontWeight.bold, fontSize: fontSize.sm, flex: 1 },
  assignedTechsBox: {
    paddingVertical: spacing.sm,
  },
  assignedTechsList: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  assignedTechChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    alignSelf: "flex-start",
    flexWrap: "wrap",
  },
  techColorDot: { width: 10, height: 10, borderRadius: 5 },
  assignedTechName: { color: colors.primaryDark, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  assignedTechRegion: { color: colors.primaryDark, fontSize: fontSize.xs },
  assignedTechTimer: { color: colors.primaryDark, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  adminCloseNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: colors.dangerLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  adminCloseNoteText: { color: colors.dangerDark, fontSize: fontSize.sm, flex: 1 },
  stopwatchBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  stopwatchText: { color: colors.surface, fontSize: fontSize.xl, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
  stopwatchLabel: { color: colors.primaryLight, fontSize: fontSize.sm },
  summaryCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  summaryTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryStat: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, height: 50, backgroundColor: colors.border },
  summaryValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary, marginTop: 4 },
  summaryLabel: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  trackingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  trackingText: { color: colors.warningDark, fontWeight: fontWeight.semibold },
  mapContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    height: 280,
    ...shadow.card,
  },
  map: { flex: 1 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  actionButtonText: { color: colors.surface, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  waitingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center",
    backgroundColor: colors.neutralLight,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  waitingText: { color: colors.textSecondary },
  closedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center",
    backgroundColor: colors.successLight,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  closedText: { color: colors.successDark, fontWeight: fontWeight.semibold },
  cancelledBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center",
    backgroundColor: colors.dangerLight,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  cancelledText: { color: colors.dangerDark, fontWeight: fontWeight.semibold },
  forceCloseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warningLight,
  },
  forceCloseButtonText: { color: colors.warningDark, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  cancelButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xxxl,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  cancelButtonText: { color: colors.danger, fontWeight: fontWeight.bold },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.sm, color: colors.textPrimary },
  modalSubtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: spacing.md },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    textAlignVertical: "top",
    minHeight: 90,
    marginBottom: spacing.md,
  },
  confirmCloseButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  confirmCloseButtonText: { color: colors.surface, fontWeight: fontWeight.bold },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  techRowSelected: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },
  techName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  techDetail: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  emptyText: { textAlign: "center", color: colors.textMuted, marginVertical: 20 },
  modalCloseButton: { marginTop: spacing.sm, padding: spacing.md, alignItems: "center" },
  modalCloseText: { color: colors.danger, fontWeight: fontWeight.semibold },
});