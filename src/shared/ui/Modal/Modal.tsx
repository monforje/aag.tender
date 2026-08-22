import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import s from './Modal.module.css';

/**
 * Части окна — классами, а не пропами `title`/`footer`. Заголовок здесь редко
 * бывает голой строкой (рядом с ним стоит капсула статуса, счётчик, кнопка), а
 * проп ReactNode пришлось бы всё равно оборачивать в чужой `<h2>` — и вся
 * гибкость сводилась бы к тому, чтобы её обойти. Тот же приём, что у
 * `tableCell` в <Table> и `searchSecondaryIconClass` в <SearchTrigger>.
 *
 * - `head`  — строка заголовка: `<h2>` плюс что угодно рядом;
 * - `title` — сам заголовок, 18/24 semibold;
 * - `foot`  — подвал с действиями, прижатыми вправо.
 *
 * Тела окна среди них нет: отступы и вертикальный ритм несёт сам <Modal>.
 */
export const modalPart = {
  head: s.modalHead,
  title: s.modalTitle,
  foot: s.modalFoot,
} as const;

/**
 * Модальное окно — нативный `<dialog>` в верхнем слое.
 *
 * КОГДА:  содержимое, ради которого работу прерывают: досье, подтверждение,
 *         форма в один шаг. Всё, что закрывают, прежде чем продолжить.
 * НЕ ДЛЯ: меню и панели, привязанной к кнопке (см. <Popover> — он тоже
 *         `<dialog>`, но без подложки и с координатами по нажатому
 *         элементу); выбора значения в полосе фильтров (см. <Dropdown>);
 *         объяснения пустого экрана (см. <ScreenPlaceholder>).
 *
 * UX:     ОТКРЫТОСТЬ — ПРОП, а не ref со showModal() у потребителя. Императив
 *         снаружи означал бы, что «окно открыто» знают двое — DOM и состояние
 *         React, — и рано или поздно они разойдутся: Escape закрывает окно
 *         мимо любого setState.
 *         Ширина — переменная `--modal-width` со значением по умолчанию
 *         520px: у окна её задаёт содержимое, а не примитив.
 *         Появления и ухода НЕТ намеренно, в отличие от <Popover>: окно
 *         забирает экран целиком, и его выезд читался бы как задержка. Гасит
 *         фон подложка, она же и есть анимация — браузерная.
 * A11Y:   фокус заперт внутри, Escape закрывает, подложка рисуется браузером —
 *         всё это платформа даёт бесплатно, и переписывать это руками нельзя.
 *         Клик по подложке приходит НА САМ `<dialog>` (содержимое лежит в
 *         обёртке внутри) — это единственный способ отличить его от клика в
 *         окне, и на нём же основана единственная строка обработчика ниже.
 *         Собственное кольцо фокуса `<dialog>` снято: showModal() ставит фокус
 *         на само окно, и браузер обводит его рамкой, которой никто не просил.
 *         Поэтому у окна обязана быть своя первая цель — кнопка с autoFocus.
 *         Имя окна — либо `<h2 className={modalPart.title}>` внутри, либо
 *         проп `label`, если заголовка на экране нет.
 *
 * @example
 * <Modal open={!!dossier} onClose={() => setDossier(null)}>
 *   <header className={modalPart.head}>
 *     <h2 className={modalPart.title}>{dossier.name}</h2>
 *     <Badge tone="success">Получено</Badge>
 *   </header>
 *   <footer className={modalPart.foot}>
 *     <Button variant="primary" autoFocus onClick={close}>Закрыть</Button>
 *   </footer>
 * </Modal>
 */
export function Modal({ open, onClose, label, className, children }: {
  open: boolean;
  /** Зовётся и на Escape, и на клик по подложке, и на закрытие изнутри:
   *  источник закрытия у окна один — событие `close` самого `<dialog>`. */
  onClose: () => void;
  /** Имя окна для скринридера — когда видимого заголовка внутри нет. */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  /* Проп → DOM. Сверка с el.open обязательна: showModal() на уже открытом
     окне бросает InvalidStateError, а close() на закрытом лишний раз шлёт
     `close` и уводит onClose в петлю с собственным setState. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(s.modal, className)}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}
    >
      {/* Обёртка не косметика: без неё клик по содержимому не отличить от
          клика по подложке — оба приходят с target === сам <dialog>. */}
      <div className={s.modalBody}>{children}</div>
    </dialog>
  );
}
