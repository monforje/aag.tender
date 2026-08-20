import { cx } from '@/shared/lib/cx';
import s from './Counter.module.css';

interface CounterProps {
  children: number | string;
  /** «Тихий» вариант: без заливки, серым (как у Team Ops | Work). */
  muted?: boolean;
  /** Позиционирование задаёт родитель (.topbar__notif .counter,
   *  .nav-item__counter) — в оригинале это были парные классы на том же узле. */
  className?: string;
}

export function Counter({ children, muted, className }: CounterProps) {
  return (
    <span className={cx(s.counter, muted && s.counterMuted, className)}>{children}</span>
  );
}
