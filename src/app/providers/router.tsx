import { useLayoutEffect } from 'react';
import {
  createBrowserRouter, Navigate, RouterProvider, useLocation,
} from 'react-router-dom';
import type { SectionId } from '@/entities/section';
import { useWorkspaceStore } from '@/entities/workspace';
import { Workspace } from '@/widgets/workspace';
import { TenderRegistryPage } from '@/pages/tender-registry';
import { TenderPage } from '@/pages/tender';

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
      { path: 'tenders/registry', element: <TenderRegistryPage /> },
      { path: 'tenders/registry/:id', element: <TenderPage /> },
      { path: '*', element: <Navigate to="/tenders/registry" replace /> },
    ],
  },
], { basename: import.meta.env.BASE_URL });

export function AppRouter() {
  return <RouterProvider router={router} />;
}