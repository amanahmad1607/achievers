import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { Student, Feedback, Setting, Slide } from './models.js';
import { need } from './auth.js';
import { sendWhatsApp } from './notify.js';
import { getSettings } from './settings.js';
import { studyInfo } from './stats.js';
import { makeBackup, saveWeekly, listBackups, readBackup, restore } from './backup.js';

const r = Router();
const SH = { M: 'Morning', E: 'Evening', F: 'Full Day' };
const wrap = fn => (q, s, n) => fn(q, s, n).catch(e => { console.error(e); s.status(500).json({ error: e.message || 'Server error' }); });
const adm = need('admin', 'super'), sup = need('super');
const idNo = s => 'ASP-' + String(s._id).slice(-5).toUpperCase();

/* ---------- Feedback and complaints ---------- */
r.post('/feedback', need('student'), wrap(async (q, s) => {
  const st = await Student.findById(q.user.id), msg = String(q.body.msg || '').trim().slice(0, 1000);
  if (msg.length < 5) return s.status(400).json({ error: 'Please write a few words' });
  await Feedback.create({ studentId: st._id, name: st.name, seat: st.seat, cat: String(q.body.cat || 'Other').slice(0, 40), msg });
  s.status(201).json({ ok: true });
}));
r.get('/feedback/mine', need('student'), wrap(async (q, s) => s.json(await Feedback.find({ studentId: q.user.id }).sort('-createdAt'))));
r.get('/admin/feedback', adm, wrap(async (q, s) => s.json(await Feedback.find().sort('-createdAt'))));
r.patch('/admin/feedback/:id', adm, wrap(async (q, s) => s.json(await Feedback.findByIdAndUpdate(q.params.id,
  { reply: String(q.body.reply || '').slice(0, 1000), status: q.body.status === 'open' ? 'open' : 'resolved' }, { new: true }))));
r.delete('/admin/feedback/:id', adm, wrap(async (q, s) => { await Feedback.deleteOne({ _id: q.params.id }); s.sendStatus(204); }));

/* ---------- WhatsApp notice to every approved student ---------- */
// In production, business-initiated broadcasts need an approved template; see README.
r.post('/admin/notice/send', adm, wrap(async (q, s) => {
  const text = String(q.body.text || '').trim().slice(0, 1000);
  if (!text) return s.status(400).json({ error: 'Write the notice first' });
  let sent = 0, failed = 0;
  for (const st of await Student.find({ status: 'approved' }, 'phone')) {
    try { await sendWhatsApp(st.phone, '📢 Achievers Study Point notice:\n' + text); sent++; } catch { failed++; }
    await new Promise(res => setTimeout(res, 250));                // stay under WhatsApp rate limits
  }
  s.json({ sent, failed });
}));

/* ---------- Leaderboard ---------- */
r.get('/leaderboard', need('student'), wrap(async (q, s) => {
  const all = await Student.find({ status: 'approved' });
  s.json(all.map(x => ({ name: x.name.split(' ')[0], minutes: studyInfo(x).monthMinutes, me: String(x._id) === q.user.id }))
    .filter(x => x.minutes > 0).sort((a, b) => b.minutes - a.minutes).slice(0, 5));
}));

/* ---------- Fee receipt PDF ---------- */
const FONTS = fileURLToPath(new URL('../assets/fonts/', import.meta.url));
const money = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = n => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
const three = n => (n > 99 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + two(n % 100);
export function inWords(amount) {
  const n = Math.round(Number(amount)) || 0;
  if (!n) return 'Zero';
  const parts = [[Math.floor(n / 1e7), 'Crore'], [Math.floor((n % 1e7) / 1e5), 'Lakh'], [Math.floor((n % 1e5) / 1e3), 'Thousand']]
    .filter(([v]) => v).map(([v, w]) => two(v) + ' ' + w);
  if (n % 1e3) parts.push(three(n % 1e3));
  return parts.join(' ');
}
async function receiptInfo() {
  const [S, H] = [await getSettings(), await getHome()];
  return { amount: S.fee_amount, terms: S.receipt_terms, address: H.address, phone: H.phone, email: H.email, manager: H.manager_name };
}

export function receiptPdf(res, st, p, info) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Fee Receipt ${p.receiptNo || ''}`, Author: 'Achievers Study Point' } });
  doc.registerFont('R', FONTS + 'Poppins-Regular.ttf'); doc.registerFont('M', FONTS + 'Poppins-Medium.ttf'); doc.registerFont('B', FONTS + 'Poppins-Bold.ttf');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=receipt-${p.receiptNo || p.month}.pdf`);
  doc.pipe(res);

  const W = 595.28, NAVY = '#12315a', GOLD = '#f2b705', GOLDD = '#b98700', INK = '#1b2a41', MUTE = '#64748b', LINE = '#dbe3ef', SOFT = '#f4f7fc', GREEN = '#15803d';
  const T = (text, x, y, o = {}) => doc.text(String(text), x, y, { lineBreak: false, ...o });
  const paid = new Date(p.paidOn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const forMonth = new Date(p.month + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  // top bars
  doc.rect(0, 0, W, 10).fill(NAVY); doc.rect(0, 10, W, 3).fill(GOLD);

  // brand block
  doc.circle(64, 66, 24).fill(GOLD);
  doc.font('B').fontSize(26).fillColor(NAVY); T('A', 64 - doc.widthOfString('A') / 2, 49);
  doc.font('B').fontSize(19).fillColor(NAVY); T('Achievers Study Point', 100, 44);
  doc.font('R').fontSize(8.5).fillColor(MUTE);
  T('Self-study hall for competitive exam aspirants', 100, 67);
  T(info.address || '', 100, 80, { width: 290 });
  T([info.phone, info.email].filter(Boolean).join('   |   '), 100, 92, { width: 290 });

  // title block
  doc.font('B').fontSize(30).fillColor(NAVY); T('RECEIPT', W - 295, 40, { width: 255, align: 'right', characterSpacing: 3 });
  doc.font('M').fontSize(11).fillColor(GOLDD); T('No. ' + (p.receiptNo || '-'), W - 295, 78, { width: 255, align: 'right' });
  doc.moveTo(40, 116).lineTo(W - 40, 116).lineWidth(1).strokeColor(LINE).stroke();

  // two info boxes
  const box = (x, y, w, h, title) => {
    doc.roundedRect(x, y, w, h, 8).lineWidth(1).fillAndStroke('#ffffff', LINE);
    doc.save(); doc.roundedRect(x, y, w, 24, 8).clip(); doc.rect(x, y, w, 24).fill(NAVY); doc.restore();
    doc.font('B').fontSize(8.5).fillColor('#ffffff'); T(title, x + 14, y + 8, { characterSpacing: 1.5 });
  };
  box(40, 134, 255, 118, 'BILLED TO');
  doc.font('B').fontSize(12.5).fillColor(INK); T(st.name, 54, 168, { width: 230 });
  doc.font('R').fontSize(8.5).fillColor(MUTE);
  T(st.email || '', 54, 187, { width: 230 }); T('+91 ' + String(st.phone || '').slice(-10), 54, 200);
  T(`Student ID: ${idNo(st)}`, 54, 213); T(`Seat ${st.seat}  |  ${SH[st.shift]}  |  ${st.job || ''}`, 54, 226, { width: 230 });

  box(310, 134, 245, 118, 'RECEIPT DETAILS');
  [['Receipt No', p.receiptNo || '-'], ['Receipt Date', paid], ['Fee For', forMonth]].forEach(([k, v], i) => {
    doc.font('R').fontSize(9).fillColor(MUTE); T(k, 324, 168 + i * 19);
    doc.font('M').fontSize(9.5).fillColor(INK); T(v, 400, 167 + i * 19, { width: 145, align: 'right' });
  });
  doc.font('R').fontSize(9).fillColor(MUTE); T('Status', 324, 225);
  doc.roundedRect(485, 221, 60, 20, 10).fill('#dcfce7'); doc.font('B').fontSize(9).fillColor(GREEN); T('PAID', 485, 226, { width: 60, align: 'center', characterSpacing: 1 });

  // items table
  doc.roundedRect(40, 276, W - 80, 28, 6).fill(NAVY);
  doc.font('B').fontSize(8.5).fillColor('#ffffff');
  T('#', 54, 286); T('DESCRIPTION', 80, 286, { characterSpacing: 1 }); T('PERIOD', 345, 286, { characterSpacing: 1 }); T('AMOUNT', 440, 286, { width: 105, align: 'right', characterSpacing: 1 });
  doc.rect(40, 304, W - 80, 48).fill(SOFT);
  doc.font('M').fontSize(9.5).fillColor(INK); T('1', 54, 320);
  doc.font('M').fontSize(10).fillColor(INK); T('Monthly study seat fee', 80, 314);
  doc.font('R').fontSize(8).fillColor(MUTE); T(`Seat ${st.seat}, ${SH[st.shift]} shift`, 80, 329);
  doc.font('R').fontSize(9.5).fillColor(INK); T(forMonth, 345, 320);
  doc.font('M').fontSize(10).fillColor(INK); T(money(info.amount), 440, 320, { width: 105, align: 'right' });
  doc.moveTo(40, 352).lineTo(W - 40, 352).lineWidth(1).strokeColor(LINE).stroke();

  // amount in words + totals
  doc.font('R').fontSize(8).fillColor(MUTE); T('AMOUNT IN WORDS', 40, 374, { characterSpacing: 1 });
  doc.font('M').fontSize(10).fillColor(INK); doc.text(`Rupees ${inWords(info.amount)} Only`, 40, 390, { width: 235 });
  doc.font('R').fontSize(9.5).fillColor(MUTE); T('Subtotal', 330, 374); T('Discount', 330, 392);
  doc.fillColor(INK); T(money(info.amount), 440, 374, { width: 115, align: 'right' }); T(money(0), 440, 392, { width: 115, align: 'right' });
  doc.roundedRect(330, 416, 225, 40, 8).fill(NAVY);
  doc.font('B').fontSize(9).fillColor(GOLD); T('TOTAL PAID', 344, 431, { characterSpacing: 1.5 });
  doc.font('B').fontSize(16).fillColor('#ffffff'); T(money(info.amount), 420, 427, { width: 124, align: 'right' });

  // PAID stamp
  doc.save(); doc.rotate(-16, { origin: [150, 500] }); doc.opacity(0.85);
  doc.roundedRect(80, 468, 140, 62, 10).lineWidth(3.5).stroke(GREEN);
  doc.font('B').fontSize(32).fillColor(GREEN); T('PAID', 80, 474, { width: 140, align: 'center', characterSpacing: 4 });
  doc.font('M').fontSize(8).fillColor(GREEN); T(paid.toUpperCase(), 80, 513, { width: 140, align: 'center', characterSpacing: 1 });
  doc.restore();

  // signature
  doc.moveTo(380, 540).lineTo(555, 540).lineWidth(1).strokeColor(MUTE).stroke();
  doc.font('M').fontSize(10).fillColor(INK); T(info.manager || '', 380, 518, { width: 175, align: 'center' });
  doc.font('R').fontSize(8.5).fillColor(MUTE); T('Authorised Signatory', 380, 546, { width: 175, align: 'center' });

  // terms
  doc.roundedRect(40, 584, W - 80, 118, 8).fill(SOFT);
  doc.rect(40, 594, 4, 98).fill(GOLD);
  doc.font('B').fontSize(10).fillColor(NAVY); T('Terms & Conditions', 58, 596);
  doc.font('R').fontSize(8.5).fillColor(MUTE); doc.text(info.terms || '', 58, 616, { width: W - 120, lineGap: 3, height: 80 });

  doc.font('M').fontSize(10.5).fillColor(NAVY); T('Thank you for choosing Achievers Study Point!', 40, 730, { width: W - 80, align: 'center' });

  // footer
  doc.moveTo(40, 782).lineTo(W - 40, 782).lineWidth(1.5).strokeColor(GOLD).stroke();
  doc.font('R').fontSize(8.5).fillColor(INK); T('© Achievers Study Point. Developed and managed by Aman Ahmad and Meraj Alam', 40, 792, { width: W - 80, align: 'center' });
  doc.font('R').fontSize(7.5).fillColor(MUTE); T('This is a computer-generated receipt and does not require a signature.', 40, 807, { width: W - 80, align: 'center' });
  doc.rect(0, 831.89, W, 10).fill(NAVY);
  doc.end();
}

const payment = (st, month) => st?.payments.find(x => x.month === month);
r.get('/me/receipt/:month', need('student'), wrap(async (q, s) => {
  const st = await Student.findById(q.user.id), p = payment(st, q.params.month);
  if (!p) return s.sendStatus(404);
  receiptPdf(s, st, p, await receiptInfo());
}));
r.get('/admin/students/:id/receipt/:month', adm, wrap(async (q, s) => {
  const st = await Student.findById(q.params.id), p = payment(st, q.params.month);
  if (!p) return s.sendStatus(404);
  receiptPdf(s, st, p, await receiptInfo());
}));

/* ---------- Student photo and ID card (credit-card size, QR holds the ID number only) ---------- */
r.post('/me/photo', need('student'), wrap(async (q, s) => {
  const p = String(q.body.photo || '');
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p) || p.length > 120000) return s.status(400).json({ error: 'Photo must be a small JPEG' });
  await Student.updateOne({ _id: q.user.id }, { photo: p }); s.json({ ok: true });
}));
export async function cardPdf(res, st) {
  const doc = new PDFDocument({ size: [243, 153], margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${idNo(st)}.pdf`);
  doc.pipe(res);
  doc.rect(0, 0, 243, 153).fill('#12315a');
  doc.fillColor('#f2b705').font('Helvetica-Bold').fontSize(10).text('ACHIEVERS STUDY POINT', 14, 12);
  if (st.photo) { try { doc.image(Buffer.from(st.photo.split(',')[1], 'base64'), 14, 36, { width: 64, height: 64 }); } catch { /* skip bad photo */ } }
  doc.fillColor('#ffffff').fontSize(11).text(st.name, 88, 38, { width: 150 });
  doc.font('Helvetica').fontSize(8).text(`ID: ${idNo(st)}`, 88, 58).text(`Seat: ${st.seat} (${SH[st.shift]})`, 88, 70).text(st.job || '', 88, 82);
  const qr = await QRCode.toBuffer(idNo(st), { margin: 1, width: 120 });
  doc.rect(176, 92, 56, 56).fill('#ffffff'); doc.image(qr, 178, 94, { width: 52 });
  doc.fillColor('#ffffff').fontSize(6).text('If found, please return to Achievers Study Point', 14, 140);
  doc.end();
}
r.get('/me/idcard', need('student'), wrap(async (q, s) => cardPdf(s, await Student.findById(q.user.id))));
r.get('/admin/students/:id/idcard', adm, wrap(async (q, s) => cardPdf(s, await Student.findById(q.params.id))));

/* ---------- Backup and restore (super admin only: the data includes password hashes) ---------- */
r.get('/super/backups', sup, wrap(async (q, s) => s.json(await listBackups())));
r.post('/super/backups/run', sup, wrap(async (q, s) => s.json({ file: await saveWeekly() })));
r.get('/super/backups/live', sup, wrap(async (q, s) => {
  s.setHeader('Content-Disposition', `attachment; filename=achievers-backup-${new Date().toISOString().slice(0, 10)}.json`);
  s.json(await makeBackup());
}));
r.get('/super/backups/file/:name', sup, wrap(async (q, s) => {
  s.setHeader('Content-Disposition', `attachment; filename=${q.params.name}`); s.json(await readBackup(q.params.name));
}));
r.post('/super/restore', sup, wrap(async (q, s) => { await restore(q.body.name ? await readBackup(q.body.name) : q.body); s.json({ ok: true }); }));

/* ---------- Public home page content (manager's message, contact, social links, ...) ---------- */
const HOME_DEFAULTS = {
  manager_name: 'Manager Name', manager_role: 'Manager, Achievers Study Point',
  manager_msg: 'Dear students,\nSuccess comes from discipline and consistent hard work. Our aim is to give you a peaceful place to study so that you can focus on your goals. Make full use of every hour, and we are always here to support you.\nBest wishes for your preparation!',
  photo: '', address: 'Achievers Study Point, Lucknow (add full address)', phone: '+91 00000 00000', email: 'info@achievers.in',
  ig: '', fb: '', yt: '', wa: '', tg: '', timings: 'Open daily, 6 AM to 10 PM. Morning, Evening and Full Day shifts',
};
async function getHome() {
  const o = { ...HOME_DEFAULTS };
  for (const row of await Setting.find({ _id: /^home_/ })) o[row._id.slice(5)] = row.value;
  return o;
}
r.get('/public/home', wrap(async (q, s) => {
  const [h, S] = [await getHome(), await getSettings()];
  const used = new Set((await Student.find({ status: 'approved' }, 'seat')).map(x => x.seat));
  s.json({ ...h, notice: S.notice, fee: S.fee_amount, totalSeats: 115, freeSeats: 115 - used.size, students: await Student.countDocuments({ status: 'approved' }) });
}));
r.put('/admin/home', adm, wrap(async (q, s) => {
  for (const k of Object.keys(HOME_DEFAULTS)) {
    if (typeof q.body[k] !== 'string') continue;
    let v = q.body[k];
    if (k === 'photo') {
      if (v && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v) || v.length > 120000)) return s.status(400).json({ error: 'Photo must be a small JPEG' });
    } else {
      v = v.slice(0, 2000);
      if (['ig', 'fb', 'yt', 'wa', 'tg'].includes(k) && v && !/^https?:\/\//.test(v)) return s.status(400).json({ error: 'Social links must start with http:// or https://' });
    }
    await Setting.findByIdAndUpdate('home_' + k, { value: v }, { upsert: true });
  }
  s.json(await getHome());
}));

/* ---------- Home page carousel (photos and captions managed by the admin) ---------- */
const MAX_SLIDES = 8;
r.get('/public/slides', wrap(async (q, s) => s.json(await Slide.find({}, '-image').sort('order createdAt'))));
r.get('/public/slides/:id/image', wrap(async (q, s) => {
  const sl = await Slide.findById(q.params.id, 'image');
  const m = sl && /^data:image\/jpeg;base64,(.+)$/.exec(sl.image);
  if (!m) return s.sendStatus(404);
  s.set('Cache-Control', 'public, max-age=86400').type('image/jpeg').send(Buffer.from(m[1], 'base64'));
}));
r.post('/admin/slides', adm, wrap(async (q, s) => {
  const image = String(q.body.image || '');
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 700000) return s.status(400).json({ error: 'Please choose a valid photo' });
  if ((await Slide.countDocuments()) >= MAX_SLIDES) return s.status(400).json({ error: `You can keep up to ${MAX_SLIDES} slides. Delete one first.` });
  const last = await Slide.findOne().sort('-order');
  const sl = await Slide.create({ image, caption: String(q.body.caption || '').trim().slice(0, 120), order: (last?.order ?? 0) + 1 });
  s.status(201).json({ _id: sl._id });
}));
r.patch('/admin/slides/:id', adm, wrap(async (q, s) => {
  await Slide.updateOne({ _id: q.params.id }, { caption: String(q.body.caption || '').trim().slice(0, 120) });
  s.json({ ok: true });
}));
r.post('/admin/slides/:id/move', adm, wrap(async (q, s) => {
  const all = await Slide.find({}, '_id').sort('order createdAt');
  const i = all.findIndex(x => String(x._id) === q.params.id), j = i + (q.body.dir === 'up' ? -1 : 1);
  if (i >= 0 && j >= 0 && j < all.length) {
    [all[i], all[j]] = [all[j], all[i]];
    await Promise.all(all.map((x, k) => Slide.updateOne({ _id: x._id }, { order: k })));
  }
  s.json({ ok: true });
}));
r.delete('/admin/slides/:id', adm, wrap(async (q, s) => { await Slide.deleteOne({ _id: q.params.id }); s.sendStatus(204); }));

export default r;
