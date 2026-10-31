const today = () => new Date().toISOString().slice(0, 10);

// One switch drives both the attendance status and the study timer:
//   checked in  = Present (inside the hall, timer running)
//   checked out = Absent (Leave) (timer stopped, minutes saved)
export function clockIn(st) {
  if (st.checkedInAt) return;
  st.checkedInAt = new Date();
  if (!st.presentOn.includes(today())) st.presentOn.push(today());   // history: attended today
}

export function clockOut(st) {
  if (!st.checkedInAt) return;
  st.studyMinutes.set(today(), (st.studyMinutes.get(today()) || 0) + (Date.now() - st.checkedInAt) / 60000);
  st.checkedInAt = null;
}