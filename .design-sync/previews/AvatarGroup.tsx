import { Avatar, AvatarGroup, Inline, Stack, Text } from 'clickup-shell';
/** Аватары с перекрытием и кольцом под поверхность; имена стоят рядом текстом. */
export const Team = () => (
  <Stack gap={4}>
    <Inline gap={3} align="center">
      <Text size="sm" tone="secondary" style={{ width: 100 }}>Участники</Text>
      <AvatarGroup surfaceColor="#fff">
        <Avatar variant="user">И</Avatar><Avatar variant="user">К</Avatar><Avatar variant="user">Т</Avatar>
      </AvatarGroup>
      <Text size="sm">Иванов, Ковалёва, Титов</Text>
    </Inline>
    <Inline gap={3} align="center">
      <Text size="sm" tone="secondary" style={{ width: 100 }}>Подрядчики</Text>
      <AvatarGroup max={3} surfaceColor="#fff">
        <Avatar variant="user">С</Avatar><Avatar variant="user">В</Avatar>
        <Avatar variant="user">Р</Avatar><Avatar variant="user">Э</Avatar><Avatar variant="user">М</Avatar>
      </AvatarGroup>
      <Text size="sm">и ещё двое</Text>
    </Inline>
  </Stack>
);
