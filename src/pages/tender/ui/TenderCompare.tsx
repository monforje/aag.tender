import { useState, type CSSProperties, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Badge, type Tone } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { ColorPicker } from '@/shared/ui/ColorPicker';
import { Modal, modalPart } from '@/shared/ui/Modal';
import { ScreenPlaceholder } from '@/shared/ui/Page';
import { Popover } from '@/shared/ui/Popover';
import { Table, tableCell } from '@/shared/ui/Table';
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden';
import { plural } from '@/shared/lib/plural';
import {
  bidStatus, flatten,
  decimal, groupSum, money, rankBids, spread,
  type Bid, type Comparison, type PositionGroup,
} from '@/entities/tender';
import s from './TenderCompare.module.css';

/** Тон → имя токена. Таблицей, а не `--cu-tone-${tone}`: собранное из строки
 *  имя не проверяется ничем, и опечатка дала бы колонку без цвета без единой
 *  ошибки в консоли. */
const TONE_TOKEN: Record<Tone, string> = {
  info: '--cu-tone-info',
  success: '--cu-tone-success',
  warning: '--cu-tone-warning',
  danger: '--cu-tone-danger',
  neutral: '--cu-tone-neutral',
};

/** Тон как цвет для CSS — ссылкой на токен: перекрасят тему, перекрасятся и
 *  колонки. */
const toneColor = (tone: Tone) => `var(${TONE_TOKEN[tone]})`;

/** Он же ВЫЧИСЛЕННЫМ значением. Пикеру нужен цвет, а не ссылка: `var(...)`
 *  для него — просто нераспознанная строка, и окно открылось бы на чёрном. */
const resolveTone = (tone: Tone) =>
  getComputedStyle(document.documentElement).getPropertyValue(TONE_TOKEN[tone]).trim();

/**
 * Сравнение коммерческих предложений: позиции сметы строками, подрядчики —
 * колонками, каждая со своей карточкой в шапке.
 *
 * КОГДА:  раздел «Сравнение» карточки тендера.
 * НЕ ДЛЯ: реестра тендеров (см. TenderRegistryPage) и списка самих КП
 *         (раздел «КП» — это документы, а не сопоставление цифр).
 *
 * ДАННЫЕ: приходят ПРОПАМИ — смета разделами и КП подрядчиков, тот же объект,
 *         что вернёт API (тип Comparison). Своих констант компонент не знает:
 *         ни числа колонок, ни числа разделов, ни имён — всё считается от
 *         пришедшего. Разделов может не быть, подрядчиков может не быть, их
 *         может быть восемь; единственное, что фиксировано, — четыре левые
 *         колонки (позиция, объём, единица, разброс): это не данные, а способ
 *         читать смету, и настраивать в них нечего.
 *         РАСКЛАДКА ТОЖЕ НЕ ЗНАЕТ ДАННЫХ. Колонки подрядчиков одинаковы по
 *         ширине и держатся в вилке 176…280px независимо от того, сколько
 *         подано КП и насколько длинны имена; смотри контракт .cols в
 *         .module.css. Раньше ширину определяло содержимое, и колонки
 *         расходились (245 / 290 / 296 на ленте 1457px) — сравнивать по ним
 *         было нельзя: глаз читает разную ширину как разный вес.
 *
 * UX:     ШАПКА КОЛОНКИ — КАРТОЧКА, а не подпись: подрядчика выбирают не по
 *         имени, а по четырём числам сразу (полнота КП, процент, сумма,
 *         состояние), и держать их в отдельной строке над таблицей значило бы
 *         заставить глаз ходить туда-обратно на каждой позиции. Ячейка
 *         отдана карточке целиком — <Table> публикует для этого модификатор
 *         tableCell.card, снимающий паддинг и высоту шапки.
 *         ПОЛНОТА КП И СУММА — ОДНОЙ СТРОКОЙ, оба ЧИСЛАМИ. Шкала здесь
 *         была и сегментной, и сплошной — обе врали: на 220px разница между
 *         88% и 92% неразличима, а решают именно эти проценты. Число не
 *         требует расшифровки и сравнивается по трём колонкам напрямую.
 *         КАРТОЧКА ЗАЛИТА ТЕМ ЖЕ ЦВЕТОМ, ЧТО И КОЛОНКА ПОД НЕЙ, — полоса
 *         читается непрерывной от шапки до последней строки. Цветного канта по
 *         краю карточки нет намеренно: тон в ней уже назван кружком места и
 *         заливкой шкалы, и третий раз он был бы украшением.
 *         ЦВЕТ КОЛОНКИ — ПОДСКАЗКА, А НЕ ВЕРДИКТ. Базово его ставит ранжир
 *         (лучшее зелёное, худшее красное, середина янтарная), но ранжир
 *         знает только цифры, поэтому цвет перекрашивается рукой — уже
 *         ЛЮБОЙ, через <ColorPicker> в окне. Пять тонов заменены свободным
 *         кругом сознательно: пометка колонки в разборе — не значение, а
 *         закладка «мой», «спросить», «отпал», и словарь ей задаёт человек.
 *         Смысловые тона при этом никуда не делись: статус КП по-прежнему
 *         <Badge> с `--cu-tone-*`, и его цвет рукой не меняется.
 *         Цвет применяется СРАЗУ, пока окно открыто: колонка под ним видна,
 *         и подбирать «читается / не читается» можно по живой таблице.
 *         Возврат под расчёт — кнопка «По ранжиру» в подвале окна.
 *         Звезда «в избранном» — форма, а не цвет: контур меняется на
 *         заливку, отметка читается и в чёрно-белом.
 *         ДВА ДЕЙСТВИЯ КАРТОЧКИ СТОЯТ НАПРОТИВ СТАТУСА — палитра и стрелка
 *         досье, обе одной иконкой и одного веса. Крутится по наведению
 *         только стрелка: у неё поворот — это «уходим отсюда», а палитра
 *         вместо движения НАЛИВАЕТСЯ цветом своей колонки. Строка статуса всё равно
 *         не заполнена справа, а отдельный подвал ради двух кнопок добавлял
 *         карточке высоты на пустом месте. Проявляются по наведению
 *         (рецепт 5), как звезда. НИ КАРТОЧКА, НИ ЕЁ ИМЯ НЕ КЛИКАЮТСЯ:
 *         досье открывает одна явная цель — стрелка. Имя нажимали, не
 *         собираясь никуда уходить, и попадали в окно.
 * A11Y:   у пикера своя клавиатура (см. его JSDoc), звезда —
 *         кнопка с aria-pressed. Шкала заполнения — role="img" с подписью
 *         словами: сегменты сами по себе скринридеру ничего не говорят.
 *         Место в ранжире продублировано текстом (<VisuallyHidden>), потому
 *         что заливка колонки в 7% для скринридера не существует вовсе.
 *         Досье и палитра — нативный <dialog>.showModal(): фокус, Escape и
 *         подложка достаются от платформы, а не переписываются руками.
 *         Шкала — role="img" с процентом словами: сплошная полоса без
 *         подписи для скринридера не существует вовсе.
 *
 * @example
 * {tab === 'compare' ? <TenderCompare /> : null}
 */
export function TenderCompare({ groups, contractors }: Comparison) {
  /* Плоский список позиций и ранжир ВЫВОДЯТСЯ из пришедшего, а не приходят
     полями: два перечня одних и тех же строк разъехались бы на первой правке.
     Пересчёт — тринадцать позиций на три КП, мемоизировать тут нечего. */
  const positions = flatten(groups);
  const bids = rankBids(contractors, positions);
  /* Свёрнутость ОДНА на все карточки: колонки сравнивают, а не разглядывают
     по одной, и режим «только имена» нужен целиком — иначе шапка превращается
     в лесенку разной высоты. Поэтому стрелка на любой карточке переключает
     все сразу. */
  const [collapsed, setCollapsed] = useState(false);
  /* Разделы сметы сворачиваются ПООДИНОЧКЕ, в отличие от карточек: «материалы
     уже прочитал, работы ещё нет» — обычный ход разбора, а всё сразу можно
     закрыть тремя кликами. Хранятся только СВЁРНУТЫЕ: по умолчанию раскрыто
     всё, и пустой объект — честное «ничего не трогали». */
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  /* Цвет колонки — CSS-строка, а отсутствие ключа значит «по ранжиру».
     Отдельного 'auto' в значении нет: пустота и есть «ничего не трогали». */
  const [tint, setTint] = useState<Record<string, string>>({});
  const [starred, setStarred] = useState<string[]>([]);
  const [dossier, setDossier] = useState<Bid | null>(null);
  /* Палитра — ВТОРАЯ панель, а не переключатель содержимого внутри досье:
     открываются они из разных мест и закрываются независимо, а одна на двоих
     означала бы ещё одно состояние «что сейчас показываем». И типы у них
     разные: окно знает только «открыто», выпадашка — ещё и «откуда упала»,
     поэтому её состояние хранит не флаг, а КП вместе с прямоугольником
     нажатой кнопки. Механика обеих — в <Modal> и <Popover>.  */
  const [paint, setPaint] = useState<{ bid: Bid; at: DOMRect } | null>(null);

  /* Цвет, с которого открывается окно: свой, если колонку уже красили, иначе
     вычисленный тон ранжира — пикеру нужно от чего оттолкнуться. */
  const paintValue = (bid: Bid) => tint[bid.contractor.id] ?? resolveTone(bid.tone);

  /* Пустой ответ — штатное состояние, а не сбой: тендер объявлен, смета
     заливается позже, КП собираются неделями. Таблица о четырёх колонках без
     единой строки читалась бы как поломка. Проверка стоит ПОСЛЕ хуков — до
     них ранний возврат менял бы их число между рендерами. */
  if (!groups.length || !contractors.length) {
    return (
      <ScreenPlaceholder icon="billList">
        {!groups.length
          ? 'В тендере ещё нет сметы — сравнивать нечего.'
          : 'Ни одного КП пока не подано.'}
      </ScreenPlaceholder>
    );
  }

  return (
    <>
      {/* Счётчик склоняется: подпись «3 предложения», написанная под тройку из
          фикстуры, на одном КП читалась бы как опечатка. */}
      <Table layout="fixed" caption={[
        `${positions.length} ${plural(positions.length, 'позиция', 'позиции', 'позиций')}`,
        `в ${groups.length} ${plural(groups.length, 'разделе', 'разделах', 'разделах')}`,
        `· ${bids.length} ${plural(bids.length, 'предложение', 'предложения', 'предложений')}`,
      ].join(' ')}>
        {/* Цвет колонки — на <col>, а не на каждой ячейке. Фон колонки
            рисуется НИЖЕ фона строки, поэтому ховер строки (.05) продолжает
            читаться поверх заливки, а не гасится ею. Сама арифметика цвета —
            в .module.css: отсюда уходит только тон. */}
        {/* ШИРИНА — ТОЖЕ ЗДЕСЬ, и она исполняется: таблица идёт layout="fixed",
            где <col> и есть источник ширины (при авторазметке это было лишь
            пожелание, и колонки расходились по длине имён).
            Из TSX уезжает ОДНО число — сколько подано КП. По нему в CSS
            считается равная доля ширины на всех (см. контракт .cols в модуле);
            арифметика остаётся в стилях, значений по умолчанию у --bids нет:
            число колонок — это данные, и подставлять вместо них тройку из
            фикстуры значило бы врать раскладкой. */}
        <colgroup className={s.cols} style={{ '--bids': bids.length } as CSSProperties}>
          {/* Линейка между колонками — на <col>, одним правилом на всю
              колонку сразу. У последней её нет: там край ленты. */}
          <col className={cx(s.colTitle, s.colRule)} />
          <col className={cx(s.colQty, s.colRule)} />
          <col className={cx(s.colUnit, s.colRule)} />
          <col className={cx(s.colSpread, s.colRule)} />
          {bids.map((bid, i) => (
            <col
              key={bid.contractor.id}
              className={cx(s.colBid, s.colTint, i < bids.length - 1 && s.colRule)}
              style={{ '--col': choose(tint, bid) } as CSSProperties}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Позиция</th>
            <th scope="col" className={tableCell.numeric}>Количество</th>
            <th scope="col">Единица</th>
            <th scope="col" className={tableCell.numeric}>Разброс</th>
            {bids.map((bid) => (
              <th scope="col" key={bid.contractor.id} className={tableCell.card}>
                <ContractorCard
                  bid={bid}
                  total={positions.length}
                  col={choose(tint, bid)}
                  starred={starred.includes(bid.contractor.id)}
                  onStar={() => setStarred((list) => (
                    list.includes(bid.contractor.id)
                      ? list.filter((id) => id !== bid.contractor.id)
                      : [...list, bid.contractor.id]
                  ))}
                  onPaint={(at) => setPaint({ bid, at })}
                  onOpen={() => setDossier(bid)}
                  collapsed={collapsed}
                  onFold={() => setCollapsed((on) => !on)}
                />
              </th>
            ))}
          </tr>
        </thead>
        {/* Один <tbody> на раздел — так группа и есть группа строк, а не
            подкрашенная строка среди прочих: скринридер объявляет её как
            блок, а браузер не разорвёт её при печати. */}
        {groups.map((group) => {
          const open = !folded[group.id];
          return (
            <tbody key={group.id}>
              <tr className={s.groupRow}>
                {/* Шапка раздела — <th scope="colgroup">: это заголовок для
                    строк под ним, а не ячейка со значением. Колонки
                    «Количество» и «Единица» под него не подверстываются, а
                    заполняются своим — размером раздела; значит, спан только
                    на первую колонку. */}
                <th scope="colgroup" className={cx(tableCell.card, s.groupHead)}>
                  {/* Название и стрелка за ним. Счётчик позиций убран: то же
                      число видно по самим строкам, а в шапке он перетягивал
                      внимание с названия, ради которого блок и озаглавлен.
                      Стрелка — тот же .fold, что в шапке карточки подрядчика,
                      КЛАССОМ, а не копией: два раскрытия на одном экране
                      обязаны выглядеть и вести себя одинаково. Здесь она
                      <span>: кнопка — вся полоса, а кнопка в кнопке невалидна. */}
                  <button
                    type="button"
                    className={s.groupToggle}
                    aria-expanded={open}
                    aria-label={`${group.title}: ${open ? 'свернуть' : 'развернуть'} раздел`}
                    onClick={() => setFolded((all) => ({ ...all, [group.id]: open }))}
                  >
                    <span className={s.groupTitle}>{group.title}</span>
                    <span className={cx(s.fold, !open && s.isOn)}>
                      <Icon name="chevronDown" />
                    </span>
                  </button>
                </th>
                {/* Размер раздела стоит в тех же колонках, что и объём
                    позиции, — но НЕ выглядит объёмом: 11px капителью и
                    третичным тоном. Числу здесь нельзя смешаться со сметными:
                    «5» в колонке количества на общем кегле читалось бы как
                    пять кубометров чего-то. */}
                <td className={cx(tableCell.numeric, s.groupMeta)}>{group.positions.length}</td>
                <td className={s.groupMeta}>
                  {plural(group.positions.length, 'позиция', 'позиции', 'позиций')}
                </td>
                <td />
                {bids.map((bid) => <td key={bid.contractor.id} />)}
              </tr>

              {open ? group.positions.map((position) => {
                const gap = spread(position, contractors);
                return (
                  <tr key={position.id}>
                    {/* title — потому что колонка теперь ОБРЕЗАЕТ: ширина
                        задана контрактом, и длинное название уходит в
                        многоточие. Это колонка-якорь, с которой читают строку,
                        и прочитать её целиком должно быть чем. */}
                    <td className={tableCell.strong} title={position.title}>{position.title}</td>
                    <td className={tableCell.numeric}>{decimal(position.qty)}</td>
                    <td className={tableCell.muted}>{position.unit}</td>
                    {/* Разброса нет, когда расценок меньше двух: прочерк, а не
                        «0 %» — сравнивать не с чем, а ноль означал бы согласие. */}
                    <td className={cx(tableCell.numeric, tableCell.muted)}>
                      {gap === null ? '—' : `${decimal(gap)} %`}
                    </td>
                    {bids.map((bid) => {
                      const price = bid.contractor.prices[position.id];
                      return (
                        <td key={bid.contractor.id} className={tableCell.numeric}>
                          {price === undefined ? (
                            <span className={s.blank} title="Позиция в КП не закрыта">—</span>
                          ) : (
                            <>
                              {money(price * position.qty)}
                              <span className={tableCell.sub}>
                                {money(price)}/{position.unit}
                              </span>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              }) : null}

              {/* Итог раздела остаётся и у свёрнутого: ради него и сворачивают
                  — увидеть, где предложения расходятся, не читая строк. */}
              <GroupTotal group={group} bids={bids} />
            </tbody>
          );
        })}
      </Table>

      {/* Досье. Содержимое рисуется, только когда окно открыто: иначе
          <Dossier> держал бы в разметке предыдущего подрядчика, и на закрытии
          было бы видно, как окно гаснет с чужим именем. */}
      <Modal open={dossier !== null} onClose={() => setDossier(null)}>
        {dossier ? (
          <Dossier
            bid={dossier}
            total={positions.length}
            onClose={() => setDossier(null)}
          />
        ) : null}
      </Modal>

      {/* Палитра колонки — выпадашка из кнопки на карточке. */}
      <Popover
        anchor={paint?.at ?? null}
        onClose={() => setPaint(null)}
        label="Цвет колонки"
      >
        {paint ? (
          <Painter
            value={paintValue(paint.bid)}
            onPick={(color) => setTint((all) => ({ ...all, [paint.bid.contractor.id]: color }))}
            onReset={() => setTint(({ [paint.bid.contractor.id]: _, ...rest }) => rest)}
          />
        ) : null}
      </Popover>
    </>
  );
}

/** Строка «Итого · <раздел>». Отдельным компонентом, чтобы разметка группы
 *  читалась одним экраном, а не тонула в третьем уровне вложенности. */
function GroupTotal({ group, bids }: { group: PositionGroup; bids: Bid[] }) {
  return (
    <tr className={s.totalRow}>
      {/* Просто «Итого»: раздел назван строкой выше, и повторять его имя в
          двух строках подряд значит заставить прочитать его дважды. */}
      <td colSpan={4} className={s.totalLabel}>Итого</td>
      {bids.map((bid) => (
        <td key={bid.contractor.id} className={cx(tableCell.numeric, s.totalValue)}>
          {money(groupSum(group, bid.contractor))}
        </td>
      ))}
    </tr>
  );
}

/** Действующий цвет колонки: рука важнее ранжира. */
function choose(tint: Record<string, string>, bid: Bid): string {
  return tint[bid.contractor.id] ?? toneColor(bid.tone);
}

/** Карточка подрядчика — она же шапка колонки. Локальная: за её пределами
 *  такой блок ничего не значит, а вынести в shared можно будет, когда
 *  появится второй экран со сравнением по колонкам. */
function ContractorCard({
  bid, total, col, starred, collapsed, onStar, onPaint, onOpen, onFold,
}: {
  bid: Bid;
  /** Сколько всего позиций в смете — знаменатель подписи «расценки есть у N
   *  из M». Пропом, а не из модуля: длина сметы приходит с данными. */
  total: number;
  /** Готовая CSS-строка цвета: карточка не знает, ранжир его дал или рука. */
  col: string;
  starred: boolean;
  collapsed: boolean;
  onStar: () => void;
  /** Отдаёт прямоугольник нажатой кнопки: от него падает выпадашка. */
  onPaint: (from: DOMRect) => void;
  onOpen: () => void;
  onFold: () => void;
}) {
  const { contractor, filled, percent, sum, rankLabel } = bid;
  const status = bidStatus(contractor.status);

  return (
    // Целиком карточка НЕ кликается: в ней четыре собственных контрола, и
    // «клик мимо них» открывал модалку всякий раз, когда рука промахивалась.
    // Досье открывают две явные цели — имя и стрелка напротив статуса.
    <div className={s.card} style={{ '--col': col } as CSSProperties}>
      <header className={s.cardHead}>
        <button
          type="button"
          className={cx(s.star, starred && s.isOn)}
          aria-pressed={starred}
          aria-label={`${contractor.name}: ${starred ? 'убрать из избранного' : 'в избранное'}`}
          title={starred ? 'В избранном' : 'Добавить в избранное'}
          onClick={onStar}
        >
          <Icon name={starred ? 'starFilled' : 'star'} />
        </button>

        {/* Просто текст. Кнопкой имя было, пока карточка кликалась целиком —
            тогда клавиатуре нужна была цель, которую можно поймать Tab'ом.
            Теперь такая цель есть своя, стрелка досье: она фокусируется и при
            opacity:0, а :focus-within её показывает. Имя же нажимали, не
            собираясь никуда уходить, — и попадали в окно. */}
        <p className={s.cardName}>{contractor.name}</p>

        {/* Место в ранжире осталось ТОЛЬКО текстом для скринридера: цифру в
            углу убрали как лишнюю — порядок колонок и их цвет говорят то же
            самое, — но заливка в 7% для скринридера не существует вовсе, и
            без этой строки ранг пропал бы совсем. */}
        <VisuallyHidden>{rankLabel}</VisuallyHidden>

        <button
          type="button"
          className={cx(s.fold, collapsed && s.isOn)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Развернуть карточки подрядчиков' : 'Свернуть карточки подрядчиков'}
          title={collapsed ? 'Развернуть все' : 'Свернуть все'}
          onClick={onFold}
        >
          <Icon name="chevronDown" />
        </button>
      </header>

      {collapsed ? null : (
      <div className={s.cardBody}>
        {/* Полнота КП и его итог одной строкой — два числа, по которым
            колонки и сравнивают. Полнота ЧИСЛОМ, а не полосой: полоса на
            220px показывала силуэт вместо величины, а 88% и 92% на ней
            неразличимы — при том что решают именно они. */}
        <div className={s.figures}>
          <p
            className={s.fill}
            title={`Расценки есть у ${filled} позиций из ${total}`}
          >
            <span className={s.percent}>{percent}%</span>
            <span className={s.fillLabel}>заполнено</span>
          </p>
          <p className={s.sum}>{money(sum)}</p>
        </div>

        {/* Статус слева, действия справа: строка статуса всё равно кончалась
            пустотой, и отдельный подвал ради двух кнопок только добавлял
            карточке высоты. */}
        <div className={s.meta}>
          <Badge className={s.cardStatus} tone={status.tone} icon={status.icon}>
            {status.label}
          </Badge>

          <button
            type="button"
            className={cx(s.cardAct, s.cardActPaint)}
            aria-label={`Цвет колонки «${contractor.name}»`}
            title="Цвет колонки"
            onClick={(e) => onPaint(e.currentTarget.getBoundingClientRect())}
          >
            <Icon name="palette" />
          </button>

          {/* Диагональ, а не шеврон: уход в отдельное окно, а не раскрытие на
              месте. */}
          <button
            type="button"
            className={cx(s.cardAct, s.cardActSpin)}
            aria-label={`Досье подрядчика «${contractor.name}»`}
            title="Открыть досье"
            onClick={onOpen}
          >
            <Icon name="arrowRightUp" />
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

/** Содержимое выпадашки: пикер и возврат под расчёт. Своего состояния нет —
 *  цвет уезжает наверх на каждое движение, и колонка перекрашивается живьём:
 *  подбирать «читается / не читается» по образцу в панели бесполезно,
 *  проверяется это на самой таблице.
 *
 *  Ни заголовка, ни «Готово»: чью колонку красим, видно по самой колонке —
 *  она под панелью и меняется на глазах, — а закрывают выпадашку кликом мимо
 *  или Escape, как любое меню. */
function Painter({
  value, onPick, onReset,
}: {
  value: string;
  onPick: (color: string) => void;
  onReset: () => void;
}) {
  return (
    <>
      <ColorPicker value={value} onChange={onPick} />
      <footer className={s.popFoot}>
        <button type="button" className={s.popReset} onClick={onReset}>По ранжиру</button>
      </footer>
    </>
  );
}

/** Досье подрядчика — пока заглушка: реквизиты, итог по КП и честная фраза о
 *  том, что раздела ещё нет. Окно с пустотой внутри хуже отсутствия окна,
 *  поэтому здесь стоит то, что УЖЕ известно из сравнения. */
function Dossier({ bid, total, onClose }: { bid: Bid; total: number; onClose: () => void }) {
  const { contractor, percent, filled, sum, rankLabel } = bid;
  const status = bidStatus(contractor.status);

  return (
    <>
      <header className={modalPart.head}>
        <h2 className={modalPart.title}>{contractor.name}</h2>
        <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
      </header>

      <dl className={s.facts}>
        <Fact label="ИНН">{contractor.inn}</Fact>
        <Fact label="Контактное лицо">{contractor.contact}</Fact>
        <Fact label="КП поступило">{contractor.submitted}</Fact>
        <Fact label="Заполнено">
          {percent}% — {filled} из {total} {plural(total, 'позиции', 'позиций', 'позиций')}
        </Fact>
        <Fact label="Итог по КП">{money(sum)}</Fact>
        <Fact label="Место в сравнении">{rankLabel}</Fact>
      </dl>

      {/* <ScreenPlaceholder> сюда не берётся намеренно: у него min-height 320px
          — он рассчитан на пустой ЭКРАН и в окне на 520px выглядел бы дырой.
          Фраза та же по смыслу: честно сказать, что раздела ещё нет. */}
      <p className={s.note}>
        <Icon name="billList" className={s.noteIcon} />
        Карточка подрядчика — история договоров, допуски и рейтинг — ещё не реализована.
      </p>

      <footer className={modalPart.foot}>
        {/* autoFocus, чтобы showModal() не оставлял фокус на самом <dialog>:
            <Modal> гасит его кольцо, и без своей первой цели фокус пропал бы
            из виду совсем. */}
        <Button variant="primary" autoFocus onClick={onClose}>Закрыть</Button>
      </footer>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.fact}>
      <dt className={s.factLabel}>{label}</dt>
      <dd className={s.factValue}>{children}</dd>
    </div>
  );
}
