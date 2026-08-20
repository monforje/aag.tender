#!/usr/bin/env python3
"""Разворачивает слайс FSD по конвенциям проекта.

    python3 scaffold.py shared/ui Tooltip
    python3 scaffold.py widgets inspector
    python3 scaffold.py entities task
    python3 scaffold.py pages settings
    python3 scaffold.py features task-filter

Скрипт намеренно не выдумывает содержимое: он ставит каркас файлов, JSDoc-шапку
с обязательными разделами и публичный API. Смысл — чтобы структура и шаблон
комментария не зависели от того, помнит ли их человек в этот раз.
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[4] / 'src'

LAYERS_WITH_UI = {'widgets', 'features', 'pages', 'entities'}


def pascal(name: str) -> str:
    return ''.join(p[:1].upper() + p[1:] for p in re.split(r'[-_\s]+', name) if p)


def camel(name: str) -> str:
    p = pascal(name)
    return p[:1].lower() + p[1:]


def kebab(name: str) -> str:
    s = re.sub(r'(?<!^)(?=[A-Z])', '-', name).lower()
    return re.sub(r'[-_\s]+', '-', s)


TSX = '''import {{ cx }} from '@/shared/lib/cx';
import s from './{Comp}.module.css';

interface {Comp}Props {{
  className?: string;
}}

/**
 * TODO: одна строка — что это.
 *
 * КОГДА:  TODO — в каких случаях брать именно его
 * НЕ ДЛЯ: TODO — когда взять другой, со ссылкой на него
 *
 * UX:     TODO — что происходит на hover/focus/active, что анимируется и что
 *         намеренно НЕ анимируется. Ступень заливки — из шкалы состояний
 *         (см. каталог в app/styles/global.css), а не новое значение альфы.
 * A11Y:   TODO — роль, обязательные подписи, поведение с клавиатуры
 *
 * @example
 * <{Comp} />
 */
export function {Comp}({{ className }}: {Comp}Props) {{
  return <div className={{cx(s.{cls}, className)}} />;
}}
'''

CSS = '''/* {Comp}
   TODO: почему компонент устроен именно так. Значения состояний — токены
   --cu-state-* из global.css; свои альфы здесь не заводят.

   Помни про границу модуля: селектор вида `.чужой-класс .этот` не соберётся —
   классы хэшируются помодульно. Состояние приходит пропом-модификатором или
   CSS-переменной от предка. */
.{cls}{{
}}
'''

INDEX_UI = "export {{ {Comp} }} from './{Comp}';\n"
INDEX_SLICE = "export {{ {Comp} }} from './ui/{Comp}';\n"


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 1

    layer, raw_name = sys.argv[1].strip('/'), sys.argv[2]
    comp = pascal(raw_name)
    cls = kebab(raw_name)

    if layer == 'shared/ui':
        base = SRC / 'shared' / 'ui' / comp
        files = {
            base / f'{comp}.tsx': TSX.format(Comp=comp, cls=cls),
            base / f'{comp}.module.css': CSS.format(Comp=comp, cls=cls),
            base / 'index.ts': INDEX_UI.format(Comp=comp),
        }
    elif layer in LAYERS_WITH_UI:
        base = SRC / layer / kebab(raw_name)
        files = {
            base / 'ui' / f'{comp}.tsx': TSX.format(Comp=comp, cls=cls),
            base / 'ui' / f'{comp}.module.css': CSS.format(Comp=comp, cls=cls),
            base / 'index.ts': INDEX_SLICE.format(Comp=comp),
        }
    else:
        print(f'Неизвестный слой: {layer}')
        print('Ожидается: shared/ui | entities | features | widgets | pages')
        return 1

    existing = [f for f in files if f.exists()]
    if existing:
        print('Уже существует, ничего не трогаю:')
        for f in existing:
            print('  ', f.relative_to(SRC.parent))
        return 1

    for path, body in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding='utf-8')
        print('создан', path.relative_to(SRC.parent))

    print()
    print('Дальше по скиллу:')
    print('  1. Заполнить JSDoc — без раздела «НЕ ДЛЯ» через месяц появится дубликат.')
    print('  2. Добавить строку в COMPONENTS.md, иначе компонент не найдут и продублируют.')
    print('  3. bunx tsc --noEmit && bun run build')
    print('  4. python3 .claude/skills/fsd-component/scripts/check_css_modules.py')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
