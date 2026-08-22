import { Badge, Card, Grid, Heading, Inline, Stack, Text } from 'clickup-shell';

/** Белая поверхность на холсте: хэйрлайн-край, радиус 12. */
export const Basic = () => (
  <Card>
    <Stack gap={2}>
      <Heading level={3}>Устройство кровли</Heading>
      <Text size="sm" tone="secondary">Жилой комплекс «Северный» · Корпус 2</Text>
    </Stack>
  </Card>
);

/** Сводка тендера: четыре поля сеткой 2×2 — раскладка карточки тендера. */
export const Summary = () => (
  <Card>
    <Stack gap={4}>
      <Inline gap={3} align="center">
        <Heading level={3}>Устройство монолитного фундамента</Heading>
        <Badge tone="info" icon="activity">Открыт</Badge>
      </Inline>
      <Grid gap={4} columns={2}>
        <Stack gap={1}><Text size="sm" tone="secondary">Заказчик</Text><Text weight="medium">ООО «Северный-Девелопмент»</Text></Stack>
        <Stack gap={1}><Text size="sm" tone="secondary">Ответственный</Text><Text weight="medium">Иванов Иван Иванович</Text></Stack>
        <Stack gap={1}><Text size="sm" tone="secondary">Срок сбора КП</Text><Text weight="medium">15.07.2026</Text></Stack>
        <Stack gap={1}><Text size="sm" tone="secondary">Вид работ</Text><Text weight="medium">Строительство и СМР</Text></Stack>
      </Grid>
    </Stack>
  </Card>
);

/** padding=0 — карточка отдаёт край содержимому (таблица, изображение). */
export const NoPadding = () => (
  <Card padding={0}>
    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
      <Text weight="semibold">Позиции сметы</Text>
    </div>
    <div style={{ padding: '12px 16px' }}>
      <Text size="sm" tone="secondary">42 позиции в 6 разделах</Text>
    </div>
  </Card>
);
