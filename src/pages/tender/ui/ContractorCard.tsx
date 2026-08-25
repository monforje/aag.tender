import { useState, type CSSProperties } from 'react';
import { cx } from '@/shared/lib/cx';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Popover } from '@/shared/ui/Popover';
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden';
import {
  bidStatus, currentVersion, decimal, isStaleVersion, money, type Bid,
} from '@/entities/comparison';
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
 * ГЕОМЕТРИЯ ЕДИНАЯ ДЛЯ ВСЕХ (решение владельца 25.08.2026): шапка — ОДИН
 * флекс-ряд (звезда · имя с многоточием · селект версии · стрелка), тело —
 * три слота фиксированной высоты (полнота+итог · строка-факты со стрелкой ·
 * подвал). Содержимое варьируется стадией, геометрия — нет: колонки
 * сравнивают глазами по горизонталям, и карточка, съехавшая на полстроки,
 * рвёт все из них. Высота строки-фактов не зависит от содержимого даже
 * тогда, когда его меньше одной строки.
 *
 * UX:     Полнота и итог одной строкой — два числа, по которым колонки
 *         сравнивают. Итог — самое крупное число карточки: за ним сюда и
 *         приходят. Строка-факты есть у ВСЕХ колонок, включая приглашённую:
 *         свёрнуто она держит место («1 место · +2,4 % к лидеру», у
 *         неполного КП — причина вместо Δ), раскрыто — сетку «мин. цен /
 *         без цены». Чип «минимальный итог» снят: место лидера названо
 *         медалью перед именем, и третье повторение вердикта спорило с
 *         первыми двумя.
 *         Целиком карточка НЕ кликается: в ней несколько собственных
 *         контролов, и «клик мимо них» открывал модалку всякий раз, когда
 *         рука промахивалась. Досье открывает явная стрелка в подвале.
 *         Звезда, палитра тихие: проявляются по наведению на карточку и по
 *         фокусу внутри неё; место держится всегда (opacity), чтобы шапка
 *         таблицы не дёргалась.
 *         СЕЛЕКТ ВЕРСИИ — КАПСУЛА С ГЛИФОМ СТОПКИ (`layers`), и это третий
 *         подход к одному месту. Стрелкой он быть не может: в этой таблице
 *         шеврон значит «раскрыть на месте», и рядом с двумя настоящими
 *         шевронами (свернуть карточки, раскрыть числа) он читался третьим
 *         таким же. Глиф часов, стоявший здесь до 25.08.2026, вылечил
 *         половину проблемы и завёл вторую — «история» это ДЕЙСТВИЕ, а
 *         кнопка выбирает СНИМОК. Стопка листов говорит ровно то, что за
 *         кнопкой лежит: несколько редакций одного КП.
 *         collapsed и factsOpen прячут/раскрывают ВСЕ карточки разом —
 *         состояние живёт у <TenderCompare>: колонки сравнивают, а не
 *         разглядывают по одной, и раскрытые числа обязаны стоять рядами.
 *         ИМЯ ОБРЕЗАЕТСЯ МНОГОТОЧИЕМ (колонка фиксированной ширины): полное
 *         название всплывает <Tooltip>'ом по наведению и фокусу.
 * A11Y:   каждый контрол назван aria-label'ом с именем подрядчика; состояние
 *         звезды — aria-pressed, свёртывания — aria-expanded. Полное имя
 *         читается из текста целиком: многоточие — только визуальная обрезка.
 *         Иконка статуса в подвале снята: при пяти элементах ряда капсула
 *         обязана ужиматься, а смысл состояния несут заливка тона и слово —
 *         цвет никогда не остаётся единственным каналом.
 *
 * @example
 * <ContractorCard bid={bid} total={positions.length} col={tint[id]}
 *                 starred onStar={…} onPaint={…} onOpen={…}
 *                 collapsed={collapsed} onFold={toggleCollapsed} />
 */
export function ContractorCard({
  bid, total, col, starred, collapsed, factsOpen, marks,
  onStar, onPaint, onOpen, onFold, onFacts, onGoToMark,
  onPickVersion, onGoToCorrections,
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
  /** Раскрыт блок фактов — ОДИН на все колонки, как и свёрнутость: числа
   *  этого блока сравнивают между колонками, а не разглядывают по одной. */
  factsOpen: boolean;
  /** Сводка пометок ВСЕЙ колонки — содержимое язычка. Считает `columnMarks()`
   *  теми же предикатами, что рисует <BidCell>. */
  marks: ColumnMarks;
  onStar: () => void;
  /** Отдаёт прямоугольник нажатой кнопки: от него падает выпадашка. */
  onPaint: (from: DOMRect) => void;
  onOpen: () => void;
  onFold: () => void;
  onFacts: () => void;
  /** Подсветить ВСЕ ячейки ЭТОЙ колонки с названной пометкой (обводкой) и
   *  прокрутить к первой из них сверху вниз в текущем порядке строк;
   *  повторный клик — к следующей подсвеченной. */
  onGoToMark: (kind: MarkKind) => void;
  /** Выбор версии КП (§5.5). Не задан — версий в данных нет, триггера тоже. */
  onPickVersion?: (versionId: string) => void;
  /** Открыть мини-список корректировок колонки (§5.3). */
  onGoToCorrections?: (at: DOMRect) => void;
}) {
  const { contractor, filled, percent, sum, rank, rankLabel, stage, counts, deltaToLeader } = bid;
  const status = bidStatus(contractor.status);
  const version = currentVersion(contractor);
  const stale = isStaleVersion(contractor);
  const [versionAt, setVersionAt] = useState<DOMRect | null>(null);
  /* Колонки без действующего КП (§5.6): приглашённая и черновик чисел не имеют
     вовсе — слот полноты занимает состояние, а не нули. Нулей они не создают
     и в расчёт не входят (`countsInAnalysis`). */
  const idle = stage === 'invited' || stage === 'draft';
  /* Подпись статуса считается ОДИН раз: её читают и капсула, и её же title —
     на 187px подвала слово может не поместиться целиком, и полный текст
     обязан быть доступен по наведению. Два выражения на одну строку
     разъехались бы при первой правке словаря. */
  const statusLabel = stage === 'stale' ? 'не переподал'
    : stage === 'invited' ? 'приглашён'
      : stage === 'draft' ? 'черновик'
        : stage === 'locked' ? 'доступ закрыт'
          : status.label;

  /* ── КЛЮЧ СТРОКИ-ФАКТОВ ────────────────────────────────────────────────────
     Свёрнуто — одно предложение о месте колонки; у лидера Δ к самому себе
     не существует по построению (`rankBids`), у неполного КП она запрещена —
     его итог занижен на незакрытые позиции, и разница с лидером читалась бы
     скидкой. Вместо числа — причина. */
  const factsKey = !counts ? (
    stage === 'locked' ? (
      <>
        <Icon name="lock" className={s.lockIcon} />
        <span className={s.cfactsText}>справочно, в расчёте не участвует</span>
      </>
    ) : idle ? <span className={s.cfactsText}>КП ещё не подано</span> : null
  ) : rank === 1 || !deltaToLeader ? (
    <span className={s.cfactsText}>
      {rank} место
      {percent < 100 ? <> · <span className={s.partialNote}>КП неполное</span></> : null}
    </span>
  ) : (
    <span className={s.cfactsText}>
      {rank} место · <b className={s.deltaInk}>+{decimal(deltaToLeader.pct)} % к лидеру</b>
    </span>
  );

  return (
    // Целиком карточка НЕ кликается: в ней несколько собственных контролов, и
    // «клик мимо них» открывал модалку всякий раз, когда рука промахивалась.
    // Досье открывает явная цель — стрелка в подвале.
    <div className={s.card} style={(col ? { '--col': col } : {}) as CSSProperties}>
      {/* ШАПКА — один флекс-ряд при любом составе: селект версии стоит в ряду,
          а не на второй строке грида (именно так карточки с версиями однажды
          выросли против остальных). Имя забирает остаток и режется
          многоточием; звезда и стрелка — жёсткие края ряда. */}
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
            теперь явная цель досье одна. Медаль стоит ПЕРЕД именем: пара
            «медаль + имя» едет как одно целое, и знак переживает обрезку —
            уходит хвост названия, а не вердикт.
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
            <span className={s.cardNameText}>{contractor.name}</span>
          </p>
        </Tooltip>

        {/* СЕЛЕКТ ВЕРСИИ КП (§5.5) — капсула с глифом истории: версия принад-
            лежит предложению и говорит «у этого КП есть прошлое». Шевроном
            быть не должен: тот в этой таблице означает раскрытие на месте,
            и рядом со стрелкой свёртывания читался вторым таким раскрытием.
            Триггера нет вовсе, когда версия одна: выбирать не из чего. */}
        {version && contractor.versions!.length > 1 && onPickVersion ? (
          <button
            type="button"
            className={cx(s.versionTrigger, stale && s.isOn)}
            aria-haspopup="dialog"
            aria-expanded={versionAt !== null}
            aria-label={`Версия КП «${contractor.name}»: ${version.label} от ${version.date}`}
            title={`Версии КП · показана ${version.label} от ${version.date}`}
            onClick={(e) => setVersionAt(e.currentTarget.getBoundingClientRect())}
          >
            <Icon name="layers" className={s.versionIcon} />
            {version.label}
          </button>
        ) : null}

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
        {/* ── СЛОТ 1: ПОЛНОТА + ИТОГ (или состояние без КП), высота общая ─── */}
        {idle ? (
          <p className={s.stageLine}>
            {stage === 'invited' ? (
              <>
                <span className={s.waitDots} aria-hidden="true"><i /><i /><i /></span>
                ждём предложение
              </>
            ) : 'черновик, не подан'}
          </p>
        ) : (
          <div className={cx(s.figures, !counts && s.figuresDim)}>
            <p
              className={s.fill}
              title={`Расценки есть у ${filled} позиций из ${total}`}
            >
              <span className={s.percent}>{percent}%</span>
              <span className={s.fillLabel}>заполнено</span>
            </p>
            <p className={s.sum}>{money(sum)}</p>
          </div>
        )}

        {/* ── СЛОТ 2: СТРОКА-ФАКТЫ СО СТРЕЛКОЙ — У ВСЕХ КОЛОНОК ─────────────
            Свёрнутая высота фиксирована независимо от содержимого; раскрыто —
            сетка «капитель → значение». <details>, а не своё состояние:
            раскрытость принадлежит одной карточке и никому снаружи не нужна —
            платформа делает это бесплатно и с клавиатурой из коробки. */}
        <div className={s.cfacts}>
          <button
            type="button"
            className={s.cfactsSummary}
            aria-expanded={factsOpen}
            aria-label={`${contractor.name}: ${factsOpen ? 'свернуть' : 'развернуть'} числа КП`}
            onClick={onFacts}
          >
            <span className={s.cfactsKey}>{factsKey}</span>
            <span className={cx(s.cfactsCaret, factsOpen && s.isOn)}>
              <Icon name="chevronDown" />
            </span>
          </button>
          {/* СЕТКА ВСЕГДА ИЗ ТРЁХ СТРОК, даже когда одно из чисел не
              существует. У лидера Δ к самому себе нет по построению, и
              пропуск строки давал раскрытым карточкам разную высоту — ту
              самую разъезжающуюся шапку, ради устранения которой блок и
              сделали общим. Прочерк честнее пропуска: он говорит «здесь
              нечему быть», а пустое место не говорит ничего. */}
          {factsOpen ? (
          <div className={s.fgrid}>
            <span className={s.fk}>Δ в деньгах</span>
            {deltaToLeader ? (
              <span className={cx(s.fv, s.deltaInk)}>+{money(deltaToLeader.money)}</span>
            ) : (
              <span className={cx(s.fv, s.fvNone)} title={rank === 1 ? 'Это и есть лидер' : 'Итог КП неполный — разница с лидером читалась бы скидкой'}>—</span>
            )}
            <span className={s.fk}>мин. цен</span>
            <span className={s.fv}>{marks.min} из {total}</span>
            <span className={s.fk}>без цены</span>
            <span className={s.fv}>{marks.missing}</span>
          </div>
          ) : null}
        </div>

        {/* ── СЛОТ 3: ПОДВАЛ — пометки, статус, ⚠, палитра, досье. Один ряд
            с общими отступами; капсула статуса ужимается первой. */}

        <div className={s.meta}>
          <CornerTab
            name={contractor.name}
            marks={marks}
            onGoToMark={onGoToMark}
          />

          {/* Без глифа: при пяти элементах ряда капсула обязана ужиматься, а
              состояние несут заливка тона и слово — цвет не остаётся единст-
              венным каналом. Пометки колонки при этом остаются в язычке. */}
          <Badge
            className={s.cardStatus}
            tone={stage === 'stale' ? 'neutral' : status.tone}
          >
            <span className={s.cardStatusLabel} title={statusLabel}>
              {statusLabel}
            </span>
          </Badge>

          {/* ⚠ N КОЛОНКИ (§5.3): одна корректировка ведёт СРАЗУ к ячейке,
              несколько открывают мини-список переходов. Цикл вслепую
              («кликнул — уехал куда-то, сколько ещё осталось?») оставлен
              только для одной цели, где выбирать не из чего. */}
          {marks.correction ? (
            <button
              type="button"
              className={s.corrChip}
              aria-label={marks.correction === 1
                ? `${contractor.name}: перейти к корректировке объёма`
                : `${contractor.name}: ${marks.correction} корректировки объёма — открыть список`}
              onClick={(e) => (marks.correction === 1 || !onGoToCorrections
                ? onGoToMark('correction')
                : onGoToCorrections(e.currentTarget.getBoundingClientRect()))}
            >
              <Icon name="flag" className={s.corrChipIcon} />
              {marks.correction}
            </button>
          ) : null}

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

      {/* Меню версий. Галочка выбора СПРАВА при ровном левом крае текста —
          общее правило меню проекта (владелец 25.08.2026). Версия без
          разобранного файла показана прочерком вместо итога и не
          выбирается: пункт есть, данных за ним нет. */}
      {onPickVersion ? (
        <Popover
          anchor={versionAt}
          onClose={() => setVersionAt(null)}
          label={`Версии КП «${contractor.name}»`}
          className={s.versionMenu}
        >
          {(contractor.versions ?? []).map((v, i) => {
            const pickable = i === 0 || !!v.prices;
            return (
              <button
                key={v.id}
                type="button"
                role="menuitemradio"
                aria-checked={v.id === version?.id}
                className={cx(s.versionItem, v.id === version?.id && s.isOn)}
                disabled={!pickable}
                onClick={() => { onPickVersion(v.id); setVersionAt(null); }}
              >
                <span className={s.versionName}>
                  {v.label} · {v.date}
                  {i > 0 ? <span className={s.versionOld}>неактуальная</span> : null}
                </span>
                <span className={s.versionSum}>
                  {pickable ? '' : '—'}
                </span>
                <span className={s.versionCheck} aria-hidden="true">
                  <Icon name="checkCircle" />
                </span>
              </button>
            );
          })}
          <p className={s.versionHint}>
            Переключение пересчитывает только эту колонку; новая версия делает
            сохранённый анализ устаревшим.
          </p>
        </Popover>
      ) : null}
    </div>
  );
}
