import { baseLayout, button, escapeHtml, paragraph, type RenderedEmail } from './base';

export interface ApplicationReceivedData {
  fullName: string;
  campaignTitle: string;
  trackingCode: string;
  trackingUrl: string;
  submittedAt: string;
}

export function renderApplicationReceived(data: ApplicationReceivedData): RenderedEmail {
  const subject = `Đã nhận hồ sơ — ${data.campaignTitle}`;
  const body = [
    paragraph(`Xin chào <strong>${escapeHtml(data.fullName)}</strong>,`),
    paragraph(
      `Hệ thống đã nhận hồ sơ của bạn cho vị trí <strong>${escapeHtml(
        data.campaignTitle,
      )}</strong> lúc ${escapeHtml(data.submittedAt)}.`,
    ),
    paragraph('Mã theo dõi hồ sơ của bạn:'),
    `<p style="margin:0 0 14px;font-size:26px;letter-spacing:0.12em;font-weight:bold;color:#2563eb;">${escapeHtml(
      data.trackingCode,
    )}</p>`,
    paragraph(
      'Hãy lưu lại mã này. Bạn có thể tra cứu trạng thái hồ sơ bất cứ lúc nào bằng mã theo dõi.',
    ),
    button(data.trackingUrl, 'Tra cứu trạng thái hồ sơ'),
    paragraph(
      '<span style="color:#64748b;font-size:13px;">Hồ sơ chỉ được sử dụng cho mục đích tuyển dụng và được bảo vệ theo Nghị định 13/2023/NĐ-CP.</span>',
    ),
  ].join('');

  return {
    subject,
    html: baseLayout({
      title: subject,
      preheader: `Đã nhận hồ sơ cho vị trí ${data.campaignTitle}.`,
      heading: 'Hồ sơ đã được ghi nhận',
      body,
    }),
    text: [
      `Xin chào ${data.fullName},`,
      `Hệ thống đã nhận hồ sơ của bạn cho vị trí ${data.campaignTitle} lúc ${data.submittedAt}.`,
      `Mã theo dõi hồ sơ: ${data.trackingCode}`,
      `Tra cứu trạng thái: ${data.trackingUrl}`,
      'Hồ sơ chỉ được sử dụng cho mục đích tuyển dụng.',
    ].join('\n'),
  };
}
