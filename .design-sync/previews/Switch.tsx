import { useState } from 'react';
import { Inline, Stack, Switch, Text } from 'clickup-shell';

/** Режим, применяющийся сразу: подпись обязательна, отдельного «Готово» нет. */
export const Settings = () => {
  const [dense, setDense] = useState(true);
  const [zebra, setZebra] = useState(false);
  const [anomalies, setAnomalies] = useState(true);
  return (
    <Stack gap={3}>
      <Inline gap={3} align="center">
        <Switch checked={dense} onChange={setDense} aria-label="Плотные строки" />
        <Text>Плотные строки</Text>
      </Inline>
      <Inline gap={3} align="center">
        <Switch checked={zebra} onChange={setZebra} aria-label="Чередование строк" />
        <Text>Чередование строк</Text>
      </Inline>
      <Inline gap={3} align="center">
        <Switch checked={anomalies} onChange={setAnomalies} aria-label="Подсвечивать аномалии" />
        <Text>Подсвечивать аномалии цен</Text>
      </Inline>
    </Stack>
  );
};

/** Выключенный переключатель объясняется соседним текстом, а не сам собой. */
export const Disabled = () => (
  <Inline gap={3} align="center">
    <Switch checked={false} onChange={() => {}} disabled aria-label="Автосогласование" />
    <Stack gap={0}>
      <Text>Автосогласование КП</Text>
      <Text size="sm" tone="tertiary">Недоступно: нет прав на согласование</Text>
    </Stack>
  </Inline>
);
