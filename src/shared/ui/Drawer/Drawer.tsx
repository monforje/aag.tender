import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './Drawer.module.css';

/** Части панели — классами по той же причине, что modalPart и cardPart:
 *  заголовок дровера почти никогда не бывает голой строкой. */
export const drawerPart = {
  head: s.drawerHead,
  title: s.drawerTitle,
  foot: s.drawerFoot,
} as const;

export interface DrawerProps {
  open: boolean;
  /** Один источник закрытия — close-событие самого `<dialog>` (Escape, клик
   *  по подложке, close() изнутри). */
  onClose: () => void;
  /** Имя панели для скринридера, когда видимого заголовка нет. */
  label?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Боковая панель поверх страницы: детали записи, форма в несколько полей,
 * «досье» без ухода со списка.
 *
 * КОГДА:  контент, который читают РЯДОМ с контекстом: список остался виден
 *         краем глаза, работа с ним не прервана насмерть.
 * НЕ ДЛЯ: решений, после которых продолжать нельзя (см. <Modal> — там
 *         подложка честно гасит всё), меню у кнопки (см. <Popover>) и
 *         подсказок (см. <Tooltip>).
 *
 * UX:     ОТКРЫТОСТЬ — ПРОП, как у <Modal>: «панель открыта» обязана знать
 *         только React. Ширина — переменная `--drawer-width` на потребителе.
 *         Панель ВЪЕЗЖАЕТ справа: движение показывает, откуда она пришла и
 *         куда вернётся; окну такое движение не нужно, а панели — её жест.
 * A11Y:   фокус, Escape, подложка и верхний слой — от платформы; кольцо
 *         фокуса самого `<dialog>` снято, поэтому внутри обязательна первая
 *         цель (autoFocus), как и в Modal. Клик по подложке приходит на сам
 *         `<dialog>` — содержимое лежит в обёртке внутри.
 *
 * @example
 * <Drawer open={!!dossier} onClose={() => setDossier(null)} label="Досье">
 *   <header className={drawerPart.head}>
 *     <h2 className={drawerPart.title}>{dossier.name}</h2>
 *     <IconButton variant="panel" icon="closeCircle" onClick={close} />
 *   </header>
 *   …
 * </Drawer>
 */
export function Drawer({ open, onClose, label, className, children }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);

  /* Тот же контракт, что у Modal: сверка с el.open против двойного showModal()
     и петли onClose. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(s.drawer, className)}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}
    >
      <div className={s.drawerBody}>{children}</div>
    </dialog>
  );
}
