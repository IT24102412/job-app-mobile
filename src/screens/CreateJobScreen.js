import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import api from "../api/client";
import { getCurrentUserId } from "../api/auth";
import { colors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

const REQUEST_TYPES = ["FOC", "SR"];
const JOB_TYPES = ["workshop", "regional"];
const SERVICE_TYPES = ["breakdown", "service", "inspection"];

export default function CreateJobScreen({ navigation }) {
  const [requestType, setRequestType] = useState("FOC");
  const [jobType, setJobType] = useState("regional");
  const [serviceType, setServiceType] = useState("breakdown");
  const [remarks, setRemarks] = useState("");
  const [customerId, setCustomerId] = useState(null);
  const [regionalCenterId, setRegionalCenterId] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [regionalCenters, setRegionalCenters] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedCenterName, setSuggestedCenterName] = useState(null);
  const [srAttachment, setSrAttachment] = useState(null);

  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  useEffect(() => {
    loadFormData();
  }, []);

  useEffect(() => {
    if (customerId) {
      suggestNearestCenter(customerId);
    }
  }, [customerId]);

  const loadFormData = async () => {
    setLoadingData(true);
    try {
      const [customersRes, centersRes] = await Promise.all([
        api.get("/customers/"),
        api.get("/regional-centers/"),
      ]);
      setCustomers(customersRes.data);
      setRegionalCenters(centersRes.data);
      if (customersRes.data.length > 0) setCustomerId(customersRes.data[0].id);
    } catch (error) {
      console.log("Failed to load form data:", error.message);
    } finally {
      setLoadingData(false);
    }
  };

  const suggestNearestCenter = async (selectedCustomerId) => {
    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer) return;

    setSuggesting(true);
    try {
      const response = await api.get("/location-matching/nearest-center", {
        params: { latitude: customer.latitude, longitude: customer.longitude },
      });
      if (response.data) {
        setRegionalCenterId(response.data.id);
        setSuggestedCenterName(response.data.name);
      }
    } catch (error) {
      console.log("Failed to suggest nearest center:", error.message);
    } finally {
      setSuggesting(false);
    }
  };

  const handlePickAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png"],
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;
    setSrAttachment(result.assets[0]);
  };

  const handleCreate = async () => {
    if (!customerId) {
      Alert.alert("Missing info", "Please select a customer.");
      return;
    }
    if (!regionalCenterId) {
      Alert.alert("Missing info", "Please select a regional center.");
      return;
    }
    if (requestType === "SR" && !srAttachment) {
      Alert.alert(
        "SR Attachment required",
        "Since this is an SR request, please attach the Service Request document before creating the job."
      );
      return;
    }

    const salesExecutiveId = await getCurrentUserId();

    setLoading(true);
    try {
      const response = await api.post("/jobs/", {
        request_type: requestType,
        job_type: jobType,
        service_type: serviceType,
        remarks: remarks.trim() || null,
        customer_id: customerId,
        sales_executive_id: salesExecutiveId,
        regional_center_id: regionalCenterId,
      });

      const newJobId = response.data.id;
      const refNo = response.data.job_number;

      if (srAttachment) {
        try {
          const formData = new FormData();
          formData.append("file", {
            uri: srAttachment.uri,
            name: srAttachment.name,
            type: srAttachment.mimeType || "application/octet-stream",
          });
          await api.post(`/jobs/${newJobId}/upload-attachment`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch (attachError) {
          console.log("Attachment upload failed:", attachError.message);
          Alert.alert(
            "Job created",
            `The job (${refNo}) was created, but the attachment failed to upload. You can try again from the job's detail screen.`
          );
          navigation.goBack();
          return;
        }
      }

      Alert.alert("Success", `Job created with reference number: ${refNo}`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const detail = error.response?.data?.detail || "Could not create job.";
      Alert.alert("Failed", typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  const PillPicker = ({ options, selected, onSelect }) => (
    <View style={styles.pillRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.pill, selected === opt && styles.pillActive]}
          onPress={() => onSelect(opt)}
        >
          <Text style={[styles.pillText, selected === opt && styles.pillTextActive]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const filteredCustomers = customers.filter((c) => {
    const query = customerSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      (c.address && c.address.toLowerCase().includes(query))
    );
  });

  const handleSelectCustomer = (id) => {
    setCustomerId(id);
    setCustomerPickerVisible(false);
    setCustomerSearch("");
  };

  if (loadingData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Request Type</Text>
      <PillPicker options={REQUEST_TYPES} selected={requestType} onSelect={setRequestType} />
      <Text style={styles.refNoHint}>
        REF NO will be generated automatically (e.g. {requestType}-000123) once created.
      </Text>

      <Text style={styles.label}>Job Allocation</Text>
      <PillPicker options={JOB_TYPES} selected={jobType} onSelect={setJobType} />

      <Text style={styles.label}>Service Type</Text>
      <PillPicker options={SERVICE_TYPES} selected={serviceType} onSelect={setServiceType} />

      <Text style={styles.label}>Remarks (optional)</Text>
      <TextInput
        style={styles.remarksInput}
        placeholder="Any extra notes about this job — fault description, special instructions, etc."
        placeholderTextColor={colors.textMuted}
        value={remarks}
        onChangeText={setRemarks}
        multiline
        numberOfLines={3}
        maxLength={500}
      />
      <Text style={styles.charCount}>{remarks.length}/500</Text>

      <Text style={styles.label}>
        SR Attachment {requestType === "SR" ? "(required)" : "(optional)"}
      </Text>
      <TouchableOpacity
        style={[
          styles.attachmentButton,
          requestType === "SR" && !srAttachment && styles.attachmentButtonRequired,
        ]}
        onPress={handlePickAttachment}
        activeOpacity={0.7}
      >
        <Ionicons
          name={srAttachment ? "document-attach" : "attach-outline"}
          size={20}
          color={srAttachment ? colors.success : requestType === "SR" ? colors.danger : colors.textSecondary}
        />
        <Text
          style={[
            styles.attachmentButtonText,
            srAttachment && styles.attachmentButtonTextSelected,
            requestType === "SR" && !srAttachment && styles.attachmentButtonTextRequired,
          ]}
        >
          {srAttachment
            ? srAttachment.name
            : requestType === "SR"
            ? "Attach Service Request document (required)"
            : "Attach Service Request (PDF or image)"}
        </Text>
        {srAttachment && (
          <TouchableOpacity onPress={() => setSrAttachment(null)}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Customer</Text>
      <TouchableOpacity
        style={styles.customerSelector}
        onPress={() => setCustomerPickerVisible(true)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          {selectedCustomer ? (
            <>
              <Text style={styles.customerSelectorName}>{selectedCustomer.name}</Text>
              {selectedCustomer.address && (
                <Text style={styles.customerSelectorAddress}>{selectedCustomer.address}</Text>
              )}
            </>
          ) : (
            <Text style={styles.customerSelectorPlaceholder}>Select a customer</Text>
          )}
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <Text style={styles.label}>Regional Center</Text>
      {suggesting ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
      ) : (
        <>
          {suggestedCenterName && (
            <Text style={styles.suggestion}>
              📍 Suggested: {suggestedCenterName} (nearest to this customer)
            </Text>
          )}
          <View style={styles.pickerBox}>
            <Picker selectedValue={regionalCenterId} onValueChange={setRegionalCenterId}>
              {regionalCenters.map((rc) => (
                <Picker.Item key={rc.id} label={rc.name} value={rc.id} />
              ))}
            </Picker>
          </View>
        </>
      )}

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Creating..." : "Create Job"}</Text>
      </TouchableOpacity>

      <Modal visible={customerPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Customer</Text>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or address..."
                placeholderTextColor={colors.textMuted}
                value={customerSearch}
                onChangeText={setCustomerSearch}
                autoFocus
              />
              {customerSearch.length > 0 && (
                <TouchableOpacity onPress={() => setCustomerSearch("")}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.resultCount}>
              {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""}
            </Text>

            <FlatList
              data={filteredCustomers}
              keyExtractor={(item) => item.id.toString()}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptyText}>No customers match your search.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.customerRow}
                  onPress={() => handleSelectCustomer(item.id)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.customerRowName}>{item.name}</Text>
                  {item.address && (
                    <Text style={styles.customerRowAddress}>{item.address}</Text>
                  )}
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setCustomerPickerVisible(false);
                setCustomerSearch("");
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
  container: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  label: {
    fontWeight: fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    color: colors.textPrimary,
    fontSize: fontSize.md,
  },
  refNoHint: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  remarksInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    textAlignVertical: "top",
    minHeight: 80,
  },
  charCount: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: "right",
    marginTop: 2,
  },
  attachmentButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  attachmentButtonRequired: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  attachmentButtonText: { color: colors.textSecondary, fontSize: fontSize.base, flex: 1 },
  attachmentButtonTextSelected: { color: colors.textPrimary, fontWeight: fontWeight.semibold },
  attachmentButtonTextRequired: { color: colors.dangerDark, fontWeight: fontWeight.semibold },
  customerSelector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  customerSelectorName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  customerSelectorAddress: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  customerSelectorPlaceholder: { fontSize: fontSize.md, color: colors.textMuted },
  pickerBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  suggestion: {
    backgroundColor: colors.warningLight,
    color: colors.warningDark,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    fontWeight: fontWeight.semibold,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pill: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  pillActive: { backgroundColor: colors.primary },
  pillText: { color: colors.primary, fontWeight: fontWeight.semibold },
  pillTextActive: { color: colors.surface },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: radius.sm,
    alignItems: "center",
    marginTop: spacing.xxl,
    marginBottom: 40,
  },
  buttonText: { color: colors.surface, fontSize: fontSize.md, fontWeight: fontWeight.bold },
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
    height: "80%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.md, color: colors.textPrimary },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  resultCount: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing.sm },
  customerRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  customerRowName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  customerRowAddress: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  emptyText: { textAlign: "center", color: colors.textMuted, marginTop: 30 },
  modalCloseButton: { marginTop: spacing.md, padding: spacing.md, alignItems: "center" },
  modalCloseText: { color: colors.danger, fontWeight: fontWeight.semibold },
});