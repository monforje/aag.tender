import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { plural } from '@/shared/lib/plural';
import type { Contractor } from '@/entities/comparison';
import { ExportDialog } from './ExportDialog';
import s from './SliceLink.module.css';

/**
 * Явная кнопка выгрузки сравнения в .xlsx и её окно (§5.8).
 *
 * КОГДА:  НА СТРОКЕ ВКЛАДОК рабочего места, рядом со ссылкой на срез (правка
 *         владельца 25.08.2026).
 * НЕ ДЛЯ: копирования ссылки на вид (см. <SliceLink> — там передают ВИД, а не
 *         документ) и печати экрана.
 *
 * UX:     КНОПКА СО СЛОВОМ, А НЕ ГЛИФ В РЯДУ ГЛИФОВ. Выгрузка стояла в правом
 *         блоке полосы сравнения четвёртой иконкой подряд — между «Фильтрами»,
 *         легендой и шестернёй, — и там она читалась ещё одной настройкой
 *         вида. Но это не настройка: это ЕДИНСТВЕННОЕ действие экрана,
 *         создающее документ, которым потом обмениваются вне системы, и
 *         прятать его за глифом наравне с «?» неправильно. Место — строка
 *         вкладок: там уже живёт второе действие над срезом (ссылка), и оба
 *         они про «унести отсюда наружу».
 *         СОСТОЯНИЕ ОКНА ЖИВЁТ ЗДЕСЬ, а не на странице: открытость нужна
 *         ровно этой кнопке, и поднимать её выше значило бы протащить два
 *         пропа через экран, который окна не рисует.
 * A11Y:   обычная кнопка со своим именем; число позиций названо в подсказке —
 *         состав файла всегда полный, и это сказано словами.
 *
 * @example
 * <ExportButton tenderId={tender.id} contractors={contractors} rows={65} />
 */
export function ExportButton({ tenderId, contractors, rows }: {
  tenderId: string;
  contractors: Contractor[];
  /** Сколько позиций уедет в файл — состав всегда полный, фильтры его не режут. */
  rows: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        className={s.exportBtn}
        title={`Выгрузка сравнения: ${rows} ${plural(rows, 'позиция', 'позиции', 'позиций')}, состав всегда полный`}
        onClick={() => setOpen(true)}
      >
        <Icon name="download" className={s.exportIcon} />
        Выгрузить .xlsx
      </Button>
      <ExportDialog
        open={open}
        onClose={() => setOpen(false)}
        tenderId={tenderId}
        contractors={contractors}
        rows={rows}
      />
    </>
  );
}
