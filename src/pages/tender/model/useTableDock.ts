import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@/entities/workspace';

/** Ближайший прокручиваемый предок — область страницы (.scroll-area--page).
 *  Ищется по computed overflow-y, а не по классу CSS-модуля: имя хэшируется,
 *  и селектор через границу модулей не собрался бы (см. CLAUDE.md, «Стили»). */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Док таблицы сравнения: ref на обёртку ленты и вся логика прокрутки вокруг
 * неё — слежение за липкой шапкой с автосайдбаром и доскролл к строке,
 * подсвеченной из «Анализа».
 *
 * КОГДА:  таблица со stickyHead внутри прокручиваемой области страницы, и
 *         поведению скролла есть что отвечать (сайдбар, подсветка строки).
 * НЕ ДЛЯ: собственной прокрутки таблицы — лента катается сама; хук смотрит
 *         только на вертикальный скролл СТРАНИЦЫ.
 *
 * UX:     ── липкая шапка + автосайдбар ──
 *         Липкость шапки — нативный position:sticky (<Table stickyHead>): её
 *         прибирает к скроллу страницы сам движок, и в цикле прокрутки нет ни
 *         строчки JS. Отсюда два свойства, за которые эта версия отвечает:
 *         приклейка плавна кадр в кадр (никаких переключений геометрии) и
 *         скролл вверх работает всегда, с первого тика — браузеру нечего
 *         «отменять».
 *
 *         JS остался только на сайдбар, и правило у него одно: движение ВНИЗ,
 *         пока шапка стоит на линии (или уже приклеена), прячет панель в рейл —
 *         КАЖДЫЙ раз. Памяти о прошлых прятаниях нет намеренно: панель могли
 *         раскрыть руками между делом (клик по рейлу) — «сработал один раз»
 *         оставлял бы её висеть над данными до конца сеанса. Вверх действует
 *         обратное: руку никто не догоняет, панель остаётся как есть.
 *
 *         Порог читается с DOM, а не из арифметики высот: всё над таблицей
 *         меняет высоту вместе с шириной <main>, считать его вручную значило бы
 *         гоняться за раскладкой. Скроллы внутри самой таблицы и горизонтальное
 *         панорамирование порогом не управляют — интересует только вертикальная
 *         прокрутка страницы.
 * A11Y:   доскролл к строке — smooth: движение показывает, ГДЕ оказалась
 *         строка относительно прочитанного. Строки может не быть в DOM
 *         (фильтры спрятали или раздел свёрнут) — тогда тишина, карточка уже
 *         отдала свой текст.
 */
export function useTableDock({ focusRowId, onHeadStuckChange }: {
  /** Строка, подсвеченная из «Анализа»: по её появлению док доскроллит.
      Ищется по data-атрибуту (не по хэшированному классу). */
  focusRowId: string | null;
  /** Липкая шапка встала на верхнюю линию области страницы (и стоит на ней)
      — наружу бейджу «Анализ ИИ»: в этот момент он висит прямо над шапкой
      таблицы и складывается до иконки. */
  onHeadStuckChange?: (stuck: boolean) => void;
}) {
  /* Точка замера порога сайдбара: верх этого блока = верх ленты. Сама
     липкость шапки живёт в <Table stickyHead> и CSS, не здесь. */
  const dockRef = useRef<HTMLDivElement>(null);

  /* Колбэк и прошлое значение «на линии» — в рефах: эффект ниже подписан
     один раз ([]), а читать свежий колбэк и не спамить им на каждый тик
     скролла нужно именно оттуда. */
  const onHeadStuckRef = useRef(onHeadStuckChange);
  onHeadStuckRef.current = onHeadStuckChange;
  const headStuckRef = useRef(false);

  useEffect(() => {
    const el = dockRef.current;
    const scroller = findScrollParent(el);
    if (!el || !scroller) return;

    let lastTop = scroller.scrollTop;

    const evaluate = () => {
      const top = scroller.scrollTop;
      const down = top > lastTop;
      lastTop = top;

      /* «Шапка на линии» верно и для давно приклеенной: sticky держит её у
         верхнего края области всю прокрутку таблицы. */
      const atLine =
        el.getBoundingClientRect().top <= scroller.getBoundingClientRect().top;

      if (atLine !== headStuckRef.current) {
        headStuckRef.current = atLine;
        onHeadStuckRef.current?.(atLine);
      }

      if (!down || !atLine) return;
      const store = useWorkspaceStore.getState();
      if (store.sidebarOpen) store.setSidebarOpen(false);
    };

    const onScroll = (e: Event) => {
      if (e.target instanceof Node && el.contains(e.target)) return;
      evaluate();
    };
    const ro = new ResizeObserver(evaluate);
    ro.observe(scroller);
    scroller.addEventListener('scroll', onScroll);
    evaluate();

    return () => {
      ro.disconnect();
      scroller.removeEventListener('scroll', onScroll);
    };
  }, []);

  /* Строка, подсвеченная из «Анализа»: доскроллить до неё. Smooth уместен —
     движение показывает, ГДЕ оказалась строка относительно прочитанного.
     Строки может не быть в DOM: фильтры её спрятали или раздел свёрнут —
     тогда просто тишина, карточка уже отдала свой текст. */
  useEffect(() => {
    if (!focusRowId) return;
    const el = dockRef.current?.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(focusRowId)}"]`,
    );
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusRowId]);

  return { dockRef };
}
