"""End-to-end integration: image -> OCR -> extraction -> engine -> case -> chat.

Uses the mock AI providers configured in conftest (LOCALMED_FORCE_MOCK=1) so
the whole pipeline runs deterministically and offline.
"""
from __future__ import annotations

import io

from PIL import Image


def _sample_image(name: str) -> bytes:
    image = Image.new("RGB", (140, 80), "white")
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def test_full_pipeline_creates_case(case_service, fresh_db, tmp_path):
    """paracetamol_sample.jpg routes the mock OCR to the paracetamol sample."""
    image_path = tmp_path / "paracetamol_sample.jpg"
    image_path.write_bytes(_sample_image("paracetamol_sample"))
    case = case_service.create_from_image(
        image_path.read_bytes(), name="Sample script", original_filename=image_path.name
    )

    assert case.name
    assert case.prescription.medicines, "medicine extraction should find paracetamol"
    med = case.prescription.medicines[0]
    assert "paracetamol" in med.name
    assert med.frequency  # three times a day
    assert case.prescription.ocr_engine == "mock"
    assert case.analysis.medicine_information, "engine should provide medicine info"
    assert case.engine_version

    # Stored and retrievable through the repository layer.
    stored = fresh_db["cases"].get(case.id)
    assert stored is not None
    assert stored.name == case.name


def test_full_pipeline_low_confidence_image_flags_verification(case_service, fresh_db, tmp_path):
    """An unnamed image yields low OCR confidence -> medicines need verification."""
    image_path = tmp_path / "random_photo.jpg"
    image_path.write_bytes(_sample_image("random_photo"))
    case = case_service.create_from_image(
        image_path.read_bytes(), name="blurry", original_filename=image_path.name
    )
    assert case.prescription.ocr_confidence <= 0.6
    if case.prescription.medicines:
        assert any(m.needs_verification for m in case.prescription.medicines)


def test_chat_grounded_in_case(case_service, chat_service, fresh_db, tmp_path):
    image_path = tmp_path / "paracetamol_sample.jpg"
    image_path.write_bytes(_sample_image("paracetamol_sample"))
    case = case_service.create_from_image(
        image_path.read_bytes(), original_filename=image_path.name
    )

    reply = chat_service.send_text(case.id, "What did my doctor write?")
    assert reply.role == "assistant"
    assert reply.content

    # Second message uses the same grounded context.
    reply2 = chat_service.send_text(case.id, "Any interactions with this?")
    assert reply2.content


def test_voice_uses_same_pipeline(case_service, chat_service, fresh_db, tmp_path):
    image_path = tmp_path / "paracetamol_sample.jpg"
    image_path.write_bytes(_sample_image("paracetamol_sample"))
    case = case_service.create_from_image(
        image_path.read_bytes(), original_filename=image_path.name
    )

    audio_path = tmp_path / "spoken.wav"

    import math
    import struct
    import wave

    with wave.open(str(audio_path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        for i in range(2400):
            wav.writeframes(struct.pack("<h", int(3000 * math.sin(2 * math.pi * 400 * i / 16000))))

    reply = chat_service.send_voice(case.id, str(audio_path))
    history = chat_service.history(case.id)
    assert history[0].input_kind == "voice"
    assert reply.content
    # The assistant audio, if produced by a provider, is referenced.
    # (With the mock TTS a file is written; with platform TTS it may not be.)
    reply_record = next(m for m in history if m.role == "assistant")
    assert reply_record.content == reply.content


def test_request_response_validator_guards_hallucination(case_service, fresh_db, tmp_path):
    from app.services.validation import ResponseValidator

    image_path = tmp_path / "paracetamol_sample.jpg"
    image_path.write_bytes(_sample_image("paracetamol_sample"))
    case = case_service.create_from_image(
        image_path.read_bytes(), original_filename=image_path.name
    )
    validator = ResponseValidator()
    output = validator.validate("This medicine will definitely cure you.", case.analysis)
    assert "not contain enough information" not in output  # known med, no missing info