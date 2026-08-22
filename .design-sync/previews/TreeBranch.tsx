import { Stack, TreeBranch, TreeRow, TreeToggle } from 'clickup-shell';
/** Обёртка ветки: вертикальная линия вдоль детей одного родителя. */
export const Branch = () => (
  <Stack gap={0} style={{ width: 260, padding: 8, background: '#fafafa', borderRadius: 8 }}>
    <TreeRow
      icon="buildings2" title="Портфели" expanded
      toggle={<TreeToggle expanded label="Свернуть портфели" onClick={() => {}} />}
      onClick={() => {}}
    />
    <TreeBranch>
      <TreeRow level={1} title="Жилой комплекс «Северный»" count={12} countMuted onClick={() => {}} />
      <TreeRow level={1} title="Коммерческая недвижимость" count={7} countMuted onClick={() => {}} />
      <TreeRow level={1} title="Инфраструктура" count={5} countMuted onClick={() => {}} />
    </TreeBranch>
  </Stack>
);
