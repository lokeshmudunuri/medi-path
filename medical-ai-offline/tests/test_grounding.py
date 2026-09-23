"""Grounding context + missing-information handling + chat service tests."""
from __future__ import annotations

from app.ai.llm.base import EXPLANATION_SYSTEM_PROMPT, LlmRequest
from app.ai.llm.mock_llm import MockLlmProvider
from app.domain.entities import Case
from app.parsing.extractor import MedicineExtractor
from app.medical.engine import MedicalEngine
from app.services.grounding import GroundingContextBuilder, INSUFFICIENT_MARKER
from app.services.validation import ResponseValidator


def build_case(ocr_text: str) -> Case:
    extractor = MedicineExtractor()
    engine = MedicalEngine()
    prescription = extractor.extract(ocr_text).prescription
    case = Case(name="grounding test")
    case.prescription = prescription
    case.analysis = engine.analyze(prescription)
    return case


def test_grounding_includes_medicines_and_engine():
    case = build_case("Tab Paracetamol 500 mg 1-1-1 for 5 days")
    builder = GroundingContextBuilder()
    context = builder.build(case)
    assert context["case_id"] == case.id
    assert context["medicines"][0]["name"] == "paracetamol"
    assert "safety_flags" in context
    rendered = builder.render(context)
    assert "MEDICINES" in rendered
    assert "paracetamol" in rendered


def test_grounding_marks_missing_info():
    case = build_case("Cap Zathrazorium 500 mg 1 bd for 3 days")
    builder = GroundingContextBuilder()
    context = builder.build(case)
    assert context["insufficient_mark"] == INSUFFICIENT_MARKER
    rendered = builder.render(context)
    assert INSUFFICIENT_MARKER in rendered


def test_grounding_includes_recent_chat_only():
    case = build_case("Tab Paracetamol 500 mg")
    builder = GroundingContextBuilder()
    chat = [{"role": "user", "content": f"q{i}"} for i in range(20)]
    context = builder.build(case, recent_chat=chat)
    assert len(context["previous_chat"]) <= 8


def test_mock_llm_obeys_missing_info():
    case = build_case("Cap Zathrazorium 500 mg 1 bd")
    builder = GroundingContextBuilder()
    context = builder.build(case, [])
    rendered = builder.render(context)
    provider = MockLlmProvider()
    response = provider.complete(
        LlmRequest(system=EXPLANATION_SYSTEM_PROMPT, messages=[{"role": "user", "content": rendered}])
    )
    assert "does not contain enough information" in response.text


def test_mock_llm_handles_normal_case():
    case = build_case("Tab Paracetamol 500 mg 1 tds")
    builder = GroundingContextBuilder()
    context = builder.build(case, [])
    rendered = builder.render(context)
    provider = MockLlmProvider()
    response = provider.complete(
        LlmRequest(system=EXPLANATION_SYSTEM_PROMPT, messages=[{"role": "user", "content": rendered}])
    )
    assert response.text


def test_response_validator_adds_missing_note():
    case = build_case("Tab Zathrazorium 500 mg 1 bd")
    validator = ResponseValidator()
    output = validator.validate("I am not sure about this.", case.analysis)
    assert "does not contain enough information" in output.lower()
    assert validator.added_missing_note is True


def test_response_validator_no_missing_note_when_present():
    case = build_case("Tab Zathrazorium 500 mg 1 bd")
    validator = ResponseValidator()
    output = validator.validate(
        "The local medical database does not contain enough information to answer this.",
        case.analysis,
    )
    assert validator.added_missing_note is False


def test_validation_appends_critical_safety():
    case = build_case("Tab Ibuprofen 400 mg 1 tds x 7 days\nTab Aspirin 75 mg 1 od")
    validator = ResponseValidator()
    output = validator.validate("Here is some general advice about your medicines.", case.analysis)
    assert "Safety alert" in output or "not contain enough" in output


def test_chat_service_stores_and_answers(chat_service, fresh_db):
    repo = fresh_db["cases"]
    from tests.test_case_repository import make_case

    case = make_case()
    repo.create(case)
    reply = chat_service.send_text(case.id, "How do I take this?")
    assert reply.role == "assistant"
    history = chat_service.history(case.id)
    assert len(history) == 2
    assert history[0].content == "How do I take this?"
    assert history[1].content == reply.content


def test_chat_service_missing_case_raises(chat_service):
    try:
        chat_service.send_text("nope", "hello")
        assert False, "should raise"
    except LookupError:
        pass


def test_voice_chat_pipeline(chat_service, fresh_db, tmp_path):
    """Voice -> STT -> same grounded pipeline -> TTS -> stored."""
    import wave

    from tests.test_case_repository import make_case

    repo = fresh_db["cases"]
    case = make_case()
    repo.create(case)

    audio_path = tmp_path / "voice.wav"
    mock_stt_wav(audio_path)
    reply = chat_service.send_voice(case.id, str(audio_path))
    assert reply.content
    history = chat_service.history(case.id)
    assert history[0].input_kind == "voice"
    assert history[-1].role == "assistant"
    assert history[-1].content == reply.content


def mock_stt_wav(path):
    import math
    import struct
    import wave

    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        for i in range(1600):
            wav.writeframes(struct.pack("<h", int(4000 * math.sin(2 * math.pi * 300 * i / 16000))))