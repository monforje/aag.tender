import { useState } from 'react';
import { Grid, InlineInput, Stack, Text } from 'clickup-shell';

/* Проп label уходит в aria-label и НЕ рисуется: в покое поле обязано
   выглядеть текстом. Видимую подпись ставит потребитель — так же, как её
   ставит сводка тендера. */
function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return <Stack gap={1}><Text size="sm" tone="secondary">{label}</Text>{children}</Stack>;
}

/** Сводка тендера: четыре поля сеткой, все правятся на месте. */
export const Summary = () => {
  const [customer, setCustomer] = useState('ООО «Северный-Девелопмент»');
  const [owner, setOwner] = useState('Иванов Иван Иванович');
  const [kind, setKind] = useState('Строительство и СМР');
  const [portfolio, setPortfolio] = useState('Жилой комплекс «Северный»');
  return (
    <Stack gap={3} style={{ width: 480 }}>
      <Text size="sm" tone="tertiary" leading="normal">
        Ни рамки, ни заливки: сводку в первую очередь ЧИТАЮТ. Заливка приходит
        по наведению, кольцо — по фокусу.
      </Text>
      <Grid gap={4} columns={2}>
        <LabeledField label="Заказчик"><InlineInput label="Заказчик" value={customer} onChange={setCustomer} /></LabeledField>
        <LabeledField label="Ответственный"><InlineInput label="Ответственный" value={owner} onChange={setOwner} /></LabeledField>
        <LabeledField label="Вид работ"><InlineInput label="Вид работ" value={kind} onChange={setKind} /></LabeledField>
        <LabeledField label="Портфель"><InlineInput label="Портфель" value={portfolio} onChange={setPortfolio} /></LabeledField>
      </Grid>
    </Stack>
  );
};

/** Без onChange поле неуправляемое — правка живёт до перезагрузки. */
export const Uncontrolled = () => (
  <Grid gap={4} columns={2} style={{ width: 480 }}>
    <LabeledField label="Срок сбора КП"><InlineInput label="Срок сбора КП" value="15.07.2026" /></LabeledField>
    <LabeledField label="Номер"><InlineInput label="Номер" value="T-2026-014" /></LabeledField>
  </Grid>
);
