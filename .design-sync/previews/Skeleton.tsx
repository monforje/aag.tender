import { Card, Inline, Skeleton, Stack } from 'clickup-shell';

/** Заглушка повторяет КОНТУР будущего содержимого, а не абстрактный блок. */
export const RowsLoading = () => (
  <Stack gap={3} style={{ width: 420 }}>
    {[0, 1, 2, 3].map((i) => (
      <Inline key={i} gap={3} align="center">
        <Skeleton width={72} height={13} />
        <Skeleton width={200} height={13} />
        <Skeleton width={64} height={18} radius={9} />
      </Inline>
    ))}
  </Stack>
);

/** Карточка сводки в ожидании данных. */
export const CardLoading = () => (
  <Card>
    <Stack gap={4}>
      <Skeleton width={240} height={18} />
      <Inline gap={5}>
        <Stack gap={2}><Skeleton width={90} height={11} /><Skeleton width={150} height={14} /></Stack>
        <Stack gap={2}><Skeleton width={90} height={11} /><Skeleton width={130} height={14} /></Stack>
      </Inline>
    </Stack>
  </Card>
);
