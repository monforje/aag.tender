/** Ценник-бирка «мин». Наклон 12° вокруг центра ПРОКОЛА зашит в геометрию:
 *  точка подвеса и ось качания совпадают, поэтому бирка качается физически
 *  честно. Нить провисает кривой Безье — под собственным весом, не струной.
 *
 *  Кегль «МИН» подогнан к рендеру в 38px ширины: 10.5 единиц viewBox дают
 *  ≈7.7px знака; базовая линия y=21.5 держит капс по оптической середине
 *  тела бирки (тело 5…29, центр 17, капс ≈9.5 → базовая ≈21.75). */
export function TagMark() {
  return (
    <svg viewBox="0 0 52 40" aria-hidden="true">
      <g transform="rotate(12 10 17)">
        <path
          fill="var(--cu-tone-success)" fillRule="evenodd"
          d="M 11 5 L 43 5 Q 47 5 47 9 L 47 25 Q 47 29 43 29 L 11 29 L 4.2 21.4 Q 2.5 19.4 2.5 17 Q 2.5 14.6 4.2 12.6 Z M 12.2 17 a 2.2 2.2 0 1 0 -4.4 0 a 2.2 2.2 0 1 0 4.4 0 Z"
        />
        <circle cx="10" cy="17" r="3.6" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="1.2" />
        <text x="29" y="21.5" textAnchor="middle" fill="#fff" fontSize="10.5" fontWeight="700" letterSpacing=".6">МИН</text>
      </g>
      <path fill="none" stroke="var(--cu-tone-success)" strokeWidth="1.1" strokeLinecap="round" d="M 1.5 .5 C 1.7 7.5 4.2 12.8 8.6 16" />
    </svg>
  );
}
