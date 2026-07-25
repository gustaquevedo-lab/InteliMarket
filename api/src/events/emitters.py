from .manager import manager


async def emit_stock_alert(company_id: str, product_id: str, product_name: str, current_stock: int, min_stock: int) -> None:
    await manager.broadcast(company_id, {
        "type": "stock_alert",
        "product_id": product_id,
        "product_name": product_name,
        "current_stock": current_stock,
        "min_stock": min_stock,
        "message": f"Stock bajo: {product_name} ({current_stock} unidades)",
    })


async def emit_sale_completed(company_id: str, sale_id: str, total: float, customer_name: str) -> None:
    await manager.broadcast(company_id, {
        "type": "sale_completed",
        "sale_id": sale_id,
        "total": total,
        "customer_name": customer_name,
        "message": f"Venta #{sale_id[:8]} completada - {total:,.0f} Gs",
    })


async def emit_inventory_update(company_id: str, product_id: str, new_stock: int) -> None:
    await manager.broadcast(company_id, {
        "type": "inventory_update",
        "product_id": product_id,
        "new_stock": new_stock,
    })


async def emit_cash_session_alert(company_id: str, session_id: str, message: str) -> None:
    await manager.broadcast(company_id, {
        "type": "cash_session",
        "session_id": session_id,
        "message": message,
    })
