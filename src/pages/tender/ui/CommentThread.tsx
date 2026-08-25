import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '@/shared/lib/cx';
import {
  addresseeOf, avatarTone, initialsOf, threadOrder, type CellComment,
} from '@/entities/comparison';
import { Icon } from '@/shared/ui/Icon';
import { Popover } from '@/shared/ui/Popover';
import { plural } from '@/shared/lib/plural';
import s from './CommentThread.module.css';

/** Тон аватара → класс. ТАБЛИЦЕЙ, а не склейкой `s[`av${tone}`]`: собранное
 *  из строки имя класса не проверяется ни типами, ни сборкой, ни скриптом
 *  осиротевших классов — опечатка дала бы аватар без фона и ни одной ошибки. */
const AVATAR: Record<ReturnType<typeof avatarTone>, string> = {
  info: s.avInfo, success: s.avSuccess, warning: s.avWarning,
};

/** С какой длины запись сворачивается «Показать полностью».
 *
 *  ПОРОГ, А НЕ ЗАМЕР, и это осознанная неточность. Честный ответ на вопрос
 *  «влез ли текст в четыре строки» даёт только `scrollHeight` после отрисовки:
 *  эффект на каждую запись, ResizeObserver на панель (её ширина меняется
 *  вместе с окном) и карта состояний id → boolean, которую надо чистить при
 *  смене треда. Цена ощутимая, выигрыш — точность на границе в одну-две
 *  записи из десяти.
 *  Число выведено из геометрии панели: 4 строки × ~48 знаков (13px/19 в теле
 *  шириной ~300px) ≈ 190; берём с запасом вниз — пусть кнопка скорее появится
 *  у пограничной записи, чем не появится у длинной.
 *
 *  ponytail: порог вместо замера; понадобится точность — это ResizeObserver
 *  на .text и класс по факту переполнения. */
const CLAMP_CHARS = 180;

const isLong = (text: string): boolean =>
  text.length > CLAMP_CHARS || text.split('\n').length > 4;

/**
 * Тред комментариев к ячейке — история переписки по паре «позиция ×
 * подрядчик» (§2.4, `comment.md`, `position-comments.md`).
 *
 * КОГДА:  клик по маркеру комментария в ячейке.
 * НЕ ДЛЯ: разбора самой ячейки (см. CellCard — там числа) и комментария
 *         анализа ИИ (тот приходит в сводку по наведению).
 *
 * ПОРЯДОК ПАНЕЛИ ЗАФИКСИРОВАН ВЛАДЕЛЬЦЕМ (25.08.2026): АДРЕС → СЧЁТЧИК И
 *         ДЕЙСТВИЕ НАД ТРЕДОМ → ЗАПИСИ → КОМПОЗЕР. До правки первым стояло
 *         «Комментарии · N», а позиция уходила подписью под него — панель
 *         начиналась со СВОЕГО названия, а не с того, о чём она. Открывают её
 *         из ячейки, и первый вопрос читателя всегда один: «это точно та
 *         строка?». Счётчик отвечает на второй вопрос и потому стоит вторым,
 *         на одной полосе с «Отметить все прочитанными» — оба про ВЕСЬ тред,
 *         и место у них общее, отделённое линейкой.
 *
 * UX:     УРОВЕНЬ YOUTUBE, а не «список подсказок» (решение владельца
 *         25.08.2026). Комментарий поставщика — единственное место, где
 *         несопоставимость объясняется СЛОВАМИ, и текст бывает на два экрана:
 *         запись это аватар + имя + время НАД текстом, сам текст, действия
 *         под ним. Плоская строка «автор: текст» на таком объёме нечитаема.
 *         «ПОКАЗАТЬ ПОЛНОСТЬЮ» ТОЛЬКО У ДЛИННЫХ ЗАПИСЕЙ (правка владельца):
 *         кнопка стояла под КАЖДОЙ, включая «Согласны» из двух слов, и
 *         обещала спрятанное там, где прятать нечего. Порог — по длине текста
 *         (см. CLAMP_CHARS); сворачивание по-прежнему без JS.
 *         ГИГАНТСКИЙ ТЕКСТ СВОРАЧИВАЕТСЯ БЕЗ JS: скрытый чекбокс и `:checked`
 *         снимают line-clamp. Не из аскетизма — состояние «развёрнуто»
 *         принадлежит ОДНОЙ записи и умирает вместе с ней; тащить его в React
 *         значило бы держать карту id → boolean и ловить рассинхрон.
 *         АВАТАРЫ ЕДИНОГО РАЗМЕРА 28px — и у корневой записи, и у ответа
 *         (правка владельца): разный размер читался бы разным статусом
 *         участников, а отступ ответа уже говорит о вложенности.
 *         ЛЕНТА ЗАПИСЕЙ ПРОКРУЧИВАЕТСЯ САМА, а шапка и композер стоят: тред
 *         на сорок реплик иначе выдавил бы поле ввода за экран, то есть отнял
 *         бы у панели её главное действие.
 *         КОМПОЗЕР БЕЗ КНОПОК «ОТМЕНИТЬ / ОТВЕТИТЬ» (правка владельца):
 *         авторастущее поле и круглая иконка отправки. Две кнопки под каждым
 *         полем ввода превращали панель в форму; «Отмена» здесь и вовсе
 *         лишняя — не отправлять можно, просто не нажимая.
 *         ENTER ОТПРАВЛЯЕТ, Shift+Enter переносит строку: переписка — поток
 *         коротких реплик, и тянуться мышью к кнопке на каждой из них дорого.
 *         ПРОЧИТАНО = ПОКАЗАНО (правка владельца 25.08.2026): запись снимает с
 *         непросмотренных сама лента, когда запись в ней действительно видна.
 *         Кнопка «Отметить все прочитанными» осталась для обратного случая —
 *         «читать не буду, убери отметку»; раньше она была ЕДИНСТВЕННЫМ
 *         способом, и тред, прочитанный от первой строки до последней,
 *         продолжал светиться непрочитанным.
 *         ОТВЕТ НА ОТВЕТ ЕСТЬ, ВЛОЖЕННОСТЬ ОДНА: `parentId` указывает на
 *         конкретного адресата, а на экране все ответы стоят одним отступом и
 *         называют адресата ИМЕНЕМ над текстом. Лесенка отступов на ветке из
 *         пяти реплик съела бы ширину панели, а плоский список без имени не
 *         отвечает, кто кому возражает.
 * A11Y:   «Показать полностью» — <label> к настоящему чекбоксу: работает с
 *         клавиатуры и объявляется как переключатель. Поле композера имеет
 *         видимую подпись-плейсхолдер И aria-label, кнопка отправки — своё
 *         имя с подсказкой о клавише. Список записей — `<ol>`: у переписки
 *         есть порядок, и скринридер обязан назвать его числом.
 *
 * @example
 * <CommentThread at={anchor} title="Укладка ламината" subtitle="МонолитСтрой"
 *                comments={list} onClose={close} onSend={send} onSeen={seen} />
 */
export function CommentThread({
  at, title, subtitle, comments, onClose, onSend, onSeen, author,
}: {
  at: DOMRect | null;
  /** Название позиции и имя подрядчика — адрес треда словами. */
  title: string;
  subtitle: string;
  comments: readonly CellComment[];
  onClose: () => void;
  /** Отправка записи или ответа. Текст уже обрезан по краям вызывающим. */
  onSend: (text: string, parentId?: string) => void;
  /** Просмотренность. `ids` названы — прочитаны именно эти записи (их показала
   *  лента); без аргумента — «Отметить все прочитанными» кнопкой. */
  onSeen: (ids?: readonly string[]) => void;
  /** Кто пишет — для аватара композера. */
  author: string;
}) {
  const id = useId();
  /* На какую запись отвечаем. Одна на тред: два открытых поля ответа
     заставляли бы выбирать, в какое из них попадёт Enter. */
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const listRef = useRef<HTMLOListElement>(null);

  const ordered = threadOrder(comments);
  const unread = comments.filter((c) => c.unread).length;
  const replyName = replyTo
    ? comments.find((c) => c.id === replyTo)?.author
    : undefined;

  /* ── ПРОЧИТАНО = ПОКАЗАНО (правка владельца 25.08.2026) ──────────────────
     Запись, попавшую человеку на глаза, снимает с непросмотренных ЛЕНТА, а не
     кнопка: кнопка «Отметить все» осталась для тех, кто читать не собирается.
     Наблюдатель видимости, а не таймер на открытие панели: тред прокручивается
     сам (max-height у .list), и запись под сгибом человек не видел — списывать
     её в прочитанные значило бы врать о собственном состоянии.
     `root` — сама лента, threshold 0.9: считается прочитанной запись, вошедшая
     в окно почти целиком, а не мелькнувшая кромкой при быстрой прокрутке.
     Повторных записей состояния не будет: `markSeen` выходит рано, когда
     снимать нечего, а уже прочитанные записи из наблюдения выпадают вместе с
     атрибутом. */
  /* НАБЛЮДАТЕЛЬ ПЕРЕСОБИРАЕТСЯ ТОЛЬКО ПРИ СМЕНЕ СОСТАВА НЕПРОЧИТАННЫХ, а не
     на каждом рендере. Зависимостями стояли `comments` и `onSeen` — оба
     МЕНЯЮТСЯ ОТ САМОГО ЭФФЕКТА: списание записи в прочитанные правит карту
     тредов, карта поднимает рендер таблицы, рендер выдаёт новый инлайновый
     `onSeen`, эффект срабатывает снова и заново подписывает весь список.
     Замер (profile-compare, 20 открытий треда, --cpu 4): пересчёт стиля
     9774 мс за прогон. Ключ по непросмотренным закрывает петлю: когда снимать
     больше нечего, строка ключа не меняется, и эффект молчит. */
  const seenRef = useRef(onSeen);
  seenRef.current = onSeen;
  const unreadKey = comments.filter((c) => c.unread).map((c) => c.id).join(',');
  useEffect(() => {
    const root = listRef.current;
    if (!at || !unreadKey) return;
    const io = new IntersectionObserver((entries) => {
      const ids = entries
        .filter((e) => e.isIntersecting)
        .map((e) => (e.target as HTMLElement).dataset.id)
        .filter((id): id is string => !!id);
      if (ids.length) seenRef.current(ids);
    }, { root, threshold: 0.9 });
    root?.querySelectorAll('[data-unread]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [at, unreadKey]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text, replyTo ?? undefined);
    setDraft('');
    setReplyTo(null);
    /* Поле выросло под черновик СВОИМ инлайновым height — вернуть его обязан
       тот, кто черновик стёр: про инлайновый стиль React ничего не знает, и
       после отправки трёхстрочной реплики поле осталось бы трёхстрочным. */
    if (fieldRef.current) fieldRef.current.style.height = 'auto';
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <Popover anchor={at} onClose={onClose} label={`Комментарии: ${title}`} className={s.pop}>
      <div className={s.thread}>
        {/* ── АДРЕС ТРЕДА ПЕРВЫМ: о какой строке и о чьём КП речь. */}
        <header className={s.head}>
          <h4 className={s.title}>{title}</h4>
          <p className={s.sub}>{subtitle}</p>
        </header>

        {/* ── ПОЛОСА ТРЕДА: счётчик и единственное действие над ним целиком.
            Отделена линейками — записи ниже начинаются с чистого листа, а не
            приклеиваются к заголовку. */}
        <div className={s.bar}>
          <span className={s.count}>
            {comments.length}{' '}
            {plural(comments.length, 'комментарий', 'комментария', 'комментариев')}
            {unread ? <span className={s.unreadPill}>{unread} новых</span> : null}
          </span>
          {/* Кнопка есть ВСЕГДА, но гаснет, когда снимать нечего: исчезающий
              контрол заставлял бы гадать, был он тут или нет. */}
          <button
            type="button"
            className={s.linkLike}
            disabled={!unread}
            title={unread
              ? 'Снять отметку «не прочитано» со всех записей треда'
              : 'Непрочитанных записей нет'}
            onClick={() => onSeen()}
          >
            <Icon name="checkCircle" className={s.linkIcon} />
            Отметить все прочитанными
          </button>
        </div>

        <ol className={s.list} ref={listRef}>
          {ordered.map((c) => {
            const long = isLong(c.text);
            const to = addresseeOf(c, comments);
            return (
              <li
                key={c.id}
                data-id={c.id}
                data-unread={c.unread ? '' : undefined}
                className={cx(
                  s.item,
                  c.parentId && s.itemReply,
                  replyTo === c.id && s.itemTarget,
                )}
              >
                <span className={cx(s.avatar, AVATAR[avatarTone(c.author)])}>
                  {initialsOf(c.author)}
                </span>
                <div className={s.body}>
                  {/* Чекбокс стоит ПЕРЕД текстом: `:checked ~ .text` работает
                      только по последующим соседям. Заводится ТОЛЬКО у длинной
                      записи — у короткой сворачивать нечего. */}
                  {long ? (
                    <input type="checkbox" className={s.clampToggle} id={`${id}-${c.id}`} />
                  ) : null}
                  <div className={s.itemHead}>
                    <span className={s.name}>{c.author}</span>
                    <span className={s.time}>
                      {c.at}{c.version ? ` · ${c.version}` : ''}
                    </span>
                    {c.unread ? <span className={s.newDot} aria-label="не просмотрено" /> : null}
                  </div>
                  {/* КОМУ ОТВЕЧАЮТ — строкой над текстом, а не отступом. Все
                      ответы стоят на ОДНОМ уровне вложенности (канон), поэтому
                      в ветке из четырёх реплик отступ уже ничего не различает:
                      адресата называет имя. */}
                  {to ? (
                    <span className={s.addressee}>
                      <Icon name="reply" className={s.addresseeIcon} />
                      {to}
                    </span>
                  ) : null}
                  <div className={cx(s.text, long && s.textClamp)}>{c.text}</div>
                  {long ? (
                    <label className={s.more} htmlFor={`${id}-${c.id}`}>Показать полностью</label>
                  ) : null}
                  <div className={s.acts}>
                    <button
                      type="button"
                      className={s.act}
                      onClick={() => {
                        /* Адресат — САМА запись, а не её корень: ответ на ответ
                           существует, и подмена родителя корнем стирала бы, кому
                           возражают (см. CellComment.parentId). */
                        setReplyTo(c.id);
                        fieldRef.current?.focus();
                      }}
                    >
                      <Icon name="reply" className={s.actIcon} />
                      Ответить
                    </button>
                    <button
                      type="button"
                      className={s.act}
                      onClick={() => navigator.clipboard?.writeText(c.text)}
                    >
                      <Icon name="copy" className={s.actIcon} />
                      Копировать
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* КОМПОЗЕР: аватар + авторастущее поле + круглая иконка отправки.
            Кнопка прижата к НИЗУ обёртки (align-items:flex-end), поэтому при
            двух и более строках она остаётся снизу справа, а не уезжает
            вместе с центром поля. */}
        {/* РЕЖИМ ОТВЕТА НАЗВАН НАД ПОЛЕМ, а не под ним: «кому я сейчас пишу» —
            это условие ввода, и читать его надо ДО того, как начал набирать.
            Строкой ниже поля (так было до 25.08.2026) оно попадало под руку
            вместе с кнопкой отправки и читалось уже после отправленной не туда
            реплики. Крестик снимает режим — адресат меняется на «в тред». */}
        {replyName ? (
          <div className={s.replyBar}>
            <Icon name="reply" className={s.replyBarIcon} />
            <span className={s.replyBarName}>Ответ: {replyName}</span>
            <button
              type="button"
              className={s.replyBarDrop}
              aria-label={`Отменить ответ участнику ${replyName}`}
              title="Писать в тред, а не ответом"
              onClick={() => setReplyTo(null)}
            >
              <Icon name="closeCircle" />
            </button>
          </div>
        ) : null}

        <div className={s.composer}>
          <span className={cx(s.avatar, AVATAR[avatarTone(author)])}>
            {initialsOf(author)}
          </span>
          <div className={s.field}>
            {/* АВТОРОСТ — по фактической высоте контента, а не по числу
                переводов строки: длинная реплика без единого Enter всё равно
                занимает три строки, и счёт `\n` о ней ничего не знает.
                Потолок ставит max-height в CSS: дальше поле прокручивается,
                иначе одна простыня выдавила бы тред за экран. */}
            <textarea
              ref={fieldRef}
              rows={1}
              className={s.input}
              value={draft}
              placeholder={replyName ? `Ответить: ${replyName}…` : 'Написать комментарий…'}
              aria-label={replyName ? `Ответ участнику ${replyName}` : 'Новый комментарий'}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={onKey}
            />
            <button
              type="button"
              className={s.send}
              disabled={!draft.trim()}
              aria-label="Отправить комментарий"
              title="Отправить (Enter)"
              onClick={send}
            >
              <Icon name="send" />
            </button>
          </div>
        </div>
      </div>
    </Popover>
  );
}
