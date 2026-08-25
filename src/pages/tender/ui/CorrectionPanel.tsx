import { useState } from 'react';
import {
  decimal, money, type ComparePosition, type Contractor, type QtyCorrection,
} from '@/entities/comparison';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Popover } from '@/shared/ui/Popover';
import { Textarea } from '@/shared/ui/Input';
import { plural } from '@/shared/lib/plural';
import s from './CorrectionPanel.module.css';

/**
 * Панель решения по корректировке объёма (§2.7, `correction.md` §3–§4).
 *
 * КОГДА:  клик по знаку ⚠ в ячейке.
 * НЕ ДЛЯ: объяснения знака (это делает сводка по наведению) и навигации к
 *         ячейкам (см. перечень пометок колонки в <CornerTab>).
 *
 * UX:     ЭТО НЕ ПОДСКАЗКА, А РАБОЧИЙ ПРОЦЕСС ТЕНДЕРА. До 25.08.2026 ⚠ только
 *         раскрывался наведением: знак говорил «требуется решение», а принять
 *         его было негде — счётчики висели бы вечно. Теперь знак ведёт туда,
 *         где решение принимают.
 *         ОТКЛОНЕНИЕ ТРЕБУЕТ КОММЕНТАРИЯ, и кнопка до него неактивна:
 *         поставщику уходит отказ, и «почему» — часть отказа, а не
 *         пожелание. ПРИНЯТИЕ ИЗМЕНЁННОГО ОБЪЁМА ПОДТВЕРЖДАЕТСЯ ОТДЕЛЬНО и
 *         называет ЧИСЛО УЧАСТНИКОВ, которым придётся назвать цену заново:
 *         одно нажатие здесь стоит работы всей остальной колонке, и это
 *         обязано быть сказано до нажатия, а не после.
 *         КОНТУР ПРОТИВ ЗАЛИВКИ: «Отклонить» — контур danger, «Принять» —
 *         заливка success. Два залитых действия рядом читались бы
 *         равнозначными, а они не равнозначны: принятие двигает смету.
 *         РЕШЕНИЕ ГАСИТ ⚠ В ТРЁХ ОСЯХ СРАЗУ — в ячейке, в строке и в шапке
 *         колонки, — потому что все трое читают `pendingCorrection()`.
 * A11Y:   поверхность — <Popover> на нативном `<dialog>`: Escape, клик мимо и
 *         возврат фокуса от платформы. Обязательность комментария выражена и
 *         `disabled` кнопки, и подписью поля — не одним лишь цветом.
 *
 * @example
 * <CorrectionPanel at={at} position={p} contractor={c} correction={corr}
 *                  others={9} onDecide={decide} onClose={close} />
 */
export function CorrectionPanel({
  at, position, contractor, correction, others, onDecide, onClose, busy,
}: {
  at: DOMRect | null;
  position: ComparePosition;
  contractor: Contractor;
  correction: QtyCorrection;
  /** Сколько ОСТАЛЬНЫХ участников придётся переспросить при принятии. */
  others: number;
  onDecide: (decision: 'accepted' | 'declined', note?: string) => void;
  onClose: () => void;
  /** Запрос в полёте — обе кнопки замирают: двойное решение по одной
   *  корректировке сервер отобьёт, но показывать это ошибкой незачем. */
  busy?: boolean;
}) {
  /* Три состояния формы, а не два флага: «спрашиваем причину отказа» и
     «подтверждаем принятие» взаимоисключающи, и парой булевых их пришлось бы
     синхронизировать руками. */
  const [stage, setStage] = useState<'ask' | 'decline' | 'accept'>('ask');
  const [note, setNote] = useState('');

  const price = contractor.prices[position.id];
  const sum = price === undefined ? null : price * correction.qty;

  return (
    <Popover
      anchor={at}
      onClose={onClose}
      label={`Решение по корректировке: ${position.title} · ${contractor.name}`}
      className={s.pop}
    >
      <div className={s.panel}>
        <h4 className={s.title}>
          <span className={s.dot} aria-hidden="true" />
          Иной объём · на рассмотрении
        </h4>
        <p className={s.sub}>{position.title} · {contractor.name}</p>

        <section className={s.sec}>
          <p className={s.cap}>Данные</p>
          <Row label="В смете" value={`${decimal(position.qty)} ${position.unit}`} />
          <Row label="Поставщик считает" value={`${decimal(correction.qty)} ${position.unit}`} />
          <Row label="Стоимость позиции" value={sum === null ? '—' : money(sum)} />
          <Row
            label="Ставка за единицу"
            value={price === undefined ? '—' : `${money(price)}/${position.unit}`}
          />
        </section>

        <section className={s.sec}>
          <p className={s.cap}>Обоснование поставщика</p>
          <p className={s.quote}>
            {correction.note ?? 'Обоснование не приложено — цены посчитаны за разные объёмы.'}
          </p>
        </section>

        {stage === 'ask' ? (
          <div className={s.actions}>
            <Button variant="secondary" className={s.declineBtn} disabled={busy}
              onClick={() => setStage('decline')}>
              Отклонить
            </Button>
            <Button variant="primary" className={s.acceptBtn} disabled={busy}
              onClick={() => setStage('accept')}>
              Принять
            </Button>
          </div>
        ) : stage === 'decline' ? (
          <>
            <label className={s.fieldLabel} htmlFor="corr-note">
              Комментарий решения — обязателен
            </label>
            <Textarea
              id="corr-note"
              value={note}
              placeholder="Причина отклонения…"
              onChange={(e) => setNote(e.target.value)}
            />
            <div className={s.actions}>
              <Button variant="secondary" disabled={busy} onClick={() => setStage('ask')}>
                Отмена
              </Button>
              <Button
                variant="primary"
                className={s.declineConfirm}
                disabled={busy || !note.trim()}
                onClick={() => onDecide('declined', note.trim())}
              >
                Отклонить с комментарием
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* ЧИСЛО УЧАСТНИКОВ НАЗЫВАЕТСЯ ДО НАЖАТИЯ: принятие чужого объёма
                заставляет переспросить всю остальную колонку. */}
            <div className={s.noteStrip}>
              <Icon name="dangerTriangle" className={s.stripIcon} />
              <span>
                {others > 0
                  ? `Новую цену под ${decimal(correction.qty)} ${position.unit} понадобится назвать ещё ${others} ${plural(others, 'участнику', 'участникам', 'участникам')}. Продолжить?`
                  : `Объём позиции станет ${decimal(correction.qty)} ${position.unit}. Продолжить?`}
              </span>
            </div>
            <div className={s.actions}>
              <Button variant="secondary" disabled={busy} onClick={() => setStage('ask')}>
                Отмена
              </Button>
              <Button
                variant="primary"
                className={s.acceptBtn}
                disabled={busy}
                onClick={() => onDecide('accepted')}
              >
                Принять объём
              </Button>
            </div>
          </>
        )}
      </div>
    </Popover>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      <span className={s.rowValue}>{value}</span>
    </p>
  );
}
