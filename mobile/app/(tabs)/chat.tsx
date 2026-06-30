import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getDashboardStats,
  saveDoubt,
  sendChat,
  type ChatMessage,
  type MaterialSummary,
} from "../../lib/api";
import { theme } from "../../lib/theme";

let messageId = 0;
const nextId = () => `m${++messageId}`;

interface Bubble extends ChatMessage {
  id: string;
  source?: string | null;
}

const WELCOME: Bubble = {
  id: nextId(),
  role: "assistant",
  content:
    "Hi! I'm your StudyPilot tutor. Pick a document below to scope my answers, or ask across everything.",
};

const clip = (s: string, n = 18) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Bubble[]>([WELCOME]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Document registry + active scope selection.
  const [documents, setDocuments] = useState<MaterialSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Ids of assistant bubbles already saved to the Doubt Notebook.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const loadDocuments = useCallback(async () => {
    try {
      const stats = await getDashboardStats();
      setDocuments(stats.documents);
      // Drop the scope if the selected document no longer exists.
      setSelectedId((prev) =>
        prev && stats.documents.some((d) => d.id === prev) ? prev : null,
      );
    } catch {
      // Soft-fail: chat still works in global scope without the registry.
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const selectedDoc = documents.find((d) => d.id === selectedId) ?? null;

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;

    const userBubble: Bubble = { id: nextId(), role: "user", content: text };
    const history = [...messages, userBubble];
    setMessages(history);
    setDraft("");
    setSending(true);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd());

    try {
      const res = await sendChat({
        messages: history.map(({ role, content }) => ({ role, content })),
        material_id: selectedId, // null = global scope
      });
      setMessages((prev) => [
        ...prev,
        { id: nextId(), ...res.reply, source: res.source },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content:
            e instanceof Error
              ? `⚠ ${e.message}`
              : "⚠ Could not reach the tutor service.",
        },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd());
    }
  }

  async function onSaveDoubt(answer: Bubble, question: string) {
    if (!question || savedIds.has(answer.id)) return;
    try {
      await saveDoubt({
        material_id: selectedId,
        question_text: question,
        ai_answer_text: answer.content,
      });
      setSavedIds((prev) => new Set(prev).add(answer.id));
    } catch {
      // Soft-fail: keep the chat usable even if saving hiccups.
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={{ paddingTop: insets.top }} className="px-5 pb-1 pt-2">
        <Text className="text-2xl font-bold text-ink">Tutor chat</Text>
        <Text className="text-sm text-muted">
          {selectedDoc
            ? `Scoped to ${clip(selectedDoc.file_name, 28)}`
            : "Answering across all your notes"}
        </Text>
      </View>

      {/* Document scope pills */}
      <View className="border-b border-line pb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          className="py-1"
        >
          {/* Global scope pill */}
          <Pressable
            onPress={() => setSelectedId(null)}
            className={`flex-row items-center rounded-full border px-3 py-2 ${
              selectedId === null
                ? "border-primary bg-primary-soft"
                : "border-line bg-surface"
            }`}
          >
            <Ionicons
              name="layers-outline"
              size={14}
              color={selectedId === null ? theme.primary : theme.muted}
            />
            <Text
              className={`ml-1.5 text-xs font-semibold ${
                selectedId === null ? "text-primary" : "text-muted"
              }`}
            >
              All notes
            </Text>
          </Pressable>

          {documents.length === 0 ? (
            <View className="flex-row items-center rounded-full border border-dashed border-line px-3 py-2">
              <Text className="text-xs text-muted">
                Upload a file to scope chat
              </Text>
            </View>
          ) : null}

          {documents.map((doc) => {
            const active = doc.id === selectedId;
            return (
              <Pressable
                key={doc.id}
                onPress={() => setSelectedId(active ? null : doc.id)}
                className={`flex-row items-center rounded-full border px-3 py-2 ${
                  active
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface"
                }`}
              >
                <Ionicons
                  name="document-text-outline"
                  size={14}
                  color={active ? theme.accent : theme.muted}
                />
                <Text
                  className={`ml-1.5 text-xs font-semibold ${
                    active ? "text-accent" : "text-ink"
                  }`}
                >
                  {clip(doc.file_name)}
                </Text>
                {active ? (
                  <Ionicons
                    name="close-circle"
                    size={15}
                    color={theme.accent}
                    style={{ marginLeft: 6 }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
      >
        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          const question =
            [...messages]
              .slice(0, idx)
              .reverse()
              .find((x) => x.role === "user")?.content ?? "";
          return (
            <View
              key={m.id}
              className={`mb-3 max-w-[82%] ${isUser ? "self-end" : "self-start"}`}
            >
              <View
                className={`rounded-[20px] px-4 py-3 ${
                  isUser
                    ? "rounded-br-md bg-primary"
                    : "rounded-bl-md border border-line bg-surface"
                }`}
              >
                <Text
                  selectable={!isUser}
                  className={`text-[13px] leading-5 ${
                    isUser ? "text-white" : "text-ink"
                  }`}
                >
                  {m.content}
                </Text>
              </View>
              {!isUser && m.source ? (
                <View className="mt-1 flex-row items-center pl-1">
                  <Ionicons
                    name="document-attach-outline"
                    size={12}
                    color={theme.accent}
                  />
                  <Text className="ml-1 text-[11px] text-accent">
                    {m.source}
                  </Text>
                </View>
              ) : null}
              {!isUser && question && !m.content.startsWith("⚠") ? (
                <Pressable
                  onPress={() => onSaveDoubt(m, question)}
                  disabled={savedIds.has(m.id)}
                  className="mt-1.5 flex-row items-center self-start rounded-full border border-primary/30 bg-primary-soft px-3 py-1.5"
                >
                  <Ionicons
                    name={savedIds.has(m.id) ? "star" : "star-outline"}
                    size={12}
                    color={theme.primary}
                  />
                  <Text className="ml-1 text-[11px] font-semibold text-primary">
                    {savedIds.has(m.id) ? "Saved to Doubts" : "Save as Doubt"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {sending ? (
          <View className="mb-3 max-w-[82%] self-start">
            <View className="flex-row items-center rounded-[20px] rounded-bl-md border border-line bg-surface px-4 py-3">
              <ActivityIndicator size="small" color={theme.primary} />
              <Text className="ml-2 text-xs text-muted">Thinking…</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Composer */}
      <View
        className="flex-row items-end border-t border-line bg-surface px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 74 }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={
            selectedDoc ? `Ask about ${clip(selectedDoc.file_name, 16)}…` : "Ask a question…"
          }
          placeholderTextColor={theme.muted}
          multiline
          className="max-h-28 flex-1 rounded-3xl bg-background px-4 py-3 text-[14px] text-ink"
          onSubmitEditing={send}
        />
        <Pressable
          onPress={send}
          disabled={sending || draft.trim().length === 0}
          className={`ml-3 h-12 w-12 items-center justify-center rounded-full ${
            draft.trim().length === 0 ? "bg-primary/40" : "bg-primary"
          }`}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
