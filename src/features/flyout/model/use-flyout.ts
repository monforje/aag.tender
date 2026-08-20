import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { SectionId } from '@/entities/section';

const OPEN_DELAY = 90;
const CLOSE_DELAY = 180;
/** Половина высоты «носика» (18px): им центрируют стрелку по пункту рейла. */
const ARROW_HALF = 9;

interface Params {
  /** Слот рейла: относительно него считается top стрелки и внутри него
   *  живёт position:fixed панели (§0.2(d)). */
  slotRef: RefObject<HTMLElement | null>;
  activeId: SectionId;
  sidebarOpen: boolean;
}

interface PreviewState {
  openId: SectionId | null;
  arrowTop: number;
  /** Панель уже была на экране — вход не анимируем, меняется только
   *  содержимое (класс .no-animation в эталоне). */
  noAnimation: boolean;
}

/** §4.5 + ПРАВКА 5.2 — жизненный цикл превью-панели.
 *
 *  Задержки асимметричны намеренно: 90ms на открытие гасят вспышки при беглом
 *  проезде мыши вдоль рейла, 180ms на закрытие дают перейти на соседний пункт
 *  без мигания — mouseenter соседа успевает снять отложенное закрытие.
 *
 *  flyoutAllowed(): превью запрещено ровно в одном случае — sidebar раскрыт И
 *  это активный раздел, потому что панель дублировала бы то, что и так видно.
 *  При свёрнутом сайдбаре превью разрешено всем пунктам.
 *
 *  Главный урок бага из ПРАВКИ 5.2: отменив отложенное закрытие, обязательно
 *  назначь замену. Раньше на запрещённом пункте код делал clearTimeout и
 *  выходил по return — чужая панель оставалась висеть. Поэтому здесь вместо
 *  тихого return вызывается close(), идемпотентный. */
export function useFlyout({ slotRef, activeId, sidebarOpen }: Params) {
  const [state, setState] = useState<PreviewState>({
    openId: null, arrowTop: 0, noAnimation: false,
  });

  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  /** Читаются внутри таймеров: к моменту срабатывания состояние могло
   *  измениться, а замыкание держало бы старое. */
  const latest = useRef({ activeId, sidebarOpen, openId: state.openId });
  latest.current = { activeId, sidebarOpen, openId: state.openId };

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  const close = useCallback(() => {
    clearTimers();
    setState((prev) => (prev.openId === null ? prev : { ...prev, openId: null }));
  }, [clearTimers]);

  const allowed = useCallback(
    (id: SectionId) => !(latest.current.sidebarOpen && id === latest.current.activeId),
    [],
  );

  const open = useCallback((id: SectionId, trigger: HTMLElement) => {
    const slot = slotRef.current;
    if (!slot) return;
    const slotRect = slot.getBoundingClientRect();
    const rect = trigger.getBoundingClientRect();
    const arrowTop = Math.round(rect.top - slotRect.top + rect.height / 2 - ARROW_HALF);
    setState((prev) => ({ openId: id, arrowTop, noAnimation: prev.openId !== null }));
  }, [slotRef]);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(close, CLOSE_DELAY);
  }, [close]);

  /** Курсор вошёл в саму панель — отменяем отложенное закрытие, назначенное
   *  уходом с пункта рейла. Мостики-невидимки по краям (§4.4/§4.5) держат
   *  курсор «внутри» на пути от пункта к панели. */
  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const enter = useCallback((id: SectionId, trigger: HTMLElement) => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    if (!allowed(id)) {
      // Зашли на пункт, где превью запрещено (обычно — активная вкладка):
      // закрываем немедленно, а не полагаемся на чужой отложенный таймер.
      close();
      return;
    }
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    openTimer.current = window.setTimeout(() => {
      if (!allowed(id)) { close(); return; }  // состояние могло измениться за 90ms
      open(id, trigger);
    }, OPEN_DELAY);
  }, [allowed, close, open]);

  const leave = useCallback(() => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    scheduleClose();
  }, [scheduleClose]);

  const focus = useCallback((id: SectionId, trigger: HTMLElement) => {
    if (allowed(id)) open(id, trigger); else close();
  }, [allowed, close, open]);

  // Раскрытие сайдбара делает превью активного раздела дубликатом — закрываем.
  useEffect(() => {
    if (sidebarOpen && latest.current.openId === activeId) close();
  }, [sidebarOpen, activeId, close]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close]);

  // Незакрытые таймеры пережили бы размонтирование и дёрнули setState на
  // мёртвом компоненте — в эталоне за этим следил closeFlyout().
  useEffect(() => clearTimers, [clearTimers]);

  return {
    openId: state.openId,
    arrowTop: state.arrowTop,
    noAnimation: state.noAnimation,
    enter, leave, focus, close, scheduleClose, cancelClose,
  };
}
