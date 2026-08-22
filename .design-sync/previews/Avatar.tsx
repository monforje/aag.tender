import { Avatar, AvatarGroup, Inline, Stack, Text } from 'clickup-shell';

/** Три варианта: пространство, человек, участник дерева. */
export const Variants = () => (
  <Stack gap={3}>
    <Inline gap={3} align="center"><Avatar variant="workspace">А</Avatar><Text size="sm" tone="secondary">workspace — воркспейс в топбаре</Text></Inline>
    <Inline gap={3} align="center"><Avatar variant="user">И</Avatar><Text size="sm" tone="secondary">user — текущий пользователь</Text></Inline>
    <Inline gap={3} align="center"><Avatar variant="tree">К</Avatar><Text size="sm" tone="secondary">tree — участник в дереве раздела</Text></Inline>
  </Stack>
);

/** Точка присутствия и поверхность, под которую подстраивается кольцо. */
export const OnlineAndSurface = () => (
  <Inline gap={4} align="center">
    <Avatar variant="user" online>И</Avatar>
    <Avatar variant="tree" surface="sidebar">К</Avatar>
    <Avatar variant="tree" surface="main">Т</Avatar>
  </Inline>
);

/** Список лиц: перекрытие в 8px, кольцо цвета поверхности, хвост «+N».
    Имена обязаны стоять рядом текстом — сам аватар декоративен. */
export const Group = () => (
  <Stack gap={4}>
    <Inline gap={3} align="center">
      <Text size="sm" tone="secondary" style={{ width: 92 }}>Участники</Text>
      <AvatarGroup surfaceColor="#fff">
        <Avatar variant="user">И</Avatar>
        <Avatar variant="user">К</Avatar>
        <Avatar variant="user">Т</Avatar>
      </AvatarGroup>
      <Text size="sm">Иванов, Ковалёва, Титов</Text>
    </Inline>
    <Inline gap={3} align="center">
      <Text size="sm" tone="secondary" style={{ width: 92 }}>Подрядчики</Text>
      <AvatarGroup max={3} surfaceColor="#fff">
        <Avatar variant="user">С</Avatar>
        <Avatar variant="user">В</Avatar>
        <Avatar variant="user">Р</Avatar>
        <Avatar variant="user">Э</Avatar>
        <Avatar variant="user">М</Avatar>
      </AvatarGroup>
      <Text size="sm">и ещё двое</Text>
    </Inline>
  </Stack>
);
