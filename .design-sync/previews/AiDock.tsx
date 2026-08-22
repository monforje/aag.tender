import { AiDock, MOCK_COMPARISON } from 'clickup-shell';
/** Панель «Анализ»: разговор по данным сравнения КП, пустое состояние с подсказками. */
export const Empty = () => (
  <div style={{ height: 520, position: 'relative' }}>
    <AiDock
      open
      onClose={() => {}}
      comparison={MOCK_COMPARISON}
      starred={[]}
      onFocusRow={() => {}}
    />
  </div>
);
