import { useState } from 'react';
import { Radio, RadioGroup, Stack, Text } from 'clickup-shell';

/** Группа держит name, значение и подпись для скринридера: 2–4 варианта, всегда видимых. */
export const Basic = () => {
  const [value, setValue] = useState('mine');
  return (
    <RadioGroup label="Срез реестра" value={value} onChange={setValue}>
      <Radio value="all">Все тендеры</Radio>
      <Radio value="mine">Только мои</Radio>
      <Radio value="due">С истекающим сроком</Radio>
    </RadioGroup>
  );
};

/** Плотная группа: gap — ступень шкалы, не пиксели. */
export const Dense = () => {
  const [value, setValue] = useState('unit');
  return (
    <Stack gap={3}>
      <Text size="sm" tone="secondary">Показатель сравнения</Text>
      <RadioGroup label="Показатель" value={value} onChange={setValue} gap={1}>
        <Radio value="sum">Сумма по позиции</Radio>
        <Radio value="unit">Цена за единицу</Radio>
        <Radio value="dev">Отклонение от медианы</Radio>
      </RadioGroup>
    </Stack>
  );
};

/** Больше четырёх вариантов — это уже Select; здесь показан потолок. */
export const AtTheLimit = () => {
  const [value, setValue] = useState('week');
  return (
    <RadioGroup label="Период" value={value} onChange={setValue}>
      <Radio value="today">Сегодня</Radio>
      <Radio value="week">Неделя</Radio>
      <Radio value="month">Месяц</Radio>
      <Radio value="quarter">Квартал</Radio>
    </RadioGroup>
  );
};
