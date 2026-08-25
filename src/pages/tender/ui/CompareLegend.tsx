import { useState, type ReactNode } from 'react';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/ui/Icon';
import { Popover } from '@/shared/ui/Popover';
import { decimal, type CompareThresholds } from '@/entities/comparison';
import { AnomalyGlyph, CoinMark, CommentMark, KeyMark, MedMark, SpreadMark } from './assets';
import s from './CompareLegend.module.css';

/**
 * Легенда пометок таблицы сравнения: справка «что означает каждый знак».
 *
 * КОГДА:  в хвосте полосы сравнения, слева от «Фильтров» — правый угол остаётся
 *         действию с состоянием, справке хватает тихой кнопки-глифа.
 * НЕ ДЛЯ: объяснения КОНКРЕТНОЙ пометки («почему так») — это делает попап
 *         ячейки (<useCellPopup>) по наведению; легенда — общий словарь
 *         устройств, читают его отдельно от таблицы.
 *
 * UX:     ПОВЕРХНОСТЬ — <Popover>, а не окно: чтение справки не обязано гасить
 *         таблицу подложкой и запирать фокус; Escape и клик мимо достаются от
 *         платформы. Образцы — ТЕ ЖЕ компоненты глифов из ./assets, что красят
 *         ячейки: дрейф формы исключён реюзом, а не копией. Ярусы разброса
 *         подписаны ПОРОГАМИ ТЕНДЕРА — теми же числами, что живут в модели:
 *         специалист сдвинул порог — легенда говорит новым значением.
 * A11Y:   триггер — <IconButton> с aria-expanded и aria-haspopup="dialog";
 *         имя панели даёт проп label Поповера, видимый заголовок дублирует его
 *         для зрячих. Контраст пояснений — secondary ([R1]).
 */
export function CompareLegend({ thresholds }: { thresholds: CompareThresholds }) {
  const [at, setAt] = useState<DOMRect | null>(null);

  return (
    /* Ширина панели живёт переменной --pop-width (мост через границу модулей:
        её читает <Popover>), а не борьбой классов за паддинги диалога. */
    <div className={s.root}>
      <IconButton
        variant="topbar"
        icon="book2"
        label="Легенда пометок"
        title="Что означают пометки в таблице"
        aria-haspopup="dialog"
        aria-expanded={at !== null}
        onClick={(e) => setAt(e.currentTarget.getBoundingClientRect())}
      />
      <Popover anchor={at} onClose={() => setAt(null)} label="Легенда пометок">
        <div className={s.body}>
          <Item
            sample={<Icon name="skill" className={s.sampleLeader} />}
            name="Текущий лидер"
            text="Медаль перед именем в шапке колонки: минимальный итог среди поданных КП. Не зависит от ручной перекраски."
          />
          <Item
            sample={<span className={s.sampleTag}>МИН</span>}
            name="Минимальная стоимость"
            text="Лучшая цена без аномалий в строке. Стоит на одной и той же ячейке при любом режиме показа."
          />
          <Item
            sample={<CoinMark />}
            name="Запас торга"
            text="Столько подрядчик готов уступить. Монета стоит слева от главного числа."
          />
          <Item
            sample={<AnomalyGlyph />}
            name="Аномальная цена"
            text="Выбивается из ряда, требует обоснования. Причина — в карточке пометки."
          />
          <Item
            sample={<KeyMark />}
            name="Ключевая позиция"
            text="Ручная пометка закупщика или строка из «топа по весу». Ключ стоит справа от названия."
          />
          <Item
            sample={<span className={s.sampleMissing}>—</span>}
            name="Нет цены"
            text="Пробел в данных, а не решение подрядчика."
          />
          <Item
            sample={(
              <span className={s.sampleChip}>
                <Icon name="closeCircle" className={s.sampleChipIcon} />
                Отказ
              </span>
            )}
            name="Отказ"
            text="Осознанный отказ подрядчика от позиции."
          />
          <Item
            sample={<span className={s.riska} />}
            name="Аномалия — риска на кромке"
            text="Второй канал к штриховке: читается и при выключенной цветовой подсветке."
          />
          <Item
            sample={<span className={s.sampleMax}>1 200</span>}
            name="Верхняя граница строки"
            text="Тихая засечка над числом: самое дорогое честное предложение. Слабее минимума — это контекст торга, а не вердикт."
          />
          <Item
            sample={<span className={s.sampleComment}><CommentMark unread /></span>}
            name="Комментарий поставщика"
            text="Закрашенный пузырь с точкой — есть непросмотренное; клик открывает тред истории."
          />
          <Item
            sample={<span className={s.sampleWait}><i /><i /><i /></span>}
            name="Ждём ответ"
            text="Запрос ушёл, ответа нет. Не то же, что пробел данных: там запрашивают, здесь напоминают."
          />
          <Item
            sample={<MedMark />}
            name="Отклонение к медиане"
            text="Суффикс процента по галочке «Отклонение»: насколько цена выше или ниже типичной в строке."
          />
          <Item
            name="Разброс строки"
            text="Одна линейка в трёх тонах: низкий · заметный · высокий. Процент рядом текстом — цвет не единственный носитель."
            sample={spreadTiers(thresholds)}
          />
          <Item
            sample={<span className={s.shareTrack}><i style={{ width: '33%' }} /></span>}
            name="Вклад позиции"
            text="Доля строки в стоимости тендера; длина нормирована по самой тяжёлой позиции, а не по сотне."
          />

          {/* ПОДВАЛ РАЗВОДИТ ДВА СПРАВОЧНЫХ СЛОЯ. Их путают постоянно: человек
              наводится на ячейку и ждёт словарь, наводится на легенду и ждёт
              число. Правило названо словами один раз здесь и больше нигде не
              повторяется. */}
          <p className={s.rule}>
            Легенда — словарь знаков. Конкретное число объясняет наведение на
            саму ячейку, а «почему именно так и откуда оно» — клик по ней.
          </p>
        </div>
      </Popover>
    </div>
  );
}

/* Ярусы разброса подписываются ТЕМИ ЖЕ порогами тендера, что красят ячейки и
   фильтр ([R4]): разъехаться подписи и цвету неоткуда. */
function spreadTiers(thresholds: CompareThresholds): ReactNode {
  const { spreadNoticeable: lo, spreadHigh: hi } = thresholds;
  /* Образец — ТА ЖЕ линейка, что стоит в колонке разброса, в тех же трёх
     тонах: с 25.08.2026 степень несёт ЦВЕТ ОДНОГО глифа, и легенда обязана
     показывать именно его, а не абстрактные полоски. */
  return (
    <span className={s.spreadDemo}>
      {([
        ['low', `< ${decimal(lo)} %`],
        ['not', `${decimal(lo)}–${decimal(hi)} %`],
        ['high', `≥ ${decimal(hi)} %`],
      ] as const).map(([tone, cap]) => (
        <span key={tone} className={s.spreadRow}>
          <span className={s.spreadGlyph} data-tone={tone}><SpreadMark /></span>
          <span className={s.spreadCap}>{cap}</span>
        </span>
      ))}
    </span>
  );
}

function Item({ sample, name, text }: { sample: ReactNode; name: string; text: string }) {
  return (
    <div className={s.item}>
      <span className={s.sample}>{sample}</span>
      <span className={s.about}>
        <span className={s.name}>{name}</span>
        <span className={s.text}>{text}</span>
      </span>
    </div>
  );
}
