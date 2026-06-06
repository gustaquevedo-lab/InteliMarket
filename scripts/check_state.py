with open('/app/api/src/servicios/models.py') as f:
    s = f.read()
print('subtmano_obra count:', s.count('subtmano_obra'))
print('subt_mano_obra in Column() count:', s.count('subt_mano_obra'))
