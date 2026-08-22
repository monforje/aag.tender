/* ГЛИФЫ ПОМЕТОК СРАВНЕНИЯ КП — перенесены из filter_audit/badges.html
   (ассеты tag/key/median/spread/potential/anomaly-final.svg) один в один,
   цвета заменены на тоновые токены проекта. Размер и толщина задаёт CSS
   (.tag svg / .predicate__glyph svg), не пропы — как у <Icon>.

   Это пометки ДОМЕНА, а не интерфейсные иконки: у каждой свой смысл, своя
   геометрия и своя точка подвеса, поэтому они живут рядом с таблицей, а не в
   общем icon-map. Все aria-hidden — смысл несёт текст ячейки и попап, глиф
   лишь форма того же сообщения (правило «цвет + форма» из Части I спеки).

   Потребители импортируют ТОЛЬКО отсюда: `@/pages/tender/ui/assets` внутри
   слайса — `./assets` в соседних файлах ui/. */

export { AnomalyGlyph } from './AnomalyGlyph';
export { CoinMark } from './CoinMark';
export { KeyMark } from './KeyMark';
export { MedMark } from './MedMark';
export { SpreadMark } from './SpreadMark';
