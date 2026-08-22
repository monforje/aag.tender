import { Badge, Button, Divider, Drawer, drawerPart, Inline, Stack, Text } from 'clickup-shell';

/** Боковая панель: детали записи РЯДОМ со списком, работа не прерывается. */
export const Details = () => (
  <Drawer open onClose={() => {}} label="Детали позиции">
    <div className={drawerPart.head}>
      <Text weight="semibold" size="md">Устройство пароизоляции</Text>
      <Text size="sm" tone="secondary">Раздел 3 · Кровельные работы</Text>
    </div>
    <Stack gap={4} style={{ padding: '12px 0' }}>
      <Inline gap={3} align="center">
        <Text size="sm" tone="secondary" style={{ width: 120 }}>Объём</Text>
        <Text weight="medium">1 240 м²</Text>
      </Inline>
      <Inline gap={3} align="center">
        <Text size="sm" tone="secondary" style={{ width: 120 }}>Медиана</Text>
        <Text weight="medium">412 800 ₽</Text>
      </Inline>
      <Inline gap={3} align="center">
        <Text size="sm" tone="secondary" style={{ width: 120 }}>Разброс</Text>
        <Badge tone="warning" icon="flag">24%</Badge>
      </Inline>
      <Divider />
      <Text size="sm" leading="normal" tone="secondary">
        Три КП из четырёх укладываются в ±6% от медианы. Четвёртое выше на 24% —
        подрядчик указал другой тип материала.
      </Text>
    </Stack>
    <div className={drawerPart.foot}>
      <Button variant="secondary">Закрыть</Button>
    </div>
  </Drawer>
);
