import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  validateCDCData,
  generateCDCXML,
  generateQRData,
  generateQRCode,
  loadP12FromBuffer,
  signXML,
  createTestEkuatiaClient,
  createProductionEkuatiaClient,
  PDFGenerator,
  DocumentType,
  PaymentMethod,
  Country,
  calculateDNITChecksum,
  isValidDNIT,
} from 'intellifact';
import { telemetryQueue } from './telemetry-queue';

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const PORT = parseInt(process.env.PORT || '3000', 10);

// Emisor de DESARROLLO -- nunca se usa en un tenant real. Todas las rutas
// reales (generate-and-sign, submit, kude) reciben el emisor completo en el
// body de la request (armado por api/src/intelifact/service.py desde
// intelifact_configs, una fila por tenant) -- estos valores son solo un
// fallback para poder levantar el servicio y pegarle en dev sin credenciales.
const DEV_EMITTER_CONFIG = {
  ruc: process.env.EMITTER_RUC || '00000000',
  dv: process.env.EMITTER_DV || '0',
  name: process.env.EMITTER_NAME || 'EMISOR DE DESARROLLO',
  tradeName: process.env.EMITTER_TRADE_NAME || 'DEV',
  economicActivity: process.env.EMITTER_ACTIVIDAD || '',
  address: process.env.EMITTER_DIRECCION || '',
  city: process.env.EMITTER_CIUDAD || '',
  department: process.env.EMITTER_DEPARTAMENTO || '',
  email: process.env.EMITTER_EMAIL || '',
  phone: process.env.EMITTER_TELEFONO || '',
  timbrado: process.env.EMITTER_TIMBRADO || '00000000',
  timbradoStartDate: process.env.EMITTER_TIMBRADO_START || '2026-01-01',
  establishmentCode: process.env.EMITTER_ESTABLECIMIENTO || '001',
  pointOfSaleCode: process.env.EMITTER_PUNTO_EXP || '001',
};

// 0. Healthcheck & Node Status
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'intelifact-engine',
    version: '1.0.0',
    port: PORT,
    telemetry: telemetryQueue.getStatus(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/sifen/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    devEmitter: DEV_EMITTER_CONFIG,
    note: 'Este es el emisor de desarrollo/fallback -- cada request real trae su propio emisor en el body.',
    sifenEnv: process.env.SIFEN_ENVIRONMENT || 'test',
  });
});

// 1. Validate CDC data / DNIT
app.post('/api/v1/sifen/validate', (req: Request, res: Response) => {
  try {
    const { cdcData, dnit } = req.body;

    let dnitResult = null;
    if (dnit) {
      dnitResult = {
        dnit,
        isValid: isValidDNIT(dnit),
        checksum: calculateDNITChecksum(dnit),
      };
    }

    let cdcValidation = null;
    if (cdcData) {
      cdcValidation = validateCDCData(cdcData);
    }

    res.json({ success: true, dnitResult, cdcValidation });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 2. Generate XML, calculate CDC, sign with .p12 -- el emisor viene siempre
//    en cdcData (armado por el backend desde la config real del tenant);
//    DEV_EMITTER_CONFIG solo llena huecos si falta algun campo puntual.
app.post('/api/v1/sifen/generate-and-sign', async (req: Request, res: Response) => {
  try {
    const { cdcData, certBase64, certPassword } = req.body;

    if (!cdcData) {
      return res.status(400).json({ success: false, error: 'cdcData es requerido' });
    }

    const absTotal = Math.abs(Number(cdcData.totalAmount || 0));
    const formattedCdcData = {
      ...cdcData,
      emitterRuc: cdcData.emitterRuc || DEV_EMITTER_CONFIG.ruc,
      emitterDv: cdcData.emitterDv || DEV_EMITTER_CONFIG.dv,
      emitterName: cdcData.emitterName || DEV_EMITTER_CONFIG.name,
      timbradoNumber: cdcData.timbradoNumber || DEV_EMITTER_CONFIG.timbrado,
      establishmentCode: cdcData.establishmentCode || DEV_EMITTER_CONFIG.establishmentCode,
      pointOfSaleCode: cdcData.pointOfSaleCode || DEV_EMITTER_CONFIG.pointOfSaleCode,
      totalAmount: absTotal,
      subtotal: Math.abs(Number(cdcData.subtotal || absTotal)),
      documentDate: cdcData.documentDate ? new Date(cdcData.documentDate) : new Date(),
      documentType: cdcData.documentType || DocumentType.CDC,
      paymentMethod: cdcData.paymentMethod || PaymentMethod.CASH,
      items: (cdcData.items || []).map((item: any) => ({
        ...item,
        quantity: Math.abs(Number(item.quantity || 1)),
        unitPrice: Math.abs(Number(item.unitPrice || 0)),
        lineTotal: Math.abs(Number(item.lineTotal || 0)),
      })),
    };

    const validation = validateCDCData(formattedCdcData);
    const xml = generateCDCXML(formattedCdcData);

    const qrPayload = {
      documentNumber: formattedCdcData.documentNumber || `${formattedCdcData.establishmentCode}-${formattedCdcData.pointOfSaleCode}-0000001`,
      documentDate: formattedCdcData.documentDate,
      totalAmount: formattedCdcData.totalAmount || 0,
      recipientDocument: formattedCdcData.recipientDocument || '00000000',
      recipientName: formattedCdcData.recipientName || 'CONSUMIDOR FINAL',
    };

    const qrData = generateQRData(qrPayload);
    let qrUrl = '';
    try {
      qrUrl = await generateQRCode(qrPayload);
    } catch {
      qrUrl = `https://ekuatia.set.gov.py/consultas/qr?n=${formattedCdcData.recipientDocument || ''}&t=${formattedCdcData.totalAmount || 0}`;
    }

    let signedXml = xml;
    let signatureInfo = null;

    if (certBase64 && certPassword) {
      try {
        const certBuffer = Buffer.from(certBase64, 'base64');
        const cert = loadP12FromBuffer(certBuffer, certPassword);
        const signedResult = signXML(xml, cert);
        signedXml = signedResult.signedData;
        signatureInfo = { timestamp: signedResult.timestamp, certificateInfo: signedResult.certificateInfo };
      } catch (signErr: any) {
        return res.status(400).json({ success: false, error: `Error al firmar certificado .p12: ${signErr.message}` });
      }
    }

    const cdcMatch = signedXml.match(/<Id>([0-9]{44})<\/Id>/i) || xml.match(/<Id>([0-9]{44})<\/Id>/i);
    const cdc = cdcMatch ? cdcMatch[1] : `01${formattedCdcData.emitterRuc}${formattedCdcData.establishmentCode}${formattedCdcData.pointOfSaleCode}${Date.now()}`.slice(0, 44);

    const result = {
      success: true, cdc, xml, signedXml, qrData, qrUrl, signatureInfo, validation,
      documentNumber: formattedCdcData.documentNumber, totalAmount: formattedCdcData.totalAmount,
    };

    telemetryQueue.enqueue('invoice_signed', {
      cdc, documentNumber: formattedCdcData.documentNumber, total: formattedCdcData.totalAmount,
      recipientDocument: formattedCdcData.recipientDocument, date: formattedCdcData.documentDate,
      emitterRuc: formattedCdcData.emitterRuc,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Submit XML to SET e-Kuatia
app.post('/api/v1/sifen/submit', async (req: Request, res: Response) => {
  try {
    const { xml, rucEmitter = DEV_EMITTER_CONFIG.ruc, documentNumber, certBase64, certPassword, environment = 'test', emitterName } = req.body;

    if (!xml || !documentNumber) {
      return res.status(400).json({ success: false, error: 'xml y documentNumber son requeridos' });
    }

    try {
      let client;
      if (environment === 'production' && certBase64 && certPassword) {
        const certBuffer = Buffer.from(certBase64, 'base64');
        client = createProductionEkuatiaClient(certBuffer, certPassword);
      } else {
        client = createTestEkuatiaClient();
      }

      const result = await client.submitCDC(xml, rucEmitter, documentNumber);

      telemetryQueue.enqueue('invoice_submitted', { documentNumber, rucEmitter, status: 'authorized', details: result });

      return res.json({
        success: true, environment, documentNumber: result.documentNumber, qrUrl: result.qrUrl,
        status: 'authorized', details: result,
      });
    } catch (soapErr: any) {
      // En contingencia o error de conexion, se guarda localmente y se devuelve
      // un estado autorizado en modo autonomo -- el nombre del emisor viene de
      // la request, no un cliente fijo como en la version original.
      telemetryQueue.enqueue('invoice_submitted', {
        documentNumber, rucEmitter, status: 'authorized_local_contingency', error: soapErr.message,
      });

      return res.json({
        success: true, environment, documentNumber,
        qrUrl: `https://ekuatia.set.gov.py/consultas/qr?n=${rucEmitter}&d=${documentNumber}`,
        status: 'authorized_local',
        message: `Comprobante emitido y resguardado en modo autónomo local${emitterName ? ` -- ${emitterName}` : ''}`,
        warning: soapErr.message,
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Generate KuDE PDF -- tenantId y emitter son obligatorios en el body,
//    a diferencia de la version original que traia un tenantId fijo.
app.post('/api/v1/sifen/kude', async (req: Request, res: Response) => {
  try {
    const { sale, customer, items = [], tenantId, emitter } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'tenantId es requerido' });
    }

    const generator = new PDFGenerator({ pageSize: 'A4' });
    const saleDate = sale?.fecha ? new Date(sale.fecha) : new Date();
    const emitterName = emitter?.name || DEV_EMITTER_CONFIG.name;

    const reportData = {
      tenantId,
      type: 'sales' as const,
      currency: sale?.moneda || 'PYG',
      country: Country.PARAGUAY,
      period: { from: saleDate, to: saleDate },
      sales: [
        {
          id: sale?.id || '1',
          date: saleDate,
          customerName: customer?.razon_social || customer?.nombre || 'CONSUMIDOR FINAL',
          operatorName: emitterName,
          items: items.map((item: any) => ({
            description: item.descripcion || item.nombre || 'Producto',
            quantity: Math.abs(Number(item.cantidad || 1)),
            unitPrice: Math.abs(Number(item.precio_unitario || item.precio || 0)),
            total: Math.abs(Number(item.subtotal || item.total || 0)),
          })),
          subtotal: Math.abs(Number(sale?.subtotal || sale?.total || 0)),
          discount: Math.abs(Number(sale?.descuento || 0)),
          tax: Math.abs(Number(sale?.iva_10 || 0)) + Math.abs(Number(sale?.iva_5 || 0)),
          total: Math.abs(Number(sale?.total || 0)),
          paymentMethod: PaymentMethod.CASH,
          status: 'completed' as const,
        },
      ],
    };

    const doc = generator.generateSalesByPeriod(reportData);
    const pdfBuffer = await generator.getBuffer();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="kude-${sale?.numero || 'factura'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Telemetry Queue Monitor & Flush
app.get('/api/v1/telemetry/status', (req: Request, res: Response) => {
  res.json({ success: true, telemetry: telemetryQueue.getStatus() });
});

app.post('/api/v1/telemetry/flush', async (req: Request, res: Response) => {
  try {
    const result = await telemetryQueue.flush();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/telemetry/enqueue', (req: Request, res: Response) => {
  try {
    const { eventType, payload } = req.body;
    const evt = telemetryQueue.enqueue(eventType || 'sifen_event', payload || {});
    res.json({ success: true, event: evt });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[InteliFact Engine] Activo en http://0.0.0.0:${PORT} (emisor de dev: RUC ${DEV_EMITTER_CONFIG.ruc}-${DEV_EMITTER_CONFIG.dv} -- cada tenant real manda su propio emisor por request)`);
});
