export { Card, cardPart, type CardProps } from './Card';

/* Карточка как поверхность. Части отдаются классами (cardPart), а не
   пропами title/footer — та же причина, что у modalPart: шапка карточки
   почти никогда не бывает голой строкой. */
