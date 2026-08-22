import { Button, ButtonGroup, Inline, Stack, Text } from 'clickup-shell';

/** Три роли рядом: главная — ровно одна на панель, остальные вторичные. */
export const Roles = () => (
  <Inline gap={2} align="center">
    <Button variant="primary">Создать тендер</Button>
    <Button variant="secondary">Экспорт</Button>
    <Button variant="danger">Отозвать КП</Button>
  </Inline>
);

/** Флаг on — «здесь что-то выбрано»: заливка в покое, а не наведение. */
export const Selected = () => (
  <Inline gap={2} align="center">
    <Button variant="secondary">Статус</Button>
    <Button variant="secondary" on>Статус · 2</Button>
  </Inline>
);

/** Реальная полоса: главное действие отделено от группы вторичных. */
export const Toolbar = () => (
  <Stack gap={3}>
    <Text size="sm" tone="secondary">Полоса действий реестра</Text>
    <Inline gap={3} align="center">
      <Button variant="primary">Создать тендер</Button>
      <ButtonGroup joined>
        <Button variant="secondary">Сегодня</Button>
        <Button variant="secondary" on>Неделя</Button>
        <Button variant="secondary">Месяц</Button>
      </ButtonGroup>
    </Inline>
  </Stack>
);
