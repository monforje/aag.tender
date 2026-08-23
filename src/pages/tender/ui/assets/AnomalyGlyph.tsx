/** Аномалия — миниатюра собственного устройства ячейки: рамка с диагональной
 *  штриховкой. Глиф повторяет лечение, а не изобретает новое слово.
 *  Группа data-mk="hatch" нужна hover-анимации «сигнал» (селектор ищет её
 *  из CSS модулей потребителя — легенды и окна настроек). */
export function AnomalyGlyph() {
  return (
    <svg viewBox="0 0 17 17" aria-hidden="true">
      <g fill="none" stroke="var(--cu-tone-warning)" strokeWidth="1.6" strokeLinecap="round">
        <rect x="1.5" y="1.5" width="14" height="14" rx="3" />
        <g data-mk="hatch">
          <path d="M4 9.5 L9.5 4" />
          <path d="M4.5 13 L13 4.5" />
          <path d="M7.5 13 L13 7.5" />
        </g>
      </g>
    </svg>
  );
}
