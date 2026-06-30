/**
 * Network layer for StudyPilot AI.
 *
 * The interfaces below mirror the backend Pydantic schemas
 * (`backend/app/models/schemas.py`) field-for-field, so responses are
 * strongly typed end-to-end.
 */
import { Platform } from "react-native";

import { getAuthToken, getUserId } from "./session";

// ---------------------------------------------------------------------------
// Base URL resolution
// ---------------------------------------------------------------------------
// On a real device set EXPO_PUBLIC_API_URL to your machine's LAN IP, e.g.
// EXPO_PUBLIC_API_URL=http://192.168.1.20:8000. The defaults below cover the
// Android emulator (10.0.2.2 -> host loopback) and iOS simulator / web.
const DEV_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? `http://${DEV_HOST}:8000`;

// ---------------------------------------------------------------------------
// Schema-mirroring types
// ---------------------------------------------------------------------------
export type FileFormat = "pdf" | "docx" | "pptx" | "txt";

export interface UserProfile {
  id: string;
  name?: string | null;
  email?: string | null;
  university?: string | null;
  semester?: string | null;
  created_at: string;
}

export interface MaterialSummary {
  id: string;
  user_id: string;
  file_name: string;
  file_url?: string | null;
  chunk_count: number;
  format: FileFormat;
  created_at: string; // ISO-8601 datetime
}

export interface UploadResponse {
  status: string;
  message: string;
  material: MaterialSummary;
}

export interface DashboardStats {
  user?: UserProfile | null;
  total_files_uploaded: number;
  active_quizzes_generated: number;
  study_velocity_hours: number;
  documents: MaterialSummary[];
}

export type GenerationType = "QUIZ" | "FLASHCARDS";

export interface QuizQuestionItem {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  topic_tag: string;
}

export interface FlashcardItem {
  id: string;
  front_prompt: string;
  back_answer: string;
}

export interface GenerateRequest {
  material_id?: string | null;
  generation_type: GenerationType;
  count?: number;
}

export interface GenerationResult {
  id: string;
  material_id?: string | null;
  generation_type: GenerationType;
  title: string;
  questions: QuizQuestionItem[];
  flashcards: FlashcardItem[];
}

export interface ExamSubmissionPayload {
  material_id: string;
  /** Map of question id -> selected option index. */
  answers: Record<string, number>;
}

export interface ExamResultResponse {
  score: number;
  total_questions: number;
  /** topic_tag -> fractional category percentage (0-100). */
  topic_mastery: Record<string, number>;
  weakness_recommendations: string[];
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Optional document scope — restricts retrieval to this material's chunks. */
  material_id?: string | null;
}

export interface ChatResponse {
  reply: ChatMessage;
  references: string[];
  /** Citation: source filename when the answer is document-scoped. */
  source?: string | null;
  scoped: boolean;
}

export interface DoubtSaveRequest {
  material_id?: string | null;
  question_text: string;
  ai_answer_text: string;
}

export interface DoubtItem {
  id: string;
  user_id: string;
  material_id?: string | null;
  question_text: string;
  ai_answer_text: string;
  created_at: string;
}

/** Minimal shape of a file chosen via expo-document-picker. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    return JSON.stringify(body.detail ?? body);
  } catch {
    return res.statusText || `Request failed (${res.status})`;
  }
}

/** Identity headers appended to every request (X-User-ID + optional Bearer). */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const userId = getUserId();
  if (userId) headers["X-User-ID"] = userId;
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { headers: initHeaders, ...rest } = init ?? {};
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...authHeaders(),
      ...(initHeaders ?? {}),
    },
  });
  if (!res.ok) {
    throw new ApiError(res.status, await readErrorDetail(res));
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------
export function getDashboardStats(): Promise<DashboardStats> {
  return request<DashboardStats>("/api/student/dashboard-stats");
}

export function uploadMaterial(file: PickedFile): Promise<UploadResponse> {
  const form = new FormData();
  // React Native's FormData accepts this { uri, name, type } file descriptor,
  // which is not part of the DOM FormData typing — hence the cast.
  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? "application/octet-stream",
  } as unknown as Blob);

  return request<UploadResponse>("/api/materials/upload", {
    method: "POST",
    body: form,
  });
}

export function generateAssessment(
  req: GenerateRequest,
): Promise<GenerationResult> {
  return postJson<GenerationResult>("/api/quiz/generate", req);
}

export function submitExam(
  payload: ExamSubmissionPayload,
): Promise<ExamResultResponse> {
  return postJson<ExamResultResponse>("/api/quiz/submit", payload);
}

export function sendChat(req: ChatRequest): Promise<ChatResponse> {
  return postJson<ChatResponse>("/api/quiz/chat", req);
}

export function saveDoubt(payload: DoubtSaveRequest): Promise<DoubtItem> {
  return postJson<DoubtItem>("/api/doubts/save", payload);
}

export function getDoubts(): Promise<DoubtItem[]> {
  return request<DoubtItem[]>("/api/doubts");
}
