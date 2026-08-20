import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './Dropdown.module.css';

/** Пропсы, которые компонент отдаёт триггеру. Разметка самого триггера у всех
 *  четырёх дропдаунов разная, поэтому её пишет родитель, а поведение — здесь. */
export interface DropdownTriggerProps {
  type: 'button';
  onClick: () => void;
  'aria-haspopup': true;
  'aria-expanded': boolean;
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
  className?: string;
  children: (trigger: DropdownTriggerProps) => ReactNode;
}

export function Dropdown({
  open, onToggle, onClose, menu, menuAlign = 'right', closeOnSelect = true, className, children,
}: DropdownProps) {
  return (
    <div
      className={cx(s.dd, className, open && s.isOpen)}
      // Клик внутри не должен доходить до document-обработчика группы,
      // иначе меню закрывалось бы сразу после открытия (§JS: root.stopPropagation).
      onClick={(e) => e.stopPropagation()}
    >
      {children({ type: 'button', onClick: onToggle, 'aria-haspopup': true, 'aria-expanded': open })}
      <div
        className={cx(s.ddMenu, menuAlign === 'left' && s.ddMenuLeft)}
        role="menu"
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
