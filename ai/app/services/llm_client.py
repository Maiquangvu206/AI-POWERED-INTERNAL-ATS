"""Adapter LLM — hiện dùng OpenAI-compatible API (mặc định `gpt-5.4-mini`).

Toàn bộ lời gọi đi qua lớp này để đổi provider (OpenAI / Azure / OpenRouter /
Ollama `/v1`) chỉ bằng biến môi trường `LLM_API_BASE` + `LLM_MODEL`.

Không có API key hoặc LLM lỗi → trả `None`; caller tự fallback heuristic.
"""

import json
import logging
from typing import Any

from app.settings import Settings

logger = logging.getLogger(__name__)


class LlmClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: Any = None

    @property
    def available(self) -> bool:
        return bool(self._settings.llm_api_key) and self._settings.llm_provider.lower() != "none"

    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client

        try:
            from openai import AsyncOpenAI
        except ImportError:
            logger.warning("Thiếu thư viện openai — dùng heuristic")
            self._client = False
            return self._client

        kwargs: dict[str, Any] = {
            "api_key": self._settings.llm_api_key,
            "timeout": self._settings.llm_timeout_ms / 1000,
        }
        if self._settings.llm_api_base:
            kwargs["base_url"] = self._settings.llm_api_base

        self._client = AsyncOpenAI(**kwargs)
        return self._client

    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> dict[str, Any] | None:
        """Gọi LLM và parse JSON. Trả `None` nếu không khả dụng / lỗi / JSON hỏng."""
        if not self.available:
            return None

        client = self._get_client()
        if not client:
            return None

        attempts = max(1, self._settings.llm_max_retries + 1)
        last_error: str | None = None

        for attempt in range(1, attempts + 1):
            try:
                response = await client.chat.completions.create(
                    model=self._settings.llm_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format={"type": "json_object"},
                    max_completion_tokens=2048,
                )
                content = response.choices[0].message.content or ""
                return _parse_json(content)
            except Exception as error:
                last_error = str(error)
                logger.warning(
                    "LLM call thất bại (lần %s/%s): %s", attempt, attempts, last_error
                )

        return None

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str | None:
        if not self.available:
            return None

        client = self._get_client()
        if not client:
            return None

        try:
            response = await client.chat.completions.create(
                model=self._settings.llm_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=1024,
            )
            return (response.choices[0].message.content or "").strip() or None
        except Exception as error:
            logger.warning("LLM text call thất bại: %s", error)
            return None


def _parse_json(content: str) -> dict[str, Any] | None:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.removeprefix("json").strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("LLM trả JSON không hợp lệ")
        return None

    return parsed if isinstance(parsed, dict) else None
