import { useEffect, useRef, useState } from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import s from './control.module.css';

/** Сколько миллисекунд показывать галочку «скопировано». */
const COPIED_MS = 1600;

export interface CopyButtonProps {
  /** Что положить в буфер обмена. Строка, а не ReactNode: копируют ЗНАЧЕНИЕ,
   *  а не его представление. */
  value: string;
  /** Имя действия для скринридера и title. Называйте по данным: «Копировать
   *  номер тендера», не просто «Копировать». */
  label?: string;
  className?: string;
}

/**
 * Копирование значения в буфер обмена с подтверждением на месте.
 *
 * КОГДА:  рядом со значением, которое переносят в другое место: номер
 *         тендера, ИНН, ссылка на объект.
 * НЕ ДЛЯ: действий с последствиями (это <Button>/<IconButton>) — копирование
 *         обратимо и тихо, поэтому и подтверждение без тоста.
 *
 * UX:     подтверждение — смена глифа на галочку тона success полторы
 *         секунды. Тост ради скопированной строки — шум: курсор уже здесь.
 *         Кнопка появляется как сосед значения (Inline gap={1}), а не фон
 *         под всей ячейкой.
 * A11Y:   настоящая кнопка с aria-label; смена глифа дублируется сменой
 *         aria-label («Скопировано»), чтобы состояние объявлялось.
 *
 * @example
 * <Inline gap={1}>
 *   <NumericText>№ 44-2026-ИЗ</NumericText>
 *   <CopyButton value="44-2026-ИЗ" label="Копировать номер" />
 * </Inline>
 */
export function CopyButton({ value, label = 'Копировать', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = () => {
    /* writeText может не существовать (небезопасный контекст) — тогда кнопка
       честно ничего не делает: обещать успех было бы хуже отказа. */
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
      },
      () => {},
    );
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cx(s.copy, copied && s.isCopied, className)}
      title={copied ? 'Скопировано' : label}
      aria-label={copied ? 'Скопировано' : label}
    >
      {/* Глиф меняется целиком, а не дорисовывается поверх: две иконки в
          одной ячейке спорили бы за один взгляд. */}
      <Icon name={copied ? 'checkCircle' : 'clipboardList'} />
    </button>
  );
}

export interface CloseButtonProps {
  /** inherit — кнопка наследует тон подложки и молчит в покое (алерты);
   *  quiet — тише текста панели, темнеет к ховеру (тосты, дроверы). */
  variant?: 'inherit' | 'quiet';
  onClick: () => void;
  label?: string;
  className?: string;
}

/**
 * Крестик закрытия: ОДИН рисунок на все поверхности.
 *
 * КОГДА:  гашение сообщения, тоста, панели — везде, где раньше собирался
 *         свой крестик из Icon+кнопки.
 * НЕ ДЛЯ: удаления данных (см. <ConfirmDialog> — там действие, а не отмена
 *         сообщения) и закрытия вкладок с несохранённым вводом (та же
 *         причина: крестик молчит, а решение требует вопроса).
 *
 * UX:     два варианта = две подложки: inherit живёт на цветном алерте
 *         (наследует тон, в покое приглушён opacity .7), quiet — на белой
 *         панели (тише текста). Ховер у обоих — ступень компактного
 *         контрола из шкалы состояний.
 * A11Y:   подпись «Закрыть» ставится по умолчанию; уточняйте, когда рядом
 *         несколько крестиков закрывают разное.
 *
 * @example
 * <Alert … onClose={…}> — уже рисует CloseButton сама.
 */
export function CloseButton({ variant = 'quiet', onClick, label = 'Закрыть', className }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(s.close, variant === 'inherit' ? s.closeInherit : s.closeQuiet, className)}
    >
      <Icon name="closeCircle" />
    </button>
  );
}

export interface MoreButtonProps {
  onClick: () => void;
  /** Активное состояние («в этом меню что-то включено») — ведёт IconButton. */
  active?: boolean;
  label?: string;
  className?: string;
}

/**
 * Кнопка «ещё» (⋯): вход в меню дополнительных действий строки или карточки.
 *
 * КОГДА:  второстепенные действия, которым не место в основном ряду:
 *         переименовать, скопировать ссылку, открыть досье.
 * НЕ ДЛЯ: единственного действия точки (оно должно быть явной кнопкой с
 *         текстом — см. <Button>) и разрушающих действий внутри такого меню
 *         (пункт «Удалить» в нём обязан вести через <ConfirmDialog>).
 *
 * UX:     это ПРЕСЕТ над <IconButton>, а не новая кнопка: поверхность —
 *         панельная, глиф — ellipsis. Стандартизовано имя («Ещё») и глиф:
 *         меню доп. действий выглядит одинаково во всех строках.
 * A11Y:   aria-haspopup и aria-expanded ставьте сами, когда меню открывается:
 *         компонент знает только про нажатие.
 *
 * @example
 * <MoreButton onClick={(e) => setMenuAt(e.currentTarget.getBoundingClientRect())} />
 */
export function MoreButton({ onClick, active, label = 'Ещё', className }: MoreButtonProps) {
  return (
    /* Пресет, а не обёртка с ref-форвардингом: потребителю нужен rect клика —
       он получает его собственным обработчиком на месте. */
    <IconButton
      variant="panel"
      icon="ellipsis"
      label={label}
      active={active}
      onClick={onClick}
      className={className}
    />
  );
}
