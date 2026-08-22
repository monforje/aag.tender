import { useState } from 'react';
import { Field, Input, Stack, Textarea } from 'clickup-shell';

/** Подпись, контрол и подсказка: связки id/aria ставит контекст поля. */
export const WithHint = () => (
  <Stack gap={4} style={{ width: 380 }}>
    <Field label="Название тендера" required>
      <Input defaultValue="Устройство монолитного фундамента" />
    </Field>
    <Field label="Номер" hint="Формат T-ГГГГ-NNN. Присваивается автоматически при сохранении.">
      <Input placeholder="T-2026-000" />
    </Field>
  </Stack>
);

/** Ошибка вытесняет подсказку и объясняет, что именно не так. */
export const WithError = () => {
  const [v, setV] = useState('31.02.2026');
  return (
    <Stack gap={4} style={{ width: 380 }}>
      <Field label="Срок сбора КП" required error="Такой даты не существует — проверьте день месяца.">
        <Input value={v} onChange={(e) => setV(e.target.value)} />
      </Field>
      <Field label="Комментарий" hint="Виден только вашей команде.">
        <Textarea rows={3} />
      </Field>
    </Stack>
  );
};
