import { useState } from 'react';
import { Segmented, Stack, Text } from 'clickup-shell';

/** Режимы сравнения: отмеченная опция наливается тоном СВОЕГО режима. */
export const Presets = () => {
  const [value, setValue] = useState('anomalies');
  return (
    <Stack gap={2}>
      <Text size="sm" tone="secondary">Пресет сравнения</Text>
      <Segmented
        label="Пресет сравнения"
        value={value}
        onChange={setValue}
        options={[
          { id: 'all', label: 'Все', icon: 'list' },
          { id: 'anomalies', label: 'Аномалии', tone: 'danger', icon: 'flag' },
          { id: 'gaps', label: 'Пробелы', tone: 'warning', icon: 'clock' },
          { id: 'best', label: 'Минимумы', tone: 'success', icon: 'checkCircle' },
        ]}
      />
    </Stack>
  );
};

/** Два режима без тона — тихий трек, отмеченная просто заливается. */
export const Two = () => {
  const [value, setValue] = useState('sum');
  return (
    <Segmented
      label="Показатель"
      value={value}
      onChange={setValue}
      options={[{ id: 'sum', label: 'Сумма' }, { id: 'unit', label: 'За единицу' }]}
    />
  );
};
