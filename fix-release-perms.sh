#!/bin/bash
# Ruta fija (sin comodines) para que sudoers pueda autorizar este comando
# exacto sin permitir wildcards -- lo llama deploy-ui.sh despues de copiar
# cada release nueva a /var/www/intelimarket-ui/releases/<timestamp>.
set -euo pipefail
chown -R intellihouse:www-data /var/www/intelimarket-ui/releases
chmod -R a+rX /var/www/intelimarket-ui/releases
