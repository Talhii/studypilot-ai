# StudyPilot AI — Backend (FastAPI)

Microservice for the StudyPilot AI learning companion. All state is in-memory.
The chat orchestrator runs **live Anthropic Claude** when `ANTHROPIC_API_KEY` is
set, and falls back to a deterministic local mock when it is blank/missing — so
the service runs with zero credentials.

## AI mode (live vs mock)

```bash
# Live Claude (model: claude-sonnet-4-6)
export ANTHROPIC_API_KEY=sk-ant-...   # Windows: $env:ANTHROPIC_API_KEY="sk-ant-..."

# Mock fallback — just leave ANTHROPIC_API_KEY unset
```

Live chat retrieves the document-scoped chunks and passes them to Claude inside a
`-- CONTEXT REFERENCE BLOCKS --` enclosure, instructing it to answer only from
that context and to cite the source filename. Quiz generation remains mocked.

## Run

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
# --host 0.0.0.0 lets a phone on the same Wi-Fi reach it (localhost = PC only)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Interactive docs: http://localhost:8000/docs

## Endpoints

| Method | Path                          | Purpose                                       |
| ------ | ----------------------------- | --------------------------------------------- |
| POST   | `/api/materials/upload`       | Multipart upload (`.pdf/.docx/.pptx/.txt`)    |
| GET    | `/api/student/dashboard-stats`| Aggregate study metrics + document list       |
| POST   | `/api/quiz/generate`          | Generate a `QUIZ` or `FLASHCARDS` set         |
| POST   | `/api/quiz/submit`            | Grade an exam → score, topic mastery, advice  |
| POST   | `/api/quiz/chat`              | RAG-grounded tutor chat turn                  |

## Layout

```
backend/
├── main.py                 # app entry, CORS, router wiring (port 8000)
├── requirements.txt
└── app/
    ├── api/                # routers: materials, quiz, stats
    ├── services/           # AI orchestrator + weakness-detection math
    ├── rag/                # semantic memory + local embedding simulation
    ├── models/             # Pydantic schemas (mirrored in mobile/lib/api.ts)
    ├── config.py
    └── store.py            # thread-safe in-memory store
```
