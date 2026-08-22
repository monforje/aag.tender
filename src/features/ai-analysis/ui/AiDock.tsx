import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@/shared/lib/cx';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import {
  SCENARIOS, deriveInsights, scenarioPreset,
  type Comparison, type Insight, type PresetId, type ScenarioId,
} from '@/entities/tender';
import { askAi, DEFAULT_QUESTION } from '../model/askAi';
import s from './AiDock.module.css';

/* Стабильные id связки «триггер ↔ панель»: триггер рендерит сводка тендера,
   панель — страница, и встретиться им суждено только здесь. Тот же приём,
   что TITLE_ID у сводки. */
export const AI_TRIGGER_ID = 'ai-analysis-trigger';
export const AI_DOCK_ID = 'ai-analysis-dock';

/**
 * Панель «Анализ»: сценарии, карточки правил и вопрос к ИИ по сравнения КП.
 *
 * КОГДА:  на странице тендера, рядом с разделами карточки. Данные приходят
 *         те же, что питают таблицу сравнения; открытость — проп open.
 * НЕ ДЛЯ: истории чатов и замены комментариев к тендеру — это разовый разбор
 *         текущего среза, а не переписка; модального окна (страница остаётся
 *         интерактивной намеренно).
 *
 * UX:     панель немодальна: карточка правила подсвечивает строку таблицы
 *         рядом, а не вместо неё. Сценарии «Точки торгов»/«Риски» заодно
 *         переключают пресет таблицы (onRequestPreset) — связь односторонняя.
 *         Карточка кликабельна ТОЛЬКО когда есть строка для перехода; без пары
 *         ★ сценарии пары показывают приглашение, а не пустоту. Вопрос при
 *         пустом поле подставляется дефолтным; ответ честно помечен «демо».
 * A11Y:   role="complementary" с именем из заголовка; открытие переносит фокус
 *         на заголовок панели, Escape и крестик закрывают, фокус возвращает
 *         триггер (страница); закрытая панель visibility:hidden — не ловит
 *         табуляцию. Сценарии — кнопки с aria-pressed: это фильтр вида, а не
 *         radiogroup, каждая цель доступна с клавиатуры напрямую.
 *
 * @example
 * <AiDock open={aiOpen} onClose={closeAi} comparison={MOCK_COMPARISON}
 *         starred={starred} onFocusRow={setFocusRowId}
 *         onRequestPreset={applyPreset} />
 */
export function AiDock({
  open, onClose, comparison, starred, onFocusRow, onRequestPreset,
}: {
  open: boolean;
  onClose: () => void;
  comparison: Comparison;
  /** Отмеченные ★ подрядчики — состояние таблицы, прочитанное наружу. */
  starred: string[];
  /** Карточка ведёт к строке сметы; null-безопасно: сводные карточки не кликаются. */
  onFocusRow: (rowId: string | null) => void;
  /** Сценарий просит пресет таблицы. Не передан — панель работает поверх любого среза. */
  onRequestPreset?: (preset: PresetId) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [scenario, setScenario] = useState<ScenarioId>('important');
  const [ask, setAsk] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);

  /* Открытие переносит фокус ВНУТРЬ панели; возврат на триггер делает
     закрывающая сторона (страница держит ссылку на кнопку). */
  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  /* Escape работает только пока фокус внутри панели: немодальный конвеншн —
     глобальные обработчики страница получает не должна. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  /* Правила считаются из тех же чисел, что таблица: один источник, спорить
     не о чем. Тринадцать позиций — мемоизация тут про чистоту зависимостей,
     а не про цену. */
  const insights = useMemo(
    () => deriveInsights(comparison.groups, comparison.contractors, starred),
    [comparison.groups, comparison.contractors, starred],
  );
  const visible = insights.filter((i) => i.scenario === scenario);

  const pickScenario = (id: ScenarioId) => {
    setScenario(id);
    const preset = scenarioPreset(id);
    if (preset) onRequestPreset?.(preset);
  };

  const submit = () => {
    const question = ask.trim() || DEFAULT_QUESTION;
    const pair = starred
      .map((id) => comparison.contractors.find((c) => c.id === id)?.name)
      .filter((n): n is string => !!n);
    const compareText = insights.find((i) => i.scenario === 'compare')?.text;
    setAnswer(askAi(question, { pair, compareText }));
  };

  /* Приглашение вместо пустоты: назван объект и первое действие
     (rule/empty-state-action). Действие живёт в таблице — дублировать его
     кнопкой здесь нельзя, иначе целей у звезды две. */
  const needsPair = scenario === 'compare' || scenario === 'selection';

  return (
    <aside
      id={AI_DOCK_ID}
      role="complementary"
      aria-labelledby={`${AI_DOCK_ID}-title`}
      className={cx(s.dock, open && s.dockOpen)}
      onKeyDown={onKeyDown}
    >
      <header className={s.head}>
        <div>
          <h2 ref={headingRef} id={`${AI_DOCK_ID}-title`} tabIndex={-1} className={s.headTitle}>
            Анализ
          </h2>
          <p className={s.headSub}>правила и ИИ · раунд 1</p>
        </div>
        <IconButton
          variant="panel"
          icon="closeCircle"
          label="Закрыть анализ"
          className={s.closeBtn}
          onClick={onClose}
        />
      </header>

      <div className={s.body}>
        <div className={s.scenarios} role="group" aria-label="Сценарий анализа">
          {SCENARIOS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={cx(s.chip, scenario === id && s.isActive)}
              aria-pressed={scenario === id}
              onClick={() => pickScenario(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {needsPair && starred.length < 2 ? (
          <p className={s.invite}>
            Отметьте двух подрядчиков ★ в шапке сравнения — появится разложение
            разницы по позициям. Сейчас отмечено: {starred.length}.
          </p>
        ) : visible.length ? (
          visible.map((insight) => <Card key={insight.id} insight={insight} onGo={onFocusRow} />)
        ) : (
          <p className={s.invite}>По этому сценарию находок нет — срез чист.</p>
        )}
      </div>

      <div className={s.ask}>
        <label className={s.askLabel} htmlFor={`${AI_DOCK_ID}-question`}>Спросить ИИ</label>
        <textarea
          id={`${AI_DOCK_ID}-question`}
          className={s.textarea}
          placeholder="Свой вопрос по отмеченным ★ или сценарию…"
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
        />
        <Button variant="primary" className={s.askSubmit} onClick={submit}>
          Спросить
        </Button>
        {answer ? (
          <div className={s.answerBlock} role="status">
            <span className={s.answerEyebrow}>Ответ · демо</span>
            <p className={s.answerText}>{answer}</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

/** Карточка правила. Кнопкой становится только тогда, когда есть куда вести:
   сводная карточка, притворяющаяся целью, была бы целью в никуда. */
function Card({ insight, onGo }: { insight: Insight; onGo: (rowId: string | null) => void }) {
  const body = (
    <>
      <span className={s.cardHead}>
        <Badge tone={insight.tone}>{insight.tagLabel}</Badge>
        <strong className={s.cardTitle}>{insight.title}</strong>
      </span>
      <span className={s.cardText}>{insight.text}</span>
      <span className={s.cardMeta}>правило · {scenarioLabel(insight)}</span>
    </>
  );

  if (!insight.rowId) {
    return <p className={s.card}>{body}</p>;
  }
  return (
    <button
      type="button"
      className={s.card}
      title="Показать строку в сравнении"
      onClick={() => onGo(insight.rowId)}
    >
      {body}
    </button>
  );
}

const scenarioLabel = (insight: Insight): string =>
  SCENARIOS.find((sc) => sc.id === insight.scenario)?.label.toLowerCase() ?? insight.scenario;
