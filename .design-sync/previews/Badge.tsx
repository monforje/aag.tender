import { Badge, BID_STATUS, Inline, STATUS, STATUS_IDS, Stack, Text } from 'clickup-shell';

/** Все статусы тендера — из доменной таблицы STATUS: один статус, один тон, один глиф. */
export const TenderStatuses = () => (
  <Inline gap={2} wrap align="center">
    {STATUS_IDS.map((id) => (
      <Badge key={id} tone={STATUS[id].tone} icon={STATUS[id].icon}>{STATUS[id].label}</Badge>
    ))}
  </Inline>
);

/** Пять тонов шкалы. warning появился вместе со сравнением КП: у ранжира три деления. */
export const Tones = () => (
  <Inline gap={2} wrap align="center">
    <Badge tone="info" icon="activity">В работе</Badge>
    <Badge tone="success" icon="checkCircle">Принято</Badge>
    <Badge tone="warning" icon="clock">На уточнении</Badge>
    <Badge tone="danger" icon="closeCircle">Отклонено</Badge>
    <Badge tone="neutral" icon="documentText">Черновик</Badge>
  </Inline>
);

/** Статус КП подрядчика — вторая доменная таблица, та же капсула. */
export const BidStatuses = () => (
  <Stack gap={2}>
    <Text size="sm" tone="secondary">Статус коммерческого предложения</Text>
    <Inline gap={2} wrap align="center">
      {(['complete', 'revision', 'partial'] as const).map((id) => (
        <Badge key={id} tone={BID_STATUS[id].tone} icon={BID_STATUS[id].icon}>{BID_STATUS[id].label}</Badge>
      ))}
    </Inline>
  </Stack>
);

/** Без глифа капсула тоже работает, но цвет остаётся единственным каналом — так не надо. */
export const IconIsNotOptional = () => (
  <Stack gap={2}>
    <Inline gap={2} align="center">
      <Badge tone="success" icon="checkCircle">Закрыт</Badge>
      <Text size="sm" tone="secondary">— с глифом: два канала</Text>
    </Inline>
    <Inline gap={2} align="center">
      <Badge tone="success">Закрыт</Badge>
      <Text size="sm" tone="secondary">— без глифа: при дальтонизме неразличимо</Text>
    </Inline>
  </Stack>
);
