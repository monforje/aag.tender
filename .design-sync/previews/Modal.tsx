import { Button, Inline, Modal, modalPart, Stack, Text } from 'clickup-shell';

/** Окно, ради которого прерывают работу: открытость — проп, а не ref.showModal(). */
export const Dossier = () => (
  <Modal open onClose={() => {}} label="Досье подрядчика">
    <div className={modalPart.head}>
      <Text weight="semibold" size="md">СтройМонтажСервис</Text>
      <Text size="sm" tone="secondary">ИНН 7728168971 · Москва</Text>
    </div>
    <Stack gap={3} style={{ padding: '4px 0 12px' }}>
      <Inline gap={5}>
        <Stack gap={1}><Text size="sm" tone="secondary">Тендеров выиграно</Text><Text weight="medium">7 из 19</Text></Stack>
        <Stack gap={1}><Text size="sm" tone="secondary">Средний срок</Text><Text weight="medium">42 дня</Text></Stack>
      </Inline>
      <Text size="sm" leading="normal" tone="secondary" style={{ maxWidth: 380 }}>
        Работает с 2014 года, специализация — кровля и фасад. Замечаний
        по качеству за последние три тендера нет.
      </Text>
    </Stack>
    <div className={modalPart.foot}>
      <Button variant="secondary">Закрыть</Button>
      <Button variant="primary">Открыть КП</Button>
    </div>
  </Modal>
);
