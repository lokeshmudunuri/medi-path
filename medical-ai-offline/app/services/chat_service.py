"""Text + voice chat service.

Text and voice share the SAME grounded pipeline:

    message -> case context -> grounding builder -> local LLM
    -> validator -> stored chat message

Voice only adds local Speech-to-Text at the front and local Text-to-Speech at
the end, so text and voice can never give different medical answers.
"""
from __future__ import annotations

from pathlib import Path

from app.ai.engine import LocalAIEngine, engine as default_engine
from app.ai.llm.base import EXPLANATION_SYSTEM_PROMPT, LlmRequest, LlmUnavailableError
from app.core.storage import storage
from app.data.repositories.case_repository import CaseRepository
from app.data.repositories.chat_repository import ChatRepository
from app.domain.entities import Case, ChatMessage
from app.domain.enums import InfoSource, MessageRole
from app.services.grounding import GroundingContextBuilder, grounding_builder
from app.services.validation import ResponseValidator
from app.utils.logging import get_logger

log = get_logger("services.chat")


class ChatService:
    def __init__(
        self,
        case_repo: CaseRepository,
        chat_repo: ChatRepository,
        ai: LocalAIEngine = default_engine,
        grounding: GroundingContextBuilder = grounding_builder,
    ) -> None:
        self.case_repo = case_repo
        self.chat_repo = chat_repo
        self.ai = ai
        self.grounding = grounding

    # -------------------------------------------------------------- text
    def send_text(self, case_id: str, user_text: str) -> ChatMessage:
        case = self._case(case_id)
        user_message = ChatMessage(
            case_id=case_id,
            role=MessageRole.USER.value,
            content=user_text,
            source=InfoSource.USER.value,
            input_kind="text",
        )
        self.chat_repo.add_message(user_message)
        reply = self._generate_reply(case)
        self.chat_repo.add_message(reply)
        return reply

    # -------------------------------------------------------------- voice
    def send_voice(self, case_id: str, audio_path: str) -> ChatMessage:
        case = self._case(case_id)
        stt = self.ai.transcribe(audio_path)
        transcript = stt.text
        user_message = ChatMessage(
            case_id=case_id,
            role=MessageRole.USER.value,
            content=transcript,
            source=InfoSource.USER.value,
            input_kind="voice",
            media_path=audio_path,
        )
        self.chat_repo.add_message(user_message)
        reply = self._generate_reply(case)
        self.chat_repo.add_message(reply)
        if reply.content:
            audio_out = storage.case_audio_path(case_id, reply.id)
            try:
                tts = self.ai.synthesize(reply.content, str(audio_out))
                reply.media_path = tts.audio_path
                self.chat_repo.update_media(reply.id, reply.media_path)
            except Exception as exc:
                log.warning("TTS unavailable for case %s: %s", case_id, exc)
        return reply

    # ------------------------------------------------------------- internals
    def _generate_reply(self, case: Case) -> ChatMessage:
        recent = [m.to_dict() for m in self.chat_repo.list_messages(case.id)[-8:]]
        context = self.grounding.build(case, recent)
        rendered = self.grounding.render(context)
        user_pan = "\n\n" + self._last_user_text(recent) if self._last_user_text(recent) else ""
        prompt = rendered + user_pan

        try:
            provider = self.ai.get_llm_provider()
            request = LlmRequest(
                system=EXPLANATION_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            llm_response = provider.complete(request)
            raw = llm_response.text
        except LlmUnavailableError:
            raw = (
                "The local AI model is not installed. Open Settings > Models to install "
                "the offline language model before chatting. Meanwhile, the case summary "
                "above reflects the local medical engine."
            )
        reply = ChatMessage(
            case_id=case.id,
            role=MessageRole.ASSISTANT.value,
            content=raw,
            source=InfoSource.LLM.value,
            input_kind="text",
        )
        validator = ResponseValidator()
        reply.content = validator.validate(raw, case.analysis)
        return reply

    @staticmethod
    def _last_user_text(recent: list[dict]) -> str:
        for message in reversed(recent):
            if message.get("role") == MessageRole.USER.value:
                return message.get("content", "")
        return ""

    def history(self, case_id: str) -> list[ChatMessage]:
        return self.chat_repo.list_messages(case_id)

    def _case(self, case_id: str) -> Case:
        case = self.case_repo.get(case_id)
        if case is None:
            raise LookupError(f"Case not found: {case_id}")
        return case