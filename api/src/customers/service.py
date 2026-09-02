"""Customer service"""

from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.customers.models import Customer
from api.src.customers.schemas import CustomerCreate, CustomerUpdate




async def get_customer(db: AsyncSession, customer_id: str) -> Customer | None:
    import uuid
    result = await db.execute(select(Customer).where(Customer.id == uuid.UUID(customer_id)))
    return result.scalar_one_or_none()


async def get_customer_by_ruc(db: AsyncSession, company_id: str, ruc: str) -> Customer | None:
    result = await db.execute(
        select(Customer).where(Customer.company_id == company_id, Customer.ruc == ruc)
    )
    return result.scalar_one_or_none()


async def list_customers(
    db: AsyncSession,
    company_id: str,
    search: str | None = None,
    activo: bool | None = None,
    tipo: str | None = None,
    exclude_proveedores: bool = False,
    limit: int = 10000,
    offset: int = 0,
) -> list[Customer]:
    query = select(Customer).where(Customer.company_id == company_id)
    if search:
        search_terms = search.strip().split()
        # El numero de socio Extra Club se guarda con formato UUID
        # (con guiones), pero la tarjeta fisica/lector de QR a veces entrega
        # el mismo valor SIN guiones (el formato crudo de 32 caracteres que
        # usa el legacy antes de que nuestro sync le agregue el formato
        # UUID) -- una comparacion de texto literal nunca matchea eso.
        # func.replace(..., '-', '') compara ignorando los guiones de ambos
        # lados, sin afectar el resto de los campos (ruc/ci/telefono/nombre).
        def _term_conditions(term: str):
            term_sin_guiones = term.replace("-", "")
            return (
                (Customer.razon_social.ilike(f"%{term}%")) |
                (Customer.ruc.ilike(f"%{term}%")) |
                (Customer.ci.ilike(f"%{term}%")) |
                (Customer.telefono.ilike(f"%{term}%")) |
                (Customer.extra_club_numero.ilike(f"%{term}%")) |
                (func.replace(Customer.extra_club_numero, "-", "").ilike(f"%{term_sin_guiones}%"))
            )
        if len(search_terms) == 1:
            query = query.where(_term_conditions(search_terms[0]))
        elif len(search_terms) > 1:
            term_conditions = [_term_conditions(term) for term in search_terms]
            query = query.where(and_(*term_conditions))
    if activo is not None:
        query = query.where(Customer.activo == activo)
    if tipo:
        query = query.where(Customer.tipo == tipo)
    elif exclude_proveedores:
        query = query.where(or_(Customer.tipo != "proveedor", Customer.tipo.is_(None)))
    query = query.order_by(Customer.razon_social.asc().nulls_last()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_customer(db: AsyncSession, data: CustomerCreate) -> Customer:
    data_dict = data.model_dump()
    from decimal import Decimal
    # Asegurar sincronización de ambos campos de límite
    limite = None
    if data_dict.get("credito_limite") is not None and Decimal(str(data_dict["credito_limite"])) > 0:
        limite = Decimal(str(data_dict["credito_limite"]))
    elif data_dict.get("limite_credito") is not None and Decimal(str(data_dict["limite_credito"])) > 0:
        limite = Decimal(str(data_dict["limite_credito"]))
    if limite is not None:
        data_dict["credito_limite"] = limite
        data_dict["limite_credito"] = limite

    customer = Customer(**data_dict)
    db.add(customer)
    await db.flush()
    await db.refresh(customer)

    # Si se creó con crédito, registrar también en credit_accounts
    if limite is not None and limite > 0:
        from api.src.credit_accounts.models import CreditAccount
        db.add(CreditAccount(
            company_id=customer.company_id,
            customer_id=customer.id,
            limite_credito=limite,
            saldo_disponible=limite,
            saldo_utilizado=Decimal("0"),
            activo=customer.activo,
        ))
        await db.flush()

    return customer


async def update_customer(db: AsyncSession, customer_id: str, data: CustomerUpdate) -> Customer | None:
    customer = await get_customer(db, customer_id)
    if not customer:
        return None
    from decimal import Decimal
    update_data = data.model_dump(exclude_unset=True)

    # Sincronizar credito_limite y limite_credito si alguno fue enviado
    nuevo_limite = None
    if "credito_limite" in update_data and update_data["credito_limite"] is not None:
        nuevo_limite = Decimal(str(update_data["credito_limite"]))
    elif "limite_credito" in update_data and update_data["limite_credito"] is not None:
        nuevo_limite = Decimal(str(update_data["limite_credito"]))

    if nuevo_limite is not None:
        update_data["credito_limite"] = nuevo_limite
        update_data["limite_credito"] = nuevo_limite

    for key, value in update_data.items():
        setattr(customer, key, value)

    # Sincronizar tabla credit_accounts para que el POS y cuentas de crédito reflejen el cambio
    if nuevo_limite is not None or "activo" in update_data:
        from api.src.credit_accounts.models import CreditAccount
        r = await db.execute(
            select(CreditAccount).where(
                CreditAccount.company_id == customer.company_id,
                CreditAccount.customer_id == customer.id
            )
        )
        ca = r.scalar_one_or_none()
        if ca:
            if nuevo_limite is not None:
                ca.limite_credito = nuevo_limite
                saldo_utilizado = ca.saldo_utilizado or Decimal("0")
                ca.saldo_disponible = nuevo_limite - saldo_utilizado
            if "activo" in update_data:
                ca.activo = update_data["activo"]
        elif nuevo_limite is not None and nuevo_limite > 0:
            db.add(CreditAccount(
                company_id=customer.company_id,
                customer_id=customer.id,
                limite_credito=nuevo_limite,
                saldo_disponible=nuevo_limite,
                saldo_utilizado=Decimal("0"),
                activo=customer.activo if "activo" not in update_data else update_data["activo"],
            ))

    await db.flush()
    await db.refresh(customer)
    return customer


async def delete_customer(db: AsyncSession, customer_id: str) -> bool:
    customer = await get_customer(db, customer_id)
    if not customer:
        return False
    await db.delete(customer)
    await db.flush()
    return True

