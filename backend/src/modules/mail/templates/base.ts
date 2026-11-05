export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Escape mọi dữ liệu do người dùng nhập trước khi chèn vào HTML email. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function baseLayout(options: {
  title: string;
  preheader: string;
  heading: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;color:#1f2937;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
            <tr>
              <td style="background:#2563eb;padding:22px 28px;color:#ffffff;">
                <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;">AI-Powered Internal ATS</div>
                <h1 style="margin:6px 0 0;font-size:22px;line-height:1.3;">${escapeHtml(options.heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;font-size:15px;line-height:1.65;">
                ${options.body}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">
                Email tự động từ hệ thống tuyển dụng nội bộ. Vui lòng không trả lời trực tiếp email này.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function paragraph(content: string): string {
  return `<p style="margin:0 0 14px;">${content}</p>`;
}

export function button(href: string, label: string): string {
  return `<p style="margin:22px 0 8px;">
    <a href="${escapeHtml(href)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px;">${escapeHtml(label)}</a>
  </p>`;
}

export function badge(content: string, tone: 'success' | 'danger' | 'info'): string {
  const colors = {
    success: { background: '#dcfce7', color: '#166534' },
    danger: { background: '#fee2e2', color: '#991b1b' },
    info: { background: '#dbeafe', color: '#1e40af' },
  }[tone];

  return `<span style="display:inline-block;background:${colors.background};color:${colors.color};font-size:13px;font-weight:bold;padding:6px 12px;border-radius:999px;">${escapeHtml(content)}</span>`;
}
