import { Card, Stack, Text } from 'clickup-shell';
/** Колонка с зазором ступенью шкалы — gap={3}, а не пиксели. */
export const Scale = () => (
  <Stack gap={5}>
    {[1, 2, 3, 4].map((g) => (
      <Stack key={g} gap={1}>
        <Text size="sm" tone="secondary">gap={g} — {[4, 8, 12, 16][g - 1]}px</Text>
        <Stack gap={g as 1}>
          <Card padding={2}><Text size="sm">Строка</Text></Card>
          <Card padding={2}><Text size="sm">Строка</Text></Card>
        </Stack>
      </Stack>
    ))}
  </Stack>
);
/** align управляет поперечной осью колонки. */
export const Align = () => (
  <Stack gap={4}>
    <Stack gap={2} align="start" style={{ border: '1px dashed rgba(0,0,0,.16)', padding: 8 }}>
      <Text size="sm" tone="secondary">align=&quot;start&quot;</Text>
      <Card padding={2}><Text size="sm">Узкая карточка</Text></Card>
    </Stack>
    <Stack gap={2} align="stretch" style={{ border: '1px dashed rgba(0,0,0,.16)', padding: 8 }}>
      <Text size="sm" tone="secondary">align=&quot;stretch&quot; — по умолчанию</Text>
      <Card padding={2}><Text size="sm">Тянется во всю ширину</Text></Card>
    </Stack>
  </Stack>
);
