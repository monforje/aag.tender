import { Button, Stack, Text, ToastProvider, useToast } from 'clickup-shell';

function Inner() {
  const toast = useToast();
  return (
    <Stack gap={3}>
      <Text size="sm" tone="secondary">
        ToastProvider монтируется ОДИН раз рядом с корнем приложения — вьюпорт
        тостов живёт поверх всего, а useToast() работает из любого слоя ниже.
      </Text>
      <Button variant="primary" onClick={() => toast('Смета импортирована: 42 позиции')}>Импортировать смету</Button>
    </Stack>
  );
}

/** Провайдер и потребитель рядом: так это выглядит в app/index.tsx. */
export const Mounted = () => (
  <ToastProvider>
    <Inner />
  </ToastProvider>
);
