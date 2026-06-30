<div align="center">

# 📖 StudyPilot AI

### Your Personal AI Learning Companion

A premium cross-platform AI study app — upload your lecture materials, chat with an
AI tutor grounded in **your** documents, generate adaptive quizzes & flashcards,
track topic mastery, and save tricky answers to a revision **Doubt Notebook**.

[**📱 Live Web Demo →**](https://studypilot-npp1guv2s-talha-zubairs-projects.vercel.app/) &nbsp;•&nbsp; [**⚙️ Live Backend API (Swagger) →**](https://studypilot-backend-9ld1.onrender.com/docs)

![Expo SDK 54](https://img.shields.io/badge/Expo-SDK_54-000?logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)
![Claude](https://img.shields.io/badge/AI-Claude_Sonnet_4.6-D97757?logo=anthropic)

</div>

> ⏳ The backend runs on Render's free tier and **sleeps after 15 min of inactivity** —
> the first request may take **30–50 s** to wake up. That's normal for free hosting.
>
> 🤖 By default the app runs in **mock mode** (templated AI, no API key needed) so the
> demo is 100% free. Add an `ANTHROPIC_API_KEY` to switch to **live Claude** answers.

---

## ✨ Features

| Area | What it does |
| --- | --- |
| 📂 **Material ingestion** | Upload `.pdf` `.docx` `.pptx` `.txt`; real text extraction + chunking into a local vector index |
| 💬 **AI Tutor Chat** | Document-scoped RAG — pick a doc to ground answers, or ask across all your notes; answers cite their source |
| 📝 **Adaptive Exam Mode** | Generate multiple-choice quizzes, answer one-by-one, get scored with **per-topic mastery** + remediation tips |
| 🔁 **Flashcards** | Tap-to-flip study cards generated from your material |
| ⭐ **AI Doubt Notebook** | Save any chat answer as a "doubt" and revise your weak areas later |
| 👤 **Profile & Analytics** | Editable profile, achievements grid (materials / quizzes / study hours), reset session |
| 🎨 **Premium UI** | Soft pastel theme, animated splash, slide-in sidebar, 4-tab bottom bar |

---

## 🏗️ Architecture — graceful dual-mode

Every external dependency degrades cleanly, so the app is **fully runnable with zero
credentials** yet **production-ready** when configured:

| Layer | Without config (default) | With config (production) |
| --- | --- | --- |
| **AI** | Deterministic local mock | Live **Anthropic Claude** (`claude-sonnet-4-6`) via `ANTHROPIC_API_KEY` |
| **Database** | In-memory store | **Supabase / PostgreSQL** via `SUPABASE_URL` + `SUPABASE_KEY` |
| **Auth** | Dev-user fallback | **Firebase** identity via `X-User-ID` / Bearer token |
| **Doc parsing** | Synthetic fallback text | Real **PDF / DOCX / PPTX** extraction (`pypdf`, `python-docx`, `python-pptx`) |

All data access is **scoped per user**, and a local RAG layer (hashing embeddings +
cosine similarity over overlapping text chunks) grounds chat and generation in the
student's own materials.

```
┌─────────────── Mobile (Expo / React Native) ───────────────┐
│  Splash → Tabs (Home · Chat · Quiz · More→Sidebar)         │
│  lib/api.ts  ──X-User-ID / Bearer──►                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼─────────── FastAPI backend ──────┐
│  api/  →  materials · quiz · stats · doubts (user-scoped)   │
│  core/ →  database (Supabase | in-memory) · auth (Firebase) │
│  services/ → AI orchestrator (Claude | mock) · grading      │
│  rag/  →  chunk store · local embeddings · cosine search    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧰 Tech Stack

**Mobile** — Expo SDK 54 · React Native 0.81 · Expo Router v6 · TypeScript (strict) ·
NativeWind v4 (Tailwind) · Reanimated · AsyncStorage · expo-document-picker

**Backend** — Python 3.12 · FastAPI · Pydantic v2 · Anthropic SDK · pypdf /
python-docx / python-pptx · Supabase-py · firebase-admin

**Deployment** — Backend on **Render**, Web build on **Vercel**

---

## 📁 Project Structure

```
StudyPilot-AI/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, routers
│   ├── requirements.txt
│   ├── supabase_schema.sql      # Postgres schema for production
│   └── app/
│       ├── api/                 # materials · quiz · stats · doubts routers
│       ├── core/                # database (Supabase|in-memory) · auth (Firebase)
│       ├── services/            # AI orchestrator · weakness/mastery grading
│       ├── rag/                 # chunk store · embeddings · semantic search
│       ├── models/schemas.py    # Pydantic contract (mirrors mobile types)
│       └── config.py            # env loading, model + feature flags
└── mobile/
    ├── app/                     # expo-router routes
    │   ├── index.tsx            # animated splash
    │   └── (tabs)/              # home · chat · quiz · upload · doubts · profile · more
    ├── components/              # ui · FlipCard · Sidebar
    └── lib/                     # api.ts (typed client) · session.ts · theme.ts
```

---

## 🚀 Run Locally

### 1. Backend (port 8000)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Docs at <http://localhost:8000/docs>. Runs in mock mode by default.

### 2. Mobile

```bash
cd mobile
npm install
npm run start                   # press a/i, or scan the QR in Expo Go (SDK 54)
```

On a physical device, point it at your machine's LAN IP — create `mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
```

---

## ⚙️ Configuration (all optional)

Drop a `backend/.env` file (auto-loaded) to enable production features:

```bash
ANTHROPIC_API_KEY=sk-ant-...      # live Claude answers (else: mock mode)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=service-role-key     # run supabase_schema.sql first
```

On the mobile side, `EXPO_PUBLIC_API_URL` points the app at the backend.

---

## 🔌 API Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/materials/upload` | Multipart upload → extract + index, scoped to user |
| `GET`  | `/api/student/dashboard-stats` | Profile + metrics + document list |
| `POST` | `/api/quiz/generate` | Generate a `QUIZ` or `FLASHCARDS` set |
| `POST` | `/api/quiz/submit` | Grade an exam → score + topic mastery + advice |
| `POST` | `/api/quiz/chat` | Document-scoped RAG tutor turn |
| `POST` | `/api/doubts/save` | Save a chat Q/A to the Doubt Notebook |
| `GET`  | `/api/doubts` | List the user's saved doubts |

All data routes accept the Firebase identity via `X-User-ID` or `Authorization: Bearer`.

---

## 🧪 Development Log (by phase)

<details>
<summary><b>Phase 1 — Monorepo scaffold</b></summary>

Expo + FastAPI monorepo. Async multipart upload with cached metadata, dashboard
stats, mocked AI orchestrator, weakness-detection math, and a local RAG layer
(simulated embeddings + semantic memory). Premium pastel tab UI (Home · Upload ·
Chat · Quiz) with a fully typed `lib/api.ts` mirroring the Pydantic schemas.
</details>

<details>
<summary><b>Phase 2 — Document-scoped RAG</b></summary>

Real chunk ingestion (~500-char chunks, 100-char overlap) into a global cache keyed
by material UUID; cosine search restricted strictly to the selected material (or the
whole library). Mobile gets a horizontal **document pill selector**, and answers
return a source-filename citation.
</details>

<details>
<summary><b>Phase 3 — Live Claude + dual-mode fallback</b></summary>

`AsyncAnthropic` integration on `claude-sonnet-4-6` (the current Sonnet — the originally
specced `claude-3-5-sonnet-20241022` was retired). Retrieved chunks are wrapped in a
`-- CONTEXT REFERENCE BLOCKS --` enclosure; the model is instructed to answer only
from context and cite the source. Any API failure degrades gracefully to the mock.
</details>

<details>
<summary><b>Phase 4 — Quiz Engine, Flashcards & Adaptive Exam Mode</b></summary>

Structured generation (`QuizQuestionItem`, `FlashcardItem`) with a `generation_type`
enum. Exam submissions are graded into fractional per-topic mastery + remediation
rows. Mobile gains a one-by-one exam deck with a step-progress indicator, animated
**flip-style flashcards**, and a pastel grading dashboard.
</details>

<details>
<summary><b>Phase 5 — Production integration (Auth · DB · Doubt Notebook)</b></summary>

A repository abstraction over four Supabase tables (`users`, `uploaded_materials`,
`quizzes`, `doubt_notebook`) with an in-memory fallback; a Firebase auth dependency
(`X-User-ID` / Bearer); strictly user-scoped routers; and the **AI Doubt Notebook**
(`/api/doubts`). Mobile adds a persistent device session, a "⭐ Save as Doubt" button,
and a Doubt Notebook screen.
</details>

<details>
<summary><b>Polish — Profile, Splash, Sidebar & real parsing</b></summary>

Editable **Profile** screen (name / university / semester + analytics grid + reset),
an animated **splash** (logo → name → tagline), a slide-in **sidebar** with a trimmed
4-tab bottom bar, real **PDF/DOCX/PPTX** text extraction, upgrade to **Expo SDK 54**,
and free deployment on Render + Vercel.
</details>

---

## ⚠️ Notes & Limitations

- **Free-tier backend sleeps** after 15 min — first request is slow to wake.
- **In-memory mode resets** on every backend restart; configure Supabase for persistence.
- **Mock mode** returns templated answers — set `ANTHROPIC_API_KEY` for real summaries.
- Scanned/image-only PDFs (no text layer) fall back to synthetic text (OCR not included).

---

<div align="center">

Built with FastAPI · Expo · Anthropic Claude · Supabase

</div>
