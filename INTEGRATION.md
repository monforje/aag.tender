# Интеграция `aag.tender` → `c.aag.tender-supplier/web`

План переноса UI прототипа «Snabli Tender Master» (репозиторий `/home/dan/Work/aag.tender`)
в продуктовое приложение `web/` проекта `c.aag.tender-supplier`.

**Согласованный объём (scope):**
- заменяются **две страницы**: реестр тендеров и карточка тендера;
- заменяется **каркас**: topbar + rail + sidebar (+ workspace-обвязка, без неё каркас не живёт);
- переносится **вся дизайн-система и компоненты** (`shared/ui`, токены `global.css`);
- остальное приложение (`/suppliers`, `/budget`, `/quotes`, `/chats`, …) **не трогаем**.

> **РЕВИЗИЯ 2 — 25.08.2026, вечер.** Повторный полный аудит обеих кодовых баз после
> четырёх волн правок владельца в источнике (`e4143e5..8eefae4`). Обновлены объёмы
> и карта файлов (§1, Приложения А/Б/Д/Ж), состав ДС — **52 слайса** (+ProgressBar);
> **решение В4 закрыто источником** (`viewUrl.ts` — вид сравнения сериализуется в URL,
> §2.4); потери §7.2 №8 и частично №13 закрыты прототипом; в Ф4 добавлены перенос
> ~2 300 новых строк UI и четыре поверхности адаптера — мутации корректировок/версий,
> комментарии ячеек (§4.8), экспорт .xlsx (§4.9); гэпы бэкенда дополнены (в12–в13);
> оценки подняты (§0, Приложение Е). Архитектурный каркас плана не изменился.

Документ составлен по полному обходу обоих кодовых баз:
- `aag.tender/src` — **35 237** строк (ts/tsx/css, включая ds-entry.ts), все слои FSD до файла;
- `c.aag.tender-supplier/web/src` — **39 501** строка, шелл/страницы/API-слой
  (цель с 24.08 не менялась; рабочая ветка `cursor/sprint-wave-async-jobs-ui-kit` — базу
  для `feat/cu-integration` согласовать до Ф0);
- контракты данных сверены поле-в-поле: прототип ↔ `tendersApi.ts` ↔ FastAPI
  (`build_comparison`, роутеры tenders/rounds/insights/comments/reports; повторно
  сверено кодом при ревизии 2).

Статусы действий в чек-листах:

| Код | Значение |
|---|---|
| MOVE | переносится как есть |
| ADAPT | переносится с малыми правками (перечислены) |
| PORT | переписывается под Next.js App Router (объём правок существенный) |
| NEW | пишется заново в целевом репо |
| DROP | в целевое приложение не попадает (причина указана) |

---

## 0. Резюме

**Что легко.** Прототип изначально спроектирован под подмену мока сервером: вся работа
с данными изолирована в пяти дверях (`entities/tender/api/tenders.api.ts`,
`entities/comparison/api/{comparison,comments,export}.api.ts`,
`features/ai-analysis/api/analysis.api.ts`), функции асинхронные, экраны моков
не импортируют, а мутации не бросают и отвечают успехом — сбой запроса уже
вписан в контракты. Бэкенд уже имеет все смысловые эндпоинты
(`/tenders/{id}/comparison`, `/rounds`, `/insights*`) и даже считает аналитику
на сервере. Обе кодовые базы — React 19, CSS Modules, TypeScript strict.
Авторизация прикручивается одним вызовом `apiFetch`.

**Что дорогое.**

1. **Каркас и страницы живут на react-router 7** — импорт роутера сидит не только в
   страницах, но и в `shared/ui` (`Link`, `Breadcrumbs`) и в `ds-entry.ts`. Для Next это
   PORT девяти файлов плюс адаптер.
2. **Текущее приложение стилизовано глобальными классами** (`globals.css` — 5 917 строк,
   ~978 классов) и голым элементным CSS (`input/select/textarea/button` на всё приложение).
   Чужая ДС на CSS Modules в него вживляется, но элементный каскад придётся гасить
   compat-слоем в корне новой секции (§3.2).
3. **Замена карточки тендера теряет функциональность**: текущая карточка (3 501 строка)
   умеет то, чего в прототипе нет — документы, комментарии, чаты, КП/приглашения,
   уточнения, активность, победителя, FKP-версии. В прототипе эти вкладки — заглушки.
   Это главный продуктовый риск; список потерь и план достройки — §7.2 (с 25.08
   прототип закрыл два пункта списка: экспорт .xlsx и частично детали ячейки).
4. **Две несовместимые модели ИИ-разбора** (прототипная секционная vs серверная
   blocks-with-tokens). Рекомендованное решение — поэтапное, §4.5.
5. **Источник живёт параллельно и БЫСТРО**: +7 636 строк за один день правок владельца
   (комментарии ячеек, корректировки, экспорт, URL-вид, стадии КП). Правило
   однонаправленного diff-переноса (§7.1) — рабочий режим, а не запасной план.

**Оценка:** Ф0–Ф6 основного пути — **16,5–23,5 рабочих дня** одного фронтендера при решённых
продуктовых вопросах §7.3; без потери функционала карточки (Ф7) — кратно больше.

---

## 1. Что переносим: инвентарь источника

### 1.1 Объёмы по слоям `aag.tender/src`

Числа строк сняты wc -l по состоянию на 25.08.2026 (после спринта переписки,
решений и выноса счёта в model — см. Часть XXII DESIGN-NOTES; против первой
редакции документа карточка выросла вдвое, comparison — на комментарии,
выгрузку и кодек вида в URL).

| Слой | Всего строк | TS/TSX | CSS | Судьба в целевом репо |
|---|---:|---:|---:|---|
| `app/` | 673 | 103 | 570 | PORT (роутер → layout), global.css MOVE |
| `pages/tender-registry` | 470 | 404 | 66 | PORT |
| `pages/tender` | 12 291 | 8 437 | 3 854 | PORT (model почти MOVE) |
| `widgets/` | 1 406 | 774 | 632 | PORT (router-хуки), остальное MOVE |
| `features/flyout` | 242 | 191 | 51 | MOVE |
| `features/ai-analysis` | 4 917 | 3 766 | 1 151 | ADAPT/PORT, решение §4.5 |
| `entities/comparison` | 4 185 | 4 185 | — | MOVE + NEW адаптеры API |
| `entities/tender` | 360 | 360 | — | MOVE + NEW адаптеры API |
| `entities/workspace` | 59 | 59 | — | MOVE |
| `entities/section` | 84 | 84 | — | ADAPT (деревья разделов) |
| `shared/ui` | 10 149 | 6 555 | 3 594 | MOVE ×52, ADAPT ×3 (Link/Breadcrumbs/Icon) |
| `shared/lib` | 277 | 277 | — | MOVE целиком |
| **Итого** | **35 237** | | | |

Оценка Ф4 ниже (4–6 дней) писалась до спринта 25.08 и теперь оптимистична:
карточка выросла с 6.9k до 12.3k строк. Пересчёт — при планировании; сам план
не меняется, MOVE-доля растёт быстрее адаптируемой.

Вне `src/`: `vite.lib.config.ts` + `src/ds-entry.ts` (library-сборка ДС для Claude Design)
и `.design-sync/` — в merged-контексте замораживаются (§7.1).

### 1.2 Каркас (`widgets/`)

DOM каркаса (`widgets/workspace/ui/Workspace.tsx`):

```
.app
├── Topbar                      ← widgets/topbar (268 строк, 4 css)
└── .workspace
    ├── Rail                    ← widgets/rail (264): слот 64px, карточка 52px,
    │                             превью-flyout (features/flyout)
    └── .body
        └── .bodyWrapper
            ├── Sidebar         ← widgets/sidebar (355): header + ScrollArea(Tree) + footer
            └── main
                ├── <Outlet/>   ← страницы
                └── .aiPanel > #ai-panel-slot   ← слот панели ИИ, смонтирован ВСЕГДА
```

Ключевые связи каркаса:

| Связь | Где | Деталь |
|---|---|---|
| URL → стор | `app/providers/router.tsx::RouteSync` | единственный писатель `activeId`; `sectionFromPath()` по первому сегменту |
| клик по рейлу | `Rail.tsx` | `closeAiPanel() + selectSection(id) + setSidebarOpen(true)` — БЕЗ навигации |
| переход из превью | `RailItem.tsx` | `navigate(pathFor(id)) + preview.close()` |
| дерево сайдбара | `Sidebar.tsx` | `<Tree contentFor(activeId) activePath=pathname onNavigate=navigate>` |
| панель ИИ | `Workspace.tsx` | закрытие классом (история чата переживает open/close); страница дергает `openAiPanel()/closeAiPanel()` напрямую через стор |
| узкий экран | `workspace-store.ts` | `matchMedia('(max-width:900px)')` при инициализации — SSR-нечувствительное место |

Состав виджетов:

- **topbar**: `Topbar.tsx` (77) — DropdownGroup; слева WorkspaceSwitcher + календарь,
  центр SearchTrigger (заглушка), справа NotificationsBell(count=6) + UserMenu.
  `WorkspaceSwitcher.tsx` (51), `UserMenu.tsx` (53), `NotificationsBell.tsx` (44).
  С роутером и стором НЕ связаны — переносятся почти даром.
- **rail**: `Rail.tsx` (102), `RailItem.tsx` (84) — `<a href>` с перехватом onClick,
  `--arrow-top` носика; `RailExpandZone.tsx` (39). Зависят от useLocation/useNavigate — PORT.
- **sidebar**: `Sidebar.tsx` (61), `SidebarHeader.tsx` (59), `SidebarActions.tsx` (42),
  `SidebarSearch.tsx` (52) — заглушка поиска, `SidebarFooter.tsx` (30). Зависят от роутера — PORT.
- **workspace**: `Workspace.tsx` (76) + `Workspace.module.css` (229). Ставит
  `--ai-seq-delay` на documentElement; всплытие сайдбара <900px.

### 1.3 Страницы

**Реестр** (`pages/tender-registry`, 465 строк):

| Файл | Строк | Действие |
|---|---:|---|
| `ui/TenderRegistryPage.tsx` | 156 | PORT: Link/useNavigate → next/link+useRouter; lazy-обёртка исчезает |
| `ui/RegistryFilters.tsx` | 247 | MOVE (зависит только от shared/entities) |
| `ui/RegistryFilters.module.css` | 66 | MOVE |
| `index.ts` | 1 | MOVE |

Структура: `Screen > PageHeader(withSecondary)+PageTitle > SecondaryHeader`
(табы Активные/Закрытые/Черновики — состояние страницы, не URL) `> RegistryFilters >
ScrollArea(Table | Skeleton×6 | ErrorState)`. Строки кликабельны, настоящая ссылка — на номере.

**Карточка** (`pages/tender`, 12 291 строка). Модель (`model/`, 1 611) переносится
почти целиком:

| Файл | Строк | Действие |
|---|---:|---|
| `columns.ts` | 261 | MOVE — чистая функция ширин колонок |
| `columns.check.ts` | 174 | MOVE — assert-скрипт |
| `compareFormat.ts` | 539 | MOVE — вырос вчетверо (25.08: паспорт позиции, разбор разброса) |
| `scroll-parent.ts` | 17 | MOVE |
| `useBandMaxHeight.ts` / `useBandWidth.ts` | 67+45 | MOVE |
| `useCellComments.ts` | 101 | **NEW 25.08** MOVE — тред комментария ячейки |
| `useCompareScreen.ts` | 174 | ADAPT — источник данных меняется на адаптер (§4.3); + viewUrl (§2.4) |
| `useComparisonData.ts` | 113 | REWRITE — тело на `apiFetch` (§4.3) |
| `useTableDock.ts` | 280 | MOVE |

UI (`ui/`, 10 679):

| Файл | Строк | Действие |
|---|---:|---|
| `TenderPage.tsx` | 313 | PORT: useParams/Navigate → next; портал в #ai-panel-slot остаётся |
| `TenderCompare.tsx` | 1 454 | MOVE (+794 к ревизии 1) |
| `TenderCompare.module.css` | 2 167 | MOVE (самый большой CSS проекта) |
| `CompareToolbar.tsx`(+css) | 457+193 | MOVE |
| `CompareSettings.tsx`(+css) | 516+242 | MOVE (экспортирует и CompareFilters) |
| `BidCell.tsx` | 413 | MOVE |
| `CellCard.tsx`(+css) | 241+148 | **NEW 25.08** MOVE — попап-таблица ячейки, два яруса карточки |
| `CommentThread.tsx`(+css) | 384+280 | **NEW 25.08** MOVE — переписка ячейки |
| `CorrectionPanel.tsx`(+css) | 173+73 | **NEW 25.08** MOVE — решение по корректировке объёма |
| `CutLine.tsx` | 86 | **NEW 25.08** MOVE |
| `ExportButton.tsx` / `ExportDialog.tsx`(+css) | 62+112+42 | **NEW 25.08** MOVE — выгрузка .xlsx (§4.9) |
| `GhostColumn.tsx` | 62 | **NEW 25.08** MOVE |
| `InviteDialog.tsx` | 61 | **NEW 25.08** MOVE — приглашение из карточки |
| `PotentialCell.tsx` | 82 | **NEW 25.08** MOVE |
| `SliceLink.tsx`(+css) | 67+57 | **NEW 25.08** MOVE — пилюля «ссылка на срез» (viewUrl) |
| `CompareRow.tsx` | 277 | MOVE (memo) |
| `TenderSummary.tsx`(+css) | 200+295 | MOVE — единственный h1 страницы |
| `ContractorCard.tsx` | 502 | MOVE (+304: два яруса, счёт узла) |
| `CornerTab.tsx` | 123 | MOVE |
| `DossierModal.tsx`(+css) | 189+75 | MOVE (нативный Modal) |
| `TermsBand.tsx` | 150 | MOVE |
| `RoundsPanel.tsx`(+css) | 107+54 | MOVE |
| `TotalRow.tsx` | 134 | MOVE |
| `SpreadCell.tsx` | 103 | MOVE |
| `CompareLegend.tsx`(+css) | 169+170 | MOVE |
| `ColumnPainter.tsx`(+css) | 45+15 | MOVE (ColorPicker+Popover) |
| `assets/*` глифы (8 шт + index) | 183 | MOVE (+ CommentMark, CorrectionMark) |
| `TenderPage.module.css` | 43 | MOVE |

Вкладки карточки в прототипе: **Сравнение** (полная) и **Раунды** (полная);
Уточнения / КП / Обзор / Документы / Активность — `ScreenPlaceholder` (заглушки).
Вкладки — состояние страницы, НЕ URL (в текущем web — `?tab=`); решение §2.4.

### 1.4 Домен (`entities/`)

- **section** (86): `SectionId = home|tenders|more|opcii|admin`; `NAV_TOP` — 5 пунктов рейла;
  деревья `HOME/TENDERS/MORE/FALLBACK` в `contentFor(id)`; кликабельны только `kind:'link'`.
  ADAPT: содержимое деревьев переписывается под реальные разделы целевого приложения (§5, Ф2).
- **tender** (360): `STATUS` (open/closed/cancelled/draft → label/tone/icon),
  `TenderRow`, `tenderPath(id) = /tenders/registry/{id}`, `bidsDue(row)`
  (overdue/urgent≤7д/soon≤30д/calm/idle), `facetsOf(rows)` + `applyFilters`.
  ADAPT: `tenderPath` — если сохраняем URL целевого приложения, путь станет `/tenders/{id}` (§2.2).
- **comparison** (4 185): контракт `contract.ts` (481; с 25.08 — стадии КП:
  `BidStage/bidStage/stageLabel`, версии `BidVersion/currentVersion/isStaleVersion`,
  `isWaiting/withVersion/sectionPathOf`) — см. приложение В; пороги
  `thresholds.ts` (58); счёт `calc.ts` (560); предикаты `filters.ts` (57); оси
  `view.ts` (235); **`viewUrl.ts` (106)+check — сериализация вида в URL, §2.4**;
  модель комментариев `comments.ts` (122); матрица условий `terms.ts` (43);
  формат `lib/format.ts` (26). Двери: `comparison.api.ts` (176; fetchComparison
  + мутации `decideCorrection`/`selectBidVersion`), `comments.api.ts` (83, §4.8),
  `export.api.ts` (66, §4.9). Мок `api/comparison.mock.ts` (1 009) — DROP из
  рантайма, KEEP для превью ДС (§7.1).
- **workspace** (59): zustand-стор `useWorkspaceStore` — activeId (проекция URL),
  sidebarOpen, aiPanelOpen; `openAiPanel()` закрывает сайдбар НАВСЕГДА (не возвращает).

### 1.5 Фича ИИ-разбора (`features/ai-analysis`, 4 961)

| Файл | Строк | Роль |
|---|---:|---|
| `api/analysis.api.ts` | 103 | дверь данных: `requestAnalysis(query)` — сегодня локально (`buildAnalysis` + DEMO_DELAY), завтра — тело одной функции |
| `model/analysis.ts` | 920 | «серверная половина»: buildAnalysis → AnalysisResult {summary≤3, brief, sections, popupNotes}, ANALYSIS_LIMITS |
| `model/narration.ts` | 136 | vetNote (правило неподтверждённого числа, NOTE_MAX=240), applyNarration |
| `model/insights.ts` | 238 | deriveInsights — карточки блока «Анализ» одним проходом, те же пороги что у таблицы |
| `model/askAi.ts` | 151 | демо-ответчик чата по ключевым словам — DROP при подключении сервера |
| `model/useAnalysisRuns.ts` | 145 | runs по номерам раундов, Staleness partial/stale |
| `ui/AnalysisDock.tsx` | 627 | панель разбора, порталится в #ai-panel-slot |
| `ui/AiDock.tsx` | 590 | чат «Анализ»; lazy-граница (dockId.ts отдельным модулем) |
| `ui/AiTrigger.tsx` | 172 | бирка-триггер AI_TRIGGER_ID |
| `ui/RichText.tsx` + `assets/SparkGlyph.tsx` | 74+115 | мини-разметка чата, спектральный глиф |

### 1.6 Дизайн-система (`shared/ui` — 52 слайса, 10 149 строк)

Полный реестр компонентов с props и зависимостями — **Приложение А**. Здесь — только то,
что важно для интеграции:

- Нативный `<dialog>` используют ровно четыре: Modal, Drawer, Popover (showModal),
  CellPopup (show(), немодальный). DatePicker рисует div[role=dialog] сам.
  В Next работают без изменений (client components).
- Сквозной тип `Tone` живёт в `Badge` — его переиспользуют Alert, доменные таблицы статусов,
  Segmented, Progress, Toast.
- Три глобальных класса используются компонентами МИМО модулей как строки:
  `.inline-edit` (InlineInput, кнопка DatePicker), `.visually-hidden` (VisuallyHidden),
  `.route-fallback` (fallback роутера). Они обязаны грузиться до компонентов — в merged app
  их импорт ставим первым в layout новой секции.
- Прямой импорт react-router в shared/ui ровно в двух: `Link`, `Breadcrumbs` — PORT (§2.2).
- `Icon` — таблица `icon-map.ts` (221, +43 к ревизии 1: глифы комментариев/экспорта/стадий):
  имя спрайта эталона → Solar-компонент поштучно
  (`@solar-icons/react/linear/*`, `/bold/*`) + 4 локальных SVG (docs/funnel/target/planet).
  Размер/толщина задаются CSS (`--icon-size`, SolarProvider strokeWidth={1.5} в корне).
- **ProgressBar** (69+62css) — полоса ВЕЛИЧИНЫ (доля 0…100), появилась 25.08; НЕ для хода
  процесса (это `Progress`), нормируется снаружи. Единственный новый слайс ревизии 2.
- Table (164 tsx + 406 css): layout fixed/stickyHead/stickyCol, объект модификаторов
  `tableCell {numeric, roomy, mono, strong, muted, sub, link, rowLink, card, fullRow, empty}`;
  ширины через `<col>` исполняются только при `layout="fixed"`; арифметика ширин в cqw.
- Layout-семья: Stack/Inline/Grid/Divider + шкала GapIndex 0…9 (`gap(n)`, `gapStyle`).
- Page-семья: Screen/PageHeader/PageTitle/PageActions/ChipButton/ScreenPlaceholder/
  SecondaryHeader (табы APG через lib/roving).

### 1.7 Токены (`app/styles/global.css`, 570 строк)

Группы переменных (все с префиксом `--cu-*`, кроме каркасных):

| Группа | Примеры |
|---|---|
| Размеры | `--cu-size-1..9` (4→36px, шаг 4) |
| Радиусы | `--cu-radii-2/3/4/6` (4/6/8/12px), `--cu-radii-round` |
| Тени | `--cu-elevation-1..4`, `--cu-elevation-border-1/-border-4` (первый слой = хэйрлайн вместо border) |
| Текст/поверхности | `--cu-content-primary..quaternary/placeholder/on-dark`, `--cu-background-main/menu`, `--cu-surface-inverse`, `--cu-border-default`, `--cu-alphaGrey200/300/400/700` |
| Состояния | `--cu-state-hover-subtle/.05`, `-hover/.06`, `-hover-strong/.09`, `--cu-fill/.06`, `--cu-fill-subtle/.035`, `--cu-state-ring`, `--cu-focus-ring` |
| Тона | `--cu-tone-{info,success,danger,warning,neutral}` × `{цвет, -ink, -fill}` |
| Спектр ИИ | `--cu-ai-a/b/c` (info → фиолетовый → danger-ink) |
| Каркас | `--main-header-height:44px`, `--global-sidebar-width:64px`, `--rail-card-width:52px`, `--sidebar-final-width:256px`, `--ai-panel-width: clamp(320px,30vw,400px)`, `--island-gap:6px`, `--cu-global-actions-bar-height:40px` |
| Типографика | `--cu-font-family`, weights, кегли xs/sm/base/md/lg/xl/2xl (11–20px), leading same/tight/normal |
| Движение | `--cu-duration-fast/base/slow` (.12/.2/.28s), `--cu-ease-standard/enter/exit/emphasized` |
| Дерево сайдбара | `--sidebar-icon-x-spacing`, `--sidebar-tree-item-height:28px`, `--sidebar-tree-node-inset:8px`, `--sidebar-icon-dimensions:16px`, `--sidebar-toggle-hit:22px`, `--sidebar-tree-line-x` |
| Counter | `--cu3-counter-*` (7 шт.) |
| Z-слои | `--z-rail:999`, `--z-topbar:1200`, `--z-menu:1300`, `--z-dock:900`, `--z-toast:1350` |

Плюс: reset (box-sizing, обнуление списков тегов, сброс кнопок, скрытые скроллбары,
`html,body{height:100%;overflow:hidden}`, body 13px antialiased), каталог состояний
(11 документированных рецептов hover/focus — комментарии), утилиты `.inline-edit`,
`.visually-hidden`, `.route-fallback`, media prefers-reduced-motion.

Конфликты имён с текущим web/: точных коллизий переменных НЕТ (web использует
`--bg/--surface/--accent/--s-new.../--sidebar-width/--sidebar-rail-width/--sidebar-panel-width`),
кроме семейства `--sidebar-*` — префикс общий, имена разные; но см. §3.2 про z-index
и элементный каскад.

### 1.8 Зависимости источника

```json
dependencies: @solar-icons/react ^2.0.0, react ^19.2.8, react-dom ^19.2.8,
              react-router-dom ^7.18.2, zustand ^5.0.15
devDeps:      typescript ^7.0.2, vite ^8.2.1, @vitejs/plugin-react ^6.0.5,
              puppeteer-core (профилирование)
```

Vite-специфика, влияющая на перенос: `localsConvention:'camelCaseOnly'`,
`generateScopedName:'[local]__[hash:base64:5]'`, alias `@→./src`,
`base:'/aag.tender/'` (GitHub Pages), `import.meta.env.BASE_URL` в роутере.
Bun нужен только для запуска 8 assert-скриптов `*.check.ts` (node:assert, без фреймворка).

---

## 2. Целевая архитектура в `web/` (Next.js 16 App Router)

### 2.1 Куда ложится код

Целевое дерево (новое помечено `+`, удаляемое `-`):

```
web/src/
├── app/
│   ├── layout.tsx                  # без изменений; globals.css остаётся
│   ├── (app)/                      # СТАРЫЙ шелл: всё кроме тендеров
- │   ├── (app)/tenders/page.tsx     # DELETE (заменён)
- │   ├── (app)/tenders/[id]/...     # DELETE (заменён)
+ │   └── (app)/(прочие маршруты)    # без изменений
+ ├── cu/                            # НОВАЯ СЕКЦИЯ: перенесённый aag.tender
+ │   ├── layout.tsx                 # NEW: AuthGuard + CuProviders + <CuWorkspace>{children}
+ │   ├── styles/cu-global.css       # MOVE app/styles/global.css (+ compat-reset §3.2)
+ │   ├── shared/ui/*                # MOVE 52 слайса shared/ui
+ │   ├── shared/lib/*               # MOVE shared/lib
+ │   ├── entities/{section,tender,comparison,workspace}/*
+ │   ├── features/{flyout,ai-analysis}/*
+ │   ├── widgets/{workspace,topbar,rail,sidebar}/*
+ │   ├── pages/tender-registry/*
+ │   ├── pages/tender/*
+ │   └── lib/adapters/*             # NEW: слой данных (§4)
+ ├── app/(cu-shell)/                # маршрутная группа с URL /tenders...
+ │   ├── tenders/page.tsx           # NEW: реэкспорт CuRegistryPage
+ │   └── tenders/[id]/page.tsx      # NEW: реэкспорт CuTenderPage
```

Почему маршрутная группа, а не перенос внутрь `(app)`: в Next layout родителя
не отключить точечно — чтобы у `/tenders*` был свой каркас (Workspace вместо
Sidebar+topbar), обе страницы выносятся в соседнюю группу `(cu-shell)` с собственным
layout. **URL не меняется** — `/tenders`, `/tenders/{id}` остаются прежними:
deep-link'и уведомлений (`TopbarExtras`: deep-link `/tenders/{id}`), история,
закладки продолжают работать.

Альтернатива (отклонена): держать один общий layout и рендерить каркас условно —
даёт два писателя раскладки и гонку стилей глобального шелла на страницах ДС.

Именование внутри `web/src/cu/` сохраняет FSD-словарь источника (pages/widgets/…)
— это осознанно НЕ идиоматичный Next, но перенос 27k строк «словарь в словарь»
на порядок дешевле, чем реструктуризация. Граница «чужой словарь» видна по корню `cu/`.

### 2.2 Роутинг: react-router 7 → App Router

Полный список файлов с импортом react-router (проверено grep по src):

| Файл | Использование | Действие |
|---|---|---|
| `app/providers/router.tsx` | createBrowserRouter, RouteSync, lazy+Suspense | DROP → заменяется `(cu)/layout.tsx` + `RouteSync` PORT |
| `pages/tender-registry/ui/TenderRegistryPage.tsx` | Link, useNavigate | ADAPT |
| `pages/tender/ui/TenderPage.tsx` | Navigate, useParams | ADAPT |
| `shared/ui/Link/Link.tsx` | RouterLink для `to`-варианта | PORT |
| `shared/ui/Breadcrumbs/Breadcrumbs.tsx` | RouterLink | PORT |
| `widgets/rail/ui/Rail.tsx` | useLocation, useNavigate | ADAPT |
| `widgets/sidebar/ui/Sidebar.tsx` | useLocation/useNavigate через props? — читает pathname/navigate | ADAPT |
| `widgets/workspace/ui/Workspace.tsx` | Outlet | PORT → `{children}` |
| `ds-entry.ts` | MemoryRouter для превью ДС | FREEZE (§7.1) |

Правила замены:

1. **Единая точка навигации.** В источнике вся навигация идёт через `navigate()`,
   а URL→стор проецирует ровно один `RouteSync`. В Next: `RouteSync` становится
   client-компонентом на `usePathname()` + `useRouter()`, монтируется в `(cu)/layout.tsx`
   ПЕРВЫМ ребёнком CuWorkspace. Запрет на второй писатель `activeId` сохраняется дословно.
2. **`Link`/`Breadcrumbs`** — двойная реализация недопустима; делаем тонкий адаптер
   `cu/shared/lib/routerLink.tsx`: компонент с тем же контрактом (to, className,
   children, aria) на `next/link`; внутренние ссылки секции — только через него.
   Внешние `href`-варианты Link остаются `<a target=_blank>`.
3. **`Navigate`** в TenderPage (редирект при неизвестном тендере) → `redirect()` нельзя
   (client) → эффект с `router.replace('/tenders')`.
4. **Lazy-границы**: страницы и AiDock грузились лениво (Suspense). В Next:
   `const CuTenderPage = dynamic(() => import('@/cu/pages/tender'), { ssr:false })`
   в route-файлах; AiDock оставить на `next/dynamic` внутри AnalysisDock.
5. **`import.meta.env.BASE_URL`** — исчезает вместе с basename; basePath Next не нужен
   (секция живёт в корневом пространстве `/tenders`).
6. **Outlet** → `{children}` в CuWorkspace; сигнатура Workspace меняется минимально.

### 2.3 Стор и SSR-границы

- zustand-стор — глобальный синглтон, провайдеров не требует: работает в Next как есть.
  Все потребители уже client components («use client» проставить на ВСЕ файлы cu/,
  содержащие хуки/события; проще всего — «use client» на barrel каждого слоя).
- SSR-нечувствительные места (падают при prerender):
  - `workspace-store.ts`: `matchMedia('(max-width:900px)')` при инициализации стора →
    ленивый инициализатор с guard `typeof window === 'undefined'` + догонка в effect;
  - `TenderPage.tsx`: `document.getElementById('ai-panel-slot')` → уже внутри
    effect/handler — проверить отсутствие прямого вызова на верхнем уровне рендера;
  - `Tooltip` (createPortal в body), Popover/Modal/Drawer (showModal) — только по событию,
    безопасно.
- Практическое правило: секцию целиком считаем client-rendered (`ssr:false` на страницах),
  SSR выигрышей не даёт (за AuthGuard) и рисков добавляет.

### 2.4 Состояние в URL

| Что | Источник | Целевое решение |
|---|---|---|
| активный раздел рейла | URL (RouteSync) | сохранить как есть |
| положение сайдбара | стор (`sidebarOpen`) | как есть («мебель» в URL не попадает) |
| табы карточки | состояние страницы | **ИЗМЕНИТЬ**: принять `?tab=` как в текущей карточке — deep-link на вкладку «Раунды» из уведомлений и восстановление F5; дефолт comparison |
| фильтры реестра | состояние страницы | как есть (осознанный долг прототипа) |
| workspace сравнения | **URL — `viewUrl.ts` (NEW 25.08)** | ПРИНЯТЬ сериализацию прототипа: короткие стабильные ключи `p/m/dev/dyn/pot/sort/f`, пишется ТОЛЬКО отличие от пресета, мусор в адресе не роняет экран. В Next: `useSearchParams` + `router.replace(scroll:false)`; `hasViewParams()` отличает «ссылку коллеги» от обычного входа. Решение В4 ЗАКРЫТО источником; ссылки старой карточки с `cmp-*` совместимости НЕ имеют — задокументировать в релизных заметках |

### 2.5 Зависимости `web/package.json` (diff)

```diff
 dependencies:
+  "@solar-icons/react": "^2.0.0",
+  "zustand": "^5.0.15",
   lucide-react ^1.25.0        # остаётся: весь остальной app
-  (react-router-dom НЕ добавляем — роутер Next)
 devDependencies:
+  "tsx": "^4"                  # запуск *.check.ts без bun (или оставить bun локально)
+  "@types/react": "^19"        # уже есть
```

TS: web — TypeScript ^5, источник — ^7. Конфликтов синтаксиса не обнаружено
(ES2022, обычные дженерики); `allowImportingTsExtensions` источника при переносе
заменяем на расширение-меньше импорты (Next не разрешает .ts-суффиксы) — механическая
правила импортов при MOVE, прогоняется codemod'ом за один проход.

tsconfig: paths `@/* → ./src/*` совпадают в обоих проектах; импорты cu/ оставляем
относительными внутри секции (как в источнике), наружу — только через `@/cu/...`.

### 2.6 Точки входа новой секции

```tsx
// web/src/app/(cu-shell)/layout.tsx  (NEW)
import "@/cu/styles/cu-global.css";      // ДО компонентов (правило ds-entry)
import { AuthGuard } from "@/components/AuthGuard";
import { CuProviders } from "@/cu/app/providers/CuProviders";
import { Workspace } from "@/cu/widgets/workspace";

export default function CuLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <CuProviders>          {/* SolarProvider(1.5) + ToastProvider */}
        <Workspace>{children}</Workspace>
      </CuProviders>
    </AuthGuard>
  );
}
```

```tsx
// web/src/app/(cu-shell)/tenders/page.tsx  (NEW)
"use client";
import dynamic from "next/dynamic";
export default dynamic(() => import("@/cu/pages/tender-registry"), { ssr: false });
```

`AuthGuard` переиспользуется текущий — он даёт JWT-гейт, MFA-setup редирект,
IdleSessionWatcher. Внутри cu/ токен читается адаптерами из `lib/apiClient.apiFetch`
(§4.0).

---

## 3. Конфликты с текущим `web/` и их разрешение

### 3.1 Два шелла в одном приложении

Факт: `(app)/layout.tsx` = `div.app-shell [Sidebar + .main-area(topbar + .content)]`;
из страниц с шеллом связана только карточка тендера (`useSidebarChrome` — сворачивает
rail при открытии панели Анализа, `tenders/[id]/page.tsx:12,303`). Реестр шелл не трогает.

Решение: маршрутная группа (§2.1) разводит каркасы полностью:

- старые `tenders/page.tsx` (25 стр.) и `tenders/[id]/page.tsx` (3 219 стр.) УДАЛЯЮТСЯ;
- `useSidebarChrome`-хук остаётся для прочих страниц, из карточки уходит вместе со старым кодом;
- `TopbarExtras` (колокольчик, чат-drawer, юзер-меню) остаётся только в старом шелле.
  Функции нового topbar (уведомления/юзер) — заглушки прототипа: либо оставить заглушками
  (scope), либо подключить к существующим API — решение §7.3-В1.

Проверить при удалении: ничто из прочих страниц не импортирует удаляемые файлы
(grep `from "./TendersRegistry"` / `tendersRegistry` — использует только сам реестр;
`chatStore.openChatDrawer` вызывают карточка И `QuotesInbox` — чат-drawer монтируется
в TopbarExtras старого шелла, поставщичьи страницы не страдают).

### 3.2 CSS: два мира в одном документе

Ситуация:

| | текущий web | переносимая ДС |
|---|---|---|
| модель | глобальные классы (~1 000) + inline-стили | CSS Modules (camelCaseOnly) |
| токены | `--bg/--surface/--accent/--s-*` (~25 шт.) | `--cu-*` (~120 шт.) |
| элементный каскад | `input/select/textarea/button {…}` на всё приложение (globals.css:62–99) | reset свой |
| базовый кегль | body 14px | body 13px antialiased |
| z-index | topbar 50, модалки ~100–1200 | rail 999 / topbar 1200 / menu 1300 / toast 1350 |

(Числа web — по состоянию на 25.08: `globals.css` — 6 164 строки.)

Точных коллизий имён классов нет (глобальные классы cu живут только в трёх
безопасных именах `.inline-edit/.visually-hidden/.route-fallback`). Реальные риски:

1. **Элементный каскад web протекает в cu-компоненты**: голый `input{padding;background}`
   испортит SearchInput/InlineInput/NumberInput/Select; `button{font-family}` — все кнопки.
2. **body 14px vs 13px** — вся пиксельная геометрия ДС рассчитана от 13px.
3. **z-index**: ChatDrawer/модалки web поднимаются до ~100+; cu-меню 1300 выше —
   приемлемо, но проверить overlay DialogHost (uiAlert поверх cu-страниц должен
   перекрывать: поднять или использовать внутри cu ConfirmDialog).

Решение — **compat-слой** `cu/styles/cu-compat.css`, подключаемый сразу после
cu-global.css, всё под корнем `.cu-root` (класс вешает `(cu)/layout.tsx` на обёртку):

```css
.cu-root {
  font-size: var(--cu-text-base);            /* 13px — база геометрии ДС */
}
/* гасим элементный каскад приложения внутри секции */
.cu-root input, .cu-root select, .cu-root textarea {
  font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0;
}
.cu-root button { font: inherit; }
```

Обратное направление (cu reset → чужие страницы) исключено самой архитектурой:
reset cu-global.css написан селекторами элементов — он ГЛОБАЛЕН и применится ко всему
документу! Поэтому **обязательное правило**: из cu-global.css элементные селекторы reset
(`*, h1..h6, ul, button {…}`, скрытые скроллбары) переписываются под `.cu-root …`
однократным префиксованием при MOVE (список селекторов конечен, ~15 блоков).
Правило `html,body{overflow:hidden}` из источника НЕ переносится вовсе — оно убьёт
прокрутку остальных страниц; высоту каркаса задаёт `.cu-root { height:100dvh }`.

Скроллбары: web их не скрывает, cu скрывает глобально — после префиксования скрытие
останется внутри `.cu-root` — соответствует эталону каркаса.

### 3.3 Иконки: Solar против lucide

- Обе библиотеки остаются в дереве: lucide — весь старый app, Solar — только cu/.
- `SolarProvider strokeWidth={1.5}` обязателен в CuProviders (толщина глифов — часть языка).
- Размеры/цвет иконок cu задаются CSS (`--icon-size`), не пропами — не «помогать» пропами.
- Колокольчик/аватар нового topbar — заглушки прототипа; если подключаем реальные данные
  (§7.3-В1) — берём данные из существующих lib (cabinetNotifications), иконки Solar уже есть.

### 3.4 Оверлеи: DialogHost vs нативные dialog

- `uiAlert/uiConfirm/uiPrompt` (DialogHost, promise-API) используются сотнями мест
  старого app. Переносимые страницы их НЕ используют — их подтверждения уходят на
  `ConfirmDialog` (нативный Modal), инлайн-редактирование — InlineInput/DatePicker.
- CellPopup — немодальный `show()` top-layer: конфликтов с DialogHost нет.
- Tooltip порталится в body — выпадет из `.cu-root`! Компат-слой должен повторять
  критичные токены на уровне `:root` (они и так в `:root` — ок), но font-size базы
  для порталов задать отдельным правилом `.cu-tooltip, body > .tooltip-portal {…}` —
  проверить фактический класс портала Tooltip при переносе.

### 3.5 Чаты и уведомления

- Карточка прототипа кнопки «чат» не имеет — функциональность чата специалист↔поставщик
  из старой карточки теряется (см. полный список потерь §7.2). ChatDrawer остаётся
  смонтированным в старом шелле для остальных страниц.
- Если решим кнопку вернуть (§7.3-В2): `openChatDrawer()` из `lib/chatStore` — это
  window-event; дергать его можно откуда угодно, НО drawer смонтирован в TopbarExtras
  старого шелла — на страницах cu он отсутствует. Значит: монтировать ChatDrawer
  дополнительно в CuProviders (компонент самодостаточен) — 1 строка.

### 3.6 Мелкие столкновения

| # | Столкновение | Разрешение |
|---|---|---|
| 1 | `page.module.css` (142) — сирота от скаффолда, не используется | удалить попутно |
| 2 | Класс `.content` (padding 24/28/60) не действует на cu-страницах | не нужен: Screen ДС сам управляет полем |
| 3 | Авто-refresh карточки каждые 20с (comparison+activity тихо) | поведение прототипа: перезагрузка руками; решить §7.3-В5 (рекомендую добавить тихий poll в useComparisonData позже) |
| 4 | localStorage-ключи (`tendersRegistryColumns_v1` и пр.) | старый реестр удалён — ключи мёртвые, чистить не обязательно |
| 5 | eslint-config-next против стиля источника | включить cu/ в lint постепенно; сначала `eslintIgnore` не нужен — правило `no-unused-vars` совпадает |

---

## 4. Слой данных: адаптеры

### 4.0 Общие правила

- Единственная дверь к сети — существующий `web/src/lib/apiClient.ts::apiFetch`
  (JWT из localStorage, 401 → редирект /login, `apiErrorMessage` для detail).
  Адаптеры cu/ вызывают ТОЛЬКО его; внутри cu не заводится второй fetch-обёртки.
- Адаптеры живут в `cu/entities/*/api/*.api.ts` — ровно те же имена функций, что были
  у моков (`fetchTenders`, `fetchTender`, `fetchComparison`, `requestAnalysis`,
  `simulateNextSubmission`). Экраны не меняются вообще — это и есть замысел «двери».
- Моки НЕ удаляются: остаются рядом (`*.mock.ts`) для превью ДС и офлайн-разработки;
  наружу из barrel по-прежнему не реэкспортируются.
- Все id: бэкенд — number, контракт прототипа — string. Конвертация `String(id)`
  в адаптерах, ключи словарей (`prices`, `marks`) — всегда строковые.

### 4.1 Реестр: `fetchTenders()`

**Проблема:** плоского `GET /tenders` в бэкенде НЕТ. Список живёт деревом
`GET /portfolios` (PortfolioTender внутри узлов), суммы — отдельным отчётом.

Адаптер:

```
fetchTenders():
  1. GET /portfolios → flattenPortfolios()  // код уже есть: web/src/lib/tendersRegistry.ts
     → TenderRegistryRow { id, number, title, work_type, status, needs_attention,
                           responsible, start, end, created_at }
  2. GET /reports/tenders (опционально, Фаза 3+) → { id → kpCount, minPrice, maxPrice }
     → мердж по id, если решили показывать суммы (сейчас колонок сумм в прототипе нет)
  3. map → TenderRow {
       id: String(id),
       title,
       portfolio: имя узла-портфеля,
       project: путь проектов («Корпус 1 / Отделка МОП»),
       kind: work_type,
       status: draft|open|closed|cancelled  — 1:1,
       owner: responsible,
       start/end/created: ISO → ДД.ММ.ГГГГ (lib/date.isoToDmy; created_at → дата без времени)
     }

fetchTender(id): GET /tenders/{id} → TenderRow|null (те же поля + ничего лишнего:
карточка читает только сводку TenderSummary; остальное живёт в comparison).
```

Копирайт: подписи статусов прототипа («Открыт») vs текущего web («Сбор предложений»)
— выбрать один глоссарий на приложение (рекомендация: прототипные, они короче;
расхождение с остальными страницами допустимо до финального глоссария).

Фильтрация — клиентская (`applyFilters`), как в прототипе. Объём данных реестра
(десятки–сотни строк) это позволяет; серверную фильтрацию не закладываем.

### 4.2 Карточка-сводка: `bidsDue()`, раунды в hero

`bidsDue(row)` остаётся чистой клиентской функцией от `row.end`. Активный номер раунда
для hero берётся из comparison (`active_round_number`), не отдельным запросом.

### 4.3 Сравнение: `fetchComparison({tenderId, round?})`

Источник: `GET /tenders/{id}/comparison?versions=&spread_notice=&spread_high=&anomaly_k=&key_share=`
(ответ собирается `build_comparison()` + `analytics_from_comparison()`; pydantic-схем
нет — контракт де-факто = `ComparisonData` из tendersApi.ts).

Пороги из useCompareScreen прокидываются в query как есть (бэкенд понимает те же
имена параметров). Ответ маппится:

```
ComparisonData                          → Comparison
─────────────────────────────────────────────────────────────────────
sections[]                              → groups: PositionGroup[]
  {id, name, parent_section_id,            {id: String(id), title: name,
   order_index, item_ids}                   positions: items по item_ids в порядке order_index}
items[]                                 → ComparePosition[]
  {id, name, quantity, unit,               {id: String(id), title: name, qty: quantity ?? 1,
   original_quantity, is_removed,           unit, key: analytics.works[id].is_key_work,
   is_corrected}                            qtyOrig: original_quantity ?? undefined,
                                            removed: is_removed || undefined}
suppliers[]                             → Contractor[]
  supplier_id/supplier_name              → id: String(...), name
  quote_status                           → status: submitted→'complete',
                                            revision_requested→'revision',
                                            draft→'partial', withdrawn→'partial'
                                            (bidStatus() устойчив к незнакомым)
  fill_progress                          → fill: ПЕРЕСЧИТ % ПО СТОИМОСТИ (§4.4)
  items{}                                → prices: Record<posId, number>
                                            rate = cell.normalized_rate (analytics)
                                            ?? total / qty   ← см. §4.4-1
                                            ключ отсутствует → позиция не закрыта
                                            total===0 → цена 0 (обычная ставка)
  declined                               → marks[posId].declined
  quantity_override/review_status/comment→ marks[posId].correction {qty, status, note}
  condition_values × condition_fields    → conditions: склейка "field_name: value"
                                           terms: SupplierTerm[] {id, label, value,
                                           kind:'value'} — kind бэкенд не отдаёт (§4.6-в8)
  awaiting_round_number                  → НЕ submittedInRound! это «ждём ответ» (§4.6-б7)
active_round_number                     → roundNumber
tender_revision                         → revision: String(tender_revision)
analytics.works[wid].cells[cid]         → marks[posId].anomaly: is_anomaly ? причина :
                                            deriveAnomalies локально при отсутствии
                                            (см. §4.4-3) ; potential — семантика другая,
                                            НЕ маппить (§4.6-в3)
—                                       → prevPrices/prevConditions: второй запрос (ниже)
—                                       → rounds: отдельный запрос (§4.5 ниже таблицы)
```

Прошлый круг подрядчика (`prevPrices/prevConditions`): повторный
`apiFetch('/tenders/{id}/comparison?versions={sid}:{n}')` c пином версий каждого
поставщика на предыдущую (n = quote_version_number − 1), мердж в тот же снимок.
`useComparisonData` уже делает второй запрос — меняется только источник.

`simulateNextSubmission()` — DROP: подача КП в проде приходит от поставщика
через `/invite/{token}/quote`. Демо-кнопка «подать следующее КП» удаляется
вместе с курсором таймлайна.

**Мутации двери (NEW 25.08).** Прототип перестал быть read-only — в
`comparison.api.ts` появились две записи:

- `decideCorrection({tenderId, contractorId, positionId, decision, ...})` → бэкенд:
  маршрут ревью корректировки объёма (`quantity_override/review_status/comment`
  уже приходят в снимке сравнения; точный путь PATCH сверить по `quotes.py`
  при работе — контракт полей совпадает с §4.3-marks);
- `selectBidVersion({...})` → семантику сверить на стенде: скорее всего это
  ЧТЕНИЕ с пином `versions={sid}:{n}` (§4.3 prev-round), а не запись.

Обе отвечают `boolean` и НЕ БРОСАЮТ наружу (правило мутаций сохраняется).

> **СТАТУС 25.08, позднее — обе подключены.** `decideCorrection` ходит в
> `POST /tenders/{id}/quote-items/{item_id}/review`; `selectBidVersion` —
> чтение с пином, как и предполагалось: выбор хранится в двери
> (`versionPicks`), перечитывает снимок с `versions={sid}:{n}`. Список версий
> колонки (§5.5) приезжает в самом снимке: `ComparisonSupplier.versions[]`
> (номер, дата, признак «разобран», расценки прошлых редакций; у текущей их
> нет — они уже в items). Экспорт (`requestExport`) тоже живой — blob с
> `full=true` и тем же пином версий.

### 4.4 Что досчитывает клиент (даже при живом analytics)

| # | Что | Как |
|---|---|---|
| 1 | Цена за единицу | приоритет: `analytics.works[wid].cells[cid].normalized_rate`; фолбэк `total/qty` |
| 2 | `fill` (% ПО СТОИМОСТИ) | Σ cost закрытых позиций / weight_sum_median_costs из analytics; серверный fill_progress (штуки) не используем |
| 3 | Причина аномалии строкой | сервер даёт boolean `is_anomaly`; человекочитаемую причину формирует клиент из deviation/excluded_reason, либо оставляем deriveAnomalies как источник текста |
| 4 | spread «от минимума» | бэкенд считает `(max−min)/median`; прототип — `/min`. Оставить клиентскую формулу (calc.spread) и НЕ спорить с серверной до решения §7.3-В3 |
| 5 | bestId | лучшая НЕаномальная цена — calc.ts как был |
| 6 | metricTotals (best+потенциал торга) | calc.ts; серверные totals_min/max — другой смысл (полные КП) |
| 7 | correctionsBy (счётчик ⚠ на колонку) | свёртка volume_pending-ячеек на клиенте |
| 8 | keyDerived по весу max-price | если принимаем серверный key_work_ids (медианная база веса) — клиентское правило выключить; РЕШЕНИЕ §7.3-В3 |
| 9 | submittedInRound | сборка: match supplier.quote_version_number ↔ rounds[].recipients[].quote_version_number |
| 10 | submitted (дата подачи), inn, contact | НЕТ в ответе; inn/contact — дозапрос `/suppliers/{id}` лениво при открытии DossierModal; submitted — из versions-API (`submitted_at`) |

Остающееся клиентским навсегда (не гэп): thresholds.clampThresholds, filters.ts целиком,
view.ts целиком (оси/пресеты/cellLines), bidsDue, словари STATUS/BID_STATUS,
analyzeComparison как единый проход производных (серверные named_filters могут
ускорить счётчики, но не заменяют модель RowFacts).

### 4.5 ИИ-разбор: две модели и поэтапное решение

Несовместимость: прототипная секция — типизированные `AnalysisItem`
(refs/evidence/transition/mute/note, лимиты ANALYSIS_LIMITS, brief, popupNotes);
серверная — `{sections[{blocks[{paragraphs[{segments: text|token[]}], preset, filters,
insight_ref}]}], summary_pins, freshness}` — текст с кликабельными токенами.
Полей mute/brief/popupNotes в бэкенде нет; сценарии SCENARIO_LABELS бэкенда —
надмножество прототипных.

**Этап A (делаем в основном пути): панель работает на локальном движке.**
`requestAnalysis(query)` продолжает звать `buildAnalysis(comparison, prev, thresholds)`
— но comparison теперь ЖИВОЙ (адаптер §4.3). Панель, чат-триггер, переходы в таблицу,
stale-плашки работают сразу, ноль изменений бэкенда. askAi/DEMO_DELAY остаются демо.

**Этап B (следующая итерация): переключение двери на сервер.**
Тело `requestAnalysis` → `GET /tenders/{id}/insights?mode=&scenario=…`;
`useAnalysisRuns.runs` → `insights/latest` + `/history`; stale — серверный
`freshness{status,reason}` вместо клиентского Staleness; apply-гейт —
`POST /insights/{rid}/apply` с acknowledge_stale. UI AnalysisDock дорабатывается
под blocks-with-tokens (RichText уже рендерит мини-разметку — токены ложатся естественно);
deriveInsights блока «Анализ» заменяется карточками `TenderInsight`
(type good/warn/bad ↔ tone, evidence/table_transition маппятся 1:1 на refs/transition).

Что теряется на этапе B (до доработки бэкенда): brief {verdict,findings,why,recommendation},
mute-пункты, popupNotes к ячейкам, лимиты прототипа (у сервера свои).

### 4.6 Раунды: `ComparisonRound[]` ← `GET /tenders/{id}/rounds`

```
TenderRound                      → ComparisonRound
{id:number}                      → id: String(id)
{round_number}                   → number
{status: draft|sent|closed}      → sent→'current', closed→'closed',
                                   draft → НЕ отображать (в прототипе черновика нет;
                                   RoundsPanel показывает только отправленные)
{recipients[].filter(included)}  → invited: recipients.filter(r=>r.included).map(String(supplier_id))
{message_all, personal_comment, доставка, send/close/preview/retry API} — вне контракта
                                   сравнения; управление раундами в прототипе ограничено
                                   (RoundsPanel — витрина); полный функционал управления —
                                   потеря старой карточки (§7.2-9)
```

`snapshotRound()/hasPreviousRound()` продолжают работать от `roundNumber`.

### 4.7 Сводная таблица гэпов (из полевой сверки)

**(а) Чистый адаптер — дёшево (все входят в Ф3/Ф4):**
1. Contractor name/status/id ← supplier_name/quote_status/supplier_id
2. ComparePosition ← ComparisonItem (number→string, name→title, qtyOrig, removed)
3. PositionGroup ← sections + группировка items
4. CellMark.declined ← declined; отсутствие ключа = не закрыта; ноль = 0
5. QtyCorrection ← quantity_override/review_status/comment (pending↔null/"pending")
6. SupplierTerm[] ← condition_fields × condition_values
7. ComparisonRound ← TenderRound (sent→current, invited←recipients.included)
8. TenderRow[] ← дерево портфелей (flattenPortfolios готов)
9. TenderInsight → карточки Insights (этап B)
10. conditions[] ← склейка field_name:value
11. postComment ← POST /comments?entity_type=tender_item (NEW 25.08, §4.8; author ставит сервер из JWT)
12. requestExport ← GET /tenders/{id}/comparison/export — эндпоинт СУЩЕСТВУЕТ (tenders.py:410, §4.9)

**(б) Вычисления клиента — средне (Ф4):**
единичная ставка (§4.4-1); fill по стоимости (-2); spread от минимума (-4); bestId (-5);
correctionsBy (-7); metricTotals/keyDerived база веса (-6/-8); submittedInRound (-9);
prevPrices/prevConditions вторым запросом; staleness (этап A — клиентский, B — серверный);
bidsDue; deriveInsights/buildAnalysis этапа A.

**(в) Изменения бэкенда — дорого (отложено, трекинг §7.4):**
1. `revisionNote` — текст причины последнего изменения (сейчас негде взять даже косвенно) — **открыт**
2. Причина аномалии строкой (сейчас boolean is_anomaly) — клиент выводит текст сам (§4.4-3); серверный текст не нужен — **снят с учёта**
3. Заявленный запас торга ₽/ед. как входное данное → **ЗАКРЫТ 25.08, позднее**:
   колонка `quote_items.negotiation_potential`, приезжает в ячейки снимка, адаптер кладёт в `marks.potential`
4. mark.note / popupNotes с персистентностью → частично закрыт тем же путём
   (`awaiting_reply` — «ждём ответ по ячейке» стал данными строки КП; текстовые заметки-попапы остаются открытыми)
5. submittedInRound явным полем — собирается из rounds.recipients корректно — **снят с учёта**
6. submitted (дата КП), inn, contact в ComparisonSupplier → **ЗАКРЫТ 25.08, позднее**:
   снимок несёт `submitted`, `inn`, `contact`; досье колонки обходится без дозапроса
7. fill по стоимости на сервере (или принять клиентский расчёт (б)) — принят клиентский — **снят с учёта**
8. kind ('bool'|'value'|'note') для condition_fields в comparison → **ЗАКРЫТ 25.08, позднее**:
   `field_type` приезжает в condition_fields (к словарю добавлен 'note'), адаптер маппит 1:1
9. Ручная пометка key на позиции (сейчас только выведенная is_key_work) — **открыт**
10. Плоский GET /tenders с суммами/количеством КП (или жить на /portfolios+/reports/tenders) — живём на дереве — **открыт** (низкий приоритет)
11. Секционный контракт анализа с typed items/brief/mute/popupNotes (если хотим паритет прототипа на этапе B) — **открыт** (этап B)
12. **NEW 25.08**: пакетная выборка комментариев тендера — прототипу нужна ОДНА выборка
    всего треда (`fetchComments(tenderId)` — маркеры рисуются у каждой ячейки заранее),
    бэкенд умеет только поштучный `GET /comments?entity_type=&entity_id=`;
    нужен `GET /tenders/{id}/comments` (иначе 650 запросов на экран)
    → **ЗАКРЫТ 25.08, позднее**: эндпоинт `GET /tenders/{id}/comments` работает
    (tenders.py), дверь cu читает его; вместе с в12-бис — поле
    `comments.supplier_id` (миграция `migration_comments_supplier.sql`) даёт клиенту
    вторую половину ключа треда «подрядчик:позиция».
13. **NEW 25.08**: отметка просмотров комментариев («отметить всё просмотренным» —
    ЗАПИСЬ, результат видит только этому пользователю; эндпоинта нет)
    → **ЗАКРЫТ 25.08, позднее**: таблица `comment_reads` (своя отметка на пользователя,
    миграция `migration_comparison_marks.sql`), батч отдаёт `read` по записи,
    запись гасится `POST /comments/read` {ids?} — без ids гаснет весь тред ячейки;
    свои записи автор читает в момент отправки.

### 4.8 Комментарии ячеек: `fetchComments` / `postComment` ← `/comments`

Дверь появилась 25.08 (`entities/comparison/api/comments.api.ts`, модель
`model/comments.ts`, хук `useCellComments.ts`). Бэкенд уже имеет полиморфный ресурс
`GET|POST /comments` (роутер `comments.py`; entity_type из
`tender|quote|tender_item|supplier`, один уровень вложенности `parent_comment_id`):

```
CellComment.id            ← id:number → String(id)
CellComment.parentId      ↔ parent_comment_id (один уровень вложенности — совпадает)
CellComment.author        ← author_name: КЛИЕНТСКИЙ проп author в адаптере ОТБРОСИТЬ —
                            автора ставит сервер из JWT (прототипный проп остаётся
                            в сигнатуре двери, адаптер его игнорирует)
CellComment.at            ← created_at "%d.%m.%Y %H:%M" → формат «словами»
                            ('только что'/'сегодня 14:05'/дата) делает адаптер
postComment{text,...}     ← POST /comments {entity_type:'tender_item',
                            entity_id:Number(positionId), comment_text,
                            parent_comment_id?}; пустой текст не отправлять
commentKey(contractorId, positionId) — клиентский ключ треда; серверу известен
                            только positionId: автор треда восстанавливается из
                            первого комментария (или гэп в12-бис: supplier_id в ответе)
```

ЧТЕНИЕ упирается в гэп в12 (пакетная выборка): до его закрытия адаптер ставит
заглушку «треды недоступны», НЕ обходя все items запросами.

> **СТАТУС 25.08, позднее — дверь ЖИВАЯ.** Чтение — `GET /tenders/{id}/comments`
> одной выборкой (в12 закрыт); ключ треда клиент собирает из пары
> `supplier_id × entity_id` (в12-бис закрыт: колонка `comments.supplier_id`,
> POST принимает её, ответ наследует от родителя). Запись — `POST /comments`.
> Просмотренность — на сервере (в13 закрыт): `comment_reads` + `POST /comments/read`,
> батч несёт `read` по каждой записи, непрочитанные светятся бейджем.

### 4.9 Экспорт .xlsx: `requestExport` ← `/tenders/{id}/comparison/export`

Эндпоинт существует и зрелый (`tenders.py:410`: `build_comparison_workbook`,
`prepare_comparison_for_export` скрывает часть колонок в режиме коммерческой
тайны). Дверь прототипа появилась 25.08 (`api/export.api.ts` + `ExportButton/
ExportDialog`):

- состав файла — канон `EXPORT_CONTENT` (5 пунктов чеклиста модалки), галочки
  показывают канон, не набирают его;
- имя файла считает `exportFileName()` на клиенте ДО запроса и сверяет с ответом;
- выгрузка фиксирует ИМЕННО открытые версии (`versions=` пин) — строка
  «Выбранные версии зафиксированы» идёт в модалку из данных экрана;
- ответ — blob; событие ИБ логирует сервер (права проверяет он же).
Клиентская часть — MOVE без изменений, адаптер подставляет apiFetch+blob.

---

## 5. План работ: фазы и чек-листы

Оценки — в рабочих днях одного фронтендера, при решённых вопросах §7.3.
Каждая фаза заканчивается состоянием «приложение собирается, старые страницы живы».

### Ф0. Подготовка целевого репо (0.5 дня)

- [ ] Ветка `feat/cu-integration`.
- [ ] `web/package.json`: + `@solar-icons/react`, + `zustand`, + devDep `tsx`.
- [ ] `npm install`, проверить сборку `npm run build` до изменений.
- [ ] Создать каркас каталогов: `web/src/cu/{app,shared,pages,widgets,features,entities,lib}`.
- [ ] Договориться о глоссарии статусов (§4.1) и URL-решениях (§2.2, §2.4) — 30 минут с ПМ.
- **DoD:** пустые каталоги, сборка зелёная, решения записаны в этот файл (§7.3 отмечены).

### Ф1. Дизайн-система (2–3 дня)

Порядок внутри фазы: токены → lib → примитивы → сложные составные. Каждый компонент
после переноса обязан проходить typecheck; визуальная проверка — на превью-странице
`/cu-preview` (временный маршрут, удаляемый в Ф6).

- [ ] MOVE `app/styles/global.css` → `cu/styles/cu-global.css` С ПРЕФИКСОВАНИЕМ
      элементных селекторов reset под `.cu-root` (§3.2; список ~15 блоков);
      НЕ переносить `html,body{overflow:hidden}`, `#root{height:100%}`;
      `.route-fallback` можно оставить глобальным (имя свободно).
- [ ] NEW `cu/styles/cu-compat.css` (базовый кегль, гашение элементного каскада, §3.2).
- [ ] MOVE `shared/lib/*` (cx, date, plural, reducedMotion, roving, toggle, useAsync)
      + все `*.check.ts` слоёв.
- [ ] MOVE примитивы (без зависимостей от роутера): Badge, Button, IconButton, Icon
      (+icon-map, local-icons), Typography, Micro-семья, Layout-семья, Card, Field,
      Input/Textarea, NumberInput, Checkbox, Radio, Switch, Skeleton, Spinner,
      VisuallyHidden, Counter, Progress, Divider.
      Для каждого: «use client» там, где хуки/DOM-события.
- [ ] MOVE оверлеи: Modal, Drawer, Popover, CellPopup, Tooltip, Dropdown-семья
      (Dropdown/DropdownGroup/MenuItem/MenuPanel/MenuCheckItem), ConfirmDialog, Toast.
- [ ] MOVE календари: Calendar (+DatePicker), RangeCalendar.
- [ ] MOVE составные: Table, Tabs, Segmented, Select, SearchInput, SearchTrigger,
      FacetFilter, Pagination, ScrollArea (+use-scrolled), EmptyState, ErrorState,
      Alert, Avatar, Breadcrumbs(PORT §2.2), Link(PORT), InlineInput, Page-семья,
      Tree/TreeRow/NestedTreeNode, ButtonGroup, ColorPicker(+color.ts+check),
      ProgressBar (52-й слайс, NEW 25.08).
- [ ] PORT `Link` и `Breadcrumbs` на адаптер routerLink (единственные роутерные).
- [ ] NEW `cu/app/providers/CuProviders.tsx`: SolarProvider(strokeWidth 1.5) +
      ToastProvider (+ ChatDrawer при решении §3.5).
- [ ] NEW временный `/cu-preview`: сетка всех компонентов на живых токенах.
- **DoD:** typecheck зелёный; превью визуально сверено со стендом прототипа
  (`bun run dev` источника рядом); check-скрипты color/date проходят (`npx tsx`).

### Ф2. Каркас (2–3 дня)

- [ ] MOVE+PORT `entities/workspace/model/workspace-store.ts`
      (guard `typeof window` для matchMedia, §2.3).
- [ ] MOVE `features/flyout` (use-flyout, Flyout) — без роутера, чистый MOVE.
- [ ] ADAPT `entities/section`: деревья `contentFor()` переписать под реальные разделы:
      TENDERS → ссылки реестра/карточки; MORE/ADMIN → существующие маршруты web
      (/suppliers, /catalog/*, /settings…); HOME → /home или заглушка. NAV_TOP — те же 5.
- [ ] PORT `widgets/topbar/*` (Topbar, WorkspaceSwitcher, UserMenu, NotificationsBell):
      роутера нет — только «use client»; решить наполнение колокольчика (§7.3-В1).
- [ ] ADAPT `widgets/rail/*`: useLocation/useNavigate → usePathname/useRouter;
      RailItem `<a>`+перехват → routerLink.
- [ ] ADAPT `widgets/sidebar/*`: pathname/navigate → next/navigation; Tree остаётся.
- [ ] PORT `widgets/workspace/ui/Workspace.tsx`: Outlet → {children}; #ai-panel-slot
      сохранён; «use client».
- [ ] NEW `RouteSync.tsx` (client): usePathname → sectionFromPath → syncFromRoute
      в useLayoutEffect; смонтировать в layout ПЕРВЫМ ребёнком CuWorkspace.
- [ ] NEW `(cu)/layout.tsx` по §2.6 (AuthGuard + CuProviders + cu-global.css первым).
- **DoD:** на любом тестовом маршруте группы виден каркас: рейл с превью, дерево,
  сворачивание, узкий экран (<900px) всплывает; стор переключается кликом по рейлу
  без смены URL; прямой заход по URL подсвечивает раздел.

### Ф3. Реестр тендеров (1.5–2 дня)

- [ ] NEW `cu/entities/tender/api/tenders.api.ts` — тело из мока на apiFetch (§4.1);
      flattenPortfolios переиспользовать из `@/lib/tendersRegistry` (не дублировать).
- [ ] MOVE `entities/tender/model/tender.ts` + filters + index (ADAPT tenderPath:
      адрес карточки = `/tenders/${id}` — URL целевого приложения).
- [ ] MOVE `pages/tender-registry/ui/RegistryFilters.*`.
- [ ] PORT `TenderRegistryPage`: Link→routerLink, navigate→useRouter;
      SecondaryHeader табы остаются локальным состоянием.
- [ ] NEW route `app/(cu-shell)/tenders/page.tsx` (dynamic import, ssr:false);
      DELETE старых `app/(app)/tenders/page.tsx`.
- [ ] Смоук: список грузится живыми данными, фильтры/поиск/период работают,
      клик по строке ведёт на /tenders/{id} (пока — старая карточка!),
      ErrorState при поднятом backend, Skeleton при медленной сети.
- **DoD:** реестр полностью на новых рельсах, старый код реестра удалён,
  карточка ещё старая — совместимость переходов проверена.

### Ф4. Карточка: сравнение и раунды (4–6 дней)

- [ ] MOVE модель целиком: columns(+check), compareFormat (539!), scroll-parent,
      useBandMaxHeight, useBandWidth, useTableDock, useCellComments (NEW).
- [ ] REWRITE `useComparisonData.ts`: два вызова fetchComparison (текущий + пин версий
      прошлого круга), submitNext → DROP.
- [ ] ADAPT `useCompareScreen.ts` (источник данных уже новый; flash/переходы без изменений;
      вид сериализуется viewUrl — строка ниже).
- [ ] Подключить `viewUrl.ts` к Next: serializeView/parseView через useSearchParams +
      router.replace(scroll:false); hasViewParams() отличает ссылку коллеги от обычного
      входа (§2.4 — решение В4). SliceLink MOVE без правок.
- [ ] MOVE ui-дерево сравнения: TenderCompare(+css 2167), CompareToolbar,
      CompareSettings, BidCell, CellCard(NEW), CommentThread(NEW), CorrectionPanel(NEW),
      CutLine(NEW), ExportButton+ExportDialog(NEW), GhostColumn(NEW), InviteDialog(NEW),
      PotentialCell(NEW), SliceLink(NEW), CompareRow, SpreadCell, TotalRow, ContractorCard,
      CornerTab, DossierModal, TermsBand, ColumnPainter, CompareLegend, assets/*
      (8 глифов), TenderSummary, RoundsPanel.
- [ ] NEW адаптер comparison (§4.3): маппинг ComparisonData→Comparison + analytics
      (normalized_rate/potential/pair_deltas/named_filters), пороги в query,
      второй запрос prevPrices/prevConditions.
- [ ] NEW мутации адаптера: decideCorrection / selectBidVersion (§4.3, семантику
      selectBidVersion сверить на стенде — возможно чтение с пином versions).
- [ ] NEW адаптер rounds (§4.6) + submittedInRound-сборка (§4.4-9).
- [ ] NEW адаптер комментариев (§4.8): postComment работает сразу; чтение тредов —
      ЗАГЛУШКА до закрытия гэпа в12; просмотренность — гэп в13.
- [ ] NEW адаптер экспорта (§4.9): requestExport → /comparison/export, blob + имя файла.
- [ ] PORT `TenderPage.tsx`: useParams/Navigate→next; портал в #ai-panel-slot;
      табы → `?tab=` (§2.4); заглушки вкладок Уточнения/КП/Обзор/Документы/Активность
      оставить ScreenPlaceholder (потери §7.2 зафиксированы).
- [ ] NEW route `app/(cu-shell)/tenders/[id]/page.tsx`; DELETE старой карточки
      `app/(app)/tenders/[id]/page.tsx` (3 501 стр.) — ПОСЛЕ этого удалить
      useSidebarChrome-импорт (сам компонент остаётся другим страницам).
- [ ] Смоук на демо-тендере: таблица, липкая шапка/колонка, панорама на узком окне,
      CellPopup (+CellCard), инлайн-объёмы (qtyOrig diff), корректировки (решение
      уходит на бэкенд и возвращается решённым), матрица условий, раунды, dossier,
      звёзды/фильтры/пресеты, комментарий ячейки отправляется и виден, экспорт
      скачивает .xlsx, переход ширины колонок монотонен (columns.check зелёный),
      ссылка с ?p=&m=… воспроизводит срез (viewUrl.check зелёный).
- **DoD:** обе страницы живут на живом бэкенде; старая карточка удалена;
  глубокие ссылки `/tenders/{id}?tab=rounds` и ссылки среза работают.

### Ф5. Панель ИИ-анализа (этап A) (2–3 дня)

- [ ] MOVE features/ai-analysis: model/* (analysis, narration, insights, askAi,
      useAnalysisRuns), ui/* (AnalysisDock, AiDock dynamic, AiTrigger, RichText,
      SparkGlyph), dockId.
- [ ] ADAPT analysis.api.ts: query собирается из ЖИВОГО comparison; DEMO_DELAY оставить
      до этапа B; vetNote/applyNarration без изменений.
- [ ] Проверить портал AnalysisDock → #ai-panel-slot (слот из Ф2); открытие панели
      закрывает сайдбар навсегда (стор) — поведение эталона.
- [ ] stale-плашка: клиентский Staleness по rev+thresholds (серверная freshness — этап B).
- **DoD:** разбор строится по живым данным раунда, переходы из разбора применяют
  пресет/фокус к таблице, повторное открытие восстанавливает runs по номеру раунда.

### Ф6. Чистка и стабилизация (1.5–2 дня)

- [ ] DELETE `/cu-preview`, временные экспорты, console.log.
- [ ] Прогнать ВСЕ assert-скрипты (§6.1) и css-modules чекер (§6.2).
- [ ] eslint на cu/ — включить каталог, почистить замечания.
- [ ] Проверить вес бандла: pages/tender должен быть отдельным chunk (dynamic),
      AiDock — вложенным chunk; lucide не должен попасть в cu-chunk.
- [ ] Обновить `COMPONENTS.md`-эквивалент? — НЕТ: реестр компонентов остаётся в
      aag.tender; в cu/ добавить README с картой слоёв и правилами (ссылка сюда).
- [ ] Docker-сборка web (`docker compose build web`) и прогон стенда one-shot.
- **DoD:** зелёные проверки, стенд поднят, сквозной сценарий §6.3 пройден руками.

### Ф7. Закрытие функциональных потерь (отдельная оценка, §7.2)

Каждый пункт — мини-проект «достроить экран прототипа»: данные есть (эндпоинты живые),
нет UI в новом дизайне. Порядок предлагаю по частоте использования:
КП/приглашения → Уточнения/корректировки → Документы → Активность → Обзор(KPI) →
чат-кнопки → победитель/баннер завершения → Excel-выгрузки.

---

## 6. Проверки качества

### 6.1 Assert-скрипты источника (переносятся вместе со слоями)

Запуск в целевом репо: `npx tsx <путь>` (bun не обязателен; скрипты — чистый
node:assert + TS). Список:

| Скрипт | Что ловит | Слой |
|---|---|---|
| `shared/lib/date.check.ts` | разбор ДД.ММ.ГГГГ (31.02 → null, а не 3 марта), daysUntil, DST | shared/lib |
| `entities/tender/model/tender.check.ts` | bidsDue-режимы, фильтры периода | entities/tender |
| `entities/comparison/model/comparison.check.ts` | rankBids/spread/analyzeComparison — 948 строк контракта счёта | entities/comparison |
| `entities/comparison/model/terms.check.ts` | termRows объединение по label | entities/comparison |
| `entities/comparison/model/viewUrl.check.ts` | сериализация вида ↔ URL, устойчивость к мусору в адресе | entities/comparison |
| `features/ai-analysis/model/analysis.check.ts` | buildAnalysis секции/лимиты | features |
| `features/ai-analysis/model/insights.check.ts` | deriveInsights пороги | features |
| `pages/tender/model/columns.check.ts` | монотонность ширин колонок | pages/tender |
| `shared/ui/ColorPicker/color.check.ts` | hsv↔rgb, parse css-цвета | shared/ui |

Добавить npm-script: `"check:cu": "tsx src/cu/shared/lib/date.check.ts && …"` (все девять).
Адаптеры данных покрываются НИМИ ЖЕ частично (чистые функции), но сетевые маппинги
тестируются только смоуком на стенде — автотестов в обоих проектах нет.

### 6.2 CSS-modules чекер

`python3 .claude/skills/fsd-component/scripts/check_css_modules.py` из aag.tender —
ищет классы, объявленные в модуле и не применённые ни одним потребителем.
Норма — ноль. После MOVE прогнать по `web/src/cu/**`; скрипту безразличен корень.

### 6.3 Сквозной ручной сценарий приёмки

1. Логин (JWT) → `/tenders`: каркас cu, реестр живыми данными, табы/фильтры.
2. Клик по тендеру → карточка: сводка (bidsDue корректен у просрочки),
   таблица сравнения на живом тендере с ≥3 КП.
3. Ячейка: CellPopup с полями; аномальная ячейка помечена; отказ виден;
   комментарий отправляется, ответ в треде виден (чтение тредов — до гэпа в12).
4. Инлайн-объём: правка сохраняется (PATCH), qtyOrig-diff показывается.
5. Пресеты Обзор/Торги/Аномалии переключают оси; «Вернуть мой вид» после перехода из разбора.
6. Раунды: снимок прошлого круга (prevPrices) строит секцию «Изменения поставщика».
7. Анализ: панель открывается, сайдбар уходит, разбор по живым данным,
   переход из пункта разбора подсвечивает строку (flash 5.3s).
8. Узкое окно 1100px: панорама колонок, якорная колонка липкая и в DOM (`scope=row`).
9. F5 на `/tenders/{id}?tab=rounds` — вкладка восстановлена.
10. Выход из cu-секции: `/suppliers` — старый шелл цел, стили не текут (compat §3.2):
    проверить SearchSelect старой страницы визуально после посещения cu-страниц
    (глобальный reset cu НЕ должен был доехать — префиксование Ф1).

### 6.4 Регресс старого приложения

После Ф4/Ф6 прогнать смоук старых страниц: suppliers (+id), quotes(+id), budget(+id),
chats, cabinet, settings, users, reports, questionnaires, portfolios, templates,
notifications, fill/[token]. Особо: страницы, использующие uiAlert/uiConfirm и
ChatDrawer — они делят документ с новой секцией.

---

## 7. Риски, потери, открытые решения

### 7.1 Что замораживается в источнике

| Артефакт | Причина заморозки | Действие |
|---|---|---|
| `src/ds-entry.ts` + `vite.lib.config.ts` + `build:ds` | library-сборка ДС бандлит react-router внутрь и живёт MemoryRouter; в merged app роутера RR нет — сборка сломается или увезёт next/link | FREEZE в aag.tender до решения о Claude Design синке |
| `.design-sync/` (конфиг, NOTES, previews) | зависит от ds-dist | FREEZE вместе с ds-entry |
| `scripts/profile-compare.mjs` | puppeteer против vite preview | остаётся в источнике; для merged использовать next build && next start руками |
| `index.html`, `base:'/aag.tender/'` | GitHub Pages SPA | DROP |
| bun.lock / scripts dev/build | заменяются Next | DROP |

Правило параллельной жизни: пока интеграция идёт, aag.tender продолжает жить своей
жизнью (это макет-полигон). Изменения ДС/каркаса делаем В ИСТОЧНИКЕ и повторяем
MOVE'ом diff'а в cu/ (однонаправленная синхронизация источник→цель до Ф7;
после Ф7 вопрос обратной синхронизации решать отдельно — риск расхождения).

### 7.2 Потери функционала при замене карточки (обязательный учёт)

Текущая карточка (3 219 строк) умеет; прототип — заглушка ScreenPlaceholder:

1. **КП/приглашения**: карточки приглашений, копия ссылки `/fill/{token}`,
   перевыпуск/отзыв, запрос корректировки, прогресс заполнения, InviteParticipantsModal
   (в т.ч. приглашение неодобренных) — 431 строка модалка одна.
   *Частично закрыто 25.08: InviteDialog в прототипе.*
2. **Уточнения**: TenderCorrectionsPanel (правки ФКП: объём/удаление/добавление,
   PUT structure), ревью предложенных позиций, CommentsThread.
3. **Документы**: слоты документов тендера, upload/download, RD URL.
4. **Активность**: лента с переходами к позиции в таблице.
5. **Обзор**: KPI-сводка с кликами в пресеты сравнения (частично покрывается будущим
   этапом B анализа).
6. **Чаты**: кнопка чата у подрядчика, ChatDrawer, счётчики непрочитанных.
7. **Победитель**: форма выбора + баннер завершения со скачиванием файла.
8. ~~**Excel**: экспорт сравнения xlsx~~ — **ЗАКРЫТО 25.08**: ExportButton/ExportDialog
   в прототипе + серверный `GET /tenders/{id}/comparison/export` (§4.9).
   «Полный Excel» РЕЕСТРА остаётся за Ф7 (эндпоинт /reports/tenders.xlsx есть — кнопки нет).
9. **Управление раундами**: черновик/отправка/завершение, автосейв, preview получателей,
   retry-delivery (RoundsPanel прототипа — витрина без управления).
10. **Бюджет**: правка бюджетной позиции из карточки.
11. **«Как работает»**: help-панель сравнения (контент comparisonHelp.ts переносим легко).
12. **FKP-версии**: разослать vN, история версий, уведомления.
13. **Детали ячейки**: ComparisonDetailDrawer/PairDiff из analytics (частично закрывается
    CellPopup; pair_deltas сервер уже отдаёт). *Частично закрыто 25.08: CellCard —
    попап-таблица ячейки с двумя ярусами карточки.*

Каждый пункт Ф7 = экран в новом дизайне поверх существующего API (бэкенд менять
не нужно ни для одного из списка, кроме п.12-notify — он уже есть).

### 7.3 Открытые продуктовые решения (блокируют соответствующие фазы)

| # | Вопрос | Варианты | Затрагивает |
|---|---|---|---|
| В1 | Чем наполнить topbar cu (колокольчик/юзер)? | а) заглушки прототипа; б) подключить существующие API уведомлений/профиля | Ф2 |
| В2 | Кнопка чата в карточке? | а) потеря до Ф7; б) монтировать ChatDrawer в CuProviders сразу | Ф4 |
| В3 | Чьи формулы считать истиной? | а) клиентские spread/min, keyDerived/max-price-weight (прототип); б) серверные spread/median, key_work_ids/median-weight | адаптеры Ф4, гэпы в3/б3/б8 |
| В4 | URL-совместимость cmp-состояния? | ✅ **РЕШЕНО ИСТОЧНИКОМ (25.08)**: вид сериализуется `viewUrl.ts` — короткие ключи `p/m/dev/dyn/pot/sort/f`, пишется отличие от пресета. Принимаем прототипную схему (§2.4); ссылки старой карточки с `cmp-*` не поддерживаются — зафиксировать в релизных заметках | Ф4 |
| В5 | Тихий авто-refresh 20с? | а) как в старой карточке; б) руками, как в прототипе | Ф4/Ф6 |
| В6 | Глоссарий статусов | «Открыт» vs «Сбор предложений» | Ф3 |

### 7.3-бис. Новые решения ревизии 2 (появились с новыми возможностями прототипа)

| # | Вопрос | Варианты | Затрагивает |
|---|---|---|---|
| В7 | Комментарии ячеек до закрытия гэпа в12: а) чтение заглушкой (запись работает); б) ждать эндпоинт `GET /tenders/{id}/comments` | рекомендую (а): запись и маркеры локально, треды по клику — когда бэкенд догонит | Ф4 |
| В8 | Экспорт: показывать модалку канона сразу или после в12-в13? | независим от В7 — эндпоинт готов | Ф4 |

### 7.4 Трекинг изменений бэкенда (не блокирует основной путь)

Список (в) из §4.7 — завести эпик в delivery/backlog при старте Ф3 (**сделать это
до Ф3 обязательно; на 25.08 эпика в бэклоге ещё нет** — проверено поиском по
`delivery/backlog/`, `planning/`, `docs/`). Приоритет внутри:
revisionNote (плашка устаревания без него врёт текстом «данные изменились» без причины),
submitted/submittedInRound (история раундов), anomaly-причина строкой, popupNotes
(персистентность комментариев разбора), kind условий, плоский GET /tenders,
**пакетная выборка комментариев тендера и отметка просмотров (в12–в13, NEW 25.08)**.

Процессная заметка ревизии 2: целевой репо живёт на ветке
`cursor/sprint-wave-async-jobs-ui-kit`; базу для `feat/cu-integration`
(и слот в роадмапе — естественное место: волна 4, П12) согласовать до Ф0.

### 7.5 Технические риски

| Риск | Вероятность | Митигация |
|---|---|---|
| Элементный каскад web портит cu-инпуты несмотря на compat | средняя | превью-страница Ф1 + смоук §6.3-10; точечные усиления селекторов compat |
| **Расхождение источник↔цель: АКТИВЕН.** Четыре волны правок владельца легли ПОСЛЕ ревизии 1 (+7 636 строк за день); допущение «источник стабилен во время Ф1–Ф5» сегодня НЕ выполняется | высокая | однонаправленный diff-перенос — РАБОЧИЙ режим (§7.1); либо договорная заморозка источника на Ф1–Ф5; перед стартом фазы — `git diff` источника с момента прошлой фазы |
| Целевая база не зафиксирована: web живёт на ветке `cursor/sprint-wave-async-jobs-ui-kit`, интеграционный эпик в бэклоге отсутствует | средняя | согласовать базу и слот (волна 4 / П12) до Ф0; эпик завести в delivery/backlog до Ф3 |
| z-index конфликтов DialogHost/ChatDrawer с cu-меню | низкая | проверка §6.4; при конфликте поднять только DialogHost |
| SSR/prerender падения (matchMedia, document) | средняя | ssr:false на страницах; guard в сторе; правило «use client» на слой |
| Тяжёлый chunk карточки: css сравнения вырос до 2 167 строк, TenderCompare.tsx до 1 454 | низкая→средняя | dynamic import страниц; контроль веса в Ф6; при необходимости вынести CommentThread/ExportDialog в отдельные chunks (уже next/dynamic-кандидаты) |
| TS5 vs TS7 нюансы (exactOptionalPropertyTypes=false в источнике) | низкая | typecheck после каждой фазы; strict совпадает |
| Потеря функционала незамеченной (тихая) | высокая | список §7.2 показать ПМ/заказчику ДО старта Ф4; каждый пункт = тикет Ф7 |
| columns.ts рассчитан на прототипные данные (qty≠null) | средняя | адаптер подставляет qty=1 при null (семантика analytics); columns.check ловит регресс монотонности |
| React 19.2.4 (web) vs ^19.2.8 (прототип) | нулевая | совместимые миноры |
| Иконки Solar тянут весь пакет | низкая | импорты поштучные linear/bold — tree-shaking работает и в Next |
| Мутации прототипа против продового ACL: decideCorrection/postComment пишут на живой бэкенд с ролями/доступом по проекту (`_check_project_access`) | средняя | смоук под ОБЕМИ ролями (тендерщик + поставщик-владелец КП где применимо); отказ маппить в тихий `false` двери |

---

## Приложение А. Реестр компонентов shared/ui (52 слайса)

Формат: компонент — файлы(строк) — ключевой контракт — зависимости — примечания.
«dialog» = использует нативный `<dialog>`; «css» = есть свой module.css.

| # | Компонент | Файлы(строк) | Контракт (ключевые props/экспорты) | Зависимости | Примечания |
|---|---|---|---|---|---|
| 1 | Alert | Alert.tsx(74)+css+idx | `{tone?:Tone; icon?:IconName; title?; onClose?; children}`; глифы info/success/warning/danger | cx, Icon, Micro(CloseButton), Badge(Tone) | css |
| 2 | Avatar | Avatar.tsx(66) | `variant:'workspace'\|'user'\|'tree'; surface:'main'\|'sidebar'; online?`; children:string | cx | css; online через --av-surface |
| 3 | Badge | Badge.tsx(51) | **экспортирует Tone** ('info','success','warning','danger','neutral'); `{tone; icon?}` | Icon, cx | css; тип переиспользует весь домен |
| 4 | Breadcrumbs | Breadcrumbs.tsx(33) | `Crumb{title,to}[]; current` | **react-router** | PORT; css |
| 5 | Button | Button.tsx(55) | `variant:'primary'\|'secondary'\|'danger'; on?:boolean` | cx | css |
| 6 | ButtonGroup | ButtonGroup.tsx(52) | дизъюнкт `{joined:true}\|{gap:GapIndex}`; role=group | Layout(gapStyle) | css |
| 7 | Calendar | Calendar.tsx(319)+css | `CalendarMonth{month;onMonth;onPick(iso);dayState?(iso,date)→DayState;footer?}`; DayState{td?,selected?,plain?}; weeks(view) | lib/date(isoLocal), Icon, Popover | фон дня — флагами selected/plain, не классом снаружи |
| 8 | Card | Card.tsx(53) | `cardPart{head,title,foot}`; padding=GapIndex(4); хэйрлайн-тень вместо border | Layout | css |
| 9 | CellPopup | CellPopup.tsx(312)+css | хук `useCellPopup()`→{target,open,bind,close,register,view}; `CellPopupData{tone?;title;fields[];meter?;note?}` | cx, Tone | **dialog show() немодальный**; тайминги 350/500/130мс |
| 10 | Checkbox | Checkbox.tsx(61) | indeterminate через ref; `isCheckboxChecked(e)` (внутр.) | cx | css |
| 11 | ColorPicker | ColorPicker.tsx(194)+color.ts(87)+check+css | HSV, EyeDropper(feature-detect), hex/rgb/hsl, parse сам css | Icon | check-скрипт |
| 12 | ConfirmDialog | ConfirmDialog.tsx(66) | `{open;onClose;onConfirm;title;description?;tone?:danger\|primary}`; autoFocus Отмена | Modal, Button | через Modal |
| 13 | Counter | Counter.tsx(17) | children:number\|string; muted? | cx | css; позиционирует родитель |
| 14 | DatePicker | DatePicker.tsx(113) | `{value:ISO;onChange;label!;placeholder?}`; закрытие после выбора; клик мимо/Escape вручную | lib/date, Calendar | НЕ dialog (div role=dialog); .inline-edit |
| 15 | Drawer | Drawer.tsx(75) | `{open;onClose;label?}`; ширина --drawer-width; cardPart head/title/foot | cx | **dialog showModal** |
| 16 | Dropdown семья | Dropdown.tsx(172), DropdownGroup.tsx(50), MenuItem.tsx(65), MenuPanel.tsx(43), MenuCheckItem.tsx(58), 5css | `{open;onToggle;onClose;menu;menuAlign;closeOnSelect?;initialFocus?;children(trigger)}`; useDropdownGroup/useDropdownSlot(id); MenuItem{icon?,hint?,disabled?,checked?(radio),onSelect?}; MenuCheckItem role=menuitemcheckbox | cx, Icon, Tone | НЕ dialog (div role=menu + doc-listeners); стрелки клавиатуры |
| 17 | EmptyState | EmptyState.tsx(55) | `{icon?;title;description?;action?;tone?:neutral\|danger}`; role=status | Icon | css |
| 18 | ErrorState | ErrorState.tsx(51) | `{title?='Не загрузилось';description?;onRetry?}` | EmptyState, Button | css |
| 19 | FacetFilter | FacetFilter.tsx(162)+css | `Facet{key,title,options[]}; FacetValue=Record<key,string[]>`; MAX_VISIBLE=50, закрепление выбранного, поиск в критерии | toggle, Button, Dropdown(MenuCheckItem,MenuPanel), SearchInput | css |
| 20 | Field | Field.tsx(81) | контекст `useFieldControl(){id?,describedBy?,invalid?}` — контролы берут связки сами | Micro(RequiredMark) | css |
| 21 | Icon | Icon.tsx(23), icon-map.ts(178), local-icons.tsx(38), css | `{name:IconName≈70}`; размер/цвет через CSS --icon-size | @solar-icons/react поштучно, cx | css; 4 локальных SVG (docs/funnel/target/planet) |
| 22 | IconButton | IconButton.tsx(77) | `variant:'topbar'\|'panel'\|'page'\|'rail'; label!; iconSize?; badge?; active?` | Icon | css |
| 23 | InlineInput | InlineInput.tsx(49) | uncontrolled; label!(aria) | cx | глобальный .inline-edit |
| 24 | Input/Textarea | Input.tsx(46), Textarea.tsx(43), общий css | связки id/aria из Field-контекста | Field | css общий |
| 25 | Layout семья | Stack.tsx(47), Inline.tsx(45), Grid.tsx(58), Divider.tsx(38), scale.ts(20), 1css | GapIndex 0…9; Stack{gap!}, Inline{wrap?=true}, Grid{columns?\|minColumnWidth?}, gap(n)/gapStyle | cx | css общий |
| 26 | Link | Link.tsx(59) | юнион {to}\|{href;externalIcon?} | **react-router**, Icon | PORT |
| 27 | Micro семья | Text.tsx(70), Data.tsx(133), Controls.tsx(156), 3css | Kbd, RequiredMark, Dot, TruncatedText, StatusDot{tone}, Delta{value;format?;tone?}, NumericText, AvatarGroup{max?=4}, CopyButton, CloseButton{variant?='quiet'}, MoreButton | Icon, IconButton, Tone | css×3 |
| 28 | Modal | Modal.tsx(100) | `{open;onClose(единый close-event);label?;--modal-width:520px}`; cardPart head/title/foot | cx | **dialog showModal**; без анимаций намеренно |
| 29 | NumberInput | NumberInput.tsx(140) | `{value:number;onChange(number);min?;max?;step?=1;unit?}`; кнопки ±24px tabIndex=-1 | Field | css |
| 30 | Page семья | Screen(24), PageHeader(36), PageTitle(26), PageActions(26), ChipButton(32), ScreenPlaceholder(28), SecondaryHeader(81), 1css | SecondaryHeader{tabs:SecondaryTab[];activeId;onChange;variant?:'header'\|'canvas'} — APG roving | roving, Icon | css |
| 31 | Pagination | Pagination.tsx(97) | `{page;pageCount;onPageChange}`; исчезает при ≤1 | Icon | css; чистый pageWindow |
| 32 | Popover | Popover.tsx(102) | `{anchor:DOMRect\|null;onClose;label?}`; привязка вправо, flip вверх (data-up); GAP=4 EDGE=12 | cx | **dialog showModal**; замер высоты после открытия |
| 33 | Progress | Progress.tsx(53) | value? (без → indeterminate); tone?; aria-label! | cx, Tone | css; role=progressbar |
| 34 | Radio | Radio.tsx(105) | Radio(value!) бросает вне группы; RadioGroup{label;value;onChange;gap?=2}; name через контекст | Layout | css |
| 34-бис | ProgressBar (NEW 25.08) | ProgressBar.tsx(69)+css(62)+idx(4) | `{value:number 0…100 clamp; tone?:'neutral'\|'info'\|'success'; width?; className?}`; aria-hidden — дублирует соседнее число | cx | css; полоса ВЕЛИЧИНЫ, НЕ хода процесса (для него #33 Progress); нормировка снаружи |
| 35 | RangeCalendar | RangeCalendar.tsx(179)+css | `{from;to;onChange(from,to)}`; две независимые сетки; границы полями ДД.ММ.ГГГГ; перевёрнутая пара меняется местами; ghost-hover | lib/date, Calendar | css |
| 36 | ScrollArea | ScrollArea.tsx(43), use-scrolled.ts(28) | `{variant?:'page'\|'panel';onScroll?}`; useScrolled()→{scrolled,onScroll} | cx | css |
| 37 | SearchInput | SearchInput.tsx(67) | `{value;onChange;label!;variant:'capsule'\|'field';action?}`; крестик очистки | Icon | css |
| 38 | SearchTrigger | SearchTrigger.tsx(57) | кнопка-капсула; hotkey(Kbd); secondary?; экспорт searchSecondaryIconClass | Icon, Micro(Kbd) | css |
| 39 | Segmented | Segmented.tsx(136) | generic T extends string; `{label;value;options[{id,label,tone?,icon?}]}`; едущая пилюля ResizeObserver; radiogroup APG | Icon, Tone | css |
| 40 | Select | Select.tsx(123) | generic; `{options;value:T\|null;onChange;onClear?;placeholder?='—';disabled?}` | Dropdown, Button, Icon, Field | построен НА Dropdown |
| 41 | Skeleton | Skeleton.tsx(45) | width?/height=14/radius=4; волна; aria-hidden | cx | css |
| 42 | Spinner | Spinner.tsx(47) | size?:sm\|md; label?='Загрузка'; inline-SVG | VisuallyHidden | css |
| 43 | Switch | Switch.tsx(56) | `{checked;onChange(checked);disabled?;aria-label!}`; button role=switch | cx | css |
| 44 | Table | Table.tsx(154), css 381 | `{caption?;layout?:auto\|fixed;width?(px, обязат. fixed+stickyHead);stickyHead?;stickyCol?}`; tableCell{numeric,roomy,mono,strong,muted,sub,link,rowLink,card,fullRow,empty} | cx | cqw-арифметика; col-width исполняется только fixed |
| 45 | Tabs | Tabs.tsx(77) | `{items:TabItem[];value;onChange;aria-label!}`; rovingTabsKeyDown | roving | css |
| 46 | Toast | Toast.tsx(113) | ToastProvider + useToast():ShowToast (бросает вне провайдера); LIFETIME=5000 MAX_VISIBLE=3; viewport aria-live=polite | Icon, Micro(CloseButton), Tone | css |
| 47 | Tooltip | Tooltip.tsx(133) | `{text;children}`; портал body; задержка 350мс; только hover:hover; aria-describedby клонированием | createPortal | css; закрытие скроллом/Escape |
| 48 | Tree | Tree.tsx(65), tree-nodes.ts(49) | `{items:TreeItem[];activePath?;onNavigate?(path)}`; TreeItem row/action/link/group; активность по префиксу пути | TreeRow | css НЕТ своего (TreeRow.css) |
| 49 | TreeRow семья | TreeRow.tsx(109), NestedTreeNode.tsx(111), css 209 | TreeRowData{icon?,avatar?,online?,title;sub?;count?}; TreeToggle, TreeBranch, GroupTitle; NestedTreeNode{parent;children;expanded;activeId;level=2}; visibleNestedChildren() чистая | Icon, Avatar, Counter | css |
| 50 | Typography | Typography.tsx(122) | Text{size xs..md;tone inherit..quaternary;leading;weight;truncate?;as?}; Heading level 1..3 | cx | css |
| 51 | VisuallyHidden | VisuallyHidden.tsx(25) | span.visually-hidden | — | глобальный класс |

---

## Приложение Б. Карта файлов aag.tender → действие (полный обход, 35 237 строк; ревизия 2)

Действия: MOVE (как есть, + «use client» где хуки) · ADAPT · PORT · REWRITE ·
DROP · FREEZE. Пути от `src/`; целевые — `web/src/cu/…` если не сказано иное.

### app/ (663)

| Файл | Строк | Действие | Примечание |
|---|---:|---|---|
| app/index.tsx | 22 | DROP | точка входа SPA; провайдеры → CuProviders |
| app/providers/router.tsx | 81 | DROP+PORT | createBrowserRouter умирает; RouteSync PORT в cu/app/providers; lazy → next/dynamic в route-файлах |
| app/styles/global.css | 560 | MOVE→cu/styles/cu-global.css | префиксование reset под .cu-root (§3.2); без html/body-правил |

### entities/comparison/ (4185)

| Файл | Строк | Действие | Примечание |
|---|---:|---|---|
| api/comparison.api.ts | 176 | REWRITE | тело на apiFetch + адаптер §4.3; сигнатуры сохранить; + мутации decideCorrection/selectBidVersion (NEW 25.08) |
| api/comments.api.ts | 83 | REWRITE | §4.8; чтение — заглушка до гэпа в12 |
| api/export.api.ts | 66 | REWRITE | §4.9; EXPORT_CONTENT/exportFileName MOVE как есть |
| api/comparison.mock.ts | 1009 | KEEP(локально) | рантайм мимо; превью ДС/офлайн |
| model/contract.ts | 481 | MOVE | контракт домена; + стадии КП BidStage/BidVersion (NEW 25.08) |
| model/thresholds.ts | 58 | MOVE | SYSTEM_THRESHOLDS, clampThresholds |
| model/calc.ts | 560 | MOVE | analyzeComparison единым проходом |
| model/filters.ts | 57 | MOVE | предикаты |
| model/view.ts | 235 | MOVE | оси/пресеты/transition |
| model/viewUrl.ts + viewUrl.check.ts | 106+130 | MOVE | сериализация вида ↔ URL (§2.4, В4); NEW 25.08 |
| model/comments.ts | 122 | MOVE | CellComment/CommentMap/commentKey |
| model/terms.ts | 43 | MOVE | termRows |
| lib/format.ts | 26 | MOVE | money/moneyCompact/decimal |
| comparison.check.ts | 948 | MOVE | assert-контракт счёта |
| terms.check.ts | 50 | MOVE | |
| index.ts | 35 | ADAPT | api-экспорт остаётся, mock наружу НЕ реэкспортировать |

### entities/tender/ (360)

| Файл | Строк | Действие | Примечание |
|---|---:|---|---|
| api/tenders.api.ts | 59 | REWRITE | §4.1 portfolios-flatten (+reports/tenders опц.) |
| api/tenders.mock.ts | 75+ | KEEP(локально) | |
| model/tender.ts | 119+ | MOVE | ADAPT tenderPath → /tenders/${id} |
| model/filters.ts | 87+ | MOVE | facetsOf/applyFilters |
| tender.check.ts | 42+ | MOVE | |
| index.ts | 14+ | MOVE | |

(«+» — точный wc не снимался на ревизии 2, слой в целом: 360 строк.)

### entities/section/ · entities/workspace/ (143)

| Файл | Строк | Действие | Примечание |
|---|---:|---|---|
| section/model/types.ts | 10 | MOVE | SectionId, NavItem |
| section/model/nav.ts | 21 | ADAPT | pathFor под URL целевого приложения |
| section/model/content.ts | 51 | REWRITE | деревья под реальные разделы web (Ф2) |
| section/index.ts | 2 | MOVE | |
| workspace/model/workspace-store.ts | 58 | ADAPT | guard typeof window для matchMedia |
| workspace/index.ts | 1 | MOVE | |

### features/ai-analysis/ (4961)

| Файл | Строк | Действие | Примечание |
|---|---:|---|---|
| api/analysis.api.ts | 103 | ADAPT | этап A: локальный движок на живом comparison; этап B §4.5 |
| model/analysis.ts | 920 | MOVE | buildAnalysis, ANALYSIS_LIMITS |
| analysis.check.ts | 330 | MOVE | |
| model/narration.ts | 136 | MOVE | vetNote NOTE_MAX=240 |
| model/insights.ts | 238 | MOVE (этап A) | этап B заменяется TenderInsight |
| insights.check.ts | 120 | MOVE | |
| model/askAi.ts | 151 | MOVE (этап A), DROP (этап B) | демо-ответчик чата |
| model/useAnalysisRuns.ts | 145 | ADAPT | runs ↔ latest/history на этапе B; stale клиентский → серверный freshness |
| ui/AnalysisDock.tsx | 627 | MOVE | портал #ai-panel-slot |
| AnalysisDock.module.css | 313 | MOVE | |
| ui/AiDock.tsx | 590 | MOVE | next/dynamic внутри AnalysisDock |
| AiDock.module.css | 434 | MOVE | |
| ui/AiTrigger.tsx | 172 | MOVE | AI_TRIGGER_ID |
| AiTrigger.module.css | 347 | MOVE | |
| ui/RichText.tsx | 74 | MOVE | мини-разметка чата |
| RichText.module.css | 26 | MOVE | |
| ui/assets/SparkGlyph.tsx/.css | 115+31 | MOVE | --cu-ai-a/b/c |
| ui/dockId.ts | 11 | MOVE | отдельный модуль = lazy-граница |
| index.ts | 26 | ADAPT | AiDock наружу только через dynamic |

### features/flyout/ (190)

use-flyout.ts(135) MOVE · Flyout.tsx(54)+css(51) MOVE · index.ts(2) MOVE.

### pages/tender/ (12291)

| Файл | Строк | Действие |
|---|---:|---|
| model/columns.ts | 261 | MOVE |
| model/columns.check.ts | 174 | MOVE |
| model/compareFormat.ts | 539 | MOVE (вырос вчетверо 25.08) |
| model/useCellComments.ts | 101 | MOVE (NEW) |
| model/scroll-parent.ts | 17 | MOVE |
| model/useBandMaxHeight.ts | 67 | MOVE |
| model/useBandWidth.ts | 45 | MOVE |
| model/useCompareScreen.ts | 174 | ADAPT (+viewUrl §2.4) |
| model/useComparisonData.ts | 113 | REWRITE (§4.3) |
| model/useTableDock.ts | 280 | MOVE |
| ui/TenderPage.tsx | 313 | PORT (§2.2; табы ?tab= §2.4) |
| TenderPage.module.css | 43 | MOVE |
| ui/TenderCompare.tsx | 1454 | MOVE |
| TenderCompare.module.css | 2167 | MOVE |
| ui/CompareToolbar.tsx(+css) | 457+193 | MOVE |
| ui/CompareSettings.tsx(+css) | 516+242 | MOVE (внутри и CompareFilters) |
| ui/BidCell.tsx | 413 | MOVE |
| ui/CellCard.tsx(+css) | 241+148 | MOVE (NEW) |
| ui/CommentThread.tsx(+css) | 384+280 | MOVE (NEW) |
| ui/CorrectionPanel.tsx(+css) | 173+73 | MOVE (NEW) |
| ui/CutLine.tsx | 86 | MOVE (NEW) |
| ui/ExportButton.tsx | 62 | MOVE (NEW, §4.9) |
| ui/ExportDialog.tsx(+css) | 112+42 | MOVE (NEW, §4.9) |
| ui/GhostColumn.tsx | 62 | MOVE (NEW) |
| ui/InviteDialog.tsx | 61 | MOVE (NEW) |
| ui/PotentialCell.tsx | 82 | MOVE (NEW) |
| ui/SliceLink.tsx(+css) | 67+57 | MOVE (NEW, viewUrl) |
| ui/CompareRow.tsx | 277 | MOVE |
| ui/ContractorCard.tsx | 502 | MOVE |
| ui/CornerTab.tsx | 123 | MOVE |
| ui/DossierModal.tsx(+css) | 189+75 | MOVE |
| ui/TermsBand.tsx | 150 | MOVE |
| ui/RoundsPanel.tsx(+css) | 107+54 | MOVE |
| ui/TotalRow.tsx | 134 | MOVE |
| ui/SpreadCell.tsx | 103 | MOVE |
| ui/CompareLegend.tsx(+css) | 169+170 | MOVE |
| ui/ColumnPainter.tsx(+css) | 45+15 | MOVE |
| ui/assets/* (8 глифов + index) | 183 | MOVE |
| index.ts | 1 | MOVE |

### pages/tender-registry/ (470)

TenderRegistryPage.tsx(156) PORT · RegistryFilters.tsx(247)+css(66) MOVE · index.ts(1) MOVE.

### shared/lib/ (277)

cx(5) date(82)+check(49) plural(17) reducedMotion(10) roving(46) toggle(7) useAsync(61)
— все MOVE.

### shared/ui/ (52 слайса, 10149) — группами

- MOVE без правок (45): Alert, Avatar, Badge, Button, ButtonGroup, Calendar,
  CellPopup, Checkbox, ColorPicker(+check), ConfirmDialog, Counter, DatePicker,
  Drawer, Dropdown-семья (5 файлов), EmptyState, ErrorState, FacetFilter, Field,
  Icon(icon-map+local-icons), IconButton, InlineInput, Input/Textarea, Layout-семья,
  Micro-семья (3), Modal, NumberInput, Page-семья (8), Pagination, Popover, Progress,
  **ProgressBar**, Radio, RangeCalendar, ScrollArea(+use-scrolled), SearchInput,
  SearchTrigger, Segmented, Select, Skeleton, Spinner, Switch, Table, Tabs, Toast,
  Tooltip, Tree, TreeRow-семья, Typography, VisuallyHidden.
- PORT (2): Link, Breadcrumbs — routerLink-адаптер (§2.2).

### widgets/ (1406)

topbar: Topbar(77)+WorkspaceSwitcher(51)+UserMenu(53)+NotificationsBell(44)+4css —
MOVE+«use client». rail: Rail(102)+RailItem(84)+RailExpandZone(39)+2css — ADAPT
(next/navigation). sidebar: Sidebar(61)+SidebarHeader(59)+SidebarActions(42)+
SidebarSearch(52)+SidebarFooter(30)+2css — ADAPT. workspace: Workspace(76)+css(229) —
PORT (Outlet→children).

### корень

ds-entry.ts(122) FREEZE · vite-env.d.ts(1) DROP · vite.config.ts/vite.lib.config.ts/
index.html/bun.lock — DROP/FREEZE (§7.1).

### Удаляемое в целевом репо (web/src)

| Файл | Строк | Причина |
|---|---:|---|
| app/(app)/tenders/page.tsx | 25 | заменён |
| app/(app)/tenders/[id]/page.tsx | 3501 | заменён (было 3219 — страница росла до 24.08) |
| components/TendersRegistry.tsx | 485 | заменён |
| lib/tendersRegistry.ts | 87 | ЧАСТИЧНО: flattenPortfolios переиспользуется адаптером |
| app/page.module.css | 142 | сирота скаффолда |
| lib/comparisonWorkspace.ts | 150 | заменён view.ts/useCompareScreen (решение В4) |
| lib/comparisonFormat.ts | 63 | заменён compareFormat.ts/format.ts |

Осторожно: chatStore/aiPromptsApi/commentsApi/catalog НЕ удалять — их используют
другие страницы (quotes, cabinet).

---

## Приложение В. Маппинг контрактов (сводка полевой сверки)

Полные таблицы — в теле документа (§4). Здесь — шпаргалка соответствий слоёв:

| Прототип | tendersApi.ts | FastAPI |
|---|---|---|
| Comparison.groups | ComparisonData.sections + items[] по item_ids | build_comparison(): sections[], items[] |
| Comparison.contractors | suppliers[] | suppliers[] |
| Contractor.prices (₽/ед.) | items{}.materials/works/total (СУММЫ) | QuoteItem.materials_price/works_price; normalized_rate в analytics |
| Contractor.fill (% стоимости) | fill_progress (% штук) | compute_fill_progress() |
| Contractor.status | quote_status: draft/submitted/revision_requested/withdrawn | то же |
| CellMark.anomaly:string | AnalyticsCell.is_anomaly:boolean | _is_anomaly (k-формула, ≥3 ставок) |
| CellMark.declined | items{}.declined / cell.state='decline' | то же |
| CellMark.correction | quantity_override/review_status/comment; state='volume_pending' | то же |
| QtyCorrection.status pending | review_status null\|"pending" | то же |
| SupplierTerm.kind | НЕТ (только {id,field_name}) | field_type только в TenderDetail |
| Comparison.rounds | GET /rounds → TenderRound{status draft/sent/closed} | recipients[].included |
| Comparison.roundNumber | active_round_number | активный sent-раунд |
| Comparison.revision | tender_revision:int | models/tender.py:32, инкременты: quote submit / structure PUT / items PATCH / review / комментарии |
| revisionNote | НЕТ | НЕТ (ближайшее: /activity) |
| prevPrices/prevConditions | versions={sid}:{n} пин | version_by_supplier |
| submittedInRound | НЕТ (awaiting_round_number = «ждём») | сборка по recipients.quote_version_number |
| Insight карточки | TenderInsight{type good/warn/bad, evidence, table_transition} | insights-роутер |
| AnalysisResult секции | AnalysisSection{blocks[{paragraphs[segments]}], preset, filters, insight_ref} | analysis_runs.py |
| summary ≤3 | summary_pins ≤3 {section_id,title,teaser} | то же |
| Staleness partial/stale | freshness{status current/partial/stale, reason}, transition_allowed | apply 409 без acknowledge_stale |
| fetchTenders список | НЕТ плоского GET /tenders | GET /portfolios (дерево) + GET /reports/tenders (суммы) |
| STATUS open/closed/cancelled/draft | тот же enum | лейблы: «Открыт» vs «Сбор предложений» (решение В6) |

Формулы счёта — расхождения:

| Метрика | Прототип | Сервер | Решение |
|---|---|---|---|
| spread % | (max−min)/min | (max−min)/median | клиентская (В3) |
| аномалия k | дефолт 3 | дефолт 2 | прокидывать anomaly_k из UI всегда |
| key works | вес max(price)×qty ≥ keyShare накопительно | weight=median_cost/Σ ≥ threshold | В3 |
| potential | заявленный запас ₽/ед. (нет на сервере) | профицит к минимуму × объём | семантики разные, не маппить (в3) |
| best КП | лучшая неаномальная сумма | totals_min/max по полным КП + leader_id | клиентская |

---

## Приложение Г. Скелеты кода (эталонные заготовки)

Рабочие заготовки для Ф2–Ф4; сигнатуры соответствуют контрактам источника.
Это отправные точки, не финальный код — сверять с фактическими полями ответов
на живом стенде (`curl …/comparison | jq`).

### Д1. `cu/shared/lib/routerLink.tsx` — адаптер ссылок (PORT для Link/Breadcrumbs)

```tsx
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, ReactNode } from "react";

/** Единственная точка внутренней навигации в cu/. Прямой next/link внутри
 *  слоёв запрещён — иначе потеряем централизованную замену при переезде путей. */
export function CuLink({
  to,
  children,
  ...rest
}: { to: string; children: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  return (
    <Link href={to} {...rest}>
      {children}
    </Link>
  );
}

/** Программная навигация: обёртка над useRouter ради одного места замены. */
export function useCuNavigate() {
  const router = useRouter();
  return (path: string, opts?: { replace?: boolean }) => {
    if (opts?.replace) router.replace(path);
    else router.push(path);
  };
}
```

Правило переноса: в `Link.tsx` варианта `{to}` → `CuLink`; в `Breadcrumbs` → `CuLink`;
в RailItem `<a href onClick=intercept>` → `CuLink` (перехват больше не нужен).

### Д2. `cu/app/providers/CuProviders.tsx`

```tsx
"use client";
import { SolarProvider } from "@solar-icons/react/lib/SolarProvider";
// ToastProvider из cu/shared/ui/Toast
// ChatDrawer из "@/components/ChatDrawer" — только при решении В2-б

export function CuProviders({ children }: { children: React.ReactNode }) {
  return (
    <SolarProvider strokeWidth={1.5}>
      <ToastProvider>{children}</ToastProvider>
      {/* <ChatDrawer /> — см. §3.5 */}
    </SolarProvider>
  );
}
```

### Д3. `cu/app/providers/RouteSync.tsx` — единственный писатель activeId

```tsx
"use client";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";
import { sectionFromPath } from "@/cu/shared/lib/sectionFromPath"; // вынесен из router.tsx
import { useWorkspaceStore } from "@/cu/entities/workspace";

export function RouteSync() {
  const pathname = usePathname();
  const syncFromRoute = useWorkspaceStore((s) => s.syncFromRoute);

  useLayoutEffect(() => {
    syncFromRoute({ activeId: sectionFromPath(pathname ?? "/") });
  }, [pathname, syncFromRoute]);

  useEffect(() => {
    // догонка matchMedia после гидратации (guard в сторе вернул дефолт на сервере)
    useWorkspaceStore.getState().hydrateMedia();
  }, []);

  return null;
}
```

В `workspace-store.ts` дополнить:

```ts
sidebarOpen: typeof window === "undefined"
  ? true
  : window.matchMedia("(max-width:900px)").matches ? false : true,
hydrateMedia: () =>
  set({ sidebarOpen: !window.matchMedia("(max-width:900px)").matches }),
```

### Д4. `(cu)/layout.tsx` — полный

```tsx
import "../../cu/styles/cu-global.css";   // ДО компонентов (правило ds-entry)
import "../../cu/styles/cu-compat.css";
import { AuthGuard } from "@/components/AuthGuard";
import { CuProviders } from "@/cu/app/providers/CuProviders";
import { RouteSync } from "@/cu/app/providers/RouteSync";
import { Workspace } from "@/cu/widgets/workspace/ui/Workspace";

export default function CuLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="cu-root">
        <CuProviders>
          <RouteSync />
          <Workspace>{children}</Workspace>
        </CuProviders>
      </div>
    </AuthGuard>
  );
}
```

(`.cu-root` здесь — единственное место, где класс навешивается.)

### Д5. Адаптер сравнения — каркас `cu/entities/comparison/api/comparison.api.ts`

```ts
import type { Comparison, Contractor, PositionGroup, ComparePosition,
  CellMark, SupplierTerm } from "../model/contract";
import { bidStatus } from "../model/contract";

/* Формы ответа бэкенда — локальные типы зеркалят tendersApi.ts; наружу не идут. */
interface ApiComparison { /* items, sections, condition_fields, suppliers,
                             active_round_number, tender_revision, analytics */ }

const numId = (v: number | string) => String(v);

function rateOf(cell: ApiCell | undefined, total: number | undefined, qty: number):
  number | undefined {
  if (cell?.normalized_rate != null) return cell.normalized_rate;
  if (total == null || qty <= 0) return undefined;   // ключа нет → позиция не закрыта
  return total / qty;
}

function toPosition(it: ApiItem, a?: ApiWorkAnalytics): ComparePosition {
  return {
    id: numId(it.id),
    title: it.name,
    qty: it.quantity ?? 1,               // семантика analytics: null объём → 1
    unit: it.unit ?? "",
    key: a?.is_key_work,
    qtyOrig: it.original_quantity ?? undefined,
    removed: it.is_removed || undefined,
  };
}

function toContractor(s: ApiSupplier, ctx: AdapterCtx): Contractor {
  const prices: Record<string, number> = {};
  const marks: Record<string, CellMark> = {};
  for (const [itemId, cell] of Object.entries(s.items)) {
    const pid = itemId; // ключи словаря уже строки
    const rate = rateOf(ctx.cellOf(s.supplier_id, itemId), cell.total, ctx.qtyOf(itemId));
    if (rate !== undefined) prices[pid] = rate;
    const mark = collectMark(cell, ctx.analyticsCell(s.supplier_id, itemId));
    if (mark) marks[pid] = mark;
  }
  return {
    id: numId(s.supplier_id),
    name: s.supplier_name,
    status: mapQuoteStatus(s.quote_status),
    fill: costFill(s, ctx),              // §4.4-2: Σcost/Σweight из analytics
    inn: "", contact: "",                // §4.4-10: лениво из /suppliers/{id} в Dossier
    submitted: "",                       // §4.6-в6: versions-API submitted_at
    prices, marks: Object.keys(marks).length ? marks : undefined,
    conditions: joinConditions(ctx.conditionFields, s.condition_values),
    terms: toTerms(ctx.conditionFields, s.condition_values),
    // prevPrices / prevConditions / submittedInRound — мердж вторым проходом
  };
}

export async function fetchComparison(q: { tenderId: string; round?: number }):
  Promise<Comparison | null> {
  const params = thresholdsQuery();       // spread_notice/spread_high/anomaly_k/key_share
  const res = await apiFetch(`/tenders/${q.tenderId}/comparison${params}`);
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Не удалось загрузить сравнение"));
  const data: ApiComparison = await res.json();
  const [groups, positions] = toGroupsAndPositions(data);   // §4.7-(а)-3
  const contractors = data.suppliers.map((s) => toContractor(s, buildCtx(data)));
  const prev = await fetchPrevRound(data, q);               // пин версий, §4.3
  return finalize({
    groups, contractors,
    rounds: await fetchRounds(q.tenderId),
    roundNumber: data.active_round_number ?? undefined,
    revision: String(data.tender_revision ?? ""),
    // revisionNote: НЕТ НА СЕРВЕРЕ (в4) — поле оставить undefined
  }, prev);
}

/** Этап B (§4.5): тело requestAnalysis меняется на GET /tenders/{id}/insights… */
```

Замечания к каркасу:
- `mapQuoteStatus`: `submitted→'complete'`, `revision_requested→'revision'`,
  остальное→`'partial'` (draft/withdrawn/null); `bidStatus()` домена устойчив к мусору.
- `collectMark`: declined ← `cell.declined`; correction ← override/review_status/comment
  (`pending` ↔ null|"pending"); anomaly ← `is_anomaly ? причина(клиентская, §4.4-3) : derived`;
  potential НЕ переносим (семантика, в3).
- Пороги в query прокидываются ВСЕГДА (расхождение дефолтов k: 3 vs 2).

### Д6. Адаптер реестра — каркас

```ts
import { flattenPortfolios, type TenderRegistryRow } from "@/lib/tendersRegistry";
import { fetchPortfolios } from "@/lib/portfoliosApi";
import { isoToDmy } from "@/cu/shared/lib/date";
import type { TenderRow } from "../model/tender";

export async function fetchTenders(): Promise<TenderRow[]> {
  const tree = await fetchPortfolios();          // GET /portfolios
  const flat: TenderRegistryRow[] = flattenPortfolios(tree);
  return flat.map((r) => ({
    id: String(r.id),
    title: r.title,
    portfolio: r.portfolio,
    project: r.projectPath,
    kind: r.work_type,
    status: r.status,                            // enum совпадает 1:1
    owner: r.responsible ?? "",
    start: isoToDmy(r.start),
    end: isoToDmy(r.end),
    created: isoToDmy(r.created_at.slice(0, 10)),
  }));
}

export async function fetchTender(id: string): Promise<TenderRow | null> {
  const res = await apiFetch(`/tenders/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await apiErrorMessage(res, "Не удалось загрузить тендер"));
  const t = await res.json();
  return { /* маппинг тех же полей + portfolio/project из detail */ };
}
```

### Д7. Табы карточки на URL (ADAPT TenderPage)

```tsx
const TABS = ["comparison", "clarifications", "quotes", "overview", "rounds",
              "documents", "activity"] as const;
type Tab = (typeof TABS)[number];

const searchParams = useSearchParams();
const router = useRouter();
const tab = (() => {
  const t = searchParams.get("tab");
  return TABS.includes(t as Tab) ? (t as Tab) : "comparison";
})();
const selectTab = (t: Tab) =>
  router.replace(`/tenders/${tenderId}?tab=${t}`, { scroll: false });
```

---

## Приложение Д. Карта целевого репо `web/src` (затронуто / не затронуто)

### Затронуто интеграцией

| Файл | Строк | Действие |
|---|---:|---|
| app/(app)/layout.tsx | 23 | без изменений (перестаёт видеть /tenders*) |
| app/(app)/tenders/page.tsx | 25 | DELETE (Ф3) |
| app/(app)/tenders/new/page.tsx | 2507 | СОХРАНИТЬ: мастер Excel остаётся в старом шелле (вырос с 1749 — волна 24.08); точка входа на него — решить (см. ниже) |
| app/(app)/tenders/[id]/page.tsx | 3501 | DELETE (Ф4) |
| components/TendersRegistry.tsx | 485 | DELETE |
| lib/tendersRegistry.ts | 87 | ЧАСТИЧНО: flattenPortfolios живёт, CSV-хелперы умирают |
| lib/tendersApi.ts | 1657 | ЧАСТИЧНО: адаптеры cu читают формы типов отсюда; сами функции постепенно умирают по мере перехода cu (не удалять до Ф7!) |
| lib/portfoliosApi.ts / portfolios.ts | 89+64 | переиспользуются адаптером реестра |
| lib/apiClient.ts | 80 | переиспользуется как есть |
| components/AuthGuard.tsx | 61 | переиспользуется в (cu)/layout |
| components/ChatDrawer.tsx | 368 | переиспользуется при В2-б |
| app/page.module.css | 142 | DELETE (сирота) |
| lib/comparisonWorkspace.ts | 150 | DELETE после Ф4 (решение В4-а) |
| lib/comparisonFormat.ts | 63 | DELETE после Ф4 |

Открытый вопрос «Новый тендер из Excel»: кнопка создания жила на старом реестре.
Прототип её не имеет. Варианты: (а) пункт дерева TENDERS «Создать из Excel» →
старый маршрут `/tenders/new` (страница останется в старом шелле — визуальный шов);
(б) отложить до Ф7-экрана создания в новом дизайне. Рекомендация: (а) временно,
тикет в Ф7.

### Не затронуто (проверить регрессом §6.4)

suppliers(+id 826+1254), quotes(+id 19+353), budget(+id 391+268), chats(135),
cabinet(356), settings(295), users/security-log/templates/reports (7/7/7/15),
questionnaires(328), portfolios(89)+objects(115), notifications(170), home(215),
demo(160), my-* (37), catalog/* (35), login/register/reset-password (293+35+99),
fill/[token](1268) — кабинет поставщика, вне шелла целиком.

Общий масштаб нетронутого: ~6 100 строк страниц + их компоненты/либы.

---

## Приложение Е. Сводные оценки

По фазам (рабочие дни):

| Фаза | Содержание | Оптимист | Пессимист |
|---|---|---:|---:|
| Ф0 | подготовка, решения | 0.5 | 0.5 |
| Ф1 | дизайн-система 52+токены | 2 | 3 |
| Ф2 | каркас 4 виджета+стор+роутинг | 2 | 3 |
| Ф3 | реестр+адаптер списков | 1.5 | 2 |
| Ф4 | карточка: сравнение, раунды, комментарии/корректировки/экспорт, viewUrl, адаптеры (карточка выросла до 12 291 строк) | 7 | 10 |
| Ф5 | ИИ-панель этап A | 2 | 3 |
| Ф6 | чистка, чекеры, стенд | 1.5 | 2 |
| **Итого основной путь** | | **16.5** | **23.5** |
| Ф7 | потери функционала (13 пунктов §7.2, из них №8 и №13 частично закрыты) | от 14 | 28+ |

Допущения: один фронтендер, бэкенд не меняется (кроме трекинга §7.4), решения §7.3 приняты
заранее. «Источник стабилен во время Ф1–Ф5» — УСЛОВИЕ СЕЙЧАС НАРУШЕНО (§7.5): без
договорной заморозки источника правило diff-переноса §7.1 добавляет ~1–2 дня на фазу.

Критический путь: Ф1 → Ф2 → Ф4 (Ф3 параллелит второй человек при наличии).

## Глоссарий

| Термин | Значение |
|---|---|
| cu | префикс новой секции в web/ (от условного имени каркаса); корень `web/src/cu/`, класс `.cu-root` |
| ДС | дизайн-система: токены global.css + shared/ui источника |
| КП | коммерческое предложение поставщика (quote) |
| ФКП | финальное КП — запрошенная доработанная версия (fkp-versions) |
| Раунд | круг сбора КП по тендеру (TenderRound, sent/current/closed) |
| Ревизия | tender_revision — счётчик изменений данных тендера; база stale-плашек |
| Расценка | цена за единицу позиции (прототип хранит её; сервер — суммы) |
| Разброс | spread — расхождение цен позиции между подрядчиками, % |
| Потенциал | запас торга; у прототипа и сервера РАЗНЫЕ семантики (в3) |
| Аномалия | выброс цены по k-формуле от отклонений остальных |
| named_filters | серверные готовые срезы работ: has_potential/anomalies/high_spread/key |
| Stale/partial | устаревание сохранённого разбора относительно ревизии данных |
| viewUrl | сериализация рабочего контекста сравнения в URL (`?p=&m=&dev=…`); пишется только отличие от пресета (§2.4) |
| Стадия КП (BidStage) | состояние предложения подрядчика: ждём / черновик / подано / запрошена правка; бейджи стадий в таблице |
| Просмотренность комментариев | «отметить всё прочитанным» — ЗАПИСЬ от имени пользователя; эндпоинта в бэкенде нет (в13) |
| «дверь» | api-сегмент слайса: единственное место, где экран встречает данные |
| MOVE/ADAPT/PORT/REWRITE/DROP/FREEZE | коды действий приложения Б |

## Приложение Ж. Пофайловый чек-лист переноса `shared/ui` (Ф1)

Отмечать [x] после typecheck компонента. Строки сняты wc -l. «use client» нужен
всем файлам с хуками/DOM; у чистых рендеров можно пропустить.

| Компонент | Файл | Строк | Готов |
|---|---|---:|---|
| Alert | Alert.tsx / .module.css / index.ts | 74+41+5 | [ ] |
| Avatar | Avatar.tsx / css / idx | 66+46+1 | [ ] |
| Badge | Badge.tsx / css / idx | 51+19+1 | [ ] |
| Breadcrumbs | **PORT** Breadcrumbs.tsx / css / idx | 33+32+1 | [ ] |
| Button | Button.tsx / css / idx | 55+63+5 | [ ] |
| ButtonGroup | ButtonGroup.tsx / css / idx | 52+30+5 | [ ] |
| Calendar | Calendar.tsx / css / idx | 319+153+1 | [ ] |
| Card | Card.tsx / css / idx | 53+33+5 | [ ] |
| CellPopup | CellPopup.tsx / css / idx | 312+121+2 | [ ] |
| Checkbox | Checkbox.tsx / css / idx | 61+95+5 | [ ] |
| ColorPicker | ColorPicker.tsx / color.ts / color.check.ts / css / idx | 194+87+38+125+2 | [ ] |
| ConfirmDialog | ConfirmDialog.tsx / css / idx | 66+6+5 | [ ] |
| Counter | Counter.tsx / css / idx | 17+14+1 | [ ] |
| DatePicker | DatePicker.tsx / css / idx | 113+30+1 | [ ] |
| Drawer | Drawer.tsx / css / idx | 75+74+6 | [ ] |
| Dropdown | Dropdown.tsx / DropdownGroup.tsx / MenuItem.tsx / MenuPanel.tsx / MenuCheckItem.tsx / 5css / idx | 172+50+65+43+58+17+54+38+16+54+5 | [ ] |
| EmptyState | EmptyState.tsx / css / idx | 55+46+1 | [ ] |
| ErrorState | ErrorState.tsx / css / idx | 51+6+6 | [ ] |
| FacetFilter | FacetFilter.tsx / css / idx | 162+59+1 | [ ] |
| Field | Field.tsx / css / idx | 81+27+10 | [ ] |
| Icon | Icon.tsx / icon-map.ts / local-icons.tsx / css / idx | 23+178+38+20+1 | [ ] |
| IconButton | IconButton.tsx / css / idx | 77+68+1 | [ ] |
| InlineInput | InlineInput.tsx / css / idx | 49+10+1 | [ ] |
| Input/Textarea | Input.tsx / Textarea.tsx / общий css / idx | 46+43+56+9 | [ ] |
| Layout | Stack / Inline / Grid / Divider / scale.ts / css / idx | 47+45+58+38+20+40+18 | [ ] |
| Link | **PORT** Link.tsx / css / idx | 59+29+5 | [ ] |
| Micro | Text.tsx / Data.tsx / Controls.tsx / 3css / idx | 70+133+156+36+74+66+30 | [ ] |
| Modal | Modal.tsx / css / idx | 100+41+1 | [ ] |
| NumberInput | NumberInput.tsx / css / idx | 140+104+1 | [ ] |
| Page | Screen / PageHeader / PageTitle / PageActions / ChipButton / ScreenPlaceholder / SecondaryHeader / css / idx | 24+36+26+26+32+28+81+133+7 | [ ] |
| Pagination | Pagination.tsx / css / idx | 97+69+5 | [ ] |
| Popover | Popover.tsx / css / idx | 102+59+1 | [ ] |
| Progress | Progress.tsx / css / idx | 53+30+4 | [ ] |
| ProgressBar (NEW 25.08) | ProgressBar.tsx / css / idx | 69+62+4 | [ ] |
| Radio | Radio.tsx / css / idx | 105+80+5 | [ ] |
| RangeCalendar | RangeCalendar.tsx / css / idx | 179+91+1 | [ ] |
| ScrollArea | ScrollArea.tsx / use-scrolled.ts / css / idx | 43+28+27+2 | [ ] |
| SearchInput | SearchInput.tsx / css / idx | 67+42+1 | [ ] |
| SearchTrigger | SearchTrigger.tsx / css / idx | 57+84+1 | [ ] |
| Segmented | Segmented.tsx / css / idx | 136+124+1 | [ ] |
| Select | Select.tsx / css / idx | 123+52+9 | [ ] |
| Skeleton | Skeleton.tsx / css / idx | 45+25+4 | [ ] |
| Spinner | Spinner.tsx / css / idx | 47+23+4 | [ ] |
| Switch | Switch.tsx / css / idx | 56+53+4 | [ ] |
| Table | Table.tsx / css(381!) / idx | 154+381+1 | [ ] |
| Tabs | Tabs.tsx / css / idx | 77+60+6 | [ ] |
| Toast | Toast.tsx / css / idx | 113+73+5 | [ ] |
| Tooltip | Tooltip.tsx / css / idx | 133+25+5 | [ ] |
| Tree | Tree.tsx / tree-nodes.ts / idx | 65+49+1 | [ ] |
| TreeRow | TreeRow.tsx / NestedTreeNode.tsx / css / idx | 109+111+209+5 | [ ] |
| Typography | Typography.tsx / css / idx | 122+30+9 | [ ] |
| VisuallyHidden | VisuallyHidden.tsx / idx | 25+1 | [ ] |

Итого shared/ui: 10149 строк, 52 слайса, 0 PORT кроме Link/Breadcrumbs.
Порядок переноса внутри Ф1 — по списку сверху вниз (зависимости уже отсортированы:
Badge(Tone) раньше потребителей, Layout раньше ButtonGroup, Field раньше Input).

## Приложение З. Шпаргалка команд

```bash
# ── источник (aag.tender): сверка визуала во время Ф1–Ф4
bun run dev                          # :5173, моки

# ── цель (web)
npm run dev                          # Next :3000; бэкенд: docker compose up -d db backend
npx tsc --noEmit                     # typecheck после каждой фазы
npm run lint                         # eslint (cu/ включить в Ф6)

# ── assert-скрипты cu (после MOVE соответствующего слоя)
npx tsx src/cu/shared/lib/date.check.ts
npx tsx src/cu/entities/tender/model/tender.check.ts
npx tsx src/cu/entities/comparison/model/comparison.check.ts
npx tsx src/cu/entities/comparison/model/terms.check.ts
npx tsx src/cu/entities/comparison/model/viewUrl.check.ts
npx tsx src/cu/features/ai-analysis/model/analysis.check.ts
npx tsx src/cu/features/ai-analysis/model/insights.check.ts
npx tsx src/cu/pages/tender/model/columns.check.ts
npx tsx src/cu/shared/ui/ColorPicker/color.check.ts

# ── css-modules чекер (норма: ноль)
python3 ../aag.tender/.claude/skills/fsd-component/scripts/check_css_modules.py \
  --root web/src/cu   # путь скрипта подложить из источника

# ── живой контракт бэкенда при написании адаптеров
curl -s localhost:8000/openapi.json | jq '.paths | keys[]' | grep tender
curl -s "localhost:8000/tenders/{id}/comparison" -H "Authorization: Bearer …" | jq 'keys'

# ── стенд целиком (Ф6)
docker compose build web && docker compose up -d web
```

## Хвост: как пользоваться документом

1. ПМ/заказчику — показать §0, §7.2 (потери) и §7.3 (решения) ДО старта Ф4.
2. Исполнитель — работает по Ф0–Ф6 чек-листам; приложения А/Б — справочник при переносе.
3. Бэкенд-трек — §7.4 в delivery/backlog, параллельно с Ф3.
4. Документ живёт в aag.tender рядом с DESIGN-NOTES.md; отмечать выполненное
   прямо в чек-листах ([x]) и дополнять решения §7.3 по мере принятия.

*Составлено по полному обходу обеих кодовых баз; числа строк сняты wc -l
по фактическому состоянию файлов.*
