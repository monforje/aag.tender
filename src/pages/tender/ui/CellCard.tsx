import { cx } from '@/shared/lib/cx';
import {
  cellMark, currentVersion, decimal, deviationPct, money, pendingCorrection,
  type Contractor, type RowFacts,
} from '@/entities/comparison';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Popover } from '@/shared/ui/Popover';
import { cellStateOf } from '../model/compareFormat';
import s from './CellCard.module.css';

/**
 * Карточка ячейки — закрепляемый разбор пары «позиция × подрядчик»
 * (§2.1, `cell.md` §3).
 *
 * КОГДА:  клик по телу ЛЮБОЙ ячейки КП.
 * НЕ ДЛЯ: сводки по наведению (её собирает `cellSummary`, и она обязана
 *         оставаться СТРОГИМ ПОДМНОЖЕСТВОМ слотов этой карточки — иначе
 *         наведение и клик рассказывают о ячейке разное), досье подрядчика
 *         (см. SupplierPanel — там колонка целиком) и решения по
 *         корректировке (см. CorrectionPanel — там действие).
 *
 * UX:     СВОДКА ОТВЕЧАЕТ «ЧТО ЗДЕСЬ», КАРТОЧКА — «ПОЧЕМУ ИМЕННО ТАК И ОТКУДА
 *         ЧИСЛО». Без неё проверка оснований (версия КП, файл-источник, обе
 *         ставки, положение в разбросе) из таблицы недоступна вовсе — а это
 *         заявленная цель продукта.
 *         РАСПРЕДЕЛЕНИЕ — ДОРОЖКА С ТОЧКАМИ, А НЕ ПОЛОСА: полоса отвечает
 *         «насколько велик разброс», а вопрос карточки другой — «где в этом
 *         разбросе стою Я». Предложения — полые точки, медиана — высокий
 *         штрих, открытая цена — ромб info с ореолом: три разные роли, три
 *         разные формы, потому что цветом их развести на 9 пикселях нельзя.
 *         СТАТУС УЧАСТИЯ — ПРОСТО ТЕКСТ (правка владельца 25.08.2026): ни
 *         точки, ни капители. Строка «Участвует в расчёте» — факт, а не
 *         состояние-предупреждение, и оформлять её как бейдж значило бы
 *         поднимать шум там, где всё в порядке.
 *         ПОДВАЛ — ДВЕ КНОПКИ РОВНО 50/50: обе ведут ПРОЧЬ из карточки
 *         (к подрядчику и к файлу), равные по весу, и делить их 60/40 значило
 *         бы назвать одну главной без причины.
 * A11Y:   поверхность — <Popover> на нативном `<dialog>`: фокус, Escape и
 *         верхний слой достаются от платформы. Дорожка распределения
 *         aria-hidden — все её числа названы текстом рядом.
 *
 * @example
 * <CellCard at={anchor} row={row} contractor={contractor} … onClose={close} />
 */
export function CellCard({
  at, row, contractor, contractors, onClose, onOpenSupplier, roundNumber, prevPrice,
}: {
  /** Прямоугольник тела ячейки — от него падает карточка. */
  at: DOMRect | null;
  row: RowFacts;
  contractor: Contractor;
  /** Все участники расчёта — для краёв диапазона поимённо. */
  contractors: Contractor[];
  onClose: () => void;
  onOpenSupplier: () => void;
  /** Номер текущего круга торгов — подпись базы у блока «Изменение». */
  roundNumber: number;
  /** Его же расценка прошлого круга. Нет — сравнивать не с чем, и блока
   *  «Изменение к прошлому раунду» не будет вовсе (а не «0 ₽»). */
  prevPrice?: number;
}) {
  const { position } = row;
  const mark = cellMark(contractor, position.id);
  const price = contractor.prices[position.id];
  const state = cellStateOf(contractor, position.id, position.removed);
  const correction = pendingCorrection(mark);
  const version = currentVersion(contractor);
  const anomaly = row.bids.find((b) => b.contractorId === contractor.id)?.anomaly ?? false;

  /* ПРИМЕНЁННЫЙ ОБЪЁМ — объём поставщика при непринятой корректировке, иначе
     шаблонный: карточка обязана показать то число, на которое ФАКТИЧЕСКИ
     умножена ставка, иначе арифметика в ней не сходится. */
  const qty = correction?.qty ?? position.qty;
  const sum = price === undefined ? null : price * qty;
  const dev = price !== undefined && row.median !== null
    ? deviationPct(price, row.median) : null;

  const prices = row.bids.map((b) => b.price);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;
  const nameOf = (id: string) => contractors.find((c) => c.id === id)?.name ?? id;
  const bestName = row.bestIds.length ? nameOf(row.bestIds[0]) : null;

  /* Положение цены на дорожке, 0…100. Плоский диапазон (все подали одинаково)
     схлопнул бы деление в ноль — тогда все точки стоят посередине, и это
     честно: разброса действительно нет. */
  const at01 = (v: number): number =>
    (min === null || max === null || max === min ? 50 : ((v - min) / (max - min)) * 100);

  const delta = prevPrice !== undefined && price !== undefined
    ? (price - prevPrice) * qty : null;

  return (
    <Popover
      anchor={at}
      onClose={onClose}
      label={`Разбор ячейки: ${position.title} · ${contractor.name}`}
      className={s.pop}
    >
      <div className={s.card}>
        <h4 className={s.title}>{position.title} · {contractor.name}</h4>
        <p className={s.sub}>
          {version ? `версия КП ${version.label} · ${version.date}` : `КП от ${contractor.submitted}`}
        </p>

        {/* Воздух до статуса увеличен (правка владельца): статус отделён от
            заголовка, а не приклеен к нему. Техтрейс справа — служебные
            идентификаторы, по которым спорят с разработчиком, а не с
            поставщиком. */}
        <div className={s.statusRow}>
          <span className={s.statusText}>
            {state === 'value' ? 'Участвует в расчёте' : 'В расчёте не участвует'}
          </span>
          <span className={s.trace}>
            work_id {position.id} · contractor_id {contractor.id}
          </span>
        </div>

        <section className={s.sec}>
          <Row label="Стоимость позиции" value={sum === null ? '—' : <b>{money(sum)}</b>} />
          <Row label="Применённый объём" value={`${decimal(qty)} ${position.unit}`} />
          {correction ? (
            <Row label="Объём по смете" value={`${decimal(position.qty)} ${position.unit}`} />
          ) : null}
          {/* СОСТАВ СТАВКИ, когда он раскрыт: обе ставки и их сумма рядом —
              расхождение с итоговой расценкой видно глазом (`cell.md` §3).
              Не раскрыт — строки нет вовсе, а не «0 + 0». */}
          {mark.rates ? (
            <Row
              label="Ставка материалов / работ"
              value={`${money(mark.rates.materials)} · ${money(mark.rates.works)}`}
            />
          ) : null}
          <Row
            label="Ставка за единицу"
            value={price === undefined ? '—' : `${money(price)}/${position.unit}`}
          />
          <Row
            label="Медиана строки"
            value={row.median === null ? '—' : money(row.median * position.qty)}
          />
          <Row
            label="Отклонение"
            value={dev === null || sum === null || row.median === null ? '—' : (
              `${dev > 0 ? '+' : dev < 0 ? '−' : ''}${decimal(Math.abs(dev))} % · ${dev > 0 ? '+' : dev < 0 ? '−' : ''}${money(Math.abs(sum - row.median * position.qty))}`
            )}
          />
          <Row
            label="Лучшая цена"
            value={min === null || !bestName ? '—' : `${money(min * position.qty)} · ${bestName}`}
          />
          <Row
            label="Потенциал"
            value={mark.potential ? money(mark.potential * position.qty) : '—'}
          />
        </section>

        {/* РАСПРЕДЕЛЕНИЕ. Дорожка с концевыми делениями, полые точки
            предложений, медиана — высокий штрих, «здесь» — ромб с ореолом. */}
        {min !== null && max !== null && row.spread !== null ? (
          <section className={s.sec}>
            <Row
              label={`Разброс цен · ${row.bids.length} сопоставимых предложений`}
              value={<b>{decimal(row.spread)} %</b>}
            />
            <div className={s.track} aria-hidden="true">
              {row.bids.map((b) => (
                <i
                  key={b.contractorId}
                  className={cx(b.contractorId === contractor.id && s.here)}
                  style={{ left: `${at01(b.price)}%` }}
                />
              ))}
              {row.median !== null ? (
                <i className={s.med} style={{ left: `${at01(row.median)}%` }} />
              ) : null}
            </div>
            <div className={s.trackLabels}>
              <span>MIN {money(min * position.qty)}</span>
              {sum !== null ? <span className={s.hereLabel}>◆ здесь: {money(sum)}</span> : null}
              <span>MAX {money(max * position.qty)}</span>
            </div>
          </section>
        ) : null}

        {/* ИЗМЕНЕНИЕ К ПРОШЛОМУ РАУНДУ. Нет прошлой расценки — блока нет
            вовсе: «0 ₽» означало бы «не менял», а мы просто не знаем. */}
        {delta !== null && prevPrice !== undefined ? (
          <section className={s.sec}>
            <p className={s.cap}>Изменение к прошлому раунду</p>
            <div className={s.round}>
              <s className={s.roundOld}>{money(prevPrice * qty)}</s>
              <span className={s.roundArrow} aria-hidden="true"><Icon name="arrowRight" /></span>
              <b>{money(price! * qty)}</b>
              <span className={cx(s.deltaChip, delta <= 0 ? s.deltaDown : s.deltaUp)}>
                {delta > 0 ? '+' : '−'}{money(Math.abs(delta))}
              </span>
              <span className={s.roundBase}>база: раунд {roundNumber - 1}</span>
            </div>
          </section>
        ) : null}

        <section className={s.sec}>
          <Row
            label={<><Icon name="documentText" className={s.rowIcon} /> Источник</>}
            value={contractor.sourceFile ?? 'файл не приложен'}
          />
          {anomaly && mark.anomaly ? (
            <p className={s.quote}>{mark.anomaly}</p>
          ) : null}
          {correction?.note ? <p className={s.quote}>{correction.note}</p> : null}
        </section>

        {/* Подвал 50/50: обе кнопки ведут прочь из карточки и равны по весу. */}
        <div className={s.actions}>
          <Button variant="secondary" onClick={onOpenSupplier}>Показать подрядчика</Button>
          <Button
            variant="primary"
            disabled={!contractor.sourceFile}
            title={contractor.sourceFile
              ? `Открыть ${contractor.sourceFile}`
              : 'Файл-источник к этому КП не приложен'}
          >
            <Icon name="arrowRightUp" className={s.rowIcon} />
            Открыть источник
          </Button>
        </div>
      </div>
    </Popover>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <p className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      <span className={s.rowValue}>{value}</span>
    </p>
  );
}
