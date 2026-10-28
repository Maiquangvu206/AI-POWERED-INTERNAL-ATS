-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'INTERVIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'LOCKED');

-- CreateEnum
CREATE TYPE "FinalStatus" AS ENUM ('PENDING', 'PASSED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'INTERVIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "refresh_token_hash" VARCHAR(255),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "jd_text" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "round_name" VARCHAR(100) NOT NULL,
    "order_index" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'PENDING',
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criteria" (
    "id" SERIAL NOT NULL,
    "round_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "max_score" DECIMAL(5,2) NOT NULL,
    "weight" DECIMAL(4,3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "tracking_code" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "cv_file_url" VARCHAR(500) NOT NULL,
    "cv_file_hash" CHAR(64),
    "current_round_id" INTEGER,
    "ai_match_score" DECIMAL(5,2),
    "ai_parsed_skills" JSONB,
    "ai_match_breakdown" JSONB,
    "ai_processed_at" TIMESTAMPTZ(6),
    "ai_error" TEXT,
    "final_status" "FinalStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" SERIAL NOT NULL,
    "round_id" INTEGER NOT NULL,
    "candidate_id" INTEGER NOT NULL,
    "interviewer_id" INTEGER NOT NULL,
    "total_score" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "general_notes" TEXT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_details" (
    "id" SERIAL NOT NULL,
    "evaluation_id" INTEGER NOT NULL,
    "criterion_id" INTEGER NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "comment" VARCHAR(1000),

    CONSTRAINT "evaluation_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(50),
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_slug_key" ON "campaigns"("slug");

-- CreateIndex
CREATE INDEX "campaigns_status_start_date_idx" ON "campaigns"("status", "start_date");

-- CreateIndex
CREATE INDEX "rounds_campaign_id_status_idx" ON "rounds"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_campaign_id_order_index_key" ON "rounds"("campaign_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "criteria_round_id_title_key" ON "criteria"("round_id", "title");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_tracking_code_key" ON "candidates"("tracking_code");

-- CreateIndex
CREATE INDEX "candidates_campaign_id_ai_match_score_idx" ON "candidates"("campaign_id", "ai_match_score" DESC);

-- CreateIndex
CREATE INDEX "candidates_campaign_id_final_status_idx" ON "candidates"("campaign_id", "final_status");

-- CreateIndex
CREATE INDEX "candidates_current_round_id_idx" ON "candidates"("current_round_id");

-- CreateIndex
CREATE INDEX "candidates_email_idx" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "evaluations_candidate_id_round_id_idx" ON "evaluations"("candidate_id", "round_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_eval_per_round_candidate_interviewer" ON "evaluations"("round_id", "candidate_id", "interviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_details_evaluation_id_criterion_id_key" ON "evaluation_details"("evaluation_id", "criterion_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_current_round_id_fkey" FOREIGN KEY ("current_round_id") REFERENCES "rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_details" ADD CONSTRAINT "evaluation_details_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_details" ADD CONSTRAINT "evaluation_details_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Ràng buộc bổ sung không diễn đạt được bằng Prisma schema
-- =============================================================================

-- Rubric: weight phải nằm trong [0,1] để tổng = 1.00 là khả thi
-- (tổng đúng 1.00 kiểm tra ở tầng ứng dụng vì phụ thuộc nhiều dòng)
ALTER TABLE "criteria"
  ADD CONSTRAINT "chk_criteria_weight_range" CHECK ("weight" >= 0 AND "weight" <= 1),
  ADD CONSTRAINT "chk_criteria_max_score_positive" CHECK ("max_score" > 0);

-- Điểm số không được âm
ALTER TABLE "evaluation_details"
  ADD CONSTRAINT "chk_eval_detail_score_non_negative" CHECK ("score" >= 0);

ALTER TABLE "evaluations"
  ADD CONSTRAINT "chk_evaluation_total_non_negative" CHECK ("total_score" >= 0);

-- Điểm AI trong thang 0–100 (NULL = chưa xử lý hoặc xử lý lỗi)
ALTER TABLE "candidates"
  ADD CONSTRAINT "chk_candidate_ai_score_range"
  CHECK ("ai_match_score" IS NULL OR ("ai_match_score" >= 0 AND "ai_match_score" <= 100));

-- Chiến dịch: ngày kết thúc không trước ngày bắt đầu
ALTER TABLE "campaigns"
  ADD CONSTRAINT "chk_campaign_date_order" CHECK ("end_date" >= "start_date");

-- Vòng thi: order_index dương, bắt đầu từ 1
ALTER TABLE "rounds"
  ADD CONSTRAINT "chk_round_order_positive" CHECK ("order_index" > 0);

-- =============================================================================
-- Audit log là append-only (ADR-0007): chặn UPDATE/DELETE ở tầng DB.
-- Ngay cả khi có bug ở application layer cũng không thể sửa lịch sử.
-- =============================================================================
CREATE OR REPLACE FUNCTION "prevent_audit_log_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs là append-only: không cho phép % trên bảng này', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_audit_logs_no_update"
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "prevent_audit_log_mutation"();

CREATE TRIGGER "trg_audit_logs_no_delete"
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "prevent_audit_log_mutation"();
