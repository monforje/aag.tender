import { memo, type CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import {
  decimal, money, type Bid, type CompareThresholds, type CompareView, type RowFacts,
} from '@/entities/comparison';
import type { CellPopupBind, CellPopupData } from '@/shared/ui/CellPopup';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { tableCell } from '@/shared/ui/Table';
import { clipTitle, keySummary } from '../model/compareFormat';
import { BidCell, type CellActionHandler } from './BidCell';
import { KeyMark } from './assets';
import { PotentialCell } from './PotentialCell';
import { SpreadCell } from './SpreadCell';
import s from './TenderCompare.module.css';

/**
 * Строка позиции в таблице сравнения: номер, имя (+бейдж ключа), служебная
 * строка «раздел · полоса вклада · процент», объём, единица, разброс,
 * потенциал и ячейки КП.
 *
 * КОГДА:  и в виде «По разделам», и в плоских видах — строку собирает
 *         <TenderCompare>.
 * НЕ ДЛЯ: строки реестра тендеров (см. TenderRegistryPage), строки итога
 *         (см. TotalRow) и шапки колонки (см. ContractorCard).
 *
 * UX:     НОМЕР — СВОЯ КОЛОНКА «№» (§7 правок владельца 25.08.2026, вечер):
 *         44px фиксированной ширины, значение табличными 12px по центру
 *         высоты строки. Это третий подход к одному числу: гуттер в 36px внутри
 *         якоря отнимал их у названия, левый верхний угол поднимал каждую
 *         строку на 13px и ни с чем не выравнивался. Колонка не делает ни
 *         того, ни другого — и заодно даёт номеру заголовок, то есть имя.
 *         При закреплении якоря пара «№ + Позиция» едет ЦЕЛИКОМ (stickyCol=2):
 *         закреплённое название без своего номера теряет связь с выгрузкой и
 *         с разговором («смотри 47-ю»).
 *         Нумерация сквозная по СМЕТЕ и в хвосте отсечки продолжается, а не
 *         начинается заново.
 *         СЛУЖЕБНАЯ СТРОКА ЕСТЬ ВСЕГДА (§2.1 правок владельца 25.08.2026):
 *         вторая строка ячейки-якоря отдана паре «раздел · полоса вклада с
 *         процентом», и состав её постоянен. Полоса до этого жила только в
 *         развёрнутом режиме — потому что в ОДНОЙ строке с названием она
 *         отнимала у него 147px флекс-ряда. На своей строке она не отнимает
 *         ничего: платит высотой, одинаковой у всех строк, а не шириной у
 *         одной. Проценты стоят на общей вертикали — жмётся первой подпись
 *         раздела, трек тянется по остатку, число прижато к правому краю.
 *         Длина полосы НОРМИРОВАНА ПО ЛИДЕРУ, а не по сотне: на 65 позициях
 *         доли редко выходят за 20 %, и деление на 100 % прятало бы разницу
 *         между 12,4 % и 18,7 % в двух почти одинаковых огрызках.
 *         РАЗДЕЛ — ТОЛЬКО В ПЛОСКИХ ВИДАХ и только ПОСЛЕДНИМ ЗВЕНОМ: в виде
 *         «по разделам» его уже назвала шапка секции, а полный путь ФКП
 *         остался в паспорте позиции — на служебной строке ему не хватало
 *         места, и он вытеснял полосу, ради которой строка и заведена.
 *         КЛЮЧ — БЕЙДЖ В ПРАВОМ ВЕРХНЕМ УГЛУ (§4 правок): в потоке названия
 *         он уезжал вслед за текстом, и пересчитать ключевые взглядом по
 *         столбцу было нельзя.
 *         ОБЪЁМ — ВСЕГДА ШАБЛОННЫЙ (§1.7): колонка про смету заказчика, а не
 *         про предложения. Применённый объём поставщика живёт В ЯЧЕЙКЕ —
 *         ставкой с меткой базы и парой значений в разборе корректировки.
 *         Пара «было → стало» здесь делала колонку лживой относительно
 *         собственного имени и заводила одному числу два места жительства.
 *         focused — подсветка «текущей строки» из панели «Анализа» (рецепт 2).
 * A11Y:   у ключа нет видимой подписи — имя даёт aria-label; название целиком
 *         читается из текста, многоточие только визуальное. Полоса вклада
 *         aria-hidden: процент рядом текстом.
 *
 * @example
 * <CompareRow row={row} index={12} view={view} bids={bids} … />
 */
function CompareRowImpl({
  row, view, thresholds, bids, sumWeight, maxWeight, bind, focused, noteFor, flashCells,
  enterIndex, titleLimit, index, place, totalRows, topRows, keyCut, dim,
  nameOf, commentsFor, onAction, passportFor,
}: {
  row: RowFacts;
  view: CompareView;
  thresholds: CompareThresholds;
  bids: Bid[];
  sumWeight: number;
  /** Вес лидера — база нормировки полосы (§4.2). */
  maxWeight: number;
  bind: CellPopupBind;
  focused: boolean;
  noteFor?: (contractorId: string, positionId: string) => string | undefined;
  flashCells?: ReadonlySet<string>;
  enterIndex?: number;
  titleLimit: number;
  /** Сквозной номер позиции с 1 — в порядке СМЕТЫ, а не текущей сортировки
   *  (§4.3): «строка 47» обязана означать одно и то же в любом виде, иначе
   *  ссылаться на неё словами нельзя. */
  index: number;
  /** Место строки по весу среди всех — числитель «5-е из 137». */
  place: number;
  totalRows: number;
  /** Три самые тяжёлые позиции среза — общий для всех строк разбор вклада.
   *  Массив мемоизирован у родителя: memo строки не имеет права ломаться. */
  topRows: ReadonlyArray<{ title: string; share: number; weight: number }>;
  keyCut: { rows: number; share: number };
  /** Строка хвоста за линией отсечки (§1.3) — приглушена, но читаема. */
  dim?: boolean;
  nameOf: (contractorId: string) => string;
  /** Переписка по паре: стабильный колбэк (см. noteFor). */
  commentsFor: (contractorId: string, positionId: string) => { total: number; unread: boolean } | undefined;
  onAction: CellActionHandler;
  /** Паспорт позиции (§4.1) — готовая начинка попапа по наведению на
   *  название. Собирается у родителя: участие поимённо считается по КП, а
   *  строка о них не знает. */
  passportFor: (positionId: string) => CellPopupData;
}) {
  const { position } = row;
  const removed = position.removed === true;
  const title = clipTitle(position.title, titleLimit, !removed && position.key === true);
  const share = sumWeight ? (row.weight / sumWeight) * 100 : 0;
  /* Длина полосы — доля от ЛИДЕРА, число рядом — доля от суммы: это два
     разных вопроса («насколько эта строка тяжелее прочих» и «сколько она
     весит в тендере»), и подменять второй первым нельзя. */
  const barValue = maxWeight ? (row.weight / maxWeight) * 100 : 0;
  const flat = view.rowView !== 'sections';
  /* Полный путь нужен только паспорту в подсказке; на экране от него остаётся
     ПОСЛЕДНЕЕ звено — то, которое и отвечает на вопрос «откуда эта строка».
     В иерархическом виде не нужно и оно: раздел назван шапкой секции. */
  const crumbs = position.sectionPath;
  const crumb = flat ? crumbs?.[crumbs.length - 1] : undefined;

  const noteOf = (contractorId: string) => noteFor?.(contractorId, position.id);
  const flashOf = (contractorId: string) => !!flashCells?.has(`${contractorId}:${position.id}`);

  return (
    <tr
      data-row-id={position.id}
      className={cx(
        removed && s.rowRemoved,
        focused && s.rowFocused,
        dim && s.rowDim,
        enterIndex !== undefined && s.rowEnter,
      )}
      style={enterIndex !== undefined ? ({ '--row-in': enterIndex } as CSSProperties) : undefined}
    >
      {/* НОМЕР — СВОЯ КОЛОНКА (§7 правок владельца 25.08.2026, вечер). Углом
          ячейки-якоря он был ровно сутки: своей строкой над названием номер
          поднимал КАЖДУЮ строку таблицы на 13px, а выровнять его было не с
          чем — объём и единица стоят по центру своей высоты, номер висел
          выше них. Колонкой он ничего не поднимает, стоит на общей вертикали
          и не касается названия вовсе: левые края названий задаёт край
          колонки, а не длина числа.
          `<td>`, а не второй `<th scope="row">`: заголовок строки один, и им
          остаётся НАЗВАНИЕ — номер строку не называет. */}
      <td className={s.numCell}>{index}</td>

      <th scope="row" className={cx(tableCell.strong, s.titleCell)}>
        {/* КЛЮЧЕВАЯ ПОМЕТКА — БЕЙДЖ В ПРАВОМ ВЕРХНЕМ УГЛУ (правка владельца
            25.08.2026, §4). В потоке названия ключ стоял ПОСЛЕ текста и
            уезжал вместе с ним: у длинного имени он оказывался то в середине
            строки, то за многоточием, то на второй строке в развёрнутом
            режиме, — и «ключевые» нельзя было пересчитать взглядом по
            столбцу. У угла место постоянное, поэтому глаз находит их
            вертикалью. Резерв под бейдж срезает `clipTitle` (KEY_RESERVE),
            чтобы текст не заезжал под него. */}
        {!removed && position.key ? (
          <span
            className={s.keyMark}
            aria-label="Ключевая позиция"
            role="img"
            {...bind(keySummary(row, share))}
          >
            <KeyMark />
          </span>
        ) : null}

        {/* ПАСПОРТ ПОЗИЦИИ (§4.1) вместо простого тултипа названия: путь
            ФКП, единица и объём, медианная стоимость, участие ПОИМЁННО,
            условия и ожидающие корректировки. Только чтение, кнопок нет. */}
        <span
          className={s.titleText}
          tabIndex={0}
          role="note"
          aria-label={`${position.title}. Паспорт позиции`}
          {...bind(passportFor(position.id))}
        >
          {removed ? <s>{title}</s> : title}
        </span>

        {/* ── СЛУЖЕБНАЯ СТРОКА (§2.1 правок владельца 25.08.2026) ──────────
            ВТОРАЯ СТРОКА ЕСТЬ ВСЕГДА и всегда занята одним и тем же: слева
            краткий раздел (только в плоских видах — в иерархии его уже
            назвала шапка секции), дальше полоса вклада и процент.
            ПОСТОЯНСТВО — И ЕСТЬ СМЫСЛ ПРАВКИ. Полоса жила только в
            развёрнутом режиме, потому что 147px флекс-РЯДА отнимались у
            названия; на СВОЕЙ строке она не отнимает у названия ничего —
            платит высотой, а не шириной, и платит одинаково у всех строк.
            Проценты при этом стоят на общей вертикали: подпись раздела
            жмётся первой (flex-shrink + многоточие), трек тянется, число
            прижато к правому краю колонки.
            Крошки-путь отсюда ушли: последнее звено отвечает на вопрос
            «откуда строка» так же, а полный путь остаётся в паспорте. */}
        {!removed ? (
          <span
            className={s.wbar}
            {...bind({
              tone: 'neutral',
              title: 'Вклад позиции в стоимость тендера',
              sub: crumbs?.length ? crumbs.join(' › ') : undefined,
              fields: [
                { label: 'доля', value: `${decimal(share)} % · ${money(row.weight)}` },
                { label: 'место', value: `${place}-е из ${totalRows} позиций${row.keyDerived || position.key ? ' · входит в ключевые' : ''}` },
                ...topRows.map((t, i) => ({
                  label: `${i + 1}.`,
                  value: `${t.title} — ${decimal(t.share)} %`,
                })),
              ],
              note: keyCut.rows
                ? `Первые ${keyCut.rows} позиций — ${decimal(keyCut.share)} % стоимости.`
                : undefined,
            })}
          >
            {crumb ? <span className={s.wbarSect}>{crumb}</span> : null}
            <ProgressBar value={barValue} className={s.wbarTrack} />
            <b className={s.wbarPct}>{decimal(share)} %</b>
          </span>
        ) : null}

        {removed ? <span className={s.chip}>снята</span> : null}
      </th>

      {/* ОБЪЁМ ШАБЛОНА — ВСЕГДА. Правка сметы после публикации остаётся в
          нативной подсказке: это история сметы, а не второе значение колонки. */}
      <td
        className={tableCell.numeric}
        title={position.qtyOrig
          ? `Объём сметы правился после публикации: было ${decimal(position.qtyOrig)}`
          : undefined}
      >
        {removed ? <span className={s.dash}>—</span> : decimal(position.qty)}
      </td>
      <td className={tableCell.muted}>{removed ? '—' : position.unit}</td>

      <SpreadCell row={row} bind={bind} thresholds={thresholds} nameOf={nameOf} />

      {view.showPotential ? (
        <PotentialCell row={row} bind={bind} nameOf={nameOf} sorted={view.rowView === 'potential'} />
      ) : null}

      {bids.map((bid) => (
        <BidCell
          key={bid.contractor.id}
          row={row}
          contractor={bid.contractor}
          view={view}
          thresholds={thresholds}
          bind={bind}
          note={noteOf(bid.contractor.id)}
          flash={flashOf(bid.contractor.id)}
          comments={commentsFor(bid.contractor.id, position.id)}
          onAction={onAction}
        />
      ))}
    </tr>
  );
}

/* MEMO ПО ССЫЛКАМ ПРОПОВ. Строка — самый тиражируемый компонент экрана
   (позиций × колонок КП), и перерисовывалась она от ЛЮБОГО движения родителя:
   ширина ленты меняется каждый кадр анимации панели «Анализ ИИ» и на каждом
   шаге resize окна, туда же звезда, перекраска колонки, попап. Ни одно из
   этих движений строку не меняет.
   Условие работы memo — ссылочная стабильность пропов, и она обеспечена
   адресно: `bids` и `topRows` мемоизированы в <TenderCompare>, `bind` —
   useCallback в <useCellPopup>, `noteFor`/`commentsFor`/`nameOf`/`onAction`/
   `onOpenPassport` — useCallback там же, где живут их данные. Три колбэка
   ячейки схлопнуты в ОДИН (`onAction`) ровно поэтому: чем меньше ссылок надо
   удержать стабильными, тем меньше шансов забыть одну.
   Замер (puppeteer, 65 строк × 12 КП, prod-сборка) — Часть XVIII
   DESIGN-NOTES.md. */
export const CompareRow = memo(CompareRowImpl);
