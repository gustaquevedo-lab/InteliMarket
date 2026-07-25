"""Supermarket seed script — populates all modules with deterministic UUIDs."""

import asyncio
import asyncpg
from datetime import date, datetime, timedelta
from decimal import Decimal

DSN = "postgresql://intelimarket:intelimarket_dev@localhost:5432/intelimarket"

# ── Deterministic UUIDs ──────────────────────────────────────────────
TENANT      = "00000000-0000-0000-0000-000000000001"
COMPANY     = "00000000-0000-0000-0000-000000000010"
USER_SA     = "00000000-0000-0000-0000-000000000020"
USER_OP1    = "00000000-0000-0000-0000-000000000021"
USER_VEND1  = "00000000-0000-0000-0000-000000000022"
USER_VEND2  = "00000000-0000-0000-0000-000000000023"

# Branches
BR_CENTRAL  = "00000000-0000-0000-0000-000000000031"
BR_SUC1     = "00000000-0000-0000-0000-000000000032"
BR_SUC2     = "00000000-0000-0000-0000-000000000033"
BR_SUC3     = "00000000-0000-0000-0000-000000000034"

# Warehouses
WH_CENTRAL  = "00000000-0000-0000-0000-000000000041"
WH_SUC1     = "00000000-0000-0000-0000-000000000042"
WH_SUC2     = "00000000-0000-0000-0000-000000000043"
WH_SUC3     = "00000000-0000-0000-0000-000000000044"
WH_FRIGO   = "00000000-0000-0000-0000-000000000045"

# Categories
CAT_LACTEOS     = "00000000-0000-0000-0000-000000000051"
CAT_BEBIDAS     = "00000000-0000-0000-0000-000000000052"
CAT_LIMPIEZA    = "00000000-0000-0000-0000-000000000053"
CAT_PERSONAL    = "00000000-0000-0000-0000-000000000054"
CAT_CARNES      = "00000000-0000-0000-0000-000000000055"
CAT_PANADERIA   = "00000000-0000-0000-0000-000000000056"
CAT_CONSUMO     = "00000000-0000-0000-0000-000000000057"
CAT_MASCOTAS    = "00000000-0000-0000-0000-000000000058"
CAT_FRESCOS     = "00000000-0000-0000-0000-000000000059"
CAT_MASCOTAS2   = "00000000-0000-0000-0000-00000000005A"

# Products (30+)
P_001 = "00000000-0000-0000-0000-000000000101"
P_002 = "00000000-0000-0000-0000-000000000102"
P_003 = "00000000-0000-0000-0000-000000000103"
P_004 = "00000000-0000-0000-0000-000000000104"
P_005 = "00000000-0000-0000-0000-000000000105"
P_006 = "00000000-0000-0000-0000-000000000106"
P_007 = "00000000-0000-0000-0000-000000000107"
P_008 = "00000000-0000-0000-0000-000000000108"
P_009 = "00000000-0000-0000-0000-000000000109"
P_010 = "00000000-0000-0000-0000-00000000010A"
P_011 = "00000000-0000-0000-0000-00000000010B"
P_012 = "00000000-0000-0000-0000-00000000010C"
P_013 = "00000000-0000-0000-0000-00000000010D"
P_014 = "00000000-0000-0000-0000-00000000010E"
P_015 = "00000000-0000-0000-0000-00000000010F"
P_016 = "00000000-0000-0000-0000-000000000110"
P_017 = "00000000-0000-0000-0000-000000000111"
P_018 = "00000000-0000-0000-0000-000000000112"
P_019 = "00000000-0000-0000-0000-000000000113"
P_020 = "00000000-0000-0000-0000-000000000114"
P_021 = "00000000-0000-0000-0000-000000000115"
P_022 = "00000000-0000-0000-0000-000000000116"
P_023 = "00000000-0000-0000-0000-000000000117"
P_024 = "00000000-0000-0000-0000-000000000118"
P_025 = "00000000-0000-0000-0000-000000000119"
P_026 = "00000000-0000-0000-0000-00000000011A"
P_027 = "00000000-0000-0000-0000-00000000011B"
P_028 = "00000000-0000-0000-0000-00000000011C"
P_029 = "00000000-0000-0000-0000-00000000011D"
P_030 = "00000000-0000-0000-0000-00000000011E"
P_031 = "00000000-0000-0000-0000-00000000011F"
P_032 = "00000000-0000-0000-0000-000000000120"
P_033 = "00000000-0000-0000-0000-000000000121"
P_034 = "00000000-0000-0000-0000-000000000122"
P_035 = "00000000-0000-0000-0000-000000000123"

# Suppliers
SUPP_01 = "00000000-0000-0000-0000-000000000201"
SUPP_02 = "00000000-0000-0000-0000-000000000202"
SUPP_03 = "00000000-0000-0000-0000-000000000203"
SUPP_04 = "00000000-0000-0000-0000-000000000204"
SUPP_05 = "00000000-0000-0000-0000-000000000205"
SUPP_06 = "00000000-0000-0000-0000-000000000206"
SUPP_07 = "00000000-0000-0000-0000-000000000207"
SUPP_08 = "00000000-0000-0000-0000-000000000208"
SUPP_09 = "00000000-0000-0000-0000-000000000209"
SUPP_10 = "00000000-0000-0000-0000-00000000020A"

# Customers
CUST_01 = "00000000-0000-0000-0000-000000000301"
CUST_02 = "00000000-0000-0000-0000-000000000302"
CUST_03 = "00000000-0000-0000-0000-000000000303"
CUST_04 = "00000000-0000-0000-0000-000000000304"
CUST_05 = "00000000-0000-0000-0000-000000000305"
CUST_06 = "00000000-0000-0000-0000-000000000306"
CUST_07 = "00000000-0000-0000-0000-000000000307"
CUST_08 = "00000000-0000-0000-0000-000000000308"
CUST_09 = "00000000-0000-0000-0000-000000000309"
CUST_10 = "00000000-0000-0000-0000-00000000030A"
CUST_11 = "00000000-0000-0000-0000-00000000030B"
CUST_12 = "00000000-0000-0000-0000-00000000030C"
CUST_13 = "00000000-0000-0000-0000-00000000030D"
CUST_14 = "00000000-0000-0000-0000-00000000030E"
CUST_15 = "00000000-0000-0000-0000-00000000030F"
CUST_16 = "00000000-0000-0000-0000-000000000310"
CUST_17 = "00000000-0000-0000-0000-000000000311"
CUST_18 = "00000000-0000-0000-0000-000000000312"

# Payment methods
PM_CASH     = "00000000-0000-0000-0000-000000000401"
PM_CCARD    = "00000000-0000-0000-0000-000000000402"
PM_DCARD    = "00000000-0000-0000-0000-000000000403"
PM_TRANSF   = "00000000-0000-0000-0000-000000000404"
PM_SPI      = "00000000-0000-0000-0000-000000000405"
PM_CREDIT   = "00000000-0000-0000-0000-000000000406"

# Currencies
CUR_PYG = "00000000-0000-0000-0000-000000000501"
CUR_USD = "00000000-0000-0000-0000-000000000502"
CUR_BRL = "00000000-0000-0000-0000-000000000503"

# Exchange rates
ER_001 = "00000000-0000-0000-0000-000000000511"
ER_002 = "00000000-0000-0000-0000-000000000512"

# Sifen timbrados
TIMBRADO = "00000000-0000-0000-0000-000000000601"

# Cash registers
CR_001 = "00000000-0000-0000-0000-000000000701"
CR_002 = "00000000-0000-0000-0000-000000000702"
CR_003 = "00000000-0000-0000-0000-000000000703"
CR_004 = "00000000-0000-0000-0000-000000000704"

# Cash sessions
CS_001 = "00000000-0000-0000-0000-000000000711"

# Sales
SALE_001 = "00000000-0000-0000-0000-000000000801"
SALE_002 = "00000000-0000-0000-0000-000000000802"
SALE_003 = "00000000-0000-0000-0000-000000000803"
SALE_004 = "00000000-0000-0000-0000-000000000804"
SALE_005 = "00000000-0000-0000-0000-000000000805"
SALE_006 = "00000000-0000-0000-0000-000000000806"
SALE_007 = "00000000-0000-0000-0000-000000000807"
SALE_008 = "00000000-0000-0000-0000-000000000808"
SALE_009 = "00000000-0000-0000-0000-000000000809"
SALE_010 = "00000000-0000-0000-0000-00000000080A"
SALE_011 = "00000000-0000-0000-0000-00000000080B"
SALE_012 = "00000000-0000-0000-0000-00000000080C"
SALE_013 = "00000000-0000-0000-0000-00000000080D"
SALE_014 = "00000000-0000-0000-0000-00000000080E"
SALE_015 = "00000000-0000-0000-0000-00000000080F"
SALE_016 = "00000000-0000-0000-0000-000000000810"

# PO
PO_001 = "00000000-0000-0000-0000-000000000901"
PO_002 = "00000000-0000-0000-0000-000000000902"
PO_003 = "00000000-0000-0000-0000-000000000903"
PO_004 = "00000000-0000-0000-0000-000000000904"
PO_005 = "00000000-0000-0000-0000-000000000905"
PO_006 = "00000000-0000-0000-0000-000000000906"
PO_007 = "00000000-0000-0000-0000-000000000907"
PO_008 = "00000000-0000-0000-0000-000000000908"

# Sales routes
ROUTE_001 = "00000000-0000-0000-0000-000000000A01"
ROUTE_002 = "00000000-0000-0000-0000-000000000A02"

# Route customers
RC_001 = "00000000-0000-0000-0000-000000000A11"
RC_002 = "00000000-0000-0000-0000-000000000A12"
RC_003 = "00000000-0000-0000-0000-000000000A13"

# Route visits
RV_001 = "00000000-0000-0000-0000-000000000A21"
RV_002 = "00000000-0000-0000-0000-000000000A22"
RV_003 = "00000000-0000-0000-0000-000000000A23"

# Import containers
CONT_001 = "00000000-0000-0000-0000-000000000B01"

# Integration configs
INTG_001 = "00000000-0000-0000-0000-000000000C01"

# Bank accounts
BA_001 = "00000000-0000-0000-0000-000000000D01"
BA_002 = "00000000-0000-0000-0000-000000000D02"

# RBAC
ROLE_ADMIN  = "00000000-0000-0000-0000-00000000F001"
ROLE_VEND   = "00000000-0000-0000-0000-00000000F002"
ROLE_OP     = "00000000-0000-0000-0000-00000000F003"
PERM_CREATE = "00000000-0000-0000-0000-00000000F011"
PERM_READ   = "00000000-0000-0000-0000-00000000F012"
PERM_UPDATE = "00000000-0000-0000-0000-00000000F013"
PERM_DELETE = "00000000-0000-0000-0000-00000000F014"
PERM_SELL   = "00000000-0000-0000-0000-00000000F015"

# Price lists
PL_GENERAL  = "00000000-0000-0000-0000-00000000E001"
PL_MAYORISTA = "00000000-0000-0000-0000-00000000E002"

TODAY = date(2026, 5, 25)
NOW = datetime(2026, 5, 25, 10, 0, 0, tzinfo=None)
now_ts = datetime.now()


async def clean_db(conn):
    # TRUNCATE CASCADE for tables with proper FK constraints
    try:
        await conn.execute("TRUNCATE tenants, users, companies CASCADE")
    except Exception:
        pass
    # Additional DELETE for tables that may lack FK or where cascade didn't reach
    extra = [
        "dist_supplier_agreement_items", "dist_supplier_agreements",
        "customer_agreement_items", "customer_agreements",
        "dist_po_approvals", "dist_po_approval_configs",
        "customer_credit_limits", "credit_authorizations",
        "accounts_receivable",
        "route_visits", "route_customers", "sales_routes",
        "intelicont_entry_lines", "intelicont_entries", "intelicont_sync_config",
        "inteliaudit_sync_config",
        "import_items", "import_containers",
        "supplier_invoice_payments", "supplier_invoices",
        "bank_transactions", "bank_accounts",
        "cash_flow_projections", "budgets", "payment_run_items", "payment_runs",
        "sifen_responses", "sifen_timbrados",
        "fiscal_config",
        "cash_counts", "cash_sessions", "cash_registers",
        "wallet_transactions", "customer_wallets",
        "account_movements", "customer_accounts",
        "financing_installments", "financings",
        "branch_prices", "branch_transfer_items", "branch_transfers",
        "inventory_adjustment_items", "inventory_adjustments",
        "stock_transfer_items", "stock_transfers",
        "inventory_movements", "stock_lots", "stock",
        "sale_items", "sales",
        "return_items", "returns",
        "supplier_evaluations", "supplier_price_history",
        "supplier_contract_items", "supplier_contracts",
        "purchase_requisition_items", "purchase_requisitions",
        "purchase_receipt_items", "purchase_receipts",
        "purchase_order_items", "purchase_order_history", "purchase_orders",
        "ecommerce_sync_logs",
        "boutique_pedido_items", "boutique_pedidos",
        "deliveries", "delivery_slips", "delivery_routes",
        "integration_configs", "webhook_deliveries",
        "product_categories",
        "warehouses",
        "customers",
        "suppliers",
        "products",
        "currencies", "exchange_rates",
        "payment_methods",
        "commission_rules", "sales_commissions",
        "price_list_items", "price_lists",
        "commercial_agreements",
        "agreement_volumes", "agreement_rebates", "agreement_items",
        "notas_credito_debito", "timbrado_usage",
        "promotion_usages", "promotions",
        "discounts",
        "supermer_supplier_scorecards", "supermer_purchase_suggestions",
        "supermer_freshness_audits", "supermer_receive_batches",
        "supermer_markdown_logs", "supermer_perishable_configs",
        "supermer_waste_logs",
        "supermer_production_batches", "supermer_production_orders",
        "supermer_bakery_plan_items", "supermer_bakery_plans",
        "supermer_butchery_template_cuts", "supermer_butchery_templates",
        "supermer_recipe_items", "supermer_recipes",
        "supermer_purchase_forecasts",
        "forecast_rules", "forecast_projections", "purchase_budgets",
        "user_tenants",
        "rbac_user_roles", "rbac_role_permissions", "rbac_roles", "rbac_permissions",
        "branches",
        "backup_schedule_config", "backups",
        "usuarios_whatsapp", "whatsapp_messages", "whatsapp_conversations",
        "whatsapp_templates", "whatsapp_configs",
        "crm_actividades_realizadas", "crm_actividades", "crm_oportunidades", "crm_leads",
        "credit_movements", "credit_accounts",
        "payment_allocations", "payments",
        "supplier_negotiations",
        "customer_wallets",
    ]
    for t in extra:
        try:
            await conn.execute(f"DELETE FROM {t}")
        except Exception:
            pass


async def seed(conn):

    # ═══════════════ TENANT ═══════════════
    await conn.execute("""
        INSERT INTO tenants (id, nombre, slug, plan, schema_name, estado, fecha_inicio, config, created_at, updated_at)
        VALUES ($1, 'Supermer Test', 'supermer-test', 'enterprise', 'supermer_test', 'activo', CURRENT_DATE, '{"vertical":"supermer"}', NOW(), NOW())
    """, TENANT)

    # ═══════════════ USER (public schema) ═══════════════
    # bcrypt hash for "admin123"
    pw_hash = "$2b$12$4nVJYR4VnUbZ9b.IbiO8HeEsq415M.zg6bj4Q7h1F47QJGDlom9HS"
    await conn.execute("""
        INSERT INTO users (id, email, password_hash, nombre, telefono, rol, activo, created_at, updated_at)
        VALUES ($1, 'admin@supermer.com', $2, 'Admin Supermer', '0981123456', 'super_admin', true, NOW(), NOW())
    """, USER_SA, pw_hash)

    await conn.execute("""
        INSERT INTO users (id, email, password_hash, nombre, telefono, rol, activo, created_at, updated_at)
        VALUES ($1, 'operador@supermer.com', $2, 'Carlos Operador', '0981765432', 'operador', true, NOW(), NOW())
    """, USER_OP1, pw_hash)

    await conn.execute("""
        INSERT INTO users (id, email, password_hash, nombre, telefono, rol, activo, created_at, updated_at)
        VALUES ($1, 'vendedor1@supermer.com', $2, 'Maria Vendedora', '0981555666', 'vendedor', true, NOW(), NOW())
    """, USER_VEND1, pw_hash)

    await conn.execute("""
        INSERT INTO users (id, email, password_hash, nombre, telefono, rol, activo, created_at, updated_at)
        VALUES ($1, 'vendedor2@supermer.com', $2, 'Juan Vendedor', '0981777888', 'vendedor', true, NOW(), NOW())
    """, USER_VEND2, pw_hash)

    # ═══════════════ USER TENANT ═══════════════
    await conn.execute("""
        INSERT INTO user_tenants (user_id, tenant_id, rol, activo, created_at)
        VALUES ($1, $2, 'super_admin', true, NOW())
    """, USER_SA, TENANT)
    for uid in [USER_OP1, USER_VEND1, USER_VEND2]:
        await conn.execute("""
            INSERT INTO user_tenants (user_id, tenant_id, rol, activo, created_at)
            VALUES ($1, $2, 'operador', true, NOW())
        """, uid, TENANT)

    # ═══════════════ COMPANY ═══════════════
    await conn.execute("""
        INSERT INTO companies (id, ruc, razon_social, nombre_fantasia, actividad_principal,
            regimen_tributario, iva_condition, direccion, ciudad, departamento, telefono, email,
            timbrado_numero, sifen_enabled, created_at, updated_at)
        VALUES ($1, '80012345-6', 'Supermercados Inteligentes S.A.', 'InteliMarket Super',
            'Venta al por menor en supermercados', 'general', 'contribuyente',
            'Av. Mariscal López 1234', 'Asunción', 'Capital', '0216123456',
             'info@intelimarket.com.py', '12345678', true, NOW(), NOW())
    """, COMPANY)

    # ═══════════════ BRANCHES ═══════════════
    branches = [
        (BR_CENTRAL, "C001", "Casa Central", "Av. Mariscal López 1234", "Asunción", "Capital", "0216123456", 1),
        (BR_SUC1, "S001", "Sucursal Shopping del Sol", "Av. Aviadores del Chaco 2050", "Asunción", "Capital", "0216789123", 2),
        (BR_SUC2, "S002", "Sucursal San Lorenzo", "Ruta 2 Mcal. Estigarribia Km 10", "San Lorenzo", "Central", "0216456789", 3),
        (BR_SUC3, "S003", "Sucursal Encarnación", "Av. Irrazábal 456", "Encarnación", "Itapúa", "071123456", 4),
    ]
    for bid, cod, nombre, dir, ciudad, depto, tel, pe in branches:
        await conn.execute("""
            INSERT INTO branches (id, company_id, codigo, nombre, direccion, ciudad, departamento, telefono, punto_emision, activo, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
        """, bid, COMPANY, cod, nombre, dir, ciudad, depto, tel, pe)

    # ═══════════════ WAREHOUSES ═══════════════
    wh = [
        (WH_CENTRAL, "W001", "Depósito Central", "Av. Mariscal López 1234", "principal", BR_CENTRAL),
        (WH_SUC1, "W002", "Depósito Shopping", "Av. Aviadores del Chaco 2050", "sucursal", BR_SUC1),
        (WH_SUC2, "W003", "Depósito San Lorenzo", "Ruta 2 Km 10", "sucursal", BR_SUC2),
        (WH_SUC3, "W004", "Depósito Encarnación", "Av. Irrazábal 456", "sucursal", BR_SUC3),
        (WH_FRIGO, "W005", "Cámara Frigorífica Central", "Av. Mariscal López 1234", "frigorifico", BR_CENTRAL),
    ]
    for wid, cod, nom, dir, tipo, bid in wh:
        await conn.execute("""
            INSERT INTO warehouses (id, company_id, branch_id, codigo, nombre, direccion, tipo, activo, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
        """, wid, COMPANY, bid, cod, nom, dir, tipo)

    # ═══════════════ PRODUCT CATEGORIES ═══════════════
    cats = [
        (CAT_LACTEOS, "LACT", "Lácteos y Fiambres"),
        (CAT_BEBIDAS, "BEB", "Bebidas"),
        (CAT_LIMPIEZA, "LIMP", "Limpieza"),
        (CAT_PERSONAL, "PER", "Cuidado Personal"),
        (CAT_CARNES, "CAR", "Carnes y Aves"),
        (CAT_PANADERIA, "PAN", "Panadería"),
        (CAT_CONSUMO, "CONS", "Almacén / Consumo"),
        (CAT_MASCOTAS, "MASC", "Mascotas"),
        (CAT_FRESCOS, "FRESH", "Frescos"),
        (CAT_MASCOTAS2, "CONG", "Congelados"),
    ]
    for cid, cod, nom in cats:
        await conn.execute("""
            INSERT INTO product_categories (id, company_id, nombre, codigo, activo, created_at)
            VALUES ($1, $2, $3, $4, true, NOW())
        """, cid, COMPANY, nom, cod)

    # ═══════════════ PRODUCTS (35 real supermarket items) ═══════════════
    products = [
        # id, cat_id, sku, barcode, name, unit, iva_rate, cost, price, stock_min, stock_max, weight
        (P_001, CAT_LACTEOS, "LAC001", "7622300112345", "Leche Entera Trebol 1L", "UN", Decimal("10"), Decimal("4500"), Decimal("6500"), 50, 500, Decimal("1.0")),
        (P_002, CAT_LACTEOS, "LAC002", "7622300223456", "Queso Paraguay Trebol 500g", "UN", Decimal("10"), Decimal("12000"), Decimal("17500"), 20, 200, Decimal("0.5")),
        (P_003, CAT_LACTEOS, "LAC003", "7622300334567", "Yogurt Natural Lacteos PY 1L", "UN", Decimal("10"), Decimal("7000"), Decimal("10500"), 30, 200, Decimal("1.0")),
        (P_004, CAT_LACTEOS, "LAC004", "7622300445678", "Manteca La Sibila 200g", "UN", Decimal("10"), Decimal("5500"), Decimal("8200"), 30, 300, Decimal("0.2")),
        (P_005, CAT_BEBIDAS, "BEB001", "7840250001234", "Coca-Cola 2L", "UN", Decimal("10"), Decimal("5500"), Decimal("8500"), 100, 1000, Decimal("2.0")),
        (P_006, CAT_BEBIDAS, "BEB002", "7840250002345", "Sprite 2L", "UN", Decimal("10"), Decimal("5000"), Decimal("7800"), 50, 800, Decimal("2.0")),
        (P_007, CAT_BEBIDAS, "BEB003", "7840250003456", "Agua Mineral Sinwy 1.5L", "UN", Decimal("5"), Decimal("2000"), Decimal("3500"), 100, 1000, Decimal("1.5")),
        (P_008, CAT_BEBIDAS, "BEB004", "7840250004567", "Cerveza Pilsen 6x473ml", "PK", Decimal("10"), Decimal("28000"), Decimal("42000"), 20, 300, Decimal("3.0")),
        (P_009, CAT_BEBIDAS, "BEB005", "7840250005678", "Jugo Del Valle Naranja 1L", "UN", Decimal("5"), Decimal("4000"), Decimal("6500"), 40, 400, Decimal("1.0")),
        (P_010, CAT_LIMPIEZA, "LMP001", "7840251001234", "Detergente Limon Ala 500ml", "UN", Decimal("10"), Decimal("4500"), Decimal("7200"), 40, 400, Decimal("0.5")),
        (P_011, CAT_LIMPIEZA, "LMP002", "7840251002345", "Lavandina Ayudin 1L", "UN", Decimal("5"), Decimal("2500"), Decimal("4200"), 50, 500, Decimal("1.0")),
        (P_012, CAT_LIMPIEZA, "LMP003", "7840251003456", "Jabón Liquido Protex 300ml", "UN", Decimal("10"), Decimal("6000"), Decimal("9500"), 30, 300, Decimal("0.3")),
        (P_013, CAT_LIMPIEZA, "LMP004", "7840251004567", "Esponja Scotch-Brite 3un", "PK", Decimal("5"), Decimal("3500"), Decimal("5500"), 40, 400, Decimal("0.1")),
        (P_014, CAT_PERSONAL, "PER001", "7840252001234", "Shampoo Pantene 400ml", "UN", Decimal("10"), Decimal("15000"), Decimal("23500"), 20, 200, Decimal("0.4")),
        (P_015, CAT_PERSONAL, "PER002", "7840252002345", "Desodorante Axe 150ml", "UN", Decimal("10"), Decimal("12000"), Decimal("18500"), 30, 250, Decimal("0.15")),
        (P_016, CAT_PERSONAL, "PER003", "7840252003456", "Papel Higiénico Higienol 4x30m", "PK", Decimal("5"), Decimal("8500"), Decimal("13000"), 50, 500, Decimal("0.8")),
        (P_017, CAT_PERSONAL, "PER004", "7840252004567", "Pasta Dental Colgate 90g", "UN", Decimal("10"), Decimal("7000"), Decimal("11000"), 40, 400, Decimal("0.1")),
        (P_018, CAT_CARNES, "CAR001", "7840253001234", "Carne Vacio 1kg", "KG", Decimal("10"), Decimal("32000"), Decimal("48000"), 10, 100, Decimal("1.0")),
        (P_019, CAT_CARNES, "CAR002", "7840253002345", "Pollo Entero 1kg", "KG", Decimal("10"), Decimal("11000"), Decimal("16500"), 20, 200, Decimal("1.0")),
        (P_020, CAT_CARNES, "CAR003", "7840253003456", "Carne Picada Especial 1kg", "KG", Decimal("10"), Decimal("22000"), Decimal("34000"), 10, 150, Decimal("1.0")),
        (P_021, CAT_PANADERIA, "PAN001", "7840254001234", "Pan Frances x Kg", "KG", Decimal("5"), Decimal("5000"), Decimal("8000"), 20, 200, Decimal("1.0")),
        (P_022, CAT_PANADERIA, "PAN002", "7840254002345", "Pan Saborizado x Kg", "KG", Decimal("5"), Decimal("7000"), Decimal("11000"), 15, 150, Decimal("1.0")),
        (P_023, CAT_PANADERIA, "PAN003", "7840254003456", "Galleta Cookie Chips 200g", "UN", Decimal("10"), Decimal("5500"), Decimal("8500"), 30, 300, Decimal("0.2")),
        (P_024, CAT_CONSUMO, "CON001", "7840255001234", "Arroz Don Max 1kg", "UN", Decimal("5"), Decimal("4000"), Decimal("6500"), 80, 800, Decimal("1.0")),
        (P_025, CAT_CONSUMO, "CON002", "7840255002345", "Fideo Tallarín Favorita 500g", "UN", Decimal("5"), Decimal("2500"), Decimal("4200"), 80, 800, Decimal("0.5")),
        (P_026, CAT_CONSUMO, "CON003", "7840255003456", "Aceite Soja Cocina 900ml", "UN", Decimal("10"), Decimal("8000"), Decimal("12500"), 40, 400, Decimal("0.9")),
        (P_027, CAT_CONSUMO, "CON004", "7840255004567", "Azúcar La Favorita 1kg", "UN", Decimal("5"), Decimal("3500"), Decimal("5500"), 60, 600, Decimal("1.0")),
        (P_028, CAT_CONSUMO, "CON005", "7840255005678", "Harina Trigo Doña Tota 1kg", "UN", Decimal("5"), Decimal("3000"), Decimal("4800"), 50, 500, Decimal("1.0")),
        (P_029, CAT_CONSUMO, "CON006", "7840255006789", "Sal Fina Celusal 500g", "UN", Decimal("5"), Decimal("1500"), Decimal("2500"), 60, 600, Decimal("0.5")),
        (P_030, CAT_MASCOTAS, "MAS001", "7840256001234", "Alimento Perro Pedigree 1kg", "UN", Decimal("10"), Decimal("12000"), Decimal("18500"), 20, 200, Decimal("1.0")),
        (P_031, CAT_MASCOTAS, "MAS002", "7840256002345", "Alimento Gato Whiskas 1kg", "UN", Decimal("10"), Decimal("14000"), Decimal("21500"), 15, 150, Decimal("1.0")),
        (P_032, CAT_FRESCOS, "FRS001", "7840257001234", "Tomate Perita 1kg", "KG", Decimal("5"), Decimal("5000"), Decimal("8500"), 20, 200, Decimal("1.0")),
        (P_033, CAT_FRESCOS, "FRS002", "7840257002345", "Cebolla 1kg", "KG", Decimal("5"), Decimal("4000"), Decimal("6500"), 30, 300, Decimal("1.0")),
        (P_034, CAT_FRESCOS, "FRS003", "7840257003456", "Banana 1kg", "KG", Decimal("5"), Decimal("3500"), Decimal("5500"), 30, 300, Decimal("1.0")),
        (P_035, CAT_MASCOTAS2, "CNG001", "7840258001234", "Papas Fritas Mc Cain 1kg", "UN", Decimal("10"), Decimal("15000"), Decimal("23000"), 15, 150, Decimal("1.0")),
    ]
    for pid, cat, sku, bar, name, um, iva, cost, price, smin, smax, wt in products:
        tipo_v = "pesable" if um == "KG" else "unidad"
        await conn.execute("""
            INSERT INTO products (id, company_id, category_id, sku, codigo_barra, nombre,
                unidad_medida, iva_tasa, tipo, tipo_venta, costo_promedio, ultimo_costo, precio_venta,
                stock_minimo, stock_maximo, peso_kg, activo, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'producto',$14,$9,$9,$10,$11,$12,$13,true,NOW(), NOW())
        """, pid, COMPANY, cat, sku, bar, name, um, iva, cost, price, smin, smax, wt, tipo_v)

    # ═══════════════ SUPPLIERS (10) ═══════════════
    suppliers = [
        (SUPP_01, "80012345-6", "Distribuidora Trebol S.A.", "Gral. Santos 789", "Asunción", "0216123456", "ventas@trebol.com.py", "Lácteos", "nacional", 30),
        (SUPP_02, "80023456-7", "Coca-Cola Paraguay S.A.", "Av. Eusebio Ayala 500", "Asunción", "0216234567", "pedidos@cocacola.com.py", "Bebidas", "nacional", 15),
        (SUPP_03, "80034567-8", "Unilever Paraguay S.A.", "Av. Mariscal López 2000", "Asunción", "0216345678", "ventas@unilever.com.py", "Limpieza", "nacional", 30),
        (SUPP_04, "80045678-9", "Procter & Gamble PY", "Av. España 1500", "Asunción", "0216456789", "pedidos@pg.com.py", "Personal", "nacional", 30),
        (SUPP_05, "80056789-0", "Frigorífico Concepción S.A.", "Ruta 5 Km 12", "Concepción", "0331234567", "ventas@frigorifico.com.py", "Carnes", "nacional", 7),
        (SUPP_06, "80067890-1", "Molino Harinero Santa Rosa", "Av. Defensores del Chaco 2500", "Asunción", "0216567890", "ventas@santarosa.com.py", "Harinas", "nacional", 15),
        (SUPP_07, "80078901-2", "Distribuidora San Miguel", "Ruta 2 Km 15", "Capiatá", "0216678901", "pedidos@sanmiguel.com.py", "Almacén", "nacional", 20),
        (SUPP_08, "80089012-3", "Importadora China PY S.A.", "Av. Fernando de la Mora 300", "Fernando de la Mora", "0216789012", "ventas@chinapy.com.py", "Importados", "importacion", 45),
        (SUPP_09, "80090123-4", "Nestlé Paraguay S.A.", "Av. Aviadores del Chaco 3000", "Asunción", "0216890123", "pedidos@nestle.com.py", "Alimentos", "nacional", 30),
        (SUPP_10, "80101234-5", "Granja Avícola Santa Ana", "Ruta 1 Km 25", "San Lorenzo", "0216901234", "ventas@santaana.com.py", "Aves", "nacional", 3),
    ]
    for sid, ruc, razon, dir, ciudad, tel, email, grupo, tipo, plazo in suppliers:
        await conn.execute("""
            INSERT INTO suppliers (id, company_id, tipo_persona, ruc, razon_social, direccion, ciudad,
                telefono, email, grupo, tipo_proveedor, plazo_pago_dias, activo, moneda_default, created_at, updated_at)
            VALUES ($1,$2,'juridica',$3,$4,$5,$6,$7,$8,$9,$10,$11,true,'PYG',NOW(), NOW())
        """, sid, COMPANY, ruc, razon, dir, ciudad, tel, email, grupo, tipo, plazo)

    # ═══════════════ CUSTOMERS (18) ═══════════════
    customers = [
        (CUST_01, "juridica", "80054321-0", None, "Comercial San Roque S.A.", "Av. Mariscal López 500", "Asunción", "0216123450", "pedidos@sanroque.com.py", 50000000, "credito"),
        (CUST_02, "juridica", "80054322-1", None, "Distribuidora del Sur S.A.", "Ruta 1 Km 5", "Encarnación", "071123450", "ventas@delsur.com.py", 30000000, "credito"),
        (CUST_03, "juridica", "80054323-2", None, "Restaurante La Costa", "Av. Costanera 123", "Asunción", "0216123451", "lacosta@email.com", 15000000, "contado"),
        (CUST_04, "fisica", None, "1234567", "Juan Carlos Giménez", "Av. Eusebio Ayala 300", "Asunción", "0981123456", "jcgimenez@email.com", 5000000, "contado"),
        (CUST_05, "fisica", None, "2345678", "María Auxiliadora Benítez", "Calle México 456", "San Lorenzo", "0981765432", "mabenitez@email.com", 3000000, "contado"),
        (CUST_06, "juridica", "80054324-3", None, "Hotel Sheraton Asunción", "Av. San Martín 700", "Asunción", "0216170000", "compras@sheraton.com.py", 100000000, "credito"),
        (CUST_07, "juridica", "80054325-4", None, "Comedor Universitario UNA", "Campus UNA", "San Lorenzo", "0215856000", "compras@una.edu.py", 20000000, "credito"),
        (CUST_08, "fisica", None, "3456789", "Pedro Ramón Martínez", "Calle Palma 789", "Asunción", "0981555666", "prmartinez@email.com", 2000000, "contado"),
        (CUST_09, "juridica", "80054326-5", None, "Panificadora El Trigal S.A.", "Av. Defensores del Chaco 900", "Asunción", "0216123452", "compras@eltrigal.com.py", 25000000, "credito"),
        (CUST_10, "fisica", None, "4567890", "Ana Lucía Fernández", "Calle Estados Unidos 234", "Asunción", "0981777888", "alfernandez@email.com", 1500000, "contado"),
        (CUST_11, "juridica", "80054327-6", None, "Catering VIP S.A.", "Av. España 567", "Asunción", "0216123453", "pedidos@cateringvip.com.py", 40000000, "credito"),
        (CUST_12, "juridica", "80054328-7", None, "Club Centenario", "Av. Santísimo Sacramento 1000", "Asunción", "0216123454", "compras@clubcentenario.com.py", 35000000, "credito"),
        (CUST_13, "fisica", None, "5678901", "Roberto Francisco Ortiz", "Calle Azara 890", "Asunción", "0981888999", "rfortiz@email.com", 4000000, "contado"),
        (CUST_14, "juridica", "80054329-8", None, "Hospital Privado San Miguel", "Av. Venezuela 789", "Asunción", "0216171000", "compras@sanniguel.com.py", 80000000, "credito"),
        (CUST_15, "fisica", None, "6789012", "Laura Elena Cristaldo", "Calle Luis A. de Herrera 345", "Encarnación", "0711456789", "lecristaldo@email.com", 2500000, "contado"),
        (CUST_16, "juridica", "80054330-0", None, "Heladería Da Vinci S.A.", "Av. Mariscal López 1500", "Asunción", "0216123455", "compras@davinci.com.py", 12000000, "credito"),
        (CUST_17, "fisica", None, "7890123", "Diego Armando Sosa", "Calle Tte. Fariña 123", "Ciudad del Este", "0611234567", "dasosa@email.com", 3500000, "contado"),
        (CUST_18, "juridica", "80054331-1", None, "Empresa Constructora Norte S.A.", "Av. Madame Lynch 456", "Asunción", "0216123456", "compras@norte.com.py", 60000000, "credito"),
    ]
    for cid, tp, ruc, ci, razon, dir, ciudad, tel, email, cred_lim, pago in customers:
        await conn.execute("""
            INSERT INTO customers (id, company_id, tipo_persona, ruc, ci, razon_social, direccion,
                ciudad, telefono, email, credito_limite, pago_default, activo, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,NOW(), NOW())
        """, cid, COMPANY, tp, ruc, ci, razon, dir, ciudad, tel, email, cred_lim, pago)

    # ═══════════════ STOCK records across warehouses ═══════════════
    stock_data = [
        (P_001, WH_CENTRAL, 200, 5000), (P_001, WH_SUC1, 80, 5000), (P_001, WH_SUC2, 60, 5000), (P_001, WH_SUC3, 40, 5000),
        (P_002, WH_CENTRAL, 100, 13000), (P_002, WH_SUC1, 40, 13000), (P_002, WH_SUC2, 30, 13000),
        (P_005, WH_CENTRAL, 500, 6000), (P_005, WH_SUC1, 200, 6000), (P_005, WH_SUC2, 150, 6000), (P_005, WH_SUC3, 100, 6000),
        (P_006, WH_CENTRAL, 300, 5500), (P_006, WH_SUC1, 120, 5500), (P_006, WH_SUC2, 100, 5500),
        (P_007, WH_CENTRAL, 400, 2500), (P_007, WH_SUC1, 150, 2500), (P_007, WH_SUC2, 120, 2500), (P_007, WH_SUC3, 80, 2500),
        (P_010, WH_CENTRAL, 250, 5000), (P_010, WH_SUC1, 100, 5000), (P_010, WH_SUC2, 80, 5000),
        (P_018, WH_FRIGO, 60, 34000), (P_018, WH_SUC1, 25, 34000), (P_018, WH_SUC2, 20, 34000),
        (P_019, WH_FRIGO, 100, 12000), (P_019, WH_SUC1, 40, 12000), (P_019, WH_SUC2, 30, 12000), (P_019, WH_SUC3, 20, 12000),
        (P_024, WH_CENTRAL, 400, 4500), (P_024, WH_SUC1, 150, 4500), (P_024, WH_SUC2, 120, 4500), (P_024, WH_SUC3, 80, 4500),
        (P_025, WH_CENTRAL, 300, 3000), (P_025, WH_SUC1, 120, 3000), (P_025, WH_SUC2, 100, 3000),
        (P_026, WH_CENTRAL, 200, 9000), (P_026, WH_SUC1, 80, 9000), (P_026, WH_SUC2, 60, 9000),
        (P_027, WH_CENTRAL, 350, 4000), (P_027, WH_SUC1, 130, 4000), (P_027, WH_SUC2, 100, 4000), (P_027, WH_SUC3, 70, 4000),
        (P_028, WH_CENTRAL, 250, 3500), (P_028, WH_SUC1, 100, 3500), (P_028, WH_SUC2, 80, 3500),
        (P_032, WH_CENTRAL, 80, 5500), (P_032, WH_SUC1, 30, 5500), (P_032, WH_SUC2, 25, 5500),
        (P_033, WH_CENTRAL, 100, 4500), (P_033, WH_SUC1, 35, 4500), (P_033, WH_SUC2, 30, 4500), (P_033, WH_SUC3, 20, 4500),
        (P_035, WH_FRIGO, 80, 16000), (P_035, WH_SUC1, 30, 16000), (P_035, WH_SUC2, 25, 16000),
    ]
    for pid, wid, qty, cost in stock_data:
        total_cost = qty * cost
        await conn.execute("""
            INSERT INTO stock (warehouse_id, product_id, cantidad, cantidad_reservada, costo_unitario, updated_at)
            VALUES ($1,$2,$3,0,$4,NOW())
        """, wid, pid, qty, cost)
        await conn.execute("""
            INSERT INTO stock_lots (company_id, warehouse_id, product_id, cantidad, cantidad_disponible, costo_unitario, costo_total,
                referencia, fecha_ingreso, created_at)
            VALUES ($1,$2,$3,$4,$4,$5,$6,'Seed batch', NOW(), NOW())
        """, COMPANY, wid, pid, qty, cost, total_cost)

    # ═══════════════ PAYMENT METHODS ═══════════════
    pms = [
        (PM_CASH, "efectivo", "Efectivo", "PYG"),
        (PM_CCARD, "tarjeta_credito", "Tarjeta de Crédito", "PYG"),
        (PM_DCARD, "tarjeta_debito", "Tarjeta de Débito", "PYG"),
        (PM_TRANSF, "transferencia", "Transferencia Bancaria", "PYG"),
        (PM_SPI, "spi_qr", "SPI QR", "PYG"),
        (PM_CREDIT, "cuenta_credito", "Cuenta Corriente / Crédito", "PYG"),
    ]
    for pid, tp, nom, mon in pms:
        await conn.execute("""
            INSERT INTO payment_methods (id, company_id, tipo, nombre, moneda, activo, created_at)
            VALUES ($1,$2,$3,$4,$5,true,NOW())
        """, pid, COMPANY, tp, nom, mon)

    # ═══════════════ CURRENCIES ═══════════════
    await conn.execute("""
        INSERT INTO currencies (id, company_id, codigo, nombre, simbolo, activa, es_moneda_local, created_at)
        VALUES ($1,$2,'PYG','Guaraní Paraguayo','₲',true,true,NOW())
    """, CUR_PYG, COMPANY)
    await conn.execute("""
        INSERT INTO currencies (id, company_id, codigo, nombre, simbolo, activa, es_moneda_local, created_at)
        VALUES ($1,$2,'USD','Dólar Americano','$',true,false,NOW())
    """, CUR_USD, COMPANY)
    await conn.execute("""
        INSERT INTO currencies (id, company_id, codigo, nombre, simbolo, activa, es_moneda_local, created_at)
        VALUES ($1,$2,'BRL','Real Brasileño','R$',true,false,NOW())
    """, CUR_BRL, COMPANY)

    # ═══════════════ EXCHANGE RATES ═══════════════
    await conn.execute("""
        INSERT INTO exchange_rates (id, company_id, moneda, tasa_compra, tasa_venta, fuente, fecha, created_at)
         VALUES ($1,$2,'USD',7400,7480,'bcp',$3,NOW())
    """, ER_001, COMPANY, TODAY)
    await conn.execute("""
        INSERT INTO exchange_rates (id, company_id, moneda, tasa_compra, tasa_venta, fuente, fecha, created_at)
         VALUES ($1,$2,'BRL',1350,1420,'bcp',$3,NOW())
    """, ER_002, COMPANY, TODAY)

    # ═══════════════ SIFEN TIMBRADOS ═══════════════
    await conn.execute("""
        INSERT INTO sifen_timbrados (id, company_id, numero, fecha_inicio, fecha_fin,
            rango_desde, rango_hasta, tipo_comprobante, activo, created_at)
        VALUES ($1,$2,'12345678',$3,'2027-05-25',1,9999,'factura',true,NOW())
    """, TIMBRADO, COMPANY, TODAY)

    # ═══════════════ FISCAL CONFIG ═══════════════
    await conn.execute("""
        INSERT INTO fiscal_config (company_id, modo_emision, timbrado_id, punto_emision, created_at, updated_at)
        VALUES ($1,'sifen',$2,'001',NOW(),NOW())
    """, COMPANY, TIMBRADO)

    # ═══════════════ CASH REGISTERS ═══════════════
    crs = [
        (CR_001, "CAJ-001", "Caja Principal", BR_CENTRAL),
        (CR_002, "CAJ-002", "Caja Shopping", BR_SUC1),
        (CR_003, "CAJ-003", "Caja San Lorenzo", BR_SUC2),
        (CR_004, "CAJ-004", "Caja Encarnación", BR_SUC3),
    ]
    for cid, cod, nom, bid in crs:
        await conn.execute("""
            INSERT INTO cash_registers (id, company_id, branch_id, nombre, codigo, activo, created_at)
            VALUES ($1,$2,$3,$4,$5,true,NOW())
        """, cid, COMPANY, bid, nom, cod)

    # Cash session for CR_001
    await conn.execute("""
        INSERT INTO cash_sessions (id, cash_register_id, user_id, monto_apertura, fecha_apertura, estado, created_at)
        VALUES ($1,$2,$3,500000,NOW(),'abierta',NOW())
    """, CS_001, CR_001, USER_OP1)

    # ═══════════════ SALES (16) ═══════════════
    sales = [
        (SALE_001, BR_CENTRAL, CUST_04, "S-001-000001", "2026-05-20 09:30:00", "factura", "contado", "confirmado", Decimal("45000"), Decimal("40000"), Decimal("5000"), Decimal("0"), Decimal("40000"), Decimal("500"), Decimal("0"), Decimal("44500"), Decimal("44500"), USER_OP1),
        (SALE_002, BR_CENTRAL, CUST_08, "S-001-000002", "2026-05-20 10:15:00", "factura", "contado", "confirmado", Decimal("12500"), Decimal("8500"), Decimal("4000"), Decimal("0"), Decimal("850"), Decimal("200"), Decimal("0"), Decimal("12500"), Decimal("12500"), USER_OP1),
        (SALE_003, BR_SUC1, CUST_05, "S-002-000001", "2026-05-20 11:00:00", "factura", "contado", "confirmado", Decimal("24000"), Decimal("24000"), Decimal("0"), Decimal("0"), Decimal("2400"), Decimal("0"), Decimal("0"), Decimal("26400"), Decimal("26400"), USER_OP1),
        (SALE_004, BR_CENTRAL, CUST_01, "S-001-000003", "2026-05-21 08:00:00", "factura", "credito", "confirmado", Decimal("250000"), Decimal("200000"), Decimal("50000"), Decimal("0"), Decimal("20000"), Decimal("2500"), Decimal("0"), Decimal("272500"), Decimal("0"), USER_OP1),
        (SALE_005, BR_CENTRAL, CUST_06, "S-001-000004", "2026-05-21 09:00:00", "factura", "credito", "confirmado", Decimal("580000"), Decimal("520000"), Decimal("60000"), Decimal("0"), Decimal("52000"), Decimal("3000"), Decimal("0"), Decimal("635000"), Decimal("0"), USER_OP1),
        (SALE_006, BR_SUC2, CUST_10, "S-003-000001", "2026-05-21 10:30:00", "factura", "contado", "confirmado", Decimal("18500"), Decimal("18500"), Decimal("0"), Decimal("0"), Decimal("1850"), Decimal("0"), Decimal("0"), Decimal("20350"), Decimal("20350"), USER_OP1),
        (SALE_007, BR_SUC3, CUST_15, "S-004-000001", "2026-05-22 11:00:00", "factura", "contado", "confirmado", Decimal("32000"), Decimal("22000"), Decimal("10000"), Decimal("0"), Decimal("2200"), Decimal("500"), Decimal("0"), Decimal("34700"), Decimal("34700"), USER_OP1),
        (SALE_008, BR_CENTRAL, CUST_11, "S-001-000005", "2026-05-22 14:00:00", "factura", "credito", "pendiente", Decimal("175000"), Decimal("150000"), Decimal("25000"), Decimal("0"), Decimal("15000"), Decimal("1250"), Decimal("0"), Decimal("191250"), Decimal("0"), USER_OP1),
        (SALE_009, BR_SUC1, CUST_03, "S-002-000002", "2026-05-23 12:00:00", "factura", "contado", "confirmado", Decimal("55000"), Decimal("45000"), Decimal("10000"), Decimal("0"), Decimal("4500"), Decimal("500"), Decimal("0"), Decimal("60000"), Decimal("60000"), USER_OP1),
        (SALE_010, BR_SUC2, CUST_07, "S-003-000002", "2026-05-23 09:00:00", "factura", "credito", "confirmado", Decimal("92000"), Decimal("80000"), Decimal("12000"), Decimal("0"), Decimal("8000"), Decimal("600"), Decimal("0"), Decimal("100600"), Decimal("50000"), USER_OP1),
        (SALE_011, BR_CENTRAL, CUST_12, "S-001-000006", "2026-05-24 10:00:00", "factura", "credito", "confirmado", Decimal("420000"), Decimal("380000"), Decimal("40000"), Decimal("0"), Decimal("38000"), Decimal("2000"), Decimal("0"), Decimal("460000"), Decimal("100000"), USER_OP1),
        (SALE_012, BR_SUC1, CUST_14, "S-002-000003", "2026-05-24 11:00:00", "factura", "credito", "confirmado", Decimal("750000"), Decimal("650000"), Decimal("100000"), Decimal("0"), Decimal("65000"), Decimal("5000"), Decimal("0"), Decimal("820000"), Decimal("0"), USER_OP1),
        (SALE_013, BR_CENTRAL, CUST_02, "S-001-000007", "2026-05-25 08:00:00", "factura", "credito", "pendiente", Decimal("180000"), Decimal("160000"), Decimal("20000"), Decimal("0"), Decimal("16000"), Decimal("1000"), Decimal("0"), Decimal("197000"), Decimal("0"), USER_OP1),
        (SALE_014, BR_SUC3, CUST_13, "S-004-000002", "2026-05-25 09:00:00", "factura", "contado", "pendiente", Decimal("28000"), Decimal("20000"), Decimal("8000"), Decimal("0"), Decimal("2000"), Decimal("400"), Decimal("0"), Decimal("30400"), Decimal("0"), USER_OP1),
        (SALE_015, BR_CENTRAL, CUST_16, "S-001-000008", "2026-05-25 10:00:00", "factura", "credito", "pendiente", Decimal("65000"), Decimal("50000"), Decimal("15000"), Decimal("0"), Decimal("5000"), Decimal("750"), Decimal("0"), Decimal("70750"), Decimal("0"), USER_OP1),
        (SALE_016, BR_SUC2, CUST_18, "S-003-000003", "2026-05-25 11:00:00", "factura", "credito", "pendiente", Decimal("310000"), Decimal("280000"), Decimal("30000"), Decimal("0"), Decimal("28000"), Decimal("1500"), Decimal("0"), Decimal("339500"), Decimal("0"), USER_OP1),
    ]
    for sid, bid, cid, num, fecha, tcomp, cond, estado, subt, desc, bg10, bg5, be, iva10, iva5, total, tpagado, uid in sales:
        fecha_dt = datetime.fromisoformat(fecha)
        await conn.execute("""
            INSERT INTO sales (id, company_id, branch_id, customer_id, numero, fecha, tipo_comprobante,
                condicion, moneda, tipo_cambio, estado, subtotal, descuento_total,
                base_gravada_10, base_gravada_5, base_exenta, iva_10, iva_5, total, total_pagado, user_id, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PYG',1,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(), NOW())
        """, sid, COMPANY, bid, cid, num, fecha_dt, tcomp, cond, estado, subt, desc, bg10, bg5, be, iva10, iva5, total, tpagado, uid)

    # ═══════════════ SALE ITEMS ═══════════════
    sale_items_data = [
        # (sale_id, product_id, desc, qty, pu, iva_tasa, iva_mto, total)
        (SALE_001, P_018, "Carne Vacio 1kg", 1, 48000, Decimal("10"), 4800, 48000),
        (SALE_001, P_032, "Tomate Perita 1kg", 1, 8500, Decimal("5"), 425, 8500),
        (SALE_001, P_033, "Cebolla 1kg", 1, 6500, Decimal("5"), 325, 6500),
        (SALE_001, P_007, "Agua Mineral 1.5L", 2, 3500, Decimal("5"), 350, 7000),
        (SALE_002, P_005, "Coca-Cola 2L", 1, 8500, Decimal("10"), 850, 8500),
        (SALE_002, P_024, "Arroz Don Max 1kg", 1, 6500, Decimal("5"), 325, 6500),
        (SALE_003, P_001, "Leche Entera Trebol 1L", 3, 6500, Decimal("10"), 1950, 19500),
        (SALE_003, P_002, "Queso Paraguay 500g", 1, 17500, Decimal("10"), 1750, 17500),
        (SALE_004, P_030, "Alimento Perro Pedigree 1kg", 5, 18500, Decimal("10"), 9250, 92500),
        (SALE_004, P_031, "Alimento Gato Whiskas 1kg", 3, 21500, Decimal("10"), 6450, 64500),
        (SALE_005, P_005, "Coca-Cola 2L", 50, 8500, Decimal("10"), 42500, 425000),
        (SALE_005, P_006, "Sprite 2L", 30, 7800, Decimal("10"), 23400, 234000),
        (SALE_006, P_007, "Agua Mineral 1.5L", 2, 3500, Decimal("5"), 350, 7000),
        (SALE_006, P_025, "Fideo Tallarín 500g", 2, 4200, Decimal("5"), 420, 8400),
        (SALE_007, P_010, "Detergente Limon 500ml", 1, 7200, Decimal("10"), 720, 7200),
        (SALE_007, P_011, "Lavandina Ayudin 1L", 2, 4200, Decimal("5"), 420, 8400),
        (SALE_008, P_026, "Aceite Soja 900ml", 10, 12500, Decimal("10"), 12500, 125000),
        (SALE_008, P_028, "Harina Trigo 1kg", 15, 4800, Decimal("5"), 3600, 72000),
        (SALE_009, P_021, "Pan Frances x Kg", 2, 8000, Decimal("5"), 800, 16000),
        (SALE_009, P_023, "Galleta Cookie 200g", 3, 8500, Decimal("10"), 2550, 25500),
        (SALE_010, P_001, "Leche Entera Trebol 1L", 6, 6500, Decimal("10"), 3900, 39000),
        (SALE_010, P_003, "Yogurt Natural 1L", 4, 10500, Decimal("10"), 4200, 42000),
        (SALE_011, P_008, "Cerveza Pilsen 6x473ml", 5, 42000, Decimal("10"), 21000, 210000),
        (SALE_011, P_009, "Jugo Del Valle 1L", 12, 6500, Decimal("5"), 3900, 78000),
        (SALE_012, P_018, "Carne Vacio 1kg", 8, 48000, Decimal("10"), 38400, 384000),
        (SALE_012, P_019, "Pollo Entero 1kg", 10, 16500, Decimal("10"), 16500, 165000),
        (SALE_013, P_024, "Arroz Don Max 1kg", 20, 6500, Decimal("5"), 6500, 130000),
        (SALE_013, P_027, "Azúcar La Favorita 1kg", 15, 5500, Decimal("5"), 4125, 82500),
        (SALE_014, P_022, "Pan Saborizado x Kg", 1, 11000, Decimal("5"), 550, 11000),
        (SALE_014, P_017, "Pasta Dental Colgate 90g", 1, 11000, Decimal("10"), 1100, 11000),
        (SALE_015, P_014, "Shampoo Pantene 400ml", 3, 23500, Decimal("10"), 7050, 70500),
        (SALE_016, P_012, "Jabón Líquido Protex 300ml", 10, 9500, Decimal("10"), 9500, 95000),
        (SALE_016, P_013, "Esponja Scotch-Brite 3un", 12, 5500, Decimal("5"), 3300, 66000),
        (SALE_016, P_035, "Papas Fritas Mc Cain 1kg", 5, 23000, Decimal("10"), 11500, 115000),
    ]
    for i, (sid, pid, desc, qty, pu, iva_t, iva_m, tot) in enumerate(sale_items_data, 1):
        sid_uuid = f"00000000-0000-0000-0000-{800000 + i:012X}"
        await conn.execute("""
            INSERT INTO sale_items (id, sale_id, product_id, descripcion, cantidad, precio_unitario,
                descuento_pct, descuento_monto, iva_tasa, iva_monto, total, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8,$9,NOW())
        """, sid_uuid, sid, pid, desc, qty, pu, iva_t, iva_m, tot)

    # ═══════════════ PURCHASE ORDERS (8) ═══════════════
    pos = [
        (PO_001, SUPP_01, "PO-001-000001", "2026-05-18 08:00:00", "recibido", Decimal("1425000"), Decimal("0"), Decimal("1275000"), Decimal("150000"), Decimal("1425000"), None, USER_OP1),
        (PO_002, SUPP_02, "PO-001-000002", "2026-05-18 09:00:00", "recibido", Decimal("6590000"), Decimal("0"), Decimal("6000000"), Decimal("590000"), Decimal("6590000"), None, USER_OP1),
        (PO_003, SUPP_05, "PO-001-000003", "2026-05-19 10:00:00", "recibido", Decimal("1920000"), Decimal("0"), Decimal("1920000"), Decimal("0"), Decimal("1920000"), None, USER_OP1),
        (PO_004, SUPP_06, "PO-001-000004", "2026-05-20 11:00:00", "enviado", Decimal("2400000"), Decimal("0"), Decimal("1800000"), Decimal("600000"), Decimal("2400000"), "2026-05-28", USER_OP1),
        (PO_005, SUPP_09, "PO-001-000005", "2026-05-21 08:00:00", "aprobado", Decimal("3500000"), Decimal("0"), Decimal("3500000"), Decimal("0"), Decimal("3500000"), "2026-05-27", USER_OP1),
        (PO_006, SUPP_03, "PO-001-000006", "2026-05-22 09:00:00", "borrador", Decimal("1800000"), Decimal("0"), Decimal("1800000"), Decimal("0"), Decimal("1800000"), None, USER_OP1),
        (PO_007, SUPP_08, "PO-001-000007", "2026-05-23 10:00:00", "pendiente", Decimal("4500000"), Decimal("0"), Decimal("4000000"), Decimal("500000"), Decimal("4500000"), "2026-06-15", USER_OP1),
        (PO_008, SUPP_10, "PO-001-000008", "2026-05-24 11:00:00", "rechazado", Decimal("825000"), Decimal("0"), Decimal("825000"), Decimal("0"), Decimal("825000"), None, USER_OP1),
    ]
    for poid, supp, num, fecha, estado, subt, desc, bg10, bg5, total, fecha_est, uid in pos:
        fecha_dt = datetime.fromisoformat(fecha)
        fecha_est_dt = datetime.fromisoformat(fecha_est) if fecha_est else None
        await conn.execute("""
            INSERT INTO purchase_orders (id, company_id, supplier_id, numero, fecha, estado,
                subtotal, descuento_total, iva_10, iva_5, total,
                fecha_entrega_estimada, user_id, moneda, tipo_cambio, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'PYG',1,NOW(), NOW())
        """, poid, COMPANY, supp, num, fecha_dt, estado, subt, desc, bg10, bg5, total, fecha_est_dt, uid)

    # PO items
    po_items = [
        (PO_001, P_001, 300, 4500, Decimal("10"), 1350000),
        (PO_001, P_002, 100, 12000, Decimal("10"), 1200000),
        (PO_002, P_005, 1000, 5500, Decimal("10"), 5500000),
        (PO_002, P_006, 500, 5000, Decimal("10"), 2500000),
        (PO_003, P_018, 60, 32000, Decimal("10"), 1920000),
        (PO_004, P_028, 500, 3000, Decimal("5"), 1500000),
        (PO_004, P_024, 300, 4000, Decimal("5"), 1200000),
        (PO_005, P_030, 200, 12000, Decimal("10"), 2400000),
        (PO_005, P_031, 150, 14000, Decimal("10"), 2100000),
        (PO_006, P_010, 300, 4500, Decimal("10"), 1350000),
        (PO_006, P_011, 500, 2500, Decimal("5"), 1250000),
        (PO_007, P_014, 200, 15000, Decimal("10"), 3000000),
        (PO_007, P_017, 300, 7000, Decimal("10"), 2100000),
        (PO_008, P_019, 50, 11000, Decimal("10"), 550000),
        (PO_008, P_020, 25, 22000, Decimal("10"), 550000),
    ]
    for i, (poid, pid, qty, pu, iva, tot) in enumerate(po_items, 1):
        poiid = f"00000000-0000-0000-0000-{900000 + i:012X}"
        await conn.execute("""
            INSERT INTO purchase_order_items (id, purchase_order_id, product_id, cantidad, precio_unitario, iva_tasa, total, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        """, poiid, poid, pid, qty, pu, iva, tot)

    # ═══════════════ SUPPLIER AGREEMENTS (distribuidora) ═══════════════
    sa_id = "00000000-0000-0000-0000-000000000A50"
    await conn.execute("""
        INSERT INTO dist_supplier_agreements (id, company_id, supplier_id, numero, nombre, tipo,
            fecha_inicio, fecha_fin, renovacion_automatica, descuento_general_pct, dias_credito, moneda,
            estado, condiciones, created_at, updated_at)
        VALUES ($1,$2,$3,'SA-001-00001','Acuerdo Comercial Trebol','compra',$4,
            '2027-05-25',true,5,30,'PYG','activo',
            'Descuento general 5%, pago 30 días', NOW(), NOW())
    """, sa_id, COMPANY, SUPP_01, TODAY)

    sa_id2 = "00000000-0000-0000-0000-000000000A51"
    await conn.execute("""
        INSERT INTO dist_supplier_agreements (id, company_id, supplier_id, numero, nombre, tipo,
            fecha_inicio, fecha_fin, renovacion_automatica, descuento_general_pct, bono_volumen_pct, dias_credito, moneda,
            estado, condiciones, created_at, updated_at)
        VALUES ($1,$2,$3,'SA-001-00002','Acuerdo Volumen Coca-Cola','descuento_volumen',$4,
            '2027-05-25',true,8,3,15,'PYG',
            'activo','Bono 3% por volumen mensual', NOW(), NOW())
    """, sa_id2, COMPANY, SUPP_02, TODAY)

    # SA items
    await conn.execute("""
        INSERT INTO dist_supplier_agreement_items (agreement_id, product_id, precio_especial, descuento_pct, cantidad_minima, precio_lista_referencia, created_at)
        VALUES ($1,$2,4300,4.5,50,4500,NOW())
    """, sa_id, P_001)
    await conn.execute("""
        INSERT INTO dist_supplier_agreement_items (agreement_id, product_id, precio_especial, descuento_pct, cantidad_minima, precio_lista_referencia, created_at)
        VALUES ($1,$2,11500,4.2,20,12000,NOW())
    """, sa_id, P_002)
    await conn.execute("""
        INSERT INTO dist_supplier_agreement_items (agreement_id, product_id, precio_especial, descuento_pct, cantidad_minima, precio_lista_referencia, created_at)
        VALUES ($1,$2,5200,4.5,100,5500,NOW())
    """, sa_id2, P_005)

    # ═══════════════ CUSTOMER AGREEMENTS (distribuidora) ═══════════════
    ca_id = "00000000-0000-0000-0000-000000000A60"
    await conn.execute("""
        INSERT INTO customer_agreements (id, company_id, customer_id, numero, nombre, tipo,
            fecha_inicio, fecha_fin, renovacion_automatica, descuento_general_pct, plazo_pago_dias,
            limite_credito, moneda, estado, observaciones, created_at, updated_at)
        VALUES ($1,$2,$3,'CA-001-00001','Acuerdo Hotel Sheraton','precio_especial',
            $4,'2027-05-25',true,10,45,
            100000000,'PYG','activo',
            'Descuento 10% en compras mayoristas, pago 45 días', NOW(), NOW())
    """, ca_id, COMPANY, CUST_06, TODAY)

    ca_id2 = "00000000-0000-0000-0000-000000000A61"
    await conn.execute("""
        INSERT INTO customer_agreements (id, company_id, customer_id, numero, nombre, tipo,
            fecha_inicio, fecha_fin, renovacion_automatica, descuento_general_pct, plazo_pago_dias,
            limite_credito, moneda, estado, created_at, updated_at)
        VALUES ($1,$2,$3,'CA-001-00002','Acuerdo Hospital San Miguel','precio_especial',
            $4,'2027-05-25',true,8,45,
            80000000,'PYG','activo', NOW(), NOW())
    """, ca_id2, COMPANY, CUST_14, TODAY)

    # ═══════════════ PO APPROVAL CONFIG ═══════════════
    poac_id = "00000000-0000-0000-0000-000000000A70"
    await conn.execute("""
        INSERT INTO dist_po_approval_configs (id, company_id, requiere_aprobacion, monto_maximo_sin_aprobacion,
            niveles_aprobacion, aprobadores_nivel1, monto_maximo_nivel1, created_at, updated_at)
        VALUES ($1,$2,true,2000000,1,$3,10000000,NOW(), NOW())
    """, poac_id, COMPANY, f'["{USER_SA}"]')

    # ═══════════════ CREDIT LIMITS (distribuidora) ═══════════════
    cred_limits = [
        (CUST_01, 50000000, 50000000, 0, 30),
        (CUST_06, 100000000, 100000000, 0, 45),
        (CUST_11, 40000000, 40000000, 0, 30),
        (CUST_12, 35000000, 35000000, 0, 30),
        (CUST_14, 80000000, 80000000, 0, 45),
        (CUST_18, 60000000, 60000000, 0, 30),
        (CUST_02, 30000000, 30000000, 0, 30),
    ]
    for i, (cid, lim, disp, used, dias) in enumerate(cred_limits, 1):
        clid = f"00000000-0000-0000-0000-{0xA800 + i:012X}"
        await conn.execute("""
            INSERT INTO customer_credit_limits (id, company_id, customer_id, limite_credito,
                limite_disponible, saldo_utilizado, dias_credito, scoring,
                bloqueado_por_mora, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,85,false,NOW(), NOW())
        """, clid, COMPANY, cid, lim, disp, used, dias)

    # ═══════════════ ACCOUNTS RECEIVABLE ═══════════════
    ar_records = [
        (CUST_01, 50000000, 50000000),
        (CUST_06, 100000000, 100000000),
        (CUST_11, 40000000, 40000000),
        (CUST_12, 35000000, 35000000),
        (CUST_14, 80000000, 80000000),
        (CUST_18, 60000000, 60000000),
    ]
    for i, (cid, saldo, lim) in enumerate(ar_records):
        arid = f"00000000-0000-0000-0000-{0xB000 + i:012X}"
        await conn.execute("""
            INSERT INTO accounts_receivable (company_id, customer_id, saldo, limite_credito, activo, created_at, updated_at)
            VALUES ($1,$2,$3,$4,true,NOW(), NOW())
        """, COMPANY, cid, saldo, lim)

    # ═══════════════ SALES ROUTES ═══════════════
    await conn.execute("""
        INSERT INTO sales_routes (id, company_id, nombre, codigo, user_id, dias_semana, zona, estado, created_at, updated_at)
        VALUES ($1,$2,'Ruta Centro Asunción','R-001',$3,'[1,3,5]','Asunción Centro','activo',NOW(), NOW())
    """, ROUTE_001, COMPANY, USER_VEND1)
    await conn.execute("""
        INSERT INTO sales_routes (id, company_id, nombre, codigo, user_id, dias_semana, zona, estado, created_at, updated_at)
        VALUES ($1,$2,'Ruta San Lorenzo','R-002',$3,'[2,4,6]','San Lorenzo / Capiatá','activo',NOW(), NOW())
    """, ROUTE_002, COMPANY, USER_VEND2)

    # Route customers
    await conn.execute("""
        INSERT INTO route_customers (id, route_id, customer_id, orden_visita, dia_semana, created_at)
        VALUES ($1,$2,$3,1,1,NOW())
    """, RC_001, ROUTE_001, CUST_01)
    await conn.execute("""
        INSERT INTO route_customers (id, route_id, customer_id, orden_visita, dia_semana, created_at)
        VALUES ($1,$2,$3,2,1,NOW())
    """, RC_002, ROUTE_001, CUST_03)
    await conn.execute("""
        INSERT INTO route_customers (id, route_id, customer_id, orden_visita, dia_semana, created_at)
        VALUES ($1,$2,$3,1,2,NOW())
    """, RC_003, ROUTE_002, CUST_05)

    # Route visits
    await conn.execute("""
        INSERT INTO route_visits (id, route_id, route_customer_id, customer_id, user_id,
            fecha_planificada, fecha_visita, estado, resultado, monto_cobrado, notas, created_at)
        VALUES ($1,$2,$3,$4,$5,'2026-05-25','2026-05-25 09:30:00','visitado','pedido_tomado',250000,
            'Cliente realizó pedido de lácteos y bebidas',NOW())
    """, RV_001, ROUTE_001, RC_001, CUST_01, USER_VEND1)
    await conn.execute("""
        INSERT INTO route_visits (id, route_id, route_customer_id, customer_id, user_id,
            fecha_planificada, fecha_visita, estado, resultado, monto_cobrado, notas, created_at)
        VALUES ($1,$2,$3,$4,$5,'2026-05-25','2026-05-25 10:30:00','visitado','cobranza_realizada',60000,
            'Cobro de facturas pendientes',NOW())
    """, RV_002, ROUTE_001, RC_002, CUST_03, USER_VEND1)
    await conn.execute("""
        INSERT INTO route_visits (id, route_id, route_customer_id, customer_id, user_id,
            fecha_planificada, estado, resultado, notas, created_at)
        VALUES ($1,$2,$3,$4,$5,'2026-05-26','pendiente','pendiente',
            'Visita programada para toma de pedido',NOW())
    """, RV_003, ROUTE_002, RC_003, CUST_05, USER_VEND2)

    # ═══════════════ IMPORT CONTAINER ═══════════════
    await conn.execute("""
        INSERT INTO import_containers (id, company_id, supplier_id, numero_contenedor, booking, viaje,
            conocimiento_embarque, puerto_origen, puerto_destino, incoterm, fecha_zarpe, fecha_llegada,
            fecha_nacionalizacion, estado, proveedor_transporte, agente_aduanero, moneda_origen, tipo_cambio,
            valor_fob_total, flete_total, seguro_total, arancel_total, desaduanamiento_total, almacenaje_total,
            transporte_local_total, costo_landed_total, notas, created_at, updated_at)
        VALUES ($1,$2,$3,'CONT-2026-001','BK-2026-001','VIAJE-001','BL-2026-001',
            'Shanghai','Asunción','FOB','2026-04-01','2026-05-15','2026-05-20',
            'nacionalizado','Maersk Line','Despachos Aduaneros PY','USD',7400,
            50000, 5000, 1500, 8000, 3000, 2000, 2500, 72000,
            'Contenedor con productos importados de China (limpieza, personal)',
            NOW(), NOW())
    """, CONT_001, COMPANY, SUPP_08)

    # Import items
    im_i1 = "00000000-0000-0000-0000-000000000B11"
    im_i2 = "00000000-0000-0000-0000-000000000B12"
    await conn.execute("""
        INSERT INTO import_items (id, container_id, product_id, cantidad, unidad_medida,
            precio_unitario_fob, costo_unitario_flete, costo_unitario_seguro,
            costo_unitario_arancel, costo_unitario_desaduanamiento,
            costo_unitario_almacenaje, costo_unitario_transporte_local, costo_unitario_landed, created_at)
        VALUES ($1,$2,$3,2000,'UN',1.50,0.25,0.08,0.40,0.15,0.10,0.12,15500,NOW())
    """, im_i1, CONT_001, P_010)
    await conn.execute("""
        INSERT INTO import_items (id, container_id, product_id, cantidad, unidad_medida,
            precio_unitario_fob, costo_unitario_flete, costo_unitario_seguro,
            costo_unitario_arancel, costo_unitario_desaduanamiento,
            costo_unitario_almacenaje, costo_unitario_transporte_local, costo_unitario_landed, created_at)
        VALUES ($1,$2,$3,1500,'UN',1.20,0.25,0.08,0.35,0.15,0.10,0.12,13000,NOW())
    """, im_i2, CONT_001, P_013)

    # ═══════════════ INTEGRATION CONFIGS ═══════════════
    await conn.execute("""
        INSERT INTO integration_configs (id, company_id, app_name, webhook_url, api_key, enabled, config, created_at, updated_at)
        VALUES ($1,$2,'ecommerce_shopify','https://hooks.shopify.com/py/webhook','sk_test_abc123',true,'{"store":"supermer-test"}',NOW(),NOW())
    """, INTG_001, COMPANY)

    intg2 = "00000000-0000-0000-0000-000000000C02"
    await conn.execute("""
        INSERT INTO integration_configs (id, company_id, app_name, webhook_url, api_key, enabled, config, created_at, updated_at)
        VALUES ($1,$2,'barcode_scanner','https://hooks.scanner.local/webhook','scan_key_456',true,'{"protocol":"tcp"}',NOW(),NOW())
    """, intg2, COMPANY)

    # ═══════════════ SUPPLIER INVOICES (financial) ═══════════════
    inv_1 = "00000000-0000-0000-0000-000000000D10"
    inv_2 = "00000000-0000-0000-0000-000000000D11"
    await conn.execute("""
        INSERT INTO supplier_invoices (id, company_id, supplier_id, numero_factura, timbrado,
            fecha_emision, fecha_recepcion, fecha_vencimiento, subtotal, descuento, iva_10, iva_5,
            total, saldo_pendiente, moneda, condicion, estado, concepto, created_at, updated_at)
        VALUES ($1,$2,$3,'FACT-001-00001','12345678',
            '2026-05-18',$4,'2026-06-17',1250000,0,125000,0,1375000,1375000,
            'PYG','credito','pendiente','Compra lácteos mayo',NOW(),NOW())
    """, inv_1, COMPANY, SUPP_01, TODAY)
    await conn.execute("""
        INSERT INTO supplier_invoices (id, company_id, supplier_id, numero_factura, timbrado,
            fecha_emision, fecha_recepcion, fecha_vencimiento, subtotal, descuento, iva_10, iva_5,
            total, saldo_pendiente, moneda, condicion, estado, concepto, created_at, updated_at)
        VALUES ($1,$2,$3,'FACT-002-00001','12345678',
            '2026-05-18',$4,'2026-06-02',6000000,0,600000,0,6600000,6600000,
            'PYG','credito','pendiente','Compra bebidas mayo',NOW(),NOW())
    """, inv_2, COMPANY, SUPP_02, TODAY)

    # Invoice payments
    invp_1 = "00000000-0000-0000-0000-000000000D20"
    await conn.execute("""
        INSERT INTO supplier_invoice_payments (id, invoice_id, payment_method, monto, moneda,
            fecha_pago, referencia, estado, created_at)
        VALUES ($1,$2,'transferencia',1375000,'PYG',$3,'TRF-2026-001','confirmado',NOW())
    """, invp_1, inv_1, TODAY)

    # ═══════════════ BANK ACCOUNTS ═══════════════
    await conn.execute("""
        INSERT INTO bank_accounts (id, company_id, banco, tipo, numero_cuenta, moneda,
            saldo_inicial, saldo_actual, titular, activo, created_at, updated_at)
        VALUES ($1,$2,'Banco Itaú Paraguay','corriente','900123456','PYG',
            500000000,485000000,'Supermercados Inteligentes S.A.',true,NOW(),NOW())
    """, BA_001, COMPANY)
    await conn.execute("""
        INSERT INTO bank_accounts (id, company_id, banco, tipo, numero_cuenta, moneda,
            saldo_inicial, saldo_actual, titular, activo, created_at, updated_at)
        VALUES ($1,$2,'Banco Continental','ahorro','700654321','USD',
            15000,12000,'Supermercados Inteligentes S.A.',true,NOW(),NOW())
    """, BA_002, COMPANY)

    # Bank transactions
    bt_1 = "00000000-0000-0000-0000-000000000D30"
    await conn.execute("""
        INSERT INTO bank_transactions (id, company_id, bank_account_id, fecha, tipo, monto, moneda,
            descripcion, referencia, contraparte, conciliado, categoria, created_at)
        VALUES ($1,$2,$3,$4,'debito',1375000,'PYG',
            'Pago Factura Trebol','TRF-2026-001','Distribuidora Trebol S.A.',true,'proveedores',NOW())
    """, bt_1, COMPANY, BA_001, TODAY)
    bt_2 = "00000000-0000-0000-0000-000000000D31"
    await conn.execute("""
        INSERT INTO bank_transactions (id, company_id, bank_account_id, fecha, tipo, monto, moneda,
            descripcion, referencia, contraparte, conciliado, categoria, created_at)
        VALUES ($1,$2,$3,$4,'credito',8500000,'PYG',
            'Ventas diarias sucursal','VENTA-2026-05-20','Ventas contado',true,'ventas',NOW())
    """, bt_2, COMPANY, BA_001, TODAY)

    # ═══════════════ BUDGETS ═══════════════
    bgt_1 = "00000000-0000-0000-0000-000000000D40"
    await conn.execute("""
        INSERT INTO budgets (id, company_id, nombre, periodo, categoria, monto_presupuestado,
            monto_ejecutado, monto_disponible, area, tipo, created_at, updated_at)
        VALUES ($1,$2,'Presupuesto Compras Mayo','2026-05','Compras',50000000,
            35000000,15000000,'compras','operativo',NOW(),NOW())
    """, bgt_1, COMPANY)
    bgt_2 = "00000000-0000-0000-0000-000000000D41"
    await conn.execute("""
        INSERT INTO budgets (id, company_id, nombre, periodo, categoria, monto_presupuestado,
            monto_ejecutado, monto_disponible, area, tipo, created_at, updated_at)
        VALUES ($1,$2,'Presupuesto Ventas Mayo','2026-05','Ventas',80000000,
            65000000,15000000,'ventas','operativo',NOW(),NOW())
    """, bgt_2, COMPANY)

    # ═══════════════ CASH FLOW PROJECTIONS ═══════════════
    for days in range(0, 14):
        cfid = f"00000000-0000-0000-0000-{0xE000 + days:012X}"
        d = TODAY + timedelta(days=days)
        await conn.execute("""
            INSERT INTO cash_flow_projections (id, company_id, fecha, saldo_inicial,
                ingresos_estimados, egresos_estimados, saldo_final_proyectado,
                fuente, created_at)
            VALUES ($1,$2,$3,500000000,8000000,5000000,503000000,'automatico',NOW())
        """, cfid, COMPANY, d)

    # ═══════════════ RBAC ═══════════════
    # Permissions
    perms = [
        (PERM_CREATE, "sales.create", "Crear ventas", "ventas"),
        (PERM_READ, "sales.read", "Leer ventas", "ventas"),
        (PERM_UPDATE, "sales.update", "Actualizar ventas", "ventas"),
        (PERM_DELETE, "sales.delete", "Eliminar ventas", "ventas"),
        (PERM_SELL, "pos.sell", "Realizar ventas POS", "pos"),
    ]
    for pid, name, desc, mod in perms:
        await conn.execute("""
            INSERT INTO rbac_permissions (id, name, description, module, created_at)
            VALUES ($1,$2,$3,$4,NOW())
        """, pid, name, desc, mod)

    # Roles
    roles = [
        (ROLE_ADMIN, "super_admin", "Super Administrador", True, False),
        (ROLE_VEND, "vendedor", "Vendedor", False, False),
        (ROLE_OP, "operador", "Operador de Caja", False, True),
    ]
    for rid, name, desc, sys, dflt in roles:
        await conn.execute("""
            INSERT INTO rbac_roles (id, name, description, is_system, is_default, created_at)
            VALUES ($1,$2,$3,$4,$5,NOW())
        """, rid, name, desc, sys, dflt)

    # Role-Permissions
    for perm_id in [PERM_CREATE, PERM_READ, PERM_UPDATE, PERM_DELETE, PERM_SELL]:
        for role_id in [ROLE_ADMIN, ROLE_VEND, ROLE_OP]:
            await conn.execute("""
                INSERT INTO rbac_role_permissions (tenant_id, role_id, permission_id)
                VALUES ($1,$2,$3)
            """, TENANT, role_id, perm_id)

    # User Roles
    for role_id in [ROLE_ADMIN, ROLE_VEND, ROLE_OP]:
        for uid, rid in [(USER_SA, ROLE_ADMIN), (USER_VEND1, ROLE_VEND), (USER_VEND2, ROLE_VEND), (USER_OP1, ROLE_OP)]:
            if role_id == rid:
                await conn.execute("""
                    INSERT INTO rbac_user_roles (user_id, tenant_id, role_id, created_at)
                    VALUES ($1,$2,$3,NOW())
                """, uid, TENANT, rid)

    # ═══════════════ PRICE LISTS ═══════════════
    await conn.execute("""
        INSERT INTO price_lists (id, company_id, nombre, tipo, activa, created_at, updated_at)
        VALUES ($1,$2,'Lista General','general',true,NOW(),NOW())
    """, PL_GENERAL, COMPANY)

    await conn.execute("""
        INSERT INTO price_lists (id, company_id, nombre, tipo, activa, created_at, updated_at)
        VALUES ($1,$2,'Lista Mayorista','grupo',true,NOW(),NOW())
    """, PL_MAYORISTA, COMPANY)

    # ═══════════════ COMMERCIAL AGREEMENTS ═══════════════
    ca3 = "00000000-0000-0000-0000-00000000E010"
    await conn.execute("""
        INSERT INTO commercial_agreements (id, company_id, supplier_id, numero, nombre, tipo, estado,
            fecha_inicio, fecha_fin, condiciones_pago, plazo_pago_dias, moneda, monto_total_acordado,
            monto_ejecutado, created_at, updated_at)
        VALUES ($1,$2,$3,'CA-COM-001','Acuerdo Comercial General Trebol','compra','activo',
            $4,'2027-05-25','Pago 30 días',30,'PYG',50000000,1250000,NOW(),NOW())
    """, ca3, COMPANY, SUPP_01, TODAY)

    # ═══════════════ PROMOTIONS ═══════════════
    prom_1 = "00000000-0000-0000-0000-00000000E020"
    await conn.execute("""
        INSERT INTO promotions (id, company_id, nombre, descripcion, tipo, valor, aplica_a,
            producto_ids, monto_minimo_compra, combinable, valido_desde, valido_hasta, activo, created_at, updated_at)
        VALUES ($1,$2,'2x1 Coca-Cola','Llevá 2 Coca-Cola 2L al precio de 1','dos_por_uno',NULL,'producto',
            $3,0,false,$4,'2026-06-25',true,NOW(),NOW())
    """, prom_1, COMPANY, [P_005], TODAY)

    prom_2 = "00000000-0000-0000-0000-00000000E021"
    await conn.execute("""
        INSERT INTO promotions (id, company_id, nombre, descripcion, tipo, valor, aplica_a,
            categoria_ids, monto_minimo_compra, combinable, valido_desde, valido_hasta, activo, created_at, updated_at)
        VALUES ($1,$2,'10% desc en Lácteos','10% de descuento en lácteos','porcentaje',10.0,'categoria',
            $3,50000,false,$4,'2026-06-25',true,NOW(),NOW())
    """, prom_2, COMPANY, [CAT_LACTEOS], TODAY)

    # ═══════════════ DISCOUNTS ═══════════════
    disc_1 = "00000000-0000-0000-0000-00000000E030"
    await conn.execute("""
        INSERT INTO discounts (id, company_id, nombre, descripcion, tipo, valor, aplica_a,
            producto_ids, monto_minimo, valido_desde, valido_hasta, activo, created_at)
        VALUES ($1,$2,'Desc. 5% Arroz','5% de descuento en Arroz Don Max','porcentaje',5.0,'producto',
            $3,0,$4,'2026-06-25',true,NOW())
    """, disc_1, COMPANY, [P_024], TODAY)

    # ═══════════════ COMMISSION RULES ═══════════════
    comm_1 = "00000000-0000-0000-0000-00000000E040"
    await conn.execute("""
        INSERT INTO commission_rules (id, company_id, nombre, tipo, vendedor_id, porcentaje,
            aplica_a, monto_minimo, valido_desde, valido_hasta, activo, created_at)
        VALUES ($1,$2,'Comisión Vendedor 1','vendedor',$3,3.0,'total',0,
            $4,'2027-05-25',true,NOW())
    """, comm_1, COMPANY, USER_VEND1, TODAY)
    comm_2 = "00000000-0000-0000-0000-00000000E041"
    await conn.execute("""
        INSERT INTO commission_rules (id, company_id, nombre, tipo, vendedor_id, porcentaje,
            aplica_a, monto_minimo, valido_desde, valido_hasta, activo, created_at)
        VALUES ($1,$2,'Comisión Vendedor 2','vendedor',$3,2.5,'total',0,
            $4,'2027-05-25',true,NOW())
    """, comm_2, COMPANY, USER_VEND2, TODAY)

    # ═══════════════ ACCOUNTING ENTRIES (intelicont) ═══════════════
    acct_1 = "00000000-0000-0000-0000-00000000E050"
    await conn.execute("""
        INSERT INTO intelicont_entries (id, company_id, fecha, tipo, descripcion, referencia, monto, sync_status, created_at)
        VALUES ($1,$2,NOW(),'venta','Venta contado Coca-Cola','S-001-000002',8500,'synced',NOW())
    """, acct_1, COMPANY)

    # Entry lines
    await conn.execute("""
        INSERT INTO intelicont_entry_lines (entry_id, cuenta, descripcion, debe, haber, created_at)
        VALUES ($1,'1.01.01','Caja',8500,0,NOW())
    """, acct_1)
    await conn.execute("""
        INSERT INTO intelicont_entry_lines (entry_id, cuenta, descripcion, debe, haber, created_at)
        VALUES ($1,'4.01.01','Venta de Bebidas',0,8500,NOW())
    """, acct_1)

    # ═══════════════ CRM ═══════════════
    lead_1 = "00000000-0000-0000-0000-00000000E060"
    await conn.execute("""
        INSERT INTO crm_leads (id, tenant_id, company_id, nombre, email, telefono, empresa, fuente, estado, puntaje, notas, asignado_a, created_at, updated_at)
        VALUES ($1,$2,$3,'Restaurante El Jardín','info@eljardin.com.py','0216123457','Restaurante El Jardín','web','nuevo',50,'Cliente potencial para ventas mayoristas',$4,NOW(), NOW())
    """, lead_1, TENANT, COMPANY, USER_VEND1)

    # ═══════════════ WHATSAPP CONFIG ═══════════════
    wa_conf = "00000000-0000-0000-0000-00000000E070"
    await conn.execute("""
        INSERT INTO whatsapp_configs (id, tenant_id, account_sid, auth_token, phone_number, webhook_url, enabled, auto_reply, created_at, updated_at)
        VALUES ($1,$2,'ACtest123','test_token','+595981123456','https://hooks.supermer.com/whatsapp',true,true,NOW(),NOW())
    """, wa_conf, TENANT)

    # ═══════════════ INTELIAUDIT CONFIG ═══════════════
    await conn.execute("""
        INSERT INTO inteliaudit_sync_config (id, company_id, webhook_url, api_key, hmac_secret, enabled, auto_sync, created_at, updated_at)
        VALUES ($1,$2,'https://audit.supermer.com/webhook','audit_key_001','hmac_secret_001',true,true,NOW(),NOW())
    """, "00000000-0000-0000-0000-00000000E080", COMPANY)

    # ═══════════════ INTELICONT CONFIG ═══════════════
    await conn.execute("""
        INSERT INTO intelicont_sync_config (id, company_id, webhook_url, api_key, enabled, auto_sync, sync_interval_minutes, created_at, updated_at)
        VALUES ($1,$2,'https://intelicont.supermer.com/sync','cont_key_001',true,true,30,NOW(),NOW())
    """, "00000000-0000-0000-0000-00000000E090", COMPANY)

    # ═══════════════ COMMISSION CALCULATION (sales) ═══════════════
    await conn.execute("""
        INSERT INTO sales_commissions (id, company_id, rule_id, sale_id, vendedor_id, base_calculo, porcentaje, monto_comision, moneda, estado, created_at)
        VALUES ($1,$2,$3,$4,$5,175000,3.0,5250,'PYG','calculada',NOW())
    """, "00000000-0000-0000-0000-00000000E100", COMPANY, comm_1, SALE_011, USER_VEND1)

    # ═══════════════ ECOMMERCE SYNC LOG ═══════════════
    await conn.execute("""
        INSERT INTO ecommerce_sync_logs (id, company_id, tipo, estado, productos_count, errores_count, resultado, created_at)
        VALUES ($1,$2,'catalogo','procesado',150,0,'Catálogo sincronizado con Shopify exitosamente',NOW())
    """, "00000000-0000-0000-0000-00000000E110", COMPANY)

    # ═══════════════ SUPPLIER CONTRACTS (purchases) ═══════════════
    scont = "00000000-0000-0000-0000-00000000E120"
    await conn.execute("""
        INSERT INTO supplier_contracts (id, company_id, supplier_id, numero, nombre,
            fecha_inicio, fecha_fin, moneda, condiciones_pago, plazo_entrega_dias,
            monto_minimo_mensual, monto_maximo_mensual, activo, created_at, updated_at)
        VALUES ($1,$2,$3,'CONT-001','Contrato Anual Trebol',
            $4,'2027-05-25','PYG','Pago 30 días',2,10000000,60000000,true,NOW(),NOW())
    """, scont, COMPANY, SUPP_01, TODAY)

    # ═══════════════ SUPPLIER EVALUATIONS ═══════════════
    seval = "00000000-0000-0000-0000-00000000E130"
    await conn.execute("""
        INSERT INTO supplier_evaluations (id, company_id, supplier_id, periodo,
            puntaje_calidad, puntaje_entrega, puntaje_precio, puntaje_atencion, puntaje_total,
            ordenes_completadas, ordenes_totales, entregas_a_tiempo, entregas_totales,
            comentarios, created_at)
        VALUES ($1,$2,$3,'2026-05',9.0,8.5,7.5,9.0,8.5,5,5,4,5,
            'Buen proveedor, entregas completas pero ligeros retrasos', NOW())
    """, seval, COMPANY, SUPP_01)

    # ═══════════════ SUPPLIER PRICE HISTORY ═══════════════
    sph = "00000000-0000-0000-0000-00000000E140"
    await conn.execute("""
        INSERT INTO supplier_price_history (id, company_id, supplier_id, product_id, precio, moneda, notas, created_at)
        VALUES ($1,$2,$3,$4,4500,'PYG','Precio actual mayo 2026',NOW())
    """, sph, COMPANY, SUPP_01, P_001)

    # ═══════════════ CREDIT ACCOUNTS (credit_accounts) ═══════════════
    for i, cid in enumerate([CUST_01, CUST_06, CUST_11, CUST_12, CUST_14, CUST_18]):
        caid = f"00000000-0000-0000-0000-{0xF000 + i:012X}"
        await conn.execute("""
            INSERT INTO credit_accounts (id, company_id, customer_id, limite_credito, saldo_disponible, saldo_utilizado, activo, created_at, updated_at)
            VALUES ($1,$2,$3,50000000,50000000,0,true,NOW(), NOW())
        """, caid, COMPANY, cid)

    # ═══════════════ SUPERMER MODULE (perishable configs, waste logs) ═══════════════
    # Perishable configs for fresh products
    perishable_prods = [
        (P_018, 7, "carnes"), (P_019, 7, "carnes"), (P_001, 14, "lacteos"),
        (P_002, 30, "lacteos"), (P_003, 21, "lacteos"), (P_032, 5, "verduras"),
        (P_033, 14, "verduras"), (P_034, 5, "frutas"), (P_021, 2, "panificados"),
        (P_022, 2, "panificados"), (P_035, 90, "congelados"),
    ]
    for i, (pid, vida, cat) in enumerate(perishable_prods, 1):
        pconf = f"00000000-0000-0000-0000-{0xF100 + i:012X}"
        await conn.execute("""
            INSERT INTO supermer_perishable_configs (id, company_id, producto_id, vida_util_dias, requiere_markdown, categoria_perecedera, created_at)
            VALUES ($1,$2,$3,$4,true,$5,NOW())
        """, pconf, COMPANY, pid, vida, cat)

    # Receive batch
    rbatch = "00000000-0000-0000-0000-00000000F200"
    await conn.execute("""
        INSERT INTO supermer_receive_batches (id, company_id, producto_id, proveedor_id,
            cantidad_recibida, cantidad_aceptada, calidad, precio_unitario, fecha_recepcion,
            lote_proveedor, lote_codigo_interno, nota_calidad, registrado_por, created_at)
        VALUES ($1,$2,$3,$4,300,295,'estandar',4500,$5,'LOTE-TRB-001','TRB-2026-001',
            'Recepción normal, 5 uds con empaque dañado', $6, NOW())
    """, rbatch, COMPANY, P_001, SUPP_01, TODAY, USER_OP1)

    # Waste log
    wlog = "00000000-0000-0000-0000-00000000F210"
    await conn.execute("""
        INSERT INTO supermer_waste_logs (id, company_id, area, producto_id, cantidad, costo_unitario,
            costo_total, tipo_merma, motivo, fecha, registrado_por)
        VALUES ($1,$2,'panaderia',$3,2,8000,16000,'vencimiento',
            'Pan vencido por exceso de producción', NOW(), $4)
    """, wlog, COMPANY, P_021, USER_OP1)

    # Production recipe (bakery)
    recipe_1 = "00000000-0000-0000-0000-00000000F300"
    await conn.execute("""
        INSERT INTO supermer_recipes (id, company_id, area, nombre, producto_terminado_id,
            cantidad_esperada, unidad_medida, rendimiento_esperado, activa, created_at, updated_at)
        VALUES ($1,$2,'panaderia','Pan Frances Tradicional',$3,50,'UN',95.0,true,NOW(), NOW())
    """, recipe_1, COMPANY, P_021)

    # Recipe ingredients
    ri1 = "00000000-0000-0000-0000-00000000F310"
    ri2 = "00000000-0000-0000-0000-00000000F311"
    await conn.execute("""
        INSERT INTO supermer_recipe_items (id, receta_id, producto_id, cantidad, unidad_medida, es_opcional)
        VALUES ($1,$2,$3,25,'KG',false)
    """, ri1, recipe_1, P_028)
    await conn.execute("""
        INSERT INTO supermer_recipe_items (id, receta_id, producto_id, cantidad, unidad_medida, es_opcional)
        VALUES ($1,$2,$3,0.5,'KG',false)
    """, ri2, recipe_1, P_029)

    # Supplier scorecard
    sc_1 = "00000000-0000-0000-0000-00000000F320"
    await conn.execute("""
        INSERT INTO supermer_supplier_scorecards (id, company_id, proveedor_id, producto_id,
            total_recibido, calidad_promedio, merma_porcentaje, rechazos, entregas_puntuales,
            total_entregas, precio_promedio, puntaje_general, recomendacion, periodo_inicio, periodo_fin, updated_at)
        VALUES ($1,$2,$3,$4,1500,'estandar',2.5,2,8,10,4500,85.0,'preferido',$5,'2026-06-25',NOW())
    """, sc_1, COMPANY, SUPP_01, P_001, TODAY)

    # Purchase forecast (supermer)
    pf_1 = "00000000-0000-0000-0000-00000000F330"
    await conn.execute("""
        INSERT INTO supermer_purchase_forecasts (id, company_id, producto_id, fecha_pronosticada,
            cantidad_pronosticada, confianza, periodo_used, estacionalidad_factor, created_at)
        VALUES ($1,$2,$3,$4,350,85.0,90,1.2,NOW())
    """, pf_1, COMPANY, P_001, TODAY)

    # Butchery template
    bt_id = "00000000-0000-0000-0000-00000000F400"
    await conn.execute("""
        INSERT INTO supermer_butchery_templates (id, company_id, nombre, especie, peso_promedio_kg, descripcion, activa, created_at, updated_at)
        VALUES ($1,$2,'Corte Estándar Bovino','bovino',250.0,'Template de cortes estándar para media res',true,NOW(),NOW())
    """, bt_id, COMPANY)

    # Butchery template cuts
    btc_1 = "00000000-0000-0000-0000-00000000F410"
    btc_2 = "00000000-0000-0000-0000-00000000F411"
    await conn.execute("""
        INSERT INTO supermer_butchery_template_cuts (id, template_id, producto_id, rendimiento_porcentual, precio_ponderado, orden, es_subproducto)
        VALUES ($1,$2,$3,20.0,35.0,1,false)
    """, btc_1, bt_id, P_018)
    await conn.execute("""
        INSERT INTO supermer_butchery_template_cuts (id, template_id, producto_id, rendimiento_porcentual, precio_ponderado, orden, es_subproducto)
        VALUES ($1,$2,$3,15.0,25.0,2,false)
    """, btc_2, bt_id, P_020)

    # ═══════════════ INVENTORY MOVEMENTS ═══════════════
    inv_moves = [
        ("compra", P_001, WH_CENTRAL, 300, 4500, "purchase_order", PO_001, USER_OP1),
        ("compra", P_005, WH_CENTRAL, 1000, 5500, "purchase_order", PO_002, USER_OP1),
        ("compra", P_018, WH_FRIGO, 60, 32000, "purchase_order", PO_003, USER_OP1),
        ("venta", P_018, WH_CENTRAL, 1, 48000, "sale", SALE_001, USER_OP1),
        ("venta", P_032, WH_CENTRAL, 1, 8500, "sale", SALE_001, USER_OP1),
        ("venta", P_033, WH_CENTRAL, 1, 6500, "sale", SALE_001, USER_OP1),
        ("venta", P_005, WH_CENTRAL, 1, 8500, "sale", SALE_002, USER_OP1),
        ("venta", P_024, WH_CENTRAL, 1, 6500, "sale", SALE_002, USER_OP1),
        ("venta", P_001, WH_SUC1, 3, 6500, "sale", SALE_003, USER_OP1),
        ("venta", P_002, WH_SUC1, 1, 17500, "sale", SALE_003, USER_OP1),
        ("venta", P_030, WH_CENTRAL, 5, 18500, "sale", SALE_004, USER_OP1),
        ("venta", P_031, WH_CENTRAL, 3, 21500, "sale", SALE_004, USER_OP1),
        ("venta", P_005, WH_CENTRAL, 50, 8500, "sale", SALE_005, USER_OP1),
        ("venta", P_006, WH_CENTRAL, 30, 7800, "sale", SALE_005, USER_OP1),
        ("ajuste", P_001, WH_CENTRAL, 5, 5000, "adjustment", None, USER_SA),
        ("ajuste", P_005, WH_SUC1, 3, 6000, "adjustment", None, USER_SA),
    ]
    for i, (tp, pid, wid, qty, cost, ref_type, ref_id, uid) in enumerate(inv_moves, 1):
        imid = f"00000000-0000-0000-0000-{0xF500 + i:012X}"
        await conn.execute("""
            INSERT INTO inventory_movements (id, company_id, warehouse_id, product_id, tipo, cantidad,
                costo_unitario, referencia_type, referencia_id, motivo, user_id, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Movimiento semilla',$10,NOW())
        """, imid, COMPANY, wid, pid, tp, qty, cost, ref_type, ref_id, uid)

    # ═══════════════ PURCHASE RECEIPTS ═══════════════
    prec_1 = "00000000-0000-0000-0000-00000000F600"
    await conn.execute("""
        INSERT INTO purchase_receipts (id, company_id, purchase_order_id, warehouse_id, numero,
            fecha, estado, user_id, created_at)
        VALUES ($1,$2,$3,$4,'RCP-001-00001',NOW(),'completado',$5,NOW())
    """, prec_1, COMPANY, PO_001, WH_CENTRAL, USER_OP1)
    prec_2 = "00000000-0000-0000-0000-00000000F601"
    await conn.execute("""
        INSERT INTO purchase_receipts (id, company_id, purchase_order_id, warehouse_id, numero,
            fecha, estado, user_id, created_at)
        VALUES ($1,$2,$3,$4,'RCP-001-00002',NOW(),'completado',$5,NOW())
    """, prec_2, COMPANY, PO_002, WH_CENTRAL, USER_OP1)

    # Receipt items
    await conn.execute("""
        INSERT INTO purchase_receipt_items (receipt_id, product_id, cantidad_ordenada, cantidad_recibida, costo_unitario, created_at)
        VALUES ($1,$2,300,298,4500,NOW())
    """, prec_1, P_001)
    await conn.execute("""
        INSERT INTO purchase_receipt_items (receipt_id, product_id, cantidad_ordenada, cantidad_recibida, costo_unitario, created_at)
        VALUES ($1,$2,100,100,12000,NOW())
    """, prec_1, P_002)
    await conn.execute("""
        INSERT INTO purchase_receipt_items (receipt_id, product_id, cantidad_ordenada, cantidad_recibida, costo_unitario, created_at)
        VALUES ($1,$2,1000,1000,5500,NOW())
    """, prec_2, P_005)
    await conn.execute("""
        INSERT INTO purchase_receipt_items (receipt_id, product_id, cantidad_ordenada, cantidad_recibida, costo_unitario, created_at)
        VALUES ($1,$2,500,500,5000,NOW())
    """, prec_2, P_006)

    # ═══════════════ PURCHASE ORDER HISTORY ═══════════════
    for i, (poid, old_st, new_st) in enumerate([
        (PO_001, "borrador", "aprobado"), (PO_001, "aprobado", "enviado"), (PO_001, "enviado", "recibido"),
        (PO_002, "borrador", "aprobado"), (PO_002, "aprobado", "enviado"), (PO_002, "enviado", "recibido"),
        (PO_005, "borrador", "aprobado"),
    ]):
        poh_id = f"00000000-0000-0000-0000-{0xF610 + i:012X}"
        await conn.execute("""
            INSERT INTO purchase_order_history (purchase_order_id, estado_anterior, estado_nuevo, cambiado_por_nombre, created_at)
            VALUES ($1,$2,$3,'Admin Supermer',NOW())
        """, poid, old_st, new_st)

    # ═══════════════ RETURNS ═══════════════
    ret_1 = "00000000-0000-0000-0000-00000000F700"
    await conn.execute("""
        INSERT INTO returns (id, company_id, branch_id, sale_id, customer_id, numero, fecha, tipo,
            motivo, estado, moneda, subtotal, iva_10, iva_5, total, warehouse_id, observaciones, user_id, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,'R-001-00001',$6,'devolucion','producto_danado','aprobado',
            'PYG',12500,1250,0,13750,$7,'Cliente devolvió 1 Coca-Cola 2L por envase dañado',$8,NOW(),NOW())
    """, ret_1, COMPANY, BR_CENTRAL, SALE_002, CUST_08, now_ts, WH_CENTRAL, USER_OP1)
    ret_2 = "00000000-0000-0000-0000-00000000F701"
    await conn.execute("""
        INSERT INTO returns (id, company_id, branch_id, sale_id, customer_id, numero, fecha, tipo,
            motivo, estado, moneda, subtotal, iva_10, iva_5, total, warehouse_id, observaciones, user_id, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,'R-001-00002',$6,'devolucion','vencimiento','pendiente',
            'PYG',18500,1850,0,20350,$7,'Producto próximo a vencer', $8,NOW(),NOW())
    """, ret_2, COMPANY, BR_SUC1, SALE_003, CUST_05, now_ts, WH_SUC1, USER_OP1)

    # Return items
    await conn.execute("""
        INSERT INTO return_items (return_id, product_id, descripcion, cantidad, precio_unitario, iva_tasa, iva_monto, total, condicion, created_at)
        VALUES ($1,$2,'Coca-Cola 2L envase dañado',1,8500,10,850,8500,'danado',NOW())
    """, ret_1, P_005)
    await conn.execute("""
        INSERT INTO return_items (return_id, product_id, descripcion, cantidad, precio_unitario, iva_tasa, iva_monto, total, condicion, created_at)
        VALUES ($1,$2,'Arroz Don Max 1kg empaque roto',1,6500,5,325,6500,'danado',NOW())
    """, ret_1, P_024)
    await conn.execute("""
        INSERT INTO return_items (return_id, product_id, descripcion, cantidad, precio_unitario, iva_tasa, iva_monto, total, condicion, created_at)
        VALUES ($1,$2,'Leche próxima a vencer',3,6500,10,1950,19500,'buen_estado',NOW())
    """, ret_2, P_001)

    # ═══════════════ PAYMENT ALLOCATIONS ═══════════════
    pay_alloc = [
        (SALE_001, PM_CASH, 44500, "Pago contado S-001-000001"),
        (SALE_002, PM_CASH, 12500, "Pago contado S-001-000002"),
        (SALE_003, PM_DCARD, 26400, "Pago débito S-002-000001"),
        (SALE_006, PM_CCARD, 20350, "Pago crédito S-003-000001"),
        (SALE_007, PM_CASH, 34700, "Pago contado S-004-000001"),
        (SALE_009, PM_CASH, 60000, "Pago contado S-002-000002"),
        (SALE_010, PM_TRANSF, 50000, "Pago parcial transferencia S-003-000002"),
        (SALE_011, PM_TRANSF, 100000, "Pago parcial transferencia S-001-000006"),
    ]
    for i, (sid, pmid, monto, ref) in enumerate(pay_alloc, 1):
        payid = f"00000000-0000-0000-0000-{0xE800 + i:012X}"
        await conn.execute("""
            INSERT INTO payments (id, company_id, tipo, payment_method_id, moneda, monto, monto_pyg,
                fecha, referencia, estado, user_id, created_at)
            VALUES ($1,$2,'venta',$3,'PYG',$4,$4,$5,$6,'confirmado',$7,NOW())
        """, payid, COMPANY, pmid, monto, now_ts, ref, USER_OP1)
        alid = f"00000000-0000-0000-0000-{0xE900 + i:012X}"
        await conn.execute("""
            INSERT INTO payment_allocations (id, payment_id, sale_id, monto_asignado, created_at)
            VALUES ($1,$2,$3,$4,NOW())
        """, alid, payid, sid, monto)

    # ═══════════════ NOTAS CRÉDITO/DÉBITO ═══════════════
    nc_1 = "00000000-0000-0000-0000-00000000EA00"
    await conn.execute("""
        INSERT INTO notas_credito_debito (id, company_id, sale_id, tipo, numero, motivo,
            subtotal, descuento_total, base_gravada_10, base_gravada_5, base_exenta,
            iva_10, iva_5, total, estado, user_id, created_at, updated_at)
        VALUES ($1,$2,$3,'credito','NC-001-00001','Devolución producto dañado',
            12500,0,8500,4000,0,850,200,13750,'emitido',$4,NOW(),NOW())
    """, nc_1, COMPANY, SALE_002, USER_OP1)

    # ═══════════════ SUPPLIER CONTRACT ITEMS ═══════════════
    sci_1 = "00000000-0000-0000-0000-00000000EB00"
    await conn.execute("""
        INSERT INTO supplier_contract_items (id, contract_id, product_id, precio_acordado, moneda, cantidad_minima, descuento_pct, created_at)
        VALUES ($1,$2,$3,4300,'PYG',50,4.5,NOW())
    """, sci_1, scont, P_001)
    sci_2 = "00000000-0000-0000-0000-00000000EB01"
    await conn.execute("""
        INSERT INTO supplier_contract_items (id, contract_id, product_id, precio_acordado, moneda, cantidad_minima, descuento_pct, created_at)
        VALUES ($1,$2,$3,11500,'PYG',20,4.2,NOW())
    """, sci_2, scont, P_002)

    # ═══════════════ CRM: OPORTUNIDADES Y ACTIVIDADES ═══════════════
    oport_1 = "00000000-0000-0000-0000-00000000EC00"
    await conn.execute("""
        INSERT INTO crm_oportunidades (id, tenant_id, company_id, lead_id, nombre, monto_estimado,
            etapa, probabilidad, cliente_id, fecha_cierre_estimada, notas, asignado_a, created_at, updated_at)
        VALUES ($1,$2,$3,$4,'Venta Mayorista Restaurante El Jardín',25000000,
            'negociacion',60,$5,'2026-07-15','Cliente interesado en compras semanales de carnes y verduras',
            $6,NOW(),NOW())
    """, oport_1, TENANT, COMPANY, lead_1, CUST_03, USER_VEND1)

    act_1 = "00000000-0000-0000-0000-00000000EC10"
    await conn.execute("""
        INSERT INTO crm_actividades (id, tenant_id, oportunidad_id, lead_id, tipo, titulo,
            descripcion, fecha, hora, duracion_min, completada, asignado_a, created_at, updated_at)
        VALUES ($1,$2,$3,$4,'llamada','Seguimiento cotización',
            'Llamar para confirmar precios y detalles de entrega','2026-05-26','10:00:00',30,false,$5,NOW(),NOW())
    """, act_1, TENANT, oport_1, lead_1, USER_VEND1)

    # ═══════════════ WHATSAPP DATA ═══════════════
    wa_conv = "00000000-0000-0000-0000-00000000ED00"
    await conn.execute("""
        INSERT INTO whatsapp_conversations (id, tenant_id, contact_name, contact_phone, last_message_at, status, created_at)
        VALUES ($1,$2,'Juan Pérez','+595981654321',NOW(),'active',NOW())
    """, wa_conv, TENANT)

    wa_msg_1 = "00000000-0000-0000-0000-00000000ED10"
    await conn.execute("""
        INSERT INTO whatsapp_messages (id, tenant_id, conversation_id, direction, content, status, created_at)
        VALUES ($1,$2,$3,'inbound','Hola, quisiera consultar por el precio de la leche Trebol','delivered',NOW())
    """, wa_msg_1, TENANT, wa_conv)
    wa_msg_2 = "00000000-0000-0000-0000-00000000ED11"
    await conn.execute("""
        INSERT INTO whatsapp_messages (id, tenant_id, conversation_id, direction, content, status, created_at)
        VALUES ($1,$2,$3,'outbound','La leche Trebol 1L está a Gs. 6.500. Tenemos promoción 2x1 en Coca-Cola','delivered',NOW())
    """, wa_msg_2, TENANT, wa_conv)

    # ═══════════════ PROMOTION USAGE ═══════════════
    pu_1 = "00000000-0000-0000-0000-00000000EE00"
    await conn.execute("""
        INSERT INTO promotion_usages (id, promotion_id, company_id, sale_id, customer_id, branch_id, descuento_aplicado, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,8500,NOW())
    """, pu_1, prom_1, COMPANY, SALE_005, CUST_06, BR_CENTRAL)

    # ═══════════════ FRESHNESS AUDIT ═══════════════
    fa_1 = "00000000-0000-0000-0000-00000000EF00"
    await conn.execute("""
        INSERT INTO supermer_freshness_audits (id, company_id, producto_id, batch_id, calidad_actual,
            firmeza, color, aspecto_general, notas, audited_by, audited_at, triggered_markdown)
        VALUES ($1,$2,$3,$4,'bueno',4,4,4,'Producto en buen estado, apto para venta',$5,NOW(),false)
    """, fa_1, COMPANY, P_032, rbatch, USER_OP1)

    # ═══════════════ BAKERY PLANS ═══════════════
    bp_1 = "00000000-0000-0000-0000-00000000F000"
    await conn.execute("""
        INSERT INTO supermer_bakery_plans (id, company_id, nombre, dia_semana, activo, created_at, updated_at)
        VALUES ($1,$2,'Plan Diario Panadería',7,true,NOW(),NOW())
    """, bp_1, COMPANY)

    bp_i1 = "00000000-0000-0000-0000-00000000F010"
    await conn.execute("""
        INSERT INTO supermer_bakery_plan_items (id, plan_id, receta_id, cantidad_objetivo, prioridad)
        VALUES ($1,$2,$3,100,1)
    """, bp_i1, bp_1, recipe_1)

    # ═══════════════ MARKDOWN LOG ═══════════════
    md_1 = "00000000-0000-0000-0000-00000000F020"
    await conn.execute("""
        INSERT INTO supermer_markdown_logs (id, company_id, producto_id, descuento_porcentaje,
            precio_original, precio_markdown, fecha_inicio, fecha_fin, activo, creado_por, motivo, created_at)
        VALUES ($1,$2,$3,20,48000,38400,$4,'2026-05-28',true,$5,'Proximidad a vencimiento, 5 días restantes',NOW())
    """, md_1, COMPANY, P_018, now_ts, USER_OP1)

    # ═══════════════ FORECAST RULES ═══════════════
    fr_1 = "00000000-0000-0000-0000-00000000F030"
    await conn.execute("""
        INSERT INTO forecast_rules (id, company_id, nombre, activo, tipo, metodo, dias_historial,
            dias_proyeccion, nivel_servicio, lead_time_dias, stock_seguridad_dias, created_at, updated_at)
        VALUES ($1,$2,'Regla Lácteos',true,'producto','promedio_movil',90,30,95,2,3,NOW(),NOW())
    """, fr_1, COMPANY)

    # ═══════════════ AGREEMENT REBATES AND VOLUMES ═══════════════
    ar_1 = "00000000-0000-0000-0000-00000000F040"
    await conn.execute("""
        INSERT INTO agreement_rebates (id, agreement_id, supplier_id, periodo, tipo,
            umbral_desde, umbral_hasta, valor_rebate, estado, created_at)
        VALUES ($1,$2,$3,'2026-05','volumen',10000000,30000000,500000,'pendiente',NOW())
    """, ar_1, ca3, SUPP_01)

    av_1 = "00000000-0000-0000-0000-00000000F050"
    await conn.execute("""
        INSERT INTO agreement_volumes (id, agreement_id, supplier_id, periodo, tipo_periodo,
            volumen_comprometido, volumen_real, monto_comprometido, monto_real,
            porcentaje_cumplimiento, estado, created_at, updated_at)
        VALUES ($1,$2,$3,'2026-05','mensual',5000,1200,50000000,12500000,25.0,'abierto',NOW(), NOW())
    """, av_1, ca3, SUPP_01)

    # ═══════════════ TIMBRADO USAGE ═══════════════
    tu_1 = "00000000-0000-0000-0000-00000000F060"
    await conn.execute("""
        INSERT INTO timbrado_usage (id, timbrado_id, company_id, numero_utilizado, sale_id, tipo_documento, used_at)
        VALUES ($1,$2,$3,1,$4,'factura',NOW())
    """, tu_1, TIMBRADO, COMPANY, SALE_001)
    tu_2 = "00000000-0000-0000-0000-00000000F061"
    await conn.execute("""
        INSERT INTO timbrado_usage (id, timbrado_id, company_id, numero_utilizado, sale_id, tipo_documento, used_at)
        VALUES ($1,$2,$3,2,$4,'factura',NOW())
    """, tu_2, TIMBRADO, COMPANY, SALE_002)

    # ═══════════════ PURCHASE REQUISITIONS ═══════════════
    preq_1 = "00000000-0000-0000-0000-00000000F070"
    await conn.execute("""
        INSERT INTO purchase_requisitions (id, company_id, numero, fecha, departamento,
            solicitante_nombre, estado, prioridad, moneda, subtotal, total, motivo, user_id, created_at, updated_at)
        VALUES ($1,$2,'RQ-001-00001',$3,'Carnicería','Pedro Cartero','aprobado','alta','PYG',960000,960000,
            'Reposición de carnes para fin de semana',$4,NOW(),NOW())
    """, preq_1, COMPANY, now_ts, USER_OP1)
    preq_i1 = "00000000-0000-0000-0000-00000000F071"
    await conn.execute("""
        INSERT INTO purchase_requisition_items (id, requisition_id, product_id, descripcion,
            cantidad_solicitada, cantidad_aprobada, precio_estimado, total_estimado, created_at)
        VALUES ($1,$2,$3,'Vacio 1kg',30,30,32000,960000,NOW())
    """, preq_i1, preq_1, P_018)

    # ═══════════════ SUPPLIER EVALUATIONS (add more) ═══════════════
    se_2 = "00000000-0000-0000-0000-00000000F080"
    await conn.execute("""
        INSERT INTO supplier_evaluations (id, company_id, supplier_id, periodo,
            puntaje_calidad, puntaje_entrega, puntaje_precio, puntaje_atencion, puntaje_total,
            ordenes_completadas, ordenes_totales, entregas_a_tiempo, entregas_totales, comentarios, created_at)
        VALUES ($1,$2,$3,'2026-05',8.0,9.0,7.0,8.0,8.0,
            2,2,2,2,'Excelente proveedor de bebidas', NOW())
    """, se_2, COMPANY, SUPP_02)
    se_3 = "00000000-0000-0000-0000-00000000F081"
    await conn.execute("""
        INSERT INTO supplier_evaluations (id, company_id, supplier_id, periodo,
            puntaje_calidad, puntaje_entrega, puntaje_precio, puntaje_atencion, puntaje_total,
            ordenes_completadas, ordenes_totales, entregas_a_tiempo, entregas_totales, comentarios, created_at)
        VALUES ($1,$2,$3,'2026-05',9.5,7.0,6.5,8.0,7.75,
            1,1,0,1,'Buena calidad, pero entrega tardía', NOW())
    """, se_3, COMPANY, SUPP_05)

    # ═══════════════ FINANCING (payment module) ═══════════════
    fin_1 = "00000000-0000-0000-0000-00000000F090"
    await conn.execute("""
        INSERT INTO financings (id, company_id, customer_id, sale_id, monto_financiado,
            tasa_interes_mensual, cantidad_cuotas, monto_cuota, moneda,
            fecha_primera_cuota, estado, created_at)
        VALUES ($1,$2,$3,$4,272500,2.5,6,49050,'PYG',
            '2026-06-25','activo',NOW())
    """, fin_1, COMPANY, CUST_01, SALE_004)

    for cuota in range(1, 7):
        fiid = f"00000000-0000-0000-0000-{0xF100 + cuota:012X}"
        fv = date(2026, 6 + cuota, 25)
        await conn.execute("""
            INSERT INTO financing_installments (id, financing_id, numero_cuota, fecha_vencimiento, monto, monto_pagado, estado, created_at)
            VALUES ($1,$2,$3,$4,49050,0,'pendiente',NOW())
        """, fiid, fin_1, cuota, fv)

    # ═══════════════ CUSTOMER WALLETS ═══════════════
    cw_1 = "00000000-0000-0000-0000-00000000F200"
    await conn.execute("""
        INSERT INTO customer_wallets (id, company_id, customer_id, saldo, moneda, updated_at)
        VALUES ($1,$2,$3,150000,'PYG',NOW())
    """, cw_1, COMPANY, CUST_06)
    wt_1 = "00000000-0000-0000-0000-00000000F210"
    await conn.execute("""
        INSERT INTO wallet_transactions (id, wallet_id, tipo, monto, referencia_type, referencia_id, motivo, created_at)
        VALUES ($1,$2,'carga',150000,'payment',NULL,'Carga inicial de billetera',NOW())
    """, wt_1, cw_1)

    # ═══════════════ CUSTOMER ACCOUNTS ═══════════════
    ca_acc_1 = "00000000-0000-0000-0000-00000000F220"
    await conn.execute("""
        INSERT INTO customer_accounts (id, customer_id, moneda, limite_credito, saldo_actual, dias_plazo, activo, created_at)
        VALUES ($1,$2,'PYG',50000000,272500,30,true,NOW())
    """, ca_acc_1, CUST_01)

    # ═══════════════ PRODUCTION ORDER (supermer) ═══════════════
    prod_ord_1 = "00000000-0000-0000-0000-00000000F300"
    await conn.execute("""
        INSERT INTO supermer_production_orders (id, company_id, receta_id, area, cantidad_objetivo,
            estado, fecha_inicio, responsable_id, notas, created_at, updated_at)
        VALUES ($1,$2,$3,'panaderia',100,'planificada',$4,$5,
            'Orden de producción diaria de pan francés',NOW(),NOW())
    """, prod_ord_1, COMPANY, recipe_1, now_ts, USER_OP1)

    # Production batch
    pb_1 = "00000000-0000-0000-0000-00000000F310"
    await conn.execute("""
        INSERT INTO supermer_production_batches (id, company_id, orden_id, producto_id, cantidad_obtenida,
            fecha_produccion, fecha_vencimiento, lote_codigo, costo_unitario, created_at)
        VALUES ($1,$2,$3,$4,95,NOW(),'2026-05-27','PAN-2026-001',7000,NOW())
    """, pb_1, COMPANY, prod_ord_1, P_021)

    # ═══════════════ SIFEN RESPONSES ═══════════════
    sif_resp_1 = "00000000-0000-0000-0000-00000000F400"
    await conn.execute("""
        INSERT INTO sifen_responses (id, sale_id, cdc, estado, xml_sent, xml_response, fecha_envio, fecha_respuesta, created_at)
        VALUES ($1,$2,'12345678901234567890123456789012345678901234','aceptado','<kyc>...</kyc>','<kycResp>...</kycResp>',NOW(),NOW(), NOW())
    """, sif_resp_1, SALE_001)
    sif_resp_2 = "00000000-0000-0000-0000-00000000F401"
    await conn.execute("""
        INSERT INTO sifen_responses (id, sale_id, cdc, estado, xml_sent, xml_response, fecha_envio, fecha_respuesta, created_at)
        VALUES ($1,$2,'22345678901234567890123456789012345678901234','aceptado','<kyc>...</kyc>','<kycResp>...</kycResp>',NOW(),NOW(), NOW())
    """, sif_resp_2, SALE_002)

    print("OK - Seed completed successfully!")


async def main():
    import os
    dsn = os.getenv("DATABASE_URL", DSN)
    if dsn.startswith("postgresql+asyncpg://"):
        dsn = dsn.replace("postgresql+asyncpg://", "postgresql://")
    if os.path.exists("/.dockerenv") and "localhost" in dsn:
        dsn = dsn.replace("localhost", "db")
    print(f"Connecting to: {dsn}")
    conn = await asyncpg.connect(dsn)
    try:
        await clean_db(conn)
        await seed(conn)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
