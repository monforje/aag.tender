import {
  useCallback, useEffect, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type ReactNode,
} from 'react';
import { cx } from '@/shared/lib/cx';
import s from './Dropdown.module.css';

/** Пропсы, которые компонент отдаёт триггеру. Разметка самого триггера у всех
 *  четырёх дропдаунов разная, поэтому её пишет родитель, а поведение — здесь. */
export interface DropdownTriggerProps {
  type: 'button';
  onClick: () => void;
  'aria-haspopup': true;
  'aria-expanded': boolean;
  /** Стрелки открывают меню с фокусом в списке — паттерн ARIA APG ([R2]). */
  onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
}

interface DropdownProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  menu: ReactNode;
  /** Меню выравнивается по левому краю (воркспейс-пикер). */
  menuAlign?: 'left' | 'right';
  /** Закрывать меню по клику внутри. Верно для меню-списка («выбрал пункт и
   *  ушёл») и НЕВЕРНО для мультивыбора и панелей с календарём: там значения
   *  отмечают сериями, а выходят кнопкой «Готово», Escape или кликом мимо.
   *  Раньше такие панели глушили всплытие у себя внутри (stopPropagation в
   *  каждом содержимом) — фокус, о котором приходилось помнить в трёх местах
   *  сразу; теперь это свойство меню, а не забота его содержимого. */
  closeOnSelect?: boolean;
  /** Куда ставит фокус открытие стрелками: в первый/последний пункт или в
   *  отмеченный — меню одиночного выбора по APG открывается на текущем
   *  значении, а не в начале списка. У длинных списков это же спасает от
   *  прыжка прокрутки к первому пункту. */
  initialFocus?: 'first' | 'last' | 'checked';
  className?: string;
  children: (trigger: DropdownTriggerProps) => ReactNode;
}

export function Dropdown({
  open, onToggle, onClose, menu, menuAlign = 'right', closeOnSelect = true,
  initialFocus = 'first', className, children,
}: DropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  /* Куда вернуть фокус по Escape: триггер, с которого меню открыли. Запоминаем
     элемент в момент нажатия — рефом триггер не обязан быть. */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<'first' | 'last' | 'checked' | null>(null);

  const items = (): HTMLElement[] =>
    [...(rootRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];

  /* Открытие стрелками ставит фокус в пункт по initialFocus — после того,
     как меню реально отрендерится, поэтому через эффект. */
  useEffect(() => {
    if (!open || !pendingFocus.current) return;
    if (pendingFocus.current === 'checked') {
      const checked = rootRef.current
        ?.querySelector<HTMLElement>('[role^="menuitem"][aria-checked="true"]');
      (checked ?? items()[0])?.focus();
    } else {
      const list = items();
      (pendingFocus.current === 'last' ? list[list.length - 1] : list[0])?.focus();
    }
    pendingFocus.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      /* Закрытие делает слушатель группы; здесь — возврат фокуса на триггер,
         если он был внутри этого дропдауна ([R2]). */
      if (rootRef.current?.contains(document.activeElement)) {
        returnFocusRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const trigger: DropdownTriggerProps = {
    type: 'button',
    onClick: () => {
      returnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      onToggle();
    },
    'aria-haspopup': true,
    'aria-expanded': open,
    onKeyDown: (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      if (!open) {
        returnFocusRef.current = e.currentTarget;
        pendingFocus.current = initialFocus === 'checked'
          ? 'checked'
          : e.key === 'ArrowUp' ? 'last' : 'first';
        onToggle();
        return;
      }
      const list = items();
      (e.key === 'ArrowUp' ? list[list.length - 1] : list[0])?.focus();
    },
  };

  /* Пункты выведены из табуляции и ходят стрелками/Home/End по кругу ([R2]). */
  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const list = items();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    const next = e.key === 'ArrowDown' ? list[(i + 1) % list.length]
      : e.key === 'ArrowUp' ? list[(i - 1 + list.length) % list.length]
        : e.key === 'Home' ? list[0]
          : list[list.length - 1];
    next?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={cx(s.dd, className, open && s.isOpen)}
      // Клик внутри не должен доходить до document-обработчика группы,
      // иначе меню закрывалось бы сразу после открытия (§JS: root.stopPropagation).
      onClick={(e) => e.stopPropagation()}
    >
      {children(trigger)}
      <div
        className={cx(s.ddMenu, menuAlign === 'left' && s.ddMenuLeft)}
        role="menu"
        onKeyDown={onMenuKeyDown}
        onClick={closeOnSelect ? onClose : undefined}
      >
        {menu}
      </div>
    </div>
  );
}

/** Группа взаимоисключающих дропдаунов: открыт максимум один.
 *  Один document-listener на всю группу и только пока что-то открыто —
 *  вместо четырёх независимых подписок. */
export function useDropdownGroup() {
  const [openId, setOpenId] = useState<string | null>(null);
  const close = useCallback(() => setOpenId(null), []);

  useEffect(() => {
    if (openId === null) return;
    const onDocClick = () => setOpenId(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openId]);

  const toggle = useCallback(
    (id: string) => setOpenId((prev) => (prev === id ? null : id)),
    [],
  );

  return { openId, toggle, close };
}
