import { Inline, Kbd, Stack, Text } from 'clickup-shell';
/** Хоткей тихим текстом, без рамки-кейкапа: подсказка, а не клавиша. */
export const Shortcuts = () => (
  <Stack gap={2}>
    <Inline gap={2} align="center"><Text size="sm">Поиск по пространству</Text><Kbd>Ctrl K</Kbd></Inline>
    <Inline gap={2} align="center"><Text size="sm">Отправить КП</Text><Kbd>Ctrl ⇧ S</Kbd></Inline>
    <Inline gap={2} align="center"><Text size="sm">Закрыть панель</Text><Kbd>Esc</Kbd></Inline>
  </Stack>
);
