#!/bin/sh
pip install 'bcrypt<4.1' -q 2>/dev/null
exec uvicorn api.src.main:app --host 0.0.0.0 --port 8000 --log-level info
