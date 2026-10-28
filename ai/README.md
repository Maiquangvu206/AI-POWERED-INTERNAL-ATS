# AI — AI Service (FastAPI)

Microservice Python xử lý **mọi tác vụ nặng về CPU/ML**, tách khỏi Node.js để không chặn Event Loop ([ADR-0001](../docs/adr/0001-ai-service-separation.md)).

## Trách nhiệm

| Việc | User Story | Phase |
|---|---|---|
| Bóc tách text từ PDF (kèm OCR fallback) | US-04 | 3 |
| Trích xuất kỹ năng / kinh nghiệm có cấu trúc | US-04 | 3 |
| Tính điểm tương đồng CV ↔ JD (hybrid matching) | US-04 | 3 |
| Sinh câu hỏi phỏng vấn từ khoảng trống kỹ năng | US-08 | 5 |

## Chạy

```bash
cd ai

# Lần đầu: tạo môi trường ảo
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # macOS/Linux

pip install -e ".[dev]"

# Chạy (từ thư mục gốc repo)
npm run dev:ai                    # http://localhost:8010
```

> Cổng mặc định là **8010** vì 8000 đã bị dịch vụ khác chiếm trên máy dev — xem [DECISIONS §5](../docs/DECISIONS.md).

## Cấu trúc

```
ai/
├── app/
│   ├── main.py          # FastAPI app + /health
│   ├── settings.py      # cấu hình đọc từ .env (Pydantic Settings)
│   └── __init__.py
├── tests/
│   └── test_health.py
└── pyproject.toml       # deps, ruff, mypy, pytest
```

Từ Phase 3 sẽ mở rộng thành:

```
app/
├── main.py
├── settings.py
├── routers/
│   ├── health.py
│   ├── analyze.py       # POST /internal/v1/ai/analyze
│   └── copilot.py       # POST /internal/v1/ai/copilot
├── services/
│   ├── extractor.py     # pdfplumber + OCR fallback
│   ├── profile.py       # trích xuất có cấu trúc (Pydantic)
│   ├── matcher.py       # hard match + semantic match
│   ├── embedder.py      # bge-m3
│   └── llm.py           # adapter LLM (openai / ollama)
└── schemas/             # Pydantic models dùng chung
```

## Quy ước

| Quy ước | Ghi chú |
|---|---|
| Mọi endpoint `/internal/*` phải kiểm tra `X-Internal-Token` | Không expose ra Internet |
| Mọi output AI phải qua Pydantic validate | LLM trả JSON hỏng → retry 1 lần → fallback heuristic |
| Không log nội dung CV | Chỉ log `candidate_id`, độ dài text, thời gian xử lý |
| Mask PII trước khi gửi LLM | Tuân thủ NĐ 13/2023/NĐ-CP |
| Model load 1 lần lúc khởi động | Không load trong request handler |

## Kiểm tra chất lượng

```bash
# Trong thư mục ai/ với venv đã activate
python -m pytest -q
python -m ruff check .
python -m mypy app
```
