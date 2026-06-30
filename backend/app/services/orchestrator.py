"""AI orchestrator engine — live Anthropic Claude with a mock fallback.

Phase 3 added live chat; Phase 4 adds structured quiz/flashcard generation. Both
run against the live Claude API (async client) when `ANTHROPIC_API_KEY` is set,
and fall back to a deterministic local mock otherwise, so the whole pipeline
stays runnable with zero credentials.

Live generation asks Claude for a clean JSON array matching our schema shapes
and validates it through Pydantic; any parse/API failure degrades to the mock.
Model: `claude-sonnet-4-6` (see app.config for why this replaces the retired
`claude-3-5-sonnet-20241022`).
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import List, Optional

from app import config
from app.models.schemas import (
    ChatMessage,
    ChatResponse,
    FlashcardItem,
    GenerateRequest,
    GenerationResult,
    GenerationType,
    QuizQuestionItem,
)
from app.rag import memory as rag_memory
from app.rag.memory import RetrievedChunk

logger = logging.getLogger("studypilot.orchestrator")

try:  # The package is optional — absence simply forces the mock path.
    import anthropic
except ImportError:  # pragma: no cover - exercised only without the dep
    anthropic = None  # type: ignore[assignment]


_CHAT_SYSTEM_PROMPT = (
    "You are StudyPilot, a concise academic co-pilot for students. "
    "Answer the student's question using ONLY the information contained in the "
    "CONTEXT REFERENCE BLOCKS provided in the user message. If the answer is "
    "not supported by that context, say so plainly and do not invent facts. "
    "Be accurate, well-structured, and study-friendly; prefer short paragraphs "
    "and bullet points over long prose."
)

_GENERATION_SYSTEM_PROMPT = (
    "You are StudyPilot's assessment generator. You output ONLY valid JSON that "
    "matches the requested array shape — no commentary, no markdown fences. "
    "Base every item strictly on the provided context."
)


class AIOrchestrator:
    """Routes generation/chat to Claude (live) or the local mock."""

    def __init__(
        self,
        provider: str = config.DEFAULT_AI_PROVIDER,
        model: str = config.LIVE_CHAT_MODEL,
    ) -> None:
        self.provider = provider
        self.model = model
        self._client = None
        if self._live_available():
            # Constructing the client does not perform any network I/O; it reads
            # ANTHROPIC_API_KEY from the environment automatically.
            self._client = anthropic.AsyncAnthropic()
            logger.info("AIOrchestrator: live Anthropic path enabled (%s).", self.model)
        else:
            logger.info("AIOrchestrator: no API key/SDK — using mock fallback.")

    @staticmethod
    def _live_available() -> bool:
        return anthropic is not None and config.anthropic_live_enabled()

    # ======================================================================
    # Generation (Phase 4)
    # ======================================================================
    async def generate(
        self,
        request: GenerateRequest,
        source_title: str,
        chunks: List[str],
    ) -> GenerationResult:
        """Produce a quiz or flashcard deck for a material."""
        if self._client is not None and chunks:
            try:
                live = await self._live_generate(request, source_title, chunks)
                if live is not None:
                    return live
            except Exception as exc:  # noqa: BLE001 - degrade on any SDK/parse error
                logger.warning("Live generation failed, using mock: %s", exc)
        return self._mock_generate(request, source_title)

    async def _live_generate(
        self, request: GenerateRequest, source_title: str, chunks: List[str]
    ) -> Optional[GenerationResult]:
        topic = _topic_from_title(source_title)
        context = "\n\n".join(
            f"[Block {i}] {c}" for i, c in enumerate(chunks[:8], start=1)
        )
        if request.generation_type == GenerationType.FLASHCARDS:
            instruction = (
                f"Create exactly {request.count} study flashcards drawn strictly "
                "from the CONTEXT REFERENCE BLOCKS. Respond with ONLY a JSON array "
                "(no prose, no markdown fences). Each element must be an object: "
                '{"front_prompt": string, "back_answer": string}.'
            )
        else:
            instruction = (
                f"Create exactly {request.count} multiple-choice questions drawn "
                "strictly from the CONTEXT REFERENCE BLOCKS. Respond with ONLY a "
                "JSON array (no prose, no markdown fences). Each element must be an "
                'object: {"question": string, "options": [4 strings], '
                '"correct_index": integer 0-3, "topic_tag": short string naming '
                "the sub-topic}."
            )
        user = (
            "-- CONTEXT REFERENCE BLOCKS --\n"
            f"{context}\n"
            "-- END CONTEXT REFERENCE BLOCKS --\n\n"
            f"{instruction}"
        )
        response = await self._client.messages.create(
            model=self.model,
            max_tokens=config.LIVE_MAX_TOKENS,
            system=_GENERATION_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in response.content if b.type == "text")
        data = json.loads(_extract_json_array(text))
        if not isinstance(data, list) or not data:
            return None

        gid = str(uuid.uuid4())
        if request.generation_type == GenerationType.FLASHCARDS:
            cards = _parse_flashcards(data, request.count)
            if not cards:
                return None
            return GenerationResult(
                id=gid,
                material_id=request.material_id,
                generation_type=GenerationType.FLASHCARDS,
                title=f"{topic} — Flashcards",
                flashcards=cards,
            )

        questions = _parse_questions(data, request.count, topic)
        if not questions:
            return None
        return GenerationResult(
            id=gid,
            material_id=request.material_id,
            generation_type=GenerationType.QUIZ,
            title=f"{topic} — Practice Exam",
            questions=questions,
        )

    def _mock_generate(
        self, request: GenerateRequest, source_title: str
    ) -> GenerationResult:
        topic = _topic_from_title(source_title)
        gid = str(uuid.uuid4())

        if request.generation_type == GenerationType.FLASHCARDS:
            cards = [
                FlashcardItem(
                    id=str(uuid.uuid4()),
                    front_prompt=f"{topic}: key idea #{i + 1}?",
                    back_answer=(
                        f"A concise explanation of concept #{i + 1} from {topic}, "
                        "with a worked example and a common pitfall to avoid."
                    ),
                )
                for i in range(request.count)
            ]
            return GenerationResult(
                id=gid,
                material_id=request.material_id,
                generation_type=GenerationType.FLASHCARDS,
                title=f"{topic} — Flashcards",
                flashcards=cards,
            )

        # Rotate a couple of topic tags so per-topic mastery is meaningful.
        tags = [f"{topic} Fundamentals", f"{topic} Applications"]
        questions = [
            QuizQuestionItem(
                id=str(uuid.uuid4()),
                question=f"Q{i + 1}. Which statement about {topic} is correct?",
                options=[
                    f"A core principle of {topic}.",
                    f"An unrelated claim about {topic}.",
                    "A common misconception.",
                    "None of the above.",
                ],
                correct_index=0,
                topic_tag=tags[i % len(tags)],
            )
            for i in range(request.count)
        ]
        return GenerationResult(
            id=gid,
            material_id=request.material_id,
            generation_type=GenerationType.QUIZ,
            title=f"{topic} — Practice Exam",
            questions=questions,
        )

    # ======================================================================
    # Chat (Phase 2/3)
    # ======================================================================
    async def chat(
        self,
        messages: List[ChatMessage],
        material_id: Optional[str] = None,
        source_filename: Optional[str] = None,
        allowed_material_ids: Optional[List[str]] = None,
    ) -> ChatResponse:
        """Answer the latest user turn, grounded in retrieved chunks.

        Global-scope retrieval is restricted to `allowed_material_ids` (the
        user's own materials) so chat never leaks across users.
        """
        last_user = next(
            (m for m in reversed(messages) if m.role == "user"), None
        )
        query = last_user.content if last_user else ""
        retrieved = rag_memory.search(
            query,
            material_id=material_id,
            top_k=3,
            allowed_material_ids=allowed_material_ids,
        )
        references = [r.text[:160] for r in retrieved]
        scoped = material_id is not None

        if self._client is not None:
            reply_text = await self._live_reply(
                messages, retrieved, scoped, source_filename, query, references
            )
        else:
            reply_text = self._mock_reply(query, references, scoped, source_filename)

        return ChatResponse(
            reply=ChatMessage(role="assistant", content=reply_text),
            references=references,
            source=source_filename if scoped else None,
            scoped=scoped,
        )

    async def _live_reply(
        self,
        messages: List[ChatMessage],
        retrieved: List[RetrievedChunk],
        scoped: bool,
        source_filename: Optional[str],
        query: str,
        references: List[str],
    ) -> str:
        try:
            convo = self._build_messages(
                messages, retrieved, scoped, source_filename
            )
            if not convo:
                return self._mock_reply(query, references, scoped, source_filename)

            response = await self._client.messages.create(
                model=self.model,
                max_tokens=config.LIVE_MAX_TOKENS,
                system=_CHAT_SYSTEM_PROMPT,
                messages=convo,
            )
            text = "".join(
                block.text for block in response.content if block.type == "text"
            ).strip()
            return text or self._mock_reply(query, references, scoped, source_filename)
        except Exception as exc:  # noqa: BLE001 - any API/SDK failure degrades safely
            logger.warning("Live Claude call failed, using mock fallback: %s", exc)
            return self._mock_reply(query, references, scoped, source_filename)

    def _build_messages(
        self,
        messages: List[ChatMessage],
        retrieved: List[RetrievedChunk],
        scoped: bool,
        source_filename: Optional[str],
    ) -> List[dict]:
        convo: List[dict] = [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role in ("user", "assistant")
        ]
        while convo and convo[0]["role"] == "assistant":
            convo.pop(0)
        if not convo or convo[-1]["role"] != "user":
            return convo

        context_block = self._format_context(retrieved)
        scope_note = (
            f"The student scoped this question to the document "
            f"'{source_filename}'.\n\n"
            if scoped and source_filename
            else ""
        )
        question = convo[-1]["content"]
        convo[-1]["content"] = (
            f"{scope_note}"
            "-- CONTEXT REFERENCE BLOCKS --\n"
            f"{context_block}\n"
            "-- END CONTEXT REFERENCE BLOCKS --\n\n"
            f"Question: {question}"
        )
        return convo

    @staticmethod
    def _format_context(retrieved: List[RetrievedChunk]) -> str:
        if not retrieved:
            return "(No relevant passages were retrieved from the student's materials.)"
        return "\n\n".join(
            f"[Block {i}] {chunk.text}" for i, chunk in enumerate(retrieved, start=1)
        )

    def _mock_reply(
        self,
        query: str,
        references: List[str],
        scoped: bool,
        source_filename: Optional[str],
    ) -> str:
        if not query:
            return "Ask me anything about your uploaded study materials."

        if scoped:
            cite = f" ({source_filename})" if source_filename else ""
            grounding = (
                f" Relevant excerpt: \"{references[0]}\"" if references else
                " No matching passage was found in this document."
            )
            return (
                f"Answering based on your selected document source{cite}: "
                f"here is an explanation for \"{query}\".{grounding}"
            )

        grounding = (
            f" Based on your library: \"{references[0]}\"" if references else ""
        )
        return (
            f"Here's a concise explanation for \"{query}\".{grounding} "
            f"(generated by the {self.provider} orchestrator — mock mode)."
        )


# --------------------------------------------------------------------------
# Parsing helpers
# --------------------------------------------------------------------------
def _extract_json_array(text: str) -> str:
    """Best-effort extraction of the JSON array from a model response.

    Tolerates markdown fences or stray prose by slicing between the first '['
    and the last ']'.
    """
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return text


def _parse_flashcards(data: list, limit: int) -> List[FlashcardItem]:
    cards: List[FlashcardItem] = []
    for raw in data[:limit]:
        if not isinstance(raw, dict):
            continue
        front = str(raw.get("front_prompt", "")).strip()
        back = str(raw.get("back_answer", "")).strip()
        if front and back:
            cards.append(
                FlashcardItem(id=str(uuid.uuid4()), front_prompt=front, back_answer=back)
            )
    return cards


def _parse_questions(data: list, limit: int, topic: str) -> List[QuizQuestionItem]:
    questions: List[QuizQuestionItem] = []
    for raw in data[:limit]:
        if not isinstance(raw, dict):
            continue
        question = str(raw.get("question", "")).strip()
        options = [str(o).strip() for o in raw.get("options", []) if str(o).strip()]
        if not question or len(options) < 2:
            continue
        idx = raw.get("correct_index", 0)
        if not isinstance(idx, int) or idx < 0 or idx >= len(options):
            idx = 0
        tag = str(raw.get("topic_tag", "")).strip() or topic
        questions.append(
            QuizQuestionItem(
                id=str(uuid.uuid4()),
                question=question,
                options=options,
                correct_index=idx,
                topic_tag=tag,
            )
        )
    return questions


def _topic_from_title(title: str) -> str:
    stem = title.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip()
    return stem.title() or "General Knowledge"


# Process-wide singleton.
orchestrator = AIOrchestrator()
