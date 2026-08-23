import { type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import {
  cellLines, cellMark, decimal, deviationPct, hasAnomaly, money, moneyCompact, type CellLine, type CompareThresholds, type CompareView, type Contractor, type RowFacts,
} from '@/entities/comparison';
import type { CellPopupBind, CellPopupData } from '@/shared/ui/CellPopup';
import { tableCell } from '@/shared/ui/Table';
import { Icon } from '@/shared/ui/Icon';
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden';
import { pctSigned } from '../model/compareFormat';
import { CoinMark } from './assets';
import s from './TenderCompare.module.css';

/**
 * Ячейка КП: показатели одного подрядчика по одной работе.
 *
 * КОГДА:  в хвосте каждой строки <CompareRow> — по одной на поданное КП.
 * НЕ ДЛЯ: колонки «Разброс» (см. SpreadCell) и сводки по подрядчику
 *         (см. ContractorCard).
 *
 * СОСТАВ СТРОК задаёт `cellLines()` (модель ячейки, источник §1): основной
 *         показатель первой строкой; стоимость присутствует ВСЕГДА — если
 *         основной не она, второй строкой как база; отклонение липнет к
 *         стоимости суффиксом на той же строке; ставка — последней, по
 *         галочке. Подписей словами нет: строки различают порядок и порядок
 *         величин, режим называется в панели («Показано: …»).
 *
 * UX:     ПОМЕТКИ ТИХИЕ В ПОКОЕ И НЕ ЗАВИСЯТ ОТ РЕЖИМА: штамп «МИН» стоит
 *         всегда на минимуме стоимости позиции — подсветка «лучшая» вынута
 *         из селекта сознательно (§3 источника), монета запаса торга,
 *         штриховка аномалии и пунктир пробела данных отвечают на вопрос
 *         «куда смотреть»; «почему так» объясняет общий попап таблицы.
 *         Леденец «дороже медианы» упразднён вместе с моделью наборов:
 *         сигнал отклонения теперь живёт суффиксом по галочке.
 *         ОТКАЗ И ПРОБЕЛ — РАЗНЫЕ СОСТОЯНИЯ: отказ капсулой нейтрального тона,
 *         отсутствие цены — тире с пунктиром (отсутствие ключа — не ноль).
 * A11Y:   каждый триггер попапа — кнопка со своим именем; у аномалии цель —
 *         содержимое ячейки. Payload попапов собирается готовым — ячейка
 *         ничего не делегирует счёт.
 *
 * @example
 * <BidCell row={row} contractor={bid.contractor} view={view}
 *          thresholds={thresholds} bind={popup.bind} />
 */
export function BidCell({ row, contractor, view, thresholds, bind, note, flash }: {
  row: RowFacts;
  contractor: Contractor;
  view: CompareView;
  /** Пороги тендера: нормировка метра попапа делит их с фильтрами и легендой. */
  thresholds: CompareThresholds;
  bind: CellPopupBind;
  /** Комментарий разбора к этой ячейке («почему важно / что делать»).
   *  Приходит только ПОСЛЕ запуска анализа; до него попап показывает одни
   *  числа — словарь пометок живёт в легенде (Р4). */
  note?: string;
  /** Обводка от перехода «анализ → таблица»: fade-in и ~5s fade-out (05 §7). */
  flash?: boolean;
}) {
  const { position } = row;

  /* Снятая строка схлопывается во всех КП: история, а не мусор. */
  if (position.removed) {
    return (
      <td className={cx(tableCell.numeric, tableCell.roomy, flash && s.cellFlash)}>
        <span className={s.dash}>—</span>
      </td>
    );
  }

  const mark = cellMark(contractor, position.id);
  const price = contractor.prices[position.id];

  /* Отказ — решение подрядчика: нейтральная капсула. Не тревога и не пробел:
     красить решение в danger — врать о его природе. ИИ-комментария у отказа
     не бывает (05 §4.3.4). */
  if (mark.declined) {
    return (
      <td className={cx(tableCell.numeric, tableCell.roomy, flash && s.cellFlash)}>
        <span className={s.chip}>
          <Icon name="closeCircle" className={s.chipIcon} />
          Отказ
        </span>
      </td>
    );
  }

  /* Пробел данных: пунктирная рамка внутри ячейки («место было, содержимого
     нет») и тире. Отсутствие ключа — не ноль. Комментария не бывает. */
  if (price === undefined) {
    return (
      <td className={cx(tableCell.numeric, tableCell.roomy, s.cellMissing, flash && s.cellFlash)}>
        <span className={s.dash}>—</span>
        <span className={tableCell.sub}>нет цены</span>
      </td>
    );
  }

  const qty = position.qty;
  const sum = price * qty;
  const median = row.median;
  const dev = median !== null ? deviationPct(price, median) : null;

  /* Аномальность ячейки ОБЪЕДИНЯЕТ внешний вердикт и формулу k — флаг уже
     посчитан одним проходом в analyzeComparison, здесь он только читается. */
  const anomaly = row.bids.find((b) => b.contractorId === contractor.id)?.anomaly
    ?? hasAnomaly(mark);

  const plan = cellLines(view);

  /* Минимум стоимости — неподвижная точка опоры: при любом режиме указывает
     на ту же ячейку, селектом не управляется (§3 источника). */
  const isMin = row.bestId === contractor.id;

  /* Суффикс отклонения живёт на строке стоимости — главной или базовой.
     Правилу «подписей словами нет» подчиняется ВИЗУАЛ: скрытым текстом
     скринридер получает базу, иначе суффикс читается голым процентом. */
  const devSuffix = plan.deviationOn !== null && dev !== null ? (
    <span className={s.devSuffix}>
      {pctSigned(dev)}
      <VisuallyHidden> к медиане строки</VisuallyHidden>
    </span>
  ) : null;

  const spreadFraction = row.spread === null
    ? 0
    : Math.min(row.spread / thresholds.spreadHigh, 1);

  /* Монета запаса торга — пометка данных, от режима не зависит; сидит на
     главной строке у её основания (правый верхний угол занят штампом «МИН»). */
  const coinData: CellPopupData | null = mark.potential ? {
    tone: 'info',
    title: 'Заявленный запас торга',
    fields: [{ label: 'Запас торга', value: `+${money(mark.potential * qty)}`, tone: true }],
    ...(note ? { note } : {}),
  } : null;

  const minData: CellPopupData | null = isMin ? {
    tone: 'success',
    title: 'Минимальная стоимость',
    fields: [
      {
        label: 'Стоимость',
        value: (
          <>
            {money(sum)}
            <span className={s.popupUnit}>{money(price)}/{position.unit}</span>
          </>
        ),
      },
      ...(mark.potential
        ? [{ label: 'Запас торга', value: `+${money(mark.potential * qty)}`, tone: true }]
        : []),
      { label: 'К медиане строки', value: dev === null ? '—' : pctSigned(dev) },
    ],
    meter: row.spread === null
      ? undefined
      : { label: 'Разброс строки', value: `${decimal(row.spread)} %`, fraction: spreadFraction },
    ...(note ? { note } : {}),
  } : null;

  /* У пары из данных причина есть обязательно (контракт CellMark); пара,
     найденная только формулой k, объясняется стандартной фразой. Запас торга
     дублируется полем: монета в аномальной ячейке НЕ рендерится — она кнопка,
     а кнопка внутри триггера-кнопки запрещена и валидатором, и фокусом. */
  const anomalyData: CellPopupData = {
    tone: 'warning',
    title: 'Аномальная цена',
    fields: [
      { label: 'Стоимость', value: money(sum) },
      ...(mark.potential
        ? [{ label: 'Запас торга', value: `+${money(mark.potential * qty)}`, tone: true }]
        : []),
      { label: 'К медиане строки', value: dev === null ? '—' : pctSigned(dev) },
    ],
    meter: row.spread === null
      ? undefined
      : { label: 'Разброс строки', value: `${decimal(row.spread)} %`, fraction: spreadFraction },
    note: mark.anomaly
      ?? 'Цена выбивается из разброса остальных участников строки — запросить обоснование.',
  };

  /* Строки плана рендерятся как есть: порядок и состав меняет только модель. */
  const renderLine = (line: CellLine): ReactNode => {
    if (line.kind === 'rate') {
      return (
        <span key="rate" className={cx(tableCell.sub, s.rateLine)}>
          ≈ {money(price)}/{position.unit}
        </span>
      );
    }
    if (line.kind === 'base') {
      return (
        <span key="base" className={s.baseLine}>
          {money(sum)}
          {plan.deviationOn === 'base' ? devSuffix : null}
        </span>
      );
    }
    const head = line.metric === 'cost'
      ? money(sum)
      : mark.potential ? moneyCompact(mark.potential * qty) : '—';
    return (
      <span key="main" className={s.priceLine}>
        {/* .price держит position:relative для монеты; штамп «МИН» — прямой
            ребёнок td, координаты берёт от ячейки. */}
        <span className={s.price}>
          {head}
          {plan.deviationOn === 'main' ? devSuffix : null}
          {!anomaly && coinData ? (
            <button
              type="button"
              className={s.coin}
              aria-label="Заявленный запас торга"
              {...bind(coinData)}
            >
              <CoinMark />
            </button>
          ) : null}
        </span>
      </span>
    );
  };

  /* Главное значение и все его устройства живут одной строкой; резерв справа
     держит .stack — общий всем ячейкам колонки, поэтому выравнивание не едет. */
  const body = <span className={s.stack}>{plan.lines.map(renderLine)}</span>;

  if (!anomaly) {
    return (
      <td className={cx(tableCell.numeric, tableCell.roomy, isMin && s.cellMin, flash && s.cellFlash)}>
        {body}
        {isMin && minData ? (
          <button
            type="button"
            className={s.tag}
            aria-label="Минимальная стоимость"
            {...bind(minData)}
          >
            МИН
          </button>
        ) : null}
      </td>
    );
  }

  /* Аномалия: штриховка и рейка на ЯЧЕЙКЕ, триггер попапа — на содержимом:
     фокусная цель обязана быть интерактивным элементом, а не ячейкой.
     Обводка перехода ложится ПОВЕРХ штриховки через outline — оба сигнала
     читаются одновременно (05 §7). */
  return (
    <td className={cx(tableCell.numeric, tableCell.roomy, s.cellAnomaly, flash && s.cellFlash)}>
      <button
        type="button"
        className={s.anomalyTrigger}
        aria-label={`Аномальная цена: ${money(sum)}`}
        {...bind(anomalyData)}
      >
        {body}
      </button>
    </td>
  );
}
