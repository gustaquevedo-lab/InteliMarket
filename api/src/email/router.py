"""Email router"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.email import service
from api.src.email.schemas import EmailSend, EmailTestResponse, EmailConfigResponse
from api.src.email.models import EmailLog

router = APIRouter(prefix="/api/v1/email", tags=["email"])


@router.get("/config", response_model=EmailConfigResponse)
async def get_email_config(user=Depends(require_auth)):
    return {
        "configured": service.is_configured(),
        "from_address": service.SMTP_FROM,
        "host": service.SMTP_HOST,
    }


@router.post("/send", response_model=EmailTestResponse)
async def send_email(body: EmailSend, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    if not service.is_configured():
        raise HTTPException(status_code=400, detail="Email no configurado")
    success = service.send_raw_email(body.to_email, body.subject, body.body_html)
    log = EmailLog(
        company_id=user.get("company_id"),
        to_email=body.to_email,
        subject=body.subject,
        tipo=body.tipo,
        referencia_id=body.referencia_id,
        success=success,
        error_message=None if success else "Failed to send",
    )
    db.add(log)
    await db.flush()
    if not success:
        raise HTTPException(status_code=500, detail="No se pudo enviar el correo")
    return {"message": "Correo enviado"}


@router.post("/test", response_model=EmailTestResponse)
async def test_email(to_email: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    if not service.is_configured():
        raise HTTPException(status_code=400, detail="Email no configurado")
    body_html = f"""
    <html><body style="font-family: Arial, sans-serif;">
        <h2>Correo de prueba</h2>
        <p>Este es un correo de prueba desde InteliMarket.</p>
        <p style="color: #666; font-size: 12px;">Enviado el {__import__('datetime').datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
    </body></html>
    """
    success = service.send_raw_email(to_email, "Prueba - InteliMarket", body_html)
    log = EmailLog(
        company_id=user.get("company_id"),
        to_email=to_email,
        subject="Prueba - InteliMarket",
        tipo="test",
        success=success,
        error_message=None if success else "Failed to send",
    )
    db.add(log)
    await db.flush()
    if not success:
        raise HTTPException(status_code=500, detail="No se pudo enviar el correo de prueba")
    return {"message": "Correo de prueba enviado"}
