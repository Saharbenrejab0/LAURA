import os

files = [
    "frontend/src/components/CreationChooser.tsx",
    "frontend/src/app/loa/[id]/page.tsx",
]

for f in files:
    if os.path.exists(f):
        content = open(f, encoding='utf-8').read()
        lines = len(content.split('\n'))
        print(f'=== {f} ({lines} lines) ===')
        print(content[:4000])
        print('... [truncated]' if len(content) > 4000 else '')
        print()
