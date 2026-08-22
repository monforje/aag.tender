import { useState } from 'react';
import { Input, Stack, Text, Textarea } from 'clickup-shell';

/** Поверхность поля — та же, что у вторичной кнопки: 32px, рамка, радиус 6. */
export const SingleLine = () => {
  const [v, setV] = useState('Устройство монолитного фундамента');
  return (
    <Stack gap={3}>
      <Input value={v} onChange={(e) => setV(e.target.value)} />
      <Input placeholder="Номер тендера" />
      <Input value="ООО «Северный-Девелопмент»" readOnly />
      <Input placeholder="Недоступно" disabled />
    </Stack>
  );
};

/** Многострочный собрат на той же поверхности. */
export const MultiLine = () => (
  <Stack gap={2}>
    <Text size="sm" tone="secondary">Комментарий к позиции</Text>
    <Textarea
      rows={4}
      defaultValue={'Подрядчик уточнил объём: 1 240 м² вместо 1 180 м².\nЦена за единицу не менялась.'}
      style={{ width: 380 }}
    />
  </Stack>
);
