import React, { useState, useRef } from "react";
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
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { getBotResponse } from "../chatbot";
import { colors, spacing, radius, fontSize, fontWeight, shadow } from "../theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const FAB_SIZE = 72;

export default function ChatBot() {
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState([
    { id: "welcome", from: "bot", text: "Hey! Ask me about your jobs, notifications, or how to use the app." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef(null);

  const pan = useRef(
    new Animated.ValueXY({
      x: SCREEN_WIDTH - FAB_SIZE - 20,
      y: SCREEN_HEIGHT - FAB_SIZE - 120,
    })
  ).current;
  const wasDragged = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) =>
        Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        wasDragged.current = false;
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        if (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4) {
          wasDragged.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(
          evt,
          gestureState
        );
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const clampedX = Math.max(0, Math.min(pan.x._value, SCREEN_WIDTH - FAB_SIZE));
        const clampedY = Math.max(0, Math.min(pan.y._value, SCREEN_HEIGHT - FAB_SIZE));
        pan.setValue({ x: clampedX, y: clampedY });

        if (!wasDragged.current) {
          setVisible(true);
        }
      },
    })
  ).current;

  const handleSend = async () => {
    const text = input.trim();
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

  return (
    <>
      <Animated.View
        style={[styles.fab, { transform: pan.getTranslateTransform() }]}
        {...panResponder.panHandlers}
      >
        <MaterialCommunityIcons name="robot-happy" size={42} color={colors.surface} />
      </Animated.View>

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

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Ask something..."
                placeholderTextColor={colors.textMuted}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
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
    top: 0,
    left: 0,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...shadow.card,
    elevation: 6,
    zIndex: 999,
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
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
});