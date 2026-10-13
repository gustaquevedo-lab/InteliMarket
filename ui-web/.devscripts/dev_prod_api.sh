#!/bin/bash
export VITE_API_PROXY_TARGET="http://100.83.91.76:8000"
exec npm --prefix "/Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/ui-web" run dev -- --port 5180
