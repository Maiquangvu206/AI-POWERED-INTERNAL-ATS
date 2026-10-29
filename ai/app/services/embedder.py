"""Embedding local bằng `bge-m3`.

Model được load **một lần** (lazy) và giữ trong bộ nhớ. Nếu chưa cài
`sentence-transformers`, chưa tải được model, hoặc `EMBEDDING_ENABLED=false`,
matcher tự chuyển sang lexical fallback thay vì làm hỏng job.
"""

import logging
import math
import threading
from collections import Counter
from typing import Any

from app.settings import Settings

logger = logging.getLogger(__name__)


class Embedder:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._model: Any = None
        self._failed = False
        self._lock = threading.Lock()

    @property
    def loaded(self) -> bool:
        return self._model is not None

    @property
    def available(self) -> bool:
        return self._settings.embedding_enabled and not self._failed

    def ensure_loaded(self) -> bool:
        """Load model nếu cần. Trả `True` khi sẵn sàng."""
        if self._model is not None:
            return True
        if not self.available:
            return False

        with self._lock:
            if self._model is not None:
                return True
            if self._failed:
                return False

            try:
                from sentence_transformers import SentenceTransformer

                logger.info("Đang load embedding model %s…", self._settings.embedding_model)
                model = SentenceTransformer(self._settings.embedding_model)
                model.max_seq_length = self._settings.embedding_max_length
                self._model = model
                logger.info("Load embedding model xong")
                return True
            except Exception as error:
                self._failed = True
                logger.warning(
                    "Không load được embedding model (%s) — dùng lexical fallback",
                    error,
                )
                return False

    def encode(self, texts: list[str]) -> list[list[float]] | None:
        if not texts or not self.ensure_loaded():
            return None

        try:
            vectors = self._model.encode(
                texts,
                normalize_embeddings=True,
                batch_size=8,
                show_progress_bar=False,
            )
            return [list(map(float, vector)) for vector in vectors]
        except Exception as error:
            logger.warning("Encode thất bại: %s", error)
            return None


def cosine(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0

    dot = sum(a * b for a, b in zip(left, right, strict=True))
    norm_left = math.sqrt(sum(value * value for value in left))
    norm_right = math.sqrt(sum(value * value for value in right))

    if norm_left == 0 or norm_right == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (norm_left * norm_right)))


def lexical_cosine(left: str, right: str) -> float:
    """Fallback không cần model: cosine trên tần suất token."""
    left_tokens = _tokens(left)
    right_tokens = _tokens(right)
    if not left_tokens or not right_tokens:
        return 0.0

    intersection = set(left_tokens) & set(right_tokens)
    numerator = sum(left_tokens[token] * right_tokens[token] for token in intersection)
    denominator = math.sqrt(sum(value**2 for value in left_tokens.values())) * math.sqrt(
        sum(value**2 for value in right_tokens.values())
    )

    if denominator == 0:
        return 0.0
    return max(0.0, min(1.0, numerator / denominator))


def _tokens(text: str) -> Counter[str]:
    words = [word for word in text.lower().split() if len(word) > 1]
    return Counter(words)
