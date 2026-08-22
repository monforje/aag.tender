import { ConfirmDialog } from 'clickup-shell';

/** Необратимое действие: вопрос, пояснение, отмена слева — фокус на ней. */
export const Danger = () => (
  <ConfirmDialog
    open
    onClose={() => {}}
    onConfirm={() => {}}
    title="Отменить тендер T-2026-014?"
    description="Подрядчики получат уведомление, поданные КП станут недоступны. Восстановить тендер после отмены нельзя."
    confirmLabel="Отменить тендер"
    cancelLabel="Не отменять"
  />
);

/** Тон primary — когда действие важное, но не разрушительное. */
export const Primary = () => (
  <ConfirmDialog
    open
    onClose={() => {}}
    onConfirm={() => {}}
    tone="primary"
    title="Отправить КП заказчику?"
    description="Предложение уйдёт на согласование. До ответа заказчика правки внести нельзя."
    confirmLabel="Отправить"
  />
);
