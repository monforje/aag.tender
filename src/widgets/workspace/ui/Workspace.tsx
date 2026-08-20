import { Outlet } from 'react-router-dom';
import { Topbar } from '@/widgets/topbar';
import { Rail } from '@/widgets/rail';
import { Sidebar } from '@/widgets/sidebar';
import s from './Workspace.module.css';

/** Каркас приложения: топбар сверху, ниже ряд «рейл + карточка body».
 *  Страница приходит через <Outlet/> и занимает <main> — единственный узел,
 *  который меняется целиком при переключении раздела. */
export function Workspace() {
  return (
    <div className={s.app}>
      <Topbar />
      <div className={s.workspace}>
        <Rail />
        <div className={s.body}>
          <div className={s.bodyWrapper}>
            <Sidebar />
            <main className={s.main}>
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
