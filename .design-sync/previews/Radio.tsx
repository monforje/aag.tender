import { useState } from 'react';
import { Radio, RadioGroup, Stack, Text } from 'clickup-shell';

/** Группа даёт name, значение и подпись для скринридера — Radio сам по себе не ставится. */
export const Group = () => {
  const [value, setValue] = useState('all');
  return (
    <RadioGroup label="Срез реестра" value={value} onChange={setValue}>
      <Radio value="all">Все тендеры</Radio>
      <Radio value="mine">Только мои</Radio>
      <Radio value="due">С истекающим сроком</Radio>
    </RadioGroup>
  );
};

/** Зазор — ступень шкалы; горизонтальную полосу собирают тем же gap. */
export const Spacing = () => {
  const [value, setValue] = useState('sum');
  return (
    <Stack gap={3}>
      <Text size="sm" tone="secondary">Показатель сравнения</Text>
      <RadioGroup label="Показатель" value={value} onChange={setValue} gap={1}>
        <Radio value="sum">Сумма</Radio>
        <Radio value="unit">Цена за единицу</Radio>
        <Radio value="dev">Отклонение от медианы</Radio>
      </RadioGroup>
    </Stack>
  );
};
