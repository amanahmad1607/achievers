import { Router } from 'express';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Student, Feedback, Setting } from './models.js';
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
export function receiptPdf(res, st, p, amount) {
  const doc = new PDFDocument({ size: 'A5', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=receipt-${p.receiptNo || p.month}.pdf`);
  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(18).text('Achievers Study Point');
  doc.moveDown(0.5).fontSize(14).text('FEE RECEIPT').moveDown().font('Helvetica').fontSize(11);
  [['Receipt No', p.receiptNo || '-'], ['Date', new Date(p.paidOn).toISOString().slice(0, 10)], ['Student', st.name],
   ['Seat / Shift', `${st.seat} / ${SH[st.shift]}`], ['Fee for month', p.month], ['Amount', 'Rs. ' + amount], ['Status', 'PAID']]
    .forEach(([k, v]) => doc.text(`${k}: ${v}`).moveDown(0.3));
  doc.moveDown(2).fontSize(8).text('This is a computer generated receipt.');
  doc.end();
}
const payment = (st, month) => st?.payments.find(x => x.month === month);
r.get('/me/receipt/:month', need('student'), wrap(async (q, s) => {
  const st = await Student.findById(q.user.id), p = payment(st, q.params.month);
  if (!p) return s.sendStatus(404);
  receiptPdf(s, st, p, (await getSettings()).fee_amount);
}));
r.get('/admin/students/:id/receipt/:month', adm, wrap(async (q, s) => {
  const st = await Student.findById(q.params.id), p = payment(st, q.params.month);
  if (!p) return s.sendStatus(404);
  receiptPdf(s, st, p, (await getSettings()).fee_amount);
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

export default r;
