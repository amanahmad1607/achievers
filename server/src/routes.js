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
import { clockIn, clockOut } from './attendance.js';

const r = Router();
const SH = { M: 'Morning', E: 'Evening', F: 'Full Day' };
const today = () => new Date().toISOString().slice(0, 10);
const month = () => today().slice(0, 7);
const last10 = x => String(x || '').replace(/\D/g, '').slice(-10);
const code = () => String(crypto.randomInt(100000, 1000000));
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const wrap = fn => (q, s, n) => fn(q, s, n).catch(e => { console.error(e); s.status(500).json({ error: 'Server error' }); });
const pub = s => { const o = s.toObject({ flattenMaps: true }); delete o.passwordHash; delete o.sessions; return o; };
const paidNow = s => s.payments.some(p => p.month === month());
const row = s => ({ ...pub(s), ...feeInfo(s), ...studyInfo(s), present: !!s.checkedInAt, attended: s.presentOn.includes(today()) });
const adm = need('admin', 'super');
const sup = need('super');

/* ---------- Registration with email + WhatsApp OTP ---------- */
r.post('/otp/send', limiter, wrap(async (q, s) => {
  const email = String(q.body.email || '').toLowerCase().trim(), phone = last10(q.body.phone);
  const wantWa = q.body.whatsapp === true;                      // WhatsApp verification is optional
  if (!/^\S+@\S+\.\S+$/.test(email) || phone.length < 10) return s.status(400).json({ error: 'Valid email and 10-digit WhatsApp number required' });
  if (await Student.findOne({ $or: [{ email }, { phone }] })) return s.status(409).json({ error: 'Email or mobile already registered' });
  const ce = code(), cw = wantWa ? code() : null, S = await getSettings();   // message texts edited by the admin
  const otp = await Otp.create({ email, phone, emailHash: hash(ce), waHash: cw && hash(cw), expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
  let waSent = false;
  if (process.env.DEV_OTP_LOG === 'true') { console.log(`[DEV] OTPs for ${email}: email ${ce}${cw ? ', WhatsApp ' + cw : ''}`); waSent = !!cw; }   // local testing only
  else {
    await sendEmail(email, 'Achievers Study Point OTP', fill(S.otp_email, { otp: ce }));
    if (cw) {
      try {
        await (S.wa_otp_template ? sendWaTemplate(phone, S.wa_otp_template, S.wa_otp_lang, cw, S.wa_otp_button === 'yes') : sendWhatsApp(phone, fill(S.otp_whatsapp, { otp: cw })));
        waSent = true;
      } catch (e) { console.error('WhatsApp OTP failed:', e.message); }   // a WhatsApp problem never blocks registration
    }
  }
  s.json({ otpId: otp._id, waSent });
}));

r.post('/auth/register', limiter, wrap(async (q, s) => {
  const { name, password, job, shift, otpId, emailOtp, waOtp } = q.body;
  const otp = await Otp.findById(otpId);
  if (!otp || otp.expiresAt < new Date() || otp.tries >= 5) return s.status(400).json({ error: 'OTP expired. Request a new one.' });
  otp.tries++; await otp.save();
  if (hash(String(emailOtp).trim()) !== otp.emailHash) return s.status(400).json({ error: 'Wrong email OTP' });
  const waGiven = !!otp.waHash && String(waOtp || '').trim() !== '';   // the WhatsApp OTP is optional
  if (waGiven && hash(String(waOtp).trim()) !== otp.waHash) return s.status(400).json({ error: 'Wrong WhatsApp OTP. Correct it, or leave it empty to skip WhatsApp verification.' });
  if (!name || String(password || '').length < 6) return s.status(400).json({ error: 'Name and a password of 6+ characters required' });
  await Student.create({
    name, email: otp.email, phone: otp.phone, passwordHash: await bcrypt.hash(password, 10),
    job, shift: SH[shift] ? shift : 'F', emailVerified: true, waVerified: waGiven,   // status stays "pending"
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
  if (st.checkedInAt) clockOut(st); else clockIn(st);      // Present <-> Absent (Leave), study timer follows
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
r.get('/admin/students', adm, wrap(async (q, s) => s.json((await Student.find({ status: 'approved' }, '-photo -sessions').sort('seat')).map(row))));
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
  const st = await Student.findById(q.params.id);
  if (st.checkedInAt) clockOut(st); else clockIn(st);      // Absent (Leave) also stops the study timer
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
  [x.seat, x.name, x.email, x.phone, x.job, SH[x.shift], x.checkedInAt ? 'Present' : 'Absent (Leave)', x.presentOn.includes(today()) ? 'Yes' : 'No', paidNow(x) ? 'Paid' : 'Pending']);
  const HEAD = ['Seat', 'Name', 'Email', 'Mobile', 'Preparing for', 'Shift', 'Attendance', 'Attended today', 'Fee'];

r.get('/admin/export.xlsx', adm, wrap(async (q, s) => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Students');
  ws.addRow(HEAD).font = { bold: true }; (await tableRows()).forEach(x => ws.addRow(x));
  ws.columns.forEach(c => { c.width = 18; });
  s.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  s.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');
  await wb.xlsx.write(s); s.end();
}));

r.get('/admin/export.pdf', adm, wrap(async (q, s) => {
  const students = await tableRows();

  // Indian date (DD-MM-YYYY)
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(now);

  const fileDate = date.replace(/\//g, '-');

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: { top: 30, bottom: 30, left: 30, right: 30 },
    bufferPages: true
  });

  const filename = `Achievers_Student_List_${fileDate}.pdf`;

  s.setHeader('Content-Type', 'application/pdf');
  s.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );

  doc.pipe(s);

  // Keep your existing behavior of excluding column index 2.
  const columns = HEAD
    .map((heading, index) => ({ heading, index }))
    .filter(col => col.index !== 2);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const left = 30;
  const right = 30;
  const top = 30;
  const bottom = 30;
  const tableWidth = pageWidth - left - right;

  // Column widths automatically fit the landscape page.
  const weights = columns.map((_, i) => {
    const heading = String(columns[i].heading).toLowerCase();

    if (heading.includes('name')) return 2.0;
    if (heading.includes('preparing')) return 1.8;
    if (heading.includes('attendance')) return 1.5;
    if (heading.includes('attended')) return 1.3;
    if (heading.includes('shift')) return 1.0;
    if (heading.includes('fee')) return 0.9;
    return 0.7;
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map(w => tableWidth * w / totalWeight);

  const padding = 5;
  const fontSize = 8;
  const headerFontSize = 8;

  // Main report heading
  function drawTitle() {
    doc
      .font('Helvetica-Bold')
      .fontSize(17)
      .fillColor('#172554')
      .text('ACHIEVERS STUDY POINT', left, doc.y, {
        width: tableWidth,
        align: 'center'
      });

    doc.moveDown(0.2);

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#334155')
      .text('Student List / Attendance Report', {
        align: 'center'
      });

    doc.moveDown(0.3);

    doc
      .fontSize(9)
      .fillColor('#475569')
      .text(`Report Date: ${date}`, {
        align: 'right'
      });

    doc.moveDown(0.8);
  }

  // Draw table header
  function drawTableHeader() {
    const y = doc.y;
    const height = 27;

    doc
      .rect(left, y, tableWidth, height)
      .fill('#1e3a8a');

    let x = left;

    columns.forEach((col, i) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(headerFontSize)
        .fillColor('#ffffff')
        .text(
          String(col.heading),
          x + padding,
          y + 8,
          {
            width: widths[i] - padding * 2,
            height: height - 8,
            align: 'left',
            lineBreak: true
          }
        );

      x += widths[i];
    });

    doc.y = y + height;
  }

  // Calculate complete row height before drawing it.
 function calculateRowHeight(cells) {
  return 27;
}

  // Draw one complete student row.
function drawRow(cells, index) {
  const rowHeight = calculateRowHeight(cells);
  const y = doc.y;

  // Row background
  doc.save();
  doc.rect(left, y, tableWidth, rowHeight)
    .fill(index % 2 === 0 ? '#f1f5f9' : '#ffffff');
  doc.restore();

  let x = left;

  columns.forEach((col, i) => {
    const value = String(cells[col.index] ?? '-');

    // Fixed-position rendering: do not allow wrapping.
    doc.save();
    doc.font('Helvetica')
      .fontSize(fontSize)
      .fillColor('#1e293b');

    doc.text(
      value,
      x + padding,
      y + (rowHeight - fontSize) / 2,
      {
        width: widths[i] - padding * 2,
        height: fontSize + 2,
        lineBreak: false,
        ellipsis: true
      }
    );

    doc.restore();

    x += widths[i];
  });

  // Bottom border
  doc.save();
  doc.moveTo(left, y + rowHeight)
    .lineTo(left + tableWidth, y + rowHeight)
    .lineWidth(0.4)
    .strokeColor('#cbd5e1')
    .stroke();
  doc.restore();

  doc.y = y + rowHeight;
}

  // First page
  drawTitle();
  drawTableHeader();

  // Student rows
  students.forEach((student, index) => {
  const rowHeight = 27;

  if (doc.y + rowHeight > pageHeight - 45) {
    doc.addPage({
      size: 'A4',
      layout: 'landscape',
      margin: 30
    });

    // Explicitly reset cursor on the new page.
    doc.y = top;

    drawTableHeader();
  }

  drawRow(student, index);
});

  // Page numbers on all pages
  // Page numbers on all existing pages
const range = doc.bufferedPageRange();

for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i);

  // Prevent PDFKit from creating an additional page.
  const originalBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc.font('Helvetica')
    .fontSize(8)
    .fillColor('#64748b')
    .text(
      `Achievers Study Point | ${date} | Page ${i + 1} of ${range.count}`,
      left,
      pageHeight - 20,
      {
        width: tableWidth,
        align: 'center',
        lineBreak: false
      }
    );

  doc.page.margins.bottom = originalBottom;
}

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
