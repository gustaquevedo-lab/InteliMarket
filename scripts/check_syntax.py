import ast
with open(r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\api\src\supermer\models.py', encoding='utf-8') as f:
    content = f.read()
try:
    ast.parse(content)
    print('SYNTAX OK')
except SyntaxError as e:
    print('SYNTAX ERROR:', e)
    lines = content.split('\n')
    if e.lineno:
        for i in range(max(0, e.lineno-3), min(len(lines), e.lineno+3)):
            print(f'  {i+1}: {lines[i]}')
