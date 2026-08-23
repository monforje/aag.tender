import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Видимая ширина элемента (clientWidth) с обновлением по ResizeObserver.
 *
 * КОГДА:  раскладке нужен фактический размер контейнера в пикселях —
 *         расчётчику ширин колонок ленты сравнения.
 * НЕ ДЛЯ: адаптивной вёрстки — для неё есть container queries; хук для
 *         случая, когда число нужно АЛГОРИТМУ, а не селектору.
 *
 * UX:     rAF-троттлинг обязателен: открытие панели «Анализ ИИ» двигает
 *         ширину каждый кадр анимации, и без него расчётчик пересчитывал бы
 *         раскладку чаще, чем браузер рисует. Вертикальный скроллбар уже
 *         исключён из clientWidth — «сколько видно» приходит честным числом.
 * A11Y:   ничего не объявляет; это измерение, а не интерфейс.
 */
export function useBandWidth(ref: RefObject<HTMLElement | null>, active: boolean): number | null {
  const [width, setWidth] = useState<number | null>(null);

  /* Layout-эффект: первое значение — до первой отрисовки (прецедент —
     <Popover>), иначе колонки на кадр встают без ширин вовсе. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      setWidth(el.clientWidth);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, active]);

  return width;
}
