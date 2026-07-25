import os
for pid in os.listdir('/proc'):
    if pid.isdigit():
        try:
            with open(f'/proc/{pid}/comm') as f:
                comm = f.read().strip()
            with open(f'/proc/{pid}/cmdline', 'rb') as f:
                cmdline = f.read().decode('utf-8', errors='ignore').replace('\x00', ' ').strip()
            print(f'PID {pid}: {comm} | {cmdline[:200]}')
        except Exception as e:
            print(f'PID {pid}: error {e}')
