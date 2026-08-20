import { useCallback, useState, type UIEvent } from 'react';

/**
 * «Список уже прокручен?» — для липкой шапки, которой тень нужна только тогда,
 * когда под неё реально что-то уехало.
 *
 * Зачем вообще: пока список не прокручен, шапка — часть потока, и тень висела
 * бы бессмысленной полосой. Как только контент уходит ПОД неё, шапка
 * становится слоем над содержимым — тень это и объясняет. То есть тень здесь
 * не украшение, а сообщение о смене роли элемента.
 *
 * @example
 * const { scrolled, onScroll } = useScrolled();
 * <aside className={cx(s.panel, scrolled && s.isScrolled)}>
 *   <header />
 *   <ScrollArea variant="panel" onScroll={onScroll}>…</ScrollArea>
 * </aside>
 */
export function useScrolled() {
  const [scrolled, setScrolled] = useState(false);

  const onScroll = useCallback((e: UIEvent<HTMLElement>) => {
    const next = e.currentTarget.scrollTop > 0;
    setScrolled((prev) => (prev === next ? prev : next));
  }, []);

  return { scrolled, onScroll };
}
