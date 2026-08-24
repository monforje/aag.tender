import { type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import {
  cellLines, cellMark, decimal, deviationPct, hasAnomaly, money, moneyCompact, pendingCorrection, type CellLine, type CompareThresholds, type CompareView, type Contractor, type RowFacts,
} from '@/entities/comparison';
import type { CellPopupBind, CellPopupData } from '@/shared/ui/CellPopup';
import { tableCell } from '@/shared/ui/Table';
import { Icon } from '@/shared/ui/Icon';
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden';
import { pctSigned } from '../model/compareFormat';
import { CoinMark, CorrectionMark } from './assets';
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
 *         ⚠ «ИНОЙ ОБЪЁМ» — В СТРОКЕ СТОИМОСТИ, СРАЗУ ПОСЛЕ СУММЫ И ПЕРЕД
 *         СУФФИКСАМИ (разбор 23.08.2026 §2): он о том, можно ли вообще
 *         доверять этому числу, а суффиксы — уточнения к нему; знак,
 *         оттеснённый процентами вправо, читался бы ещё одним суффиксом.
 *         Слева от суммы не ставится: числа прижаты вправо, и знак повис бы
 *         в пустоте на разном расстоянии в каждой строке. Клика у него здесь
 *         НЕТ — навигировать некуда, ты уже в этой ячейке; раскрытие —
 *         наведение.
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
      <td className={cx(tableCell.numeric, s.bidCell, flash && s.cellFlash)}>
        <span className={s.dash}>—</span>
      </td>
    );
  }

  const mark = cellMark(contractor, position.id);
  const price = contractor.prices[position.id];

  /* АДРЕС ЯЧЕЙКИ И ЕЁ ПОМЕТКИ — В DOM, а не только в модели. Переход «строка
     перечня в уголке колонки → первая такая ячейка» берёт очерёдность из
     DOM, и это единственный честный источник: «первая» означает «первая в
     ТЕКУЩЕМ порядке строк», который задают вид строк, свёрнутые разделы и
     фильтры сразу, а модель о них не знает. Раньше так был помечен ОДИН вид
     пометки (`data-corr`), и обход умел ровно одно — корректировки. */
  const cellId = `${contractor.id}:${position.id}`;

  /* Отказ — решение подрядчика: нейтральная капсула. Не тревога и не пробел:
     красить решение в danger — врать о его природе. ИИ-комментария у отказа
     не бывает (05 §4.3.4). */
  if (mark.declined) {
    return (
      <td
        className={cx(tableCell.numeric, s.bidCell, flash && s.cellFlash)}
        data-cell={cellId}
        data-marks="declined"
      >
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
      <td
        className={cx(tableCell.numeric, s.bidCell, s.cellMissing, flash && s.cellFlash)}
        data-cell={cellId}
        data-marks="missing"
      >
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
     главной строке ВПЛОТНУЮ слева от числа. Штамп «МИН» с ней не спорит: он
     живёт в левом нижнем углу САМОЙ ЯЧЕЙКИ, ниже строки цены. */
  /* ⚠ «иной объём» существует ТОЛЬКО в состоянии «на рассмотрении» — это
     проверяет `pendingCorrection`, и она же единственная дверь к знаку во
     всех трёх осях: принял или отклонил — знак гаснет и в ячейке, и в шапке
     колонки, и в строке (разбор 23.08.2026 §1, §6). */
  const correction = pendingCorrection(mark);
  const correctionData: CellPopupData | null = correction ? {
    tone: 'warning',
    title: 'Цена названа за другой объём',
    fields: [
      { label: 'В смете', value: `${decimal(qty)} ${position.unit}` },
      { label: 'Поставщик считает', value: `${decimal(correction.qty)} ${position.unit}` },
    ],
    note: correction.note
      ?? 'Обоснование не приложено — цены посчитаны за разные объёмы, требуется решение.',
  } : null;

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
      /* ponytail: у аномальной ячейки ⚠ уходит ПОЛЕМ, а не своим знаком —
         триггером попапа там служит всё содержимое ячейки, и кнопка внутри
         кнопки запрещена и валидатором, и фокусом (та же причина, по которой
         прячется монета). Счётчики строки и колонки такую ячейку всё равно
         считают, и это сознательный перекос: по канону цена за иной объём из
         сравнения выключается и аномальной стать не успевает. Понадобится
         сойтись — выносить триггер аномалии с содержимого на отдельный
         элемент. */
      ...(correction
        ? [{ label: 'Поставщик считает', value: `${decimal(correction.qty)} ${position.unit}` }]
        : []),
      { label: 'К медиане строки', value: dev === null ? '—' : pctSigned(dev) },
    ],
    meter: row.spread === null
      ? undefined
      : { label: 'Разброс строки', value: `${decimal(row.spread)} %`, fraction: spreadFraction },
    note: mark.anomaly
      ?? 'Цена выбивается из разброса остальных участников строки — запросить обоснование.',
  };

  /* Знак ⚠ рисуется у ТОГО ЧИСЛА, которое является стоимостью: в режиме
     «Стоимость» это главная строка, в режиме «Потенциал» — базовая под ней.
     Второго знака в ячейке быть не должно (разбор §2). */
  const corrMark = correctionData ? (
    <button
      type="button"
      className={cx(s.corr, s.corrHint)}
      aria-label={`Цена названа за другой объём: ${decimal(correction!.qty)} ${position.unit} вместо ${decimal(qty)}`}
      {...bind(correctionData)}
    >
      <CorrectionMark />
    </button>
  ) : null;

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
          {anomaly ? null : corrMark}
          {plan.deviationOn === 'base' ? devSuffix : null}
        </span>
      );
    }
    const head = line.metric === 'cost'
      ? money(sum)
      : mark.potential ? moneyCompact(mark.potential * qty) : '—';
    return (
      <span key="main" className={s.priceLine}>
        {/* .price — якорь монеты: она стоит ВПЛОТНУЮ слева от числа (решение
            владельца 24.08.2026 — прежние −25px читались отрывом). Штампа
            «МИН» здесь нет: его место — угол ячейки, см. ниже. */}
        <span className={s.price}>
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
          {head}
          {line.metric === 'cost' && !anomaly ? corrMark : null}
          {plan.deviationOn === 'main' ? devSuffix : null}
        </span>
      </span>
    );
  };

  /* Главное значение и его строки-спутники — одной группой у числа цены. */
  const body = (
    <span className={s.stack}>
      {plan.lines.map(renderLine)}
    </span>
  );

  /* Порядок слов не значит ничего — атрибут читают селектором `~=`. Минимум
     попадает сюда и у аномальной ячейки, хотя штамп «МИН» там не рисуется:
     счёт в панели колонки считает его тем же предикатом (`row.bestId`), и
     разойдись список с ним — кнопка «лучшая цена: 7» водила бы по шести. */
  const marks = [
    isMin && 'min',
    anomaly && 'anomaly',
    correction && 'correction',
  ].filter(Boolean).join(' ');

  if (!anomaly) {
    return (
      /* ШТАМП «МИН» — В ЛЕВОМ НИЖНЕМ УГЛУ ЯЧЕЙКИ (решение владельца
         24.08.2026, вторая волна: правый верхний угол блока цены оказался «в
         корне не верным» — надстрочный знак читался частью числа). Угол
         ячейки, а не блока цены: числа выровнены вправо, и слева у них
         пустует ровно то место, где отметка никому не мешает и стоит у всех
         строк на одной вертикали. Позиционируется по .cell--min. */
      <td
        className={cx(tableCell.numeric, s.bidCell, s.cellMin, flash && s.cellFlash)}
        data-cell={cellId}
        data-marks={marks || undefined}
      >
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
    <td
      className={cx(tableCell.numeric, s.bidCell, s.cellAnomaly, flash && s.cellFlash)}
      data-cell={cellId}
      data-marks={marks || undefined}
    >
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
