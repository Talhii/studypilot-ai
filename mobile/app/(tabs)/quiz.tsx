import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FlipCard } from "../../components/FlipCard";
import { Card, Divider } from "../../components/ui";
import {
  generateAssessment,
  getDashboardStats,
  submitExam,
  type ExamResultResponse,
  type FlashcardItem,
  type GenerationType,
  type MaterialSummary,
  type QuizQuestionItem,
} from "../../lib/api";
import { theme } from "../../lib/theme";

type Phase = "select" | "loading" | "exam" | "scoring" | "result" | "flashcards";

const clip = (s: string, n = 18) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

export default function QuizScreen() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("select");
  const [error, setError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<MaterialSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Exam state
  const [questions, setQuestions] = useState<QuizQuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<ExamResultResponse | null>(null);

  // Flashcard state
  const [cards, setCards] = useState<FlashcardItem[]>([]);

  const loadDocuments = useCallback(async () => {
    try {
      const stats = await getDashboardStats();
      setDocuments(stats.documents);
      setSelectedId((prev) =>
        prev && stats.documents.some((d) => d.id === prev)
          ? prev
          : (stats.documents[0]?.id ?? null),
      );
    } catch {
      // Soft-fail: the user can retry from an empty state.
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function generate(type: GenerationType) {
    if (!selectedId) return;
    setPhase("loading");
    setError(null);
    setResult(null);
    setAnswers({});
    setIndex(0);
    try {
      const res = await generateAssessment({
        material_id: selectedId,
        generation_type: type,
        count: type === "QUIZ" ? 3 : 5,
      });
      if (type === "QUIZ") {
        setQuestions(res.questions);
        if (res.questions.length === 0) {
          setError("No questions could be generated for this document.");
          setPhase("select");
        } else {
          setPhase("exam");
        }
      } else {
        setCards(res.flashcards);
        if (res.flashcards.length === 0) {
          setError("No flashcards could be generated for this document.");
          setPhase("select");
        } else {
          setPhase("flashcards");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setPhase("select");
    }
  }

  async function finishExam() {
    if (!selectedId) return;
    setPhase("scoring");
    try {
      const res = await submitExam({ material_id: selectedId, answers });
      setResult(res);
      setPhase("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not grade exam");
      setPhase("exam");
    }
  }

  const current = questions[index];
  const answeredCount = questions.filter(
    (q) => answers[q.id] !== undefined,
  ).length;
  const allAnswered =
    questions.length > 0 && answeredCount === questions.length;
  const busy = phase === "loading";

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold text-ink">Exam mode</Text>
        <Text className="mt-1 text-sm text-muted">
          AI quiz, flashcards & weakness tracking.
        </Text>

        {error ? (
          <Card className="mt-5 border-danger/30">
            <Text className="text-sm text-danger">⚠ {error}</Text>
          </Card>
        ) : null}

        {/* ---------------------------------------------------------- SELECT */}
        {phase === "select" || phase === "loading" ? (
          <View className="mt-6">
            <Text className="mb-3 text-base font-semibold text-ink">
              Choose a document
            </Text>
            {documents.length === 0 ? (
              <Card>
                <Text className="text-sm text-ink">No materials yet.</Text>
                <Text className="mt-1 text-xs text-muted">
                  Upload a file first, then come back to test yourself.
                </Text>
              </Card>
            ) : (
              <View className="flex-row flex-wrap">
                {documents.map((doc) => {
                  const active = doc.id === selectedId;
                  return (
                    <Pressable
                      key={doc.id}
                      onPress={() => setSelectedId(doc.id)}
                      className={`mb-2 mr-2 flex-row items-center rounded-full border px-3 py-2 ${
                        active
                          ? "border-primary bg-primary-soft"
                          : "border-line bg-surface"
                      }`}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={14}
                        color={active ? theme.primary : theme.muted}
                      />
                      <Text
                        className={`ml-1.5 text-xs font-semibold ${
                          active ? "text-primary" : "text-ink"
                        }`}
                      >
                        {clip(doc.file_name)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View className="mt-6">
              <Pressable
                onPress={() => generate("QUIZ")}
                disabled={!selectedId || busy}
                className={`mb-3 h-14 flex-row items-center justify-center rounded-full ${
                  selectedId ? "bg-primary" : "bg-primary/40"
                }`}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="school-outline" size={18} color="#fff" />
                    <Text className="ml-2 text-sm font-semibold text-white">
                      Start Practice Exam
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={() => generate("FLASHCARDS")}
                disabled={!selectedId || busy}
                className={`h-14 flex-row items-center justify-center rounded-full border ${
                  selectedId ? "border-primary" : "border-line"
                }`}
              >
                <Ionicons
                  name="albums-outline"
                  size={18}
                  color={selectedId ? theme.primary : theme.muted}
                />
                <Text
                  className={`ml-2 text-sm font-semibold ${
                    selectedId ? "text-primary" : "text-muted"
                  }`}
                >
                  Study Flashcards
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ------------------------------------------------------------ EXAM */}
        {(phase === "exam" || phase === "scoring") && current ? (
          <View className="mt-6">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-ink">
                Practice Exam
              </Text>
              <Text className="text-xs text-muted">
                Question {index + 1} of {questions.length}
              </Text>
            </View>

            <Card>
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                {current.topic_tag}
              </Text>
              <Text className="mt-2 text-sm font-semibold text-ink">
                {current.question}
              </Text>
              <Divider />
              {current.options.map((opt, oi) => {
                const selected = answers[current.id] === oi;
                return (
                  <Pressable
                    key={oi}
                    onPress={() =>
                      setAnswers((p) => ({ ...p, [current.id]: oi }))
                    }
                    className={`mb-2 flex-row items-center rounded-2xl border px-4 py-3 ${
                      selected
                        ? "border-primary bg-primary-soft"
                        : "border-line bg-surface"
                    }`}
                  >
                    <View
                      className={`mr-3 h-5 w-5 items-center justify-center rounded-full border ${
                        selected ? "border-primary" : "border-muted"
                      }`}
                    >
                      {selected ? (
                        <View className="h-2.5 w-2.5 rounded-full bg-primary" />
                      ) : null}
                    </View>
                    <Text
                      className={`flex-1 text-[13px] ${
                        selected ? "text-ink" : "text-muted"
                      }`}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </Card>

            {/* Step-progress indicator */}
            <View className="mt-4 flex-row items-center justify-center">
              {questions.map((q, i) => (
                <View
                  key={q.id}
                  className={`mx-1 h-2 rounded-full ${
                    i === index
                      ? "w-5 bg-primary"
                      : answers[q.id] !== undefined
                        ? "w-2 bg-accent"
                        : "w-2 bg-line"
                  }`}
                />
              ))}
            </View>

            <View className="mt-5 flex-row">
              <Pressable
                onPress={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className={`mr-3 flex-1 items-center rounded-full border px-4 py-3 ${
                  index === 0 ? "border-line" : "border-primary"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    index === 0 ? "text-muted" : "text-primary"
                  }`}
                >
                  Back
                </Text>
              </Pressable>
              {index < questions.length - 1 ? (
                <Pressable
                  onPress={() =>
                    setIndex((i) => Math.min(questions.length - 1, i + 1))
                  }
                  className="flex-1 items-center rounded-full bg-primary px-4 py-3"
                >
                  <Text className="text-sm font-semibold text-white">Next</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={finishExam}
                  disabled={!allAnswered || phase === "scoring"}
                  className={`flex-1 items-center rounded-full px-4 py-3 ${
                    allAnswered ? "bg-primary" : "bg-primary/40"
                  }`}
                >
                  {phase === "scoring" ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-sm font-semibold text-white">
                      Submit
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        ) : null}

        {/* ------------------------------------------------------ FLASHCARDS */}
        {phase === "flashcards" && cards[index] ? (
          <View className="mt-6">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-ink">Flashcards</Text>
              <Text className="text-xs text-muted">
                {index + 1} of {cards.length}
              </Text>
            </View>

            <FlipCard
              key={cards[index].id}
              front={cards[index].front_prompt}
              back={cards[index].back_answer}
            />

            <View className="mt-4 flex-row items-center justify-center">
              {cards.map((c, i) => (
                <View
                  key={c.id}
                  className={`mx-1 h-2 rounded-full ${
                    i === index ? "w-5 bg-primary" : "w-2 bg-line"
                  }`}
                />
              ))}
            </View>

            <View className="mt-5 flex-row">
              <Pressable
                onPress={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className={`mr-3 flex-1 items-center rounded-full border px-4 py-3 ${
                  index === 0 ? "border-line" : "border-primary"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    index === 0 ? "text-muted" : "text-primary"
                  }`}
                >
                  Prev
                </Text>
              </Pressable>
              {index < cards.length - 1 ? (
                <Pressable
                  onPress={() =>
                    setIndex((i) => Math.min(cards.length - 1, i + 1))
                  }
                  className="flex-1 items-center rounded-full bg-primary px-4 py-3"
                >
                  <Text className="text-sm font-semibold text-white">Next</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    setPhase("select");
                    setIndex(0);
                  }}
                  className="flex-1 items-center rounded-full bg-primary px-4 py-3"
                >
                  <Text className="text-sm font-semibold text-white">Done</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}

        {/* ---------------------------------------------------------- RESULT */}
        {phase === "result" && result ? (
          <View className="mt-6">
            <Card className="items-center">
              <Text className="text-xs uppercase tracking-wide text-muted">
                Your score
              </Text>
              <Text className="mt-1 text-4xl font-bold text-primary">
                {result.score}%
              </Text>
              <Text className="mt-1 text-xs text-muted">
                {result.total_questions} questions graded
              </Text>
            </Card>

            <Text className="mb-3 mt-6 text-base font-semibold text-ink">
              Topic mastery
            </Text>
            {Object.entries(result.topic_mastery).map(([topic, pct]) => {
              const weak = pct < 60;
              return (
                <Card key={topic} className="mb-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-ink">
                      {topic}
                    </Text>
                    <Text
                      className={`text-xs font-semibold ${
                        weak ? "text-peach" : "text-accent"
                      }`}
                    >
                      {Math.round(pct)}%
                    </Text>
                  </View>
                  <View className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
                    <View
                      className={`h-2 rounded-full ${
                        weak ? "bg-peach" : "bg-accent"
                      }`}
                      style={{
                        width: `${Math.max(0, Math.min(100, Math.round(pct)))}%`,
                      }}
                    />
                  </View>
                </Card>
              );
            })}

            {result.weakness_recommendations.length > 0 ? (
              <View className="mt-1">
                <Text className="mb-2 text-base font-semibold text-ink">
                  Recommended review
                </Text>
                {result.weakness_recommendations.map((rec, i) => (
                  <Card key={i} className="mb-2 flex-row border-peach/30">
                    <Ionicons
                      name="alert-circle-outline"
                      size={18}
                      color={theme.peach}
                    />
                    <Text className="ml-2 flex-1 text-xs text-ink">{rec}</Text>
                  </Card>
                ))}
              </View>
            ) : (
              <Card className="mt-1 flex-row items-center border-success/30">
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={theme.success}
                />
                <Text className="ml-2 flex-1 text-sm text-ink">
                  Great work — no weak topics flagged.
                </Text>
              </Card>
            )}

            <Pressable
              onPress={() => setPhase("select")}
              className="mt-5 w-full items-center rounded-full border border-primary px-6 py-4"
            >
              <Text className="text-sm font-semibold text-primary">
                New session
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
