import { useLayoutEffect, useState, type RefObject } from 'react';
import { findScrollParent } from './scroll-parent';

/**
 * Потолок высоты блока сравнения: высота видимой области страницы минус её
 * нижний паддинг.
 *
 * КОГДА:  блок с собственной прокруткой (лента сравнения), который обязан
 *         занимать ровно остаток экрана: страница доскролливает вводные
 *         полосы, и дальше скроллится только он.
 * НЕ ДЛЯ: элементов, живущих в обычном потоке без своего скролла, — им
 *         потолок не нужен, их растит контент.
 *
 * UX:     формула «высота скроллблока страницы» выбрана не из эстетики. При
 *         ней вертикальный ход страницы заканчивается ровно на момент, когда
 *         верх блока встаёт на линию под шапкой экрана: дальше прокручивается
 *         только содержимое блока, и липкая шапка таблицы стоит на той же
 *         линии, что и раньше. Высоты сводки и вкладок в формулу не входят —
 *         они определяют лишь длину хода страницы, а не размер блока.
 * A11Y:   ничего не объявляет; размер — дело CSS-переменной у потребителя.
 */
export function useBandMaxHeight(ref: RefObject<HTMLElement | null>, active: boolean): number | undefined {
  const [max, setMax] = useState<number | undefined>(undefined);

  /* Layout-эффект, а не useEffect: потолок обязан встать ДО первой
     отрисовки — иначе блок на один кадр рождается во всю высоту контента,
     и страница прыгает. Прецедент — замер высоты в <Popover>. */
  useLayoutEffect(() => {
    /* Блок появляется вместе с данными (до того — заглушка), поэтому эффект
       перезапускается сменой `active`, а не висит на пустом ref навсегда. */
    const el = ref.current;
    const scroller = findScrollParent(el);
    if (!active || !el || !scroller) return;

    let raf = 0;
    /* Наблюдатель срабатывает и на ШИРИНУ — а её двигает каждый кадр анимации
       сайдбара и панели «Анализ ИИ», хотя потолок высоты от неё не зависит.
       Сравнение с прошлой высотой снимает с этих кадров getComputedStyle,
       то есть принудительный пересчёт стилей посреди чужой анимации. */
    let lastH = -1;
    const measure = () => {
      raf = 0;
      const h = scroller.clientHeight;
      if (h === lastH) return;
      lastH = h;
      const pad = parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
      setMax(h - pad);
    };
    /* rAF-троттлинг — как в useBandWidth, и по более острой причине. Здесь
       наблюдается ПРЕДОК, чью высоту потолок и определяет: getComputedStyle
       в самом колбэке ResizeObserver — синхронное чтение раскладки внутри
       той же раскладки, и обратная связь «замер → setState → новый размер»
       замыкается в тот же кадр. Кадр-задержка эту петлю разрывает. */
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(scroller);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, active]);

  return max;
}
