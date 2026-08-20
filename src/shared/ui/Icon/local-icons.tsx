/* Четыре иконки рейла, которых нет в @solar-icons: пути скопированы из спрайта
   reference/index.html как есть. Сигнатура и разметка — как у Solar-компонентов
   (viewBox 24×24, fill/stroke/размер задаёт CSS), поэтому в ICONS они
   взаимозаменяемы с настоящими. */
import type { SVGProps } from 'react';

export function DocsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M9 3.5H15.5C17.3856 3.5 18.3284 3.5 18.9142 4.08579C19.5 4.67157 19.5 5.61438 19.5 7.5V16.5C19.5 18.3856 19.5 19.3284 18.9142 19.9142C18.3284 20.5 17.3856 20.5 15.5 20.5H8.5C6.61438 20.5 5.67157 20.5 5.08579 19.9142C4.5 19.3284 4.5 18.3856 4.5 16.5V7.5C4.5 5.61438 4.5 4.67157 5.08579 4.08579C5.67157 3.5 6.61438 3.5 8.5 3.5" stroke="currentColor" /> <path d="M9 3.5C9 2.67157 9.67157 2 10.5 2H15.5C17.3856 2 18.3284 2 18.9142 2.58579C19.5 3.17157 19.5 4.11438 19.5 6V16.5C19.5 17.3284 18.8284 18 18 18" stroke="currentColor" /> <path d="M8 8.5H15.5" stroke="currentColor" strokeLinecap="round" /> <path d="M8 11.5H13" stroke="currentColor" strokeLinecap="round" /> <path d="M8 14.5H15.5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export function FunnelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M3 5H21L13.5 13.5V19L10.5 21V13.5L3 5Z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

export function TargetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" /> <circle cx="12" cy="12" r="6.5" stroke="currentColor" /> <circle cx="12" cy="12" r="3" stroke="currentColor" />
    </svg>
  );
}

export function PlanetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" /> <ellipse cx="12" cy="12" rx="10" ry="3.8" stroke="currentColor" transform="rotate(-24 12 12)" />
    </svg>
  );
}

