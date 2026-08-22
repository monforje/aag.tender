import { ScrollArea, Stack, Text, TreeRow } from 'clickup-shell';
/** variant="panel" — прокрутка внутри боковой панели. */
export const Panel = () => (
  <div style={{ height: 220, width: 260, background: '#fafafa', borderRadius: 8, overflow: 'hidden' }}>
    <ScrollArea variant="panel">
      <Stack gap={0} style={{ padding: 8 }}>
        {Array.from({ length: 14 }, (_, i) => (
          <TreeRow key={i} icon="clipboardList" title={`Тендер T-2026-0${(i + 10).toString()}`} onClick={() => {}} />
        ))}
      </Stack>
    </ScrollArea>
  </div>
);
/** variant="page" — прокрутка тела страницы под неподвижной шапкой. */
export const Page = () => (
  <div style={{ height: 220, width: 420, border: '1px solid rgba(0,0,0,.08)', borderRadius: 8, overflow: 'hidden' }}>
    <ScrollArea variant="page">
      <Stack gap={3} style={{ padding: 12 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <Text key={i} size="sm">Позиция сметы {i + 1} — устройство кровельного пирога</Text>
        ))}
      </Stack>
    </ScrollArea>
  </div>
);
