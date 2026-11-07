const today = () => new Date().toISOString().slice(0, 10);
const KEEP_DAYS = 7;
const prune = st => { const cutoff = Date.now() - KEEP_DAYS * 864e5; st.sessions = st.sessions.filter(x => x.inAt.getTime() >= cutoff); };

// One switch drives both the attendance status and the study timer:
//   checked in  = Present (inside the hall, timer running)
//   checked out = Absent (Leave) (timer stopped, minutes saved)
export function clockIn(st) {
  if (st.checkedInAt) return;
  st.checkedInAt = new Date();
  st.sessions.push({ inAt: st.checkedInAt, outAt: null, auto: false });
  prune(st);
  if (!st.presentOn.includes(today())) st.presentOn.push(today());   // history: attended today
}

export function clockOut(st, auto = false) {
  if (!st.checkedInAt) return;
  const now = new Date();
  st.studyMinutes.set(today(), (st.studyMinutes.get(today()) || 0) + (now - st.checkedInAt) / 60000);
  const open = [...st.sessions].reverse().find(x => !x.outAt);
  if (open) { open.outAt = now; open.auto = auto; }
  else st.sessions.push({ inAt: st.checkedInAt, outAt: now, auto });   // student was already checked in before the history existed
  st.checkedInAt = null;
  prune(st);
}