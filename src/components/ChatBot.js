import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { getBotResponse } from "../chatbot";
import { colors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

const LANGUAGES = [
  { code: "en-US", label: "EN" },
  { code: "si-LK", label: "සිං" },
  { code: "ta-LK", label: "தமி" },
];

// Browser speech recognition (laptop / web version)
const getWebRecognition = () => {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export default function ChatBot() {
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState([
    { id: "welcome", from: "bot", text: "Hey! Ask me about your jobs, notifications, or how to use the app. You can tap the mic and speak." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [langIndex, setLangIndex] = useState(0);
  const listRef = useRef(null);
  const webRecRef = useRef(null);
  const lastTranscriptRef = useRef("");
  const sendRef = useRef(null);

  const lang = LANGUAGES[langIndex];

  const sendText = async (raw) => {
    const text = (raw || "").trim();
    if (!text) return;

    const userMsg = { id: Date.now().toString(), from: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    try {
      const reply = await getBotResponse(text);
      setMessages((prev) => [...prev, { id: Date.now().toString() + "b", from: "bot", text: reply }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString() + "e", from: "bot", text: "Something went wrong answering that." },
      ]);
    } finally {
      setThinking(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };
  sendRef.current = sendText;

  const handleSend = () => sendText(input);

  // ---------- Phone (native) speech events ----------
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript ?? "";
    lastTranscriptRef.current = transcript;
    setInput(transcript);
  });
  useSpeechRecognitionEvent("end", () => {
    setListening(false);
    const spoken = lastTranscriptRef.current;
    lastTranscriptRef.current = "";
    if (spoken.trim()) sendRef.current(spoken); // auto-send when the person stops talking
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    lastTranscriptRef.current = "";
    if (event.error !== "no-speech" && event.error !== "aborted") {
      Alert.alert("Voice problem", event.message || "Could not hear you. Please try again.");
    }
  });

  // Stop listening if the chat window is closed
  useEffect(() => {
    if (!visible && listening) stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const startListening = async () => {
    lastTranscriptRef.current = "";

    // ----- Web / laptop -----
    if (Platform.OS === "web") {
      const SR = getWebRecognition();
      if (!SR) {
        Alert.alert("Voice not supported", "Please use Google Chrome or Microsoft Edge for voice input.");
        return;
      }
      const rec = new SR();
      rec.lang = lang.code;
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        lastTranscriptRef.current = text;
        setInput(text);
      };
      rec.onerror = (e) => {
        setListening(false);
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          Alert.alert("Microphone blocked", "Allow microphone access in the browser (lock icon next to the address bar).");
        }
      };
      rec.onend = () => {
        setListening(false);
        const spoken = lastTranscriptRef.current;
        lastTranscriptRef.current = "";
        if (spoken.trim()) sendRef.current(spoken);
      };
      webRecRef.current = rec;
      try {
        rec.start();
        setListening(true);
      } catch (e) {
        setListening(false);
      }
      return;
    }

    // ----- Phone (Android / iOS) -----
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow microphone and speech recognition for this app in phone Settings.");
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: lang.code,
        interimResults: true,
        continuous: false,
      });
      setListening(true);
    } catch (e) {
      setListening(false);
      Alert.alert("Voice not available", "Voice input is not available on this phone.");
    }
  };

  const stopListening = () => {
    try {
      if (Platform.OS === "web") {
        webRecRef.current?.stop();
      } else {
        ExpoSpeechRecognitionModule.stop();
      }
    } catch (e) {
      // ignore
    }
  };

  const toggleMic = () => (listening ? stopListening() : startListening());

  const cycleLanguage = () => setLangIndex((i) => (i + 1) % LANGUAGES.length);

  return (
    <>
      <TouchableOpacity style={styles.fab} onPress={() => setVisible(true)} activeOpacity={0.85}>
        <MaterialCommunityIcons name="robot-happy" size={42} color={colors.surface} />
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            style={styles.panel}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.botAvatar}>
                  <MaterialCommunityIcons name="robot-happy" size={22} color={colors.surface} />
                </View>
                <Text style={styles.headerTitle}>Job App Assistant</Text>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: spacing.lg }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.bubble,
                    item.from === "user" ? styles.userBubble : styles.botBubble,
                  ]}
                >
                  <Text style={item.from === "user" ? styles.userText : styles.botText}>
                    {item.text}
                  </Text>
                </View>
              )}
            />

            {thinking && (
              <View style={styles.thinkingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.thinkingText}>Thinking...</Text>
              </View>
            )}

            {listening && (
              <View style={styles.thinkingRow}>
                <Ionicons name="mic" size={16} color={colors.primary} />
                <Text style={styles.thinkingText}>Listening... speak now (tap the mic to stop)</Text>
              </View>
            )}

            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.langButton} onPress={cycleLanguage} disabled={listening}>
                <Text style={styles.langText}>{lang.label}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder={listening ? "Listening..." : "Ask something..."}
                placeholderTextColor={colors.textMuted}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.micButton, listening && styles.micButtonActive]}
                onPress={toggleMic}
              >
                <Ionicons name={listening ? "stop" : "mic"} size={20} color={listening ? colors.surface : colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                <Ionicons name="send" size={18} color={colors.surface} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadow.card,
    elevation: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    height: "75%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  bubble: {
    maxWidth: "80%",
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  userBubble: {
    backgroundColor: colors.primary,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: colors.neutralLight,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  userText: { color: colors.surface, fontSize: fontSize.base },
  botText: { color: colors.textPrimary, fontSize: fontSize.base },
  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  thinkingText: { color: colors.textMuted, fontSize: fontSize.sm },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  langButton: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  langText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.bold },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  micButtonActive: {
    backgroundColor: "#D32F2F",
    borderColor: "#D32F2F",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
});
