import { useEffect } from 'react';
import { Route, Routes, TenderPage, useNavigate } from 'clickup-shell';

/* Экран живёт за строкой реестра и читает :id из маршрута. Свой <MemoryRouter>
   здесь поднять нельзя — превью уже завёрнуто в роутер обёрткой, а вложенный
   Router роняет react-router. Поэтому адрес выставляется навигацией внутри
   существующего роутера, а сам экран монтируется через <Route> с параметром. */
function GoTo({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => { navigate(to, { replace: true }); }, [navigate, to]);
  return null;
}

/** Карточка тендера: крошки, сводка, разделы, сравнение КП. */
export const Card = () => (
  <div style={{ width: 940 }}>
    <GoTo to="/tenders/registry/T-2026-014" />
    <Routes>
      <Route path="/tenders/registry/:id" element={<TenderPage />} />
    </Routes>
  </div>
);
