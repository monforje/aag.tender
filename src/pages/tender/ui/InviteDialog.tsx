import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Modal } from '@/shared/ui/Modal';
import s from './ExportDialog.module.css';

/**
 * Приглашение контрагента в тендер с экрана сравнения (§5.7, `table.md` §5).
 *
 * КОГДА:  колонка-призрак в конце ленты и кнопка пустого состояния — ОБА
 *         входа ведут сюда: сценарий один, мест два.
 * НЕ ДЛЯ: управления составом участников целиком (это раздел «Контрагенты») —
 *         здесь один шаг: назвать, кого позвать.
 *
 * UX:     ОКНО, А НЕ ПАНЕЛЬ: приглашение — действие наружу, оно отправляет
 *         письмо живому человеку, и прерывание работы здесь уместно ровно
 *         потому, что отменять его потом дорого.
 *         НОВЫЙ УЧАСТНИК ПОЯВЛЯЕТСЯ КОЛОНКОЙ «ПРИГЛАШЁН» — без цен и вне
 *         расчёта (§5.6), и это сказано прямо в окне: иначе первое, что
 *         увидит пользователь, — колонка нулей на месте, где он ждал КП.
 * A11Y:   имя окна и фокус — от <Modal> на нативном `<dialog>`.
 *
 * @example
 * <InviteDialog open={invite} onClose={() => setInvite(false)} />
 */
export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="Пригласить в тендер" className={s.dialog}>
      <h4 className={s.title}>Пригласить в тендер</h4>
      <p className={s.sub}>
        Приглашение уходит контрагенту письмом. До подачи КП он стоит в таблице
        отдельной колонкой со стадией «приглашён»: цен у неё нет, в расчёт
        (медианы, разброс, ранжир) она не входит и нулей не создаёт.
      </p>
      <div className={s.checklist}>
        <p className={s.checkLine}>
          <span className={s.grow}>Выбор контрагентов — из справочника организации</span>
          <Icon name="checkCircle" className={s.checkIcon} />
        </p>
        <p className={s.checkLine}>
          <span className={s.grow}>Состав ФКП и сроки берутся из текущего раунда</span>
          <Icon name="checkCircle" className={s.checkIcon} />
        </p>
      </div>
      {/* ЧЕСТНОЕ СОСТОЯНИЕ ВМЕСТО ФАЛЬШИВОЙ КНОПКИ: справочника контрагентов
          в приложении пока нет, и «Отправить», который ничего не отправляет,
          был бы хуже отсутствующего. Сценарий описан, вход на месте, данных
          нет — так и сказано. */}
      <p className={s.pending}>
        Справочник контрагентов подключается вместе с разделом «Контрагенты» —
        до него список приглашаемых взять неоткуда.
      </p>
      <div className={s.actions}>
        <Button variant="secondary" onClick={onClose}>Закрыть</Button>
        <Button variant="primary" disabled title="Нужен справочник контрагентов">
          <Icon name="userPlus" className={s.btnIcon} />
          Отправить приглашение
        </Button>
      </div>
    </Modal>
  );
}
