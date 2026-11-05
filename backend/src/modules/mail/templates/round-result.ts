import { badge, baseLayout, button, escapeHtml, paragraph, type RenderedEmail } from './base';

export interface RoundResultData {
  fullName: string;
  campaignTitle: string;
  roundName: string;
  nextRoundName: string | null;
  trackingUrl: string;
}

export function renderRoundResult(data: RoundResultData): RenderedEmail {
  const subject = `Kết quả vòng ${data.roundName} — ${data.campaignTitle}`;
  const nextStep = data.nextRoundName
    ? `Bạn được chuyển sang vòng tiếp theo: <strong>${escapeHtml(data.nextRoundName)}</strong>. Bộ phận tuyển dụng sẽ liên hệ để sắp xếp lịch.`
    : 'Bộ phận tuyển dụng sẽ liên hệ với bạn về các bước tiếp theo.';

  const body = [
    paragraph(`Xin chào <strong>${escapeHtml(data.fullName)}</strong>,`),
    paragraph(
      `Hồ sơ của bạn cho vị trí <strong>${escapeHtml(data.campaignTitle)}</strong> đã có kết quả vòng <strong>${escapeHtml(
        data.roundName,
      )}</strong>.`,
    ),
    `<p style="margin:0 0 16px;">${badge('Đạt yêu cầu', 'success')}</p>`,
    paragraph(nextStep),
    button(data.trackingUrl, 'Xem trạng thái hồ sơ'),
  ].join('');

  return {
    subject,
    html: baseLayout({
      title: subject,
      preheader: `Kết quả vòng ${data.roundName} cho vị trí ${data.campaignTitle}.`,
      heading: 'Kết quả vòng phỏng vấn',
      body,
    }),
    text: [
      `Xin chào ${data.fullName},`,
      `Hồ sơ cho vị trí ${data.campaignTitle} đã có kết quả vòng ${data.roundName}: Đạt yêu cầu.`,
      nextStep.replace(/<[^>]+>/g, ''),
      `Xem trạng thái: ${data.trackingUrl}`,
    ].join('\n'),
  };
}
