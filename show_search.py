content = open('backend/api/templates.py', encoding='utf-8').read()
# Show the search endpoint specifically
lines = content.split('\n')
for i, line in enumerate(lines):
    if 'def ' in line or '@router' in line or 'search' in line.lower():
        start = max(0, i-1)
        end = min(len(lines), i+30)
        print(f'--- Line {i+1} ---')
        for j in range(start, end):
            print(f'  {j+1}: {lines[j]}')
        print()
