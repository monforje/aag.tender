import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@/entities/workspace';
import { findScrollParent } from './scroll-parent';

/**
 * Док таблицы сравнения: ref на скроллблок ленты и вся логика прокрутки вокруг
 * неё — гейт «страница → лента», слежение за липкой шапкой с автосайдбаром
 * и доскролл к строке, подсвеченной из «Анализа».
 *
 * КОГДА:  блок со своей прокруткой (обе оси) внутри страницы, и поведению
 *         скролла есть что отвечать (гейт, сайдбар, подсветка строки).
 * НЕ ДЛЯ: элементов без собственного скролла — следить не за чем.
 *
 * UX:     ── гейт «страница → лента» ──
 *         Браузер отдаёт колесо внутреннему скроллблоку под курсором, а
 *         задуманная хореография другая: страница доезжает до линии, и только
 *         потом едет содержимое ленты. CSS это направление выразить не умеет,
 *         поэтому вертикальный жест перехватывается, ПОКА верх ленты ниже
 *         линии скроллпорта страницы, и целиком уходит странице
 *         (preventDefault + scrollBy). Обратно — симметрично: у верхней
 *         кромки стоящей на линии ленты жест забирает страница. Горизонталь
 *         (панорамирование колонок, shift+колесо) не трогается никогда.
 *         Следствие для сайдбара и бирки ИИ: пока не докатились,
 *         scrollTop === 0, и «шапка на линии» не врёт.
 *
 *         ── липкая шапка + автосайдбар ──
 *         Липкость шапки — нативный position:sticky (<Table stickyHead>):
 *         ближайший scrollport для <th> теперь сам блок ленты, поэтому шапка
 *         прилипает к его верхней кромке средствами движка. Вертикальный ход
 *         СТРАНИЦЫ заканчивается ровно тогда, когда верх блока встаёт под
 *         шапку экрана (потолок высоты блока — useBandMaxHeight), дальше
 *         едет только содержимое ленты. Приклейка плавна кадр в кадр, скролл
 *         вверх работает всегда — браузеру нечего «отменять».
 *
 *         JS остался только на сайдбар, и правило у него одно: движение ВНИЗ
 *         по ленте, пока её шапка стоит на линии (внутренний scrollTop > 0),
 *         прячет панель в рейл — КАЖДЫЙ раз. Памяти о прошлых прятаниях нет
 *         намеренно: панель могли раскрыть руками между делом (клик по рейлу)
 *         — «сработал один раз» оставлял бы её висеть над данными до конца
 *         сеанса. Вверх действует обратное: руку никто не догоняет, панель
 *         остаётся как есть. Горизонтальное панорамирование порог не трогает:
 *         интересует только вертикальная составляющая.
 *
 *         ── панорама средней кнопкой ──
 *         Зажатая средняя кнопка тащит содержимое ленты под курсором по обеим
 *         осям: на пяти-шести КП лента шире экрана всегда, а мыши без
 *         горизонтального колеса — норма, и единственной альтернативой была
 *         полоса прокрутки внизу, то есть увод курсора от данных. Родной
 *         автоскролл Chrome при этом гасится (иначе по ленте едут двое), а
 *         указатель захватывается — жест не рвётся на краю блока.
 *
 *         ИЗВЕСТНАЯ ГРАНИЦА: тач-драг гейтом не ловится — это другой тип
 *         жеста (wheel там не возникает), и ловить его значит писать свой
 *         скролл-движок. На таче лента скроллится напрямую.
 *
 * A11Y:   доскролл к строке — smooth: движение показывает, ГДЕ оказалась
 *         строка относительно прочитанного. Строки может не быть в DOM
 *         (фильтры спрятали или раздел свёрнут) — тогда тишина, карточка уже
 *         отдала свой текст. Клавиатурное панорамирование региона (фокус на
 *         рамке) гейтится сознательно: фокус = явное намерение крутить ленту.
 */
export function useTableDock({ focusRowId, onHeadStuckChange }: {
  /** Строка, подсвеченная из «Анализа»: по её появлению док доскроллит.
      Ищется по data-атрибуту (не по хэшированному классу). */
  focusRowId: string | null;
  /** Шапка встала на верхнюю линию блока (и стоит на ней) — наружу бейджу
      «Анализ ИИ»: в этот момент он висит над шапкой и складывается
      до иконки. Признак — внутренний скролл ленты: страница к этому моменту
      уже стоит на упоре. */
  onHeadStuckChange?: (stuck: boolean) => void;
}) {
  /* Скроллблок ленты: и точка замера, и сам скролл — одно и то же. */
  const dockRef = useRef<HTMLDivElement>(null);

  /* Колбэк и прошлое значение «на линии» — в рефах: эффект ниже подписан
     один раз ([]), а читать свежий колбэк и не спамить им на каждый тик
     скролла нужно именно оттуда. */
  const onHeadStuckRef = useRef(onHeadStuckChange);
  onHeadStuckRef.current = onHeadStuckChange;
  const headStuckRef = useRef(false);

  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;

    /* Порог «шапка стоит» / «лента докатилась»: пара пикселей гасит дробный
       шум тачпада вокруг нуля и расхождение rect'ов на субпиксели. */
    const EPS = 2;
    let lastTop = el.scrollTop;

    /* Скроллблок страницы ищется ОДИН раз на подписку, а не на каждое колесо:
       поиск идёт через getComputedStyle по цепочке предков, а тот посреди
       обработчика колеса ФОРСИРУЕТ пересчёт стилей — при прокрутке стили
       грязные каждый кадр (под курсором меняется наведённая строка).
       Предки ленты за время жизни подписки не меняются: эффект перезапускается
       вместе с самим блоком. Живыми остаются РАЗМЕРЫ (rect'ы ниже) — их и
       двигают открытие панели ИИ, перенос полосы и зум. */
    let scroller: HTMLElement | null = null;

    /* ── гейт «страница → лента» ──────────────────────────────────────────
        Non-passive намеренно: без preventDefault браузер продолжит крутить
        ленту параллельно со страницей. Замеры живые (rect'ы на каждое
        событие) — открытие панели ИИ, перенос полосы и зум меняют геометрию,
        гейт самоперенастраивается. Живые — именно РАЗМЕРЫ; сам скроллблок
        страницы найден один раз (см. `scroller` выше). */
    const onWheel = (e: WheelEvent) => {
      /* Горизонтальная доминанта — панорамирование колонок: не наше. */
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      scroller ??= findScrollParent(el);
      if (!scroller) return;

      /* Колесо обычно шлёт пиксели; режимы строки и страницы существуют. */
      const dy = e.deltaMode === 1
        ? e.deltaY * 16
        : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY;
      if (!dy) return;

      const docked =
        el.getBoundingClientRect().top - scroller.getBoundingClientRect().top <= EPS;
      const atTop = el.scrollTop <= EPS;
      const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - EPS;

      if (!docked || (atTop && dy < 0) || (atBottom && dy > 0)) {
        e.preventDefault();
        scroller.scrollTop += dy;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    /* ── панорама СРЕДНЕЙ КНОПКОЙ ─────────────────────────────────────────
        Лента на пяти-шести КП шире экрана всегда, а мышь без горизонтального
        колеса — норма: остаётся тащить полосу прокрутки внизу, то есть
        уводить курсор от данных, на которые смотришь. Зажатая средняя кнопка
        двигает содержимое под курсором по ОБЕИМ осям сразу — жест из карт и
        САПР, знакомый той же аудитории (решение владельца 24.08.2026).

        preventDefault на pointerdown обязателен: иначе Chrome вешает
        собственный автоскролл-«компас», и дальше по ленте едут двое. Захват
        указателя нужен по той же причине, по какой он нужен любому драгу —
        курсор, ушедший за край блока, не должен ронять жест на полпути.
        Скролл двигается ПРОТИВ движения мыши: тащим лист, а не рамку.
        Клавиатура своё уже имеет — стрелки на сфокусированном регионе. */
    let panFrom: number | null = null;
    /* Дельта считается по clientX/clientY, а НЕ по movementX/movementY:
       последние приходят от ОС в её собственных единицах — на масштабе
       дисплея, на удалённом рабочем столе и в автоматизации они то занижены,
       то нули. Разность двух своих же координат врать не умеет. */
    let panAt = { x: 0, y: 0 };
    const onPanStart = (e: PointerEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      panFrom = e.pointerId;
      panAt = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const onPanMove = (e: PointerEvent) => {
      if (panFrom === null) return;
      el.scrollLeft -= e.clientX - panAt.x;
      el.scrollTop -= e.clientY - panAt.y;
      panAt = { x: e.clientX, y: e.clientY };
    };
    const onPanEnd = (e: PointerEvent) => {
      if (panFrom === null) return;
      if (el.hasPointerCapture(panFrom)) el.releasePointerCapture(panFrom);
      panFrom = null;
      el.style.cursor = '';
      e.preventDefault();
    };
    /* Средний клик по ссылке открыл бы вкладку, по тексту в X11 — вставил бы
       буфер: жест закончился панорамой, и «клика» после него не было. */
    const onAuxClick = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };
    el.addEventListener('pointerdown', onPanStart);
    el.addEventListener('pointermove', onPanMove);
    el.addEventListener('pointerup', onPanEnd);
    el.addEventListener('pointercancel', onPanEnd);
    el.addEventListener('auxclick', onAuxClick);

    const evaluate = () => {
      const top = el.scrollTop;
      const down = top > lastTop;
      lastTop = top;

      const stuck = top > EPS;
      if (stuck !== headStuckRef.current) {
        headStuckRef.current = stuck;
        onHeadStuckRef.current?.(stuck);
      }

      if (!down || !stuck) return;
      const store = useWorkspaceStore.getState();
      if (store.sidebarOpen) store.setSidebarOpen(false);
    };

    el.addEventListener('scroll', evaluate, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', evaluate);
      el.removeEventListener('pointerdown', onPanStart);
      el.removeEventListener('pointermove', onPanMove);
      el.removeEventListener('pointerup', onPanEnd);
      el.removeEventListener('pointercancel', onPanEnd);
      el.removeEventListener('auxclick', onAuxClick);
    };
  }, []);

  /* Строка, подсвеченная из «Анализа»: доскроллить до неё. Smooth уместен —
      движение показывает, ГДЕ оказалась строка относительно прочитанного.
      Строки может не быть в DOM: фильтры её спрятали или раздел свёрнут —
      тогда просто тишина, карточка уже отдала свой текст. scrollIntoView
      сам выбирает нужный скроллблок — им стала лента. */
  useEffect(() => {
    if (!focusRowId) return;
    const el = dockRef.current?.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(focusRowId)}"]`,
    );
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusRowId]);

  return { dockRef };
}
