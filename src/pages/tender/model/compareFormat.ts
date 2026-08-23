import { decimal, type Bid } from '@/entities/comparison';
import type { Tone } from '@/shared/ui/Badge';

/** Формат и цвет сравнения КП: тон → CSS-токен и обратно, подписи процентов,
 *  действующий цвет колонки.
 *
 *  Живёт в model/, а не в компонентах: одни и те же значения читают <col>
 *  таблицы, карточка подрядчика и ячейки с попапами. Единый источник не даёт
 *  колонке и её шапке разъехаться в цвете, а процентам — в формате.
 *
 *  ВЫЧИСЛЕННОЕ ЗНАЧЕНИЕ ЦВЕТА читает DOM (`getComputedStyle`): вызывать можно
 *  только на клиенте — у приложения SSR нет. */

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
export const toneColor = (tone: Tone) => `var(${TONE_TOKEN[tone]})`;

/** Он же ВЫЧИСЛЕННЫМ значением. Пикеру нужен цвет, а не ссылка: `var(...)`
 *  для него — просто нераспознанная строка, и окно открылось бы на чёрном. */
export const resolveTone = (tone: Tone) =>
  getComputedStyle(document.documentElement).getPropertyValue(TONE_TOKEN[tone]).trim();

/** Процент со знаком и типографским минусом: направление отклонения читается
 *  знаком, а не догадкой. */
export const pctSigned = (v: number): string =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${decimal(Math.abs(v))} %`;

/** Действующий цвет колонки: рука важнее ранжира. Отсутствие ключа в `tint`
 *  значит «красит ранжир». */
export const choose = (tint: Record<string, string>, bid: Bid): string =>
  tint[bid.contractor.id] ?? toneColor(bid.tone);
