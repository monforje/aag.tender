import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import { Badge, type Tone } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Table, tableCell } from '@/shared/ui/Table';
import { VisuallyHidden } from '@/shared/ui/VisuallyHidden';
import {
  BID_STATUS, CONTRACTORS, GROUPS, POSITIONS,
  decimal, groupSum, money, rankBids, spread, type Bid, type PositionGroup,
} from '@/entities/tender';
import s from './TenderCompare.module.css';

/** Тон → CSS-переменная. Таблицей, а не `var(--cu-tone-${tone})`: собранное
 *  из строки имя не проверяется ничем, и опечатка дала бы колонку без цвета
 *  без единой ошибки в консоли. */
const TONE_VAR: Record<Tone, string> = {
  info: 'var(--cu-tone-info)',
  success: 'var(--cu-tone-success)',
  warning: 'var(--cu-tone-warning)',
  danger: 'var(--cu-tone-danger)',
  neutral: 'var(--cu-tone-neutral)',
};

/** Палитра колонки. «Авто» стоит первой и включена по умолчанию: базовый цвет
 *  считается по ранжиру, а рука нужна там, где расчёт не всё знает — сроки,
 *  гарантии, прошлые объекты. Пять тонов, а не свободный цветовой круг:
 *  цвет здесь ЗНАЧЕНИЕ, а не украшение, и новых значений не заводится. */
/** Деления шкалы заполнения: по 10% каждое. */
const METER_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type TintChoice = Tone | 'auto';
const TINTS: { value: TintChoice; label: string }[] = [
  { value: 'auto', label: 'По ранжиру' },
  { value: 'success', label: 'Зелёный — лучшие условия' },
  { value: 'warning', label: 'Янтарный — есть вопросы' },
  { value: 'danger', label: 'Красный — не подходит' },
  { value: 'info', label: 'Синий — на контроле' },
  { value: 'neutral', label: 'Серый — вне сравнения' },
];

/**
 * Сравнение коммерческих предложений: позиции сметы строками, подрядчики —
 * колонками, каждая со своей карточкой в шапке.
 *
 * КОГДА:  раздел «Сравнение» карточки тендера.
 * НЕ ДЛЯ: реестра тендеров (см. TenderRegistryPage) и списка самих КП
 *         (раздел «КП» — это документы, а не сопоставление цифр).
 *
 * UX:     ШАПКА КОЛОНКИ — КАРТОЧКА, а не подпись: подрядчика выбирают не по
 *         имени, а по четырём числам сразу (полнота КП, процент, сумма,
 *         состояние), и держать их в отдельной строке над таблицей значило бы
 *         заставить глаз ходить туда-обратно на каждой позиции. Ячейка
 *         отдана карточке целиком — <Table> публикует для этого модификатор
 *         tableCell.card, снимающий паддинг и высоту шапки.
 *         ШКАЛА ЗАПОЛНЕНИЯ СЕГМЕНТНАЯ, а не сплошная: делений ровно столько,
 *         сколько позиций в смете, и «4 из 6» видно, не читая процент.
 *         Сплошная полоса на шести значениях врёт — показывает непрерывность
 *         там, где её нет.
 *         КАРТОЧКА ЗАЛИТА ТЕМ ЖЕ ЦВЕТОМ, ЧТО И КОЛОНКА ПОД НЕЙ, — полоса
 *         читается непрерывной от шапки до последней строки. Цветного канта по
 *         краю карточки нет намеренно: тон в ней уже назван кружком места и
 *         заливкой шкалы, и третий раз он был бы украшением.
 *         ЦВЕТ КОЛОНКИ — ПОДСКАЗКА, А НЕ ВЕРДИКТ. Базово его ставит ранжир
 *         (лучшее зелёное, худшее красное, середина янтарная), но ранжир
 *         знает только цифры, поэтому цвет перекрашивается рукой. Палитра
 *         проявляется по наведению на карточку (рецепт 5 каталога состояний):
 *         в покое шесть кружков в каждой колонке спорили бы с данными.
 *         Звезда «в избранном» — форма, а не цвет: контур меняется на
 *         заливку, отметка читается и в чёрно-белом.
 *         Карточка кликабельна целиком и открывает досье подрядчика; клики по
 *         звезде и палитре до неё не доходят — иначе выбор цвета каждый раз
 *         открывал бы модалку.
 * A11Y:   палитра — настоящая radiogroup (выбор один из шести), звезда —
 *         кнопка с aria-pressed. Шкала заполнения — role="img" с подписью
 *         словами: сегменты сами по себе скринридеру ничего не говорят.
 *         Место в ранжире продублировано текстом (<VisuallyHidden>), потому
 *         что заливка колонки в 7% для скринридера не существует вовсе.
 *         Досье — нативный <dialog>.showModal(): фокус, Escape и подложка
 *         достаются от платформы, а не переписываются руками.
 *
 * @example
 * {tab === 'compare' ? <TenderCompare /> : null}
 */
export function TenderCompare() {
  const bids = rankBids(CONTRACTORS, POSITIONS);
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
  const [tint, setTint] = useState<Record<string, TintChoice>>({});
  const [starred, setStarred] = useState<string[]>([]);
  const [dossier, setDossier] = useState<Bid | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openDossier = (bid: Bid) => {
    setDossier(bid);
    dialogRef.current?.showModal();
  };

  return (
    <>
      <Table caption={`${POSITIONS.length} позиций в ${GROUPS.length} разделах · ${bids.length} предложения`}>
        {/* Цвет колонки — на <col>, а не на каждой ячейке. Фон колонки
            рисуется НИЖЕ фона строки, поэтому ховер строки (.05) продолжает
            читаться поверх заливки, а не гасится ею. Сама арифметика цвета —
            в .module.css: отсюда уходит только тон. Ширину колонки задаёт не
            <col>, а min-width самой карточки: ширина у <col> — рекомендация,
            которую алгоритм таблицы вправе не выполнить, а min-width контента
            он обязан уважить. */}
        <colgroup>
          {/* Линейка между колонками — на <col>, одним правилом на всю
              колонку сразу. У последней её нет: там край ленты. */}
          <col className={s.colRule} />
          <col className={s.colRule} />
          <col className={s.colRule} />
          <col className={s.colRule} />
          {bids.map((bid, i) => (
            <col
              key={bid.contractor.id}
              className={cx(s.colTint, i < bids.length - 1 && s.colRule)}
              style={{ '--col': TONE_VAR[choose(tint, bid)] } as CSSProperties}
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
                  tone={choose(tint, bid)}
                  choice={tint[bid.contractor.id] ?? 'auto'}
                  starred={starred.includes(bid.contractor.id)}
                  onStar={() => setStarred((list) => (
                    list.includes(bid.contractor.id)
                      ? list.filter((id) => id !== bid.contractor.id)
                      : [...list, bid.contractor.id]
                  ))}
                  onTint={(value) => setTint((all) => ({ ...all, [bid.contractor.id]: value }))}
                  onOpen={() => openDossier(bid)}
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
        {GROUPS.map((group) => {
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
                <td className={s.groupMeta}>позиций</td>
                <td />
                {bids.map((bid) => <td key={bid.contractor.id} />)}
              </tr>

              {open ? group.positions.map((position) => {
                const gap = spread(position);
                return (
                  <tr key={position.id}>
                    <td className={tableCell.strong}>{position.title}</td>
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

      {/* Досье — нативный <dialog>: фокус заперт, Escape закрывает, подложка
          рисуется браузером. Клик по подложке приходит на сам <dialog>
          (содержимое лежит в .modal__body), и это единственный способ отличить
          его от клика внутри окна. */}
      <dialog
        ref={dialogRef}
        className={s.modal}
        onClose={() => setDossier(null)}
        onClick={(e) => { if (e.target === e.currentTarget) dialogRef.current?.close(); }}
      >
        {dossier ? <Dossier bid={dossier} onClose={() => dialogRef.current?.close()} /> : null}
      </dialog>
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

/** Действующий тон колонки: рука важнее ранжира. */
function choose(tint: Record<string, TintChoice>, bid: Bid): Tone {
  const picked = tint[bid.contractor.id] ?? 'auto';
  return picked === 'auto' ? bid.tone : picked;
}

/** Карточка подрядчика — она же шапка колонки. Локальная: за её пределами
 *  такой блок ничего не значит, а вынести в shared можно будет, когда
 *  появится второй экран со сравнением по колонкам. */
function ContractorCard({
  bid, tone, choice, starred, collapsed, onStar, onTint, onOpen, onFold,
}: {
  bid: Bid;
  tone: Tone;
  choice: TintChoice;
  starred: boolean;
  collapsed: boolean;
  onStar: () => void;
  onTint: (value: TintChoice) => void;
  onOpen: () => void;
  onFold: () => void;
}) {
  const { contractor, filled, percent, sum, rankLabel } = bid;
  const status = BID_STATUS[contractor.status];
  /* Делений зажигается floor(percent/10): 88% — это восемь, а не девять.
     Округлять вверх значило бы дорисовывать заполнение, которого нет. */
  const lit = Math.floor(percent / 10);

  return (
    // Клик по карточке открывает досье, но клики по её собственным кнопкам —
    // нет: тот же приём, что у строки реестра, только там отсеивалась ссылка.
    <div
      className={s.card}
      style={{ '--col': TONE_VAR[tone] } as CSSProperties}
      onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) onOpen(); }}
    >
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

        {/* Настоящая кнопка, а не просто текст: карточка кликабельна целиком,
            но клавиатуре нужна одна цель, которую можно поймать Tab'ом. */}
        <button type="button" className={s.cardName} onClick={onOpen}>
          {contractor.name}
        </button>

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
        {/* Делений ровно столько, сколько позиций: шкала показывает «4 из 6»
            формой, а не только числом. */}
        {/* Десять делений по 10% — шкала показывает ВЕЛИЧИНУ, а не «сколько
            строк из тринадцати»: заполненность считается по стоимости сметы, и
            деления по позициям обещали бы другую арифметику. Округление вниз:
            88% это восемь делений, а не девять. */}
        <div
          className={s.meter}
          role="img"
          aria-label={`Заполненность КП ${percent}%; расценки есть у ${filled} позиций из ${POSITIONS.length}`}
        >
          {METER_STEPS.map((step) => (
            <span
              key={step}
              className={cx(s.meterSeg, step < lit && s.isOn, step === lit - 1 && s.isLead)}
            />
          ))}
        </div>

        <p className={s.meterRow}>
          <span className={s.percent}>{percent}%</span>
          <span className={s.meterHint}>заполненность КП</span>
        </p>

        <p className={s.sum}>{money(sum)}</p>

        <Badge className={s.cardStatus} tone={status.tone} icon={status.icon}>
          {status.label}
        </Badge>
      </div>
      )}

      {/* Палитра колонки. В покое погашена — проявляется по наведению на
          карточку и по фокусу внутри неё (рецепт 5): без :focus-within
          кнопки были бы недостижимы с клавиатуры. Место под неё держится
          всегда, поэтому карточка не дёргается. */}
      {collapsed ? null : (
      <div className={s.tints} role="radiogroup" aria-label={`Цвет колонки «${contractor.name}»`}>
        {TINTS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={choice === option.value}
            aria-label={option.label}
            title={option.label}
            className={cx(s.tint, option.value === 'auto' && s.tintAuto, choice === option.value && s.isOn)}
            style={option.value === 'auto' ? undefined : ({ '--dot': TONE_VAR[option.value] } as CSSProperties)}
            onClick={() => onTint(option.value)}
          />
        ))}
      </div>
      )}
    </div>
  );
}

/** Досье подрядчика — пока заглушка: реквизиты, итог по КП и честная фраза о
 *  том, что раздела ещё нет. Окно с пустотой внутри хуже отсутствия окна,
 *  поэтому здесь стоит то, что УЖЕ известно из сравнения. */
function Dossier({ bid, onClose }: { bid: Bid; onClose: () => void }) {
  const { contractor, percent, filled, sum, rankLabel } = bid;
  const status = BID_STATUS[contractor.status];

  return (
    <div className={s.modalBody}>
      <header className={s.modalHead}>
        <h2 className={s.modalTitle}>{contractor.name}</h2>
        <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
      </header>

      <dl className={s.facts}>
        <Fact label="ИНН">{contractor.inn}</Fact>
        <Fact label="Контактное лицо">{contractor.contact}</Fact>
        <Fact label="КП поступило">{contractor.submitted}</Fact>
        <Fact label="Заполнено">{percent}% — {filled} из {POSITIONS.length} позиций</Fact>
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

      <footer className={s.modalFoot}>
        {/* autoFocus, чтобы showModal() не оставлял фокус на самом <dialog>:
            браузер рисует вокруг него своё кольцо, и это читалось как лишняя
            рамка окна. */}
        <Button variant="primary" autoFocus onClick={onClose}>Закрыть</Button>
      </footer>
    </div>
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
