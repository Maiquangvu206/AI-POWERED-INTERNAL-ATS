import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CopilotRequestDto } from './dto/copilot.dto';

const COPILOT_TIMEOUT_MS = 60_000;

interface AiCopilotResponse {
  questions?: string[];
  llm_used?: boolean;
  fallback_used?: boolean;
}

export interface CopilotResult {
  questions: string[];
  llmUsed: boolean;
  fallbackUsed: boolean;
  missingSkills: string[];
}

/**
 * Proxy sang AI Service (US-08).
 *
 * Skill gap lấy từ `ai_match_breakdown` đã lưu khi chấm CV — không gọi lại model
 * embedding, nên phản hồi nhanh và nhất quán với điểm đã công bố.
 */
@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async generate(dto: CopilotRequestDto): Promise<CopilotResult> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: dto.candidateId },
      select: {
        id: true,
        aiMatchBreakdown: true,
        aiParsedSkills: true,
        campaign: { select: { jdText: true, title: true } },
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Không tìm thấy ứng viên #${dto.candidateId}`);
    }

    const breakdown = (candidate.aiMatchBreakdown ?? {}) as {
      matched_skills?: string[];
      missing_skills?: string[];
    };
    const matched = Array.isArray(breakdown.matched_skills) ? breakdown.matched_skills : [];
    const missing = Array.isArray(breakdown.missing_skills) ? breakdown.missing_skills : [];

    const roundName = dto.roundId
      ? ((
          await this.prisma.round.findUnique({
            where: { id: dto.roundId },
            select: { roundName: true },
          })
        )?.roundName ?? null)
      : null;

    const questions = await this.callAi({
      candidate_id: candidate.id,
      round_name: roundName,
      jd_text: candidate.campaign.jdText,
      matched_skills: matched,
      missing_skills: missing,
      count: dto.count ?? 5,
    });

    return {
      questions: questions.questions ?? [],
      llmUsed: Boolean(questions.llm_used),
      fallbackUsed: Boolean(questions.fallback_used),
      missingSkills: missing,
    };
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
      this.logger.error(`Không gọi được AI Copilot (${baseUrl}): ${reason}`);
      throw new BadGatewayException(`Không gọi được AI Service: ${reason}`);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`AI Copilot trả HTTP ${response.status}: ${detail.slice(0, 300)}`);
      throw new BadGatewayException(
        `AI Service trả HTTP ${response.status}` + (detail ? `: ${detail.slice(0, 300)}` : ''),
      );
    }

    return (await response.json()) as AiCopilotResponse;
  }
}
