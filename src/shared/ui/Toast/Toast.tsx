import {
  createContext, useCallback, useContext, useRef, useState,
  type ReactNode,
} from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/ui/Icon';
import { CloseButton } from '@/shared/ui/Micro';
import type { Tone } from '@/shared/ui/Badge';
import s from './Toast.module.css';

/** Время жизни тоста. Достаточно прочитать заголовок дважды; дольше —
 *  мусор в углу экрана. */
const LIFETIME = 5000;
/** Одновременно видно не больше трёх: очередь длиннее — это поток событий,
 *  а его место в журнале, а не на углу экрана. */
const MAX_VISIBLE = 3;

export interface ToastInput {
  tone?: Extract<Tone, 'info' | 'success' | 'warning' | 'danger'>;
  title: string;
  description?: ReactNode;
}

interface ToastEntry extends ToastInput {
  id: number;
}

type ShowToast = (toast: ToastInput) => void;

const ToastContext = createContext<ShowToast | null>(null);

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) {
    throw new Error('useToast() вызван вне <ToastProvider>: тосты рендерятся в его вьюпорт.');
  }
  return show;
}

/**
 * Провайдер тостов + вьюпорт. Монтируется ОДИН раз, у корня приложения.
 *
 * КОГДА:  подтверждение действия, результат которого не меняет текущий
 *         экран: «КП отправлено», «Ссылка скопирована».
 * НЕ ДЛЯ: сообщений, которые должны жить в потоке страницы (см. <Alert>),
 *         ошибок загрузки области (см. <ErrorState>) и всего, что требует
 *         решения пользователя (это уже <Modal> или <ConfirmDialog>).
 *
 * UX:     тост исчезает САМ и закрывается крестиком — оба выхода всегда
 *         доступны. Стопка ограничена тремя записями: поток событий — не
 *         лента уведомлений. Тосты НЕ показываются поверх открытых окон:
 *         модальность гасит контекст, и сообщение поверх подложки читалось
 *         бы как паника.
 * A11Y:   вьюпорт — aria-live="polite": появление объявляется без перебивания;
 *         критичные события должны оставаться в потоке страницы, а не
 *         улетать в угол. Крестик — кнопка с aria-label «Закрыть».
 *
 * @example
 * // в app/index.tsx:  <ToastProvider><AppRouter /></ToastProvider>
 * const toast = useToast();
 * toast.show({ tone: 'success', title: 'КП отправлено' });
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastEntry[]>([]);
  const seq = useRef(0);

  const close = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ShowToast>((input) => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { ...input, id }]);
    window.setTimeout(() => close(id), LIFETIME);
  }, [close]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* role="region" даёт области имя-ориентир; live="polite" объявляет
          новые записи, не перебивая речь. */}
      <div className={s.viewport} role="region" aria-live="polite" aria-label="Уведомления">
        {items.map(({ id, tone = 'info', title, description }) => (
          <div key={id} className={cx(s.toast, TONE_CLASS[tone])}>
            <Icon name={TOAST_ICON[tone]} className={s.toastIcon} />
            <div className={s.toastBody}>
              <div className={s.toastTitle}>{title}</div>
              {description && <div className={s.toastDescription}>{description}</div>}
            </div>
            <CloseButton variant="quiet" onClick={() => close(id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TOAST_ICON = {
  info: 'bell',
  success: 'checkCircle',
  warning: 'flag',
  danger: 'closeCircle',
} as const;

/* Тон → класс таблицей литералов, а не шаблонной строкой: localsConvention
   'camelCaseOnly' отдаёт ключи ТОЛЬКО в camelCase, и собранный из кебаба
   ключ молча вернул бы undefined. */
const TONE_CLASS = {
  info: s.isInfo,
  success: s.isSuccess,
  warning: s.isWarning,
  danger: s.isDanger,
} as const;
