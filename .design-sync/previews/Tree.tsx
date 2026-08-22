import { contentFor, Tree } from 'clickup-shell';
/** Универсальное дерево на настоящих данных раздела «Тендеры». */
export const Tenders = () => (
  <div style={{ width: 260, background: 'var(--cu-background-sidebar, #fafafa)', padding: 8, borderRadius: 8 }}>
    <Tree items={contentFor('tenders')} activePath="/tenders/registry" onNavigate={() => {}} />
  </div>
);
/** Другой раздел — та же модель, другие строки. */
export const Home = () => (
  <div style={{ width: 260, background: 'var(--cu-background-sidebar, #fafafa)', padding: 8, borderRadius: 8 }}>
    <Tree items={contentFor('home')} activePath="/" onNavigate={() => {}} />
  </div>
);
