"""从 Makefile.toml 动态显示项目任务，不列出内置钩子。"""
import os
import re
import shutil
import sys
import tomllib
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COLOR = (
    sys.stdout.isatty()
    and 'NO_COLOR' not in os.environ
    and os.environ.get('TERM') != 'dumb'
    and os.environ.get('CARGO_MAKE_DISABLE_COLOR', '').lower() != 'true'
    and (sys.platform != 'win32' or any(os.environ.get(k) for k in ['WT_SESSION', 'ANSICON', 'TERM']))
)

def paint(text, code):
    return f'\033[{code}m{text}\033[0m' if COLOR else str(text)

def width(text):
    return sum(0 if unicodedata.combining(c) else 2 if unicodedata.east_asian_width(c) in 'WF' else 1 for c in text)

def wrap(text, limit):
    line = ''
    for token in re.findall(r'[!-~]+|\s|[^\x00-\x7f]', text):
        if line and width(line + token) > limit:
            yield line.rstrip()
            line = ''
        if not line:
            token = token.lstrip()
        for char in token:
            if line and width(line + char) > limit:
                yield line.rstrip()
                line = ''
            line += char
    if line:
        yield line.rstrip()

def main():
    data = tomllib.loads((ROOT / 'Makefile.toml').read_text(encoding='utf-8'))
    tasks = data.get('tasks', {})
    rows = [(name, spec) for name, spec in tasks.items() if not spec.get('private') and not spec.get('alias')]
    columns = max(20, min(120, shutil.get_terminal_size((100, 24)).columns))
    label_width = max((width(name) for name, _ in rows), default=0)
    categories = list(dict.fromkeys(['构建', '开发', '测试', '帮助', *(spec.get('category', '其他') for _, spec in rows)]))
    for text, style in [('CAFD 项目任务', '1'), ('跨平台阅读器 · 协议 · 独立验证', '2')]:
        for line in wrap(text, columns):
            print(paint(line, style))
    for category in categories:
        group = [(name, spec) for name, spec in rows if spec.get('category', '其他') == category]
        if not group:
            continue
        print('\n' + paint(category, '1;36'))
        for name, spec in group:
            description = spec.get('description', '')
            if columns < 68:
                print('  ' + paint(name, '1;32'))
                for line in wrap(description, columns - 4):
                    print('    ' + line)
            else:
                lines = list(wrap(description, columns - label_width - 4)) or ['']
                label = name + ' ' * (label_width - width(name))
                print('  ' + paint(label, '1;32') + '  ' + lines[0])
                for line in lines[1:]:
                    print(' ' * (label_width + 4) + line)
    aliases = ['默认 → help' if name == 'default' else f'{name} → {spec["alias"]}' for name, spec in tasks.items() if spec.get('alias') and not spec.get('private')]
    print()
    for line in wrap('别名：' + '；'.join(aliases), columns):
        print(paint(line, '2'))
    print('\n' + paint('常用命令', '1'))
    for command in ['cargo make reader [platform]', 'cargo make reader android --plan', 'cargo make doctor [platform]', 'cargo make test']:
        for line in wrap(command, columns - 2):
            print('  ' + paint(line, '36'))
    print()
    for line in wrap('平台：linux / windows / macos / web / android / ios；省略平台为本机桌面。', columns):
        print(paint(line, '2'))
    for line in wrap('完整原始列表：cargo make --list-all-steps', columns):
        print(paint(line, '2'))

if __name__ == '__main__':
    main()
