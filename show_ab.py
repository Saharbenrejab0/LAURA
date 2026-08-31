import os
for f in ['backend/main.py', 'backend/engines/chat.py']:
    if os.path.exists(f):
        c = open(f, encoding='utf-8').read()
        print(f'=== {f} ({len(c.split(chr(10)))} lines) ===')
        print(c)
        print()
