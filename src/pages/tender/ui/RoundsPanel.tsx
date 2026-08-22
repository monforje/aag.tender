import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { snapshotRound, type Comparison, type RoundStatus } from '@/entities/tender';
import s from './RoundsPanel.module.css';

/** Статус раунда описан один раз: тон и глиф — те же каналы, что у прочих
 *  статусов продукта. Черновик в демо-данных не встречается — слот под него
 *  оставлен словарю, а не фантазии рендера. */
const ROUND_STATUS: Record<RoundStatus | 'draft', { label: string; tone: 'info' | 'neutral' | 'warning'; icon: 'activity' | 'checkCircle' | 'clock' }> = {
  draft: { label: 'Черновик', tone: 'warning', icon: 'clock' },
  current: { label: 'В процессе', tone: 'info', icon: 'activity' },
  closed: { label: 'Завершён', tone: 'neutral', icon: 'checkCircle' },
};

/**
 * Вкладка «Раунды»: список кругов торгов тендера со статусами (US-3 сцены
 * «Запуск раунда») и составом подачи.
 *
 * КОГДА:  раздел «Раунды» карточки тендера.
 * НЕ ДЛЯ: сравнения КП по раундам — это делает панель «Анализ ИИ» своим
 *         переключателем сохранённых разборов (05 §8.1).
 *
 * UX:     видно, какой раунд текущий; у каждого — сколько приглашённых уже
 *         подало КП. Номер идущего круга сквозной: исходный сбор КП — раунд 1.
 * A11Y:   статусы — <Badge> с глифом, цвет не единственный канал.
 */
export function RoundsPanel({ comparison, onSimulateSubmission }: {
  comparison: Comparison;
  /** ДЕМО-действие: очередной молчащий контрагент сдаёт КП (partial → full).
   *  На живых данных его не бывает — приход КП фиксирует контрагентский вход. */
  onSimulateSubmission?: () => void;
}) {
  const rounds = comparison.rounds ?? [];
  const activeNo = snapshotRound(comparison);
  const byId = new Map(comparison.contractors.map((c) => [c.id, c]));

  return (
    <div className={s.root}>
      <div className={s.head}>
        <p className={s.note}>
          Раунд — один круг сбора КП. Сохранённый разбор прошлого круга живёт
          в панели анализа и не устаревает.
        </p>
        {/* NON-REALIZED: запуск нового раунда с формой рассылки — отдельная
            поставка; кнопка честно говорит об этом, второй черновик не заводит. */}
        <Button variant="secondary" disabled title="Скоро будет реализовано">
          Новый раунд
        </Button>
      </div>

      <ul className={s.list}>
        {rounds.length === 0 ? (
          <li className={s.row}>
            <span className={s.roundTitle}>Раунд 1</span>
            <Badge tone="info" icon="activity">В процессе</Badge>
            <span className={s.meta}>Исходный сбор КП</span>
          </li>
        ) : rounds.map((round) => {
          const invited = round.invited.length;
          const submitted = round.invited.filter((id) => {
            const c = byId.get(id);
            return !!c && (c.submittedInRound ?? 1) >= round.number;
          }).length;
          const waiting = round.invited.filter((id) => {
            const c = byId.get(id);
            return !!c && (c.submittedInRound ?? 1) < round.number;
          }).map((id) => byId.get(id)?.name ?? id);
          const status = ROUND_STATUS[round.status];

          return (
            <li key={round.id} className={s.row}>
              <span className={cxRound(round.number === activeNo)}>
                Раунд {round.number}
              </span>
              <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
              <span className={s.meta}>
                Подали: {submitted} из {invited}
                {round.number === activeNo && waiting.length > 0 ? (
                  <> · ждём: {waiting.join(', ')}</>
                ) : null}
              </span>
              {round.number === activeNo && waiting.length > 0 && onSimulateSubmission ? (
                <Button variant="secondary" className={s.act} onClick={onSimulateSubmission}>
                  Отметить подачу КП
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className={s.foot}>
        Приглашение на новый раунд уходит контрагентам с его прошлой формой
        предзаполненной — история подач сохраняется.
      </p>
    </div>
  );
}

function cxRound(isActive: boolean): string {
  return isActive ? `${s.roundTitle} ${s.roundCurrent}` : s.roundTitle;
}
