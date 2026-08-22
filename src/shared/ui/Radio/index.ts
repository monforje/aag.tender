export { Radio, RadioGroup, type RadioProps, type RadioGroupProps } from './Radio';

/* Радио существует ТОЛЬКО парой «группа + пункт»: без группы у пункта нет
   ни name, ни смысла. Нарушение ловится в рантайме честной ошибкой,
   а не тихо пропавшим именем группы. */
