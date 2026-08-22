import { useState } from 'react';
import { MenuCheckItem, MenuPanel, STATUS, STATUS_IDS, Stack, Text } from 'clickup-shell';

/** Мультивыбор значений: квадрат-галочка, выбирают сериями. */
export const Multi = () => {
  const [picked, setPicked] = useState<string[]>(['smr', 'net']);
  const OPTIONS = [
    { id: 'smr', label: 'Строительство и СМР' },
    { id: 'net', label: 'Наружные сети' },
    { id: 'eng', label: 'Инженерные системы' },
    { id: 'des', label: 'Проектирование' },
  ];
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Stack gap={2} style={{ width: 280 }}>
      <Text size="sm" tone="secondary">Вид работ</Text>
      <MenuPanel>
        {OPTIONS.map((o) => (
          <MenuCheckItem key={o.id} checked={picked.includes(o.id)} onToggle={() => toggle(o.id)}>
            {o.label}
          </MenuCheckItem>
        ))}
      </MenuPanel>
    </Stack>
  );
};

/** С тоном и глифом — фильтр по статусу читается тем же цветом, что и Badge. */
export const WithTone = () => {
  const [picked, setPicked] = useState<string[]>(['open']);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Stack gap={2} style={{ width: 280 }}>
      <Text size="sm" tone="secondary">Статус</Text>
      <MenuPanel>
        {STATUS_IDS.map((id) => (
          <MenuCheckItem
            key={id}
            checked={picked.includes(id)}
            onToggle={() => toggle(id)}
            tone={STATUS[id].tone}
            icon={STATUS[id].icon}
          >
            {STATUS[id].label}
          </MenuCheckItem>
        ))}
      </MenuPanel>
    </Stack>
  );
};
