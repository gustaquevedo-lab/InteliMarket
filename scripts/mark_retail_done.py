import re

with open('ROADMAP_VERTICALS.html', 'r', encoding='utf-8') as f:
    html = f.read()

retail_ids = ['retail-f0-dashboard', 'retail-f0-pos-rapido',
              'retail-f1-cliente-rapido', 'retail-f1-cupones-digitales',
              'retail-f2-whatsapp-local', 'retail-f2-eventos-locales',
              'retail-f3-tienda-online']

total_added = 0
for rid in retail_ids:
    pattern = r'(\bid: "' + rid + r'",[\s\S]*?tasks: \[)([\s\S]*?)(\],)'
    m = re.search(pattern, html)
    if not m:
        print('  NOT FOUND: ' + rid)
        continue
    pre, tasks, post = m.group(1), m.group(2), m.group(3)
    new_tasks_lines = []
    added = 0
    for line in tasks.split('\n'):
        stripped = line.lstrip()
        if stripped.startswith('"') and not stripped.startswith('"✅') and not stripped.startswith('"🔄'):
            new_line = line.replace('"', '"✅ ', 1)
            new_tasks_lines.append(new_line)
            added += 1
        else:
            new_tasks_lines.append(line)
    new_tasks = '\n'.join(new_tasks_lines)
    html = html[:m.start()] + pre + new_tasks + post + html[m.end():]
    print('  ' + rid + ': +' + str(added) + ' tasks marked')
    total_added += added

print('Total: ' + str(total_added) + ' tasks marked done')

with open('ROADMAP_VERTICALS.html', 'w', encoding='utf-8') as f:
    f.write(html)
