import type { ReactNode } from 'react';
import { plural } from '@/shared/lib/plural';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Modal, modalPart } from '@/shared/ui/Modal';
import { bidStatus, money, type Bid } from '@/entities/comparison';
import s from './DossierModal.module.css';

/**
 * Досье подрядчика: модальное окно с реквизитами КП и итогом по колонке.
 *
 * КОГДА:  стрелка «Открыть досье» на карточке <ContractorCard>.
 * НЕ ДЛЯ: правки данных подрядчика — окно только читает то, что уже известно
 *         из сравнения.
 *
 * UX:     Пока заглушка: реквизиты, итог по КП и честная фраза о том, что
 *         раздел ещё не сделан. Окно с пустотой внутри хуже отсутствия окна,
 *         поэтому здесь стоит то, что УЖЕ известно. Открытость выводится из
 *         пропа: содержимое рисуется, только когда окно открыто.
 * A11Y:   фокус в окно ставит нативный showModal(); autoFocus на кнопке
 *         «Закрыть» не оставляет фокус на самом <dialog>. Реквизиты —
 *         настоящий <dl>: скринридер читает пары «подпись — значение».
 *
 * @example
 * <DossierModal bid={dossier} total={positions.length} onClose={() => setDossier(null)} />
 */
export function DossierModal({ bid, total, onClose }: {
  /** КП, чьё досье открыто; null — окно закрыто. */
  bid: Bid | null;
  total: number;
  onClose: () => void;
}) {
  return (
    <Modal open={bid !== null} onClose={onClose}>
      {/* Содержимое рисуется, только когда окно открыто. */}
      {bid ? <Dossier bid={bid} total={total} onClose={onClose} /> : null}
    </Modal>
  );
}

/** Тело досье. Окно с пустотой внутри хуже отсутствия окна, поэтому здесь
 *  стоит то, что УЖЕ известно из сравнения. */
function Dossier({ bid, total, onClose }: { bid: Bid; total: number; onClose: () => void }) {
  const { contractor, percent, filled, sum, rankLabel } = bid;
  const status = bidStatus(contractor.status);

  return (
    <>
      <header className={modalPart.head}>
        <h2 className={modalPart.title}>{contractor.name}</h2>
        <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
      </header>

      <dl className={s.facts}>
        <Fact label="ИНН">{contractor.inn}</Fact>
        <Fact label="Контактное лицо">{contractor.contact}</Fact>
        <Fact label="КП поступило">{contractor.submitted}</Fact>
        <Fact label="Заполнено">
          {percent}% — {filled} из {total} {plural(total, 'позиции', 'позиций', 'позиций')}
        </Fact>
        <Fact label="Итог по КП">{money(sum)}</Fact>
        <Fact label="Место в сравнении">{rankLabel}</Fact>
      </dl>

      {/* <ScreenPlaceholder> сюда не берётся намеренно: у него min-height 320px —
          он рассчитан на пустой ЭКРАН и в окне на 520px выглядел бы дырой. */}
      <p className={s.note}>
        <Icon name="billList" className={s.noteIcon} />
        Карточка подрядчика — история договоров, допуски и рейтинг — ещё не реализована.
      </p>

      <footer className={modalPart.foot}>
        {/* autoFocus, чтобы showModal() не оставлял фокус на самом <dialog>. */}
        <Button variant="primary" autoFocus onClick={onClose}>Закрыть</Button>
      </footer>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.fact}>
      <dt className={s.factLabel}>{label}</dt>
      <dd className={s.factValue}>{children}</dd>
    </div>
  );
}
