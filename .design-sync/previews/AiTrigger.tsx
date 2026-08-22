import { AiTrigger, Stack, Text } from 'clickup-shell';
/** Бирка «Анализ ИИ»: темп шиммера = состояние. */
export const States = () => (
  <Stack gap={4} style={{ paddingTop: 8 }}>
    <Stack gap={1}>
      <Text size="sm" tone="secondary">покой</Text>
      <div style={{ position: 'relative', height: 32 }}>
        <AiTrigger open={false} controlsId="dock-1" onToggle={() => {}} />
      </div>
    </Stack>
    <Stack gap={1}>
      <Text size="sm" tone="secondary">генерирует</Text>
      <div style={{ position: 'relative', height: 32 }}>
        <AiTrigger open={false} thinking controlsId="dock-2" onToggle={() => {}} />
      </div>
    </Stack>
    <Stack gap={1}>
      <Text size="sm" tone="secondary">compact — липкая шапка встала на ту же линию</Text>
      <div style={{ position: 'relative', height: 32 }}>
        <AiTrigger open={false} compact controlsId="dock-3" onToggle={() => {}} />
      </div>
    </Stack>
  </Stack>
);
