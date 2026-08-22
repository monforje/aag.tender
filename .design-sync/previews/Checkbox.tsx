import { useState } from 'react';
import { Checkbox, Stack, Text } from 'clickup-shell';

/** Три состояния нативного инпута под коробкой. */
export const States = () => (
  <Stack gap={2}>
    <Checkbox defaultChecked={false}>Только мои тендеры</Checkbox>
    <Checkbox defaultChecked>Показывать закрытые</Checkbox>
    <Checkbox indeterminate defaultChecked={false}>Выбраны не все позиции</Checkbox>
    <Checkbox disabled>Архив (нет доступа)</Checkbox>
  </Stack>
);

/** Управляемый список: отметка до «Готово», а не мгновенное действие. */
export const Controlled = () => {
  const [picked, setPicked] = useState<string[]>(['smr']);
  const OPTIONS = [
    { id: 'smr', label: 'Строительство и СМР' },
    { id: 'net', label: 'Наружные сети' },
    { id: 'eng', label: 'Инженерные системы' },
    { id: 'des', label: 'Проектирование' },
  ];
  return (
    <Stack gap={2}>
      <Text size="sm" tone="secondary">Вид работ</Text>
      {OPTIONS.map((o) => (
        <Checkbox
          key={o.id}
          checked={picked.includes(o.id)}
          onChange={() => setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))}
        >
          {o.label}
        </Checkbox>
      ))}
    </Stack>
  );
};
