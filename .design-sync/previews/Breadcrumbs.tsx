import { Breadcrumbs, Stack, Text } from 'clickup-shell';

/** Крошки «родитель / текущий»: только на уровне 3+. */
export const TenderCard = () => (
  <Breadcrumbs
    links={[{ title: 'Тендеры', to: '/tenders' }, { title: 'Реестр тендеров', to: '/tenders/registry' }]}
    current="T-2026-014 · Устройство монолитного фундамента"
  />
);

/** Один родитель — минимальный случай. */
export const OneLevel = () => (
  <Stack gap={3}>
    <Breadcrumbs links={[{ title: 'Реестр тендеров', to: '/tenders/registry' }]} current="T-2026-031" />
    <Text size="xs" tone="tertiary">Последний сегмент не ссылка: это текущий экран.</Text>
  </Stack>
);
