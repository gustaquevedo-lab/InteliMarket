import re

content = open("/app/api/seed_supermer.py").read()

# Replace $3 for created_at fields with NOW() when it's the 3rd param and we removed it
# Pattern: VALUES (..., $3) with only 2 params
content = re.sub(r", true, \$3\)(?=\s*\n\s+\"\"\", [A-Z_]+)", ", true, NOW())", content)
content = re.sub(r", true, \$3\)(?=\s*\n\s+\"\"\", uid)", ", true, NOW())", content)

# Also fix any remaining $3 patterns where it's used as created_at/updated_at
content = content.replace(", $3)", ", NOW())")

# Fix the user_tenant created_at
content = re.sub(r"\$3\)", "NOW())", content)

open("/app/api/seed_supermer.py", "w").write(content)
print("Done round 2")
