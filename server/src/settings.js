import { Setting } from './models.js';

// Texts the admin can edit from the panel. {{placeholders}} are filled in when a message is sent.
export const DEFAULTS = {
  terms: '1. Maintain silence and discipline inside the study hall.\n2. Use only your allotted seat; seats are not transferable.\n3. The monthly fee must be paid before the 5th of every month.\n4. Keep mobiles on silent; take calls outside the hall.\n5. Take care of furniture and property; damage will be charged.',
  approved: 'Hello {{name}}, your registration at Achievers Study Point is approved. Your seat number is {{seat}}. You can now log in.',
  password_reset: 'Hello {{name}}, your Achievers Study Point password was reset. Temporary password: {{password}}',
  otp_email: 'Your Achievers Study Point OTP is {{otp}}. It is valid for 5 minutes.',
  otp_whatsapp: 'Your Achievers Study Point OTP is {{otp}}. It is valid for 5 minutes.',
    receipt_terms: '1. Fees once paid are not refundable.\n2. The monthly fee must be paid before the 5th of every month.\n3. Seats are not transferable.\n4. Please keep this receipt for your records.',
  notice: '',            // notice board text shown to students
  fee_amount: '600',     // monthly fee printed on receipts (Rs.)
  wa_otp_template: '',   // name of the template approved by Meta; leave empty to send plain text
  wa_otp_lang: 'en',
  wa_otp_button: 'no',   // 'yes' if the approved template is an authentication template with a copy-code button
};

export async function getSettings() {
  const o = { ...DEFAULTS };
  (await Setting.find()).forEach(r => { o[r._id] = r.value; });
  return o;
}
export const fill = (text, vars) => String(text).replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? '');
