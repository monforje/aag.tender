import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type FocusEventHandler, type MouseEventHandler, type ReactNode, type RefCallback,
} from 'react';
import { cx } from '@/shared/lib/cx';
import type { Tone } from '@/shared/ui/Badge';
import s from './CellPopup.module.css';

/** Содержимое подсказки приходит ГОТОВЫМ: попап ничего не считает — числа
 *  и формулировки отдаёт ячейка (§4.6 аудита). */
export interface CellPopupData {
  tone?: Tone;
  title: string;
  /** Поля «подпись · значение». Значение прижато вправо: это числа. */
  fields: Array<{ label: string; value: ReactNode; tone?: boolean }>;
  /** Поле со шкалой: доля заливки 0…1, красится тоном карточки. */
  meter?: { label: string; value: ReactNode; fraction: number };
  /** Всё, что пояснение, а не число — причина аномалии, критерий минимума. */
  note?: string;
  /** ФАКТ, а не пояснение: «есть комментарий», «ещё 2 в истории». Отдельно от
   *  `note`, потому что читается иначе — это подпись о наличии чего-то за
   *  пределами подсказки, и текста того, на что она указывает, здесь нет
   *  намеренно (`cell.md` §3: подвал называет факт комментария, не цитирует
   *  его). Стоит ПОСЛЕ пояснения: сначала «почему так», потом «где ещё
   *  смотреть». */
  fact?: string;
}

export interface CellPopupTarget {
  /** Живая цель: прямоугольник меряется в момент показа и на resize. */
  el: HTMLElement;
  data: CellPopupData;
}

/** Обработчики цели подсказки. Типизированы по `HTMLElement`, а не по
 *  `'button'`: с §2.2 цель наведения — ТЕЛО ЯЧЕЙКИ, а оно бывает и кнопкой
 *  (обычная ячейка), и самой `<td>` (состояния без интерактива). React делает
 *  обработчики событий бивариантными, поэтому `HTMLElement`-версия
 *  раскладывается и на `<button>`, и на `<td>` без приведений. */
export type CellPopupBind = (data: CellPopupData) => {
  onMouseEnter: MouseEventHandler<HTMLElement>;
  onMouseLeave: MouseEventHandler<HTMLElement>;
  onFocus: FocusEventHandler<HTMLElement>;
  onBlur: FocusEventHandler<HTMLElement>;
  /** Раскрытие касанием — только на грубом указателе (§4.6). */
  onClick: MouseEventHandler<HTMLElement>;
};

/* Тайминги NN/g «Timing Guidelines for Exposing Hidden Content» (Д.5 аудита):
   показ после остановки курсора 350 мс — проход по столбцу не хлопает
   попапами; переезд между соседними целями мгновенный; сокрытие через 500 мс —
   этого хватает на мост курсора цель → панель.

   ОРИЕНТИР КАНОНА — ~500 мс (`interactions.md` §1), и 350 от него отличается
   сознательно: канон называет ОДНУ величину на экран, чтобы подсказки не
   появлялись вразнобой, а не конкретное число. 350 выбраны по замеру прохода
   по колонке из 65 строк: на 500 мс подсказка не успевала за курсором и
   читалась «сломанной», на 250 — хлопала при каждом проносе. Величина ОДНА на
   весь экран, что канон и требует. */
const SHOW_DELAY = 350;
const HIDE_DELAY = 500;
const ANIM_MS = 130;

/* ТАЧ: НАВЕДЕНИЯ НЕ БЫВАЕТ (§4.6, README §6). Браузер эмулирует hover после
   тапа нестабильно — где-то он приходит, где-то нет, где-то остаётся висеть
   до следующего тапа. Поэтому на грубом указателе цель раскрывается
   КАСАНИЕМ, и это не «ещё один обработчик на всякий случай»: без него канал
   тача не обеспечен вовсе, а канон делает его сквозным требованием.

   Проверка — медиа-запрос, а не userAgent: гибрид с мышью и сенсором
   получает оба канала честно, по тому, чем в него сейчас тычут. */
const coarsePointer = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches === true;

/**
 * Подсказка-объяснение пометки: нативный `<dialog>`, светлая карточка,
 * хвостик к цели.
 *
 * КОГДА:  объяснение пометки «почему так» по наведению или фокусу — причина
 *         аномалии, критерий минимума. Один попап на экран обслуживает все
 *         цели; механику даёт <useCellPopup>.
 * НЕ ДЛЯ: панелей по клику (см. <Popover>), окон с прерыванием работы
 *         (см. <Modal>) и носителя основной информации — важное живёт на
 *         странице, подсказка лишь отвечает на вопрос (NN/g).
 *
 * UX:     show(), а НЕ showModal(): top layer нужен ради выхода из
 *         overflow-x таблицы, модальность же делает остальную страницу inert
 *         — курсор не доходит до соседних ячеек, и подсказка «висит». Панель
 *         центрируется на цели вплотную (2px): хвостик читается продолжением
 *         пометки, а не принадлежностью соседней ячейки; у края экрана
 *         сдвигается целиком, но целится хвостиком туда же. Скролл закрывает
 *         немедленно — панель не «плывёт» над чужой строкой.
 * A11Y:   WCAG 1.4.13 полностью: dismissible (Escape), hoverable (мост
 *         курсора на панель), persistent (никаких автоскрытий по таймеру).
 *         Кольцо фокуса на самой панели снято: showModal-подсказка читалась
 *         бы как ошибка ввода; цели несут aria-describedby на панель.
 *
 * @example
 * const popup = useCellPopup();
 * <button {...popup.bind({ title: 'Минимальное значение', fields: […] })}>…</button>
 * {popup.view}
 */
export function useCellPopup() {
  const [target, setTarget] = useState<CellPopupTarget | null>(null);
  const [open, setOpen] = useState(false);
  const id = useId();

  const panelRef = useRef<HTMLDialogElement | null>(null);
  const activeElRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clearTimers = () => {
    clearTimeout(showTimer.current);
    clearTimeout(hideTimer.current);
    showTimer.current = hideTimer.current = undefined;
  };

  const detach = () => {
    activeElRef.current?.removeAttribute('aria-describedby');
    activeElRef.current = null;
  };

  const show = (el: HTMLElement, data: CellPopupData) => {
    clearTimers();
    detach();
    /* Имя цели + объяснение одним чтением скринридера. */
    el.setAttribute('aria-describedby', id);
    activeElRef.current = el;
    openRef.current = true;
    setTarget({ el, data });
    setOpen(true);
  };

  /** Спрятать; `now` — без анимации: строки пересозданы или пошёл скролл —
   *  панель не «плывёт» над чужой строкой ни одного кадра. */
  const close = (now = false) => {
    clearTimers();
    detach();
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    if (now) {
      setTarget(null);
      panelRef.current?.close();
      return;
    }
    /* Уйти после анимации, если никто не открыл заново. */
    hideTimer.current = setTimeout(() => {
      if (!openRef.current) setTarget(null);
    }, ANIM_MS);
  };

  const scheduleHide = () => {
    clearTimers();
    hideTimer.current = setTimeout(function grace() {
      /* Мост курсора: если курсор уже на панели — живём дальше (persistent),
         иначе прячем. */
      if (panelRef.current?.matches(':hover')) {
        hideTimer.current = setTimeout(grace, HIDE_DELAY);
        return;
      }
      close();
    }, HIDE_DELAY);
  };

  /* Контейнер целей делегирует события; логика одна на всех целях.
     ССЫЛОЧНО СТАБИЛЕН (useCallback без зависимостей): `bind` уходит пропом в
     КАЖДУЮ строку таблицы, и пересоздание на рендере лишало бы смысла memo у
     потребителя — строки перерисовывались бы от любого чужого движения
     (ширина ленты, звезда, перекраска колонки). Внутри он читает только
     рефы и setState, поэтому зависимостей у него нет по-настоящему, а не
     «отключены комментарием». */
  const bind: CellPopupBind = useCallback((data: CellPopupData) => ({
    onMouseEnter: (e) => {
      const el = e.currentTarget;
      clearTimers();
      /* Уже открыт — содержимое меняется на лету, без ожидания (reshow). */
      showTimer.current = setTimeout(() => show(el, data), openRef.current ? 0 : SHOW_DELAY);
    },
    onMouseLeave: (e) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      scheduleHide();
    },
    onFocus: (e) => show(e.currentTarget, data),
    onBlur: () => close(),
    /* Клик РАСКРЫВАЕТ на тач-устройстве и НЕ мешает мыши: на грубом
       указателе он единственный канал, на точном — цель обычно и так уже
       раскрыта наведением, а повторный show() лишь обновляет содержимое.
       Собственный onClick цели (карточка ячейки) при этом продолжает
       работать: два обработчика на одном элементе не конфликтуют. */
    onClick: (e) => { if (coarsePointer()) show(e.currentTarget, data); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  /* Escape снимает подсказку (dismissible): у немодального <dialog> платформа
     события cancel не шлёт. Скролл закрывает немедленно, на любом уровне. */
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onScroll = () => close(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [target]);

  useEffect(() => () => { clearTimers(); detach(); }, []);

  /* Стабильный колбэк: пересоздание каждый рендер заставляло бы React
     отвязывать и привязывать ref на каждом обновлении родителя. */
  const register = useCallback((el: HTMLDialogElement | null) => {
    panelRef.current = el;
  }, []);

  return {
    target,
    open,
    bind,
    close,
    /** Ref-колбэк для элемента панели: <CellPopup> сообщает себя хуку. */
    register,
    /** Готовая панель: вставляется один раз рядом с таблицей. */
    get view() {
      return (
        <CellPopupPanel
          id={id}
          target={target}
          open={open}
          register={register}
        />
      );
    },
  };
}

/* ── панель: позиционирование, слои, анимация ─────────────────────────────── */

const EDGE = 12;

function CellPopupPanel({ id, target, open, register }: {
  id: string;
  target: CellPopupTarget | null;
  open: boolean;
  register: RefCallback<HTMLDialogElement>;
}) {
  const elRef = useRef<HTMLDialogElement | null>(null);
  const setRef: RefCallback<HTMLDialogElement> = (el) => {
    elRef.current = el;
    register(el);
  };
  /* Последняя цель держится на время анимации ухода: без неё панели не за
     что быть, и она гасла бы с пустым содержимым. */
  const lastRef = useRef<CellPopupTarget | null>(null);
  if (target) lastRef.current = target;
  const shown = target ?? lastRef.current;

  const position = () => {
    const el = elRef.current;
    if (!el || !shown) return;
    const rect = shown.el.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const cx = rect.left + rect.width / 2;
    let left = cx - w / 2;
    let top = rect.bottom + 2;   /* вплотную: ромб дотягивается до кромки пометки */
    el.classList.remove(s.isAbove);
    if (top + h > window.innerHeight - EDGE) {
      top = rect.top - h - 2;
      el.classList.add(s.isAbove);
    }
    /* ЗАЖИМ — ПО ОБЛАСТИ КОНТЕНТА, А НЕ ПО ОКНУ (правка 25.08.2026). По окну
       подсказка первой колонки уезжала левым краем на рейл и сайдбар — то
       есть на КАРКАС, поверх которого ей делать нечего, — и там же пропадала
       под ним по слою. Хозяин области находится по самой цели (`closest`), а
       не приходит пропом: <CellPopup> обслуживает все цели экрана одним
       экземпляром, и знать про них он не обязан. Окно остаётся внешней
       границей: у области, которая шире экрана или уходит за него, побеждает
       она. */
    const host = shown.el.closest('main')?.getBoundingClientRect();
    const winMin = EDGE;
    const winMax = window.innerWidth - w - EDGE;
    const min = host ? Math.max(winMin, host.left + 4) : winMin;
    const max = host ? Math.min(winMax, host.right - w - 4) : winMax;
    left = Math.max(min, Math.min(left, Math.max(min, max)));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    /* Хвостик целится в центр цели, даже когда край экрана сдвинул панель. */
    el.style.setProperty('--arrow-x', `${Math.max(9, Math.min(cx - left, w - 9))}px`);
  };

  /* Координаты обязаны встать ДО отрисовки, как в <Popover>: замер возможен
     только после show() — layout'а у закрытого dialog нет вовсе. */
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el || !target) return;
    if (!el.open) el.show();
    position();
    el.classList.add(s.isVisible);
  }, [target]);

  /* Анимация ухода: класс гасит видимость, закрытие — после её конца. */
  useEffect(() => {
    const el = elRef.current;
    if (!el || open) return;
    el.classList.remove(s.isVisible);
    const t = setTimeout(() => { if (!el.classList.contains(s.isVisible)) el.close(); }, ANIM_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!target) return;
    const onResize = () => position();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [target]);

  if (!shown) return null;
  const { data } = shown;

  return (
    <dialog
      ref={setRef}
      id={id}
      role="tooltip"
      className={s.popup}
      data-tone={data.tone ?? 'neutral'}
      onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
    >
      <div className={s.head}>
        <span className={s.title}>{data.title}</span>
      </div>
      <div className={s.body}>
        {/* Ключ — ИНДЕКС, а не подпись: у перечислений («кто отказался»,
            «кто пропустил») подпись пустая и повторяется, и ключ по ней
            схлопнул бы такие строки в одну. Порядок полей задаёт вызывающий
            и внутри одного показа не меняет — перестановок, ради которых
            нужен стабильный ключ, здесь не бывает. */}
        {data.fields.map((field, i) => (
          <div key={i} className={s.field}>
            <span className={s.label}>{field.label}</span>
            {field.tone ? (
              <span className={cx(s.value, s.valueTone)}>{field.value}</span>
            ) : (
              <span className={s.value}>{field.value}</span>
            )}
          </div>
        ))}
        {data.meter ? (
          <div className={s.field} title="Шкала общая для всех строк: 25 % — вся длина">
            <span className={s.label}>{data.meter.label}</span>
            <span className={s.meter}>
              <span className={s.track}>
                <i style={{ width: `${Math.min(data.meter.fraction, 1) * 100}%` }} />
              </span>
              <span className={cx(s.value, s.valueTone)}>{data.meter.value}</span>
            </span>
          </div>
        ) : null}
      </div>
      {data.note || data.fact ? (
        <div className={s.foot}>
          {data.note ? <span className={s.note}>{data.note}</span> : null}
          {data.fact ? <span className={s.fact}>{data.fact}</span> : null}
        </div>
      ) : null}
    </dialog>
  );
}
