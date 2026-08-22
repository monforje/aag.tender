import { Stack, Text } from 'clickup-shell';

/** Кегль по шкале: 11 / 12 / 13 / 14 — четыре ступени, снятые с живых модулей. */
export const Sizes = () => (
  <Stack gap={2}>
    <Text size="xs">xs · 11px — подпись под полем, хвост метаданных</Text>
    <Text size="sm">sm · 12px — вторичная строка, подпись колонки</Text>
    <Text size="base">base · 13px — тело интерфейса, значение поля</Text>
    <Text size="md">md · 14px — крупная строка карточки</Text>
  </Stack>
);

/** Тон — приглушение серой лестницей, а не цвет: primary → quaternary. */
export const Tones = () => (
  <Stack gap={2}>
    <Text tone="primary">primary — значение, которое читают</Text>
    <Text tone="secondary">secondary — подпись рядом со значением</Text>
    <Text tone="tertiary">tertiary — метаданные строки</Text>
    <Text tone="quaternary">quaternary — плейсхолдер, подсказка</Text>
  </Stack>
);

/** Интерлиньяж: same — строки интерфейса, normal — связный текст. */
export const Leading = () => (
  <Stack gap={4}>
    <Stack gap={1}>
      <Text size="sm" tone="secondary" weight="medium">leading=&quot;same&quot;</Text>
      <Text leading="same" as="p" style={{ maxWidth: 380 }}>
        Срок сбора коммерческих предложений истекает через четыре дня.
        Три подрядчика прислали КП, один запросил перенос.
      </Text>
    </Stack>
    <Stack gap={1}>
      <Text size="sm" tone="secondary" weight="medium">leading=&quot;normal&quot;</Text>
      <Text leading="normal" as="p" style={{ maxWidth: 380 }}>
        Срок сбора коммерческих предложений истекает через четыре дня.
        Три подрядчика прислали КП, один запросил перенос.
      </Text>
    </Stack>
  </Stack>
);

/** Насыщенность и обрезка одной строкой с полным текстом в title. */
export const WeightAndTruncate = () => (
  <Stack gap={3}>
    <Text weight="regular">regular — обычная строка</Text>
    <Text weight="medium">medium — подпись поля</Text>
    <Text weight="semibold">semibold — значение, на которое смотрят первым</Text>
    <div style={{ width: 260, border: '1px dashed rgba(0,0,0,.16)', padding: 8 }}>
      <Text truncate as="div">
        Реконструкция кровли административного корпуса на улице Профсоюзной, 132к4
      </Text>
    </div>
  </Stack>
);
