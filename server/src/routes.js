import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Admin, Student, Otp, Counter, Setting } from './models.js';
import { need, sign } from './auth.js';
import { canSeat, nextSeat } from './seats.js';
import { sendEmail, sendWhatsApp, sendWaTemplate } from './notify.js';
import { DEFAULTS, getSettings, fill } from './settings.js';
import { feeInfo, studyInfo } from './stats.js';

const r = Router();
const SH = { M: 'Morning', E: 'Evening', F: 'Full Day' };
const today = () => new Date().toISOString().slice(0, 10);
const month = () => today().slice(0, 7);
const last10 = x => String(x || '').replace(/\D/g, '').slice(-10);
const code = () => String(crypto.randomInt(100000, 1000000));
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const wrap = fn => (q, s, n) => fn(q, s, n).catch(e => { console.error(e); s.status(500).json({ error: 'Server error' }); });
const pub = s => { const o = s.toObject({ flattenMaps: true }); delete o.passwordHash; return o; };
const paidNow = s => s.payments.some(p => p.month === month());
const row = s => ({ ...pub(s), ...feeInfo(s), ...studyInfo(s), present: s.presentOn.includes(today()) });
const adm = need('admin', 'super');
const sup = need('super');

/* ---------- Registration with email + WhatsApp OTP ---------- */
r.post('/otp/send', limiter, wrap(async (q, s) => {
  const email = String(q.body.email || '').toLowerCase().trim(), phone = last10(q.body.phone);
  if (!/^\S+@\S+\.\S+$/.test(email) || phone.length < 10) return s.status(400).json({ error: 'Valid email and 10-digit WhatsApp number required' });
  if (await Student.findOne({ $or: [{ email }, { phone }] })) return s.status(409).json({ error: 'Email or mobile already registered' });
  const ce = code(), cw = code();
  const otp = await Otp.create({ email, phone, emailHash: hash(ce), waHash: hash(cw), expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
  if (process.env.DEV_OTP_LOG === 'true') console.log(`[DEV] OTPs for ${email}: email ${ce}, WhatsApp ${cw}`);
  else await Promise.all([
    sendEmail(email, 'Achievers Study Point OTP', fill(S.otp_email, { otp: ce })),
    S.wa_otp_template
      ? sendWaTemplate(phone, S.wa_otp_template, S.wa_otp_lang, cw, S.wa_otp_button === 'yes')
      : sendWhatsApp(phone, fill(S.otp_whatsapp, { otp: cw })),
  ]);
  s.json({ otpId: otp._id });
}));

r.post('/auth/register', limiter, wrap(async (q, s) => {
  const { name, password, job, shift, otpId, emailOtp, waOtp } = q.body;
  const otp = await Otp.findById(otpId);
  if (!otp || otp.expiresAt < new Date() || otp.tries >= 5) return s.status(400).json({ error: 'OTP expired. Request a new one.' });
  otp.tries++; await otp.save();
  if (hash(String(emailOtp)) !== otp.emailHash || hash(String(waOtp)) !== otp.waHash) return s.status(400).json({ error: 'Wrong OTP' });
  if (!name || String(password || '').length < 6) return s.status(400).json({ error: 'Name and a password of 6+ characters required' });
  await Student.create({
    name, email: otp.email, phone: otp.phone, passwordHash: await bcrypt.hash(password, 10),
    job, shift: SH[shift] ? shift : 'F', emailVerified: true, waVerified: true,   // status stays "pending"
  });
  await otp.deleteOne();
  s.status(201).json({ message: 'Submitted. The admin will approve your request and allot a seat.' });
}));

r.post('/auth/login', limiter, wrap(async (q, s) => {
  const email = String(q.body.email || '').toLowerCase().trim(), { password, as } = q.body;
  if (as === 'admin') {
    const a = await Admin.findOne({ email });
    if (!a || !(await bcrypt.compare(password || '', a.passwordHash))) return s.status(401).json({ error: 'Invalid credentials' });
    return s.json({ token: sign(a, a.role), role: a.role, name: a.name });
  }
  const st = await Student.findOne({ email });
  if (!st || !(await bcrypt.compare(password || '', st.passwordHash))) return s.status(401).json({ error: 'Invalid credentials' });
  if (st.status !== 'approved') return s.status(403).json({ error: 'Your registration is waiting for admin approval' });
  s.json({ token: sign(st, 'student'), role: 'student', name: st.name });
}));

/* ---------- Student ---------- */
r.get('/me', need('student'), wrap(async (q, s) => s.json(row(await Student.findById(q.user.id)))));

r.post('/me/checkin', need('student'), wrap(async (q, s) => {
  const st = await Student.findById(q.user.id);
  if (st.checkedInAt) {                                   // check out
    st.studyMinutes.set(today(), (st.studyMinutes.get(today()) || 0) + (Date.now() - st.checkedInAt) / 60000);
    st.checkedInAt = null;
  } else {                                                // check in
    st.checkedInAt = new Date();
    if (!st.presentOn.includes(today())) st.presentOn.push(today());
  }
  await st.save(); s.json({ checkedIn: !!st.checkedInAt });
}));

r.post('/me/password', need('student'), wrap(async (q, s) => {
  const st = await Student.findById(q.user.id);
  if (!(await bcrypt.compare(q.body.current || '', st.passwordHash)) || String(q.body.next || '').length < 6)
    return s.status(400).json({ error: 'Wrong current password or new password too short' });
  st.passwordHash = await bcrypt.hash(q.body.next, 10); st.mustChange = false; await st.save(); s.json({ ok: true });
}));

r.get('/seats', need('student', 'admin', 'super'), wrap(async (q, s) =>
  s.json({ occupied: (await Student.find({ status: 'approved' }, 'seat')).map(x => x.seat) })));

/* ---------- Admin ---------- */
r.get('/admin/students', adm, wrap(async (q, s) => s.json((await Student.find({ status: 'approved' }).sort('seat')).map(row))));
r.get('/admin/pending', adm, wrap(async (q, s) => s.json((await Student.find({ status: 'pending' }).sort('createdAt')).map(pub))));

r.post('/admin/students/:id/approve', adm, wrap(async (q, s) => {
  const st = await Student.findById(q.params.id);
  if (!st) return s.sendStatus(404);
  const n = q.body.seat ? +q.body.seat : await nextSeat(st.shift, st._id);
  if (!n || !(await canSeat(st.shift, n, st._id))) return s.status(409).json({ error: 'Seat not available for this shift' });
  st.seat = n; st.status = 'approved'; st.joinedAt = new Date(); await st.save();
  getSettings().then(S => sendWhatsApp(st.phone, fill(S.approved, { name: st.name, seat: n }))).catch(() => {});
  s.json(row(st));
}));

r.patch('/admin/students/:id/seat', adm, wrap(async (q, s) => {
  const st = await Student.findById(q.params.id), n = +q.body.seat;
  if (await canSeat(st.shift, n, st._id)) { st.seat = n; await st.save(); return s.json(row(st)); }
  const other = await Student.find({ seat: n, status: 'approved', _id: { $ne: st._id } });
  if (q.body.swap && other.length === 1) {
    other[0].seat = st.seat; st.seat = n; await Promise.all([st.save(), other[0].save()]);
    return s.json(row(st));
  }
  s.status(409).json({ error: 'Seat not available', canSwapWith: other.length === 1 ? other[0].name : null });
}));

r.post('/admin/students/:id/fee', adm, wrap(async (q, s) => {          // toggle paid for a month
  const st = await Student.findById(q.params.id), m = q.body.month || month();
  const i = st.payments.findIndex(p => p.month === m);
  if (i >= 0) st.payments.splice(i, 1);
  else {
    const c = await Counter.findOneAndUpdate({ _id: 'receipt' }, { $inc: { n: 1 } }, { upsert: true, new: true });
    st.payments.push({ month: m, paidOn: new Date(), receiptNo: 'ACH-' + String(c.n).padStart(4, '0') });
  }
  await st.save(); s.json(row(st));
}));

r.post('/admin/students/:id/attendance', adm, wrap(async (q, s) => {
  const st = await Student.findById(q.params.id), i = st.presentOn.indexOf(today());
  if (i >= 0) st.presentOn.splice(i, 1); else st.presentOn.push(today());
  await st.save(); s.json(row(st));
}));

r.post('/admin/students/:id/reset-password', adm, wrap(async (q, s) => {
  const temp = code(), st = await Student.findById(q.params.id);
  st.passwordHash = await bcrypt.hash(temp, 10); st.mustChange = true; await st.save();   // student is asked to set their own password
  getSettings().then(S => sendWhatsApp(st.phone, fill(S.password_reset, { name: st.name, password: temp }))).catch(() => {});
  s.json({ temp });
}));

r.delete('/admin/students/:id', adm, wrap(async (q, s) => { await Student.deleteOne({ _id: q.params.id }); s.sendStatus(204); }));

const tableRows = async () => (await Student.find({ status: 'approved' }).sort('seat')).map(x =>
  [x.seat, x.name, x.email, x.phone, x.job, SH[x.shift], x.presentOn.includes(today()) ? 'Present' : 'Absent', paidNow(x) ? 'Paid' : 'Pending']);
const HEAD = ['Seat', 'Name', 'Email', 'Mobile', 'Preparing for', 'Shift', 'Attendance', 'Fee'];

r.get('/admin/export.xlsx', adm, wrap(async (q, s) => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Students');
  ws.addRow(HEAD).font = { bold: true }; (await tableRows()).forEach(x => ws.addRow(x));
  ws.columns.forEach(c => { c.width = 18; });
  s.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  s.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');
  await wb.xlsx.write(s); s.end();
}));

r.get('/admin/export.pdf', adm, wrap(async (q, s) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
  s.setHeader('Content-Type', 'application/pdf'); s.setHeader('Content-Disposition', 'attachment; filename=students.pdf');
  doc.pipe(s);
  doc.fontSize(16).text('Achievers Study Point - Student List').moveDown(0.5).fontSize(9);
  [HEAD, ...(await tableRows())].forEach((cells, i) => {
    const y = doc.y; cells.forEach((c, k) => doc.text(String(c), 30 + k * 95, y, { width: 90, lineBreak: false }));
    doc.moveDown(0.6); if (i === 0) doc.moveTo(30, doc.y).lineTo(800, doc.y).stroke().moveDown(0.3);
  });
  doc.end();
}));

/* ---------- Editable messages and alerts ---------- */
r.get('/settings', adm, wrap(async (q, s) => s.json(await getSettings())));
r.put('/settings', adm, wrap(async (q, s) => {
  for (const k of ['otp_email', 'otp_whatsapp'])
    if (typeof q.body[k] === 'string' && !q.body[k].includes('{{otp}}')) return s.status(400).json({ error: 'OTP messages must contain {{otp}}' });
  for (const k of Object.keys(DEFAULTS))
    if (typeof q.body[k] === 'string') await Setting.findByIdAndUpdate(k, { value: q.body[k].slice(0, 2000) }, { upsert: true });
  s.json(await getSettings());
}));
r.get('/terms', need('student'), wrap(async (q, s) => { const S = await getSettings(); s.json({ terms: S.terms, notice: S.notice }); }));

/* ---------- Super admin (developer) ---------- */
r.get('/super/admins', sup, wrap(async (q, s) => s.json(await Admin.find({ role: 'admin' }, '-passwordHash'))));
r.post('/super/admins', sup, wrap(async (q, s) => {
  const { name, email, password } = q.body;
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '') || String(password || '').length < 6)
    return s.status(400).json({ error: 'Name, valid email and a 6+ character password required' });
  try { const a = await Admin.create({ name, email, passwordHash: await bcrypt.hash(password, 10) }); s.status(201).json({ id: a._id, name, email }); }
  catch { s.status(409).json({ error: 'Admin already exists' }); }
}));
r.delete('/super/admins/:id', sup, wrap(async (q, s) => { await Admin.deleteOne({ _id: q.params.id, role: 'admin' }); s.sendStatus(204); }));

export default r;
