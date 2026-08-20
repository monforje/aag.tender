import { useEffect, useRef, useState } from 'react';
import { cx } from '@/shared/lib/cx';
import { toggle } from '@/shared/lib/toggle';
import { Button } from '@/shared/ui/Button';
import { MenuCheckItem, MenuPanel } from '@/shared/ui/Dropdown';
import { SearchInput } from '@/shared/ui/SearchInput';
import s from './FacetFilter.module.css';

/** Критерий фильтра: поле и все значения, которые в нём ВСТРЕЧАЮТСЯ. Список
 *  собирается из самих данных, а не пишется руками, — тогда в меню не может
 *  появиться значение, которое ничего не найдёт, и не может пропасть то,
 *  которое в данных есть. */
export interface Facet {
  key: string;
  title: string;
  options: string[];
}

/** Что выбрано, по критериям. Плоская запись `ключ → значения` вместо
 *  доменного типа фильтров: компонент не должен знать, что у тендера есть
 *  портфель, а у счёта — контрагент. */
export type FacetValue = Record<string, string[]>;

/** Сколько значений рисуем разом. Дальше — не «ещё немного», а подсказка
 *  уточнить поиск: список на тысячу строк одинаково бесполезен и для мыши, и
 *  для DOM, а нужное значение находится тремя буквами. */
const MAX_VISIBLE = 50;

/**
 * Фасетный фильтр: слева критерии, справа их значения с поиском.
 *
 * КОГДА:  фильтр по нескольким полям, у каждого из которых МНОГО значений —
 *         столько, что в один список они не помещаются. Кладётся в
 *         <Dropdown menu={…} closeOnSelect={false}>.
 * НЕ ДЛЯ: двух-трёх значений на всё (тогда хватит списка <MenuCheckItem>
 *         прямо в меню, как у статуса) и не для одного поля — это просто
 *         селект.
 *
 * UX:     ДВЕ КОЛОНКИ, А НЕ СТОПКА: высота панели не зависит ни от числа
 *         критериев, ни от числа значений (разбор — в .module.css).
 *         ПОИСК ВНУТРИ КРИТЕРИЯ — главный механизм масштаба: тысячу
 *         контрагентов не листают, их набирают. Показываем первые 50
 *         совпадений и честно говорим, сколько осталось.
 *         ВЫБРАННОЕ ЗАКРЕПЛЕНО СВЕРХУ и отделено линией: иначе стоит начать
 *         печатать — и отмеченное уезжает из списка, а вместе с ним пропадает
 *         ощущение контроля.
 *         Значения выбирают сериями, поэтому меню не закрывается по клику —
 *         за это отвечает closeOnSelect={false} у <Dropdown>.
 * A11Y:   критерии — role="tab"/aria-selected (левая колонка это именно
 *         переключатель панелей), значения — role="menuitemcheckbox".
 *         Поиск получает фокус при открытии и при смене критерия: руки уже на
 *         клавиатуре, и первый же символ идёт в поле.
 *
 * @example
 * <FacetFilter open={open} onClose={close}
 *   facets={FACETS} value={picked} onChange={setPicked} />
 */
export function FacetFilter({ open, facets, value, onChange, onClose }: {
  /** Панель открыта — сигнал поставить фокус в поиск и сбросить прошлый запрос. */
  open: boolean;
  facets: Facet[];
  value: FacetValue;
  onChange: (next: FacetValue) => void;
  onClose: () => void;
}) {
  const [facetKey, setFacetKey] = useState(facets[0].key);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery('');
  }, [open, facetKey]);

  const facet = facets.find((f) => f.key === facetKey) ?? facets[0];
  const picked = value[facet.key] ?? [];
  const q = query.trim().toLowerCase();
  const matches = facet.options.filter((option) => !q || option.toLowerCase().includes(q));
  const pinned = matches.filter((option) => picked.includes(option));
  const rest = matches.filter((option) => !picked.includes(option));
  const hidden = Math.max(0, rest.length - MAX_VISIBLE);
  /** Сколько критериев задействовано — цифра на кнопке «Очистить всё». */
  const total = facets.filter((f) => (value[f.key] ?? []).length > 0).length;

  const row = (option: string) => (
    <MenuCheckItem
      key={option}
      checked={picked.includes(option)}
      onToggle={() => onChange({ ...value, [facet.key]: toggle(picked, option) })}
    >
      {option}
    </MenuCheckItem>
  );

  return (
    <MenuPanel
      className={s.fp}
      footer={(
        <>
          <Button
            variant="secondary"
            disabled={!total}
            onClick={() => onChange(Object.fromEntries(facets.map((f) => [f.key, []])))}
          >
            Очистить всё{total ? ` · ${total}` : ''}
          </Button>
          <Button variant="primary" onClick={onClose}>Готово</Button>
        </>
      )}
    >
      <div className={s.fpBody}>
        <div className={s.fpFacets} role="tablist" aria-label="Критерии">
          {facets.map((item) => {
            const count = (value[item.key] ?? []).length;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={item.key === facet.key}
                className={cx(s.fpFacet, item.key === facet.key && s.isOn)}
                onClick={() => setFacetKey(item.key)}
              >
                <span className={s.fpFacetTitle}>{item.title}</span>
                {count ? <span className={s.fpFacetCount}>{count}</span> : null}
              </button>
            );
          })}
        </div>

        <div className={s.fpValues}>
          <SearchInput
            variant="field"
            className={s.fpSearch}
            inputRef={searchRef}
            value={query}
            onChange={setQuery}
            placeholder={`Поиск: ${facet.title.toLowerCase()}`}
            label={`Поиск по критерию «${facet.title}»`}
            action={picked.length ? (
              <button
                type="button"
                className={s.fpClear}
                onClick={() => onChange({ ...value, [facet.key]: [] })}
              >
                Снять {picked.length}
              </button>
            ) : null}
          />

          <div className={s.fpList}>
            {pinned.map(row)}
            {pinned.length && rest.length ? <div className={s.fpDivider} /> : null}
            {rest.slice(0, MAX_VISIBLE).map(row)}
            {hidden > 0 ? <div className={s.fpHint}>Ещё {hidden} — уточните поиск</div> : null}
            {matches.length === 0 ? <div className={s.fpHint}>Ничего не найдено по «{query}»</div> : null}
          </div>
        </div>
      </div>
    </MenuPanel>
  );
}
