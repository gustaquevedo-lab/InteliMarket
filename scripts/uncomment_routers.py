with open(r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\api\src\main.py', encoding='utf-8') as f:
    content = f.read()

# Uncomment all the TODO lines
new_content = content.replace('  # TODO: fix import errors', '')
with open(r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\api\src\main.py', 'w', encoding='utf-8') as f:
    f.write(new_content)

# Count remaining commented lines
remaining = new_content.count('# TODO: fix import errors')
print(f'Remaining TODO comments: {remaining}')
print(f'Uncommented successfully')
