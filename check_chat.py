import inspect
from pathlib import Path

# Show chat.py structure
chat_path = Path("backend/engines/chat.py")
content = chat_path.read_text(encoding="utf-8")
lines = content.split("\n")
print(f"=== chat.py: {len(lines)} lines ===")
print()

# Show imports and key functions
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith(("import ", "from ", "def ", "async def ", "class ", "ANTHROPIC", "CLAUDE", "API", "_LOAS_SCHEMA", "MODEL")):
        print(f"  L{i+1}: {line.rstrip()[:100]}")

print()
print("=== First 5 lines of api/chat.py ===")
api_chat = Path("backend/api/chat.py")
api_lines = api_chat.read_text(encoding="utf-8").split("\n")
for i, line in enumerate(api_lines[:80]):
    stripped = line.strip()
    if stripped.startswith(("import ", "from ", "def ", "async def ", "@router", "ANTHROPIC", "API", "CLIENT")):
        print(f"  L{i+1}: {line.rstrip()[:100]}")
