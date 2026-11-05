import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { CopilotRequestDto } from './dto/copilot.dto';

const COPILOT_TIMEOUT_MS = 60_000;
const COPILOT_CACHE_TTL_SECONDS = 24 * 60 * 60;
/** 10 request/giám khảo/giờ theo checklist Phase 5. */
const COPILOT_RATE_LIMIT_PER_HOUR = 10;
const MIN_SUGGESTIONS = 5;

const FORBIDDEN_PATTERN =
  /\b(tuổi|ngày sinh|năm sinh|tháng sinh|giới tính|nam hay nữ|hôn nhân|kết hôn|ly hôn|con cái|mang thai|sinh con|tôn giáo|tín ngưỡng|dân tộc|quốc tịch|quê quán|hộ khẩu|cmnd|cccd|căn cước|sức khỏe|bệnh lý|khuyết tật|chính trị|đảng phái)\b/i;

interface AiCopilotSuggestion {
  question?: string;
  rationale?: string;
  expected_signals?: string[];
}

interface AiCopilotResponse {
  suggestions?: AiCopilotSuggestion[];
  llm_used?: boolean;
  fallback_used?: boolean;
}

export interface CopilotSuggestion {
  question: string;
  rationale: string;
  expectedSignals: string[];
}

export interface CopilotResult {
  suggestions: CopilotSuggestion[];
  llmUsed: boolean;
  fallbackUsed: boolean;
  cached: boolean;
  missingSkills: string[];
}

interface CachedCopilot {
  suggestions: CopilotSuggestion[];
  llmUsed: boolean;
  fallbackUsed: boolean;
  missingSkills: string[];
}

/**
 * Proxy sang AI Service (US-08).
 *
 * Skill gap lấy từ `ai_match_breakdown` đã lưu khi chấm CV — không gọi lại model
 * embedding, nên phản hồi nhanh và nhất quán với điểm đã công bố.
 *
 * Cache Redis 24h theo (candidate_id, round_id) và rate limit theo giám khảo.
 */
@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async generate(dto: CopilotRequestDto, interviewerId: number): Promise<CopilotResult> {
    await this.assertRateLimit(interviewerId);

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: dto.candidateId },
      select: {
        id: true,
        aiMatchBreakdown: true,
        aiParsedSkills: true,
        campaign: { select: { id: true, jdText: true, title: true } },
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Không tìm thấy ứng viên #${dto.candidateId}`);
    }

    let roundName: string | null = null;
    if (dto.roundId) {
      const round = await this.prisma.round.findUnique({
        where: { id: dto.roundId },
        select: { roundName: true, campaignId: true },
      });

      if (!round || round.campaignId !== candidate.campaign.id) {
        throw new BadRequestException(
          `Vòng #${dto.roundId} không thuộc chiến dịch của ứng viên #${dto.candidateId}`,
        );
      }
      roundName = round.roundName;
    }

    const breakdown = (candidate.aiMatchBreakdown ?? {}) as {
      matched_skills?: string[];
      missing_skills?: string[];
    };
    const matched = Array.isArray(breakdown.matched_skills) ? breakdown.matched_skills : [];
    const missing = Array.isArray(breakdown.missing_skills) ? breakdown.missing_skills : [];
    const requested = dto.count ?? MIN_SUGGESTIONS;

    const cacheKey = `copilot:v1:${candidate.id}:${dto.roundId ?? 0}`;
    const cached = await this.redis.getJson<CachedCopilot>(cacheKey);
    if (cached) {
      return {
        ...cached,
        suggestions: cached.suggestions.slice(0, requested),
        cached: true,
      };
    }

    let result: CachedCopilot;
    try {
      const aiResponse = await this.callAi({
        candidate_id: candidate.id,
        round_name: roundName,
        jd_text: candidate.campaign.jdText,
        matched_skills: matched,
        missing_skills: missing,
        count: Math.max(requested, MIN_SUGGESTIONS),
      });

      const suggestions = this.normalize(aiResponse.suggestions ?? []);
      if (suggestions.length === 0) {
        throw new Error('AI Service không trả câu hỏi hợp lệ');
      }

      result = {
        suggestions,
        llmUsed: Boolean(aiResponse.llm_used),
        fallbackUsed: Boolean(aiResponse.fallback_used),
        missingSkills: missing,
      };
    } catch (error) {
      this.logger.warn(
        `AI Copilot lỗi, dùng template tĩnh: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      result = {
        suggestions: this.staticFallback(missing, Math.max(requested, MIN_SUGGESTIONS)),
        llmUsed: false,
        fallbackUsed: true,
        missingSkills: missing,
      };
    }

    // Cache cả fallback: tránh gọi AI Service liên tục khi LLM chưa cấu hình.
    await this.redis.setJson(cacheKey, result, COPILOT_CACHE_TTL_SECONDS);

    return {
      ...result,
      suggestions: result.suggestions.slice(0, requested),
      cached: false,
    };
  }

  private async assertRateLimit(interviewerId: number): Promise<void> {
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const key = `copilot:rate:${interviewerId}:${hourBucket}`;
    const count = await this.redis.incrementWindow(key, 3_600);

    if (count > COPILOT_RATE_LIMIT_PER_HOUR) {
      const resetIn = Math.max(1, await this.redis.ttl(key));
      throw new HttpException(
        `Bạn đã dùng ${COPILOT_RATE_LIMIT_PER_HOUR} lượt gợi ý/giờ. Thử lại sau ${Math.ceil(
          resetIn / 60,
        )} phút.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Bỏ câu hỏi vi phạm guardrail và chuẩn hoá snake_case → camelCase. */
  private normalize(items: AiCopilotSuggestion[]): CopilotSuggestion[] {
    return items
      .filter(
        (item): item is AiCopilotSuggestion & { question: string } =>
          typeof item.question === 'string' && item.question.trim().length >= 5,
      )
      .filter((item) => !this.isForbidden(`${item.question} ${item.rationale ?? ''}`))
      .map((item) => ({
        question: item.question.trim(),
        rationale:
          item.rationale?.trim() || 'Câu hỏi nhằm kiểm chứng kỹ năng liên quan trực tiếp đến JD.',
        expectedSignals: Array.isArray(item.expected_signals)
          ? item.expected_signals.filter((signal) => typeof signal === 'string').slice(0, 4)
          : [],
      }));
  }

  private isForbidden(text: string): boolean {
    return FORBIDDEN_PATTERN.test(text);
  }

  /** Template tĩnh khi AI Service chết — UI vẫn có câu hỏi để dùng ngay. */
  private staticFallback(skills: string[], count: number): CopilotSuggestion[] {
    const suggestions: CopilotSuggestion[] = [];

    for (const skill of skills) {
      if (suggestions.length >= count) break;
      suggestions.push({
        question: `Bạn đã từng xử lý tình huống thực tế nào liên quan đến ${skill}? Hãy mô tả bối cảnh, cách bạn làm và kết quả đo được.`,
        rationale: `${skill} được JD yêu cầu nhưng chưa thấy bằng chứng rõ ràng trong CV.`,
        expectedSignals: [
          `Hiểu khái niệm cốt lõi của ${skill}`,
          `Từng áp dụng ${skill} trong dự án thật`,
          'Nêu được trade-off và bài học kinh nghiệm',
        ],
      });
    }

    const generic: CopilotSuggestion[] = [
      {
        question:
          'Hãy kể về dự án gần nhất bạn trực tiếp phụ trách: vai trò, quyết định kỹ thuật quan trọng và kết quả cuối cùng.',
        rationale: 'Cần xác thực kinh nghiệm thực tế và mức độ sở hữu công việc.',
        expectedSignals: [
          'Mô tả rõ vai trò cá nhân',
          'Nêu được quyết định và trade-off',
          'Có kết quả định lượng',
        ],
      },
      {
        question:
          'Khi gặp một yêu cầu mơ hồ từ stakeholder, bạn làm rõ và chia nhỏ công việc như thế nào?',
        rationale: 'Đánh giá kỹ năng giao tiếp và tư duy phân rã vấn đề.',
        expectedSignals: [
          'Đặt câu hỏi làm rõ mục tiêu',
          'Chia nhỏ thành các bước kiểm chứng được',
          'Thống nhất tiêu chí hoàn thành',
        ],
      },
      {
        question:
          'Bạn đã từng phải bảo vệ một quyết định kỹ thuật trái ý đồng nghiệp chưa? Kết quả thế nào?',
        rationale: 'Đánh giá khả năng lập luận và cộng tác trong môi trường kỹ thuật.',
        expectedSignals: [
          'Trình bày dữ kiện thay vì cảm tính',
          'Lắng nghe phương án khác',
          'Rút ra kết luận dựa trên kết quả',
        ],
      },
    ];

    for (const item of generic) {
      if (suggestions.length >= count) break;
      suggestions.push(item);
    }

    return suggestions;
  }

  private async callAi(payload: Record<string, unknown>): Promise<AiCopilotResponse> {
    const baseUrl = this.config
      .get<string>('AI_SERVICE_URL', 'http://localhost:8010')
      .replace(/\/$/, '');

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const token = this.config.get<string>('AI_INTERNAL_TOKEN');
    if (token) headers['X-Internal-Token'] = token;

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/internal/v1/ai/copilot/questions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(COPILOT_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Không gọi được AI Service (${baseUrl}): ${reason}`);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `AI Service trả HTTP ${response.status}` + (detail ? `: ${detail.slice(0, 300)}` : ''),
      );
    }

    return (await response.json()) as AiCopilotResponse;
  }
}
