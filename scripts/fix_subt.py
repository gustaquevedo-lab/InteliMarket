with open('/app/api/src/servicios/models.py') as f:
    s = f.read()
# Remove the explicit name mapping in Column declarations
s = s.replace('Column("subt_mano_obra",', 'Column(')
s = s.replace('Column("subt_materiales",', 'Column(')
s = s.replace('Column("subt_productos",', 'Column(')
s = s.replace('Column("subtmano_obra",', 'Column(')
with open('/app/api/src/servicios/models.py', 'w') as f:
    f.write(s)
print('After:')
print('subtmano_obra count:', s.count('subtmano_obra'))
print('subt_mano_obra in Column() count:', s.count('subt_mano_obra'))
