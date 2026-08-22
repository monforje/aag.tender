import { Icon, Inline, Stack, Text } from 'clickup-shell';

const NAMES = ['home', 'calendar', 'search', 'bell', 'inbox', 'settings', 'filter', 'list',
  'clock', 'activity', 'checkCircle', 'closeCircle', 'documentText', 'star', 'flag', 'layers'] as const;

/** Глифы спрайта: имена — id из эталона, а не имена Solar (search → Magnifier). */
export const Glyphs = () => (
  <Stack gap={3}>
    <Text size="sm" tone="secondary">Размер и толщина задаются CSS (--icon-size), а не пропами</Text>
    <Inline gap={4} wrap align="center">
      {NAMES.map((n) => (
        <Stack key={n} gap={1} align="center">
          <Icon name={n} />
          <Text size="xs" tone="tertiary">{n}</Text>
        </Stack>
      ))}
    </Inline>
  </Stack>
);

/** Кегль глифа наследуется от переменной, поэтому иконка садится в строку любого размера. */
export const InText = () => (
  <Stack gap={2}>
    <Inline gap={1} align="center"><Icon name="clock" /><Text size="sm">Срок сбора КП истекает через 4 дня</Text></Inline>
    <Inline gap={1} align="center"><Icon name="checkCircle" /><Text>Все подрядчики прислали предложения</Text></Inline>
    <Inline gap={1} align="center" style={{ ['--icon-size' as string]: '20px' }}>
      <Icon name="star" /><Text size="md">Тендер в избранном</Text>
    </Inline>
  </Stack>
);
