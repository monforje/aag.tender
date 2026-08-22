import { useState } from 'react';
import { NestedTreeNode, Stack } from 'clickup-shell';
/** Родитель + дети + линия + тоггл: узел, у которого свой экран есть и у родителя. */
export const Expanded = () => {
  const [open, setOpen] = useState(true);
  return (
    <Stack gap={0} style={{ width: 280, padding: 8, background: '#fafafa', borderRadius: 8 }}>
      <NestedTreeNode
        parent={{ id: 'tenders', title: 'Тендеры', icon: 'clipboardList' }}
        expanded={open}
        activeId="registry"
        onToggle={() => setOpen((v) => !v)}
        onSelect={() => {}}
      >
        {[
          { id: 'registry', title: 'Реестр тендеров', count: 24, countMuted: true },
          { id: 'bids', title: 'Коммерческие предложения', count: 3 },
          { id: 'compare', title: 'Сравнение КП' },
        ]}
      </NestedTreeNode>
    </Stack>
  );
};
/** Свёрнутый узел: дети спрятаны, подсветка ушла на родителя. */
export const Collapsed = () => (
  <Stack gap={0} style={{ width: 280, padding: 8, background: '#fafafa', borderRadius: 8 }}>
    <NestedTreeNode
      parent={{ id: 'tenders', title: 'Тендеры', icon: 'clipboardList' }}
      expanded={false}
      activeId="tenders"
      onToggle={() => {}}
      onSelect={() => {}}
    >
      {[
        { id: 'registry', title: 'Реестр тендеров' },
        { id: 'bids', title: 'Коммерческие предложения' },
      ]}
    </NestedTreeNode>
  </Stack>
);
