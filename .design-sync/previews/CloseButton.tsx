import { Alert, CloseButton, Card, Inline, Stack, Text } from 'clickup-shell';
/** Два варианта: inherit — на цветной подложке алерта, quiet — на панели. */
export const Variants = () => (
  <Stack gap={4} style={{ width: 420 }}>
    <Alert tone="warning" title="Разброс цен выше порога" onClose={() => {}}>
      Внутри Alert крестик уже стоит: вариант inherit наследует цвет тона.
    </Alert>
    <Card>
      <Inline gap={3} align="center" style={{ justifyContent: 'space-between' }}>
        <Text weight="medium">Панель фильтров</Text>
        <CloseButton variant="quiet" onClick={() => {}} label="Закрыть панель" />
      </Inline>
    </Card>
  </Stack>
);
