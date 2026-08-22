/** Дороже медианы — «леденец» над пунктиром уровня. Группа data-mk="rise"
 *  нужна hover-анимации подъёма (селектор ищет её из CSS модуля таблицы). */
export function MedMark() {
  return (
    <svg viewBox="0 0 22 19" aria-hidden="true">
      <g fill="none" stroke="var(--cu-tone-neutral-ink)" strokeLinecap="butt">
        <g data-mk="rise">
          <path d="M11 15.7 V7" strokeWidth="1.8" />
          <circle cx="11" cy="6" r="2.4" fill="var(--cu-tone-neutral-ink)" />
        </g>
        <path d="M2 15 H20" strokeWidth="1.4" strokeDasharray="2 1.2" />
      </g>
    </svg>
  );
}
