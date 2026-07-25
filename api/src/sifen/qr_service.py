import io
import base64
import qrcode
from fastapi.responses import StreamingResponse

SIFEN_VERIFICATION_URL = "https://ekuatia.set.gov.py/verificacion"


def generate_qr_image(cdc: str, size: int = 256) -> bytes:
    verification_url = f"{SIFEN_VERIFICATION_URL}/{cdc}"

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(verification_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img = img.resize((size, size))

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def generate_qr_base64(cdc: str, size: int = 256) -> str:
    image_bytes = generate_qr_image(cdc, size)
    return base64.b64encode(image_bytes).decode("utf-8")


def create_qr_response(cdc: str, size: int = 256) -> StreamingResponse:
    image_bytes = generate_qr_image(cdc, size)
    return StreamingResponse(
        io.BytesIO(image_bytes),
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename=qr_{cdc[:12]}.png"},
    )
