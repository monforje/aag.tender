import { Button, ButtonGroup, Stack, Text } from 'clickup-shell';

/** joined — края слепляются, скругление остаётся только у крайних. */
export const Joined = () => (
  <Stack gap={3}>
    <Text size="sm" tone="secondary">Связанные действия одной природы</Text>
    <ButtonGroup joined>
      <Button variant="secondary">Сегодня</Button>
      <Button variant="secondary" on>Неделя</Button>
      <Button variant="secondary">Месяц</Button>
    </ButtonGroup>
  </Stack>
);

/** Без joined зазор берётся ступенью шкалы — той же, что у Inline. */
export const Spaced = () => (
  <ButtonGroup gap={2}>
    <Button variant="secondary">Экспорт</Button>
    <Button variant="secondary">Печать</Button>
    <Button variant="primary">Отправить</Button>
  </ButtonGroup>
);
