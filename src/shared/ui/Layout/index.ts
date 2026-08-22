export { Stack, type StackProps } from './Stack';
export { Inline, type InlineProps } from './Inline';
export { Grid, type GridProps } from './Grid';
export { Divider } from './Divider';
export { gap, gapStyle, type GapIndex } from './scale';

/* Слой LAYOUT — четыре раскладочных примитива, общий тип ступени шкалы
   и один CSS-модуль на всех. Семейный слайс, как Page и Dropdown: элементы
   делят шкалу зазоров (scale.ts) и правила одного модуля, а порознь они
   были бы четырьмя копиями одного flex-правила.

   Чего здесь НАМЕРЕННО нет:
     Box     — это <div className={…}>; обёртка над div без поведения
               только прячет семантику и стоит лишнего узла;
     Container — ограничитель ширины страницы: в этом приложении ширину
               держит каркас (.main), а не содержимое;
     Spacer  — зазор решается пропом gap соседей; распорка-пустышка
               появляется там, где раскладка уже сломана. */
