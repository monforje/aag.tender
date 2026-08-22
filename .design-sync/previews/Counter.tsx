import { Counter, Inline, Stack, Text } from 'clickup-shell';

/** Два веса: розовый — уведомление (требует внимания), muted — просто количество. */
export const Weights = () => (
  <Stack gap={3}>
    <Inline gap={2} align="center"><Counter>3</Counter><Text size="sm" tone="secondary">уведомление</Text></Inline>
    <Inline gap={2} align="center"><Counter muted>24</Counter><Text size="sm" tone="secondary">количество в списке</Text></Inline>
  </Stack>
);

/** Рядом с пунктом: число не спорит с подписью за внимание. */
export const InRow = () => (
  <Stack gap={2}>
    <Inline gap={2} align="center"><Text>Реестр тендеров</Text><Counter muted>24</Counter></Inline>
    <Inline gap={2} align="center"><Text>Требуют решения</Text><Counter>3</Counter></Inline>
    <Inline gap={2} align="center"><Text>Архив</Text><Counter muted>118</Counter></Inline>
  </Stack>
);
