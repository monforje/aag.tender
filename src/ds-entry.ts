/* ============================================================================
   ПУБЛИЧНАЯ ТОЧКА ДИЗАЙН-СИСТЕМЫ — вход для library-сборки (vite.lib.config.ts)
   и для дизайн-агента claude.ai/design.

   Приложение этот файл НЕ импортирует: у него свой вход (app/index.tsx).
   Здесь только реэкспорт публичных точек слайсов — по одной строке на слайс,
   в порядке слоёв FSD (shared → entities → features → widgets → pages).

   Импорты РЕЛЯТИВНЫЕ, а не через '@/': этот файл читает ещё и ts-morph
   конвертера, а он собирает свой TS-проект без paths из tsconfig — алиас там
   не резолвится, и контракт пропсов схлопнулся бы в any.

   Правило прежнее: файл обновляется вместе с COMPONENTS.md, когда появляется
   новый слайс. Коллизий имён между слайсами нет — их отсутствие и позволяет
   писать `export *`.
   ========================================================================= */

/* Токены, reset и каталог состояний. Приложение импортирует этот файл из
   app/index.tsx; библиотека обязана тащить его САМА и ПЕРВЫМ — модули
   компонентов читают --cu-* и переопределяют глобальные правила, а порядок
   в собранном style.css повторяет порядок импортов. */
import './app/styles/global.css';

/* --- shared/ui --- */
export * from './shared/ui/Alert';
export * from './shared/ui/Avatar';
export * from './shared/ui/Badge';
export * from './shared/ui/Breadcrumbs';
export * from './shared/ui/Button';
export * from './shared/ui/ButtonGroup';
export * from './shared/ui/Calendar';
export * from './shared/ui/Card';
export * from './shared/ui/CellPopup';
export * from './shared/ui/Checkbox';
export * from './shared/ui/ColorPicker';
export * from './shared/ui/ConfirmDialog';
export * from './shared/ui/Counter';
export * from './shared/ui/DatePicker';
export * from './shared/ui/Drawer';
export * from './shared/ui/Dropdown';
export * from './shared/ui/EmptyState';
export * from './shared/ui/ErrorState';
export * from './shared/ui/FacetFilter';
export * from './shared/ui/Field';
export * from './shared/ui/Icon';
export * from './shared/ui/IconButton';
export * from './shared/ui/InlineInput';
export * from './shared/ui/Input';
export * from './shared/ui/Layout';
export * from './shared/ui/Link';
export * from './shared/ui/Micro';
export * from './shared/ui/Modal';
export * from './shared/ui/NumberInput';
export * from './shared/ui/Page';
export * from './shared/ui/Pagination';
export * from './shared/ui/Popover';
export * from './shared/ui/Progress';
export * from './shared/ui/Radio';
export * from './shared/ui/RangeCalendar';
export * from './shared/ui/ScrollArea';
export * from './shared/ui/SearchInput';
export * from './shared/ui/SearchTrigger';
export * from './shared/ui/Segmented';
export * from './shared/ui/Select';
export * from './shared/ui/Skeleton';
export * from './shared/ui/Spinner';
export * from './shared/ui/Switch';
export * from './shared/ui/Table';
export * from './shared/ui/Tabs';
export * from './shared/ui/Toast';
export * from './shared/ui/Tooltip';
export * from './shared/ui/Tree';
export * from './shared/ui/TreeRow';
export * from './shared/ui/Typography';
export * from './shared/ui/VisuallyHidden';

/* --- entities --- */
export * from './entities/section';
export * from './entities/tender';
export * from './entities/comparison';
export * from './entities/workspace';

/* --- features --- */
export * from './features/ai-analysis';
export * from './features/flyout';

/* --- widgets --- */
export * from './widgets/rail';
export * from './widgets/sidebar';
export * from './widgets/topbar';
export * from './widgets/workspace';

/* --- pages --- */
export * from './pages/tender';
export * from './pages/tender-registry';

/* --- демо-данные для превью -------------------------------------------------
   Фикстуры реэкспортируются ЗДЕСЬ и только здесь. Публичные точки слайсов их
   не отдают намеренно: экран, импортирующий мок по имени, пережил бы
   подключение сервера и продолжил молча показывать демо-цифры. У этого файла
   ровно обратная задача — макетам в claude.ai/design нужны настоящие строки
   домена, а приложения за ним нет. Импорт глубокий по той же причине. */
export { ROWS } from './entities/tender/api/tenders.mock';
export { MOCK_COMPARISON } from './entities/comparison/api/comparison.mock';

/* --- обвязка превью ---------------------------------------------------------
   Приложение оборачивает дерево тремя провайдерами (app/index.tsx):
   SolarProvider, ToastProvider, роутер. Второй уже уехал выше вместе со
   слайсом Toast, а этим двум своего слайса нет — без них у <Link>,
   <Breadcrumbs> и иконок Solar не будет контекста.

   Реэкспорт идёт ОТСЮДА, а не из превью: так у обёртки и у компонентов один
   и тот же экземпляр react-router. Второй экземпляр сломал бы контекст
   молча — ошибки не будет, ссылки просто перестанут знать про маршрут. */
export { SolarProvider } from '@solar-icons/react/lib/SolarProvider';
export { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
