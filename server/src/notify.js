import nodemailer from 'nodemailer';
const mail = nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
export const sendEmail = (to, subject, text) => mail.sendMail({ from: process.env.SMTP_USER, to, subject, text });

// Approved template message (required for OTPs in production).
// Authentication templates with a copy-code button also need the button component.
export async function sendWaTemplate(phone, name, lang, code, withButton) {
  const to = '91' + String(phone).replace(/\D/g, '').slice(-10);
  const components = [{ type: 'body', parameters: [{ type: 'text', text: code }] }];
  if (withButton) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] });
  const r = await fetch(`https://graph.facebook.com/v20.0/${process.env.WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: { name, language: { code: lang || 'en' }, components } }),
  });
  if (!r.ok) throw new Error('WhatsApp template send failed');
}

// Meta WhatsApp Cloud API. Business-initiated messages (like OTPs) must use an approved
// template in production; a plain text message only works inside a 24-hour customer window.
export async function sendWhatsApp(phone, text) {
  const to = '91' + String(phone).replace(/\D/g, '').slice(-10);
  const r = await fetch(`https://graph.facebook.com/v20.0/${process.env.WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  });

  if (!r.ok) {
    const detail = await r.text();
    console.error('WhatsApp API response:', r.status, detail);
    throw new Error('WhatsApp send failed: ' + r.status);
  }
}
