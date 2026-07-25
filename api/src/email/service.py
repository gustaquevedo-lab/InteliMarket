"""Email service for sending receipts and notifications"""

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from typing import Optional

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@intelimarket.py")


def _get_smtp():
    if not SMTP_HOST or not SMTP_USER:
        return None
    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    server.starttls()
    server.login(SMTP_USER, SMTP_PASSWORD)
    return server


def send_raw_email(to_email: str, subject: str, body_html: str) -> bool:
    if not SMTP_HOST:
        return False
    try:
        msg = MIMEText(body_html, "html")
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg["Subject"] = subject
        server = _get_smtp()
        if not server:
            return False
        server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        server.quit()
        return True
    except Exception:
        return False


def send_receipt_email(
    to_email: str,
    customer_name: str,
    sale_number: str,
    total: float,
    pdf_bytes: Optional[bytes] = None,
    company_name: str = "InteliMarket",
) -> bool:
    if not SMTP_HOST:
        return False
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg["Subject"] = f"Comprobante de venta {sale_number} - {company_name}"

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h2>¡Gracias por tu compra!</h2>
            <p>Hola <strong>{customer_name}</strong>,</p>
            <p>Adjuntamos el comprobante de tu venta <strong>#{sale_number}</strong>.</p>
            <p><strong>Total:</strong> Gs. {total:,.0f}</p>
            <p>Si tenés alguna consulta, no dudes en contactarnos.</p>
            <br>
            <p style="color: #666; font-size: 12px;">Este correo fue enviado automáticamente por {company_name}.</p>
        </body>
        </html>
        """
        msg.attach(MIMEText(body, "html"))

        if pdf_bytes:
            attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
            attachment.add_header("Content-Disposition", f"attachment; filename=comprobante_{sale_number}.pdf")
            msg.attach(attachment)

        server = _get_smtp()
        if not server:
            return False
        server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        server.quit()
        return True
    except Exception:
        return False


def is_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)
