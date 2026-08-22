/** Ключевая позиция. В таблице стоит НАКЛОННО, как ключ, оставленный в замке;
 *  наклон даёт CSS (rotate), здесь — только геометрия. */
export function KeyMark() {
  return (
    <svg viewBox="0 0 28 18" aria-hidden="true">
      <g fill="none" stroke="var(--cu-tone-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="9" r="5" />
        <circle cx="7" cy="9" r="1.9" strokeWidth="1.3" />
        <path d="M12 9 H25.5" />
        <path d="M19.5 9 V13.4" />
        <path d="M23 9 V12.2" />
      </g>
    </svg>
  );
}
