import os
for f in ["backend/api/templates.py"]:
    if os.path.exists(f):
        content = open(f, encoding='utf-8').read()
        print(f'=== {f} ({len(content.split(chr(10)))} lines) ===')
        print(content[:3000])
        print('...[truncated]' if len(content) > 3000 else '')
