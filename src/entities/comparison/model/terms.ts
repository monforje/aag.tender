/** МАТРИЦА УСЛОВИЙ ПОСТАВЩИКОВ — чистая логика сборки строк. Состав вопросов
 *  формы знает только источник данных (`Contractor.terms`), поэтому строки
 *  матрицы ВЫВОДЯТСЯ объединением подписей по колонкам: подпись вопроса —
 *  стабильный ключ, порядок — первое появление (колонка №1 формы задаёт
 *  канонический порядок всей матрицы).
 *
 *  Живёт в model/, а не в компоненте: ту же пару «строки × значения» читает
 *  и <TermsBand>, и проверка `terms.check.ts`, а правка правила сборки не
 *  должна требовать правки разметки. */

import type { SupplierTerm } from './contract';

/** Один ряд матрицы: вопрос + ответы в ПОРЯДКЕ колонок (порядок аргумента).
 *  Нет ответа — undefined: ячейка рисует тире. */
export interface TermRow {
  label: string;
  cells: ReadonlyArray<SupplierTerm | undefined>;
}

/** Вопросы матрицы — объединение `label` по колонкам в порядке первого
 *  появления. Дубликат подписи у одного подрядчика — ошибка данных: ключ
 *  перестал быть ключом; здесь он схлопывается, проверка данных ловит.
 *  Аргумент структурный: читает и подрядчиков, и что угодно с `terms`. */
export const termRows = (
  contractors: ReadonlyArray<{ terms?: SupplierTerm[] }>,
): TermRow[] => {
  const labels: string[] = [];
  for (const c of contractors) {
    for (const t of c.terms ?? []) {
      if (!labels.includes(t.label)) labels.push(t.label);
    }
  }
  return labels.map((label) => ({
    label,
    cells: contractors.map((c) => c.terms?.find((t) => t.label === label)),
  }));
};

/** Есть ли вообще что рисовать: ни у одного КП нет ответов формы — матрица
 *  не рисуется вовсе, пустая хуже отсутствующей. */
export const hasTerms = (
  contractors: ReadonlyArray<{ terms?: SupplierTerm[] }>,
): boolean => contractors.some((c) => (c.terms?.length ?? 0) > 0);
