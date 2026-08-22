import { useState, type ReactNode } from 'react';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/ui/Icon';
import { Popover } from '@/shared/ui/Popover';
import { AnomalyGlyph, CoinMark, KeyMark, MedMark, TagMark } from './assets';
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
 *         ячейки: дрейф формы исключён реюзом, а не копией. Расположение
 *         пометки («слева от цены», «справа от названия») названо словами в
 *         пояснении, не позицией в образце. Разброс показан тремя ярусами
 *         шкалы с порогами — теми же числами, что живут в модели.
 * A11Y:   триггер — <IconButton> с aria-expanded и aria-haspopup="dialog";
 *         имя панели даёт проп label Поповера, видимый заголовок дублирует его
 *         для зрячих. Контраст пояснений — secondary ([R1]).
 */
export function CompareLegend() {
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
            sample={<span className={s.sampleTag}><TagMark /></span>}
            name="Минимальная цена"
            text="Лучшая цена без аномалий. Видна при показателе «Цена»."
          />
          <Item
            sample={<CoinMark />}
            name="Запас торга"
            text="Столько подрядчик готов уступить. Монета стоит слева от цены."
          />
          <Item
            sample={<AnomalyGlyph />}
            name="Аномальная цена"
            text="Выбивается из ряда, требует обоснования. Причина — в карточке пометки."
          />
          <Item
            sample={<KeyMark />}
            name="Ключевая позиция"
            text="Сильнее других двигает итог. Ключ стоит справа от названия."
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
            sample={(
              <span className={s.spreadDemo}>
                {[['none', '< 7 %'], ['noticeable', '7–15 %'], ['high', '≥ 15 %']].map(([tone, cap]) => (
                  <span key={tone} className={s.spreadRow}>
                    <span className={s.spreadTrack}><i data-tone={tone} /></span>
                    <span className={s.spreadCap}>{cap}</span>
                  </span>
                ))}
              </span>
            )}
          />
          <Item
            sample={<MedMark />}
            name="Дороже медианы"
            text="Выше медианы более чем на 5 % — тот же порог, что красит отклонение."
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
