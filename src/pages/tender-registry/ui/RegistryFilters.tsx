import { cx } from '@/shared/lib/cx';
import { shortDate } from '@/shared/lib/date';
import { toggle } from '@/shared/lib/toggle';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import {
  Dropdown, DropdownGroup, MenuCheckItem, MenuPanel, useDropdownSlot,
} from '@/shared/ui/Dropdown';
import { FacetFilter } from '@/shared/ui/FacetFilter';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { RangeCalendar } from '@/shared/ui/RangeCalendar';
import { SearchInput } from '@/shared/ui/SearchInput';
import {
  activeCount, EMPTY_FILTERS, FACETS, panelCount, STATUS, STATUS_IDS,
  type Filters,
} from '@/entities/tender';
import s from './RegistryFilters.module.css';

interface RegistryFiltersProps {
  value: Filters;
  onChange: (next: Filters) => void;
}

/** Окно «Фильтры»: критерии слева, значения справа — универсальный
 *  <FacetFilter>. Домен отдаёт ему только список критериев (FACETS) и срез
 *  Filters по этим ключам; про портфели и виды работ компонент не знает. */
function FiltersPopover({ value, onChange }: RegistryFiltersProps) {
  const slot = useDropdownSlot('filters');
  const count = panelCount(value);

  return (
    <Dropdown
      {...slot}
      menuAlign="right"
      closeOnSelect={false}
      menu={(
        <FacetFilter
          open={slot.open}
          facets={FACETS}
          value={{
            portfolio: value.portfolio, project: value.project, kind: value.kind, owner: value.owner,
          }}
          onChange={(next) => onChange({ ...value, ...next })}
          onClose={slot.onClose}
        />
      )}
    >
      {(trigger) => (
        <IconButton
          {...trigger}
          variant="topbar"
          icon="filter"
          label={count ? `Фильтры · ${count}` : 'Фильтры'}
          active={count > 0}
          badge={count ? <span className={s.btnBadge}>{count}</span> : null}
        />
      )}
    </Dropdown>
  );
}

/** Статус — свой селект: значений мало, они цветные и нужны чаще остальных,
 *  поэтому вынесены из общего окна на полосу. */
function StatusSelect({ value, onChange }: RegistryFiltersProps) {
  const slot = useDropdownSlot('status');
  const picked = value.statuses;
  const only = picked.length === 1 ? STATUS[picked[0]] : null;
  const label = picked.length === 0 ? 'Статус' : `Статус · ${picked.length}`;

  return (
    <Dropdown
      {...slot}
      menuAlign="left"
      closeOnSelect={false}
      menu={(
        <MenuPanel
          className={s.panelNarrow}
          footer={picked.length ? (
            <Button variant="secondary" onClick={() => onChange({ ...value, statuses: [] })}>
              Очистить
            </Button>
          ) : null}
        >
          <div className={s.panelBody}>
            {STATUS_IDS.map((id) => (
              <MenuCheckItem
                key={id}
                checked={picked.includes(id)}
                tone={STATUS[id].tone}
                icon={STATUS[id].icon}
                onToggle={() => onChange({ ...value, statuses: toggle(picked, id) })}
              >
                {STATUS[id].label}
              </MenuCheckItem>
            ))}
          </div>
        </MenuPanel>
      )}
    >
      {(trigger) => (
        <Button
          {...trigger}
          variant="secondary"
          on={picked.length > 0}
          className={cx(only && s.controlBadge)}
        >
          {/* Один статус — показываем его капсулой: тот же тон и глиф, что в
              таблице, и подпись не нужна отдельно. Несколько (или ни одного) —
              нейтральная иконка и счётчик: смешивать цвета на одной кнопке
              значит обещать, что выбран один. */}
          {only
            ? <Badge tone={only.tone} icon={only.icon}>{only.label}</Badge>
            : <><Icon name="activity" className={s.controlIcon} />{label}</>}
          <Icon name="caretSmall" className={s.controlCaret} />
        </Button>
      )}
    </Dropdown>
  );
}

/** Период — не два голых поля в полосе, а свой селект: границы задаются и
 *  руками, и по календарю (см. <RangeCalendar>). */
function PeriodSelect({ value, onChange }: RegistryFiltersProps) {
  const slot = useDropdownSlot('period');
  const { from, to } = value;
  const range = !from && !to ? 'Период'
    : from && to ? `${shortDate(from)} – ${shortDate(to)}`
      : from ? `с ${shortDate(from)}` : `по ${shortDate(to)}`;

  return (
    <Dropdown
      {...slot}
      menuAlign="left"
      closeOnSelect={false}
      menu={(
        /* Ширины у этой панели нет: её задаёт сам <RangeCalendar> — два месяца,
           колонка окон и поля границ имеют собственный размер, и число здесь
           было бы вторым источником правды. */
        <MenuPanel
          footer={(
            <>
              <Button
                variant="secondary"
                disabled={!from && !to}
                onClick={() => onChange({ ...value, from: '', to: '' })}
              >
                Очистить период
              </Button>
              <Button variant="primary" onClick={slot.onClose}>Готово</Button>
            </>
          )}
        >
          <RangeCalendar
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) => onChange({ ...value, from: nextFrom, to: nextTo })}
          />
        </MenuPanel>
      )}
    >
      {(trigger) => (
        <IconButton
          {...trigger}
          variant="topbar"
          icon="calendarSm"
          label={from || to ? `Период: ${range}` : 'Период'}
          active={Boolean(from || to)}
          badge={from || to ? <span className={s.btnDot} /> : null}
        />
      )}
    </Dropdown>
  );
}

/**
 * Полоса фильтров над таблицей реестра.
 *
 * КОГДА:  плотная таблица, у которой больше одного среза; ставится между
 *         вкладками и таблицей, в той же колонке контента (12px от края).
 * НЕ ДЛЯ: переключения экрана — это <SecondaryHeader> с вкладками; и не для
 *         поиска по всему пространству — тот живёт в топбаре (SearchTrigger).
 *
 * UX:     ЧЕТЫРЕ КОНТРОЛА, А НЕ СЕМЬ. Портфель, проект, вид работ и
 *         ответственный ушли под одну кнопку «Фильтры»: это перечисления,
 *         которые открывают редко и надолго, и в полосе они занимали место
 *         пропорционально длине своих значений, а не важности. На полосе
 *         остались те, к которым возвращаются постоянно: поиск, статус,
 *         период.
 *         РАЗНЫЙ ВЕС: поиск — капсула во всю доступную ширину (вход в данные),
 *         период и «Фильтры» — кнопки-глифы 32×32, статус — селект с
 *         подписью, сброс появляется только когда есть что сбрасывать. Ряд
 *         одинаковых кнопок читался бы как забор.
 *         Все контролы — общие компоненты (<SearchInput>, <IconButton>,
 *         <Button>), своих копий полоса не заводит; собственного у неё только
 *         раскладка и индикаторы поверх кнопок без подписи.
 *         Меню мультивыбора НЕ закрываются по клику — closeOnSelect={false}:
 *         значения выбирают сериями, а выходят «Готово», Escape или кликом
 *         мимо.
 * A11Y:   у поиска подпись через aria-label (визуальная съела бы полосу);
 *         кнопки без текста несут состояние в подписи («Фильтры · 2»), потому
 *         что значок поверх кнопки скринридеру не виден: aria-label перебивает
 *         содержимое. Каждый триггер сам сообщает aria-expanded (это делает
 *         Dropdown).
 *
 * @example
 * <RegistryFilters value={filters} onChange={setFilters} />
 */
export function RegistryFilters({ value, onChange }: RegistryFiltersProps) {
  const active = activeCount(value);

  return (
    <DropdownGroup>
      <div className={s.filters} role="search">
        <SearchInput
          variant="capsule"
          value={value.q}
          onChange={(q) => onChange({ ...value, q })}
          placeholder="Поиск по номеру и названию"
          label="Поиск тендеров"
        />

        <PeriodSelect value={value} onChange={onChange} />
        <StatusSelect value={value} onChange={onChange} />

        {/* Хвост полосы: сброс и вход в остальные фильтры. «Фильтры» стоят
            последними справа — это не срез в один клик, а отдельное окно, и
            место у края отделяет их от быстрых фильтров слева. */}
        <div className={s.tail}>
          {active > 0 ? (
            <Button variant="secondary" onClick={() => onChange(EMPTY_FILTERS)}>
              <Icon name="closeCircle" className={s.resetIcon} />
              Сбросить всё
              <span className={s.resetCount}>{active}</span>
            </Button>
          ) : null}
          <FiltersPopover value={value} onChange={onChange} />
        </div>
      </div>
    </DropdownGroup>
  );
}
