import { memo, type CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import {
  decimal, money, type Bid, type CompareThresholds, type CompareView, type RowFacts,
} from '@/entities/comparison';
import type { CellPopupBind, CellPopupData } from '@/shared/ui/CellPopup';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { tableCell } from '@/shared/ui/Table';
import { clipTitle } from '../model/compareFormat';
import { BidCell, type CellActionHandler } from './BidCell';
import { KeyMark } from './assets';
import { PotentialCell } from './PotentialCell';
import { SpreadCell } from './SpreadCell';
import s from './TenderCompare.module.css';

/**
 * Строка позиции в таблице сравнения: номер, крошки раздела, имя (+ключ),
 * полоса вклада, объём, единица, разброс, потенциал и ячейки КП.
 *
 * КОГДА:  и в виде «По разделам», и в плоских видах — строку собирает
 *         <TenderCompare>.
 * НЕ ДЛЯ: строки реестра тендеров (см. TenderRegistryPage), строки итога
 *         (см. TotalRow) и шапки колонки (см. ContractorCard).
 *
 * UX:     НОМЕР — В ЛЕВОМ ВЕРХНЕМ УГЛУ, СВОЕЙ СТРОКОЙ (§4.3, правка владельца
 *         25.08.2026): 10/13 табличными, четвертичным тоном. Гуттером в 36px
 *         он был до того и отнимал их у названия — в самой узкой колонке
 *         экрана. Левые края названий совпадают у всех строк по построению:
 *         под номером стоит общий отступ, а не колонка переменной ширины.
 *         Номер — язык обсуждения («смотри строку 47») и связь с выгрузкой;
 *         в хвосте отсечки нумерация продолжается, а не начинается заново.
 *         КРОШКИ РАЗДЕЛА — ТОЛЬКО В ПЛОСКИХ ВИДАХ (§1.4): в виде «по разделам»
 *         раздел уже назван шапкой секции над строкой, и повторять его у
 *         каждой строки значило бы писать одно и то же 30 раз подряд.
 *         Сортировка делает список плоским, и вот там контекст теряется —
 *         кровля перемешивается с инженерией. Решение владельца: крошки, а не
 *         бейдж, — путь бывает глубже одного уровня.
 *         ПОЛОСА ВКЛАДА — ТОЛЬКО В РАЗВЁРНУТОМ ВИДЕ (§4.2 в редакции владельца
 *         25.08.2026). Постоянной она была ровно один день: 147px флекс-ряда
 *         в колонке шириной 280 отнимались у названия, и строка переставала
 *         называть работу. Развёрнутый режим на то и режим — там место есть,
 *         и полоса остаётся. Длина НОРМИРОВАНА ПО ЛИДЕРУ, а не по сотне: на
 *         65 позициях доли редко выходят за 20 %, и деление на 100 % прятало
 *         бы разницу между 12,4 % и 18,7 % в двух почти одинаковых огрызках.
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
  const crumbs = flat ? position.sectionPath : undefined;

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
      <th scope="row" className={cx(tableCell.strong, s.titleCell)}>
        {/* НОМЕР — В ЛЕВОМ ВЕРХНЕМ УГЛУ ЯЧЕЙКИ, СВОЕЙ СТРОКОЙ (§4.3, правка
            владельца 25.08.2026). Гуттер 36px слева от названия он занимал
            зря: в самой узкой колонке экрана это была десятая часть ширины,
            отданная служебному числу, — и отнималась она у того единственного,
            ради чего колонка существует, у названия работы. Своей строкой
            номер стоит в углу, ничего не отнимает, а левые края названий
            совпадают у всех строк по построению — под ним общий отступ. */}
        <span className={s.rowNum} aria-hidden="true">{index}</span>

        {/* КРОШКИ — отдельной строкой НАД названием, левый край общий с ним:
            сегменты-ссылки ведут к разделу, полный путь остаётся в паспорте
            (при глубине больше двух показываются последние два звена). */}
        {crumbs?.length ? (
          <span className={s.crumbs} aria-label={`Раздел: ${crumbs.join(' › ')}`}>
            {crumbs.slice(-2).map((seg) => (
              <span key={seg} className={s.crumb}>
                {seg}
                <span className={s.crumbSep} aria-hidden="true">›</span>
              </span>
            ))}
          </span>
        ) : null}

        <span className={s.titleRow}>
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

          {!removed && position.key ? (
            <span className={s.keyMark} aria-label="Ключевая позиция" role="img">
              <KeyMark />
            </span>
          ) : null}

          {/* ПОЛОСА ВКЛАДА — ТОЛЬКО В РАЗВЁРНУТОМ ВИДЕ (правка владельца
              25.08.2026). В обычном она стоила 147px флекс-ряда (трек 96 +
              зазор + процент 44) и забирала их у названия: колонка-якорь
              шириной 280px отдавала половину под шкалу, и «Кабель силовой
              ВВГнг(А)-LS 5×6» превращался в «Кабель сило…». Вопрос «сколько
              весит эта строка» задают редко, вопрос «что это за работа» —
              всегда. Гасит её CSS по классу обёртки, а не проп: пятьсот строк
              мемоизированы, и лишний булев проп отменял бы memo на каждом
              щелчке тумблера (тот же приём, что у переноса названий). */}
          {!removed ? (
            <span
              className={s.wbar}
              {...bind({
                tone: 'neutral',
                title: 'Вклад позиции в стоимость тендера',
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
              <ProgressBar value={barValue} width={96} />
              <b className={s.wbarPct}>{decimal(share)} %</b>
            </span>
          ) : null}
        </span>

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
