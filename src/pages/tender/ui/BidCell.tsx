import { type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import {
  cellLines, cellMark, decimal, money, moneyCompact, pendingCorrection,
  type CellLine, type CompareThresholds, type CompareView, type Contractor, type RowFacts,
} from '@/entities/comparison';
import type { CellPopupBind } from '@/shared/ui/CellPopup';
import { tableCell } from '@/shared/ui/Table';
import { Icon } from '@/shared/ui/Icon';
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden';
import { cellStateOf, cellSummary, pctSigned, signSummary } from '../model/compareFormat';
import { CoinMark, CommentMark, CorrectionMark } from './assets';
import s from './TenderCompare.module.css';

/** Что открывает клик внутри ячейки. Одно перечисление и ОДИН колбэк на три
 *  действия — не из экономии, а ради memo: <CompareRow> мемоизирован по
 *  ссылкам пропов, и три отдельных обработчика пришлось бы стабилизировать
 *  тремя `useCallback` с риском, что один забудут. */
export type CellAction = 'card' | 'thread' | 'correction';

/** Кто и по какой работе — плюс прямоугольник цели, от которого падает
 *  панель. Элемент, а не координаты: панель переоткрывается при прокрутке, и
 *  живой элемент знает, где он сейчас. */
export type CellActionHandler = (
  action: CellAction, contractorId: string, positionId: string, at: HTMLElement,
) => void;

/**
 * Ячейка КП: показатели одного подрядчика по одной работе.
 *
 * КОГДА:  в хвосте каждой строки <CompareRow> — по одной на колонку.
 * НЕ ДЛЯ: колонки «Разброс» (см. SpreadCell), столбца «Потенциал»
 *         (см. PotentialCell) и сводки по подрядчику (см. ContractorCard).
 *
 * СОСТАВ СТРОК задаёт `cellLines()` (модель ячейки, источник §1): основной
 *         показатель первой строкой; стоимость присутствует ВСЕГДА — если
 *         основной не она, второй строкой как база; отклонение липнет к
 *         стоимости суффиксом на той же строке; ставка — последней, по
 *         галочке ЛИБО принудительно при непринятой корректировке (§2.6):
 *         цена, посчитанная за чужой объём, без собственной базы нечитаема.
 *
 * КАРТА МЕСТ — ФИКСИРОВАННАЯ, И ЭТО ГЛАВНОЕ ПРАВИЛО ЯЧЕЙКИ (решение владельца
 *         25.08.2026). До него знаки вставали «куда получится»: ⚠ и маркер
 *         переписки делили одну кучку у правой кромки, наезжая на число и друг
 *         на друга, а место кучки зависело от того, сколько знаков выпало
 *         ячейке. Единственный знак, который читался всегда, — штамп «мин»,
 *         и ровно потому, что у него было СВОЁ место. Теперь своё место есть
 *         у каждого:
 *
 *           левый ВЕРХНИЙ угол   — БАР МАРКЕРОВ: ⚠ решения, следом маркер
 *                                  переписки, дальше всё, что придёт;
 *           левый НИЖНИЙ угол    — штамп «мин»;
 *           левая кромка         — риска аномалии;
 *           вплотную к числу     — монета запаса торга.
 *
 *         ВСЕ ЗНАКИ СЛЕВА, И ЭТО НЕ СИММЕТРИЯ, А АРИФМЕТИКА (правка владельца
 *         25.08.2026). Маркер переписки успел постоять и по центру правой
 *         кромки, и в правом верхнем углу; оба места плохи по одной причине —
 *         ЧИСЛА ВЫРОВНЕНЫ ВПРАВО. Знак у правой кромки либо наезжает на
 *         разряды, либо требует постоянного резерва в 26px у КАЖДОЙ из 780
 *         ячеек: место у цены отнимается везде ради пометки у восьмидесяти.
 *         Слева этого места не жалко — там пусто по построению, и пусто
 *         одинаково во всех строках.
 *         Один ряд на все знаки клетки снимает заодно и вопрос «в каком углу
 *         смотреть»: угол один, порядок в нём фиксирован.
 *
 * UX:     ЦЕЛЬ — САМО ЧИСЛО, А НЕ ВСЯ ЯЧЕЙКА (правка владельца 25.08.2026).
 *         Наведение на ЦЕНУ раскрывает накопительную сводку, клик по ней —
 *         карточку пары «позиция × подрядчик». Целью была вся `<td>`, и это
 *         давало попап при проходе курсора по пустому полю ячейки — то есть
 *         подсказку о числе, на которое человек не смотрит. Подсветка при
 *         этом осталась НА ВСЕЙ ЯЧЕЙКЕ: ховер отвечает «вот эта клетка», а
 *         попап — «вот это число», и совмещать эти два ответа в одной зоне не
 *         нужно.
 *         РАЗДЕЛЬНЫЕ ЦЕЛИ (§4.7, обязательное для прода): тело и каждый знак
 *         подсвечиваются по отдельности — наведение на знак ГАСИТ подсветку
 *         ячейки (`:has(.sign:hover)`), и до клика видно, какая цель активна.
 *         НИ ОБЁРТОК, НИ КНОПОК-ПРОСЛОЕК: цель вешается на тот `<span>`,
 *         который в ячейке И ТАК ЕСТЬ (`.stack`, капсула отказа, прочерк).
 *         Это ИЗМЕРЕННОЕ ограничение: лишняя пара боксов на ячейку — это 1560
 *         боксов на 65×12, и платит за них КАЖДЫЙ кадр прокрутки (p50 16,7 →
 *         33,3 мс, поток 1446 → 3938 мс; puppeteer, --cpu 4, медиана трёх
 *         прогонов). Проверено адресно: `display: contents` на обоих узлах
 *         возвращает 16,7 — платят именно БОКСЫ, а не обработчики.
 *         КАЖДЫЙ ЗНАК ОБЪЯСНЯЕТ СЕБЯ ПОД КУРСОРОМ (правка владельца 25.08.2026,
 *         вечер). Слова из ячейки убраны, и вместе с ними пропало объяснение:
 *         цель сводки — ЦЕНА, а штриховка аномалии, штамп «мин» и знак ⚠ лежат
 *         ВНЕ её, каждый на своём месте карты. Наведение на штриховку не давало
 *         ничего вовсе — знак «проверь это» не отвечал, что проверять. Теперь у
 *         риски, штампа и ⚠ своя сводка (`signSummary`): что означает знак и
 *         какое у него ЗДЕСЬ число. Монеты в этом списке нет намеренно — она
 *         стоит внутри тела ячейки и отбирала бы попап у цены при каждом
 *         проходе курсора, а запас торга и так назван строкой сводки.
 *         СЛОВ В ЯЧЕЙКЕ НЕТ (правило владельца 25.08.2026): аномалия —
 *         штриховка и риска на кромке, минимум — канонический штамп «мин».
 *         Все объяснения ушли в сводку. Засечка максимума снята там же
 *         (правка 25.08.2026): двухпиксельная черта над числом читалась
 *         подчёркиванием или артефактом рендера, а не «верхней границей», и
 *         спрашивать о ней было некого — сводка отвечает и без неё.
 *         ОТКАЗ, ПРОБЕЛ И ОЖИДАНИЕ — ТРИ РАЗНЫХ СОСТОЯНИЯ (§2.8): отказ это
 *         решение подрядчика, пробел — дыра в КП, ожидание — «запрос ушёл,
 *         ответа нет». Действия у них разные, поэтому и вид разный.
 * A11Y:   цель фокусируема и несёт своё имя (подрядчик + работа + словами
 *         названная аномалия: штриховка и риска для скринридера не
 *         существуют). Знаки — отдельные кнопки со своими именами, и порядок
 *         обхода внутри ячейки естественный: сначала число, потом знаки.
 *
 * @example
 * <BidCell row={row} contractor={bid.contractor} view={view}
 *          thresholds={thresholds} bind={popup.bind} onAction={onCellAction} />
 */
export function BidCell({
  row, contractor, view, thresholds, bind, note, flash, comments, onAction,
}: {
  row: RowFacts;
  contractor: Contractor;
  view: CompareView;
  /** Пороги тендера: нормировка метра сводки делит их с фильтрами и легендой. */
  thresholds: CompareThresholds;
  bind: CellPopupBind;
  /** Комментарий разбора ИИ к этой ячейке; до запуска пусто (Р4). */
  note?: string;
  /** Обводка от перехода «анализ → таблица»: fade-in и ~5s fade-out (05 §7). */
  flash?: boolean;
  /** Переписка по ячейке: сколько записей и есть ли непросмотренные.
   *  Пусто — истории нет, маркер не рисуется вовсе. */
  comments?: { total: number; unread: boolean };
  onAction: CellActionHandler;
}) {
  const { position } = row;
  const cellId = `${contractor.id}:${position.id}`;
  const state = cellStateOf(contractor, position.id, position.removed);

  const mark = cellMark(contractor, position.id);
  const price = contractor.prices[position.id];
  const correction = pendingCorrection(mark);
  const anomaly = row.bids.find((b) => b.contractorId === contractor.id)?.anomaly ?? false;
  const isMin = row.bestIds.includes(contractor.id);

  /* Сводка собирается ОДНОЙ функцией на все ветки — порядок строк нельзя
     нарушить правкой одной из них (см. `cellSummary`). */
  const summary = cellSummary({ row, contractor, state, thresholds, note, comments });

  /* Порядок слов не значит ничего — атрибут читают селектором `~=`. */
  const marks = [
    isMin && 'min',
    row.maxIds.includes(contractor.id) && 'max',
    anomaly && 'anomaly',
    correction && 'correction',
    state === 'missing' && 'missing',
    state === 'waiting' && 'waiting',
    state === 'declined' && 'declined',
  ].filter(Boolean).join(' ');

  /* ЦЕЛЬ СВОДКИ И КАРТОЧКИ — САМО ЧИСЛО. Собирается одним объектом и
     раскладывается на тот `<span>`, который в ветке уже есть: обёртки под неё
     не заводится ни в одной (разбор — в JSDoc).
     ПОРЯДОК ВАЖЕН: `bind` раскладывается ПЕРВЫМ, собственный onClick —
     последним. У `bind` свой onClick (раскрытие касанием на тач, §4.6), и
     разложи его после — он затёр бы открытие карточки, а заметить это можно
     было бы только пальцем на планшете. */
  const target = {
    tabIndex: 0,
    role: 'button',
    'aria-label': `${contractor.name}, ${position.title}${anomaly ? '. Аномальная цена, проверить' : ''}`,
    ...bind(summary),
    onClick: (e: React.MouseEvent<HTMLElement>) =>
      onAction('card', contractor.id, position.id, e.currentTarget),
  } as const;

  /* ── БАР МАРКЕРОВ ЛЕВОГО ВЕРХНЕГО УГЛА ─────────────────────────────────
     Флекс-ряд: ⚠ первым, переписка следом, дальше по порядку появления.
     Каждый ведёт ТУДА, ГДЕ ПРИНИМАЮТ РЕШЕНИЕ: ⚠ — в панель решения по
     корректировке (§2.7), маркер — в тред. Раньше ⚠ только раскрывался
     наведением, и знак «требуется твоё решение» решения не предлагал. */
  const corner: ReactNode[] = [];
  if (correction) {
    corner.push(
      <button
        key="corr"
        type="button"
        className={cx(s.sign, s.sgn, s.corr, s.corrHint)}
        aria-label={`Решение по корректировке: цена названа за ${decimal(correction.qty)} ${position.unit} вместо ${decimal(position.qty)}`}
        {...bind(signSummary('correction', { row, contractor }))}
        onClick={(e) => onAction('correction', contractor.id, position.id, e.currentTarget)}
      >
        <CorrectionMark />
      </button>,
    );
  }
  /* МАРКЕР ПЕРЕПИСКИ — В ТОМ ЖЕ РЯДУ, ЗА ⚠ (правка владельца 25.08.2026).
     Правым верхним углом он побыл полдня и оттуда мешал ровно тому, ради
     чего колонку читают: числа выровнены ВПРАВО, и любой знак у правой
     кромки либо наезжает на разряды, либо требует резерва в 26px у каждой из
     780 ячеек — то есть отнимает место у цены везде ради пометки у восьмидесяти.
     Слева этого места не жалко: там пусто по построению. Один ряд на все
     знаки клетки заодно снимает вопрос «в каком углу смотреть» — угол один. */
  if (comments?.total) {
    corner.push(
      <button
        key="cmt"
        type="button"
        className={cx(
          s.sign, s.sgn, s.cmark,
          comments.unread && s.cmarkUnread,
          /* Один в ряду — стоит на месте ⚠, и колонка пометок читается
             вразнобой; три пикселя возвращают ему собственное место. */
          !correction && s.cmarkSolo,
        )}
        aria-label={comments.unread
          ? `Комментарии (${comments.total}), есть непросмотренные`
          : `Комментарии (${comments.total})`}
        title={comments.unread
          ? `Комментарии (${comments.total}) · есть непросмотренные`
          : `Комментарии (${comments.total})`}
        onClick={(e) => onAction('thread', contractor.id, position.id, e.currentTarget)}
      >
        <CommentMark unread={comments.unread} />
      </button>,
    );
  }

  /* Снятая строка схлопывается во всех КП: история, а не мусор. Ни целей, ни
     знаков у неё нет — решать по позиции, которой в смете нет, нечего. */
  if (state === 'removed') {
    return (
      <td className={cx(tableCell.numeric, s.bidCell, flash && s.cellFlash)}>
        <span className={s.dash}>—</span>
      </td>
    );
  }

  /* ── СОСТАВ ТЕЛА ───────────────────────────────────────────────────────── */
  let body: ReactNode;

  if (state === 'declined') {
    /* Отказ — решение подрядчика: нейтральная капсула. Не тревога и не
       пробел: красить решение в danger — врать о его природе. */
    body = (
      <span className={cx(s.chip, s.hovBody)} {...target}>
        <Icon name="closeCircle" className={s.chipIcon} />
        Отказ
      </span>
    );
  } else if (state === 'waiting') {
    /* Ожидание — СОБСТВЕННОЕ состояние, а не разновидность прочерка (§2.8):
       точки говорят «идёт», прочерк говорит «нет». Движение гасится
       глобальным правилом prefers-reduced-motion, сами точки остаются. */
    body = (
      <span className={cx(s.waitDots, s.hovBody)} {...target}>
        <i /><i /><i />
      </span>
    );
  } else if (state === 'missing') {
    /* Пробел данных: тире. Отсутствие ключа — не ноль. Пунктирную рамку
       держит модификатор ячейки. */
    body = <span className={cx(s.dash, s.hovBody)} {...target}>—</span>;
  } else {
    const qty = position.qty;
    const sum = price! * qty;
    const dev = row.median !== null
      ? ((price! - row.median) / row.median) * 100
      : null;

    /* ПРИНУДИТЕЛЬНАЯ СТАВКА С МЕТКОЙ БАЗЫ (§2.6). Пока корректировка не
       рассмотрена, сумма посчитана за ОБЪЁМ ПОСТАВЩИКА, и без ставки и её
       базы это число не с чем сопоставить — сравнивать его с соседями по
       строке нельзя вовсе. */
    const plan = cellLines(view, correction ? {
      rate: true,
      baseLabel: `его объём ${decimal(correction.qty)} ${position.unit}`,
    } : undefined);

    const devSuffix = plan.deviationOn !== null && dev !== null ? (
      <span className={s.devSuffix}>
        {pctSigned(dev)}
        <VisuallyHidden> к медиане строки</VisuallyHidden>
      </span>
    ) : null;

    /* ── ДИНАМИКА: ИЗМЕНЕНИЕ К СОБСТВЕННОМУ ПРОШЛОМУ КП (§3.1) ─────────────
       База — `prevPrices` ЭТОГО ЖЕ подрядчика, а не чужие предложения:
       вопрос спутника «подвинулся ли ОН», и сравнивать его с соседями по
       строке значило бы отвечать на вопрос отклонения второй раз.
       Ключа нет — этот подрядчик в прошлом раунде позицию не закрывал (или
       раунд первый), и суффикса не будет вовсе: «0 %» здесь означал бы
       «не менял цену», что неправда.
       ТОН ОТ ЗНАКА, а не от величины: подешевел — success, подорожал —
       danger. Стрелка дублирует тон формой — цвет не единственный канал. */
    const prev = contractor.prevPrices?.[position.id];
    const dyn = plan.dynamicsOn !== null && prev !== undefined && prev !== 0
      ? ((price! - prev) / prev) * 100
      : null;
    const dynSuffix = dyn === null ? null : (
      <span className={cx(s.dynSuffix, dyn < 0 ? s.dynSuffixDown : dyn > 0 ? s.dynSuffixUp : undefined)}>
        {dyn === 0 ? '=' : dyn < 0 ? '▼' : '▲'}
        {dyn === 0 ? null : ` ${decimal(Math.abs(dyn))} %`}
        <VisuallyHidden> к прошлому раунду</VisuallyHidden>
      </span>
    );

    const renderLine = (line: CellLine): ReactNode => {
      if (line.kind === 'rate') {
        return (
          <span key="rate" className={cx(tableCell.sub, s.rateLine)}>
            ≈ {money(price!)}/{position.unit}
            {line.baseLabel ? <> · {line.baseLabel}</> : null}
          </span>
        );
      }
      if (line.kind === 'base') {
        return (
          <span key="base" className={s.baseLine}>
            {money(sum)}
            {plan.deviationOn === 'base' ? devSuffix : null}
            {plan.dynamicsOn === 'base' ? dynSuffix : null}
          </span>
        );
      }
      const head = line.metric === 'cost'
        ? money(sum)
        : mark.potential ? moneyCompact(mark.potential * qty) : '—';
      return (
        <span key="main" className={s.priceLine}>
          <span className={s.price}>
            {/* Монета — ПОМЕТКА, а не кнопка: кнопка внутри кнопки-тела была
                бы невозможна. Но СВОЯ СВОДКА у неё с 25.08.2026 есть (§9):
                запас торга — единственная величина ячейки, которой нет в её
                числах, и знак, молчащий под курсором, не объясняет ничего.
                `bind` раскладывается на сам знак, поэтому наведение на монету
                подменяет содержимое попапа, а наведение мимо неё оставляет
                сводку цены. */}
            {mark.potential ? (
              <span
                className={cx(s.coin, s.sgn)}
                role="img"
                aria-label={`Запас торга: ${money(mark.potential * qty)}`}
                {...bind(signSummary('coin', { row, contractor }))}
              >
                <CoinMark />
              </span>
            ) : null}
            {head}
            {plan.deviationOn === 'main' ? devSuffix : null}
            {plan.dynamicsOn === 'main' ? dynSuffix : null}
          </span>
        </span>
      );
    };

    body = (
      <span className={cx(s.stack, s.hovBody)} {...target}>
        {plan.lines.map(renderLine)}
      </span>
    );
  }

  return (
    <td
      className={cx(
        tableCell.numeric, s.bidCell,
        anomaly && s.cellAnomaly,
        state === 'missing' && s.cellMissing,
        isMin && s.cellMin,
        flash && s.cellFlash,
      )}
      data-cell={cellId}
      data-marks={marks || undefined}
      /* ШТРИХОВКА ОБЪЯСНЯЕТ СЕБЯ ПО ВСЕЙ СВОЕЙ ПЛОЩАДИ (правка владельца
         25.08.2026). Сводка аномалии висела только на риске — полоске 9px у
         левой кромки, — а СПРАШИВАЮТ про штриховку: она занимает клетку
         целиком, и курсор попадает на неё где угодно, кроме этих девяти
         пикселей. Знак «проверь это» молчал ровно там, где на него смотрят.
         Бинд стоит на самой `<td>` и только у аномальных ячеек: цель цены
         остаётся своей и перебивает эту, потому что вход курсора в неё
         вложенный и происходит позже. */
      {...(anomaly ? bind(signSummary('anomaly', { row, contractor })) : {})}
    >
      {/* Риска аномалии на левой кромке (§2.3): штриховку СОХРАНЯЕМ — решение
          владельца, — а риска добавляет второй канал, читаемый при выключенной
          подсветке. Знака «!» на ней нет (правка 25.08.2026). */}
      {anomaly ? (
        <span
          className={cx(s.riska, s.sgn)}
          aria-hidden="true"
          {...bind(signSummary('anomaly', { row, contractor }))}
        />
      ) : null}

      {/* БАР МАРКЕРОВ ЛЕВОГО ВЕРХНЕГО УГЛА — один флекс-ряд на все знаки
          клетки: ⚠ решения, следом переписка. Порядок фиксирован. */}
      {corner.length ? <span className={s.cornerSigns}>{corner}</span> : null}

      {body}

      {/* Штамп «мин» — в левом нижнем углу ЯЧЕЙКИ: числа выровнены вправо, и
          слева у них пустует ровно то место, где отметка никому не мешает и
          стоит у всех строк на одной вертикали. С 25.08.2026 это ПОМЕТКА, а
          не кнопка: критерий минимума объясняет сводка тела. */}
      {isMin ? (
        <span
          className={cx(s.tag, s.sgn)}
          aria-hidden="true"
          {...bind(signSummary('min', { row, contractor }))}
        >
          мин
        </span>
      ) : null}
    </td>
  );
}
