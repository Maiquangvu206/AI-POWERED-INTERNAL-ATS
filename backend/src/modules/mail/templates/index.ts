import { renderApplicationReceived } from './application-received';
import type { RenderedEmail } from './base';
import { renderFinalResult } from './final-result';
import { renderRoundResult } from './round-result';

export type EmailTemplate = 'application-received' | 'round-result' | 'final-result';

export type EmailTemplateData = Record<string, unknown>;

export function renderEmail(template: EmailTemplate, data: EmailTemplateData): RenderedEmail {
  switch (template) {
    case 'application-received':
      return renderApplicationReceived(data as never);
    case 'round-result':
      return renderRoundResult(data as never);
    case 'final-result':
      return renderFinalResult(data as never);
    default: {
      const exhaustive: never = template;
      throw new Error(`Template email không hỗ trợ: ${String(exhaustive)}`);
    }
  }
}
