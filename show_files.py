import os

files = [
    "backend/api/chat.py",
    "backend/engines/chat.py",
    "frontend/src/components/laura/LauraChat.tsx",
    "frontend/src/components/laura/LauraPill.tsx",
]

for f in files:
    if os.path.exists(f):
        content = open(f, encoding="utf-8").read()
        lines = len(content.split("\n"))
        print(f"=== {f} ({lines} lines) ===")
        print(content[:3000])
        print("... [truncated]" if len(content) > 3000 else "")
        print()
    else:
        print(f"=== {f} NOT FOUND ===")
        print()
