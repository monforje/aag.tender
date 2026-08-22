import { Stack, Text, TreeBranch, TreeRow, TreeToggle } from 'clickup-shell';

/* Стрелка в покое СПРЯТАНА (display:none) и проявляется только под курсором
   на узле — `.tree-node.has-children:hover`. Статичный снимок курсора не
   имеет, а фокусом её не вытащить: display:none не фокусируется. Поэтому
   карточка показывает СТРУКТУРУ узла в обоих состояниях, а сама стрелка
   видна только вживую. Проп label — без глагола: «Свернуть»/«Раскрыть»
   компонент подставляет сам. */

/** Раскрытая ветка: стрелка вниз подменяет собой иконку строки. */
export const Expanded = () => (
  <Stack gap={2} style={{ width: 260 }}>
    <Text size="sm" tone="secondary">Узел раскрыт — стрелка вниз подменяет иконку под курсором</Text>
    <div style={{ padding: 8, background: '#fafafa', borderRadius: 8 }}>
      <TreeRow
          icon="buildings2" title="Портфели" expanded
          toggle={<TreeToggle expanded label="портфели" onClick={() => {}} />}
          onClick={() => {}}
        />
      <TreeBranch>
        <TreeRow level={1} title="Жилой комплекс «Северный»" count={12} countMuted onClick={() => {}} />
        <TreeRow level={1} title="Коммерческая недвижимость" count={7} countMuted onClick={() => {}} />
      </TreeBranch>
    </div>
  </Stack>
);

/** Свёрнутая ветка: та же стрелка, повёрнутая вправо. */
export const Collapsed = () => (
  <Stack gap={2} style={{ width: 260 }}>
    <Text size="sm" tone="secondary">Узел свёрнут — та же стрелка, повёрнутая вправо</Text>
    <div style={{ padding: 8, background: '#fafafa', borderRadius: 8 }}>
      <TreeRow
          icon="buildings2" title="Портфели"
          toggle={<TreeToggle expanded={false} label="портфели" onClick={() => {}} />}
          onClick={() => {}}
        />
    </div>
  </Stack>
);
