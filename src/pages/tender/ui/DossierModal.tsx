import { useState, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { plural } from '@/shared/lib/plural';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Modal, modalPart } from '@/shared/ui/Modal';
import { bidStatus, money, type Bid, type SupplierTerm } from '@/entities/comparison';
import s from './DossierModal.module.css';

/**
 * Досье подрядчика: модальное окно с реквизитами КП и итогом по колонке.
 *
 * КОГДА:  стрелка «Открыть досье» на карточке <ContractorCard>.
 * НЕ ДЛЯ: правки данных подрядчика — окно только читает то, что уже известно
 *         из сравнения.
 *
 * UX:     Пока заглушка: реквизиты, УСЛОВИЯ КП, итог и честная фраза о том,
 *         что раздел ещё не сделан. Окно с пустотой внутри хуже отсутствия
 *         окна, поэтому здесь стоит то, что УЖЕ известно. Открытость выводится
 *         из пропа: содержимое рисуется, только когда окно открыто.
 *         УСЛОВИЯ ДУБЛИРУЮТ матрицу внизу таблицы (<TermsBand>) намеренно
 *         (решение владельца 24.08.2026, вторая волна): там их читают ПОПЕРЁК
 *         подрядчиков — «у кого аванс меньше», здесь ВДОЛЬ одного — «что
 *         вообще предложил этот». Это два разных вопроса, и гонять человека
 *         за ответом на второй в подвал ленты незачем. Источник один
 *         (`contractor.terms`), поэтому разъехаться им нечем.
 * A11Y:   фокус в окно ставит нативный showModal(); autoFocus на кнопке
 *         «Закрыть» не оставляет фокус на самом <dialog>. Реквизиты —
 *         настоящий <dl>: скринридер читает пары «подпись — значение».
 *
 * @example
 * <DossierModal bid={dossier} total={positions.length} onClose={() => setDossier(null)} />
 */
export function DossierModal({ bid, total, onClose, stats, onGoToCell }: {
  /** КП, чьё досье открыто; null — окно закрыто. */
  bid: Bid | null;
  total: number;
  onClose: () => void;
  /** КЛИКАБЕЛЬНАЯ СТАТИСТИКА КОЛОНКИ (§5.2, `contractor.md` §3). Каждое
   *  число раскрывает мини-список своих позиций, строка ведёт к ячейке тем
   *  же контрактом перехода, что и всё остальное (§4.5). Без списка панель
   *  «не ведёт к данным», и путь «увидел аномалию → открыл его строки»
   *  проходится руками. */
  stats?: SupplierStats;
  onGoToCell?: (positionId: string) => void;
}) {
  return (
    <Modal open={bid !== null} onClose={onClose}>
      {/* Содержимое рисуется, только когда окно открыто. */}
      {bid ? (
        <Dossier
          bid={bid}
          total={total}
          onClose={onClose}
          stats={stats}
          onGoToCell={onGoToCell}
        />
      ) : null}
    </Modal>
  );
}

/** Персональный срез колонки: числа плюс ПОИМЁННЫЕ позиции за каждым.
 *  Список, а не только счёт: число отвечает «сколько», а следующий вопрос
 *  всегда «где». */
export interface SupplierStats {
  groups: Array<{
    id: string;
    label: string;
    /** Показывается вместо счётчика, когда величина не штучная («+1,24 млн ₽»). */
    display?: string;
    items: Array<{ positionId: string; title: string; hint?: string }>;
  }>;
}

/** Тело досье. Окно с пустотой внутри хуже отсутствия окна, поэтому здесь
 *  стоит то, что УЖЕ известно из сравнения. */
function Dossier({ bid, total, onClose, stats, onGoToCell }: {
  bid: Bid; total: number; onClose: () => void;
  stats?: SupplierStats; onGoToCell?: (positionId: string) => void;
}) {
  const { contractor, percent, filled, sum, rankLabel } = bid;
  const status = bidStatus(contractor.status);
  /* Какая группа раскрыта. ОДНА на панель: два открытых списка превращают
     срез в простыню, а вопрос у человека в моменте ровно один. */
  const [open, setOpen] = useState<string | null>(null);

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

      {/* Условия формы КП — тот же список, что стоит строками матрицы внизу
          таблицы. Развёрнутый ответ (`note`) занимает обе колонки: в половине
          ширины он превратился бы в столбик из двух слов. */}
      {contractor.terms?.length ? (
        <>
          <h3 className={s.subhead}>Условия КП</h3>
          <dl className={s.facts}>
            {contractor.terms.map((term: SupplierTerm) => (
              <Fact key={term.id} label={term.label} wide={term.kind === 'note'}>
                {term.value}
              </Fact>
            ))}
          </dl>
        </>
      ) : null}

      {/* ── ПЕРСОНАЛЬНЫЙ СРЕЗ КОЛОНКИ (§5.2) ────────────────────────────────
          Канон называет панель заменой фильтра по подрядчику: «увидел
          аномалию у СтройГрада → открыл его строки» обязано проходиться
          кликом, а не глазами по колонке. Число — кнопка, список — переходы;
          сам переход НЕ меняет ни фильтры, ни сортировку, ни версии таблицы:
          человек вернётся в тот же вид, из которого ушёл. */}
      {stats?.groups.length ? (
        <>
          <h3 className={s.subhead}>В этой колонке</h3>
          <div className={s.stats}>
            {stats.groups.map((g) => (
              <div key={g.id}>
                <button
                  type="button"
                  className={s.stat}
                  aria-expanded={open === g.id}
                  disabled={!g.items.length}
                  onClick={() => setOpen((cur) => (cur === g.id ? null : g.id))}
                >
                  <span className={s.statLabel}>{g.label}</span>
                  <span className={s.statValue}>{g.display ?? g.items.length}</span>
                </button>
                {open === g.id ? (
                  <div className={s.miniList}>
                    {g.items.map((item) => (
                      <button
                        key={item.positionId}
                        type="button"
                        className={s.miniItem}
                        onClick={() => { onClose(); onGoToCell?.(item.positionId); }}
                      >
                        <span className={s.miniName}>{item.title}</span>
                        {item.hint ? <span className={s.miniHint}>{item.hint}</span> : null}
                        <span className={s.miniArrow} aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

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

function Fact({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cx(s.fact, wide && s.factWide)}>
      <dt className={s.factLabel}>{label}</dt>
      <dd className={s.factValue}>{children}</dd>
    </div>
  );
}
