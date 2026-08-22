import { useState } from 'react';
import { Button, Dropdown, DropdownGroup, MenuItem, Text, Stack } from 'clickup-shell';

/** Два и более меню в одной полосе: группа следит, чтобы открытым был один. */
export const Toolbar = () => {
  const [open, setOpen] = useState<string | null>('metric');
  const close = () => setOpen(null);
  return (
    <Stack gap={2} style={{ height: 240, width: 560 }}>
      <Text size="sm" tone="secondary">Полоса сравнения: показатель и вид строк</Text>
      <DropdownGroup>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: 560 }}>
          <Dropdown
            open={open === 'metric'}
            onToggle={() => setOpen(open === 'metric' ? null : 'metric')}
            onClose={close}
            menu={(
              <>
                <MenuItem onSelect={close}>Сумма по позиции</MenuItem>
                <MenuItem checked onSelect={close}>Цена за единицу</MenuItem>
                <MenuItem onSelect={close}>Отклонение от медианы</MenuItem>
              </>
            )}
          >
            {(t) => <Button {...t} variant="secondary" on={open === 'metric'}>Цена за единицу</Button>}
          </Dropdown>
          <Dropdown
            open={open === 'rows'}
            onToggle={() => setOpen(open === 'rows' ? null : 'rows')}
            onClose={close}
            menu={(
              <>
                <MenuItem checked onSelect={close}>Все позиции</MenuItem>
                <MenuItem onSelect={close}>Только с аномалиями</MenuItem>
                <MenuItem onSelect={close}>Только с пробелами</MenuItem>
              </>
            )}
          >
            {(t) => <Button {...t} variant="secondary" on={open === 'rows'}>Все позиции</Button>}
          </Dropdown>
        </div>
      </DropdownGroup>
    </Stack>
  );
};
