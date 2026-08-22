import { ColorPicker } from '@/shared/ui/ColorPicker';
import { Popover } from '@/shared/ui/Popover';
import s from './ColumnPainter.module.css';

/**
 * Палитра колонки подрядчика: выпадашка из кнопки на карточке
 * (<ContractorCard>) — пикер цвета и возврат «По ранжиру».
 *
 * КОГДА:  нажата кнопка-палитра на карточке; прямоугольник кнопки приходит
 *         пропом-якорем.
 * НЕ ДЛЯ: перекраски чего-либо ещё — цвет здесь всегда цвет КОЛОНКИ таблицы;
 *         смысловые тона пометок рукой не трогаются никогда.
 *
 * UX:     Своего состояния нет — цвет уезжает наверх на каждое движение, и
 *         колонка перекрашивается живьём. Ни заголовка, ни «Готово»: чью
 *         колонку красим, видно по самой колонке, а закрывают кликом мимо или
 *         Escape, как любое меню.
 * A11Y:   имя панели даёт проп label Поповера.
 *
 * @example
 * <ColumnPainter anchor={paint?.at ?? null} value={paintValue(paint.bid)}
 *                onPick={…} onReset={…} onClose={() => setPaint(null)} />
 */
export function ColumnPainter({ anchor, value, onPick, onReset, onClose }: {
  /** Прямоугольник нажатой кнопки; null — панель закрыта. */
  anchor: DOMRect | null;
  /** Действующий цвет колонки; undefined содержимое не рисует. */
  value: string | undefined;
  onPick: (color: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <Popover anchor={anchor} onClose={onClose} label="Цвет колонки">
      {value === undefined ? null : (
        <>
          <ColorPicker value={value} onChange={onPick} />
          <footer className={s.foot}>
            <button type="button" className={s.reset} onClick={onReset}>По ранжиру</button>
          </footer>
        </>
      )}
    </Popover>
  );
}
