import { Counter, IconButton, Inline, Stack, Text } from 'clickup-shell';

/** Четыре поверхности. В покое кнопка прозрачна, поэтому рядом с каждой —
    та же кнопка в состоянии active: только так видно радиус и заливку. */
export const Surfaces = () => (
  <Stack gap={3}>
    <Inline gap={3} align="center">
      <IconButton icon="calendar" label="Календарь" variant="topbar" />
      <IconButton icon="calendar" label="Календарь" variant="topbar" active />
      <Text size="sm" tone="secondary">topbar — 28px, радиус 7</Text>
    </Inline>
    <Inline gap={3} align="center">
      <IconButton icon="settings" label="Настройки" variant="panel" />
      <IconButton icon="settings" label="Настройки" variant="panel" active />
      <Text size="sm" tone="secondary">panel — контрол панели</Text>
    </Inline>
    <Inline gap={3} align="center">
      <IconButton icon="ellipsis" label="Ещё" variant="page" />
      <IconButton icon="ellipsis" label="Ещё" variant="page" active />
      <Text size="sm" tone="secondary">page — действие на холсте страницы</Text>
    </Inline>
    <Inline gap={3} align="center" style={{ background: 'rgb(38,38,38)', padding: 8, borderRadius: 8 }}>
      <IconButton icon="home" label="Главная" variant="rail" />
      <IconButton icon="grid" label="Разделы" variant="rail" active />
      <Text size="sm" style={{ color: 'rgba(255,255,255,.7)' }}>rail — 32px, радиус 8, на тёмном</Text>
    </Inline>
  </Stack>
);

/** active — «мы здесь»: собственная заливка в покое, поэтому hover шагает на ступень выше. */
export const Active = () => (
  <Inline gap={2} align="center">
    <IconButton icon="filter" label="Фильтры" variant="topbar" />
    <IconButton icon="filter" label="Фильтры" variant="topbar" active />
  </Inline>
);

/** Бейдж поверх кнопки — счётчик уведомлений в топбаре. */
export const WithBadge = () => (
  <Inline gap={3} align="center">
    <IconButton icon="bell" label="Уведомления" variant="topbar" badge={<Counter>3</Counter>} />
    <IconButton icon="inbox" label="Входящие" variant="topbar" badge={<Counter muted>12</Counter>} />
  </Inline>
);
