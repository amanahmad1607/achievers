import { Student } from './models.js';
export const TOTAL = 115;

// A seat fits a shift if it is empty, or (for Morning/Evening) shared only with the other half-day shift.
export async function canSeat(shift, n, excludeId) {
  if (!Number.isInteger(n) || n < 1 || n > TOTAL) return false;
  const on = await Student.find({ seat: n, status: 'approved', _id: { $ne: excludeId } });
  return !on.length || (shift !== 'F' && on.every(o => o.shift !== 'F' && o.shift !== shift));
}

export async function nextSeat(shift = 'F', excludeId) {
  const all = await Student.find({ status: 'approved', _id: { $ne: excludeId } }, 'seat shift');
  const by = new Map();
  all.forEach(s => by.set(s.seat, [...(by.get(s.seat) || []), s.shift]));
  for (let i = 1; i <= TOTAL; i++) {
    const on = by.get(i) || [];
    if (!on.length || (shift !== 'F' && on.every(x => x !== 'F' && x !== shift))) return i;
  }
  return null;
}
