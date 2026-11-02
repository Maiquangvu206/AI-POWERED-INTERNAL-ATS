import { z } from 'zod';

/**
 * Vai trò người dùng nội bộ.
 * Ứng viên KHÔNG có tài khoản (xem SRS mục 2), nên không có role CANDIDATE.
 */
export const Role = {
  ADMIN: 'ADMIN',
  INTERVIEWER: 'INTERVIEWER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const RoleSchema = z.nativeEnum(Role);

/** Trạng thái chiến dịch tuyển dụng. */
export const CampaignStatus = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;

export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const CampaignStatusSchema = z.nativeEnum(CampaignStatus);

/** Trạng thái vòng thi. `LOCKED` là điều kiện duy nhất để unblind điểm (ADR-02). */
export const RoundStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  LOCKED: 'LOCKED',
} as const;

export type RoundStatus = (typeof RoundStatus)[keyof typeof RoundStatus];

export const RoundStatusSchema = z.nativeEnum(RoundStatus);

/** Kết quả cuối cùng của hồ sơ. */
export const FinalStatus = {
  PENDING: 'PENDING',
  PASSED: 'PASSED',
  REJECTED: 'REJECTED',
} as const;

export type FinalStatus = (typeof FinalStatus)[keyof typeof FinalStatus];

export const FinalStatusSchema = z.nativeEnum(FinalStatus);

/**
 * Mã tra cứu hồ sơ (ADR-04) — entropy cao để chống IDOR.
 * Định dạng: APP-YYYY-XXXX, trong đó X là chữ IN HOA hoặc số.
 * @example "APP-2026-A89X"
 */
export const TRACKING_CODE_REGEX = /^APP-\d{4}-[A-Z0-9]{4}$/;

export const TrackingCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(TRACKING_CODE_REGEX, 'Mã tra cứu không hợp lệ (định dạng APP-YYYY-XXXX)');

/** Payload tối thiểu để nộp hồ sơ ở Public Portal (US-03). */
export const ApplyFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(100),
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)\d{9,10}$/, 'Số điện thoại không hợp lệ'),
});

export type ApplyFormInput = z.infer<typeof ApplyFormSchema>;

/** Giới hạn upload CV — dùng chung cho client và server. */
export const CV_UPLOAD_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  mimeType: 'application/pdf',
  /** 4 byte đầu của mọi file PDF hợp lệ. */
  magicBytes: [0x25, 0x50, 0x44, 0x46] as const,
} as const;

/** Một dòng điểm trong phiếu đánh giá (US-05). */
export const EvaluationScoreSchema = z.object({
  criterionId: z.number().int().positive(),
  score: z.number().min(0).max(100),
  comment: z.string().trim().max(1000).optional(),
});

export type EvaluationScoreInput = z.infer<typeof EvaluationScoreSchema>;

/** Payload nộp phiếu đánh giá — dùng chung FE/BE. */
export const EvaluationInputSchema = z.object({
  roundId: z.number().int().positive(),
  candidateId: z.number().int().positive(),
  generalNotes: z.string().trim().max(5000).optional(),
  scores: z.array(EvaluationScoreSchema).min(1).max(100),
});

export type EvaluationInput = z.infer<typeof EvaluationInputSchema>;

/** Ngưỡng cảnh báo lệch điểm giữa giám khảo (thang 0–100). */
export const OUTLIER_SCORE_GAP = 3;
