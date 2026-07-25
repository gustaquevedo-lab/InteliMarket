import re
with open(r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\api\src\supermer\models.py', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'\n\n# Aliases expected by supermer service_\*\.py\nAuditTemplate = StoreAuditTemplate\nAuditTemplateItem = StoreAuditTemplateItem\nAuditExecution = StoreAuditExecution\nAuditAnswer = StoreAuditAnswer\nMaintenanceSchedule = EquipmentMaintenanceSchedule\nWorkOrder = EquipmentWorkOrder'
matches = re.findall(pattern, content)
print('Found blocks:', len(matches))
content = re.sub(pattern, '', content)
print('New length:', len(content.split('\n')))

with open(r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\api\src\supermer\models.py', 'w', encoding='utf-8') as f:
    f.write(content)

# Add aliases at the end
with open(r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\api\src\supermer\models.py', 'a', encoding='utf-8') as f:
    f.write('\n\n# Aliases expected by supermer service_*.py\n')
    f.write('AuditTemplate = StoreAuditTemplate\n')
    f.write('AuditTemplateItem = StoreAuditTemplateItem\n')
    f.write('AuditExecution = StoreAuditExecution\n')
    f.write('AuditAnswer = StoreAuditAnswer\n')
    f.write('MaintenanceSchedule = EquipmentMaintenanceSchedule\n')
    f.write('WorkOrder = EquipmentWorkOrder\n')

print('Done')
