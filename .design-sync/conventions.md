## Как устроена эта система

Продуктовая дизайн-система тендерной платформы. Каркас (топбар, рейл, панель
раздела) перенесён из эталона ClickUp с пиксельной точностью — его числа
менять нельзя. Продуктовые экраны (реестр тендеров, карточка тендера,
сравнение КП) построены поверх этого каркаса.

Собирайте экраны из компонентов ниже. **Не пишите свою вёрстку там, где есть
готовый компонент** — половина работы системы в том, чтобы не появилось
седьмой копии кнопки-иконки.

### Обёртка: три провайдера, иначе половина компонентов без контекста

```jsx
<SolarProvider strokeWidth={1.5}>
  <ToastProvider>
    <MemoryRouter>
      {/* ваш экран */}
    </MemoryRouter>
  </ToastProvider>
</SolarProvider>
```

Без `SolarProvider` глифы теряют толщину линии; без `ToastProvider` падает
`useToast()`; без роутера `<Link>` и `<Breadcrumbs>` не знают маршрута.
Все три — экспорты бандла (`window.AagTender.*`).

### Идиома стилей: НЕТ классов-утилит. Токены и компоненты раскладки

Классы компонентов хэшируются CSS-модулями — придумать своё имя класса и
попасть в систему **невозможно**. Вместо этого:

**1. Раскладка — компонентами, зазор — ступенью шкалы, а не пикселями.**

```jsx
<Stack gap={3}>…</Stack>     {/* колонка;  gap 0–9 = 0,4,8,12,16,20,24,28,32,36px */}
<Inline gap={2} align="center" wrap>…</Inline>   {/* ряд */}
<Grid gap={4} columns={2}>…</Grid>               {/* сетка равных ячеек */}
<Divider />                                       {/* линия секции */}
```

`Box`, `Container`, `Spacer` намеренно не существуют. Своя обёртка с
`padding`/`margin` в пикселях — признак того, что взят не тот компонент.

**2. Цвет, тень, радиус, кегль, время — только `var(--cu-*)`.** Полный набор:

| Семья | Значения |
|---|---|
| `--cu-size-1…9` | 4, 8, 12, 16, 20, 24, 28, 32, 36px |
| `--cu-radii-2/3/4/6/round` | 4, 6, 8, 12px, 666px |
| `--cu-content-primary/secondary/tertiary/quaternary/placeholder/on-dark` | серая лестница текста |
| `--cu-background-main/menu`, `--cu-global-sidebar-background`, `--cu-border-default` | поверхности и хэйрлайн |
| `--cu-elevation-1…4`, `--cu-elevation-border-1/4` | тень; версия `-border-` заменяет собой рамку |
| `--cu-state-hover-subtle/hover/hover-strong`, `--cu-state-ring`, `--cu-focus-ring` | состояния |
| `--cu-fill`, `--cu-fill-subtle` | заливка в покое |
| `--cu-tone-{info,success,warning,danger,neutral}` + суффиксы `-ink`, `-fill` | семантические тона |
| `--cu-text-xs/sm/base/md/lg/xl/2xl` | 11, 12, 13, 14, 16, 18, 20px |
| `--cu-leading-same/tight/normal`, `--cu-font-weight-regular/medium/semibold/bold` | типографика |
| `--cu-duration-fast/base/slow`, `--cu-ease-standard/enter/exit/emphasized` | движение |

**Три правила выбора состояния**, а не «как у соседнего компонента»:
площадь обратно пропорциональна плотности (крупная поверхность → `-subtle`);
контрол, у которого в покое уже есть заливка, шагает на ступень вверх
(`-strong`); белая капсула на светлом заливаться не может — ей `--cu-state-ring`.

**3. Классы, которые компоненты отдают наружу** — единственный легальный способ
подкрасить их внутренности: `tableCell.{numeric,mono,strong,muted,sub,link,
rowLink,card,roomy,empty}`, `modalPart.{head,foot}`, `drawerPart.{head,foot}`,
`cardPart`, `searchSecondaryIconClass`.

### Правила, которые ломаются молча

- **Один статус — один тон и один глиф во всех местах сразу.** Тон и иконку
  компонент получает пропом из доменной таблицы (`STATUS`, `BID_STATUS`), а не
  выбирает сам. Не заводите свою палитру статусов.
- **Цвет никогда не единственный канал.** `<Badge>` без `icon` формально
  работает, но так делать нельзя: при дальтонизме состояние неразличимо.
- **Окно и выпадашка — нативный `<dialog>`, открытость это ПРОП.**
  `<Modal open>`, `<Drawer open>`, `<Popover anchor>`, `<ConfirmDialog open>`.
  Никаких `ref.showModal()`: иначе «окно открыто» знают двое, и Escape
  разводит их первым же нажатием.
- **Мультивыбор в меню — `<Dropdown closeOnSelect={false}>`**, а не
  `stopPropagation` в содержимом.
- **Колонки, которые СРАВНИВАЮТ, ширину по содержимому брать не должны:**
  `<Table layout="fixed">` + `<colgroup>`. Проценты внутри `calc()`/`clamp()`
  у `<col>` молча игнорируются — арифметика идёт в `cqw`.
- **Значение, которое правят на месте, в покое выглядит текстом:**
  `<InlineInput>` и `<DatePicker>`. Экран из четырёх обведённых полей читается
  как анкета, а сводку в первую очередь читают. Форму, которую пришли
  заполнять, собирают из `<Field>` + `<Input>`.
- **Заголовок экрана — `<PageTitle>` внутри `<PageHeader>`**, не `<Heading>`.
  Вкладки среза данных — `<SecondaryHeader>`, вкладки поверхностей внутри
  окна — `<Tabs>`.
- **Нативный `<select>` в панели не используется**: раскрытый список рисует ОС.
  Выбор одного значения — `<Select>`.

### Где смотреть правду

- `_ds/<folder>/styles.css` и его `@import` — все токены, reset и каталог из
  десяти рецептов взаимодействия целиком.
- `components/<группа>/<Имя>/<Имя>.prompt.md` — на каждый компонент четыре
  раздела: **КОГДА** его брать, **НЕ ДЛЯ** чего (со ссылкой на правильную
  альтернативу), **UX** и **A11Y**. Раздел «НЕ ДЛЯ» читать обязательно: он
  написан ровно затем, чтобы не появился дубликат.
- `components/<группа>/<Имя>/<Имя>.d.ts` — контракт пропсов.

### Пример в идиоме системы

```jsx
const { Screen, PageHeader, PageTitle, Stack, Inline, Card, Text, Heading,
        Badge, Button, Table, tableCell, STATUS, ROWS } = window.AagTender;

<Screen>
  <PageHeader><PageTitle>Реестр тендеров</PageTitle></PageHeader>

  <Card>
    <Stack gap={4}>
      <Inline gap={3} align="center">
        <Heading level={3}>Устройство монолитного фундамента</Heading>
        <Badge tone={STATUS.open.tone} icon={STATUS.open.icon}>{STATUS.open.label}</Badge>
      </Inline>
      <Inline gap={2} align="center">
        <Text size="sm" tone="secondary">Срок сбора КП</Text>
        <Text weight="medium">15.07.2026</Text>
      </Inline>
    </Stack>
  </Card>

  <Table caption={`Всего тендеров: ${ROWS.length}`}>
    <thead><tr><th scope="col">№</th><th scope="col">Название</th><th scope="col">Статус</th></tr></thead>
    <tbody>
      {ROWS.slice(0, 5).map((row) => (
        <tr key={row.id} className={tableCell.rowLink}>
          <td className={tableCell.mono}>{row.id}</td>
          <td className={tableCell.strong}>{row.title}</td>
          <td>
            <Badge tone={STATUS[row.status].tone} icon={STATUS[row.status].icon}>
              {STATUS[row.status].label}
            </Badge>
          </td>
        </tr>
      ))}
    </tbody>
  </Table>

  <Inline gap={2} align="center">
    <Button variant="primary">Создать тендер</Button>
    <Button variant="secondary">Экспорт</Button>
  </Inline>
</Screen>
```

Демо-данные домена тоже в бандле и годятся для макетов: `ROWS`, `STATUS`,
`STATUS_IDS`, `BID_STATUS`, `MOCK_COMPARISON`. Список критериев фильтра —
ФУНКЦИЯ от строк: `facetsOf(ROWS)`.

`ROWS` и `MOCK_COMPARISON` приезжают только сюда, из `ds-entry.ts`: публичные
точки слайсов фикстуры не отдают, чтобы приложение не смогло случайно
показать демо-цифры вместо ответа сервера.
