import { useLayoutEffect, useRef, useState } from 'react';
import { Button, MenuItem, MenuPanel, Popover, Stack, Text } from 'clickup-shell';

/* Панель падает ПРАВЫМ краем от правого края кнопки (--pop-right) и не
   переворачивается влево. Поэтому в превью, как и на экране, триггер стоит
   в хвосте полосы: у левого края панель шириной 232px вылезла бы за вьюпорт. */
function Anchored({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector('button');
    if (el) setAnchor(el.getBoundingClientRect());
  }, []);
  return (
    <>
      <div ref={ref} style={{ display: 'flex', justifyContent: 'flex-end', width: 560 }}>
        <Button variant="secondary" on>{label}</Button>
      </div>
      {anchor && <Popover anchor={anchor} onClose={() => {}} label={label}>{children}</Popover>}
    </>
  );
}

/** Легенда словаря пометок — кнопка в хвосте полосы сравнения. */
export const Legend = () => (
  <Stack gap={2} style={{ height: 260 }}>
    <Text size="sm" tone="secondary">Полоса сравнения КП</Text>
    <Anchored label="Легенда">
      <MenuPanel>
        <MenuItem icon="star" onSelect={() => {}}>Минимум по позиции</MenuItem>
        <MenuItem icon="flag" onSelect={() => {}}>Аномалия цены</MenuItem>
        <MenuItem icon="scale" onSelect={() => {}}>Запас для торга</MenuItem>
        <MenuItem icon="closeCircle" onSelect={() => {}}>Отказ подрядчика</MenuItem>
      </MenuPanel>
    </Anchored>
  </Stack>
);

/** Панель обязана выйти за пределы прокручиваемого родителя — за этим и <dialog>. */
export const OutOfScroll = () => (
  <Stack gap={2} style={{ height: 260 }}>
    <Text size="sm" tone="secondary" style={{ maxWidth: 420 }}>
      Родитель с overflow-x: auto обрезал бы обычное меню. Верхний слой
      &lt;dialog&gt; обрезке не подчиняется — к z-index это отношения не имеет.
    </Text>
    <div style={{ overflowX: 'auto', border: '1px dashed rgba(0,0,0,.16)', padding: 8 }}>
      <Anchored label="Фильтры">
        <MenuPanel footer={<Button variant="primary">Применить</Button>}>
          <MenuItem checked onSelect={() => {}}>Только с аномалиями</MenuItem>
          <MenuItem onSelect={() => {}}>Только с пробелами</MenuItem>
          <MenuItem onSelect={() => {}}>Только отказы</MenuItem>
        </MenuPanel>
      </Anchored>
    </div>
  </Stack>
);
