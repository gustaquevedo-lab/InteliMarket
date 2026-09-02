import fs from 'fs';
import path from 'path';

export interface TelemetryEvent {
  id: string;
  eventType: 'invoice_created' | 'invoice_signed' | 'invoice_submitted' | 'credit_note_created' | 'sifen_event';
  timestamp: string;
  payload: any;
  status: 'pending' | 'sent' | 'failed';
  retryCount: number;
  lastAttempt?: string;
  lastError?: string;
}

export class ResilientTelemetryQueue {
  private queueFile: string;
  private targetEndpoint: string;
  private isFlushing: boolean = false;
  private flushIntervalMs: number = 5000;
  private timer: NodeJS.Timeout | null = null;

  constructor(storageDir: string = '/tmp/intelifact-telemetry', endpoint: string = process.env.TELEMETRY_ENDPOINT || 'http://dev-server/api/v1/telemetry/ingest') {
    if (!fs.existsSync(storageDir)) {
      try {
        fs.mkdirSync(storageDir, { recursive: true });
      } catch {
        storageDir = path.join(process.cwd(), '.telemetry');
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
      }
    }
    this.queueFile = path.join(storageDir, 'events_queue.json');
    this.targetEndpoint = endpoint;
    this.startWorker();
  }

  private readQueue(): TelemetryEvent[] {
    try {
      if (!fs.existsSync(this.queueFile)) return [];
      const content = fs.readFileSync(this.queueFile, 'utf-8');
      return JSON.parse(content || '[]');
    } catch {
      return [];
    }
  }

  private writeQueue(events: TelemetryEvent[]): void {
    try {
      fs.writeFileSync(this.queueFile, JSON.stringify(events, null, 2), 'utf-8');
    } catch (e) {
      console.error('[TelemetryQueue] Error writing queue file:', e);
    }
  }

  public enqueue(eventType: TelemetryEvent['eventType'], payload: any): TelemetryEvent {
    const event: TelemetryEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      eventType,
      timestamp: new Date().toISOString(),
      payload,
      status: 'pending',
      retryCount: 0,
    };

    const queue = this.readQueue();
    queue.push(event);
    this.writeQueue(queue);

    setImmediate(() => this.flush());
    return event;
  }

  public async flush(): Promise<{ processed: number; sent: number; pending: number }> {
    if (this.isFlushing) {
      const queue = this.readQueue();
      return { processed: 0, sent: 0, pending: queue.filter(e => e.status === 'pending').length };
    }

    this.isFlushing = true;
    let sentCount = 0;
    const queue = this.readQueue();
    const pendingEvents = queue.filter(e => e.status === 'pending');

    for (const evt of pendingEvents) {
      try {
        evt.lastAttempt = new Date().toISOString();
        evt.retryCount += 1;

        // El RUC del emisor viaja dentro del payload de cada evento (armado
        // por el backend desde la config real del tenant) en vez de un header
        // fijo -- asi un mismo microservicio puede eventualmente procesar
        // eventos de mas de un tenant sin mezclar identidades.
        const emitterRuc = evt.payload?.emitterRuc || evt.payload?.rucEmitter || 'desconocido';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(this.targetEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Source-Node': 'intelifact-engine',
            'X-Company-RUC': emitterRuc,
          },
          body: JSON.stringify(evt),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          evt.status = 'sent';
          sentCount++;
        } else {
          evt.lastError = `HTTP ${response.status}: ${response.statusText}`;
        }
      } catch (err: any) {
        evt.lastError = err.message || 'Network unreachable';
      }
    }

    const remainingSent = queue.filter(e => e.status === 'sent').slice(-200);
    const remainingPending = queue.filter(e => e.status === 'pending');
    this.writeQueue([...remainingPending, ...remainingSent]);

    this.isFlushing = false;
    return { processed: pendingEvents.length, sent: sentCount, pending: remainingPending.length };
  }

  public getStatus() {
    const queue = this.readQueue();
    const pending = queue.filter(e => e.status === 'pending').length;
    const sent = queue.filter(e => e.status === 'sent').length;
    return {
      endpoint: this.targetEndpoint,
      queueFilePath: this.queueFile,
      pendingEvents: pending,
      sentEvents: sent,
      totalEvents: queue.length,
      recentEvents: queue.slice(-10),
    };
  }

  public startWorker() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.flush().catch(() => {});
    }, this.flushIntervalMs);
  }

  public stopWorker() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const telemetryQueue = new ResilientTelemetryQueue();
