#!/usr/bin/env python3
"""Ищет классы, объявленные в CSS-модуле, но не применённые ни одним его
потребителем.

Зачем: CSS Modules хэширует классы помодульно, поэтому селектор, где предок
объявлен в одном модуле, а потомок в другом, не совпадает НИ С ЧЕМ. Ни сборка,
ни типы об этом не сообщат — правило просто молча перестаёт работать. В этом
проекте так дважды ломались тень липкой шапки и проявление контролов сайдбара:
в покое всё выглядело идеально, а состояние по наведению не наступало.

Признак такой поломки: класс присутствует в модуле, но ни один компонент,
импортирующий этот модуль, его не вешает. Тот же признак и у обычного мёртвого
CSS, что тоже стоит знать.

    python3 check_css_modules.py           # весь src
    python3 check_css_modules.py src/widgets

Код возврата 1, если что-то найдено, — удобно для CI.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]


def camel(name: str) -> str:
    parts = re.split(r'[-_]+', name)
    return parts[0] + ''.join(p[:1].upper() + p[1:] for p in parts[1:] if p)


def main() -> int:
    target = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'src')
    modules = sorted(target.rglob('*.module.css'))
    tsx = {f: f.read_text(encoding='utf-8') for f in (ROOT / 'src').rglob('*.tsx')}

    problems = []
    for module in modules:
        css = re.sub(r'/\*.*?\*/', '', module.read_text(encoding='utf-8'), flags=re.S)
        classes = sorted(set(re.findall(r'\.([A-Za-z_][\w-]*)', css)))

        users = [f for f, text in tsx.items()
                 if re.search(r"['\"]\./" + re.escape(module.name) + r"['\"]", text)]
        if not users:
            problems.append((module, '(нет ни одного потребителя)', []))
            continue

        joined = '\n'.join(tsx[f] for f in users)
        orphans = [c for c in classes
                   if not re.search(r'\b' + re.escape(camel(c)) + r'\b', joined)]
        if orphans:
            problems.append((module, '', orphans))

    if not problems:
        print(f'Проверено модулей: {len(modules)}. Осиротевших классов нет.')
        return 0

    print('Классы, объявленные в модуле, но не применённые его потребителями:\n')
    for module, note, orphans in problems:
        rel = module.relative_to(ROOT)
        if note:
            print(f'  {rel}  {note}')
            continue
        print(f'  {rel}')
        for c in orphans:
            print(f'      .{c}')
    print('\nПроверьте каждый: это либо мёртвое правило, либо селектор, ушедший')
    print('в чужой модуль. Во втором случае состояние переносят пропом-модификатором')
    print('или CSS-переменной — см. SKILL.md, шаг 5.')
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
