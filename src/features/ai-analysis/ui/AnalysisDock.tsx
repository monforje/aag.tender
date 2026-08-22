import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Button } from '@/shared/ui/Button';
import { Dropdown, MenuItem } from '@/shared/ui/Dropdown';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { Skeleton } from '@/shared/ui/Skeleton';
import {
  buildAnalysis, snapshotRound,
  type AnalysisItem, type AnalysisRef,
  type AnalysisResult, type AnalysisSectionId, type AnalysisSubsectionId,
  type AnalysisTransition, type Comparison,
} from '@/entities/tender';
import { AI_DOCK_ID, AiDock } from './AiDock';
import { SparkGlyph } from './assets/SparkGlyph';
/* Оболочка панели (геометрия, спектральная линия, плитка ИИ) — ОДНА на оба
   режима: импорт того же CSS-модуля даёт те же хэши классов без копии правил. */
import base from './AiDock.module.css';
import s from './AnalysisDock.module.css';

const reducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Слова-сущности внутри серверной строки: пунктир и мягкий красный видны без
 *  наведения (05 §6); переход ведёт только то, у чего есть валидный переход. */
function withRefs(text: string, refs: AnalysisRef[], onPick: () => void): ReactNode {
  const marks = refs
    .map((ref) => ({ ref, at: text.indexOf(ref.label) }))
    .filter(({ ref, at }) => at >= 0 && ref.label.length > 0)
    .sort((a, b) => a.at - b.at || b.ref.label.length - a.ref.label.length);
  if (!marks.length) return text;

  const nodes: ReactNode[] = [];
  let pos = 0;
  for (let i = 0; i < marks.length; i += 1) {
    const { ref, at } = marks[i];
    if (at < pos) continue;                       // пересёкся с предыдущей — не рвём текст
    if (at > pos) nodes.push(text.slice(pos, at));
    nodes.push(
      <button
        key={`${ref.kind}:${ref.id}`}
        type="button"
        className={s.ref}
        title={ref.kind === 'work'
          ? 'Показать эту работу в сравнении'
          : 'Показать этого подрядчика в сравнении'}
        onClick={onPick}
      >
        {text.slice(at, at + ref.label.length)}
      </button>,
    );
    pos = at + ref.label.length;
  }
  if (pos < text.length) nodes.push(text.slice(pos));
  return nodes;
}

/** Пункт разбора. У «ещё не подал» и полноты слот модели пуст — заметки нет. */
function Item({ item, onTransition }: {
  item: AnalysisItem;
  onTransition: (t: AnalysisTransition) => void;
}) {
  const interactive = !!item.transition;
  return (
    <li className={s.item}>
      <p className={s.itemTitle}>
        {interactive
          ? withRefs(item.title, item.refs, () => onTransition(item.transition!))
          : item.title}
      </p>
      {item.details?.map((line) => (
        <p key={line} className={s.itemDetail}>{line}</p>
      ))}
      {item.note ? (
        <p className={s.itemNote}>
          <SparkGlyph size={11} className={s.noteSpark} />
          {item.note}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Выбор раунда разбора в шапке панели: тихий триггер «текущий · шеврон» и меню
 * радиопунктов.
 *
 * КОГДА:  раундов больше одного — переключение круга, по которому строится
 *         разбор. НЕ сегмент: раунды — открытый список, который растёт вместе
 *         с торгами; сегмент ломает шапку уже на пятом круге, у сотого не
 *         остаётся места ни ему, ни кнопкам панели.
 * НЕ ДЛЯ: фиксированных взаимоисключающих режимов (см. <Segmented>).
 *
 * UX:     триггер показывает только текущий раунд; весь список живёт в меню
 *         с потолком высоты — дальше прокрутка внутри меню. Открывается на
 *         отмеченном пункте (initialFocus="checked"): при большом числе кругов
 *         первый сверху не обязан быть текущим, и прыжок прокрутки к началу
 *         списка каждый раз сбивал бы с толку. Одиночный выбор закрывает меню.
 * A11Y:   клавиатура — от <Dropdown> и <MenuItem>; имя триггера называет
 *         назначение контрола и выбранное значение, раз видимого текста
 *         «Раунд N» для скринридера мало без контекста.
 */
function RoundPicker({ value, options, onChange }: {
  value: number;
  options: ReadonlyArray<{ id: number; label: string }>;
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.id === value);

  /* Открытие кликом фокус оставляет на триггере — отмеченный пункт сам в
     зону видимости не попадает. Дотягиваем его прокруткой. */
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  return (
    <Dropdown
      open={open}
      onToggle={() => setOpen((v) => !v)}
      onClose={() => setOpen(false)}
      initialFocus="checked"
      menu={(
        <div ref={listRef} className={s.roundsList}>
          {options.map((option) => (
            <MenuItem
              key={option.id}
              checked={option.id === value}
              onSelect={() => onChange(option.id)}
            >
              {option.label}
            </MenuItem>
          ))}
        </div>
      )}
    >
      {(trigger) => (
        <button {...trigger} className={s.roundsTrigger} aria-label={`Раунд разбора · ${current?.label}`}>
          {current?.label}
          <Icon name="caretSmall" className={s.roundsCaret} />
        </button>
      )}
    </Dropdown>
  );
}

/**
 * Панель «Анализ ИИ»: одно действие — один результат (05 §1). Не чат: запуск
 * явный («Анализировать» / «Пересчитать»), открытие панели ничего не считает.
 *
 * КОГДА:  на странице тендера, поверх любой вкладки; оболочка и геометрия —
 *         те же, что у чата (импорт его CSS-модуля), поэтому линия шапки,
 *         ширина и слой панели совпадают пиксельно.
 * НЕ ДЛЯ: свободных вопросов (чат остался рядом под пометкой «скоро», §10),
 *         автоматических пересчётов при смене данных — вместо них плашка.
 *
 * UX:     до запуска панель объясняет это и держит единственную кнопку.
 *         Результат: сводка ≤ 3 якорей → секции нативными <details>, свёрнутые,
 *         порядок фиксированный. Плашка устаревания появляется ТОЛЬКО у текущего
 *         раунда и называет причину; снимок прошлого круга не устаревает (§8.2).
 *         Клик по слову-сущности применяет «пресет + фокус» к таблице.
 * A11Y:   открытие переносит фокус в шапку (как у чата), Escape закрывает;
 *         секции — нативные details/summary, клавиатура бесплатно; смена раунда
 *         объявляется через aria-live области результата.
 */
export function AnalysisDock({
  open, onClose, comparison, prevComparison, rev, revNote, onTransition, onResultChange,
}: {
  open: boolean;
  onClose: () => void;
  /** Снимок КП, по которому считается разбор. */
  comparison: Comparison;
  /** Снимок предыдущего раунда — база секций сравнения кругов. */
  prevComparison?: Comparison | null;
  /** Ревизия данных: изменилась после запуска — разбор устарел. */
  rev: string;
  /** Причина последнего изменения данных для плашки («поставщик прислал новое КП»). */
  revNote?: string | null;
  /** Переход «анализ → таблица»: пресет + обязательные показатели + фокус. */
  onTransition: (transition: AnalysisTransition) => void;
  /** Готовый результат наружу: странице нужны комментарии разбора для
   *  попапов ячеек (слой 6). null — разбора ещё нет или он не удался. */
  onResultChange?: (result: AnalysisResult | null) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const runTimer = useRef<number | undefined>(undefined);

  /* Сохранённые разборы ПО РАУНДАМ: перезапуск заменяет результат своего
     раунда и никогда — чужого (05 §8.1). */
  const [runs, setRuns] = useState<Record<number, { result: AnalysisResult; rev: string }>>({});
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const [roundNo, setRoundNo] = useState(() => snapshotRound(comparison));
  const [chatMode, setChatMode] = useState(false);
  /* Управляемая раскрытость секций: свёрнуты по умолчанию, якорь сводки
     раскрывает свою и скроллит к ней. */
  const [unfolded, setUnfolded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  useEffect(() => () => window.clearTimeout(runTimer.current), []);

  const rounds = comparison.rounds ?? [];
  const round = rounds.find((r) => r.number === roundNo);
  const entry = runs[roundNo];
  /* Запуск возможен только по данным раунда, который СЕЙЧАС на экране:
     панель не пересчитывает прошлое и не угадывает будущее. Чужой раунд —
     просмотр сохранённого результата, если он есть. */
  const isDataRound = roundNo === snapshotRound(comparison);

  /* Плашка живёт только у анализа ТЕКУЩЕГО раунда (05 §8.2): прошлый круг —
     завершённое событие, пересчитывать его нечем. */
  const staleReason = entry && entry.rev !== rev && round?.status !== 'closed'
    ? revNote ?? 'Данные тендера изменились'
    : null;

  const prev = prevComparison && snapshotRound(prevComparison) === roundNo - 1
    ? prevComparison
    : undefined;

  const run = () => {
    if (running || !comparison.contractors.length) return;
    setFailed(false);
    setRunning(true);
    /* ДЕМО-задержка вместо ответа модели: при reduced-motion короче. */
    runTimer.current = window.setTimeout(() => {
      try {
        const result = buildAnalysis(comparison, prev);
        if (!result) {
          setFailed(true);
          onResultChange?.(null);
        } else {
          setRuns((all) => ({ ...all, [roundNo]: { result, rev } }));
          onResultChange?.(result);
        }
      } catch {
        setFailed(true);
        onResultChange?.(null);
      }
      setRunning(false);
    }, reducedMotion() ? 300 : 800);
  };

  const goto = (section: AnalysisSectionId, subsection?: AnalysisSubsectionId) => {
    const key = subsection ?? section;
    setUnfolded((all) => ({ ...all, [key]: true }));
    window.setTimeout(() => {
      document.getElementById(`${AI_DOCK_ID}-a-${key}`)
        ?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }, 60);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  /* Чат остаётся доступным одной кнопкой — под пометкой «скоро будет
     реализовано» (свободный вопрос вне контура, 05 §10). */
  if (chatMode) {
    return (
      <AiDock
        open={open}
        onClose={() => { setChatMode(false); onClose(); }}
        comparison={comparison}
        starred={[]}
        onFocusRow={() => {}}
        stub
        onBackToAnalysis={() => setChatMode(false)}
      />
    );
  }

  return (
    <aside
      id={AI_DOCK_ID}
      role="complementary"
      aria-labelledby={`${AI_DOCK_ID}-title`}
      className={base.dock}
      onKeyDown={onKeyDown}
    >
      <header className={base.head}>
        <span className={cx(base.aiTile, running && base.aiTileLive)}>
          <SparkGlyph size={15} />
        </span>
        <h2 ref={headingRef} id={`${AI_DOCK_ID}-title`} tabIndex={-1} className={base.headTitle}>
          Анализ ИИ
        </h2>
        {rounds.length > 1 ? (
          <RoundPicker
            value={roundNo}
            options={rounds.map((r) => ({ id: r.number, label: `Раунд ${r.number}` }))}
            onChange={setRoundNo}
          />
        ) : null}
        <div className={base.headActions}>
          {/* Крестика «Скрыть» здесь больше нет: панель закрывает язычок на
              её левом краю (морф бирки «Анализ ИИ», см. AiTrigger) и Escape. */}
          <IconButton
            variant="panel"
            icon="sparkleChat"
            label="Чат со свободным вопросом — скоро будет реализован"
            onClick={() => setChatMode(true)}
          />
        </div>
      </header>

      <div className={s.body} aria-live="polite" aria-busy={running}>
        {/* ── ни разу не запускали ── */}
        {!entry && !running && !failed ? (
          isDataRound ? (
            <div className={s.idle}>
              <span className={cx(base.aiTile, s.idleTile)}><SparkGlyph size={20} /></span>
              <p className={s.idleTitle}>Разбор ещё не запускали</p>
              <p className={s.idleSub}>
                Панель сама ничего не считает. Разбор строится по КП, поданным на момент запуска.
              </p>
              <Button variant="primary" disabled={!comparison.contractors.length} onClick={run}>
                Анализировать
              </Button>
            </div>
          ) : (
            <div className={s.idle}>
              <p className={s.idleTitle}>Разбора этого раунда нет</p>
              <p className={s.idleSub}>
                Сохранённый разбор появится после запуска в его собственном круге.
              </p>
            </div>
          )
        ) : null}

        {/* ── выполняется: таблица не блокируется ── */}
        {running ? (
          <div className={s.loading}>
            <Skeleton height={14} width="70%" />
            <Skeleton height={14} width="90%" />
            <Skeleton height={14} width="55%" />
            <Skeleton height={38} radius={6} />
            <Skeleton height={38} radius={6} />
            <Skeleton height={38} radius={6} />
          </div>
        ) : null}

        {/* ── сбой ── */}
        {failed ? (
          <ErrorState
            title="Анализ не выполнен"
            description="Таблица и расчёты продолжают работать."
            onRetry={run}
          />
        ) : null}

        {/* ── готово ── */}
        {entry?.result ? (
          <>
            {/* Плашка устаревания: причина и перезапуск одним действием. */}
            {staleReason ? (
              <div role="status" className={s.stale}>
                <p className={s.staleText}>
                  <strong>Разбор устарел.</strong> {staleReason}.
                </p>
                <Button variant="secondary" onClick={run}>Пересчитать</Button>
              </div>
            ) : null}

            {round?.status === 'closed' ? (
              <p className={s.snapshotNote}>Раунд завершён · это снимок прошлого круга</p>
            ) : null}

            {/* Сводка ≤ 3 пунктов, каждый — якорь к своей секции. */}
            <nav className={s.summary} aria-label="Сводка разбора">
              {entry.result.summary.map((point) => (
                <button
                  key={point.text}
                  type="button"
                  className={s.summaryItem}
                  onClick={() => goto(point.section, point.subsection)}
                >
                  <span>{point.text}</span>
                  <Icon name="arrowRightUp" className={s.summaryIcon} />
                </button>
              ))}
            </nav>

            {entry.result.sections.map((section) => {
              if (section.meta) {
                return (
                  <section key={section.id} id={`${AI_DOCK_ID}-a-${section.id}`} className={s.sec}>
                    <h3 className={s.secTitle}>{section.title}</h3>
                    <dl className={s.meta}>
                      {section.meta.map((row) => (
                        <div key={row.label} className={s.metaRow}>
                          <dt>{row.label}</dt>
                          <dd>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {section.note ? (
                      <p className={s.itemNote}>
                        <SparkGlyph size={11} className={s.noteSpark} />
                        {section.note}
                      </p>
                    ) : null}
                  </section>
                );
              }
              if (section.items?.length) {
                const key = section.id;
                return (
                  <details
                    key={key}
                    id={`${AI_DOCK_ID}-a-${key}`}
                    className={s.sec}
                    open={unfolded[key] ?? false}
                    onToggle={(e) => {
                      const el = e.currentTarget;
                      setUnfolded((all) => ({ ...all, [key]: el.open }));
                    }}
                  >
                    <summary className={s.secHead}>
                      <h3 className={s.secTitle}>{section.title}</h3>
                      <Icon name="chevronDown" className={s.secChevron} />
                    </summary>
                    <ul className={s.list}>
                      {section.items.map((item) => (
                        <Item key={item.id} item={item} onTransition={onTransition} />
                      ))}
                    </ul>
                  </details>
                );
              }
              return (section.subsections ?? []).map((sub) => {
                const key = sub.id;
                return (
                  <details
                    key={key}
                    id={`${AI_DOCK_ID}-a-${key}`}
                    className={s.sec}
                    open={unfolded[key] ?? false}
                    onToggle={(e) => {
                      const el = e.currentTarget;
                      setUnfolded((all) => ({ ...all, [key]: el.open }));
                    }}
                  >
                    <summary className={s.secHead}>
                      <h3 className={s.secTitle}>{sub.title}</h3>
                      <Icon name="chevronDown" className={s.secChevron} />
                    </summary>
                    <ul className={s.list}>
                      {sub.items.map((item) => (
                        <Item key={item.id} item={item} onTransition={onTransition} />
                      ))}
                    </ul>
                  </details>
                );
              });
            })}

            <p className={s.disclaimer}>
              Разбор подготовлен ИИ по данным сравнения. Решение принимает специалист.
            </p>
          </>
        ) : null}
      </div>
    </aside>
  );
}
