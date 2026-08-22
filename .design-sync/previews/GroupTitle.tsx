import { GroupTitle, Stack, TreeRow } from 'clickup-shell';
/** Заголовок группы в дереве: не строка и не кнопка — метка раздела списка. */
export const InTree = () => (
  <Stack gap={0} style={{ width: 260, padding: 8, background: '#fafafa', borderRadius: 8 }}>
    <GroupTitle>Работа</GroupTitle>
    <TreeRow icon="clipboardList" title="Реестр тендеров" count={24} countMuted onClick={() => {}} />
    <TreeRow icon="billList" title="Коммерческие предложения" onClick={() => {}} />
    <GroupTitle>Справочники</GroupTitle>
    <TreeRow icon="book2" title="Подрядчики" onClick={() => {}} />
    <TreeRow icon="scanner" title="Виды работ" onClick={() => {}} />
  </Stack>
);
