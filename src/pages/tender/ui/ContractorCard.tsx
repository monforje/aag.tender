import type { CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden';
import { bidStatus, money, type Bid } from '@/entities/comparison';
import type { ColumnMarks, MarkKind } from '../model/compareFormat';
import { Tooltip } from '@/shared/ui/Tooltip';
import { CornerTab } from './CornerTab';
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
 *         ИМЯ ОБРЕЗАЕТСЯ МНОГОТОЧИЕМ (колонка фиксированной ширины, решение
 *         владельца 24.08.2026): полное название всплывает <Tooltip>'ом по
 *         наведению и фокусу — имя контрагента важно, но не ключевое, лучше
 *         уместить больше данных.
 *         ПОДВАЛ КАРТОЧКИ — ЯЗЫЧОК, СТАТУС, ПАЛИТРА, СТРЕЛКА (решение
 *         владельца 24.08.2026, четвёртая волна). Знак ⚠ корректировок стоял
 *         здесь отдельным глифом и спорил со статусом за одно место; теперь
 *         все пометки колонки — минимумы, аномалии, корректировки, пробелы,
 *         отказы — собраны в <CornerTab>, кармашке в углу карточки.
 *         Навигационный смысл ⚠ при переезде не потерян: чип корректировок в
 *         язычке остался кнопкой перехода к первой нерассмотренной ячейке
 *         (разбор 23.08.2026 §4, §7). Комментарии в шапку по-прежнему не
 *         поднимаются вообще: их поставщик оставляет к каждой ячейке, и шапка
 *         собрала бы «⚠ 47».
 * A11Y:   каждый контрол назван aria-label'ом с именем подрядчика; состояние
 *         звезды — aria-pressed, свёртывания — aria-expanded. Полное имя
 *         читается из текста целиком: многоточие — только визуальная обрезка.
 *
 * @example
 * <ContractorCard bid={bid} total={positions.length} col={tint[id]}
 *                 starred onStar={…} onPaint={…} onOpen={…}
 *                 collapsed={collapsed} onFold={toggleCollapsed} />
 */
export function ContractorCard({
  bid, total, col, starred, collapsed, marks, onStar, onPaint, onOpen, onFold, onGoToMark,
}: {
  bid: Bid;
  /** Сколько всего позиций в смете — знаменатель подписи «расценки есть у N
   *  из M». Пропом, а не из модуля: длина сметы приходит с данными. */
  total: number;
  /** Ручной цвет колонки; нет — карточка белая (дефолтной подкраски по
   *  ранжиру больше нет). */
  col?: string;
  starred: boolean;
  collapsed: boolean;
  /** Сводка пометок ВСЕЙ колонки — содержимое язычка. Считает `columnMarks()`
   *  теми же предикатами, что рисует <BidCell>. */
  marks: ColumnMarks;
  onStar: () => void;
  /** Отдаёт прямоугольник нажатой кнопки: от него падает выпадашка. */
  onPaint: (from: DOMRect) => void;
  onOpen: () => void;
  onFold: () => void;
  /** Переход к первой ячейке ЭТОЙ колонки с названной пометкой, сверху вниз
   *  в текущем порядке строк; повторный клик — к следующей. */
  onGoToMark: (kind: MarkKind) => void;
}) {
  const { contractor, filled, percent, sum, rank, rankLabel } = bid;
  const status = bidStatus(contractor.status);

  return (
    // Целиком карточка НЕ кликается: в ней четыре собственных контрола, и
    // «клик мимо них» открывал модалку всякий раз, когда рука промахивалась.
    // Досье открывают две явные цели — имя и стрелка досье.
    <div className={s.card} style={(col ? { '--col': col } : {}) as CSSProperties}>
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
            виде шапка остаётся с телом-именем, вердикт при нём.
            Tooltip поверх: колонка фиксированной ширины, длинное имя уходит
            в многоточие, полное название всплывает по наведению. */}
        <Tooltip text={contractor.name}>
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
        </Tooltip>

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

        {/* Язычок, статус, действия. */}
        <div className={s.meta}>
          <CornerTab
            name={contractor.name}
            marks={marks}
            onGoToMark={onGoToMark}
          />

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
