#!/usr/bin/env bash
#
# Pone techo a los logs y deja andando el guardia de disco.
#
# El 08-09-2026 el disco llego a 100% por 16 GB de logs y Postgres se cayo: el
# local dejo de vender. La causa de fondo no fue la falta de un aviso, fue que
# NADA tenia un limite. Esto pone los limites.
#
# No reinicia Postgres ni el API. Solo toca configuracion de logs.
#
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: correr con sudo." >&2
    exit 1
fi

echo "==> 1/4 Techo al journal (500 MB, antes sin limite explicito)..."
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/99-intelimarket.conf <<'CONF'
# Sin esto el journal crece hasta el 10% del disco. Con 48 GB son ~4,8 GB
# dedicados a logs que casi nunca se leen.
[Journal]
SystemMaxUse=500M
SystemMaxFileSize=100M
CONF
systemctl restart systemd-journald
journalctl --vacuum-size=500M >/dev/null 2>&1 || true
echo "    journal limitado a 500M."

echo "==> 2/4 Techo por TAMANO al syslog (antes solo rotaba por dia)..."
# El problema del 08-09 fue justamente este: rotaba una vez por dia, y en un dia
# syslog llego a 9,3 GB. Con "size 200M" rota por tamano ademas de por fecha.
RS=/etc/logrotate.d/rsyslog
if [ -f "$RS" ]; then
    cp "$RS" "${RS}.bak-$(date +%Y%m%d)"
    if grep -qE '^[[:space:]]*size ' "$RS"; then
        echo "    ya tenia limite por tamano, no se toca."
    else
        awk 'NR==FNR{next}1' /dev/null "$RS" > /tmp/rs.new
        sed -i '0,/{/s//{\n\tsize 200M\n\tmaxage 7/' /tmp/rs.new
        mv /tmp/rs.new "$RS"
        chmod 644 "$RS"
        echo "    logrotate: rota tambien al llegar a 200M, guarda 7 dias."
    fi
    logrotate -d "$RS" >/dev/null 2>&1 && echo "    configuracion de logrotate valida." \
        || echo "    AVISO: logrotate reporta un problema, revisar $RS (hay copia .bak)."
else
    echo "    aviso: no existe $RS, se omite."
fi

echo "==> 3/4 Instalando el guardia de disco (cada 15 min)..."
install -m 755 /home/intellihouse/guard_disco.sh /usr/local/sbin/guard_disco.sh
cat > /etc/cron.d/intelimarket-guard-disco <<'CRON'
# Guardia de disco: deja constancia al 80% y recorta logs al 90%, para que el
# disco lleno no vuelva a tumbar Postgres y dejar al local sin vender.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/15 * * * * root /usr/local/sbin/guard_disco.sh
CRON
chmod 644 /etc/cron.d/intelimarket-guard-disco
touch /var/log/guard-disco.log
echo "    instalado."

echo "==> 4/4 Prueba real (se baja el umbral para forzar una pasada)..."
sed 's/^AVISO=80/AVISO=0/' /usr/local/sbin/guard_disco.sh > /tmp/guard_prueba.sh
bash /tmp/guard_prueba.sh
rm -f /tmp/guard_prueba.sh

echo
echo "============================================================"
echo " LISTO. Estado actual:"
echo "============================================================"
df -h / | tail -1
echo
echo "Journal:  $(journalctl --disk-usage 2>/dev/null | sed 's/^Archived and active journals take up //')"
echo
echo "Ultimas lineas del guardia:"
tail -6 /var/log/guard-disco.log
