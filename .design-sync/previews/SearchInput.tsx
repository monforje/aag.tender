import { useState } from 'react';
import { Inline, SearchInput, Stack, Text } from 'clickup-shell';

/* Капсула объявлена flex: 1 1 220px — она рассчитана на РЯД контролов.
   В колонке (Stack) эти 220px становятся высотой, и поле раздувается в
   эллипс. Поэтому здесь, как и на экране, вокруг неё Inline. */

/** capsule — поиск в полосе фильтров: растёт во всю доступную ширину. */
export const Capsule = () => {
  const [v, setV] = useState('кровля');
  return (
    <Stack gap={2} style={{ width: 460 }}>
      <Inline gap={2} align="center">
        <SearchInput variant="capsule" label="Поиск по реестру" placeholder="Название или номер" value={v} onChange={setV} />
      </Inline>
      <Inline gap={2} align="center">
        <SearchInput variant="capsule" label="Поиск по реестру" placeholder="Название или номер" value="" onChange={() => {}} />
      </Inline>
      <Text size="xs" tone="tertiary">Поиск СУЖАЕТ список, который уже на экране.</Text>
    </Stack>
  );
};

/** field — поиск внутри панели: обычный прямоугольник с рамкой. */
export const Field = () => {
  const [v, setV] = useState('');
  return (
    <Stack gap={2} style={{ width: 280 }}>
      <SearchInput variant="field" label="Поиск по значениям" placeholder="Начните вводить" value={v} onChange={setV} />
      <SearchInput variant="field" label="Поиск по значениям" placeholder="Начните вводить" value="Северный" onChange={() => {}} />
    </Stack>
  );
};
