import { Button, Inline, Spinner, Stack, Text } from 'clickup-shell';

/** Два размера; цвет наследуется от родителя. */
export const Sizes = () => (
  <Inline gap={4} align="center">
    <Spinner size="sm" />
    <Spinner size="md" />
    <Text size="sm" tone="secondary">sm — внутри контрола, md — рядом с текстом</Text>
  </Inline>
);

/** Короткое ожидание внутри кнопки: цвет берётся у подписи. */
export const InControl = () => (
  <Stack gap={3}>
    <Button variant="primary"><Inline gap={2} align="center"><Spinner size="sm" />Отправляем КП…</Inline></Button>
    <Button variant="secondary"><Inline gap={2} align="center"><Spinner size="sm" />Пересчитываем</Inline></Button>
  </Stack>
);
