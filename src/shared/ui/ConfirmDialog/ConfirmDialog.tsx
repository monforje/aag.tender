import type { ReactNode } from 'react';
import { Modal, modalPart } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import s from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Действие подтверждения. Окно НЕ закрывает себя сам: источник закрытия
   *  один — onClose из close-события `<dialog>`. */
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger — удаление и прочее необратимое; primary — обычное подтверждение.
   *  Тон красит ТОЛЬКО главную кнопку: окно подтверждения не алерт. */
  tone?: 'danger' | 'primary';
}

/**
 * Подтверждение необратимого действия.
 *
 * КОГДА:  «Удалить тендер?», «Отозвать КП?» — любой шаг, который нельзя
 *         откатить кнопкой назад.
 * НЕ ДЛЯ: форм и многошаговых сценариев (это <Modal> с содержимым),
 *         информирования о результате (см. <Toast> / <Alert>) и опасных,
 *         но ОБРАТИМЫХ действий — их удерживает не модалка, а возможность
 *         отмены.
 *
 * UX:     фокус при открытии стоит на ОТМЕНЕ: Enter по невнимательности
 *         должен делать безопасное. Тон danger живёт только на кнопке
 *         действия — окно не превращается в красный плакат, иначе сигнал
 *         перестаёт значить опасность. Ширина окна уже обычного <Modal>:
 *         вопрос читается одним взглядом.
 * A11Y:   имя окна = заголовок вопроса (проп label у <Modal>);
 *         порядок табуляции Cancel → Confirm совпадает со зрительным и с
 *         безопасным исходом.
 *
 * @example
 * <ConfirmDialog
 *   open={confirmDelete} onClose={() => setConfirmDelete(false)}
 *   onConfirm={remove} tone="danger"
 *   title="Удалить тендер?"
 *   description="Восстановить будет нельзя. Связанные КП останутся во входящих."
 * />
 */
export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'Подтвердить', cancelLabel = 'Отмена', tone = 'danger',
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} label={title} className={s.confirm}>
      <header className={modalPart.head}>
        <h2 className={modalPart.title}>{title}</h2>
      </header>
      {description && <div>{description}</div>}
      <footer className={modalPart.foot}>
        {/* autoFocus на отмене: фокус при showModal() обязан встать на
            безопасное действие — см. JSDoc Modal про снятое кольцо окна. */}
        <Button variant="secondary" autoFocus onClick={onClose}>{cancelLabel}</Button>
        <Button variant={tone} onClick={onConfirm}>{confirmLabel}</Button>
      </footer>
    </Modal>
  );
}
