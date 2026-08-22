import { MenuPanel, MenuItem, Stack, Text } from 'clickup-shell';

/** Строка-действие: глиф, подпись, подсказка хоткея, заблокированный вариант. */
export const Actions = () => (
  <Stack gap={3} style={{ width: 280 }}>
    <MenuPanel>
      <MenuItem icon="documentText" onSelect={() => {}}>Выгрузить смету</MenuItem>
      <MenuItem icon="share" hint="Ctrl ⇧ S" onSelect={() => {}}>Отправить подрядчику</MenuItem>
      <MenuItem icon="star" onSelect={() => {}}>В избранное</MenuItem>
      <MenuItem icon="closeCircle" disabled>Отменить тендер</MenuItem>
    </MenuPanel>
  </Stack>
);

/** checked превращает строку в радиопункт: одиночный выбор с галочкой. */
export const SingleChoice = () => (
  <Stack gap={2} style={{ width: 280 }}>
    <Text size="sm" tone="secondary">Показатель сравнения</Text>
    <MenuPanel>
      <MenuItem onSelect={() => {}}>Сумма по позиции</MenuItem>
      <MenuItem checked onSelect={() => {}}>Цена за единицу</MenuItem>
      <MenuItem onSelect={() => {}}>Отклонение от медианы</MenuItem>
    </MenuPanel>
  </Stack>
);
