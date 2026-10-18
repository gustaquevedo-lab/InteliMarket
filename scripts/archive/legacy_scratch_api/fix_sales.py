import re
content = open('/app/api/seed_supermer.py').read()
content = re.sub(r', Decimal\("(\d+)"\), Decimal\("\1"\), USER_OP1\)', ', USER_OP1)', content)
open('/app/api/seed_supermer.py', 'w').write(content)
print('USERS_OP1 count: {}'.format(content.count('USER_OP1')))
