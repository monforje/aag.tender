/** Склейка classNames: пропускает false/undefined/null, чтобы условные
 *  модификаторы писались как cx(s.row, isActive && s.isActive). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
