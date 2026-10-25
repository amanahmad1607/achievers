// Seat layout drawn from the hall sketch: three benches (1-73), left blocks (74-85),
// bottom wall (86-91) and a second room (92-115) with the entry table. Door is below seats 38 and 37.
const r = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const rev = (a, b) => r(a, b).reverse();

const POS = (() => {
  const p = {};
  const bench = (lx, rx, right, left) => {
    right.forEach((n, k) => (p[n] = [rx, 70 + k * 40]));
    left.forEach((n, k) => (p[n] = [lx, 70 + k * 40]));
  };
  bench(680, 736, rev(1, 12), rev(13, 24));
  bench(480, 536, r(26, 37), rev(38, 49));
  bench(280, 336, r(50, 61), rev(62, 73));
  p[25] = [680, 22];
  [[74, 75, 77, 76], [78, 79, 81, 80], [82, 83, 85, 84]].forEach((b, k) => {
    const y = 60 + k * 140;
    p[b[0]] = [20, y]; p[b[1]] = [68, y]; p[b[2]] = [20, y + 44]; p[b[3]] = [68, y + 44];
  });
  r(86, 91).forEach((n, k) => (p[n] = [20 + k * 50, 580]));
  [[[115, 114, 113, 112], [108, 109, 110, 111]], [[107, 106, 105, 104], [100, 101, 102, 103]], [[99, 98, 97, 96], [92, 93, 94, 95]]]
    .forEach((b, k) => {
      const y = 110 + k * 150;
      b[0].forEach((n, c) => (p[n] = [900 + c * 48, y]));
      b[1].forEach((n, c) => (p[n] = [900 + c * 48, y + 44]));
    });
  return p;
})();

// cls(i) -> 'free' | 'occ' | 'ok' | 'bad' | 'me'   title(i) -> tooltip text
// me(i) -> true for the logged-in student's seat (shows YOU)   shared(i) -> true when two shifts share the seat (shows *)
export default function SeatMap({ cls = () => 'free', title = () => '', me = () => false, shared = () => false }) {
  return (
    <div className="lscroll">
      <svg className="lay" viewBox="0 0 1110 650" role="img" aria-label="Seat layout of the hall">
        <path d="M12 8H810V620H590M470 620H12V8" style={{ stroke: 'var(--mute)', strokeWidth: 3, fill: 'none' }} />
        <path d="M470 620H590" style={{ stroke: 'var(--gold)', strokeWidth: 6 }} />
        <rect x="850" y="8" width="250" height="612" rx="4" style={{ stroke: 'var(--mute)', strokeWidth: 3, fill: 'none' }} />
        {[724, 524, 324].map(x => <rect key={x} x={x} y="64" width="12" height="490" rx="3" style={{ fill: 'var(--line)' }} />)}
        <rect x="900" y="30" width="140" height="56" rx="6" style={{ fill: 'none', stroke: 'var(--mute)', strokeWidth: 2, strokeDasharray: '5 4' }} />
        <text className="lbl" x="970" y="62">Entry table</text>
        <text className="lbl" x="530" y="642">Door</text>
        <text className="lbl" x="372" y="598">Water</text>
        {r(1, 115).map(i => {
          const [x, y] = POS[i];
          return (
            <g key={i} className={'sk ' + cls(i)}>
              <title>{title(i)}</title>
              <rect x={x} y={y} width="44" height="34" rx="8" />
              <text x={x + 22} y={y + (me(i) ? 12 : 17)}>{i}</text>
              {me(i) && <text className="yo" x={x + 22} y={y + 26}>YOU</text>}
              {shared(i) && <text className="yo" x={x + 38} y={y + 7}>*</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
