import type { ReactNode } from 'react';
import s from './RichText.module.css';

/* ── Разбор строки на «плоский текст» и **жирный** ──────────────────────────
   split с захватывающей группой даёт чередование: обычный кусок, жирный,
   обычный… Нечётные индексы — содержимое **…**, их и заворачиваем. */
function inline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((chunk, i) =>
    i % 2 ? <strong key={i}>{chunk}</strong> : chunk
  );
}

/**
 * Мини-рендер разговорной разметки ответов ассистента: абзацы, списки «- »
 * и **жирный**. Библиотеку markdown не тащим — ответчик в model/askAi.ts
 * выдаёт ровно эти три конструкции, больше формат не обещает.
 *
 * КОГДА:  текст ассистента в чате «Анализа» (и любой будущий текст модели в
 *         этой фиче).
 * НЕ ДЛЯ: произвольного markdown — заголовков, ссылок, кода здесь нет; когда
 *         модель начнёт присылать их, набор расширяется ЗДЕСЬ и заодно в
 *         контракте askAi, а не заменой на react-markdown; текста пользователя
 *         (он плоский, рендерится <p> без этого компонента).
 *
 * UX:     пустая строка делит абзацы, подряд идущие «- » складываются в один
 *         список — как в любом чат-интерфейсе; жирный выделяет имена и суммы,
 *         поэтому читается бегло.
 * A11Y:   настоящие <p>/<ul>/<li>/<strong>: скринридер получает структуру, а
 *         не стену текста.
 *
 * @example
 * <RichText text="Проверить до выбора:\n\n- **Аномалия** — причина…" />
 */
export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];

  /* Один проход по строкам: буфер копит абзац или список, пустая строка
     (или смена типа) его закрывает. */
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`p${blocks.length}`}>{inline(paragraph.join(' '))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`l${blocks.length}`}>
        {list.map((item, i) => <li key={i}>{inline(item)}</li>)}
      </ul>
    );
    list = [];
  };

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
    } else if (trimmed.startsWith('- ')) {
      flushParagraph();
      list.push(trimmed.slice(2));
    } else {
      flushList();
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  flushList();

  return <div className={s.rich}>{blocks}</div>;
}
