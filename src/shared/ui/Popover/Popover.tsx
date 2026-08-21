import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './Popover.module.css';

/** Зазор между кнопкой и панелью и минимальный отступ от края экрана.
 *  Числами здесь, а не в CSS: по ним же считается, помещается ли панель
 *  снизу, — а замер живёт в JS. Разъехавшись, они дали бы панель, которая
 *  «помещается» по расчёту и вылезает на экране. */
const GAP = 4;
const EDGE = 12;

/**
 * Панель, привязанная к нажатому элементу, — нативный `<dialog>` без подложки.
 *
 * КОГДА:  меню или панель, которая падает из кнопки И обязана выйти за
 *         пределы своего контейнера: из ячейки таблицы с
 *         `overflow-x:auto`, из области прокрутки, из-под липкой шапки.
 *         Верхний слой умеет только `<dialog>` — обрезка родителем к z-index
 *         отношения не имеет, и никаким значением её не отменить.
 * НЕ ДЛЯ: выбора значения в полосе фильтров (см. <Dropdown> — он проще и
 *         умеет группы и мультивыбор); окна, ради которого прерывают работу
 *         (см. <Modal> — там подложка гасит фон и фокус заперт осмысленно);
 *         подсказки по наведению (это не панель, а текст).
 *
 * UX:     ПРИВЯЗКА ПРАВЫМ КРАЕМ, а не левым: панель растёт ВЛЕВО от кнопки.
 *         Кнопки, из которых её открывают, обычно стоят у правого края своего
 *         блока, и по левому краю на последней колонке панель уехала бы за
 *         экран.
 *         ОТКИДЫВАЕТСЯ ВВЕРХ, если снизу не помещается, — и тогда
 *         переворачивается вся анимация: и точка роста, и направление выезда.
 *         Иначе панель «выпадает» из кнопки в ту сторону, с которой её не
 *         открывали.
 *         ВЫСОТА МЕРЯЕТСЯ, а не берётся константой: у закрытого `<dialog>`
 *         layout'а нет вовсе (display:none), поэтому замер идёт сразу после
 *         showModal() — до отрисовки, так что скачка не видно. Константа же
 *         разъедется при первой правке содержимого.
 *         Появление И УХОД анимированы — см. .module.css, там же разбор,
 *         почему для `<dialog>` этого мало без allow-discrete.
 * A11Y:   Escape, клик мимо и возврат фокуса на кнопку — от платформы.
 *         Подложка прозрачная (затемнять за меню нечего), но она есть, и
 *         клик по ней приходит на сам `<dialog>` — на этом и держится
 *         закрытие. Собственное кольцо фокуса `<dialog>` снято: showModal()
 *         ставит фокус на саму панель, и рамка вокруг неё читается как лишний
 *         контур. Имя панели — проп `label`: видимого заголовка у меню нет.
 *
 * @example
 * const [at, setAt] = useState<DOMRect | null>(null);
 * <button onClick={(e) => setAt(e.currentTarget.getBoundingClientRect())}>…</button>
 * <Popover anchor={at} onClose={() => setAt(null)} label="Цвет колонки">
 *   <ColorPicker value={color} onChange={setColor} />
 * </Popover>
 */
export function Popover({ anchor, onClose, label, className, children }: {
  /** Прямоугольник элемента, из которого падает панель, — обычно
   *  `e.currentTarget.getBoundingClientRect()` в обработчике клика. `null`
   *  закрывает: открытость и место здесь одно состояние, а не два. */
  anchor: DOMRect | null;
  onClose: () => void;
  /** Имя панели для скринридера. */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  /* useLayoutEffect, а не useEffect: координаты обязаны встать ДО отрисовки.
     С обычным эффектом первый кадр панели показался бы в левом верхнем углу —
     ровно то, что и происходило, пока координаты шли через состояние React. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!anchor) {
      if (el.open) el.close();
      return;
    }

    /* Координаты — переменными на самом элементе, а не классом: значение
       считается по замеру и классом его не выразить. Не ближе EDGE к правому
       краю: кнопка может стоять почти у самого края прокрученной таблицы. */
    el.style.setProperty('--pop-right', `${Math.max(EDGE, Math.round(window.innerWidth - anchor.right))}px`);
    el.style.setProperty('--pop-top', `${Math.round(anchor.bottom + GAP)}px`);
    if (!el.open) el.showModal();

    /* Замер — только теперь: у закрытого <dialog> высоты нет. */
    const height = el.offsetHeight;
    const up = anchor.bottom + GAP + height > window.innerHeight - EDGE;
    el.toggleAttribute('data-up', up);
    if (up) el.style.setProperty('--pop-top', `${Math.max(EDGE, Math.round(anchor.top - GAP - height))}px`);
  }, [anchor]);

  return (
    <dialog
      ref={ref}
      className={cx(s.pop, className)}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}
    >
      {children}
    </dialog>
  );
}
