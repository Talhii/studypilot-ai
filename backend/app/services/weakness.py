"""Automated exam grading + weakness-detection math.

Compares submitted answers (question id -> selected option index) against the
stored answer key, computes fractional per-topic mastery percentages, and emits
remediation rows for any topic below the weakness threshold. Empty-array safe:
an exam with no stored questions grades to a zeroed result rather than raising.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, List

from app.models.schemas import ExamResultResponse, QuizQuestionItem

# A topic scoring below this percentage is surfaced as a weakness.
WEAKNESS_THRESHOLD: float = 60.0


def grade_exam(
    questions: List[QuizQuestionItem], answers: Dict[str, int]
) -> ExamResultResponse:
    """Grade a submission and build per-topic mastery + remediation rows."""
    total = len(questions)
    if total == 0:
        return ExamResultResponse(
            score=0.0,
            total_questions=0,
            topic_mastery={},
            weakness_recommendations=[],
        )

    # tallies[topic_tag] = [correct, attempted]
    tallies: Dict[str, List[int]] = defaultdict(lambda: [0, 0])
    correct_total = 0

    for question in questions:
        selected = answers.get(question.id)
        is_correct = selected is not None and selected == question.correct_index
        tallies[question.topic_tag][1] += 1
        if is_correct:
            tallies[question.topic_tag][0] += 1
            correct_total += 1

    topic_mastery: Dict[str, float] = {}
    recommendations: List[str] = []
    for topic, (correct, attempts) in sorted(tallies.items()):
        pct = (correct / attempts * 100.0) if attempts else 0.0
        topic_mastery[topic] = round(pct, 1)
        if pct < WEAKNESS_THRESHOLD:
            recommendations.append(
                f"Revisit '{topic}': you answered {correct}/{attempts} correctly "
                f"({round(pct)}%). Review the related sections and retake the exam."
            )

    score = round(correct_total / total * 100.0, 1)
    return ExamResultResponse(
        score=score,
        total_questions=total,
        topic_mastery=topic_mastery,
        weakness_recommendations=recommendations,
    )
