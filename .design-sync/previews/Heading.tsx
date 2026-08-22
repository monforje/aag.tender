import { Heading, Stack, Text } from 'clickup-shell';

/** Уровень — семантика документа, а не размер. */
export const Levels = () => (
  <Stack gap={4}>
    <Stack gap={1}>
      <Heading level={1}>Сравнение коммерческих предложений</Heading>
      <Text size="sm" tone="tertiary">level 1 — один на страницу. Заголовок ЭКРАНА берёт PageTitle, не он.</Text>
    </Stack>
    <Stack gap={1}>
      <Heading level={2}>Раздел 3. Кровельные работы</Heading>
      <Text size="sm" tone="tertiary">level 2 — разделы внутри страницы</Text>
    </Stack>
    <Stack gap={1}>
      <Heading level={3}>СтройМонтажСервис</Heading>
      <Text size="sm" tone="tertiary">level 3 — подзаголовок карточки</Text>
    </Stack>
  </Stack>
);

/** Обрезка одной строкой — для длинных названий в узкой колонке. */
export const Truncated = () => (
  <div style={{ width: 280, border: '1px dashed rgba(0,0,0,.16)', padding: 8 }}>
    <Heading level={3} truncate>
      Реконструкция кровли административного корпуса на улице Профсоюзной
    </Heading>
  </div>
);
