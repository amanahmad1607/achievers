import { useEffect, useState } from 'react';
import { api, download } from './api.js';
import SeatMap from './SeatMap.jsx';

const SH = { M: 'Morning', E: 'Evening', F: 'Full Day' };
const JOBS = ['UPSC', 'SSC', 'Banking', 'Railways', 'State PSC', 'Defence', 'Teaching (CTET/TET)', 'NEET', 'JEE', 'GATE', 'Other'];

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('auth') || 'null'));
  const [view, setView] = useState('home');
  const login = a => { localStorage.setItem('token', a.token); localStorage.setItem('auth', JSON.stringify(a)); setAuth(a); };
  const logout = () => { localStorage.clear(); sessionStorage.clear(); setAuth(null); setView('home'); };
  const label = auth && (auth.role === 'super' ? 'Super Admin' : auth.role === 'admin' ? 'Admin' : auth.name);
  return (
    <>
      <header>
        <h1>🎓 Achievers <span>Study Point</span></h1><div className="sp" />
        {auth ? <><span>{label}</span><button className="btn" onClick={logout}>Logout</button></>
              : <button className="btn" onClick={() => setView(view === 'home' ? 'login' : 'home')}>{view === 'home' ? 'Login' : 'Home'}</button>}
      </header>
      <main>
        {!auth && view === 'home' && <Home go={setView} />}
        {!auth && view === 'login' && <Login onLogin={login} go={setView} />}
        {!auth && view === 'register' && <Register go={setView} />}
        {auth?.role === 'student' && <Student />}
        {(auth?.role === 'admin' || auth?.role === 'super') && <Admin isSuper={auth.role === 'super'} />}
      </main>
      <footer>© Achievers Study Point. Developed and managed by <b>Aman Ahmad</b> and <b>Meraj Alam</b></footer>
    </>
  );
}

const FACILITIES = [
  ['📚', 'Silent Study Hall', 'Distraction-free, disciplined environment for serious aspirants.'],
  ['❄️', 'Comfortable Seating', 'Personal desk and chair with a fixed seat for every student.'],
  ['💡', 'Power & Lighting', 'Proper lighting, charging points and fans/AC.'],
  ['📶', 'Wi-Fi', 'Fast internet for online classes and mock tests.'],
  ['💧', 'Drinking Water', 'Clean RO drinking water available all day.'],
  ['📖', 'Newspapers & Magazines', 'Daily newspapers and competitive exam magazines.'],
  ['📹', 'CCTV Security', '24x7 CCTV surveillance for a safe study space.'],
  ['🏆', 'Peer Group', 'A motivating environment for exam preparation.'],
];
const EXAMS = ['UPSC', 'SSC', 'Banking', 'Railways', 'State PSC', 'Defence', 'Teaching', 'NEET / JEE', 'GATE'];
const SOC = {
  ig: ['Instagram', '#e1306c', <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" /></>],
  fb: ['Facebook', '#1877f2', <path d="M14 8h3V4h-3a4 4 0 00-4 4v2H7v4h3v8h4v-8h3l1-4h-4V8z" fill="currentColor" />],
  yt: ['YouTube', '#ff0000', <><rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M10 9l5 3-5 3z" fill="currentColor" /></>],
  wa: ['WhatsApp', '#25d366', <><path d="M3 21l1.6-4.6A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4-1L3 21z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 8c0 3 3 6 6 6l1-2-2-1-1 .8c-.8-.4-1.6-1.2-2-2L11.8 9l-1-2z" fill="currentColor" /></>],
  tg: ['Telegram', '#229ed9', <path d="M21 4L3 11l6 2 2 6 3-4 5 3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />],
};

function Home({ go }) {
  const [h, setH] = useState(null);
  useEffect(() => { api('/public/home').then(setH).catch(() => {}); }, []);
  if (!h) return <p>Loading…</p>;
  const q = encodeURIComponent(h.address);
  return (<>
    <div className="hero">
      <h2>Welcome to Achievers <span>Study Point</span></h2>
      <p>A calm, focused place for competitive exam aspirants. Register, get approved and make every study hour count.</p>
      <button className="btn" onClick={() => go('register')}>Register for a Seat</button>
      <button className="btn sec" onClick={() => go('login')}>Login</button>
    </div>
    <div className="stats">
      <div className="stat"><small>Total seats</small><b>{h.totalSeats}</b></div>
      <div className="stat"><small>Seats available now</small><b>{h.freeSeats}</b></div>
      <div className="stat"><small>Students enrolled</small><b>{h.students}</b></div>
    </div>
    <div className="card mgr">
      {h.photo ? <img src={h.photo} alt="Manager" /> : <div className="ph">👤</div>}
      <div className="t"><h3>Manager’s Message</h3><p>{h.manager_msg}</p><b>{h.manager_name}</b><br /><small>{h.manager_role}</small></div>
    </div>
    {h.notice && <div className="card" style={{ borderLeft: '5px solid var(--gold)' }}><b>📢 Notice Board</b><p style={{ whiteSpace: 'pre-line', marginBottom: 0 }}>{h.notice}</p></div>}
    <div className="sec">
      <h3>Facilities</h3>
      <div className="feat">{FACILITIES.map(([i, t, d]) => <div className="card" key={t}><div>{i}</div><b>{t}</b><small>{d}</small></div>)}</div>
      <h3>Exams our students prepare for</h3>
      <div>{EXAMS.map(x => <span key={x} className="pill free" style={{ margin: 3, padding: '6px 14px' }}>{x}</span>)}</div>
      <h3>Timings &amp; Fees</h3>
      <div className="feat">
        <div className="card"><b>🕕 Timings</b><small>{h.timings}</small></div>
        <div className="card"><b>💰 Monthly fee</b><small>₹{h.fee} per month</small></div>
        <div className="card"><b>🪑 Seat allotment</b><small>Allotted by the admin after approving your registration</small></div>
      </div>
      <h3>How it works</h3>
      <div className="feat">
        <div className="card"><b>1. Register</b><small>Sign up with your email ID, WhatsApp number and exam, and verify both with OTPs.</small></div>
        <div className="card"><b>2. Get approved</b><small>The admin approves your registration and allots a seat.</small></div>
        <div className="card"><b>3. Login &amp; track</b><small>See your seat, attendance and fee status.</small></div>
      </div>
      <h3>Contact</h3>
      <div className="card ct">
        <div className="ci">
          <p>📍 {h.address}</p>
          <p>📞 <a href={'tel:' + h.phone.replace(/\s/g, '')}>{h.phone}</a></p>
          <p>✉️ <a href={'mailto:' + h.email}>{h.email}</a></p>
          <div className="soc">
            {Object.keys(SOC).filter(k => /^https?:\/\//.test(h[k] || '')).map(k => (
              <a key={k} href={h[k]} target="_blank" rel="noopener noreferrer" title={SOC[k][0]} style={{ background: SOC[k][1] }}>
                <svg viewBox="0 0 24 24" width="22" height="22">{SOC[k][2]}</svg></a>))}
          </div>
        </div>
        <div className="mp">
          <iframe title="Map" loading="lazy" src={`https://www.google.com/maps?q=${q}&output=embed`} />
          <a className="btn" href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener noreferrer">🗺 Open in Google Maps</a>
          <a className="btn sec" href={`https://www.google.com/maps/dir/?api=1&destination=${q}`} target="_blank" rel="noopener noreferrer">Get Directions</a>
        </div>
      </div>
    </div>
  </>);
}

const HOME_KEYS = ['manager_name', 'manager_role', 'manager_msg', 'photo', 'address', 'phone', 'email', 'ig', 'fb', 'yt', 'wa', 'tg', 'timings'];
function HomeEditor() {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState({ t: '', ok: false });
  useEffect(() => { api('/public/home').then(setF); }, []);
  if (!f) return <p>Loading…</p>;
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const pick = async e => { const file = e.target.files[0]; if (file) setF({ ...f, photo: await resizePhoto(file, 300) }); };
  const save = async () => {
    try {
      const body = Object.fromEntries(HOME_KEYS.map(k => [k, f[k] || '']));
      setF({ ...f, ...(await api('/admin/home', { method: 'PUT', body })) }); setMsg({ t: 'Saved. The home page is updated.', ok: true });
    } catch (e) { setMsg({ t: e.message, ok: false }); }
  };
  const line = (k, label, ph = '') => <div key={k}><label>{label}</label><input value={f[k] || ''} onChange={set(k)} placeholder={ph} /></div>;
  return (
    <div className="card"><h3>🏠 Home Page</h3>
      <p className="hint">Notices are edited in the Notices tab and the monthly fee in the Messages tab.</p>
      {line('manager_name', 'Manager name')}{line('manager_role', 'Designation')}
      <label>Manager’s message</label><textarea rows={5} value={f.manager_msg} onChange={set('manager_msg')} style={area} />
      <label>Manager’s photo</label>
      {f.photo && <img src={f.photo} alt="Manager" width="80" height="80" style={{ borderRadius: '50%', objectFit: 'cover', display: 'block', marginBottom: 6 }} />}
      <input type="file" accept="image/*" onChange={pick} />
      {line('timings', 'Timings')}{line('address', 'Address (used for the map)')}{line('phone', 'Phone')}{line('email', 'Email')}
      {line('ig', 'Instagram link', 'https://')}{line('fb', 'Facebook link', 'https://')}{line('yt', 'YouTube link', 'https://')}{line('wa', 'WhatsApp link', 'https://wa.me/91XXXXXXXXXX')}{line('tg', 'Telegram link', 'https://')}
      <button className="btn" onClick={save}>Save</button>
      <div className={'msg ' + (msg.ok ? 'ok-msg' : '')}>{msg.t}</div>
    </div>
  );
}

function Login({ onLogin, go }) {
  const [f, setF] = useState({ email: '', password: '', admin: false });
  const [err, setErr] = useState('');
  const submit = async () => {
    try { onLogin(await api('/auth/login', { method: 'POST', body: { email: f.email, password: f.password, as: f.admin ? 'admin' : 'student' } })); }
    catch (e) { setErr(e.message); }
  };
  return (
    <div className="card auth">
      <h3>{f.admin ? 'Admin Login' : 'Student Login'}</h3>
      <label>Email</label><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
      <label>Password</label><input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
      <label><input type="checkbox" style={{ width: 'auto' }} checked={f.admin} onChange={e => setF({ ...f, admin: e.target.checked })} /> I am an admin</label>
      <button className="btn" onClick={submit}>Login</button>
      <button className="btn sec" onClick={() => go('register')}>New student? Register</button>
      <div className="msg">{err}</div>
    </div>
  );
}

function Register({ go }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', job: JOBS[0], shift: 'F' });
  const [done, setDone] = useState('');
  const [otp, setOtp] = useState(null);                 // { otpId, emailOtp, waOtp }
  const [msg, setMsg] = useState({ t: '', ok: false });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const fail = e => setMsg({ t: e.message, ok: false });
  const send = async () => {
    try { const { otpId } = await api('/otp/send', { method: 'POST', body: { email: f.email, phone: f.phone } }); setOtp({ otpId, emailOtp: '', waOtp: '' }); setMsg({ t: '', ok: false }); }
    catch (e) { fail(e); }
  };
  const finish = async () => {
    try { const d = await api('/auth/register', { method: 'POST', body: { ...f, ...otp } }); setDone(d.message); }
    catch (e) { fail(e); }
  };
    if (done) return (
    <div className="card auth" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 54 }}>✅</div>
      <h3>Registration submitted</h3>
      <div role="alert" className="card" style={{ borderLeft: '5px solid var(--ok)', textAlign: 'left' }}>
        <b>{done}</b><br />
        <small>Once the admin approves, you can log in. Your seat number is also sent to your WhatsApp.</small>
      </div>
      <button className="btn" onClick={() => go('login')}>Go to login</button>
    </div>
  );
  return (
    
    <div className="card auth">
      <h3>Student Registration</h3>
      {!otp ? (<>
        <label>Full name</label><input value={f.name} onChange={set('name')} />
        <label>Email ID</label><input type="email" value={f.email} onChange={set('email')} />
        <label>WhatsApp mobile number</label><input type="tel" value={f.phone} onChange={set('phone')} />
        <label>Preparing for</label><select value={f.job} onChange={set('job')}>{JOBS.map(j => <option key={j}>{j}</option>)}</select>
        <label>Shift</label>
        <select value={f.shift} onChange={set('shift')}><option value="M">Morning (6 AM to 2 PM)</option><option value="E">Evening (2 PM to 10 PM)</option><option value="F">Full Day</option></select>
        <label>Create password (min 6)</label><input type="password" value={f.password} onChange={set('password')} />
        <button className="btn" onClick={send}>Send OTPs</button>
      </>) : (<>
        <p>OTPs were sent to {f.email} and your WhatsApp number.</p>
        <label>Email OTP</label><input value={otp.emailOtp} onChange={e => setOtp({ ...otp, emailOtp: e.target.value })} maxLength={6} />
        <label>WhatsApp OTP</label><input value={otp.waOtp} onChange={e => setOtp({ ...otp, waOtp: e.target.value })} maxLength={6} />
        <button className="btn" onClick={finish}>Verify &amp; Register</button>
        <button className="btn sec" onClick={send}>Resend</button>
      </>)}
      <button className="btn sec" onClick={() => go('login')}>Back to login</button>
      <div className={'msg ' + (msg.ok ? 'ok-msg' : '')}>{msg.t}</div>
    </div>
  );
}

const hm = m => `${Math.floor(m / 60)}h ${m % 60}m`;
const area = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', font: 'inherit', marginTop: 8 };
const CATS = ['Complaint', 'Suggestion', 'Facilities (AC, Wi-Fi, water)', 'Noise / Discipline', 'Other'];

function resizePhoto(file, size = 120) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = size;
        const z = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - z) / 2, (img.height - z) / 2, z, z, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject; img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------- Student dashboard ---------------- */
function Student() {
  const [me, setMe] = useState(null);
  const [occ, setOcc] = useState([]);
  const [info, setInfo] = useState({ terms: '', notice: '' });
  const [terms, setTerms] = useState(!sessionStorage.getItem('terms'));
  const load = async () => { setMe(await api('/me')); setOcc((await api('/seats')).occupied); setInfo(await api('/terms')); };
  useEffect(() => { load(); }, []);
  if (!me) return <p>Loading…</p>;
  const toggle = async () => { await api('/me/checkin', { method: 'POST' }); load(); };
  const owes = me.pendingMonths.length > 0;
  return (<>
    {terms && (
      <div className="modal"><div className="card">
        <h3>⚠️ Terms &amp; Conditions</h3>
        <p style={{ whiteSpace: 'pre-line' }}>{info.terms}</p>
        <button className="btn" onClick={() => { sessionStorage.setItem('terms', '1'); setTerms(false); }}>I Agree &amp; Continue</button>
      </div></div>
    )}
    <div className="card">
      <h2>Welcome, {me.name}</h2>
      <p>Seat <b>{me.seat}</b> · {SH[me.shift]} · {me.job}</p>
      <p>Today: <span className={'pill ' + (me.present ? 'ok' : 'bad')}>{me.present ? 'Present' : 'Absent'}</span>{' '}
         Fee: <span className={'pill ' + (owes ? 'bad' : 'ok')}>{me.feeState}</span></p>
    </div>
    {info.notice && <div className="card" style={{ borderLeft: '5px solid var(--gold)' }}><b>📢 Notice board</b><p style={{ whiteSpace: 'pre-line' }}>{info.notice}</p></div>}
    {owes && <div className="card" style={{ borderLeft: '5px solid var(--bad)' }}>💰 <b>Fee reminder:</b> {me.feeState}. Please pay at the desk.</div>}
    {me.mustChange && <div className="card" style={{ borderLeft: '5px solid var(--gold)' }}>🔑 <b>Your password was reset by the admin.</b> Please change it below to a password only you know.</div>}
    <div className="card">
      <h3>⏱ Study Tracker</h3>
      <p>Today <b>{hm(me.todayMinutes)}</b> · This month <b>{hm(me.monthMinutes)}</b> · Streak <b>🔥 {me.streak} days</b></p>
      <button className="btn" onClick={toggle}>{me.checkedInAt ? 'Check Out' : 'Check In'}</button>
    </div>
    <Leaderboard />
    <FeeHistory me={me} />
    <IdCard me={me} reload={load} />
    <FeedbackBox />
    <PasswordBox />
    <div className="card"><h3>Seat Map</h3>
      <SeatMap me={i => i === me.seat} cls={i => (i === me.seat ? 'me' : occ.includes(i) ? 'occ' : 'free')} title={i => (i === me.seat ? 'Your seat' : occ.includes(i) ? 'Occupied' : 'Free')} />
    </div>
  </>);
}

function Leaderboard() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api('/leaderboard').then(setRows); }, []);
  const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
  return (
    <div className="card"><h3>🏆 Top Achievers This Month</h3>
      {rows.length ? rows.map((r, i) => <div key={i}>{medals[i]} {r.name}{r.me ? ' (you)' : ''} - {hm(r.minutes)}</div>) : 'Check in to appear here!'}
    </div>
  );
}

function FeeHistory({ me }) {
  const pays = [...me.payments].sort((a, b) => b.month.localeCompare(a.month));
  return (
    <div className="card"><h3>🧾 Fee History</h3>
      {pays.length ? pays.map(p => (
        <div key={p.month} style={{ padding: '3px 0' }}>{String(p.paidOn).slice(0, 10)} - paid for {p.month}{' '}
          <button className="pill ok" onClick={() => download(`/me/receipt/${p.month}`, `receipt-${p.receiptNo || p.month}.pdf`)}>Receipt</button></div>
      )) : 'No payments recorded yet.'}
    </div>
  );
}

function IdCard({ me, reload }) {
  const [err, setErr] = useState('');
  const upload = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { await api('/me/photo', { method: 'POST', body: { photo: await resizePhoto(f) } }); setErr(''); reload(); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="card"><h3>🪪 My ID Card</h3>
      {me.photo && <img src={me.photo} alt="Your photo" width="80" height="80" style={{ borderRadius: 10, objectFit: 'cover' }} />}
      <p className="hint">Upload your photo to show it on the card. The QR code holds only your ID number.</p>
      <input type="file" accept="image/*" onChange={upload} />
      <button className="btn" onClick={() => download('/me/idcard', 'idcard.pdf')}>Download ID Card (PDF)</button>
      <div className="msg">{err}</div>
    </div>
  );
}

function FeedbackBox() {
  const [list, setList] = useState([]);
  const [cat, setCat] = useState(CATS[0]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const load = () => api('/feedback/mine').then(setList);
  useEffect(() => { load(); }, []);
  const submit = async () => { try { await api('/feedback', { method: 'POST', body: { cat, msg } }); setMsg(''); setErr(''); load(); } catch (e) { setErr(e.message); } };
  return (
    <div className="card"><h3>📝 Feedback &amp; Complaints</h3>
      <select value={cat} onChange={e => setCat(e.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
      <textarea rows={3} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Write your message..." style={area} />
      <button className="btn" onClick={submit}>Submit</button><div className="msg">{err}</div>
      {list.map(f => (
        <div key={f._id} style={{ borderTop: '1px solid var(--line)', padding: '8px 0', marginTop: 8 }}>
          <b>{f.cat}</b> <span className={'pill ' + (f.status === 'open' ? 'bad' : 'ok')}>{f.status === 'open' ? 'Open' : 'Resolved'}</span>
          <div>{f.msg}</div>{f.reply && <div className="hint"><b>Reply:</b> {f.reply}</div>}
        </div>))}
    </div>
  );
}

function PasswordBox() {
  const [f, setF] = useState({ current: '', next: '' });
  const [m, setM] = useState({ t: '', ok: false });
  const save = async () => {
    try { await api('/me/password', { method: 'POST', body: f }); setF({ current: '', next: '' }); setM({ t: 'Password updated.', ok: true }); }
    catch (e) { setM({ t: e.message, ok: false }); }
  };
  return (
    <div className="card"><h3>🔑 Change Password</h3>
      <label>Current password</label><input type="password" value={f.current} onChange={e => setF({ ...f, current: e.target.value })} />
      <label>New password (min 6)</label><input type="password" value={f.next} onChange={e => setF({ ...f, next: e.target.value })} />
      <button className="btn" onClick={save}>Update</button><div className={'msg ' + (m.ok ? 'ok-msg' : '')}>{m.t}</div>
    </div>
  );
}

/* ---------------- Admin panel ---------------- */
function Admin({ isSuper }) {
  const [tab, setTab] = useState('students');
  const tabs = [['students', 'Students'], ['pending', 'Approvals'], ['map', 'Seat Map'], ['home', '🏠 Home Page'], ['notice', '📢 Notices'], ['feedback', '📝 Feedback'], ['messages', '✉️ Messages'],
    ...(isSuper ? [['backup', '💾 Backups'], ['admins', '👑 Manage Admins']] : [])];
  return (<>
    <div className="tabs">
      {tabs.map(([k, l]) => <button key={k} className="btn sec" onClick={() => setTab(k)}>{l}</button>)}
      <button className="btn" onClick={() => download('/admin/export.xlsx', 'students.xlsx')}>⬇ Excel</button>
      <button className="btn" onClick={() => download('/admin/export.pdf', 'students.pdf')}>⬇ PDF</button>
    </div>
    {tab === 'students' && <Students />}
    {tab === 'pending' && <Pending />}
    {tab === 'map' && <AdminMap />}
    {tab === 'home' && <HomeEditor />}
    {tab === 'notice' && <Notices />}
    {tab === 'feedback' && <FeedbackAdmin />}
    {tab === 'messages' && <Messages />}
    {tab === 'backup' && isSuper && <Backups />}
    {tab === 'admins' && isSuper && <Admins />}
  </>);
}

function Students() {
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState(null);
  const load = async () => { const r = await api('/admin/students'); setRows(r); setSel(s => s && r.find(x => x._id === s._id)); };
  useEffect(() => { load(); }, []);
  const act = async (id, path, method = 'POST', body) => {
    try { await api(`/admin/students/${id}${path}`, { method, body }); }
    catch (e) {
      if (e.data?.canSwapWith && confirm(`That seat is taken by ${e.data.canSwapWith}. Swap seats?`)) {
        try { await api(`/admin/students/${id}${path}`, { method, body: { ...body, swap: true } }); } catch (x) { alert(x.message); }
      } else alert(e.message);
    }
    load();
  };
  return (<>
    <div className="card scroll"><table>
      <thead><tr><th>Seat</th><th>Name</th><th>Email</th><th>Mobile</th><th>Preparing for</th><th>Shift</th><th>Attendance</th><th>Fee</th><th></th></tr></thead>
      <tbody>{rows.map(s => (
        <tr key={s._id}>
          <td><b>{s.seat}</b> <button onClick={() => { const n = prompt('New seat number (1-115)'); n && act(s._id, '/seat', 'PATCH', { seat: +n }); }}>✎</button></td>
          <td><button className="link" title="View details" onClick={() => setSel(s)}>{s.name}</button></td>
          <td>{s.email}</td><td>{s.phone}</td><td>{s.job}</td><td>{SH[s.shift]}</td>
          <td><button className={'pill ' + (s.present ? 'ok' : 'bad')} onClick={() => act(s._id, '/attendance')}>{s.present ? 'Present' : 'Absent'}</button></td>
          <td><button className={'pill ' + (s.pendingMonths.length ? 'bad' : 'ok')} title="Click to mark this month paid or unpaid" onClick={() => act(s._id, '/fee')}>{s.feeState}</button></td>
          <td><button onClick={async () => { const { temp } = await api(`/admin/students/${s._id}/reset-password`, { method: 'POST' }); alert('Temporary password: ' + temp); }}>🔑</button>{' '}
              <button onClick={() => confirm('Remove this student and free the seat?') && act(s._id, '', 'DELETE')}>✕</button></td>
        </tr>))}
      </tbody></table></div>
    {sel && <Details s={sel} close={() => setSel(null)} reload={load} />}
  </>);
}

function Details({ s, close, reload }) {
  const pay = async m => { await api(`/admin/students/${s._id}/fee`, { method: 'POST', body: { month: m } }); reload(); };
  const pays = [...s.payments].sort((a, b) => b.month.localeCompare(a.month));
  const last = [...s.payments].sort((a, b) => new Date(b.paidOn) - new Date(a.paidOn))[0];
  const rows = [['Seat', s.seat], ['Shift', SH[s.shift]], ['Preparing for', s.job], ['Email', s.email], ['Mobile', s.phone], ['Joined', String(s.joinedAt).slice(0, 10)],
    ['Today', s.checkedInAt ? 'Checked in (studying now)' : s.present ? 'Present' : 'Absent'], ['Study time this month', hm(s.monthMinutes)], ['Study streak', s.streak + ' days'],
    ['Fee status', s.feeState], ['Last fee paid', last ? `${String(last.paidOn).slice(0, 10)} (for ${last.month})` : 'Never paid'],
    ['Verified by OTP', s.emailVerified && s.waVerified ? 'Email and WhatsApp' : 'No']];
  return (
    <div className="modal"><div className="card" style={{ width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
      <h3>{s.name}</h3>
      <table><tbody>{rows.map(([k, v]) => <tr key={k}><td style={{ color: 'var(--mute)' }}>{k}</td><td><b>{v}</b></td></tr>)}</tbody></table>
      {s.pendingMonths.length > 0 && <><h4>Unpaid months ({s.pendingMonths.length})</h4>
        {s.pendingMonths.map(m => <div key={m} style={{ padding: '3px 0' }}>{m} <button className="pill ok" onClick={() => pay(m)}>Mark paid</button></div>)}</>}
      <h4>Fee history</h4>
      {pays.length ? pays.map(p => (
        <div key={p.month} style={{ padding: '3px 0' }}>{String(p.paidOn).slice(0, 10)} - paid for {p.month}{' '}
          <button className="pill ok" onClick={() => download(`/admin/students/${s._id}/receipt/${p.month}`, `receipt-${p.receiptNo || p.month}.pdf`)}>Receipt</button></div>
      )) : <p className="hint">No payments recorded.</p>}
      <button className="btn" onClick={() => download(`/admin/students/${s._id}/idcard`, 'idcard.pdf')}>🪪 ID Card</button>
      <button className="btn sec" onClick={close}>Close</button>
    </div></div>
  );
}

function Notices() {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState({ t: '', ok: false });
  useEffect(() => { api('/settings').then(s => setText(s.notice || '')); }, []);
  const saveBoard = async () => {
    try { await api('/settings', { method: 'PUT', body: { notice: text } }); setMsg({ t: 'Saved to the students’ notice board.', ok: true }); }
    catch (e) { setMsg({ t: e.message, ok: false }); }
  };
  const send = async () => {
    if (!text.trim() || !confirm('Send this notice on WhatsApp to every approved student?')) return;
    setMsg({ t: 'Sending… this can take a minute.', ok: true });
    try { const d = await api('/admin/notice/send', { method: 'POST', body: { text } }); setMsg({ t: `Sent to ${d.sent} students, ${d.failed} failed.`, ok: d.failed === 0 }); }
    catch (e) { setMsg({ t: e.message, ok: false }); }
  };
  return (
    <div className="card"><h3>📢 Notices</h3>
      <p className="hint">The text is shown on every student's dashboard. You can also send it to all students on WhatsApp.</p>
      <textarea rows={6} value={text} onChange={e => setText(e.target.value)} style={area} />
      <button className="btn" onClick={saveBoard}>Save to notice board</button>
      <button className="btn sec" onClick={send}>Send on WhatsApp to all</button>
      <div className={'msg ' + (msg.ok ? 'ok-msg' : '')}>{msg.t}</div>
    </div>
  );
}

function FeedbackAdmin() {
  const [list, setList] = useState([]);
  const [replies, setReplies] = useState({});
  const load = () => api('/admin/feedback').then(setList);
  useEffect(() => { load(); }, []);
  const reply = async (f, status) => { await api(`/admin/feedback/${f._id}`, { method: 'PATCH', body: { reply: replies[f._id] ?? f.reply, status } }); load(); };
  return (
    <div className="card"><h3>📝 Feedback &amp; Complaints ({list.filter(f => f.status === 'open').length} open)</h3>
      {list.length === 0 && <p className="hint">No feedback yet.</p>}
      {list.map(f => (
        <div key={f._id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
          <b>{f.cat}</b> - {f.name} (Seat {f.seat}) <span className={'pill ' + (f.status === 'open' ? 'bad' : 'ok')}>{f.status === 'open' ? 'Open' : 'Resolved'}</span>
          <small style={{ color: 'var(--mute)' }}> {String(f.createdAt).slice(0, 10)}</small>
          <div>{f.msg}</div>
          <input defaultValue={f.reply} placeholder="Reply (optional)" onChange={e => setReplies({ ...replies, [f._id]: e.target.value })} style={{ marginTop: 6 }} />
          <div style={{ marginTop: 6 }}>
            <button className="pill ok" onClick={() => reply(f, 'resolved')}>{f.status === 'open' ? 'Reply & Resolve' : 'Update reply'}</button>{' '}
            <button className="pill bad" onClick={async () => { await api(`/admin/feedback/${f._id}`, { method: 'DELETE' }); load(); }}>Delete</button>
          </div>
        </div>))}
    </div>
  );
}

function Backups() {
  const [files, setFiles] = useState([]);
  const [msg, setMsg] = useState({ t: '', ok: false });
  const load = async () => setFiles(await api('/super/backups'));
  useEffect(() => { load(); }, []);
  const run = async () => { try { const d = await api('/super/backups/run', { method: 'POST' }); setMsg({ t: 'Saved ' + d.file, ok: true }); load(); } catch (e) { setMsg({ t: e.message, ok: false }); } };
  const doRestore = async body => {
    if (!confirm('Replace ALL current data with this backup? A safety copy of the current data is saved first.')) return;
    try { await api('/super/restore', { method: 'POST', body }); setMsg({ t: 'Restored. Please log in again if your account changed.', ok: true }); load(); }
    catch (e) { setMsg({ t: e.message, ok: false }); }
  };
  const fromFile = async e => { const f = e.target.files[0]; if (!f) return; try { doRestore(JSON.parse(await f.text())); } catch { setMsg({ t: 'This is not a valid backup file.', ok: false }); } };
  return (
    <div className="card"><h3>💾 Backups</h3>
      <p className="hint">The server saves a backup every Sunday at 3 AM and keeps the latest 12. Backups include password hashes, so keep them private.</p>
      <button className="btn" onClick={run}>Back up now</button>
      <button className="btn sec" onClick={() => download('/super/backups/live', 'achievers-backup.json')}>Download current data</button>
      <label>Restore from a backup file (.json)</label><input type="file" accept=".json,application/json" onChange={fromFile} />
      <h4>Saved on the server</h4>
      {files.length === 0 && <p className="hint">No backups yet.</p>}
      {files.map(f => (
        <div key={f} style={{ padding: '3px 0' }}>{f}{' '}
          <button className="pill ok" onClick={() => download(`/super/backups/file/${f}`, f)}>Download</button>{' '}
          <button className="pill bad" onClick={() => doRestore({ name: f })}>Restore</button></div>))}
      <div className={'msg ' + (msg.ok ? 'ok-msg' : '')}>{msg.t}</div>
    </div>
  );
}


function Pending() {
  const [rows, setRows] = useState([]);
  const [seats, setSeats] = useState({});
  const [err, setErr] = useState('');
  const load = async () => setRows(await api('/admin/pending'));
  useEffect(() => { load(); }, []);
  const approve = async s => { try { await api(`/admin/students/${s._id}/approve`, { method: 'POST', body: { seat: seats[s._id] } }); setErr(''); load(); } catch (e) { setErr(e.message); } };
  const reject = async s => { if (confirm('Reject and delete this registration?')) { await api(`/admin/students/${s._id}`, { method: 'DELETE' }); load(); } };
  return (
    <div className="card"><h3>Pending approvals ({rows.length})</h3><div className="msg">{err}</div>
      {rows.map(s => (
        <div key={s._id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
          <b>{s.name}</b> · {SH[s.shift]} · {s.job}<br /><small>{s.email} | {s.phone}</small><br />
          <input style={{ width: 160 }} type="number" placeholder="Seat (blank = auto)" onChange={e => setSeats({ ...seats, [s._id]: e.target.value })} />
          <button className="btn" onClick={() => approve(s)}>Approve &amp; allot seat</button>
          <button className="btn sec" onClick={() => reject(s)}>Reject</button>
        </div>))}
    </div>
  );
}

function AdminMap() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api('/admin/students').then(setRows); }, []);
  const on = i => rows.filter(s => s.seat === i);
  return (
    <div className="card"><h3>Seat Map</h3>
      <SeatMap shared={i => on(i).length > 1} cls={i => (!on(i).length ? 'free' : on(i).some(s => s.present) ? 'ok' : 'bad')}
               title={i => `Seat ${i}: ` + (on(i).map(s => `${s.name} (${SH[s.shift]})`).join(', ') || 'Free')} />
      <small>Indigo = free, green = present today, red = absent. * = shared by a Morning and an Evening student. Hover for names.</small>
    </div>
  );
}

function Admins() {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const load = async () => setRows(await api('/super/admins'));
  useEffect(() => { load(); }, []);
  const add = async () => { try { await api('/super/admins', { method: 'POST', body: f }); setF({ name: '', email: '', password: '' }); setErr(''); load(); } catch (e) { setErr(e.message); } };
  return (
    <div className="card"><h3>Manage admins</h3>
      {rows.map(a => (
        <div key={a._id} style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
          <b>{a.name}</b> – {a.email} <button className="pill bad" onClick={async () => { if (confirm('Delete this admin?')) { await api(`/super/admins/${a._id}`, { method: 'DELETE' }); load(); } }}>Delete</button>
        </div>))}
      <h4>Add admin</h4>
      <input placeholder="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <input placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={{ marginTop: 6 }} />
      <input type="password" placeholder="Password (min 6)" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} style={{ marginTop: 6 }} />
      <button className="btn" onClick={add}>Add admin</button><div className="msg">{err}</div>
    </div>
  );
}

const FIELDS = [
  ['terms', 'Terms & Conditions alert (shown to students after login)', 8],
  ['approved', 'WhatsApp message when a registration is approved. Use {{name}} and {{seat}}', 3],
  ['password_reset', 'WhatsApp message after a password reset. Use {{name}} and {{password}}', 3],
  ['otp_email', 'Email OTP text. Must contain {{otp}}', 3],
  ['otp_whatsapp', 'WhatsApp OTP text, used only when no template name is set below. Must contain {{otp}}', 3],
];

function Messages() {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState({ t: '', ok: false });
  useEffect(() => { api('/settings').then(setF); }, []);
  if (!f) return <p>Loading…</p>;
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    try { setF(await api('/settings', { method: 'PUT', body: f })); setMsg({ t: 'Saved. The new messages are used from now on.', ok: true }); }
    catch (e) { setMsg({ t: e.message, ok: false }); }
  };
  return (
    <div className="card">
      <h3>Messages &amp; alerts</h3>
      {FIELDS.map(([k, label, rows]) => (
        <div key={k}><label>{label}</label>
          <textarea rows={rows} value={f[k]} onChange={set(k)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', font: 'inherit' }} /></div>
      ))}
      <label>Monthly fee printed on receipts (Rs.)</label><input type="number" value={f.fee_amount} onChange={set('fee_amount')} />
      <h4>WhatsApp OTP template (Meta)</h4>
      <p className="hint">In production WhatsApp only delivers OTPs sent with a template that Meta has approved. Enter the approved template name here. The wording of an approved template can only be changed in Meta Business Manager, and a changed template must be approved again.</p>
      <label>Approved template name (leave empty to send the plain text above)</label><input value={f.wa_otp_template} onChange={set('wa_otp_template')} />
      <label>Template language code</label><input value={f.wa_otp_lang} onChange={set('wa_otp_lang')} />
      <label>Does the template have a copy-code button?</label>
      <select value={f.wa_otp_button} onChange={set('wa_otp_button')}><option value="no">No</option><option value="yes">Yes</option></select>
      <button className="btn" onClick={save}>Save</button>
      <div className={'msg ' + (msg.ok ? 'ok-msg' : '')}>{msg.t}</div>
    </div>
  );
}
