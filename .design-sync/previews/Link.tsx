import { Inline, Link, Stack, Text } from 'clickup-shell';

/** to — маршрут приложения, href — внешний адрес со стрелкой и rel. */
export const Kinds = () => (
  <Stack gap={3}>
    <Link to="/tenders/registry">Реестр тендеров</Link>
    <Link href="https://zakupki.gov.ru">Карточка закупки в ЕИС</Link>
    <Link href="https://zakupki.gov.ru" externalIcon={false}>Тот же адрес без стрелки</Link>
  </Stack>
);

/** В потоке текста: ссылка не меняет данные — действие берёт Button. */
export const InText = () => (
  <Text as="p" leading="normal" style={{ maxWidth: 420 }}>
    Три подрядчика прислали КП до срока. Четвёртый запросил перенос —
    решение фиксируется в <Link to="/tenders/registry">карточке тендера</Link>,
    исходная закупка опубликована <Link href="https://zakupki.gov.ru">в ЕИС</Link>.
  </Text>
);

/** Рядом с номером записи — самая частая ссылка реестра. */
export const InRow = () => (
  <Inline gap={2} align="baseline">
    <Link to="/tenders/registry/T-2026-014">T-2026-014</Link>
    <Text tone="secondary">Устройство монолитного фундамента</Text>
  </Inline>
);
