import { useState } from 'react';
import { Button, Dropdown, MenuItem, MenuPanel, Stack, Text } from 'clickup-shell';

/** Триггер — рендер-проп: компонент отдаёт готовые aria и клавиатуру. */
export const Menu = () => {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ height: 220, width: 560, display: "flex", justifyContent: "flex-end" }}>
      <Dropdown
        open={open}
        onToggle={() => setOpen((v) => !v)}
        onClose={() => setOpen(false)}
        menu={(
          <>
            <MenuItem icon="documentText" onSelect={() => {}}>Выгрузить смету</MenuItem>
            <MenuItem icon="share" onSelect={() => {}}>Отправить подрядчику</MenuItem>
            <MenuItem icon="clock" hint="Ctrl ⇧ D" onSelect={() => {}}>Продлить срок сбора</MenuItem>
            <MenuItem icon="closeCircle" disabled>Отменить тендер</MenuItem>
          </>
        )}
      >
        {(trigger) => <Button {...trigger} variant="secondary" on={open}>Действия</Button>}
      </Dropdown>
    </div>
  );
};

/** Мультивыбор — closeOnSelect={false}: значения выбирают сериями. */
export const MultiSelect = () => {
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<string[]>(['open']);
  const OPTIONS = [
    { id: 'open', label: 'Открыт' },
    { id: 'closed', label: 'Закрыт' },
    { id: 'cancelled', label: 'Отменён' },
    { id: 'draft', label: 'Черновик' },
  ];
  return (
    <div style={{ height: 260, width: 560, display: "flex", justifyContent: "flex-end" }}>
      <Dropdown
        open={open}
        closeOnSelect={false}
        onToggle={() => setOpen((v) => !v)}
        onClose={() => setOpen(false)}
        menu={(
          <MenuPanel footer={<Button variant="primary">Готово</Button>}>
            {OPTIONS.map((o) => (
              <MenuItem
                key={o.id}
                checked={picked.includes(o.id)}
                onSelect={() => setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))}
              >
                {o.label}
              </MenuItem>
            ))}
          </MenuPanel>
        )}
      >
        {(trigger) => <Button {...trigger} variant="secondary" on={open}>Статус · {picked.length}</Button>}
      </Dropdown>
    </div>
  );
};

/** Меню, прижатое к правому краю триггера. */
export const AlignRight = () => {
  const [open, setOpen] = useState(true);
  return (
    <Stack gap={2} style={{ height: 200, width: 560, alignItems: 'flex-end' }}>
      <Text size="sm" tone="secondary">menuAlign=&quot;right&quot; — когда триггер у правого края полосы</Text>
      <Dropdown
        open={open}
        menuAlign="right"
        onToggle={() => setOpen((v) => !v)}
        onClose={() => setOpen(false)}
        menu={(
          <>
            <MenuItem onSelect={() => {}}>Сумма по позиции</MenuItem>
            <MenuItem checked onSelect={() => {}}>Цена за единицу</MenuItem>
            <MenuItem onSelect={() => {}}>Отклонение от медианы</MenuItem>
          </>
        )}
      >
        {(trigger) => <Button {...trigger} variant="secondary" on={open}>Показатель</Button>}
      </Dropdown>
    </Stack>
  );
};
