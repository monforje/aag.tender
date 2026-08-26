import {
  lazy, memo, Suspense, useCallback, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { cx } from '@/shared/lib/cx';
import { plural } from '@/shared/lib/plural';
import { Button } from '@/shared/ui/Button';
import { Dropdown, MenuItem } from '@/shared/ui/Dropdown';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { Skeleton } from '@/shared/ui/Skeleton';
import { reducedMotion } from '@/shared/lib/reducedMotion';
import type { CompareThresholds, Comparison } from '@/entities/comparison';
import type {
  AnalysisFindingKind, AnalysisItem, AnalysisRef, AnalysisResult,
  AnalysisSection, AnalysisSectionId, AnalysisSubsectionId, AnalysisTransition,
} from '../model/analysis';
import { useAnalysisRuns } from '../model/useAnalysisRuns';
import { AI_DOCK_ID } from './dockId';
import { SparkGlyph } from './assets/SparkGlyph';
/* Оболочка панели (геометрия, спектральная линия, плитка ИИ) — ОДНА на оба
   режима: импорт того же CSS-модуля даёт те же хэши классов без копии правил. */
import base from './AiDock.module.css';

/* Заглушка чата грузится ПО КЛИКУ. Свободный вопрос вынесен за контур
   (05 §10), витрина «скоро будет реализовано» открывается редко и вручную —
   а тянула за собой ответчик, историю, стриминг и правила подсказок: 58 КБ
   исходника в главном чанке ради экрана, который почти никто не откроет.
   Оболочка (CSS-модуль) остаётся статической: её делят оба режима, и её
   отложенная загрузка дала бы панель без геометрии. */
const AiDock = lazy(() => import('./AiDock').then((m) => ({ default: m.AiDock })));
import s from './AnalysisDock.module.css';

/** Слова-сущности внутри серверной строки: пунктир и мягкий красный видны без
 *  наведения (05 §6); переход ведёт только то, у чего есть валидный переход.
 *
 *  `keyFor` + `picked` — ОТМЕТКА ПРИМЕНЁННОГО (правка владельца 25.08.2026,
 *  вечер). Клик уводил подсветку в таблицу и не оставлял в панели ни следа:
 *  вернувшись глазами к разбору, человек не мог сказать, ОТ КАКОГО слова
 *  горит обводка на сетке. Ключ приходит снаружи, потому что одно и то же имя
 *  подрядчика встречается в десятке пунктов, и «выбрано» принадлежит паре
 *  «пункт + сущность», а не имени. */
function withRefs(
  text: string,
  refs: AnalysisRef[],
  onPick: (ref: AnalysisRef) => void,
  keyFor: (ref: AnalysisRef) => string,
  picked: string | null,
): ReactNode {
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
        className={cx(s.ref, picked === keyFor(ref) && s.isOn)}
        aria-pressed={picked === keyFor(ref)}
        title={ref.kind === 'work'
          ? 'Показать эту работу в сравнении'
          : 'Показать этого подрядчика в сравнении'}
        onClick={() => onPick(ref)}
      >
        {text.slice(at, at + ref.label.length)}
      </button>,
    );
    pos = at + ref.label.length;
  }
  if (pos < text.length) nodes.push(text.slice(pos));
  return nodes;
}

/** Переход ПОД ТУ СУЩНОСТЬ, ПО КОТОРОЙ КЛИКНУЛИ. Общий `item.transition`
 *  несёт фокус, выбранный сервером для пункта целиком (у «Изменений» — самый
 *  крупный шаг), и на всех словах он один. Тогда клик по второму шагу уводил
 *  к первому, а подсказка обещала «показать ЭТУ работу» — переход обязан
 *  соответствовать слову, иначе он врёт (05 §6). Заменяется ровно то поле,
 *  чей это вид: работа правит позицию, подрядчик — колонку. */
const transitionFor = (item: AnalysisItem, ref: AnalysisRef): AnalysisTransition => ({
  ...item.transition!,
  focus: ref.kind === 'work'
    ? { ...item.transition!.focus, positionId: ref.id }
    : { ...item.transition!.focus, contractorId: ref.id },
});

/** Глиф и цвет находки брифа. Тон — из пяти тонов проекта; «вывод» нейтрален
 *  сознательно: главный вывод — не оценка, красить его значило бы спорить
 *  с находками ниже. */
const FINDING_VIEW: Record<AnalysisFindingKind, { icon: IconName; cls: string }> = {
  key: { icon: 'star', cls: s.fKey },
  saving: { icon: 'graphUp', cls: s.fSaving },
  anomaly: { icon: 'flag', cls: s.fAnomaly },
  risk: { icon: 'closeCircle', cls: s.fRisk },
};

/** Находка «Что обнаружено»: вся строка — цель клика (≥ 30px), переход ведёт
 *  в таблицу тем же механизмом, что слова-сущности. Без перехода строка
 *  статична и не обещает клика. */
function Finding({ finding, picked, onPick }: {
  finding: AnalysisResult['brief']['findings'][number];
  /** Эта находка — та, от которой сейчас горит подсветка в таблице. */
  picked: boolean;
  onPick: (key: string, t: AnalysisTransition) => void;
}) {
  const view = FINDING_VIEW[finding.kind];
  const body = (
    <>
      <Icon name={view.icon} className={cx(s.findingIcon, view.cls)} />
      <span className={s.findingText}>{finding.title}</span>
      {finding.transition ? <Icon name="arrowRightUp" className={s.findingGo} /> : null}
    </>
  );
  return finding.transition ? (
    <button
      type="button"
      className={cx(s.finding, picked && s.isOn)}
      aria-pressed={picked}
      title="Показать в сравнении"
      onClick={() => onPick(`finding:${finding.kind}`, finding.transition!)}
    >
      {body}
    </button>
  ) : (
    <div className={s.finding}>{body}</div>
  );
}

/**
 * Бриф разбора — верхний блок «сначала вывод»: вердикт → находки → почему →
 * рекомендация с действиями. Секции ниже остаются свёрнутыми подробностями.
 *
 * КОГДА:  у готового результата. НЕ ДЛЯ: пустых состояний запуска.
 *
 * UX:     пользователь обязан понимать результат ДО раскрытия секций
 *         (решение владельца 23.08.2026): сплошной текст вынуждал выуживать
 *         вывод самому. Находка без перехода не рисует стрелку и не ловит
 *         курсор — обещание клика без клика хуже его отсутствия.
 *         [Применить] ведёт в таблицу переходом пресета; [Подробнее]
 *         раскрывает базовый разбор и доскролливает к нему.
 * A11Y:   секция озаглавлена; кнопки находок — обычные <button> с текстом.
 */
function Brief({ brief, picked, onPick, onMore }: {
  brief: AnalysisResult['brief'];
  /** Ключ применённой строки разбора — или null, пока не кликали. */
  picked: string | null;
  onPick: (key: string, t: AnalysisTransition) => void;
  onMore: () => void;
}) {
  return (
    <section className={s.brief} aria-label="Краткий вывод">
      <p className={s.briefVerdict}>{brief.verdict}</p>

      {brief.findings.length ? (
        <>
          <h3 className={s.briefLabel}>Что обнаружено</h3>
          <div className={s.briefList}>
            {brief.findings.map((f) => (
              <Finding
                key={f.kind}
                finding={f}
                picked={picked === `finding:${f.kind}`}
                onPick={onPick}
              />
            ))}
          </div>
        </>
      ) : null}

      <h3 className={s.briefLabel}>Почему это важно</h3>
      <p className={s.briefWhy}>{brief.why}</p>

      <h3 className={s.briefLabel}>Рекомендация ИИ</h3>
      <div className={s.rec}>
        <p className={cx(s.itemNote, s.recText)}>
          <SparkGlyph size={11} flat className={s.noteSpark} />
          {brief.recommendation.text}
        </p>
        <div className={s.recActions}>
          {/* Один primary на панель: у результата он ровно здесь — действие,
              ради которого разбор и запускали. */}
          {brief.recommendation.transition ? (
            <Button
              variant="primary"
              onClick={() => onPick('rec', brief.recommendation.transition!)}
            >
              Применить
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onMore}>Подробнее</Button>
        </div>
      </div>
    </section>
  );
}

/** Пункт разбора: серверные факты, затем слот модели. У «ещё не подал» и
 *  полноты слот пуст всегда (`mute`) — заметки просто нет.
 *  memo: пункты стабильны между сменами раскрытости секций, и переезд
 *  `<details>` не обязан перерисовывать весь их список. */
const Item = memo(function Item({ item, picked, onPick }: {
  item: AnalysisItem;
  /** Ключ применённой строки разбора — или null. */
  picked: string | null;
  onPick: (key: string, t: AnalysisTransition) => void;
}) {
  const interactive = !!item.transition;
  const keyFor = (ref: AnalysisRef) => `${item.id}|${ref.kind}:${ref.id}`;
  const pick = (ref: AnalysisRef) => onPick(keyFor(ref), transitionFor(item, ref));
  return (
    <li className={s.item}>
      <p className={s.itemTitle}>
        {interactive
          ? withRefs(item.title, item.refs, pick, keyFor, picked)
          : item.title}
      </p>
      {/* СУЩНОСТИ ЖИВУТ И В ФАКТАХ, а не только в заголовке. Самые крупные
          шаги поставщика за круг названы именно здесь, и до этого они были
          мёртвым текстом: переход по §6 обязан висеть на именах работ и
          подрядчиков ВНУТРИ разбора, а отдельной команды под пунктом нет.
          Каждое слово ведёт к СВОЕЙ сущности — см. transitionFor. */}
      {item.details?.map((line) => (
        <p key={line} className={s.itemDetail}>
          {interactive
            ? withRefs(line, item.refs, pick, keyFor, picked)
            : line}
        </p>
      ))}
      {item.note ? (
        <p className={s.itemNote}>
          <SparkGlyph size={11} flat className={s.noteSpark} />
          {item.note}
        </p>
      ) : null}
    </li>
  );
});

/** Счётчик пунктов С ЕДИНИЦЕЙ. Голое число рядом с заголовком читается как
 *  номер или индекс, а в озвучке даёт «Картина по тендеру три». */
const items = (n: number): string => `${n} ${plural(n, 'пункт', 'пункта', 'пунктов')}`;

/** Сколько внутри — чтобы свёрнутая секция говорила, стоит ли её открывать.
 *  У «Общей картины» счётчика нет: там фиксированный набор показателей, и
 *  число «7 показателей» не значит ничего. */
function secHint(section: AnalysisSection): string | null {
  if (section.subsections) {
    const n = section.subsections.length;
    return `${n} ${plural(n, 'раздел', 'раздела', 'разделов')}`;
  }
  const n = section.items?.length ?? 0;
  return n ? items(n) : null;
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
 * UX:     до запуска панель объясняет это и держит единственную кнопку; без
 *         единого КП кнопки нет вовсе, а причина названа текстом.
 *         Результат читается СВЕРХУ ВНИЗ по нарастанию подробностей (решение
 *         владельца 23.08.2026): бриф «сначала вывод» — вердикт в 1–2
 *         предложениях → находки с переходами в таблицу → почему это важно →
 *         рекомендация с [Применить]; затем ТРИ главные секции нативными
 *         <details>, свёрнутые, порядок фиксированный; подсекции базового
 *         разбора вложены В НЕГО. [Подробнее] из рекомендации раскрывает оба
 *         уровня и доскролливает — переход не уходит в свёрнутую секцию.
 *         Плашка устаревания появляется ТОЛЬКО у текущего раунда, называет
 *         причину и различает две степени (§8.2): «частично» — уехали пороги,
 *         «устарел» — уехали данные. Снимок прошлого круга не устаревает.
 *         Клик по слову-сущности применяет «пресет + фокус» к таблице.
 * A11Y:   открытие переносит фокус в шапку (как у чата), Escape закрывает;
 *         секции — нативные details/summary, клавиатура бесплатно; смена раунда
 *         объявляется через aria-live области результата.
 */
export function AnalysisDock({
  open, onClose, tenderId, comparison, prevComparison, thresholds, onTransition, onResultChange,
}: {
  open: boolean;
  onClose: () => void;
  /** Тендер, у которого просят разбор: с эндпоинтом он уйдёт в путь запроса. */
  tenderId: string;
  /** Снимок КП, по которому считается разбор. */
  comparison: Comparison;
  /** Снимок предыдущего раунда — база секций сравнения кругов. */
  prevComparison?: Comparison | null;
  /** Пороги тендера: разбор каскадирует в сводку и метки вместе с таблицей. */
  thresholds: CompareThresholds;
  /** Переход «анализ → таблица»: пресет + обязательные показатели + фокус. */
  onTransition: (transition: AnalysisTransition) => void;
  /** Готовый результат наружу: странице нужны комментарии разбора для
   *  попапов ячеек (слой 6). null — разбора ещё нет или он не удался. */
  onResultChange?: (result: AnalysisResult | null) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [chatMode, setChatMode] = useState(false);
  /* ── КАКАЯ СТРОКА РАЗБОРА СЕЙЧАС ПРИМЕНЕНА (правка владельца 25.08.2026,
     вечер) ────────────────────────────────────────────────────────────────
     Переход «анализ → таблица» подсвечивал ячейки и не оставлял следа в самой
     панели: обводка на сетке горит, а какая из десяти находок её зажгла —
     не сказано нигде. Ключ живёт ЗДЕСЬ, а не у страницы: это состояние
     ЧТЕНИЯ панели, странице оно не нужно ни для чего, а поднимать его наверх
     значило бы перерисовывать таблицу на каждый клик по разбору.
     Ключ — строка, потому что источников три (находка брифа, кнопка
     рекомендации, слово-сущность внутри пункта), и общий у них ровно один
     вопрос: «эта ли строка сейчас применена». */
  const [picked, setPicked] = useState<string | null>(null);
  /* Управляемая раскрытость секций: свёрнуты по умолчанию, якорь сводки
     раскрывает свою и скроллит к ней. */
  const [unfolded, setUnfolded] = useState<Record<string, boolean>>({});

  /* Запуски по раундам, устаревание и сам расчёт — в хуке: правил там три,
     и в теле компонента они тонули между разметкой секций. */
  const {
    entry, running, failed, run, roundNo, setRoundNo, rounds, round, isDataRound, staleness,
  } = useAnalysisRuns({ tenderId, comparison, prevComparison, thresholds, onResultChange });

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  const pick = useCallback((key: string, transition: AnalysisTransition) => {
    setPicked(key);
    onTransition(transition);
  }, [onTransition]);

  /* Якорь сводки раскрывает ОБА уровня: подсекция живёт внутри свёрнутой
     секции, и раскрытие одной её не показывает — переход уходил бы в никуда. */
  const goto = (section: AnalysisSectionId, subsection?: AnalysisSubsectionId) => {
    const key = subsection ?? section;
    setUnfolded((all) => ({ ...all, [section]: true, [key]: true }));
    window.setTimeout(() => {
      document.getElementById(`${AI_DOCK_ID}-a-${key}`)
        ?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }, 60);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  /* Что объявить голосом: одно предложение на состояние. Пустая строка —
     штатное «сказать нечего», а не пропуск. */
  const sectionCount = entry?.result.sections.length ?? 0;
  const liveStatus = running ? 'Разбор считается'
    : failed ? 'Анализ не выполнен'
      : entry?.result
        ? `Разбор готов, ${sectionCount} ${plural(sectionCount, 'секция', 'секции', 'секций')}`
        : '';

  /* Чат остаётся доступным одной кнопкой — под пометкой «скоро будет
     реализовано» (свободный вопрос вне контура, 05 §10). */
  if (chatMode) {
    return (
      /* Пустой fallback намеренно: панель уже на экране, и подменять её
         скелетоном на время локального чанка — мигание вместо загрузки. */
      <Suspense fallback={null}>
        <AiDock
          open={open}
          onClose={() => { setChatMode(false); onClose(); }}
          comparison={comparison}
          starred={[]}
          onFocusRow={() => {}}
          stub
          onBackToAnalysis={() => setChatMode(false)}
        />
      </Suspense>
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
          <SparkGlyph size={15} state={running ? 'processing' : 'idle'} />
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

      {/* ЖИВОЙ РЕГИОН — ОТДЕЛЬНАЯ КОРОТКАЯ СТРОКА, А НЕ ВСЁ ТЕЛО ПАНЕЛИ.
          Раньше `aria-live` висел на прокручиваемом теле, и по готовности
          скринридер зачитывал разбор целиком — замерено 3955 символов. Регион
          рендерится ВСЕГДА и пустым: polite-обновления объявляются только из
          области, которая была в дереве до появления текста. */}
      <p className="visually-hidden" role="status">{liveStatus}</p>

      <div className={s.body} aria-busy={running}>
        {/* ── ни разу не запускали ── */}
        {!entry && !running && !failed ? (
          isDataRound ? (
            <div className={s.idle}>
              <span className={cx(base.aiTile, s.idleTile)}><SparkGlyph size={20} /></span>
              {/* Ни одного КП — запуск НЕДОСТУПЕН И НАЗВАНА ПРИЧИНА (05 §4,
                  граничные случаи): погашенная кнопка без объяснения читается
                  как поломка панели. */}
              <p className={s.idleTitle}>
                {comparison.contractors.length ? 'Разбор ещё не запускали' : 'Разбирать нечего'}
              </p>
              <p className={s.idleSub}>
                {comparison.contractors.length
                  ? 'Панель сама ничего не считает. Разбор строится по КП, поданным на момент запуска.'
                  : 'По тендеру не подано ни одного КП — сравнивать не с чем. Разбор станет доступен с первым предложением.'}
              </p>
              {comparison.contractors.length ? (
                <Button variant="primary" onClick={run}>Анализировать</Button>
              ) : null}
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
          /* Контур повторяет форму брифа: две строки вердикта, три находки,
             карточка рекомендации — готовый результат садится в те же габариты,
             и содержимое не прыгает в момент прихода. */
          <div className={s.loading}>
            <Skeleton height={15} width="88%" />
            <Skeleton height={15} width="62%" />
            <Skeleton height={30} radius={4} />
            <Skeleton height={30} radius={4} />
            <Skeleton height={30} radius={4} />
            <Skeleton height={96} radius={6} />
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
            {/* Плашка устаревания: причина и перезапуск одним действием.
                ДВЕ СТЕПЕНИ (05 §8.2), и они не синонимы: «частично» — те же
                КП, иначе расставленные метки; «устарел» — разбор описывает
                другие данные. Смешать их значило бы звать пересчитывать
                одинаково срочно там, где срочность разная. */}
            {staleness ? (
              <div
                role="status"
                className={cx(s.stale, staleness.level === 'partial' && s.stalePartial)}
              >
                <p className={s.staleText}>
                  <strong>
                    {staleness.level === 'partial' ? 'Разбор частично устарел.' : 'Разбор устарел.'}
                  </strong>
                  {' '}{staleness.reason}.
                </p>
                <Button variant="secondary" onClick={run}>Пересчитать</Button>
              </div>
            ) : null}

            {round?.status === 'closed' ? (
              <p className={s.snapshotNote}>Раунд завершён · это снимок прошлого круга</p>
            ) : null}

            {/* Бриф «сначала вывод»: вердикт, находки с переходами в таблицу,
                рекомендация. Секции ниже — подробности по [Подробнее]. */}
            <Brief
              brief={entry.result.brief}
              picked={picked}
              onPick={pick}
              onMore={() => goto('base_review', 'tender_overview')}
            />

            {/* ТРИ ГЛАВНЫЕ СЕКЦИИ, порядок фиксирован (05 §4): изменения
                поставщиков → общая картина круга → базовый разбор. Подсекции
                базового разбора живут ВНУТРИ него, а не рядом: разложенные по
                верхнему уровню, они читались как шесть равных разделов, и
                «полнота» весила столько же, сколько целый круг торгов. */}
            {entry.result.sections.map((section) => {
              const hint = secHint(section);
              return (
                <details
                  key={section.id}
                  id={`${AI_DOCK_ID}-a-${section.id}`}
                  className={s.sec}
                  open={unfolded[section.id] ?? false}
                  onToggle={(e) => {
                    const el = e.currentTarget;
                    setUnfolded((all) => ({ ...all, [section.id]: el.open }));
                  }}
                >
                  <summary className={s.secHead}>
                    <h3 className={s.secTitle}>{section.title}</h3>
                    {hint ? <span className={s.secHint}>{hint}</span> : null}
                    <Icon name="chevronDown" className={s.secChevron} />
                  </summary>

                  {/* Фиксированный набор показателей круга (05 §4.2). */}
                  {section.meta ? (
                    <dl className={s.meta}>
                      {section.meta.map((row) => (
                        <div key={row.label} className={s.metaRow}>
                          <dt>{row.label}</dt>
                          <dd>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {section.note ? (
                    <p className={cx(s.itemNote, s.secNote)}>
                      <SparkGlyph size={11} flat className={s.noteSpark} />
                      {section.note}
                    </p>
                  ) : null}

                  {section.items?.length ? (
                    <ul className={s.list}>
                      {section.items.map((item) => (
                        <Item key={item.id} item={item} picked={picked} onPick={pick} />
                      ))}
                    </ul>
                  ) : null}

                  {section.subsections?.map((sub) => (
                    <details
                      key={sub.id}
                      id={`${AI_DOCK_ID}-a-${sub.id}`}
                      className={s.sub}
                      open={unfolded[sub.id] ?? false}
                      onToggle={(e) => {
                        const el = e.currentTarget;
                        setUnfolded((all) => ({ ...all, [sub.id]: el.open }));
                      }}
                    >
                      <summary className={s.subHead}>
                        <h4 className={s.subTitle}>{sub.title}</h4>
                        <span className={s.secHint}>{items(sub.items.length)}</span>
                        <Icon name="chevronDown" className={s.secChevron} />
                      </summary>
                      <ul className={s.list}>
                        {sub.items.map((item) => (
                          <Item key={item.id} item={item} picked={picked} onPick={pick} />
                        ))}
                      </ul>
                    </details>
                  ))}
                </details>
              );
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
