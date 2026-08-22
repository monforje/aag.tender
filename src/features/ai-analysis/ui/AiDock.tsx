import { useEffect, useRef, useState } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { Popover } from '@/shared/ui/Popover';
import { plural } from '@/shared/lib/plural';
import type { Comparison } from '@/entities/tender';
import { askAi, type AiAnswer } from '../model/askAi';
import { SparkGlyph } from './assets/SparkGlyph';
import { RichText } from './RichText';
import s from './AiDock.module.css';

/* Стабильные id связки «триггер ↔ панель»: триггер рендерит страница (якорем
   у линии main header'а), панель — она же, и встретиться им суждено только
   здесь. Тот же приём, что TITLE_ID у сводки. */
export const AI_DOCK_ID = 'ai-analysis-dock';

/* Потолок заголовка сессии: первые слова первого вопроса пользователя. */
const TITLE_MAX = 32;

/** Подсказки пустого состояния — те же вопросы, на которые отвечает
 *  маршрутизатор askAi: каждая подсказка гарантированно попадает в свой
 *  сценарий ответа. Звёзд в текстах нет: ★ в таблице — состояние данных,
 *  в подсказке оно читалось как декор. «Сравнить отмеченных…» по-прежнему
 *  маршрутизируется словом «сравн». */
const SUGGESTIONS = [
  'Где риски и аномалии?',
  'Где есть запас для торга?',
  'Что не закрыто у лидера?',
  'Сравнить отмеченных подрядчиков',
];

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  /** У пользователя — плоский текст; у ассистента — мини-разметка (<RichText>). */
  text: string;
  /** Позиция сметы для действия «Показать строку в таблице»; у реплики null. */
  rowId: string | null;
}

/** Разговор в истории дока. В массив попадают ТОЛЬКО разговоры с репликами:
 *  пустая сессия не создаётся вовсе, поэтому «мусор» накапливаться не может.
 *  activeId === null означает чистый холст нового чата. История живёт в
 *  состоянии компонента и умирает с размонтированием страницы тендера —
 *  осознанный долг уровня «фильтры не сохраняются». */
interface ChatSession {
  id: number;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

type Phase = 'idle' | 'thinking' | 'streaming';

const reducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Заголовок разговора: первый вопрос пользователя одной строкой; длинный
   обрезается по границе слова (не по букве) и закрывается многоточием. */
function titleOf(question: string): string {
  const clean = question.replace(/\s+/g, ' ').trim();
  if (clean.length <= TITLE_MAX) return clean;
  const cut = clean.slice(0, TITLE_MAX);
  const space = cut.lastIndexOf(' ');
  return `${(space > TITLE_MAX / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/* Каждая отложенная запись (таймеры «думает»/стриминга) замыкана на id своей
   сессии и пишет через этот маппер: ни одна ветка не способна оставить
   реплику в чужом разговоре, даже если активный чат сменился. */
const withSession = (
  list: ChatSession[],
  sid: number,
  patch: (x: ChatSession) => ChatSession,
): ChatSession[] => list.map((x) => (x.id === sid ? patch(x) : x));

/**
 * Чат-панель «Анализ ИИ»: разговор по данным сравнения КП, ответы собирает
 * ДЕМО-ответчик model/askAi.ts из правил deriveInsights().
 *
 * КОГДА:  на странице тендера. Панель фиксирована и выровнена по полосе
 *         .main-header страницы: её шапка стоит ровно на этой полосе, и
 *         нижняя линия шапки чата продолжает нижнюю границу полосы крошек —
 *         линия одна.
 *         Открытость — проп open; история разговоров живёт в состоянии
 *         компонента и умирает вместе со страницей тендера (док смонтирован
 *         всегда) — осознанный долг, как у несохраняемых фильтров реестра;
 *         черновик ввода — тоже.
 * НЕ ДЛЯ: замены комментариев к тендеру и постоянных заметок — это разовый
 *         разбор текущего среза; постоянного хранилища разговоров (его нет:
 *         сессии не пишутся ни в стор, ни в URL намеренно); модального окна
 *         (страница остаётся интерактивной намеренно).
 *
 * UX:     канон чат-интерфейса: пользователь — пузырь справа с тихой заливкой
 *         и одним скруглённым углом, ассистент — во всю ширину слева с
 *         аватаром-искрой, без рамок вокруг сообщений. Пустое состояние —
 *         приветствие и подсказки-вопросы (клик = отправка). Ответ появляется
 *         после «думает»-точек псевдо-стримингом порциями слов (~0.5–0.8s
 *         задержка демо); при prefers-reduced-motion стриминг пропускается —
 *         текст приходит целиком, движение отключено, информация та же.
 *         История — несколько разговоров: шапка держит «Новый чат» и
 *         выпадашку списка (<Popover>, верхний слой платформы); заголовок
 *         сессии — первые слова первого вопроса (~32 символа). Во время
 *         генерации переключение и создание заблокированы (disabled + защита
 *         в обработчиках), а таймеры стриминга замыканы на id сессии — сменить
 *         контекст ответа посреди генерации невозможно дважды. Автоскролл
 *         только пока пользователь внизу; отскроллившемуся вверх показывается
 *         круглая кнопка «к последнему сообщению»; смена сессии садит ленту на
 *         её последний реплику. Стоп-кнопка обрывает генерацию: частичный
 *         ответ остаётся, пустой — убирается. Действие «Показать строку в
 *         таблице» ведёт к позиции сметы — мост анализ→таблица без карточек.
 * A11Y:   лента — role="log" aria-live="polite"; композер подписан через
 *         <label>; отправка Enter, перенос Shift+Enter (проверяется и
 *         isComposing). Открытие переносит фокус на заголовок панели, Escape
 *         и крестик («Скрыть») закрывают; фокус возвращает триггер сам, с
 *         preventScroll — закрытие не прокручивает страницу. Закрытая панель
 *         visibility:hidden — не ловит табуляцию. Кнопки истории/нового чата — IconButton с именем;
 *         выпадашка истории получает Escape, клик мимо и возврат фокуса от
 *         нативного <dialog>; текущий разговор помечен aria-current.
 *
 * @example
 * <AiDock open={aiOpen} onClose={closeAi} comparison={MOCK_COMPARISON}
 *         starred={starred} onFocusRow={setFocusRowId}
 *         onThinkingChange={setAiThinking} />
 */
export function AiDock({
  open, onClose, comparison, starred, onFocusRow, onThinkingChange,
  stub = false, onBackToAnalysis,
}: {
  open: boolean;
  onClose: () => void;
  comparison: Comparison;
  /** Отмеченные ★ подрядчики — состояние таблицы, прочитанное наружу:
   *  питает ответы про пару. */
  starred: string[];
  /** Ответ ведёт к строке сметы; null-безопасно: сводные ответы не ведут никуда. */
  onFocusRow: (rowId: string | null) => void;
  /** Генерация началась/закончилась — триггер ускоряет шиммер (thinking). */
  onThinkingChange?: (thinking: boolean) => void;

  /* ── NON-REALIZED ──────────────────────────────────────────────────────────
     Свободный вопрос вынесен за контур (05 §10, инбокс 21.08.2026 §3): чат
     остаётся в продукте одной кнопкой панели разбора, но композер заменён
     заглушкой «скоро будет реализовано». Код ответчика сохранён как есть. */
  /** Режим витрины: ввода нет, подсказки выключены. */
  stub?: boolean;
  /** Возврат в режим разбора — кнопка в шапке рядом со «Скрыть». */
  onBackToAnalysis?: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(0);
  const thinkingTimer = useRef<number | undefined>(undefined);
  const streamTimer = useRef<number | undefined>(undefined);
  /* Кто именно стримит: пара (сессия, сообщение). Стоп и завершение гасят их
     первыми же ветками — таймер не переживёт ни отмену, ни размонтирование. */
  const streamingId = useRef<number | null>(null);
  const streamingSid = useRef<number | null>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [historyAt, setHistoryAt] = useState<DOMRect | null>(null);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  /* Пользователь у нижнего края — автоскролл включён (порог 32px: щель от
     субпиксельного округления не считается «ушёл вверх»). */
  const [pinned, setPinned] = useState(true);

  const active = activeId !== null
    ? sessions.find((x) => x.id === activeId) ?? null
    : null;
  const messages = active?.messages ?? [];
  /* Разговоры для истории — только ненулевые, новые сверху. Пустых сессий
     в массиве нет по построению (см. ChatSession). */
  const past = [...sessions]
    .filter((x) => x.messages.length > 0)
    .sort((a, b) => b.createdAt - a.createdAt);

  const busy = phase !== 'idle';

  /* Отслеживание «ушёл ли пользователь вверх» — единственный источник
     решения автоскролла и кнопки перехода вниз. */
  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 32);
  };

  /* Открытие переносит фокус ВНУТРЬ панели; возврат на триггер делает сам
     триггер (эффект по open в AiTrigger) — с preventScroll, без скролла. */
  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  /* Таймеры не должны пережить компонент: страница размонтировалась —
      генерация умерла вместе с ней (и история вместе с ней — см. JSDoc). */
  useEffect(() => () => {
    window.clearTimeout(thinkingTimer.current);
    window.clearInterval(streamTimer.current);
  }, []);

  /* Состояние «генерирует» наружу — триггеру для темпа шиммера. */
  useEffect(() => {
    onThinkingChange?.(phase !== 'idle');
  }, [phase, onThinkingChange]);

  /* Автоскролл только пока пользователь внизу; отскроллившегося не дёргаем.
     Instant, а не smooth: тики стриминга каждые ~30ms, плавность здесь — рывок. */
  useEffect(() => {
    if (!pinned) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, phase, pinned]);

  /* Смена разговора сажает ленту на его последнюю реплику: открывая чужой
     разговор из истории, пользователь читает его конец, а не середину. */
  useEffect(() => {
    setPinned(true);
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeId]);

  const stopStream = (cancelled: boolean) => {
    window.clearInterval(streamTimer.current);
    streamTimer.current = undefined;
    const sid = streamingSid.current;
    const mid = streamingId.current;
    /* Ничего не успело появиться — пустой пузырь убираем; частичный ответ
       честно остаётся как есть. Пишем строго В СВОЮ сессию по id. */
    if (cancelled && sid !== null && mid !== null) {
      setSessions((list) => withSession(list, sid, (x) => ({
        ...x,
        messages: x.messages.filter((m) => m.id !== mid || m.text),
      })));
    }
    streamingId.current = null;
    streamingSid.current = null;
    setPhase('idle');
  };

  const send = (raw?: string) => {
    const question = (raw ?? input).trim();
    if (!question || phase !== 'idle') return;

    /* Сессия фиксируется ДО таймеров: все отложенные колбэки ниже замкнуты
       на этот sid, а не читают «текущий» — контекст ответа сменить нельзя. */
    let sid = activeId;
    if (sid === null || !sessions.some((x) => x.id === sid)) {
      sid = ++nextId.current;
      const created: ChatSession = {
        id: sid, title: titleOf(question), messages: [], createdAt: Date.now(),
      };
      setSessions((list) => [...list, created]);
      setActiveId(sid);
    }
    const answerSid = sid;

    setInput('');
    const el = textareaRef.current;
    if (el) el.style.height = '';           // авторост обратно в одну строку

    /* Первый вопрос даёт разговору имя; дальше заголовок не трогается. */
    setSessions((list) => withSession(list, answerSid, (x) => ({
      ...x,
      title: x.messages.length === 0 ? titleOf(question) : x.title,
      messages: [...x.messages, {
        id: ++nextId.current, role: 'user', text: question, rowId: null,
      }],
    })));
    setPhase('thinking');

    /* ДЕМО-задержка «размышления» ~500–800ms; при reduced-motion она короче:
       это чистая декорация, ждать её дважды не нужно. */
    const wait = reducedMotion() ? 350 : 550 + Math.random() * 250;
    thinkingTimer.current = window.setTimeout(() => {
      const ctx = { groups: comparison.groups, contractors: comparison.contractors, starred };
      const answer: AiAnswer = askAi(question, ctx);

      if (reducedMotion()) {
        setSessions((list) => withSession(list, answerSid, (x) => ({
          ...x,
          messages: [...x.messages, {
            id: ++nextId.current, role: 'assistant', text: answer.text, rowId: answer.rowId,
          }],
        })));
        setPhase('idle');
        return;
      }

      /* Псевдо-стриминг порциями слов. Токен = слово + весь хвостовой
         whitespace (\S+\s*, включая \n) — join('') восстанавливает текст 1:1.
         Бывший здесь lookbehind (?<= ) убран: старые Safari на нём падают,
         а склеивать слова он всё равно не умел — хрупкость без выгоды. */
      const id = ++nextId.current;
      streamingId.current = id;
      streamingSid.current = answerSid;
      setPhase('streaming');

      const body = answer.text.replace(/^\s+/, '');
      const lead = answer.text.slice(0, answer.text.length - body.length);
      const words = body.match(/\S+\s*/g) ?? [];
      if (lead && words.length > 0) words[0] = lead + words[0];
      let i = 2;
      /* Первая порция СОЗДАЁТ реплику ассистента в сессии; дальше тики
         обновляют её же через writePartial. Разделение принципиально: тик
         работает через map по существующим сообщениям — если реплику не
         завести отдельно, стример пишет в пустоту (ровно это и было сломано). */
      const firstPartial = words.slice(0, i).join('');
      setSessions((list) => withSession(list, answerSid, (x) => ({
        ...x,
        messages: [...x.messages, {
          id, role: 'assistant', text: firstPartial, rowId: answer.rowId,
        }],
      })));

      if (!words.length) {           // пустой ответ стримеру не нужен
        stopStream(true);
        return;
      }
      const writePartial = (partial: string) => {
        setSessions((list) => withSession(list, answerSid, (x) => ({
          ...x,
          messages: x.messages.map((m) => (m.id === id ? { ...m, text: partial } : m)),
        })));
      };
      streamTimer.current = window.setInterval(() => {
        i += 2;
        writePartial(words.slice(0, i).join(''));
        if (i >= words.length) stopStream(false);
      }, 32);
    }, wait);
  };

  /* Стоп: гасим оба таймера. Частичный текст остаётся (честно), пустой
     пузырь после «думает» — убирается. */
  const stop = () => {
    window.clearTimeout(thinkingTimer.current);
    thinkingTimer.current = undefined;
    if (phase === 'streaming') stopStream(true);
    else setPhase('idle');
  };

  /* Новый чат: активным становится чистый холст (activeId === null). Сессия
     возникнет с первым вопросом; старые разговоры остаются в истории.
     Пустые сессии не копятся по построению — создавать нечего и удалять
     нечего. */
  const newChat = () => {
    if (phase !== 'idle') return;
    setHistoryAt(null);
    setActiveId(null);
    textareaRef.current?.focus();
  };

  /* Переключение из истории: лента подменяется целиком. Заблокировано при
     генерации — кнопки disabled, здесь страховка от программного вызова. */
  const selectSession = (id: number) => {
    if (phase !== 'idle') return;
    setHistoryAt(null);
    setActiveId(id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      /* Историю закрывает нативный <dialog> — но keydown всё равно всплывает
         по DOM сквозь верхний слой к доку. Здесь уступаем: иначе одно нажатие
         закрыло бы и выпадашку, и всю панель. */
      if (historyAt !== null) return;
      onClose();
    }
  };

  return (
    <aside
      id={AI_DOCK_ID}
      role="complementary"
      aria-labelledby={`${AI_DOCK_ID}-title`}
      className={cx(s.dock, open && s.dockOpen)}
      onKeyDown={onKeyDown}
    >
      <header className={s.head}>
        {/* Плитка ИИ: спектральная заливка, искра поверх обращена в белый
            силуэт (CSS-фильтр в модуле). Дышит только в streaming: в thinking
            мигают точки в ленте — один индикатор движения за раз. */}
        <span className={cx(s.aiTile, phase === 'streaming' && s.aiTileLive)}>
          <SparkGlyph size={15} />
        </span>
        <h2 ref={headingRef} id={`${AI_DOCK_ID}-title`} tabIndex={-1} className={s.headTitle}>
          Анализ ИИ
        </h2>
        <div className={s.headActions}>
          {onBackToAnalysis ? (
            <IconButton
              variant="panel"
              icon="reply"
              label="К разбору тендера"
              onClick={onBackToAnalysis}
            />
          ) : null}
          <IconButton
            variant="panel"
            icon="clock"
            label="История разговоров"
            aria-haspopup="dialog"
            aria-expanded={historyAt !== null}
            disabled={busy || past.length === 0}
            onClick={(e) => setHistoryAt(e.currentTarget.getBoundingClientRect())}
          />
          <IconButton
            variant="panel"
            icon="add"
            label="Новый чат"
            disabled={busy}
            onClick={newChat}
          />
          <IconButton
            variant="panel"
            icon="closeCircle"
            label="Скрыть анализ"
            onClick={onClose}
          />
        </div>
      </header>

      {/* Лента сообщений. role="log" несёт неявный aria-live="polite" — новые
          реплики объявляются, не крадя фокус. */}
      <div ref={listRef} className={s.log} role="log" aria-live="polite" aria-label="Разговор с анализом" onScroll={handleScroll}>
        {messages.length === 0 && phase === 'idle' ? (
          <div className={s.empty}>
            <span className={cx(s.aiTile, s.emptyTile)}><SparkGlyph size={20} /></span>
            <p className={s.emptyTitle}>Чем помочь со сравнением КП?</p>
            <p className={s.emptySub}>
              Отвечаю по данным текущего среза: риски и аномалии, запасы торга,
              пробелы в КП, разница между подрядчиками.
            </p>
            {stub ? (
              <div className={s.soon} role="note">
                Свободный вопрос — вне текущего контура. Разбор тендера живёт
                на соседней вкладке панели.
              </div>
            ) : (
              <div className={s.suggestions}>
                {SUGGESTIONS.map((question) => (
                  <button key={question} type="button" className={s.chip} onClick={() => send(question)}>
                    {question}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((m) => (
              m.role === 'user' ? (
                <div key={m.id} className={s.userRow}>
                  <p className={s.bubble}>{m.text}</p>
                </div>
              ) : (
                <div key={m.id} className={s.botRow}>
                  <span className={s.avatar}>
                    <SparkGlyph size={13} />
                  </span>
                  <div className={s.botBody}>
                    <RichText text={m.text} />
                    {m.rowId && streamingId.current !== m.id && (
                      <button
                        type="button"
                        className={s.rowAction}
                        onClick={() => onFocusRow(m.rowId)}
                      >
                        Показать строку в таблице
                        <Icon name="arrowRightUp" className={s.rowActionIcon} />
                      </button>
                    )}
                  </div>
                </div>
              )
            ))}
            {phase === 'thinking' && (
              <div className={s.botRow}>
                <span className={s.avatar}>
                  <SparkGlyph size={13} />
                </span>
                <div className={s.dots} aria-label="Анализ думает">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* История разговоров: панель поверх ленты из шапки. Верхний слой,
          Escape, клик мимо и возврат фокуса — у нативного <dialog> (<Popover>). */}
      <Popover anchor={historyAt} onClose={() => setHistoryAt(null)} label="История разговоров" className={s.historyPop}>
        <div className={s.historyList}>
          {past.map((sess) => (
            <button
              key={sess.id}
              type="button"
              className={cx(s.historyItem, sess.id === activeId && s.historyItemActive)}
              aria-current={sess.id === activeId || undefined}
              onClick={() => selectSession(sess.id)}
            >
              <span className={s.historyTitle}>{sess.title}</span>
              <span className={s.historyMeta}>
                {sess.messages.length} {plural(sess.messages.length, 'сообщение', 'сообщения', 'сообщений')}
              </span>
            </button>
          ))}
        </div>
      </Popover>

      <div className={s.footer}>
        {!pinned && messages.length > 0 && (
          <IconButton
            variant="panel"
            icon="altArrowDownBold"
            label="К последнему сообщению"
            className={s.jumpBtn}
            onClick={() => {
              const el = listRef.current;
              el?.scrollTo({ top: el.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' });
              /* pinned вернётся сам от скролл-событий плавной прокрутки:
                 форсировать здесь — значит убить smooth мгновенным прыжком. */
            }}
          />
        )}

        {/* Композер. form — чтобы Enter в одиночной строке работал нативно;
            onKeyDown всё равно перехватывает Enter раньше submit.
            NON-REALIZED: в витринном режиме вместо композера — заглушка. */}
        {stub ? (
          <div className={s.soonPlate} role="note">
            <span className={s.soonTitle}>Скоро будет реализовано</span>
            Свободный вопрос к анализу вынесен за текущий контур. Пользуйтесь
            разбором — он закрывает базовые вопросы по тендеру.
          </div>
        ) : (
        <form
          className={s.composer}
          onSubmit={(e) => { e.preventDefault(); send(); }}
        >
          <label className="visually-hidden" htmlFor={`${AI_DOCK_ID}-input`}>Вопрос анализу</label>
          <textarea
            id={`${AI_DOCK_ID}-input`}
            ref={textareaRef}
            className={s.textarea}
            placeholder="Спросите про риски, торг или сравнение…"
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              /* Авторост до потолка 140px: высота сбрасывается в auto и ставится
                 по scrollHeight — контент решает, не JS-арифметика символов. */
              e.target.style.height = '';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          {busy ? (
            <button type="button" className={s.send} aria-label="Остановить генерацию" onClick={stop}>
              <span className={s.stopSquare} />
            </button>
          ) : (
            <button
              type="submit"
              className={cx(s.send, input.trim() && s.sendReady)}
              aria-label="Отправить"
              disabled={!input.trim()}
            >
              <Icon name="arrowUp" className={s.sendIcon} />
            </button>
          )}
        </form>
        )}
      </div>
    </aside>
  );
}
