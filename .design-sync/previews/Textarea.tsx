import { useState } from 'react';
import { Field, Stack, Text, Textarea } from 'clickup-shell';

/** Та же поверхность, что у Input: многострочный собрат, а не другой контрол. */
export const Basic = () => {
  const [v, setV] = useState('Подрядчик уточнил объём: 1 240 м² вместо 1 180 м².\nЦена за единицу не менялась.');
  return (
    <Stack gap={2} style={{ width: 400 }}>
      <Text size="sm" tone="secondary">Комментарий к позиции</Text>
      <Textarea rows={4} value={v} onChange={(e) => setV(e.target.value)} />
    </Stack>
  );
};

/** В форме — внутри Field: подпись и подсказка приходят оттуда. */
export const InField = () => (
  <div style={{ width: 400 }}>
    <Field label="Причина отклонения КП" required hint="Текст уйдёт подрядчику вместе с уведомлением.">
      <Textarea rows={3} placeholder="Опишите, что именно не устроило" />
    </Field>
  </div>
);

/** Пустое и заблокированное состояния. */
export const States = () => (
  <Stack gap={3} style={{ width: 400 }}>
    <Textarea rows={2} placeholder="Пусто — плейсхолдер объясняет, что писать" />
    <Textarea rows={2} defaultValue="Согласовано без замечаний." disabled />
  </Stack>
);
