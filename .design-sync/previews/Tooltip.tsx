import { useEffect, useRef } from 'react';
import { IconButton, Inline, Stack, Text, Tooltip } from 'clickup-shell';

/* Пузырь появляется по наведению ИЛИ фокусу — в статичном снимке доступен
   только фокус, поэтому превью ставит его руками. Пауза 350 мс — та же. */
function Focused({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector('button')?.focus(); }, []);
  return <div ref={ref}>{children}</div>;
}

/** Подсказка над иконочной кнопкой: объяснение, без которого задача решается. */
export const OnIconButton = () => (
  <Stack gap={5} style={{ paddingTop: 80, paddingLeft: 120 }}>
    <Focused>
      <Tooltip text="Показать только позиции с аномалиями цен">
        <IconButton icon="filter" label="Фильтр аномалий" variant="topbar" />
      </Tooltip>
    </Focused>
    <Text size="sm" tone="secondary" leading="normal" style={{ maxWidth: 380 }}>
      Пауза 350 мс, пузырь встаёт над триггером и гаснет при скролле.
      Ячейки таблицы обслуживает CellPopup, панель по клику — Popover.
    </Text>
  </Stack>
);

/** Подсказка к значению — то же правило: без неё строка остаётся понятной. */
export const OnValue = () => (
  <Inline gap={2} align="baseline" style={{ paddingTop: 80, paddingLeft: 120 }}>
    <Tooltip text="Сумма позиций раздела без НДС"><Text weight="semibold">3 695 200 ₽</Text></Tooltip>
    <Text size="sm" tone="tertiary">Раздел 3 · Кровельные работы</Text>
  </Inline>
);
