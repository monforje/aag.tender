/** Запас торга — монета со знаком рубля. Тон info: зелёный занят минимумом,
 *  иначе пара сливалась бы в одно пятно. */
export function CoinMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="var(--cu-tone-info)" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="6.6" strokeOpacity=".4" strokeWidth="1" />
        <text x="12" y="15.4" textAnchor="middle" fill="var(--cu-tone-info)" stroke="none" fontSize="9" fontWeight="700">₽</text>
      </g>
    </svg>
  );
}
