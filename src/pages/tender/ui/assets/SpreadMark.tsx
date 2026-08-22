/** Высокий разброс — линейка размаха. Засечки data-mk="cap-l"/"cap-r"
 *  разъезжаются по hover: диапазон «дышит» шириной, а не качанием. */
export function SpreadMark() {
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true">
      <g fill="none" stroke="var(--cu-tone-danger)" strokeWidth="1.7" strokeLinecap="round">
        <path data-mk="cap-l" d="M3 4.8 V11.2" />
        <path d="M3 8 H21" strokeLinecap="butt" />
        <path data-mk="cap-r" d="M21 4.8 V11.2" />
        <circle cx="10.2" cy="8" r="2.1" fill="var(--cu-tone-danger)" stroke="none" />
      </g>
    </svg>
  );
}
