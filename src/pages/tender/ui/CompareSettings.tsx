import { useState } from 'react';
import { cx } from '@/shared/lib/cx';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { Input } from '@/shared/ui/Input';
import { Popover } from '@/shared/ui/Popover';
import {
  clampThresholds, decimal, SYSTEM_THRESHOLDS, type CompareThresholds, type RowFacts,
} from '@/entities/comparison';
import { plural } from '@/shared/lib/plural';
import s from './CompareSettings.module.css';

/** Пороговые поля с фиксированным смыслом — рендерятся общим циклом; особые
 *  строки (коэффициент с подсказкой, доля ключевых с превью) — ниже. */
const PLAIN_ROWS = [
  {
    key: 'spreadNoticeable',
    label: 'Разброс «заметный»',
    hint: 'Строка помечается как заметно расходящаяся.',
    min: 0,
    max: 100,
  },
  {
    key: 'spreadHigh',
    label: 'Разброс «высокий»',
    hint: 'Строка получает тег и попадает в фильтр «Высокий разброс».',
    min: 1,
    max: 100,
  },
] as const;

/**
 * Окно настроек сравнения: пороги аналитики ТЕНДЕРА (решение владельца
 * 22.08.2026 — личных и организационных дефолтов нет).
 *
 * КОГДА:  из кнопки `⚙` полосы сравнения (<CompareToolbar>).
 * НЕ ДЛЯ: показа отклонения и ставки (галочки спутников живут прямо на
 *         полосе), вида строк и фильтров (отдельные контролы), полоски
 *         распределения и способа подсветки минимума (место не назначено —
 *         открытый вопрос владельца).
 *
 * UX:     ПОВЕРХНОСТЬ — <Popover>, а не <Modal>: порог применяется сразу и
 *         каскадом перекрашивает таблицу, специалист обязан ВИДЕТЬ эффект,
 *         крутя ручку; модальное окно накрыло бы то, на что он смотрит.
 *         Каждая строка несёт пояснение, что порог меняет: настройка без
 *         объяснения последствия заставляет крутить наугад. У коэффициента
 *         аномалии подсказка ОБЯЗАТЕЛЬНА (единственный порог-коэффициент):
 *         текст цитирует metrics.md §9 — формулу, разбор на числах, «почему
 *         коэффициент», смысл маркера и границы применения; канон метрики
 *         один, интерфейс его цитирует, а не пересказывает. Доля ключевых
 *         показывает живое превью состава на текущем срезе.
 * A11Y:   числовые поля связаны с подписью через <Field>; подсказка k —
 *         кнопка с aria-expanded, текст в потоке панели (не hover-only).
 *
 * @example
 * <CompareSettings thresholds={thresholds} onChange={handleThresholds}
 *                  allRows={facts.rows} />
 */
export function CompareSettings({ thresholds, onChange, allRows }: {
  thresholds: CompareThresholds;
  /** Зажатое значение приходят наружу: хранит страницу. */
  onChange: (thresholds: CompareThresholds) => void;
  /** Все строки среза БЕЗ фильтров — база превью состава ключевых. */
  allRows: RowFacts[];
}) {
  const [at, setAt] = useState<DOMRect | null>(null);
  const [kOpen, setKOpen] = useState(false);

  const patch = (part: Partial<CompareThresholds>) =>
    onChange(clampThresholds({ ...thresholds, ...part }));

  return (
    /* Корень несёт --pop-width: её читает <Popover>, а ширина по умолчанию
       (232px) тесна для четырёх полей с пояснениями — без моста контент
       обрезается краем диалога (тот же приём, что у легенды). */
    <div className={s.root}>
      <IconButton
        variant="topbar"
        icon="settings"
        label="Настройки таблицы"
        title="Пороги аналитики этого тендера"
        aria-haspopup="dialog"
        aria-expanded={at !== null}
        onClick={(e) => setAt(e.currentTarget.getBoundingClientRect())}
      />
      <Popover anchor={at} onClose={() => { setAt(null); setKOpen(false); }} label="Настройки таблицы">
        <div className={s.body}>
          {PLAIN_ROWS.map((row) => (
            <Field key={row.key} label={row.label} hint={row.hint} className={s.row}>
              <Input
                className={s.input}
                type="number"
                inputMode="numeric"
                min={row.min}
                max={row.max}
                value={thresholds[row.key]}
                onChange={(e) => patch({ [row.key]: Number(e.target.value) })}
              />
            </Field>
          ))}

          {/* Коэффициент аномалии: единственный порог-КОЭФФИЦИЕНТ, без разбора
              читается произвольным числом — подсказка обязательна. */}
          <div className={s.row}>
            <div className={s.kHead}>
              <Field label="Коэффициент аномалии k" className={s.kField}>
                <Input
                  className={s.input}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  step={0.5}
                  value={thresholds.anomalyK}
                  onChange={(e) => patch({ anomalyK: Number(e.target.value) })}
                />
              </Field>
              <button
                type="button"
                className={cx(s.kHelpToggle)}
                aria-expanded={kOpen}
                aria-label="Что такое коэффициент аномалии"
                onClick={() => setKOpen((on) => !on)}
              >
                <Icon name={kOpen ? 'closeCircle' : 'questionCircle'} />
              </button>
            </div>
            {kOpen ? <KHelp /> : null}
          </div>

          <Field
            label="Доля ключевых работ"
            className={s.row}
            hint={`Состав ключевых и линия отсечки в виде «По весу». Превью на срезе: при ${decimal(thresholds.keyShare)} % — ${keysAt(allRows, thresholds.keyShare)}, при 90 % — ${keysAt(allRows, 90)}.`}
          >
            <Input
              className={s.input}
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={thresholds.keyShare}
              onChange={(e) => patch({ keyShare: Number(e.target.value) })}
            />
          </Field>

          <footer className={s.footer}>
            <Button
              variant="secondary"
              onClick={() => onChange({ ...SYSTEM_THRESHOLDS })}
            >
              Вернуть системные значения
            </Button>
          </footer>
        </div>
      </Popover>
    </div>
  );
}

/** Сколько строк наберёт накопительная доля веса до порога — тот же счёт,
    что ставит производные ключевые в analyzeComparison ([R4]). */
function keysAt(rows: RowFacts[], share: number): string {
  const sumWeight = rows.reduce((acc, r) => acc + r.weight, 0);
  if (sumWeight <= 0) return plural(0, 'работа', 'работы', 'работ');
  let acc = 0;
  let n = 0;
  for (const row of [...rows].sort((a, b) => b.weight - a.weight)) {
    if (row.weight <= 0) break;
    acc += row.weight;
    n += 1;
    if ((acc / sumWeight) * 100 >= share) break;
  }
  return `${n} ${plural(n, 'работа', 'работы', 'работ')}`;
}

/** Подсказка у порога аномалии — ЦИТАТА канона метрики (`metrics.md` §9):
    формула, причина коэффициентности, разбор на числах, смысловая граница и
    границы применения. Своей терминологии здесь не заводим. */
function KHelp() {
  return (
    <div className={s.kHelp}>
      <p className={s.kFormula}>dᵢ = |стоимостьᵢ / медиана − 1|;<br />
        аномалия, если dᵢ ≥ k × median(dᵢ остальных)</p>
      <p><b>Почему коэффициент.</b> Нормальный разброс у работ разный: где все
        укладываются в 3 %, выброс на 15 % — сигнал; где гуляют на 40 % —
        обычное дело. Метрика меряется относительно того, как расходятся
        остальные в этой же строке.</p>
      <p><b>Что даёт k.</b> Меньше — метятся и умеренные выбросы, больше —
        только грубые. Стартовое значение — гипотеза, калибруется на реальных
        торгах.</p>
      <p><b>Граница смысла.</b> Маркер означает «проверить», а не «ошибка»:
        особые условия сигнал не снимают, но сопровождают его пояснением.</p>
      <p><b>Когда не считается.</b> Меньше трёх цен, нулевая медиана строки или
        нулевой разброс отклонений остальных (тогда любая ненулевая dᵢ —
        аномалия).</p>
      <p className={s.kSource}>Источник: metrics.md §9</p>
    </div>
  );
}
