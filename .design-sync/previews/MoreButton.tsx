import { Card, Inline, MoreButton, Stack, Text } from 'clickup-shell';
/** Пресет «⋯» над IconButton: меню второстепенных действий строки. */
export const InRow = () => (
  <Stack gap={2} style={{ width: 420 }}>
    {['Устройство кровли', 'Демонтажные работы', 'Монтаж ОВиК'].map((t, i) => (
      <Card key={t} padding={2}>
        <Inline gap={3} align="center" style={{ justifyContent: 'space-between' }}>
          <Text size="sm">{t}</Text>
          <MoreButton onClick={() => {}} active={i === 1} />
        </Inline>
      </Card>
    ))}
  </Stack>
);
