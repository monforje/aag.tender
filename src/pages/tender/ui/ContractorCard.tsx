import type { CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden';
import { bidStatus, money, type Bid } from '@/entities/tender';
import s from './TenderCompare.module.css';

/**
 * Карточка подрядчика — она же шапка колонки сравнения.
 *
 * КОГДА:  в <thead> таблицы <TenderCompare>, по одной на поданное КП.
 * НЕ ДЛЯ: досье (см. DossierModal) и строки реестра — здесь сводка КОЛОНКИ:
 *         полнота КП, итог и статус.
 *
 * UX:     Полнота и итог одной строкой — два числа, по которым колонки
 *         сравнивают. Числом, а не полосой: на 220px разница между 88% и 92%
 *         на шкале неразличима, а решают именно они. Итог — самое крупное
 *         число карточки: за ним сюда и приходят.
 *         Целиком карточка НЕ кликается: в ней четыре собственных контрола, и
 *         «клик мимо них» открывал модалку всякий раз, когда рука
 *         промахивалась. Досье открывают две явные цели — имя и стрелка
 *         напротив статуса; имя при этом просто текст, а не кнопка.
 *         Звезда, палитра и свёртывание тихие: проявляются по наведению на
 *         карточку и по фокусу внутри неё; место держится всегда (opacity),
 *         чтобы шапка таблицы не дёргалась. Место в ранжире у НЕлидеров —
 *         только текстом для скринридера (порядок колонок и цвет говорят то
 *         же); у текущего лидера сверх того медаль перед именем: цвет
 *         колонки — подсказка, руку перекрашивает <ColumnPainter>, а медаль —
 *         вердикт, при любой перекраске остающаяся на месте.
 *         collapsed прячет тело всех карточек разом — состояние живёт у
 *         <TenderCompare>: колонки сравнивают, а не разглядывают по одной.
 * A11Y:   каждый контрол назван aria-label'ом с именем подрядчика; состояние
 *         звезды — aria-pressed, свёртывания — aria-expanded.
 *
 * @example
 * <ContractorCard bid={bid} total={positions.length} col={choose(tint, bid)}
 *                 starred onStar={…} onPaint={…} onOpen={…}
 *                 collapsed={collapsed} onFold={toggleCollapsed} />
 */
export function ContractorCard({
  bid, total, col, starred, collapsed, onStar, onPaint, onOpen, onFold,
}: {
  bid: Bid;
  /** Сколько всего позиций в смете — знаменатель подписи «расценки есть у N
   *  из M». Пропом, а не из модуля: длина сметы приходит с данными. */
  total: number;
  /** Готовая CSS-строка цвета: карточка не знает, ранжир его дал или рука. */
  col: string;
  starred: boolean;
  collapsed: boolean;
  onStar: () => void;
  /** Отдаёт прямоугольник нажатой кнопки: от него падает выпадашка. */
  onPaint: (from: DOMRect) => void;
  onOpen: () => void;
  onFold: () => void;
}) {
  const { contractor, filled, percent, sum, rank, rankLabel } = bid;
  const status = bidStatus(contractor.status);

  return (
    // Целиком карточка НЕ кликается: в ней четыре собственных контрола, и
    // «клик мимо них» открывал модалку всякий раз, когда рука промахивалась.
    // Досье открывают две явные цели — имя и стрелка напротив статуса.
    <div className={s.card} style={{ '--col': col } as CSSProperties}>
      <header className={s.cardHead}>
        <button
          type="button"
          className={cx(s.star, starred && s.isOn)}
          aria-pressed={starred}
          aria-label={`${contractor.name}: ${starred ? 'убрать из избранного' : 'в избранное'}`}
          title={starred ? 'В избранном' : 'Добавить в избранное'}
          onClick={onStar}
        >
          <Icon name={starred ? 'starFilled' : 'star'} />
        </button>

        {/* Просто текст. Кнопкой имя было, пока карточка кликалась целиком —
            теперь явная цель одна: стрелка досье. Медаль стоит ПЕРЕД именем,
            внутри центрируемой ячейки: пара «медаль + имя» центрируется как
            одно целое, и знак переживает свёртывание карточек — в сложенном
            виде шапка остаётся с телом-именем, вердикт при нём. */}
        <p className={s.cardName}>
          {rank === 1 ? (
            <span
              className={s.leader}
              title="Лучшее предложение — минимальный итог среди поданных КП"
              aria-hidden="true"
            >
              <Icon name="skill" />
            </span>
          ) : null}
          {contractor.name}
        </p>

        {/* Место в ранжире — текстом для скринридера: порядок колонок и их
            цвет говорят то же самое, но заливка в 7% для скринридера не
            существует вовсе. У лидера есть и видимый знак — медаль перед
            именем; она aria-hidden, чтобы место не читалось дважды. */}
        <VisuallyHidden>{rankLabel}</VisuallyHidden>

        <button
          type="button"
          className={cx(s.fold, collapsed && s.isOn)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Развернуть карточки подрядчиков' : 'Свернуть карточки подрядчиков'}
          title={collapsed ? 'Развернуть все' : 'Свернуть все'}
          onClick={onFold}
        >
          <Icon name="chevronDown" />
        </button>
      </header>

      {collapsed ? null : (
      <div className={s.cardBody}>
        {/* Полнота КП и его итог одной строкой — два числа, по которым колонки
            и сравнивают. Числом, а не полосой: на 220px разница между 88% и
            92% на шкале неразличима, а решают именно они. */}
        <div className={s.figures}>
          <p
            className={s.fill}
            title={`Расценки есть у ${filled} позиций из ${total}`}
          >
            <span className={s.percent}>{percent}%</span>
            <span className={s.fillLabel}>заполнено</span>
          </p>
          <p className={s.sum}>{money(sum)}</p>
        </div>

        {/* Статус слева, действия справа. */}
        <div className={s.meta}>
          <Badge className={s.cardStatus} tone={status.tone} icon={status.icon}>
            {status.label}
          </Badge>

          <button
            type="button"
            className={cx(s.cardAct, s.cardActPaint)}
            aria-label={`Цвет колонки «${contractor.name}»`}
            title="Цвет колонки"
            onClick={(e) => onPaint(e.currentTarget.getBoundingClientRect())}
          >
            <Icon name="palette" />
          </button>

          {/* Диагональ, а не шеврон: уход в отдельное окно, а не раскрытие на
              месте. */}
          <button
            type="button"
            className={cx(s.cardAct, s.cardActSpin)}
            aria-label={`Досье подрядчика «${contractor.name}»`}
            title="Открыть досье"
            onClick={onOpen}
          >
            <Icon name="arrowRightUp" />
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
