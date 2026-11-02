#!/usr/bin/env node
/**
 * Smoke test bảo mật Blind Scoring (US-06) — gọi thẳng API, bỏ qua UI.
 *
 * Cách dùng (PowerShell):
 *   $env:API_BASE="http://localhost:3000/api/v1"
 *   $env:ROUND_ID="3"
 *   $env:TOKEN_A="<JWT của reviewer1>"
 *   $env:TOKEN_B="<JWT của reviewer2>"
 *   node backend/scripts/blind-scoring-smoke.mjs
 *
 * Kịch bản:
 *   1. Mỗi giám khảo gọi GET /rounds/:id/scores.
 *   2. Không response nào được chứa phiếu của người kia.
 *   3. Response blind không được chứa danh tính giám khảo (`interviewer`).
 *   4. Nếu vòng đã LOCKED, script báo bỏ qua vì unblind là hành vi đúng.
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const ROUND_ID = process.env.ROUND_ID;
const TOKEN_A = process.env.TOKEN_A;
const TOKEN_B = process.env.TOKEN_B;

if (!ROUND_ID || !TOKEN_A || !TOKEN_B) {
  console.error('Thiếu biến môi trường ROUND_ID / TOKEN_A / TOKEN_B');
  process.exit(2);
}

async function scores(token) {
  const response = await fetch(`${API_BASE}/rounds/${ROUND_ID}/scores`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`GET /rounds/${ROUND_ID}/scores → HTTP ${response.status}`);
  }
  const body = await response.json();
  return body.data;
}

function failures(label, payload, otherIds) {
  const problems = [];

  if (payload.round.status === 'LOCKED') {
    console.log(`⚠️  ${label}: vòng đã LOCKED (unblind hợp lệ) — bỏ qua kiểm tra blind`);
    return problems;
  }

  if (payload.blind !== true) {
    problems.push(`${label}: cờ blind phải là true khi vòng chưa LOCKED`);
  }

  for (const evaluation of payload.evaluations) {
    if (otherIds.has(evaluation.id)) {
      problems.push(`${label}: nhìn thấy phiếu #${evaluation.id} của giám khảo khác`);
    }
    if ('interviewer' in evaluation && evaluation.interviewer) {
      problems.push(`${label}: response blind lộ danh tính giám khảo ở phiếu #${evaluation.id}`);
    }
  }

  return problems;
}

try {
  const [a, b] = await Promise.all([scores(TOKEN_A), scores(TOKEN_B)]);
  const idsA = new Set(a.evaluations.map((item) => item.id));
  const idsB = new Set(b.evaluations.map((item) => item.id));

  const problems = [...failures('reviewer A', a, idsB), ...failures('reviewer B', b, idsA)];

  if (problems.length > 0) {
    console.error('❌ Blind scoring bị rò rỉ:');
    for (const problem of problems) console.error(`   - ${problem}`);
    process.exit(1);
  }

  console.log(
    `✅ Blind scoring OK — A thấy ${idsA.size} phiếu, B thấy ${idsB.size} phiếu, không giao nhau.`,
  );
} catch (error) {
  console.error(`❌ Không chạy được smoke test: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
