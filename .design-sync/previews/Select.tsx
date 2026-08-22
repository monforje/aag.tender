import { useState } from 'react';
import { Select, Stack, Text } from 'clickup-shell';

const KINDS = [
  { value: 'smr', label: 'Строительство и СМР' },
  { value: 'net', label: 'Наружные сети' },
  { value: 'eng', label: 'Инженерные системы' },
  { value: 'des', label: 'Проектирование' },
  { value: 'sup', label: 'Поставка материалов', disabled: true },
] as const;

/** Триггер повторяет поверхность поля: в форме селект обязан читаться полем. */
export const Closed = () => {
  const [v, setV] = useState<string>('smr');
  return (
    <Stack gap={3} style={{ width: 300 }}>
      <Select options={KINDS} value={v} onChange={setV} />
      <Select options={KINDS} value={''} onChange={setV} placeholder="Вид работ не выбран" />
      <Select options={KINDS} value={'net'} onChange={setV} disabled />
    </Stack>
  );
};

/** С «Очистить»: выбор снимается, поле возвращается к плейсхолдеру. */
export const Clearable = () => {
  const [v, setV] = useState<string>('eng');
  return (
    <Stack gap={2} style={{ width: 300 }}>
      <Text size="sm" tone="secondary">Вид работ</Text>
      <Select options={KINDS} value={v} onChange={setV} onClear={() => setV('')} placeholder="Любой" />
    </Stack>
  );
};
