import { badge, baseLayout, button, escapeHtml, paragraph, type RenderedEmail } from './base';

export type FinalResultStatus = 'PASSED' | 'REJECTED';

export interface FinalResultData {
  fullName: string;
  campaignTitle: string;
  status: FinalResultStatus;
  trackingUrl: string;
}

export function renderFinalResult(data: FinalResultData): RenderedEmail {
  const passed = data.status === 'PASSED';
  const subject = passed
    ? `Kết quả ứng tuyển — ${data.campaignTitle}`
    : `Thông báo kết quả ứng tuyển — ${data.campaignTitle}`;

  const body = [
    paragraph(`Xin chào <strong>${escapeHtml(data.fullName)}</strong>,`),
    `<p style="margin:0 0 16px;">${badge(
      passed ? 'Chúc mừng — bạn đã trúng tuyển' : 'Chưa phù hợp lần này',
      passed ? 'success' : 'danger',
    )}</p>`,
    paragraph(
      passed
        ? `Chúc mừng bạn đã trúng tuyển vị trí <strong>${escapeHtml(
            data.campaignTitle,
          )}</strong>. Bộ phận tuyển dụng sẽ liên hệ để trao đổi về thủ tục tiếp theo.`
        : `Cảm ơn bạn đã dành thời gian ứng tuyển vị trí <strong>${escapeHtml(
            data.campaignTitle,
          )}</strong>. Sau khi cân nhắc kỹ, chúng tôi chưa thể tiếp tục với hồ sơ của bạn ở lần tuyển dụng này.`,
    ),
    paragraph(
      passed
        ? 'Mong sớm được chào đón bạn gia nhập đội ngũ.'
        : 'Chúng tôi trân trọng sự quan tâm của bạn và chúc bạn nhiều thành công trong hành trình sự nghiệp.',
    ),
    button(data.trackingUrl, 'Xem trạng thái hồ sơ'),
  ].join('');

  return {
    subject,
    html: baseLayout({
      title: subject,
      preheader: passed
        ? `Bạn đã trúng tuyển vị trí ${data.campaignTitle}.`
        : `Kết quả ứng tuyển vị trí ${data.campaignTitle}.`,
      heading: 'Kết quả ứng tuyển',
      body,
    }),
    text: [
      `Xin chào ${data.fullName},`,
      passed
        ? `Chúc mừng bạn đã trúng tuyển vị trí ${data.campaignTitle}.`
        : `Cảm ơn bạn đã ứng tuyển vị trí ${data.campaignTitle}. Rất tiếc hồ sơ chưa phù hợp lần này.`,
      `Xem trạng thái: ${data.trackingUrl}`,
    ].join('\n'),
  };
}
