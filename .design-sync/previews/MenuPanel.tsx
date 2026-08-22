import { Button, MenuCheckItem, MenuItem, MenuPanel, Stack, Text } from 'clickup-shell';

/** Панель с подвалом: меню сложнее списка — мультивыбор и «Готово». */
export const WithFooter = () => (
  <Stack gap={2} style={{ width: 300 }}>
    <Text size="sm" tone="secondary">Мультивыбор до подтверждения</Text>
    <MenuPanel footer={<><Button variant="secondary">Очистить</Button><Button variant="primary">Готово</Button></>}>
      <MenuCheckItem checked onToggle={() => {}}>Строительство и СМР</MenuCheckItem>
      <MenuCheckItem checked={false} onToggle={() => {}}>Наружные сети</MenuCheckItem>
      <MenuCheckItem checked onToggle={() => {}}>Инженерные системы</MenuCheckItem>
    </MenuPanel>
  </Stack>
);

/** Без подвала — просто поверхность списка. */
export const Plain = () => (
  <div style={{ width: 300 }}>
    <MenuPanel>
      <MenuItem icon="grid" onSelect={() => {}}>Все разделы</MenuItem>
      <MenuItem icon="clock" onSelect={() => {}}>Недавние</MenuItem>
      <MenuItem icon="star" onSelect={() => {}}>Избранное</MenuItem>
    </MenuPanel>
  </div>
);
