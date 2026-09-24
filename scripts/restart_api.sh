#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "🔄 [1/4] Terminando procesos anteriores en puerto 8000..."
fuser -k 8000/tcp 2>/dev/null || true
pkill -9 -f "uvicorn api.src.main:app" 2>/dev/null || true
sleep 1.5

echo "🔍 [2/4] Verificando que el puerto 8000 esté libre..."
while fuser 8000/tcp 2>/dev/null; do
    echo "Esperando liberación del puerto 8000..."
    fuser -k 8000/tcp 2>/dev/null || true
    sleep 1
done

echo "🚀 [3/4] Iniciando Uvicorn en 0.0.0.0:8000..."
PYTHONPATH=. nohup "$DIR/.venv/bin/uvicorn" api.src.main:app --host 0.0.0.0 --port 8000 --workers 1 > /tmp/api.log 2>&1 &
PID=$!

sleep 3

echo "✅ [4/4] Verificando salud del servidor..."
if ps -p $PID > /dev/null; then
    echo "API Uvicorn corriendo exitosamente con PID $PID"
else
    echo "❌ Error al iniciar Uvicorn. Últimos logs de /tmp/api.log:"
    tail -n 20 /tmp/api.log
    exit 1
fi
