import { useState } from 'react';
import { cx } from '@/shared/lib/cx';
import type { CellPopupBind } from '@/shared/ui/CellPopup';
import { Icon } from '@/shared/ui/Icon';
import { Popover } from '@/shared/ui/Popover';
import { tableCell } from '@/shared/ui/Table';
import { hasTerms, termRows, type Bid, type SupplierTerm } from '@/entities/comparison';
import s from './TenderCompare.module.css';

/**
 * Условия поставщиков — матрица ответов формы КП вне цен, внизу таблицы
 * сравнения. Строки — вопросы формы, колонки — те же подрядчики, что выше:
 * ответы читаются столбиком под его же ценами.
 *
 * КОГДА:  у хоть одного КП заполнены `terms`. Нет ни одного — компонент не
 *         рисует ничего: пустая матрица хуже отсутствующей.
 * НЕ ДЛЯ: условий как текста разбора («аванс 30 %» словами в секции
 *         «Изменения поставщика») и реквизитов досье (<DossierModal>).
 *
 * UX:     СОСТАВ ВОПРОСОВ знает только источник данных: строки собираются
 *         объединением `label` по колонкам в порядке первого появления —
 *         подпись вопроса и есть ключ. У кого ответа нет — честное тире,
 *         а не угадывание. ОТВЕТЫ ГОВОРЯТ РАЗНЫМИ УСТРОЙСТВАМИ (решение
 *         владельца 24.08.2026): да/нет — иконка тона с пружинным откликом,
 *         числа и сроки — текст с микроподъёмом, примечание — кнопка с
 *         попапом по клику; полное значение любого ответа показывает общий
 *         попап таблицы. Все отклики гасятся reduced-motion вместе с
 *         брелоками ячеек.
 * A11Y:   каждая ячейка-ответ — кнопка со своим именем «вопрос: ответ»;
 *         иконка не единственный канал — текст значения живёт в попапе и в
 *         aria-label. Заголовок матрицы — <th scope="rowgroup"> на всю
 *         ширину (tableCell.fullRow): липкая первая колонка его не рвёт.
 *
 * @example
 * <TermsBand bids={bids} bind={popup.bind} />
 */
export function TermsBand({ bids, bind }: {
  bids: Bid[];
  /** Общий попап таблицы: один слой обслуживает и пометки цен, и условия. */
  bind: CellPopupBind;
}) {
  /* Строки матрицы собирает модель (model/terms.ts): объединение вопросов
     по колонкам, порядок — первое появление. */
  const contractors = bids.map((b) => b.contractor);
  const rows = termRows(contractors);
  if (!hasTerms(contractors)) return null;

  return (
    <tbody className={s.termsBody}>
      <tr className={s.groupRow}>
        <th
          scope="rowgroup"
          colSpan={4 + bids.length}
          className={cx(tableCell.card, tableCell.fullRow, s.groupHead)}
        >
          <div className={s.termsCap}>Условия поставщиков</div>
        </th>
      </tr>
      {rows.map(({ label, cells }) => (
        <tr key={label}>
          <th scope="row" className={cx(tableCell.strong, s.termLabel)}>{label}</th>
          {/* Пустые колонки объёма добираются одним colSpan — якорь остаётся
              самостоятельной ячейкой ради sticky-col. */}
          <td colSpan={3} />
          {cells.map((term, i) => (
            <TermCell key={bids[i].contractor.id} term={term} bind={bind} />
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/** Ячейка ответа. Три вида устройств — по `kind`; нет ответа — тире. */
function TermCell({ term, bind }: {
  term?: SupplierTerm;
  bind: CellPopupBind;
}) {
  const [noteAt, setNoteAt] = useState<DOMRect | null>(null);

  if (!term) {
    return (
      <td className={cx(tableCell.numeric, s.termCell)}>
        <span className={s.dash}>—</span>
      </td>
    );
  }

  /* Да/нет — решение подрядчика, названо иконкой тона и текстом попапа. */
  if (term.kind === 'bool') {
    const yes = term.value.trim().toLowerCase() === 'да';
    return (
      <td className={cx(tableCell.numeric, s.termCell)}>
        <button
          type="button"
          className={cx(s.termMark, yes ? s.termYes : s.termNo)}
          aria-label={`${term.label}: ${term.value}`}
          {...bind({ title: term.label, fields: [{ label: 'Ответ', value: term.value }] })}
        >
          <Icon name={yes ? 'checkCircle' : 'closeCircle'} />
        </button>
      </td>
    );
  }

  /* Примечание — развёрнутый текст: наружу торчит только кнопка, текст
     раскрывает <Popover> по клику (наведению такой объём не доверяем). */
  if (term.kind === 'note') {
    return (
      <td className={cx(tableCell.numeric, s.termCell)}>
        <button
          type="button"
          className={cx(s.termMark, s.termNote)}
          aria-label={`${term.label}: открыть текст`}
          aria-haspopup="dialog"
          aria-expanded={noteAt !== null}
          onClick={(e) => setNoteAt(e.currentTarget.getBoundingClientRect())}
        >
          <Icon name="questionCircle" />
        </button>
        <Popover anchor={noteAt} onClose={() => setNoteAt(null)} label={term.label}>
          <p className={s.termNoteText}>{term.value}</p>
        </Popover>
      </td>
    );
  }

  /* Число или срок — текстом, как он есть в форме. */
  return (
    <td className={cx(tableCell.numeric, s.termCell)}>
      <button
        type="button"
        className={s.termValue}
        aria-label={`${term.label}: ${term.value}`}
        {...bind({ title: term.label, fields: [{ label: 'Ответ', value: term.value }] })}
      >
        {term.value}
      </button>
    </td>
  );
}
