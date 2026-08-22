import { IconButton, Inline, Stack, Text, VisuallyHidden } from 'clickup-shell';

/** Текст только для скринридера: на экране его нет, в дереве доступности есть. */
export const InButton = () => (
  <Stack gap={3}>
    <Inline gap={3} align="center">
      <IconButton icon="star" label="В избранное" variant="page" />
      <Text size="sm" tone="secondary">
        Кнопка без подписи. <VisuallyHidden>Добавить тендер T-2026-014 в избранное</VisuallyHidden>
        Полная формулировка уехала в VisuallyHidden — на макете её нет, скринридер её читает.
      </Text>
    </Inline>
  </Stack>
);

/** Подпись к значению, которое зрячий читает по колонке, а слепой — нет. */
export const ColumnContext = () => (
  <Stack gap={2}>
    <Text size="sm" tone="secondary">Ячейка таблицы сравнения</Text>
    <Text weight="semibold">
      1 190 500 ₽
      <VisuallyHidden>, ГК «Высота», минимальная цена по позиции</VisuallyHidden>
    </Text>
    <Text size="xs" tone="tertiary">
      Курсивом на экране ничего не добавлено — контекст колонки озвучивается только вслух.
    </Text>
  </Stack>
);
