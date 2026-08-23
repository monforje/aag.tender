/** Ближайший прокручиваемый ПРЕДОК — по computed overflow-y, а не по классу
 *  CSS-модуля: имя хэшируется, и селектор через границу модулей не собрался бы
 *  (см. CLAUDE.md, «Стили»).
 *
 *  Поиск начинается с РОДИТЕЛЯ, а не с самого элемента: вызывающий стоит
 *  ВНУТРИ искомого скроллблока (лента сравнения ищет область страницы, чтобы
 *  знать свой потолок высоты). Элемент, который сам является скроллблоком,
 *  в этом поиске не ответ — его высоту он иначе и так знает. */
export function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}
