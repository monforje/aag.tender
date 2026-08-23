import { useState, type ReactNode } from 'react';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/ui/Icon';
import { Popover } from '@/shared/ui/Popover';
import { decimal, type CompareThresholds } from '@/entities/tender';
import { AnomalyGlyph, CoinMark, KeyMark } from './assets';
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
            sample={<span className={s.sampleCorrected}><s>920</s> → 840</span>}
            name="Правка объёма"
            text="Объём скорректирован по сверке сметы; показаны оба значения."
          />
          <Item
            name="Разброс строки"
            text="Расхождение цен внутри позиции по трём ярусам шкалы."
            sample={spreadTiers(thresholds)}
          />
          <Item
            sample={<span className={s.shareTrack}><i style={{ width: '33%' }} /></span>}
            name="Доля веса"
            text="Вклад строки в закупку; вид строк «По весу», сумма долей = 100 %."
          />
        </div>
      </Popover>
    </div>
  );
}

/* Ярусы разброса подписываются ТЕМИ ЖЕ порогами тендера, что красят ячейки и
   фильтр ([R4]): разъехаться подписи и цвету неоткуда. */
function spreadTiers(thresholds: CompareThresholds): ReactNode {
  const { spreadNoticeable: lo, spreadHigh: hi } = thresholds;
  return (
    <span className={s.spreadDemo}>
      {([
        ['none', `< ${decimal(lo)} %`],
        ['noticeable', `${decimal(lo)}–${decimal(hi)} %`],
        ['high', `≥ ${decimal(hi)} %`],
      ] as const).map(([tone, cap]) => (
        <span key={tone} className={s.spreadRow}>
          <span className={s.spreadTrack}><i data-tone={tone} /></span>
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
