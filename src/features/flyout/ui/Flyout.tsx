import { cx } from '@/shared/lib/cx';
import { Tree, type TreeItem } from '@/shared/ui/Tree';
import { contentFor, labelFor, type SectionId } from '@/entities/section';
import s from './Flyout.module.css';

interface FlyoutProps {
  openId: SectionId | null;
  noAnimation: boolean;
  /** Дерево превью — те же данные, что у панели раздела. */
  items?: TreeItem[];
  /** Текущий путь — подсветка активной строки в дереве превью. */
  activePath?: string;
  /** Без onNavigate пункты kind:'link' декоративны — дерево остаётся витриной. */
  onNavigate?: (path: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/** §4.5 — превью раздела. Панель всегда в DOM и гасится через display
 *  (.is-open), как в эталоне: смена display none→block перезапускает
 *  css-анимацию входа, а размонтирование ломало бы .no-animation —
 *  при переезде с пункта на пункт панель обязана остаться на месте и
 *  сменить только содержимое.
 *
 *  Дерево внутри рендерится тем же Tree, что и в сайдбаре — разница
 *  только в наличии обработчиков. С ними превью кликается и ведёт на пункт
 *  (закрытие панели после перехода — обязанность владельца обработчиков),
 *  без них это чистая витрина, как в исходном эталоне. */
export function Flyout({
  openId, noAnimation, items, activePath, onNavigate,
  onMouseEnter, onMouseLeave,
}: FlyoutProps) {
  return (
    <div
      className={cx(s.flyout, openId && s.isOpen, noAnimation && s.noAnimation)}
      role="dialog"
      aria-label="Превью раздела"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={s.flyoutContainer}>
        <div className={s.flyoutHeader}>{openId ? labelFor(openId) : ''}</div>
        <div className={s.flyoutBody}>
          {openId ? (
            <Tree
              items={items ?? contentFor(openId)}
              activePath={activePath}
              onNavigate={onNavigate}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}