import { type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import {
  cellMark, DEV_TOLERANCE, decimal, deviationPct, hasAnomaly, money, shownMetrics,
  type CompareView, type Contractor, type RowFacts,
} from '@/entities/tender';
import type { CellPopupBind, CellPopupData } from '@/shared/ui/CellPopup';
import { tableCell } from '@/shared/ui/Table';
import { Icon } from '@/shared/ui/Icon';
import { pctSigned } from '../model/compareFormat';
import { CoinMark, MedMark } from './assets';
import s from './TenderCompare.module.css';

/**
 * Ячейка КП: цена одного подрядчика в одной позиции строки сравнения.
 *
 * КОГДА:  в хвосте каждой строки <CompareRow> — по одной на поданное КП.
 * НЕ ДЛЯ: колонки «Разброс» (см. SpreadCell) и сводки по подрядчику
 *         (см. ContractorCard) — здесь только ОДНА расценка и её пометки.
 *
 * UX:     ГЛАВНОЕ ЧИСЛО ячейки живёт одной строкой, под ним удельная цена
 *         и дополнительные показатели пресета (максимум три). ПОМЕТКИ ТИХИЕ
 *         В ПОКОЕ: зелёный штамп «МИН» в правом верхнем углу ячейки,
 *         монета запаса торга, леденец «дороже медианы», штриховка аномалии
 *         отвечают на вопрос «куда смотреть»; «почему так» объясняет общий
 *         попап таблицы.
 *         Минимум живёт ТОЛЬКО в режиме «Цена» и только у лучшей неаномальной
 *         цены при живой конкуренции (§2, §4.6 аудита). Леденец — только когда
 *         смысл не занят ценником или штриховкой: второй глиф про то же был бы
 *         шумом.
 *         ОТКАЗ И ПРОБЕЛ — РАЗНЫЕ СОСТОЯНИЯ: отказ капсулой нейтрального тона
 *         (решение подрядчика; красить его в danger — врать о природе),
 *         отсутствие цены — тире с пунктиром (дыра в КП; отсутствие ключа —
 *         не ноль).
 * A11Y:   каждый триггер попапа — кнопка со своим именем; у аномалии цель —
 *         содержимое ячейки, а не сама ячейка: фокусная цель обязана быть
 *         интерактивным элементом. Payload попапов собирается готовым —
 *         ячейка ничего не делегирует счёт.
 *
 * @example
 * <BidCell row={row} contractor={bid.contractor} view={view} bind={popup.bind} />
 */
export function BidCell({ row, contractor, view, bind }: {
  row: RowFacts;
  contractor: Contractor;
  view: CompareView;
  bind: CellPopupBind;
}) {
  const { position } = row;

  /* Снятая строка схлопывается во всех КП: история, а не мусор. */
  if (position.removed) {
    return (
      <td className={cx(tableCell.numeric, tableCell.roomy)}>
        <span className={s.dash}>—</span>
      </td>
    );
  }

  const mark = cellMark(contractor, position.id);
  const price = contractor.prices[position.id];

  /* Отказ — решение подрядчика: нейтральная капсула. Не тревога и не пробел:
     красить решение в danger — врать о его природе. */
  if (mark.declined) {
    return (
      <td className={cx(tableCell.numeric, tableCell.roomy)}>
        <span className={s.chip}>
          <Icon name="closeCircle" className={s.chipIcon} />
          Отказ
        </span>
      </td>
    );
  }

  /* Пробел данных: пунктирная рамка внутри ячейки («место было, содержимого
     нет») и тире. Отсутствие ключа — не ноль. */
  if (price === undefined) {
    return (
      <td className={cx(tableCell.numeric, tableCell.roomy, s.cellMissing)}>
        <span className={s.dash}>—</span>
        <span className={tableCell.sub}>нет цены</span>
      </td>
    );
  }

  const qty = position.qty;
  const sum = price * qty;
  const anomaly = hasAnomaly(mark);
  const median = row.median;
  const dev = median !== null ? deviationPct(price, median) : null;

  const metrics = shownMetrics(view);
  const mainMetric = metrics[0];
  const extras = metrics.slice(1);

  /* Минимум живёт ТОЛЬКО в режиме «Цена» и только у лучшей неаномальной цены
     при живой конкуренции (§2, §4.6 аудита). */
  const isMin = mainMetric === 'price' && row.bestId === contractor.id;

  /* Главное число ячейки — по выбранному показателю. */
  let head: ReactNode;
  if (mainMetric === 'price') {
    head = money(sum);
  } else if (mainMetric === 'potential') {
    head = mark.potential ? `+${money(mark.potential * qty)}` : '—';
  } else {
    head = dev === null ? '—' : (
      <span className={cx(Math.abs(dev) > DEV_TOLERANCE && s.devHot)}>
        {pctSigned(dev)}
      </span>
    );
  }

  /* Подстрочники: удельная цена всегда, за ней дополнительные показатели
     пресета (максимум три показателя на ячейку). */
  const subs = [
    <span key="unit" className={tableCell.sub}>{money(price)}/{position.unit}</span>,
    ...extras.map((m) => (
      <span key={m} className={tableCell.sub}>
        {m === 'price'
          ? money(sum)
          : m === 'potential'
            ? (mark.potential ? `+${money(mark.potential * qty)}` : 'без запаса')
            : `${dev === null ? '—' : pctSigned(dev)} к медиане`}
      </span>
    )),
  ];

  /* Попапы пометок получают payload готовым — ничего не считают сами. */
  const spreadFraction = row.spread === null ? 0 : Math.min(row.spread / 25, 1);
  const minData: CellPopupData | null = isMin ? {
    tone: 'success',
    title: 'Минимальное значение',
    fields: [
      {
        label: 'Значение',
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
    note: 'Лучшая цена среди НЕаномальных предложений строки.',
  } : null;

  const coinData: CellPopupData | null = mark.potential ? {
    tone: 'info',
    title: 'Заявленный запас торга',
    fields: [{ label: 'Запас торга', value: `+${money(mark.potential * qty)}`, tone: true }],
    note: 'Сумма, которую подрядчик сам обозначил как возможную к скидке: вход в торг, а не вывод.',
  } : null;

  const medShown = mainMetric === 'price'
    && !isMin && !anomaly
    && dev !== null && dev > DEV_TOLERANCE;

  const anomalyData: CellPopupData = {
    tone: 'warning',
    title: 'Аномальная цена',
    fields: [
      { label: 'Значение', value: money(sum) },
      { label: 'К медиане строки', value: dev === null ? '—' : pctSigned(dev) },
    ],
    meter: row.spread === null
      ? undefined
      : { label: 'Разброс строки', value: `${decimal(row.spread)} %`, fraction: spreadFraction },
    note: mark.anomaly ?? '',
  };

  /* Главное значение и все его устройства живут одной строкой; резерв справа
     держит .stack — общий всем ячейкам колонки, поэтому выравнивание не едет. */
  const body = (
    <span className={s.stack}>
      <span className={s.priceLine}>
        {mainMetric === 'price' ? (
          <>
            <span className={s.price}>
              {head}
              {/* Монета — у ОСНОВАНИЯ цены слева: правый верхний угол ячейки
                  занят штампом «МИН». */}
              {coinData ? (
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
            {/* Леденец «дороже медианы» — только когда смысл не занят ценником
                или штриховкой: второй глиф про то же был бы шумом. */}
            {medShown ? (
              <button
                type="button"
                className={s.medMark}
                aria-label="Заметно дороже медианы"
                {...bind({
                  tone: 'neutral',
                  title: 'Заметно дороже медианы',
                  fields: [
                    { label: 'Значение', value: money(sum) },
                    { label: 'К медиане строки', value: dev === null ? '—' : pctSigned(dev) },
                  ],
                  note: 'Цена выше медианы строки больше чем на 5 % — тот же порог, что красит отклонение.',
                })}
              >
                <MedMark />
              </button>
            ) : null}
          </>
        ) : head}
      </span>
      {subs}
    </span>
  );

  if (!anomaly) {
    return (
      /* Штамп «МИН» — ПРЯМОЙ ребёнок td: .price держит position:relative
         для монеты и перехватил бы абсолют у отметки (она оказалась бы на
         цене). Контейнер координат — td (.cell--min): угол ячейки, поверх
         потока. Триггер попапа — сам штамп: «шлёп» и объяснение появляются,
         только когда курсор на нём. */
      <td className={cx(tableCell.numeric, tableCell.roomy, isMin && s.cellMin)}>
        {body}
        {isMin && minData ? (
          <button
            type="button"
            className={s.tag}
            aria-label="Минимальное значение"
            {...bind(minData)}
          >
            МИН
          </button>
        ) : null}
      </td>
    );
  }

  /* Аномалия: штриховка и рейка на ЯЧЕЙКЕ, триггер попапа — на содержимом:
     фокусная цель обязана быть интерактивным элементом, а не ячейкой. */
  return (
    <td className={cx(tableCell.numeric, tableCell.roomy, s.cellAnomaly)}>
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
