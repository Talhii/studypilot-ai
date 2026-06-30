# StudyPilot AI — Phase 1 Monorepo

A premium cross-platform AI Learning Companion. Phase 1 ships a working,
type-safe vertical slice: an Expo mobile client talking to a mocked FastAPI
backend (no API keys required).

```
StudyPilot-AI/
├── backend/   # Python 3.11+ FastAPI microservice (port 8000)
└── mobile/    # React Native + Expo Router v3 + NativeWind v4 (TypeScript)
```

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Docs at http://localhost:8000/docs

### 2. Mobile

```bash
cd mobile
npm install
npm run start                      # then press a / i, or scan the QR in Expo Go
```

On a physical device, set the API URL to your machine's LAN IP:

```bash
# mobile/.env
EXPO_PUBLIC_API_URL=http://192.168.1.20:8000
```

## How the pieces connect

- The mobile `lib/api.ts` interfaces mirror the backend Pydantic schemas
  (`backend/app/models/schemas.py`) field-for-field.
- **Home** → `GET /api/student/dashboard-stats`
- **Upload** → `POST /api/materials/upload` (multipart, via expo-document-picker)
- **Chat** → `POST /api/quiz/chat` (RAG-grounded, mocked orchestrator)
- **Quiz** → `POST /api/quiz/generate` → `POST /api/quiz/submit` (weakness report)

## Phase 1 scope & swap points

- State is in-memory (`backend/app/store.py`) — swap for a real DB later.
- The AI orchestrator (`backend/app/services/orchestrator.py`) is a deterministic
  mock; replace `_mock_*` with real Claude/OpenAI SDK calls without touching the
  routers or schemas.
- Embeddings are simulated locally (`backend/app/rag/embeddings.py`).
