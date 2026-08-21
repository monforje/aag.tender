# Бейджи ячеек и полоса фильтров сравнения КП — дизайн-спека

Документ отвечает на вопрос «как это нарисовано», а не «что это значит».
Семантика, формулы и мощность фильтров — в `filter_audit.md` (§4); ссылки вида
«§4.2» без префикса ведут туда же. Здесь — словарь визуальных устройств для
пометок ячеек, редизайн полосы фильтров (без забора кнопок) и попап минимума,
переведённый в стилистику проекта.

Три самодостаточных HTML-демо лежат прямо в этом файле:

1. **Галерея пометок** — все устройства разом на одной мини-таблице;
2. **Полоса фильтров** — сегмент пресетов + два дропдауна + поповер предикатов;
3. **Попап минимума** — светлый, на токенах проекта, поверх нативного `<dialog>`.

Живое превью полного экрана — `badges.html`. Оно прошло интерфейсный аудит:
восемь находок внесены в файл и помечены там тегами `[R1]…[R8]`, сводка — в
Части VI.

---

## Часть I. Пометки ячеек: от семантики к устройству

### 0. Правила канала

Правила, из которых выводится каждое устройство ниже. Нарушение любого из них —
повод вернуться к списку, а не чинить конкретный бейдж.

1. **Цвет берётся только из тонов.** Пять тонов `--cu-tone-*`
   (info / success / warning / danger / neutral), у каждого три роли:
   цвет, `-ink` для текста поверх заливки, `-fill` для подложки .1.
   Локальных hex нет: если домену нужен шестой смысл — это новый токен
   в `global.css`, а не цвет по месту.
2. **Ни одна пометка не живёт одним цветом.** Цвет + форма ИЛИ цвет + глиф
   ИЛИ цвет + текст. Требование дальтонизма и ч/б печати; заодно правило
   «один статус — один тон и один глиф везде» (см. STATUS в `entities/tender`).
3. **Цена — главный текст ячейки.** Пометка не меняет её кегль, не двигает,
   не переносит. Устройство ложится ПОД или ВОКРУГ числа, а не вместо него.
4. **Тихие в покое, объясняются по наведению.** В таблице пометка отвечает
   на вопрос «куда смотреть», попап — «почему так». Всё, что длиннее двух
   слов (причина аномалии, выгода в рублях, отклонение от медианы),
   живёт в попапе, а не в ячейке.
5. **Одно устройство — один смысл.** Каналы кодирования не пересекаются:
   рейка слева занята аномалией и никем больше; мазок-маркер занят минимумом;
   пунктирная рамка — отсутствием цены. Второй смысл = второе устройство,
   даже если хочется «просто перекрасить».
6. **Пометки приходят готовыми в данных** (§4.6) — макет их рисует, не
   вычисляет. Исключения (`min`, `spreadTag`) оговорены там же и в Части IV.

### 1. Словарь: семантика → устройство

Сводная таблица. «Устройство» раскрыто в §2, поле — контракт данных из §5.

| смысл | поле | устройство | тон | глиф / текст |
|---|---|---|---|---|
| лучшая цена | `cell.isMin` (лучшая НЕаномальная, §4.6) | мазок маркера под ценой + микроценник «мин» | success | «мин» |
| цена требует обоснования | `cell.anomaly` (+ причина) | штриховка «внимание» + рейка 3px слева | warning | попап с причиной |
| позиция не закрыта | `cell.missing` / `null` | пунктирная рамка, тире | neutral | «—» + sr-only «нет цены» |
| отказ от объёма | `item.declined[sid]` | капсула с перечёркнутым кругом | neutral | ⊘ Отказ |
| снята из сметы | `item.removed` | строка притушена, название зачёркнуто, капсула | neutral | «снята» |
| объём скорректирован | `item.corrected`, `qtyOrig` | старое значение зачёркнуто tertiary, стрелка, новое | — | `1200 → 1260` |
| ключевая позиция | `item.isKey` | звезда перед названием строки | warning | ★ |
| разброс цен | `spreadPct` + `spreadTag` | процент + микрошкала под ним | none→neutral, noticeable→warning, high→danger | % |
| потенциал торга | `cell.potential > 0` | подпись-капсула под ценой | success | `+179 340 ₽` |

Что сознательно НЕ вошло в словарь:

- **Фиолетовая полоса аномалии из макета** — в шкале проекта violet нет.
  Аномалия по смыслу — «внимание, требуется обоснование», это warning.
  Красный (danger) оставлен цифрам отклонения за допуском — самая жёсткая
  ступень должна означать самое худшее.
- **Красная рамка/фон наведения** (`focusRow/focusCol`) — это состояние UI,
  а не семантика; берётся из каталога состояний (`--cu-state-hover-subtle`),
  в словарь пометок не входит.

### 2. Устройства

#### 2.1 «Минимум» — мазок маркера + микроценник (выбрано)

Метафора: закупщик листает распечатки КП и проводит зелёным маркером под
ценой, которая его устроила. Цена остаётся обычным текстом таблицы — пометка
живёт ПОД ней, как след руки человека, а не как наклейка системы.

Рассмотренные варианты:

- **A. Мазок маркера** (выбран): нижняя половина строки цены залита
  `-fill` тона success через градиент с резкой границей — читается как
  проведённый рукой мазок, а не как подсветка ячейки. Плюс микроценник
  «мин» — крошечная капсула 9px над базовой линией, как бирка на ценнике.
  Цена не двигается, колонка не разъезжается, при 20 строках глаз находит
  зелёные мазки вертикальным сканированием.
- **B. Ценник-бирка**: капсула с проколотым отверстием (radial-gradient mask)
  и скошенным хвостом (clip-path). Метафора сильная, но это ещё один
  прямоугольник рядом с числом — при четырёх подрядчиках в строке таблица
  превращается в витрину стикеров. Оставлен как опция для карточки, где
  места больше.
- **C. Зелёная рейка слева** (отклонён): канал «рейка слева» занят аномалией
  (правило 5). Перекраска той же рейки в зелёный сделала бы различимые
  состояния неразличимыми для дальтоника — остались бы две рейки разных
  цветов без формы и текста.

```html
<span class="price price--min">
  1&nbsp;997&nbsp;100&nbsp;₽<span class="min-flag" aria-hidden="true">мин</span>
</span>
```

```css
.price{ position:relative; white-space:nowrap; }
.price--min{
  /* мазок: прозрачный верх, заливка success под нижней половиной текста */
  background: linear-gradient(180deg, transparent 55%, var(--tone-success-fill) 55%);
  border-radius: 2px;
}
.min-flag{
  position:absolute; top:-7px; right:-26px;
  padding: 0 4px; border-radius: var(--cu-radii-round);
  background: var(--tone-success-fill); color: var(--tone-success-ink);
  font-size: 9px; line-height: 12px; font-weight: 700;
  letter-spacing: .06em; text-transform: uppercase;
}
```

Скринридеру отдаётся расшифровка отдельным узлом `.visually-hidden`
(«лучшая цена среди неаномальных предложений»), микроценник — aria-hidden:
он дубль, а не источник смысла (правило 2).

#### 2.2 «Аномалия» — штриховка «внимание»

Метафора: сигнальная лента на стройке. Диагональная штриховка низкой альфы
(`repeating-linear-gradient(-45deg, fill 0 5px, transparent 5px 10px)` от
`--cu-tone-warning-fill`) плюс рейка 3px слева сплошным `--cu-tone-warning`.
Штриховку невозможно перепутать ни с hover-заливкой, ни с мазком минимума —
это единственное устройство в таблице с текстурой, и именно поэтому оно
читается как «здесь надо остановиться».

Полоска и штриховка — один тон, но два канала (форма + текстура), поэтому
помеченную цену можно найти даже в обесцвеченном виде. Причина аномалии в
ячейку не помещается физически — она живёт в попапе (Часть III), поэтому
контракт требует `anomaly` **с причиной** (§4.3).

```css
.cell--anomaly{
  box-shadow: inset 3px 0 0 var(--tone-warning);
  background-image: repeating-linear-gradient(-45deg,
    var(--tone-warning-fill) 0 5px, transparent 5px 10px);
}
```

Важно (правило §4.6): аномально дешёвое предложение выбывает из соревнования
за `min`, но остаётся в расчёте разброса. В галерее это строка «Арматура»:
самая дешёвая цена заштрихована, микроценник «мин» сидит на второй по
дешевизне.

#### 2.3 «Нет цены» против «Отказа» — пробел и решение

Два состояния обязаны выглядеть по-разному, потому что они противоположны по
природе (§4 слой 3): отсутствие — пробел, отказ — решение.

- **Нет цены**: пустота, оформленная честно. Пунктирная рамка внутри ячейки
  (`outline: 1px dashed var(--cu-border-default); outline-offset: -4px`)
  и тире третичным серым. Рамка говорит «место было, содержимого нет» —
  и не спорит ни с каким тоном. Скринридеру — «позиция не закрыта».
- **Отказ**: капсула нейтрального тона с перечёркнутым кругом и словом
  «Отказ». Нейтральный, а не danger: подрядчик не нарушил ничего, он
  не взял объём; красить решение в тревогу — врать о его природе.

```html
<td class="cell cell--missing"><span class="dash">—</span><span class="sr">нет цены</span></td>
<td class="cell"><span class="chip chip--neutral">⊘ Отказ</span></td>
```

```css
.cell--missing{ outline: 1px dashed var(--border); outline-offset: -4px; }
.dash{ color: var(--content-tertiary); }
.chip{
  display:inline-flex; align-items:center; gap:4px;
  height: 18px; padding: 0 8px; border-radius: var(--cu-radii-round);
  font-size: 11px; font-weight: 500;
}
.chip--neutral{ background: var(--tone-neutral-fill); color: var(--tone-neutral-ink); }
```

#### 2.4 «Снята» и «Корректировка» — дифф сметы

Правки сметы показываются прямо в строке (§4 слой 2):

- **Снята**: строка целиком притушена (`opacity:.45`), название зачёркнуто,
  рядом нейтральная капсула «снята», ячейки схлопываются в «—». Строка
  остаётся в DOM и в счётчиках — она часть истории сметы, а не мусор.
- **Корректировка объёма**: старое значение — третичным серым и зачёркнуто,
  стрелка, новое — обычным текстом: `~~1200~~ → 1260`. Капсулы «корр.» нет:
  сама пара чисел и есть сообщение, дублировать её ярлыком — шум.

```html
<td class="cell cell-title is-removed">
  Арматура A500 <span class="chip chip--neutral">снята</span>
</td>
<td class="cell qty-corrected"><s>1200</s> → 1260</td>
```

#### 2.5 «Ключевая позиция» — звезда

Одна звезда `★` перед названием строки, тон warning (янтарный читается на
белом лучше жёлтого, см. комментарий к токенам в `global.css`). Никаких
заливок строки: ключевых позиций четыре из двадцати, и задача пометки —
быть маяком при сканировании левой колонки, а не перекрасить четверть
таблицы. Звезда дублируется `aria-label="ключевая позиция"`.

#### 2.6 «Разброс» — процент со шкалой

Процент дополняется микрошкалой — полоской 24×3px под числом, заполненной
пропорционально величине разброса (масштаб: 25 % = полная шкала). Цвет
заливки шкалы = тон тега: none → neutral, noticeable → warning, high →
danger. Это единственное устройство, которое ЧАСТИЧНО вычисляется — после
внедрения порогов §4.2 (`high ≥ 15 %`, `noticeable ≥ 7 %`) метка и шкала
выводятся из одного процента, и спор «число против подписи» исчезает.

Шкала — не украшение: она позволяет сравнивать разброс периферийным зрением,
не читая числа, и работает вместе с фильтром «Высокий разброс», который
красит ровно эти же метки.

```html
<div class="spread spread--high">
  <span class="spread-pct">18,2 %</span>
  <span class="spread-bar" aria-hidden="true"><i style="width:73%"></i></span>
</div>
```

```css
.spread-pct{ font-variant-numeric: tabular-nums; }
.spread-bar{ display:block; width:24px; height:3px; margin-top:3px;
  border-radius:99px; background: var(--fill); overflow:hidden; }
.spread-bar i{ display:block; height:100%; border-radius:inherit; }
.spread--none       i{ background: var(--tone-neutral); }
.spread--noticeable i{ background: var(--tone-warning); }
.spread--high       i{ background: var(--tone-danger); }
```

#### 2.7 «Потенциал торга» — подпись под ценой

`+179 340 ₽` капсулой тона success ПОД ценой (11px, tabular-nums). Success,
потому что потенциал — это деньги, которые ещё можно сбить: это возможность,
а не проблема. Показывается только в режиме показателя «Цена»; в режимах
«Отклонение» и «Потенциал» ячейка уже говорит об этом другим числом, и
дублировать её капсулой — дважды сказать одно (§2 «На что влияет выбор
показателя»).

### 3. Галерея — все устройства разом

Самодостаточный HTML. Открыть в браузере, сверить с §2. Данные согласованы
с правилами аудита: минимум не сидит на аномалии, «Кабель» с одной ценой
показывает `spread = null`, снятая строка остаётся в счётчиках.

```html
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<title>Галерея пометок сравнения КП</title>
<style>
  /* --- токены проекта (global.css), вырезка нужного --- */
  :root{
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", roboto, "Helvetica Neue", helvetica, arial, sans-serif;
    --content-primary:#202020; --content-secondary:#646464; --content-tertiary:#838383;
    --border:#e8e8e8; --fill:rgba(0,0,0,.06);
    --tone-info:rgb(29,110,220);   --tone-info-ink:rgb(24,88,176);   --tone-info-fill:rgba(29,110,220,.1);
    --tone-success:rgb(0,138,86);  --tone-success-ink:rgb(0,116,72); --tone-success-fill:rgba(0,138,86,.1);
    --tone-warning:rgb(214,119,10);--tone-warning-ink:rgb(176,96,6); --tone-warning-fill:rgba(214,119,10,.1);
    --tone-danger:rgb(233,61,130); --tone-danger-ink:rgb(197,40,105);--tone-danger-fill:rgba(233,61,130,.1);
    --tone-neutral:rgb(150,150,150); --tone-neutral-ink:#646464;     --tone-neutral-fill:var(--fill);
    --r3:6px; --r-round:666px;
  }

  *{ box-sizing:border-box }
  body{ margin:0; padding:32px; font-family:var(--font); font-size:13px; line-height:18px;
        color:var(--content-primary); background:#fff; }

  h1{ margin:0 0 4px; font-size:16px; line-height:22px; font-weight:600; }
  .sub{ margin:0 0 20px; color:var(--content-secondary); }

  /* счётчики над таблицей — считаются по ВСЕМУ датасету, не по экрану */
  .counts{ display:flex; gap:16px; margin-bottom:12px; color:var(--content-tertiary); }
  .counts b{ color:var(--content-primary); font-weight:600; font-variant-numeric:tabular-nums; }

  table{ width:100%; max-width:980px; border-collapse:collapse; }
  th{ text-align:left; padding:8px 12px; color:var(--content-secondary);
      font-size:12px; font-weight:500; border-bottom:1px solid var(--border); }
  td{ padding:10px 12px; border-bottom:1px solid var(--border); vertical-align:middle; }
  td.num, th.num{ text-align:right; font-variant-numeric:tabular-nums; }
  tr:hover td:not(.static){ background:rgba(0,0,0,.03); }

  /* --- 2.5 ключевая позиция --- */
  .star{ color:var(--tone-warning); margin-right:4px; }

  /* --- 2.1 минимум --- */
  .price{ position:relative; white-space:nowrap; font-weight:500; }
  .price--min{
    background:linear-gradient(180deg, transparent 55%, var(--tone-success-fill) 55%);
    border-radius:2px;
  }
  .min-flag{
    position:absolute; top:-7px; right:-28px; padding:0 4px;
    border-radius:var(--r-round); background:var(--tone-success-fill); color:var(--tone-success-ink);
    font-size:9px; line-height:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;
  }
  .unit{ margin-top:2px; font-size:11px; line-height:14px; color:var(--content-tertiary); }

  /* --- 2.7 потенциал --- */
  .pot{ display:inline-block; margin-top:4px; padding:0 6px; border-radius:var(--r-round);
        background:var(--tone-success-fill); color:var(--tone-success-ink);
        font-size:11px; line-height:16px; font-variant-numeric:tabular-nums; }

  /* --- 2.2 аномалия --- */
  .cell--anomaly{
    box-shadow:inset 3px 0 0 var(--tone-warning);
    background-image:repeating-linear-gradient(-45deg,
      var(--tone-warning-fill) 0 5px, transparent 5px 10px);
  }
  .cell--anomaly:hover{ background-color:transparent; }

  /* --- 2.3 нет цены / отказ --- */
  .cell--missing{ outline:1px dashed var(--border); outline-offset:-4px; text-align:right; }
  .dash{ color:var(--content-tertiary); }
  .chip{ display:inline-flex; align-items:center; gap:4px; height:18px; padding:0 8px;
         border-radius:var(--r-round); font-size:11px; font-weight:500; white-space:nowrap; }
  .chip--neutral{ background:var(--tone-neutral-fill); color:var(--tone-neutral-ink); }

  /* --- 2.4 снята / корректировка --- */
  tr.is-removed td{ opacity:.45; }
  .strike{ text-decoration:line-through; }
  s{ color:var(--content-tertiary); }

  /* --- 2.6 разброс --- */
  .spread-pct{ font-variant-numeric:tabular-nums; }
  .spread-bar{ display:block; width:24px; height:3px; margin-top:3px; margin-left:auto;
               border-radius:var(--r-round); background:var(--fill); overflow:hidden; }
  .spread-bar i{ display:block; height:100%; border-radius:inherit; }
  .spread--none       .spread-bar i{ background:var(--tone-neutral); }
  .spread--noticeable .spread-bar i{ background:var(--tone-warning); }
  .spread--high       .spread-bar i{ background:var(--tone-danger); }

  .sr{ position:absolute; width:1px; height:1px; margin:-1px; padding:0;
       overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }

  /* легенда под таблицей — те же устройства, что в ячейках */
  .legend{ display:flex; flex-wrap:wrap; gap:8px 20px; margin-top:16px; color:var(--content-secondary); font-size:12px; }
</style>
</head>
<body>

<h1>Сравнение КП — пометки ячеек</h1>
<p class="sub">Галерея устройств из §2. Наведи курсор — hover-рецепт из каталога состояний.</p>

<div class="counts">
  <span>показано <b>4 / 5</b></span>
  <span>отказов <b>1</b></span>
  <span>без цены <b>1</b></span>
  <span>аномалий <b>1</b></span>
</div>

<table>
  <thead>
    <tr>
      <th style="width:30%">Позиция</th>
      <th class="num">СтройМонтаж</th>
      <th class="num">МонолитГрупп</th>
      <th class="num">СпецЖБИ</th>
      <th class="num" style="width:12%">Разброс</th>
    </tr>
  </thead>
  <tbody>

    <tr><!-- Бетон: минимум у Монолита, ключевая, разброс заметный -->
      <td><span class="star" role="img" aria-label="ключевая позиция">★</span>Бетон B25 W8 F150 · 420 м³</td>
      <td class="num">2 177 000 ₽</td>
      <td class="num">
        <span class="price price--min">1 997 100 ₽<span class="min-flag" aria-hidden="true">мин</span></span>
        <div class="unit">4 755 ₽/м³ <span class="pot">+179 340 ₽</span></div>
      </td>
      <td class="num">2 041 000 ₽</td>
      <td class="num"><span class="spread spread--noticeable"><span class="spread-pct">9,0 %</span>
        <span class="spread-bar"><i style="width:36%"></i></span></span></td>
    </tr>

    <tr><!-- Арматура: аномально дешёвая цена выбывает из соревнования за min -->
      <td>Арматура A500 · 1200 т</td>
      <td class="num cell--anomaly static" title="Аномалия: цена требует обоснования">4 120 000 ₽</td>
      <td class="num">
        <span class="price price--min">4 315 900 ₽<span class="min-flag" aria-hidden="true">мин</span></span>
        <div class="unit">3 597 ₽/т</div>
      </td>
      <td class="num">4 480 000 ₽</td>
      <td class="num"><span class="spread spread--noticeable"><span class="spread-pct">8,7 %</span>
        <span class="spread-bar"><i style="width:35%"></i></span></span></td>
    </tr>

    <tr><!-- Кабель: одна цена — spread null; missing ≠ declined -->
      <td>Кабель ВБбШв 4×16 · 800 м</td>
      <td class="num">
        <span class="price price--min">863 400 ₽<span class="min-flag" aria-hidden="true">мин</span></span>
        <div class="unit">1 079 ₽/м</div>
      </td>
      <td class="num cell--missing static"><span class="dash">—</span><span class="sr">нет цены</span></td>
      <td class="num"><span class="chip chip--neutral">⊘ Отказ</span></td>
      <td class="num"><span class="spread spread--none"><span class="spread-pct" style="color:var(--content-tertiary)">—</span></span></td>
    </tr>

    <tr><!-- Опалубка: корректировка объёма -->
      <td>Опалубка щитовая · <s>1200</s> → 1260 м²</td>
      <td class="num">1 240 000 ₽</td>
      <td class="num">1 198 000 ₽</td>
      <td class="num">1 310 500 ₽</td>
      <td class="num"><span class="spread spread--none"><span class="spread-pct">9,4 %</span>
        <span class="spread-bar"><i style="width:38%"></i></span></span></td>
    </tr>

    <tr class="is-removed"><!-- снятая позиция -->
      <td><span class="strike">Грунт для обратной засыпки</span> <span class="chip chip--neutral">снята</span></td>
      <td class="num">—</td>
      <td class="num">—</td>
      <td class="num">—</td>
      <td class="num"><span class="spread spread--none"><span class="spread-pct">—</span></span></td>
    </tr>

  </tbody>
</table>

<div class="legend">
  <span><span class="star">★</span> ключевая</span>
  <span><span class="price price--min" style="font-weight:400">цена<span class="min-flag">мин</span></span> лучшая неаномальная цена</span>
  <span>▨ аномалия — обосновать</span>
  <span>◌ нет цены</span>
  <span>⊘ отказ</span>
  <span>шкала — разброс: серый &lt; 7 %, янтарный ≥ 7 %, красный ≥ 15 %</span>
</div>

</body>
</html>
```

---

## Часть II. Полоса фильтров

### 1. Что не так с кнопками

Ряд из пяти кнопок-переключателей («Ключевые», «Высокий разброс», «Аномалии»,
«Есть потенциал», «Выше медианы») — забор: пять одинаковых прямоугольников,
из которых нельзя понять, сколько фильтров активны, что именно отсекает
строки и куда идти, чтобы увидеть критерий целиком. Каждый новый предикат
делает ряд шире, а не умнее. Пользователь не может комбинировать фильтры,
видя их список, — он играет в рулетку нажатий.

### 2. Решение: анатомия полосы

Единственный элемент полосы, который состоит из кнопок, — переключатель
пресетов. Он этого заслуживает: пресетов ровно три, они взаимоисключающие,
переключаются часто, и кнопочный сегмент здесь — самый быстрый жест.
Всё остальное — выпадающие элементы.

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Обзор│Торги│Аномалии]  Показатель: Цена ⌄   Строки: По разделам ⌄   │
│                                              [▽ Фильтры •2] ⌄       │
└──────────────────────────────────────────────────────────────────────┘
```

- **Пресеты — сегмент-контрол** (единственные кнопки). Активный пресет —
  белая приподнятая капсула на сером треке, рецепт ClickUp для табов.
- **Показатель и Вид строк — дропдауны одиночного выбора.** Триггер — тихий
  ghost-элемент «подпись + текущее значение + шеврон»; значение видно всегда,
  раскрывать полосу ради статуса не нужно. Нативный `<select>` запрещён
  (раскрытый список рисует ОС — см. CLAUDE.md).
- **Предикаты — ОДИН триггер «Фильтры» с поповером.** На триггере — воронка
  и счётчик активных предикатов круглым каунтером. Внутри поповера —
  чек-лист: точка тона (та же, что красит ячейки в таблице), название,
  справа — сколько строк пройдёт этот предикат на текущих данных. Футер:
  «Сбросить всё · N» и «Готово».
- **Активные фильтры НЕ выносятся чипами в полосу** — это снова забор,
  только теперь из чипов. Список активного виден в поповере; на полосе —
  одно число. Если счётчиков станет мало, а предикатов много — число всё
  равно честнее пяти капсул.

### 3. Поведение

1. Предикаты комбинируются по **И**, порядок не важен, пустой набор =
   показать всё (§4). Мультивыбор внутри меню — сериями, меню не закрывается
   по клику на пункт: в React это `closeOnSelect={false}` у `<Dropdown>`
   (конвенция проекта).
2. **Счётчики в пунктах считаются по текущему датасету до применения этого
   фильтра** — иначе число на невыбранном пункте бесполезно. Счётчик на
   триггере — количество ВЫБРАННЫХ предикатов, не строк.
3. **Сброс одной кнопкой** сохраняется: «Сбросить всё» в футере поповера,
   disabled при пустом наборе.
4. Триггеры дропдаунов и поповер фильтров — компоненты `<Dropdown>` /
   `<FacetFilter>` проекта; поповер предикатов — тот же `MenuPanel`, что
   у фасетного фильтра, только с одним коротким списком (правило FacetFilter:
   «НЕ ДЛЯ двух-трёх значений»).
5. Клавиатура: триггеры — кнопки, пункты — `menuitemcheckbox` /
   `menuitemradio`, Escape закрывает, фокус возвращается на триггер — всё
   достаётся от платформы, потому что панели построены на нативном
   `<dialog>` (конвенция «окно и выпадашка — `<dialog>`»).

### 4. HTML-демо полосы

```html
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<title>Полоса фильтров сравнения КП</title>
<style>
  :root{
    --font:-apple-system, BlinkMacSystemFont, "Segoe UI", roboto, "Helvetica Neue", helvetica, arial, sans-serif;
    --content-primary:#202020; --content-secondary:#646464; --content-tertiary:#838383;
    --border:#e8e8e8; --fill-subtle:rgba(0,0,0,.035); --hover-subtle:rgba(0,0,0,.05); --hover:rgba(0,0,0,.06);
    --ring:0 0 0 1px rgba(0,0,0,.16);
    --elev-border-1:0 0 1px 0 rgba(0,0,0,.2667), 0 1px 2px 0 rgba(0,0,0,.05);
    --elev-border-4:0 0 1px 0 rgba(0,0,0,.2667), 0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1);
    --tone-success:rgb(0,138,86); --tone-success-ink:rgb(0,116,72); --tone-success-fill:rgba(0,138,86,.1);
    --tone-warning:rgb(214,119,10); --tone-warning-fill:rgba(214,119,10,.1);
    --tone-danger:rgb(233,61,130);  --tone-danger-fill:rgba(233,61,130,.1);
    --tone-neutral:rgb(150,150,150);--tone-neutral-fill:var(--hover);
    --info:rgb(29,110,220);
    --r3:6px; --r4:8px; --round:666px;
    --anim:.2s cubic-bezier(.42,0,.58,1);
  }
  *{ box-sizing:border-box }
  body{ margin:0; padding:32px; font-family:var(--font); font-size:13px; color:var(--content-primary); background:#fff; }

  button{ font:inherit; cursor:pointer; background:none; border:0; padding:0; margin:0; color:inherit; }

  .bar{ display:flex; align-items:center; gap:8px; }

  /* ---- сегмент пресетов: ЕДИНСТВЕННЫЙ кнопочный элемент полосы ---- */
  .seg{ display:flex; padding:2px; border-radius:var(--r4); background:var(--fill-subtle); }
  .seg button{ height:26px; padding:0 12px; border-radius:var(--r3);
               color:var(--content-secondary); transition:background var(--anim), color var(--anim), box-shadow var(--anim); }
  .seg button:hover{ color:var(--content-primary); }
  .seg button[aria-checked="true"]{
    background:#fff; color:var(--content-primary);
    box-shadow:var(--elev-border-1); font-weight:500;
  }

  .sep{ width:1px; height:20px; background:var(--border); }

  /* ---- тихий триггер дропдауна: подпись · значение · шеврон ---- */
  .trigger{ display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 8px;
            border-radius:var(--r3); transition:background var(--anim); white-space:nowrap; }
  .trigger:hover{ background:var(--hover-subtle); }
  .trigger:focus-visible{ outline:none; box-shadow:var(--ring); }
  .trigger .cap{ color:var(--content-tertiary); }
  .trigger .val{ font-weight:500; }
  .trigger svg{ width:12px; height:12px; stroke:var(--content-tertiary); }

  /* ---- триггер фильтров с каунтером ---- */
  .fbtn{ display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 10px;
         border-radius:var(--r3); font-weight:500; transition:background var(--anim); }
  .fbtn:hover{ background:var(--hover-subtle); }
  .fbtn:focus-visible{ outline:none; box-shadow:var(--ring); }
  .fbtn svg{ width:13px; height:13px; fill:none; stroke:currentColor; }
  .count{ min-width:16px; height:16px; padding:0 4px; border-radius:var(--round);
          background:var(--info); color:#fff; font-size:11px; line-height:16px; font-weight:600;
          font-variant-numeric:tabular-nums; text-align:center; }

  /* ---- панель меню (нативный <dialog> в проекте; тут div для демо) ---- */
  .wrap{ position:relative; }
  .menu{ position:absolute; top:34px; left:0; z-index:10; min-width:232px; padding:4px;
         background:#fff; border-radius:var(--r4); box-shadow:var(--elev-border-4); display:none; }
  .wrap.open .menu{ display:block; }
  .wrap.right .menu{ left:auto; right:0; }

  .mi{ display:flex; align-items:center; gap:8px; width:100%; height:30px; padding:0 8px;
       border-radius:var(--r3); text-align:left; transition:background var(--anim); }
  .mi:hover{ background:var(--hover-subtle); }
  .dot{ width:8px; height:8px; border-radius:50%; flex:none; }
  .mi .n{ flex:1; }
  .mi .c{ color:var(--content-tertiary); font-variant-numeric:tabular-nums; font-size:12px; }
  .mi .ck{ visibility:hidden; color:var(--tone-success-ink); font-weight:700; }
  .mi[aria-checked="true"] .ck{ visibility:visible; }

  .foot{ display:flex; justify-content:space-between; align-items:center;
         padding:6px 8px 2px; margin-top:4px; border-top:1px solid var(--border); }
  .reset{ color:var(--content-secondary); border-radius:var(--r3); padding:2px 6px; transition:background var(--anim); }
  .reset:hover:not(:disabled){ background:var(--hover-subtle); color:var(--content-primary); }
  .reset:disabled{ opacity:.4; cursor:default; }
  .done{ padding:4px 12px; border-radius:var(--r3); background:var(--content-primary); color:#fff; font-weight:500; }

  .note{ margin-top:24px; color:var(--content-tertiary); }
</style>
</head>
<body>

<div class="bar">

  <!-- пресеты: сегмент -->
  <div class="seg" role="radiogroup" aria-label="Пресет" id="seg">
    <button role="radio" aria-checked="true">Обзор</button>
    <button role="radio" aria-checked="false">Торги</button>
    <button role="radio" aria-checked="false">Аномалии</button>
  </div>

  <span class="sep"></span>

  <!-- показатель: дропдаун одиночного выбора -->
  <div class="wrap" data-menu>
    <button class="trigger" aria-haspopup="menu" aria-expanded="false">
      <span class="cap">Показатель:</span><span class="val" data-label>Цена</span>
      <svg viewBox="0 0 12 12" fill="none" stroke-width="1.5"><path d="M3 4.5l3 3 3-3"/></svg>
    </button>
    <div class="menu" role="menu" data-single>
      <button class="mi" role="menuitemradio" aria-checked="true"><span class="n">Цена</span><span class="ck">✓</span></button>
      <button class="mi" role="menuitemradio" aria-checked="false"><span class="n">Отклонение</span><span class="ck">✓</span></button>
      <button class="mi" role="menuitemradio" aria-checked="false"><span class="n">Потенциал</span><span class="ck">✓</span></button>
    </div>
  </div>

  <!-- вид строк: дропдаун одиночного выбора -->
  <div class="wrap" data-menu>
    <button class="trigger" aria-haspopup="menu" aria-expanded="false">
      <span class="val" data-label>По разделам</span>
      <svg viewBox="0 0 12 12" fill="none" stroke-width="1.5"><path d="M3 4.5l3 3 3-3"/></svg>
    </button>
    <div class="menu" role="menu" data-single>
      <button class="mi" role="menuitemradio" aria-checked="true"><span class="n">По разделам</span><span class="ck">✓</span></button>
      <button class="mi" role="menuitemradio" aria-checked="false"><span class="n">По весу</span><span class="ck">✓</span></button>
      <button class="mi" role="menuitemradio" aria-checked="false"><span class="n">По потенциалу</span><span class="ck">✓</span></button>
    </div>
  </div>

  <span style="flex:1"></span>

  <!-- предикаты: один триггер + поповер с чек-листом -->
  <div class="wrap right" data-menu data-filters>
    <button class="fbtn" aria-haspopup="menu" aria-expanded="false">
      <svg viewBox="0 0 14 14"><path d="M1 2h12L8.8 7.2V12l-3.6-2V7.2L1 2z" stroke-linejoin="round"/></svg>
      Фильтры
      <span class="count" hidden data-count>0</span>
    </button>
    <div class="menu" role="menu" data-multi>
      <button class="mi" role="menuitemcheckbox" aria-checked="false">
        <span class="dot" style="background:var(--tone-warning)"></span>
        <span class="n">Ключевые</span><span class="c">4</span><span class="ck">✓</span>
      </button>
      <button class="mi" role="menuitemcheckbox" aria-checked="false">
        <span class="dot" style="background:var(--tone-danger)"></span>
        <span class="n">Высокий разброс</span><span class="c">5</span><span class="ck">✓</span>
      </button>
      <button class="mi" role="menuitemcheckbox" aria-checked="false">
        <span class="dot" style="background:var(--tone-warning)"></span>
        <span class="n">Аномалии</span><span class="c">3</span><span class="ck">✓</span>
      </button>
      <button class="mi" role="menuitemcheckbox" aria-checked="true">
        <span class="dot" style="background:var(--tone-success)"></span>
        <span class="n">Есть потенциал</span><span class="c">19</span><span class="ck">✓</span>
      </button>
      <div class="foot">
        <button class="reset" data-reset disabled>Сбросить всё</button>
        <button class="done" data-done>Готово</button>
      </div>
    </div>
  </div>

</div>

<p class="note">Пресеты — сегмент (единственные кнопки). Остальные — тихие триггеры
с выпадающими панелями. Число у «Фильтров» — сколько предикатов выбрано.</p>

<script>
  // пресеты: радио
  const seg = document.getElementById('seg');
  seg.addEventListener('click', (e) => {
    for (const b of seg.querySelectorAll('[role="radio"]'))
      b.setAttribute('aria-checked', String(b === e.target));
  });

  // открытие/закрытие панелей
  document.querySelectorAll('[data-menu]').forEach((wrap) => {
    const btn = wrap.querySelector('button');
    btn.addEventListener('click', () => {
      const open = wrap.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      document.querySelectorAll('.wrap.open').forEach((w) => {
        if (w !== wrap) { w.classList.remove('open'); w.querySelector('button').setAttribute('aria-expanded','false'); }
      });
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-menu]'))
      document.querySelectorAll('.wrap.open').forEach((w) => {
        w.classList.remove('open'); w.querySelector('button').setAttribute('aria-expanded','false');
      });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape')
      document.querySelectorAll('.wrap.open').forEach((w) => {
        w.classList.remove('open'); w.querySelector('button').setAttribute('aria-expanded','false');
      });
  });

  // одиночный выбор: значение едет на триггер
  document.querySelectorAll('[data-single]').forEach((menu) => {
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.mi'); if (!item) return;
      menu.querySelectorAll('.mi').forEach((i) => i.setAttribute('aria-checked', String(i === item)));
      const label = menu.closest('[data-menu]').querySelector('[data-label]');
      label.textContent = item.querySelector('.n').textContent;
    });
  });

  // мультивыбор предикатов: серии, меню не закрывается (= closeOnSelect={false})
  const fWrap = document.querySelector('[data-filters]');
  const multi = fWrap.querySelector('[data-multi]');
  const counter = fWrap.querySelector('[data-count]');
  const resetBtn = multi.querySelector('[data-reset]');

  function sync() {
    const on = [...multi.querySelectorAll('.mi')].filter((i) => i.getAttribute('aria-checked') === 'true');
    counter.hidden = !on.length;
    counter.textContent = on.length;
    resetBtn.disabled = !on.length;
  }
  multi.addEventListener('click', (e) => {
    const item = e.target.closest('.mi'); if (!item) return;
    item.setAttribute('aria-checked', String(item.getAttribute('aria-checked') !== 'true'));
    sync();
  });
  resetBtn.addEventListener('click', () => {
    multi.querySelectorAll('.mi').forEach((i) => i.setAttribute('aria-checked','false'));
    sync();
  });
  multi.querySelector('[data-done]').addEventListener('click', () => fWrap.classList.remove('open'));
</script>

</body>
</html>
```

---

## Часть III. Попап минимума

### 1. Почему `<dialog>` и почему светлый

- **Top layer обязателен.** Таблица живёт в `.table-wrap` c `overflow-x:auto`;
  абсолютно позиционированный div будет обрезан контейнером при любой
  величине `z-index` — обрезка к z-index отношения не имеет. Выпадашки и
  окна в проекте строятся на нативном `<dialog>` (см. `<Popover>`), который
  рендерится в top layer, — попап ячейки не исключение. Заодно бесплатно
  достаются Escape, клик мимо и возврат фокуса.
- **Светлая тема.** Попап — продолжение таблицы, а не инородный «технический»
  объект. Белая поверхность, хэйрлайн-граница из `--cu-elevation-border-4`,
  радиус 8px, те же тоновые переменные, что красят ячейку. Тёмная плашка из
  первой версии убита: она притягивала взгляд сильнее данных, ради которых
  открылась.
- **Тон следует за смыслом.** У минимума — success; у аномалии тот же каркас
  перекрашивается в warning и первым блоком показывает **причину** — потому
  контракт данных требует её поля (§4.3).

### 2. Контент-контракт

Попап получает payload готовым, ничего не считает:

```
CellPopup = { tone: 'success'|'warning',
              title, cause?,            // причина — обязательна при warning
              value, unit?,             // цена и цена за единицу
              saving?,                  // выгода руб. + %
              deltaPct, medianLabel }   // отклонение от медианы строки
```

Отклонение от медианы считается от **эталонной базы строки** (поле, которого
нет в макете и которое вводит §5), а не от «первой попавшейся» величины.

### 3. HTML-демо попапа (переработанный)

```html
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Попап ячейки — минимум (стилистика проекта)</title>
<style>
  :root{
    --font:-apple-system, BlinkMacSystemFont, "Segoe UI", roboto, "Helvetica Neue", helvetica, arial, sans-serif;
    --content-primary:#202020; --content-secondary:#646464; --content-tertiary:#838383;
    --bg-main:#fff; --border:#e8e8e8; --fill:rgba(0,0,0,.06);
    --tone-success:rgb(0,138,86);  --tone-success-ink:rgb(0,116,72);  --tone-success-fill:rgba(0,138,86,.1);
    --tone-warning:rgb(214,119,10);--tone-warning-ink:rgb(176,96,6);  --tone-warning-fill:rgba(214,119,10,.1);
    --r3:6px; --r4:8px; --round:666px;
    --elev-border-4:0 0 1px 0 rgba(0,0,0,.2667), 0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1);
    --anim:.2s cubic-bezier(.42,0,.58,1);
  }
  *{ box-sizing:border-box }
  body{ margin:0; min-height:100vh; display:grid; place-items:center;
        font-family:var(--font); font-size:13px; line-height:13px;
        color:var(--content-primary); background:#fff; }

  table{ width:520px; border-collapse:collapse; }
  td{ height:84px; padding:14px 16px; border-bottom:1px solid var(--border); }
  td:first-child{ width:50%; color:var(--content-secondary); }
  td.num{ text-align:right; }

  .price{ position:relative; white-space:nowrap; font-weight:500; font-variant-numeric:tabular-nums; }
  .price--min{
    background:linear-gradient(180deg, transparent 55%, var(--tone-success-fill) 55%);
    border-radius:2px;
  }
  .min-flag{ position:absolute; top:-7px; right:-28px; padding:0 4px; border-radius:var(--round);
             background:var(--tone-success-fill); color:var(--tone-success-ink);
             font-size:9px; line-height:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
  .unit{ margin-top:3px; font-size:11px; color:var(--content-tertiary); }

  /* ячейка с попапом: курсор-подсказка + тихий hover из каталога состояний */
  .has-popup{ cursor:default; transition:background-color var(--anim); }
  .has-popup:hover{ background-color:rgba(0,0,0,.05); }

  /* ================= ПОПАП: нативный <dialog>, светлая тема ================= */
  dialog.cell-popup{
    position:fixed; margin:0; width:320px; padding:14px 16px 12px;
    border:0; border-radius:var(--r4);
    background:var(--bg-main); color:var(--content-primary);
    box-shadow:var(--elev-border-4);
    opacity:0; transform:translateY(4px);
    transition:opacity .13s ease, transform .13s ease;
    pointer-events:auto;
  }
  dialog.cell-popup.is-visible{ opacity:1; transform:translateY(0); }
  /* хвостик — повёрнутый квадрат с теми же хэйрлайн-границами */
  dialog.cell-popup::before{
    content:""; position:absolute; top:-6px; left:36px; width:11px; height:11px;
    background:var(--bg-main);
    border-left:1px solid rgba(0,0,0,.2667); border-top:1px solid rgba(0,0,0,.2667);
    transform:rotate(45deg);
  }
  dialog.cell-popup.is-above::before{ top:auto; bottom:-6px; transform:rotate(225deg); }
  dialog.cell-popup::backdrop{ background:transparent; }  /* подсказка, а не окно */

  .tech{ position:absolute; top:10px; right:12px;
         font-family:ui-monospace, monospace; font-size:9px; letter-spacing:.08em;
         text-transform:uppercase; color:var(--content-tertiary); }

  .head{ display:flex; align-items:center; gap:10px; margin-bottom:10px; }
  .glyph{ width:24px; height:24px; display:grid; place-items:center; border-radius:50%;
          font-size:12px; font-weight:700;
          background:var(--pop-fill); color:var(--pop-ink); }
  .title{ font-size:13px; line-height:18px; font-weight:600; }

  .desc{ font-size:12px; line-height:18px; color:var(--content-secondary); }
  .desc strong{ color:var(--content-primary); font-weight:600; font-variant-numeric:tabular-nums; }

  .divider{ height:1px; margin:12px 0; background:var(--border); }

  .mlabel{ margin-bottom:6px; font-size:11px; color:var(--content-tertiary); }
  .mrow{ display:flex; align-items:center; gap:10px; }
  .track{ flex:1; height:5px; border-radius:var(--round); background:var(--fill); overflow:hidden; }
  .fillbar{ height:100%; border-radius:inherit; background:var(--pop-tone); }
  .mval{ font-size:12px; font-weight:600; font-variant-numeric:tabular-nums; color:var(--pop-ink); white-space:nowrap; }

  .meta{ display:flex; justify-content:space-between; margin-top:10px;
         font-size:11px; color:var(--content-tertiary); }
  .meta b{ font-weight:500; color:var(--content-secondary); font-variant-numeric:tabular-nums; }

  /* вариант тона: успех (минимум) / внимание (аномалия) */
  .cell-popup[data-tone="success"]{ --pop-tone:var(--tone-success); --pop-ink:var(--tone-success-ink); --pop-fill:var(--tone-success-fill); }
  .cell-popup[data-tone="warning"]{ --pop-tone:var(--tone-warning); --pop-ink:var(--tone-warning-ink); --pop-fill:var(--tone-warning-fill); }
</style>
</head>
<body>

<table>
  <tbody>
    <tr>
      <td>Бетон B25 W8 F150 · 420 м³</td>
      <td class="num has-popup" tabindex="0"
          data-tone="success"
          data-title="Минимальное значение"
          data-desc="Лучшая цена среди НЕаномальных предложений."
          data-saving="<strong>Выгода: 179 340 ₽ (8,2 %)</strong>"
          data-value="1 997 100 ₽"
          data-delta="-8,2 %">
        <span class="price price--min">1 997 100 ₽<span class="min-flag" aria-hidden="true">мин</span></span>
        <div class="unit">4 755 ₽/м³</div>
      </td>
    </tr>
    <tr>
      <td>Арматура A500 · 1200 т</td>
      <td class="num has-popup" tabindex="0"
          data-tone="warning"
          data-title="Аномальная цена"
          data-desc="Отклонение −6,4 % от эталона — за пределом допуска. Требуется обоснование подрядчика."
          data-saving=""
          data-value="4 120 000 ₽"
          data-delta="-6,4 %">
        4 120 000 ₽
      </td>
    </tr>
  </tbody>
</table>

<dialog class="cell-popup" id="popup" data-tone="success" role="tooltip" tabindex="-1">
  <span class="tech">авто · расчёт</span>
  <div class="head">
    <span class="glyph">✓</span>
    <span class="title" id="pTitle">Минимальное значение</span>
  </div>
  <div class="desc" id="pDesc"></div>
  <div class="desc" id="pSaving" hidden></div>
  <div class="divider"></div>
  <div class="mlabel" id="pMlabel">Отклонение от медианы строки</div>
  <div class="mrow">
    <span class="track"><span class="fillbar" id="pFill" style="width:35%"></span></span>
    <span class="mval" id="pDelta">−8,2 %</span>
  </div>
  <div class="meta"><span>Значение</span><b id="pValue">1 997 100 ₽</b></div>
</dialog>

<script>
  const popup = document.getElementById('popup');
  let active = null, hideTimer = null, showTimer = null;

  function render(cell) {
    popup.dataset.tone = cell.dataset.tone || 'success';
    popup.querySelector('.glyph').textContent = cell.dataset.tone === 'warning' ? '!' : '✓';
    document.getElementById('pTitle').textContent  = cell.dataset.title || '';
    document.getElementById('pDesc').innerHTML     = cell.dataset.desc || '';
    const saving = document.getElementById('pSaving');
    saving.hidden = !cell.dataset.saving;
    saving.innerHTML = cell.dataset.saving || '';
    document.getElementById('pValue').textContent  = cell.dataset.value || '—';
    document.getElementById('pDelta').textContent  = cell.dataset.delta || '—';
    const pct = Math.abs(parseFloat(String(cell.dataset.delta).replace(',', '.')) || 0);
    document.getElementById('pFill').style.width = Math.min(pct * 4, 100) + '%'; /* 25 % → вся шкала */
  }

  function show(cell) {
    if (active && active !== cell) { /* мгновенный переезд между соседними ячейками */
      render(cell); position(cell); return;
    }
    render(cell);
    popup.showModal();
    requestAnimationFrame(() => position(cell)); /* замер — после showModal(): layout есть только теперь */
    popup.classList.add('is-visible');
    active = cell;
  }

  function position(cell) {
    const r = cell.getBoundingClientRect();
    const w = popup.offsetWidth, h = popup.offsetHeight;
    let left = r.left + r.width - w + 8;              /* привязка правым краем, как у Popover */
    let top = r.bottom + 8;
    popup.classList.remove('is-above');
    if (top + h > innerHeight - 12) { top = r.top - h - 8; popup.classList.add('is-above'); }
    left = Math.max(12, Math.min(left, innerWidth - w - 12));
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  function hide() {
    if (!active) return;
    active = null;
    popup.classList.remove('is-visible');
    setTimeout(() => { if (!active) popup.close(); }, 130); /* уйти после анимации */
  }

  document.querySelectorAll('.has-popup').forEach((cell) => {
    cell.addEventListener('mouseenter', () => { clearTimeout(hideTimer); showTimer = setTimeout(() => show(cell), 120); });
    cell.addEventListener('mouseleave', () => {
      clearTimeout(showTimer);
      hideTimer = setTimeout(() => {
        /* мост курсора: уход с ячейки прямо НА попап не закрывает его */
        if (!popup.matches(':hover')) hide();
      }, 80);
    });
    cell.addEventListener('focus', () => show(cell));   /* клавиатура получает то же объяснение */
    cell.addEventListener('blur', hide);
  });

  popup.addEventListener('mouseleave', () => { clearTimeout(hideTimer); hideTimer = setTimeout(hide, 80); });
  addEventListener('scroll', hide, true);               /* скролл таблицы — попап не «плывёт» за ячейкой */
  addEventListener('resize', () => active && position(active));
</script>

</body>
</html>
```

Отличия от первой версии попапа, по пунктам:

1. `<dialog>` + `showModal()` вместо absolute-div: top layer, Escape, клик
   мимо, возврат фокуса — от платформы; сквозь `overflow-x:auto` таблицы
   попап больше не режется.
2. Светлая тема на токенах: белый фон, хэйрлайн `--elev-border-4`, тон
   приходит атрибутом `data-tone` и красит глиф, значение шкалы и подпись —
   один каркас обслуживает и «минимум», и «аномалию» (с причиной).
3. Хвостик переворачивается вместе с панелью (класс `is-above`), а не остаётся
   торчать снизу, когда панель уехала вверх.
4. Привязка правым краем ячейки, а не левым: цены прижаты вправо, панель
   растёт влево и не вылетает за последнюю колонку.
5. Задержки 120/80 мс и «мост курсора»: панель успевает открыться при
   проходе по столбцу и не мигает на пути ячейка → панель.
6. Техническая плашка «AUTO / PRICE» ужата до тихой моно-подписи третичным
   серым: признать авторство расчёта нужно, кричать о нём — нет.

---

## Переезд в код проекта (коротко)

- **Тон** — тип `Tone` из `shared/ui/Badge`; доменная таблица пометок строится
  по образцу `STATUS` в `entities/tender`: одно состояние — один тон и один
  глиф, таблица и попап только читают.
- **Микроценник, штриховка, пунктир, шкала разброса** — CSS-модуль рядом с
  компонентом ячейки; классы называть как в эталоне (`cell--min`,
  `is-removed`), модификаторы цвета — через `--tone-*` переменные, как в
  `Badge.module.css`.
- **Попап** — новый примитив поверх нативного `<dialog>` (сестра `<Popover>`,
  но с триггером hover/focus и задержками); не заводить второй механизм окон.
- **Полоса фильтров** — `<Dropdown>` для одиночных выборов, чек-лист
  предикатов — `MenuPanel` + `MenuCheckItem` c `closeOnSelect={false}`;
  фасетный `<FacetFilter>` оставить для полей со многими значениями.
- **Сегмент пресетов** — в проекте примитива нет; создавать через скилл
  `fsd-component` (и записать в `COMPONENTS.md`), а не собирать из кнопок по месту.

---

## Часть IV. Семантика и формулы (аудит — сохранено)

Ниже — исходный разбор §4 из аудита, без изменений по смыслу; это ТЗ, из
которого выведена Часть I.

### Фильтры: Ключевые / Высокий разброс / Аномалии / Есть потенциал / Выше медианы

#### Смысл
Чипы-переключатели, **комбинируются по И** (`every` / выход по первому промаху),
порядок не важен, пустой набор = показать всё. Сбрасываются одной кнопкой.
Это НЕ «ИИ-разметка» — это предикаты по уже размеченным данным (сама разметка
разобрана в §4.6).

#### Формулы и мощность на датасете

| фильтр | предикат | строк из 20 |
|---|---|---|
| Ключевые | `item.isKey` | 4 → #1, 7, 13, 20 |
| Высокий разброс | `item.spreadTag === 'high'` | 5 → #1, 10, 13, 18, 20 |
| Аномалии | `∃ подрядчик: cell.anomaly` | 3 → #2, 10, 11 |
| Есть потенциал | `∃ подрядчик: cell.potential > 0` | **19** |
| Выше медианы | `cells[favorites[0]].deviation > 0` | 5 или 9 — зависит от того, кого раньше отметили ★ |

**Все четыре первых фильтра читают внешние флаги, ничего не вычисляя.**

#### 4.1 Ключевые (`isKey`)
Вход, булев, на позиции. Смысл — «строка определяет исход тендера»: четыре
отмеченные позиции (бетон, фундамент, каркасы, генподряд) действительно самые
крупные по весу. Но связи с весом в коде нет — это ручная пометка закупщика или
внешнего правила. Кандидат на автоматику: «топ-N по весу» либо «строки,
покрывающие 80 % суммы» (в панели анализа уже написано «фундамент и бетон —
62 % суммы» — но и это статичный текст).

#### 4.2 Высокий разброс (`spreadTag`)
**Самое проблемное место аудита.** В строке одновременно живут два числа:

```js
// вычисляется на лету и показывается в колонке «Разброс»:
spreadPct = (max(цены) − min(цены)) / min(цены) * 100
// а фильтрует и красит подпись — внешняя метка:
spreadTag ∈ 'high' | 'noticeable' | 'none'
```

Порога, связывающего одно с другим, нет, и **диапазоны полностью перекрываются**:

| tag | сколько строк | вычисленный разброс |
|---|---|---|
| none | 12 | 1,9 % … **9,0 %** |
| noticeable | 3 | 5,3 % … 18,2 % |
| high | 5 | **5,8 %** … 20,0 % |

Наглядные противоречия прямо на экране: #16 «Контроль качества» — **9,0 %,
подписано «none»**; #1 «Бетон» — **5,8 %, подписано «высокий»**; #11
«Анкеровка» — 18,2 %, всего лишь «заметный», при том что #20 «Генподряд» с
7,8 % — «высокий». Пользователь видит процент и метку, которые спорят друг
с другом.

Кроме того, разброс считается по **всем** ценам, включая аномальные, — тогда как
бейдж `min` аномальные цены исключает (см. §4.6). Две соседние величины в одной
строке живут по разным правилам.

**Для пайплайна:** `spread()` уже есть в `comparison.ts` (от минимума, `null`
при <2 цен — правильно). Нужен только явный порог поверх него, например
`high ≥ 15 %`, `noticeable ≥ 7 %`, и метка должна выводиться из процента, а не
приходить рядом с ним. Шкала микробара (§2.6) красится этими же порогами.

#### 4.3 Аномалии (`cell.anomaly`)
Вход, булев, **на ячейке**; фильтр поднимает его до строки через `∃`.

Порога вывести нельзя, и это проверено: помечены отклонения −6,4 / +9,8 / +12,8,
а рядом **не** помечены +12,0 (#18) и −8,5 (#10) в тех же строках. Ни один
порог по `|deviation|` не воспроизводит разметку. Все три аномалии в датасете —
у одного подрядчика (СтройМонтаж), что согласуется с текстом инсайтов
(«три аномалии и покрытие 88 % — требуется обоснование»).

Единственный формализованный намёк на правило во всём коде — красная цифра при
`deviation > 5` в `dc`, порог несимметричный.

**Для пайплайна:** аномалия — вердикт внешнего анализа (отклонение от эталона
за пределами допуска, выброс относительно других КП, несоответствие
спецификации). Она должна приходить **с причиной**, иначе строку невозможно
объяснить подрядчику — и потому попап аномалии (Часть III) обязан показать
причину первым блоком. См. легенду §4.6.

#### 4.4 Есть потенциал (`potential > 0`)
Формально исправен, практически бесполезен: проходит 19 из 20 строк, единственная
отсечённая — снятая позиция #4, у которой вообще нет метрик. Тем не менее это
единственный фильтр пресета «Торги».

**Для пайплайна:** порог по величине (`potential ≥ X ₽` или `≥ X %` от строки),
иначе фильтр не несёт информации. Пока порога нет, пункт «Есть потенциал»
в поповере фильтров показывает счётчик «19 из 20» — честный сигнал no-op.

#### 4.5 Выше медианы (`above_median`) — сломан, есть только в `full`
```js
const fav = [...state.favorites][0];
if (!fav || !item.cells[fav] || (item.cells[fav].deviation ?? 0) <= 0) return false;
```
Три дефекта разом:
1. **Медианы в предикате нет.** Проверяется `deviation > 0`, то есть «дороже
   эталонной базы строки» (§2.2), а база — не медиана.
2. **Зависит от порядка отметок ★**: `favorites` — `Set`, `[...set][0]` — первый
   *добавленный*. Снять и заново поставить звёздочку → фильтр даёт другой ответ
   (5 строк против 9 на этих данных), при внешне одинаковом состоянии экрана.
3. **Молчит без избранного**: при пустом `favorites` возвращает `false` для всех
   строк — таблица пустеет без объяснения.

В `dc` фильтр отсутствует. **Переносить в текущем виде нельзя.** Если нужен
смысл «дороже типичного», это `price > медиана цен строки` — считается из цен и
ни от чьих звёздочек не зависит. В поповере фильтров (Часть II) пункт называется
«Дороже медианы» — имя описывает фактическую математику, а не обещание макета.

#### 4.6 Легенда пометок — что вообще может быть навешено на ячейку и строку

Это ответ на «ИИ помечает ячейки»: пометки приходят **готовыми в данных**,
макет их только рисует. Ни одна не вычисляется (кроме `min`, и то частично).

**Пометки ячейки (подрядчик × позиция):**

| пометка | поле | условие показа | смысл | вычисляется? |
|---|---|---|---|---|
| бейдж `min` + зелёная заливка | `cell.isMin` | **только** при `mainMetric === 'price'` | лучшая цена по строке | вход, но см. ниже |
| фиолетовая полоса слева (`inset 3px`) | `cell.anomaly` | всегда | цена требует обоснования | вход |
| «нет цены» | `cell.missing` или `cell == null` | всегда | позиция подрядчиком не закрыта — **не ноль** | вход |
| «Отказ» | `item.declined[supplierId]` | всегда | подрядчик отказался от объёма | вход |
| «—» | `item.removed` | всегда | строка снята из сметы | вход |
| красная цифра | `deviation > 5` | только `dc`, только `mainMetric='deviation'` | превышение допуска | **единственная вычисляемая пометка** |
| оранжевая рамка / фон | `focusRow` / `focusCol` | по клику | навигация | состояние UI, не семантика |

Визуальные решения этой таблицы заменены словарём Части I; поля и условия
показа — контракт, он неизменен. Гашение разметки минимумов вне режима «Цена»
сохранено (см. §2.7 про потенциал — тот же принцип «режим уже говорит об этом»).

**Важно про `min`:** флаг `isMin` расходится с фактическим минимумом ровно в
одной строке — #2 «Арматура», где самая дешёвая цена (4 120 000 у СтройМонтажа)
помечена `anomaly`, и бейдж `min` отдан второй по дешевизне. Правило читается
однозначно и его стоит перенести явно:

> **`min` присуждается лучшей НЕаномальной цене.** Аномально дешёвое
> предложение выбывает из соревнования за минимум, но остаётся в расчёте
> разброса.

Галерея Части I показывает эту строку буквально: заштрихованная цена СтройМонтажа
и микроценник «мин» на МонолитГрупп.

**Пометки строки (позиция целиком):**

| бейдж | поле | смысл |
|---|---|---|
| `ключ` | `item.isKey` | ключевая позиция тендера |
| `аном.` | `∃ cell.anomaly` | подъём ячейковой аномалии на строку |
| `снята` + зачёркнутое название | `item.removed` | позиция исключена из сметы после публикации |
| `корр.` + `1200 → 1260` | `item.corrected`, `item.qtyOrig` | объём скорректирован; показываются оба значения |
| `высокий` / `заметный` у процента | `item.spreadTag` | **метка, не порог** (§4.2) |

Строчные бейджи-ярлыки («ключ», «аном.») заменены устройствами §2.4–2.5
(звезда, штриховка, капсулы): ярлык-слово требовал чтения, устройство
читается формой. Подъём ячейковой аномалии на строку — по-прежнему счётчиком
фильтра, а не новым бейджем: у строки нет своей аномалии, есть чужие.

**Счётчики над таблицей** — единственная сводка, и она считается на лету:
```js
показано   = list.length + ' / ' + ITEMS.length
отказов    = count(item.declined)
без цены   = count(∃ cell.missing)
аномалий   = count(∃ cell.anomaly)      // 3
```
Считаются по **всему** датасету, а не по отфильтрованному, — то есть «3 аномалии»
не меняется, даже когда на экране одна строка. Галерея повторяет эту сводку
как есть.

#### 4.7 Слой инсайтов (панель анализа)
Полностью статичный текст, сгруппированный по пяти сценариям
(`Что важно` / `Точки торгов` / `Сравнить подрядчиков` / `Риски и аномалии` /
`Выбранное ★`), у каждого инсайта — тон `risk | trade | info`, подпись
«правило · <сценарий>» и **привязка к строке** (`row: 7` в `dc`, захардкоженная
карта `{0:7, 1:18, 2:1}` в `full`). Клик подсвечивает строку.

Ценное для переноса — **форма контракта**, а не тексты:

```
Insight = { scenario, tone: 'risk'|'trade'|'info', title, text, anchorRowId, rule }
```

Соответствие тонам проекта: `risk → danger`, `trade → success`, `info → info`.
`rule` в макете всегда строка «правило · <сценарий>» — заглушка под ссылку на
правило, породившее вывод. Тон карточки совпадает с тремя смыслами всей
разметки: **риск** (аномалия, нет цены, отказ), **торг** (потенциал), **факт**
(вес, сумма).

---

## Часть V. Ресёрч: что взято извне и почему

Решения по управлению экраном (полоса, пресеты, показатель, вид строк, итоги,
тайминги попапа) зафиксированы в Приложении Д `filter_audit.md`; живое превью —
`badges.html`. Здесь — источники ресёрча и что именно из них взято.

**Тайминги и поведение попапа**

- **NN/g «Tooltip Guidelines»** (nngroup.com/articles/tooltip-guidelines):
  тултип — user-triggered объяснение парного элемента, не носитель основной
  информации; «важное должно жить на странице». Отсюда правило Части I п.4:
  попап объясняет пометку, а не заменяет её.
- **WCAG 2.1 SC 1.4.13 «Content on Hover or Focus»** (w3.org/WAI):
  *dismissible* (Escape без движения мыши — у нас нативный `<dialog>`),
  *hoverable* (мост курсора на панель — уход с ячейки НА попап не закрывает),
  *persistent* (живёт до ухода курсора/фокуса, никаких автоскрытий по таймеру).
  Три условия — чек-лист любого нового всплывающего в проекте.
- Коридор показа **300–500 мс после остановки курсора** и fade 150–200 мс —
  uxpatterns.dev/patterns/tooltip (совпадает с классическим NN/g timing
  guidelines 0,3–0,5 с / 0,1 с обратная связь); взято 350 мс показ, 500 мс
  грейс на скрытие, мгновенный переезд между соседними ячейками.

**Микрографики в таблицах**

- **Microsoft Report Builder «Sparklines and data bars»**: сила дата-баров —
  «viewing many of them together… easy to see the outliers», и шкала обязана
  быть ОБЩЕЙ для всех строк, иначе строки несравнимы. Отсюда: микрошкала
  разброса и бар «доля веса» живут на одной фиксированной шкале (разброс:
  25 % = вся шкала; доля веса: ширина = процент от Σweight), а не «каждый под
  себя».
- **Sparkline-паттерн (Tufte; shadcn-sparkline и BI-гайды повторяют)**:
  axis-free миниатюра рядом с числом, не вместо числа. Наши шкалы стоят ПОД
  процентами и никогда не рисуются одни.

**Сравнительные таблицы и «победитель»**

- **NN/g «Comparison Tables»**: таблицы сравнения обслуживают компенсаторные
  решения; сканируемость важнее полноты; цвет фона колонки/ячейки допустим как
  второй канал. Поддерживает выбор: один зелёный маркер минимума на строку,
  без заливки всей колонки-победителя.
- **Anchoring-бейджи рекомендованного варианта** (research pricing/comparison
  страниц: 73–86 % лучших страниц используют один якорный бейдж) — аргумент
  ЗА ровно один «мин»-маркер на строку: второй якорь обесценивает первый.

**Сегмент пресетов**

- Пресеты — взаимоисключающие РЕЖИМЫ представления одного среза (§1), частые,
  их ровно три — канонический кейс сегмент-контрола (переключение вида, а не
  действие). Всё остальное в полосе — меню: значений больше трёх и состав
  будет расти.

---

## Часть VI. Интерфейсный аудит превью

Живое превью (`badges.html`) прошло кросс-доменный обзор (accessibility,
layout, writing, typography, colors, UI-polish). Восемь находок внесены прямо
в файл и помечены тегами `[R1]…[R8]` — карта правок стоит в начале его
`<style>`; здесь — то, что из них становится правилом проекта, а не разовой
починкой.

| | находка | правило после правки |
|---|---|---|
| **R1** HIGH | Смыслоносный текст стоял в tertiary `#838383`: измеренные 3,60–3,79:1 при требуемых 4,5 (WCAG 2.2 SC 1.4.3) — подсказка о фильтрах, счётчики, заголовки разделов/панелей, «нет цены», тире, подстрочники, подписи триггеров, счётчики пунктов меню | **Роль tertiary — только декор**: caption-дубль состояния, «покрытие» в шапке колонок, подпись правила у инсайта. Всё, что читается как данные или инструкция, — secondary `#646464` (5,1:1). Каунтер фильтров — белый на `info-ink` (6,9:1), не на `info` (пограничные 4,4:1) |
| **R2** MED | Роли `radio`/`menuitem*` объявлены, а клавиатура была только Tab-сквозной — SR обещает паттерн, которого нет | Кастомная роль обязана отрабатывать паттерн ARIA APG: roving tabindex, стрелки/Home/End, ArrowDown открывает меню с фокусом в списке, Escape и одиночный выбор возвращают фокус на триггер |
| **R3** MED | Все кастомные фокусные индикаторы были 1px — тонут в хэйрлайнах таблицы | Периметр ≥ 2px: `--ring` и outline всех брелоков |
| **R4** MED | Фильтр «Дороже медианы» пускал всякую строку с ≥2 разными ценами (`> median`), а бейдж ячейки ставится только при >5 % — один смысл с двумя порогами | **Один смысл — один порог** (расширение правила «одно устройство — один смысл» на числа): предикат считает как глиф ячейки; счётчик пункта подтверждает честно: 3/5 = ровно строки с помеченными ячейками |
| **R5** MED | Клик по инсайту со скрытым якорем ронял нативный `alert()` посреди рисованного интерфейса | Ошибка предупреждена, а не отрепорчена: видимость якоря вычисляется на рендере → карточка гасится `disabled` + подсказка в title до клика |
| **R6** LOW | Бирка «МИН» свешивается на 41px за предел цены при 16px слабины паддингов — до ~25px вторжения в соседнюю колонку (z-index красит поверх её текста) | Геометрия нависающих брелоков считается, не рисуется на глаз; резерв делается паддингом всей колонки (`pr-6`), который не сдвигает правое выравнивание строк |
| **R7** LOW | Максимальный разброс демо-данных был 9,4 % < порога 15 %: danger-ярус (красная линейка + фильтр «Высокий разброс») существовал только в легенде | Датасет превью обязан показывать каждый ярус устройств живьём: разброс «Арматуры» поднят до 15,5 % (СпецЖБИ 4 760 000 ₽) |
| **R8** LOW | Мёртвые правила: `.pot` (капсула потенциала, заменённая монетой), `.icn-fill`, `--tone-danger-fill` | Норма проекта — ноль необъявленных потребителей; удалены при первом же осмотре |

Вердикт обзора: Block по R1 → после контрастной правки Approve. Не проверялось
вживую (остаётся Not verified): тайминги ховера попапа 350/500 мс на реальном
курсоре, SR-объявления, прогон `prefers-reduced-motion`; код соответствует
таймингам Д.5 и единой зоне reduced-motion в CSS.

Мелкий рефакторинг того же прохода: два блока `@media (prefers-reduced-motion)`
слиты в один, продублированный комментарий строк-служебок убран, правка
«доля веса» задокументирована вместо удалённой капсулы.

