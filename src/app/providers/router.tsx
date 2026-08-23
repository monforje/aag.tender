import { lazy, Suspense, useLayoutEffect, type ReactNode } from 'react';
import {
  createBrowserRouter, Navigate, RouterProvider, useLocation,
} from 'react-router-dom';
import type { SectionId } from '@/entities/section';
import { useWorkspaceStore } from '@/entities/workspace';
import { Spinner } from '@/shared/ui/Spinner';
import { Workspace } from '@/widgets/workspace';

/* СТРАНИЦЫ — ОТДЕЛЬНЫМИ ЧАНКАМИ. До этого сборка давала один файл на всё
   приложение: заходя в реестр, пользователь скачивал и карточку тендера
   целиком — сравнительную таблицу, календари, панель разбора. Каркас
   (рейл, сайдбар, топбар) остаётся статическим: он нужен на первом кадре
   любого маршрута, и его отложенная загрузка дала бы пустой экран. */
const TenderRegistryPage = lazy(() => import('@/pages/tender-registry')
  .then((m) => ({ default: m.TenderRegistryPage })));
const TenderPage = lazy(() => import('@/pages/tender')
  .then((m) => ({ default: m.TenderPage })));

/* Заглушка ПОЯВЛЯЕТСЯ НЕ СРАЗУ: .route-fallback держит её невидимой первые
   200мс (global.css). Локальный чанк успевает приехать раньше — мигания нет;
   на медленной сети пользователь видит, что идёт загрузка, а не пустую
   карточку. У самих страниц состояние загрузки своё — оно про ДАННЫЕ и
   появится следом. */
const Page = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<div className="route-fallback"><Spinner /></div>}>
    {children}
  </Suspense>
);

/** Раздел рейла выводится из первого сегмента пути. Всё, что не живёт под
 *  одним из четырёх разделов с собственным сегментом, — home. */
function sectionFromPath(pathname: string): SectionId {
  const [, first] = pathname.split('/');
  if (first === 'tenders' || first === 'more' || first === 'opcii' || first === 'admin') return first;
  return 'home';
}

/** ЕДИНСТВЕННОЕ место, где пишется activeId: он проекция URL, а не
 *  самостоятельное состояние. Навигация всегда идёт через navigate() —
 *  если разрешить писать в стор напрямую, появится второй писатель и адрес
 *  разъедется с подсветкой в дереве.
 *
 *  useLayoutEffect, а не useEffect: синхронизация должна произойти до
 *  отрисовки, иначе на прямом заходе по /tenders/registry первый кадр
 *  показал бы подсветку от дефолтного состояния стора. */
function RouteSync() {
  const { pathname } = useLocation();
  const syncFromRoute = useWorkspaceStore((s) => s.syncFromRoute);

  useLayoutEffect(() => {
    syncFromRoute({ activeId: sectionFromPath(pathname) });
  }, [pathname, syncFromRoute]);

  return null;
}

function Shell() {
  return (
    <>
      <RouteSync />
      <Workspace />
    </>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/tenders/registry" replace /> },
      { path: 'tenders/registry', element: <Page><TenderRegistryPage /></Page> },
      { path: 'tenders/registry/:id', element: <Page><TenderPage /></Page> },
      { path: '*', element: <Navigate to="/tenders/registry" replace /> },
    ],
  },
], { basename: import.meta.env.BASE_URL });

export function AppRouter() {
  return <RouterProvider router={router} />;
}