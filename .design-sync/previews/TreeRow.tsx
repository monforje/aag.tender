import { Stack, TreeRow, TreeToggle } from 'clickup-shell';
/** Строка дерева: глиф, заголовок, приписка, счётчик; активная подсвечена. */
export const Rows = () => (
  <Stack gap={0} style={{ width: 260, padding: 8, background: '#fafafa', borderRadius: 8 }}>
    <TreeRow icon="home" title="Главная" onClick={() => {}} />
    <TreeRow icon="clipboardList" title="Реестр тендеров" count={24} countMuted active onClick={() => {}} />
    <TreeRow icon="billList" title="Коммерческие предложения" count={3} onClick={() => {}} />
    <TreeRow icon="scale" title="Сравнение" sub="— черновик" onClick={() => {}} />
  </Stack>
);
/** Вложенность: уровень задаёт отступ, тоггл раскрывает ветку. */
export const Nested = () => (
  <Stack gap={0} style={{ width: 260, padding: 8, background: '#fafafa', borderRadius: 8 }}>
    <TreeRow
      icon="buildings2" title="Портфели" expanded
      toggle={<TreeToggle expanded label="Свернуть портфели" onClick={() => {}} />}
      onClick={() => {}}
    />
    <TreeRow level={1} title="Жилой комплекс «Северный»" count={12} countMuted onClick={() => {}} />
    <TreeRow level={1} title="Коммерческая недвижимость" count={7} countMuted onClick={() => {}} />
    <TreeRow level={1} title="Инфраструктура" count={5} countMuted onClick={() => {}} />
  </Stack>
);
/** Аватар вместо глифа — там, где буква означает живого человека. */
export const People = () => (
  <Stack gap={0} style={{ width: 260, padding: 8, background: '#fafafa', borderRadius: 8 }}>
    <TreeRow avatar="И" online title="Иванов Иван" sub="— вы" onClick={() => {}} />
    <TreeRow avatar="К" title="Ковалёва Ирина" onClick={() => {}} />
    <TreeRow avatar="Т" title="Титов Артём" onClick={() => {}} />
  </Stack>
);
