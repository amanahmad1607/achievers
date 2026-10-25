const today = () => new Date().toISOString().slice(0, 10);
export const monthNow = () => today().slice(0, 7);

// "2026-08" ... current month, starting from the month the student was approved
export function monthsFrom(d) {
  const out = []; let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  const [cy, cm] = monthNow().split('-').map(Number);
  while (y < cy || (y === cy && m <= cm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } }
  return out;
}

export function feeInfo(s) {
  const paid = new Set(s.payments.map(p => p.month));
  const pendingMonths = monthsFrom(s.joinedAt || new Date()).filter(m => !paid.has(m));
  const n = pendingMonths.length, feePaid = paid.has(monthNow());
  const feeState = n > 1 || (n === 1 && feePaid) ? `${n} month${n > 1 ? 's' : ''} pending`
    : feePaid ? 'Paid' : (new Date().getDate() > 5 ? 'Overdue' : 'Pending');
  return { feePaid, pendingMonths, feeState };
}

export function studyInfo(s) {
  const mins = s.studyMinutes || new Map();
  const live = s.checkedInAt ? (Date.now() - s.checkedInAt) / 60000 : 0;
  const get = d => (mins.get(d) || 0) + (d === today() ? live : 0);
  let month = live;
  for (const [k, v] of mins) if (k.startsWith(monthNow())) month += v;
  let streak = 0; const d = new Date();
  if (get(d.toISOString().slice(0, 10)) <= 0) d.setDate(d.getDate() - 1);
  while (get(d.toISOString().slice(0, 10)) > 0) { streak++; d.setDate(d.getDate() - 1); }
  return { todayMinutes: Math.round(get(today())), monthMinutes: Math.round(month), streak };
}
