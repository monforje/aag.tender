import { useState } from 'react';
import { Stack, Tabs, Text } from 'clickup-shell';

/** Вкладки ПОВЕРХНОСТЕЙ: внутри окна или боковика, не в шапке страницы. */
export const InPanel = () => {
  const [tab, setTab] = useState('bids');
  return (
    <Stack gap={3} style={{ width: 380 }}>
      <Tabs
        items={[
          { id: 'summary', label: 'Сводка' },
          { id: 'bids', label: 'Предложения' },
          { id: 'log', label: 'Журнал' },
        ]}
        value={tab}
        onChange={setTab}
        aria-label="Разделы досье"
      />
      <Text size="sm" tone="secondary">
        {tab === 'summary' && 'Реквизиты подрядчика, история участия.'}
        {tab === 'bids' && 'Четыре КП, последнее — 14.06.2026.'}
        {tab === 'log' && 'Кто и когда менял позиции сметы.'}
      </Text>
    </Stack>
  );
};