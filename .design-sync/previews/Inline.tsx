import { Badge, Button, Inline, Stack, Text } from 'clickup-shell';
/** Ряд контролов: одна ступень шкалы на всю полосу. */
export const Toolbar = () => (
  <Stack gap={4}>
    <Inline gap={2} align="center">
      <Button variant="primary">Создать</Button>
      <Button variant="secondary">Экспорт</Button>
      <Button variant="secondary">Фильтры</Button>
    </Inline>
    <Inline gap={3} align="center">
      <Text weight="semibold">T-2026-014</Text>
      <Badge tone="info" icon="activity">Открыт</Badge>
      <Text size="sm" tone="secondary">до 15.07.2026</Text>
    </Inline>
  </Stack>
);
/** align="baseline" — когда в ряду разный кегль. */
export const Baseline = () => (
  <Stack gap={3}>
    <Inline gap={2} align="center" style={{ border: '1px dashed rgba(0,0,0,.16)', padding: 8 }}>
      <Text size="md" weight="semibold">3 695 200 ₽</Text><Text size="xs" tone="tertiary">align=&quot;center&quot;</Text>
    </Inline>
    <Inline gap={2} align="baseline" style={{ border: '1px dashed rgba(0,0,0,.16)', padding: 8 }}>
      <Text size="md" weight="semibold">3 695 200 ₽</Text><Text size="xs" tone="tertiary">align=&quot;baseline&quot;</Text>
    </Inline>
  </Stack>
);
/** wrap — полоса, которая честно переносится. */
export const Wrap = () => (
  <div style={{ width: 300 }}>
    <Inline gap={2} wrap align="center">
      {['Кровля', 'Фасад', 'Наружные сети', 'Инженерия', 'Проектирование', 'Демонтаж'].map((t) => (
        <Badge key={t} tone="neutral" icon="list">{t}</Badge>
      ))}
    </Inline>
  </div>
);
