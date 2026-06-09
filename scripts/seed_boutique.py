"""Seed data for Boutique/Indumentaria module (bout_*) - aligned with models.py"""
import asyncio
import json
import random
from datetime import date, datetime, timedelta
from uuid import UUID, uuid4
from decimal import Decimal

import asyncpg

random.seed(42)

DB = "postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket"
CID = "00000000-0000-0000-0000-000000000010"

# ============================================================
# DATA DEFINITIONS
# ============================================================

SIZES = [
    ("S01", "PP", "Ropa", 1, Decimal("82")),
    ("S02", "P", "Ropa", 2, Decimal("88")),
    ("S03", "M", "Ropa", 3, Decimal("94")),
    ("S04", "G", "Ropa", 4, Decimal("100")),
    ("S05", "GG", "Ropa", 5, Decimal("106")),
    ("S06", "EXG", "Ropa", 6, Decimal("112")),
    ("S07", "S (Hombre)", "Ropa", 7, Decimal("96")),
    ("S08", "L (Hombre)", "Ropa", 8, Decimal("108")),
    ("S09", "XL (Hombre)", "Ropa", 9, Decimal("114")),
    ("S10", "34", "Calzado", 10, None),
    ("S11", "36", "Calzado", 11, None),
    ("S12", "38", "Calzado", 12, None),
    ("S13", "40", "Calzado", 13, None),
    ("S14", "42", "Calzado", 14, None),
    ("S15", "Talle Unico", "Accesorios", 15, None),
]

COLORS = [
    ("C01", "Rojo", "#FF0000", "Rojos"),
    ("C02", "Azul", "#0000FF", "Azules"),
    ("C03", "Verde", "#00AA00", "Verdes"),
    ("C04", "Negro", "#000000", "Neutros"),
    ("C05", "Blanco", "#FFFFFF", "Neutros"),
    ("C06", "Gris", "#808080", "Neutros"),
    ("C07", "Rosa", "#FF69B4", "Rosados"),
    ("C08", "Amarillo", "#FFD700", "Amarillos"),
    ("C09", "Naranja", "#FFA500", "Naranjas"),
    ("C10", "Violeta", "#8A2BE2", "Violetas"),
    ("C11", "Celeste", "#87CEEB", "Azules"),
    ("C12", "Marron", "#8B4513", "Marrones"),
    ("C13", "Beige", "#F5F5DC", "Neutros"),
    ("C14", "Borgo\xf1a", "#800020", "Rojos"),
    ("C15", "Mostaza", "#FFDB58", "Amarillos"),
    ("C16", "Turquesa", "#40E0D0", "Verdes"),
    ("C17", "Coral", "#FF7F50", "Naranjas"),
    ("C18", "Lavanda", "#E6E6FA", "Violetas"),
    ("C19", "Camel", "#C19A6B", "Marrones"),
    ("C20", "Crema", "#FFFDD0", "Neutros"),
]

CATEGORIES = [
    ("CAT-MUJ", "Mujer", "Ropa y accesorios femeninos", None, 0),
    ("CAT-HOM", "Hombre", "Ropa y accesorios masculinos", None, 0),
    ("CAT-NIN", "Ni\xf1os", "Ropa infantil y bebe", None, 0),
    ("CAT-ACC", "Accesorios", "Carteras, relojes, joyeria", None, 0),
    ("CAT-CAL", "Calzado", "Zapatos, sandalias, zapatillas", None, 0),
    ("CAT-TMP", "Temporada", "Linea de temporada", None, 0),
]

COLLECTIONS = [
    ("COL-PV-2026", "Primavera-Verano 2026", "Coleccion primavera-verano", "primavera_verano", 2026),
    ("COL-OI-2026", "Oto\xf1o-Invierno 2026", "Coleccion otono-invierno", "otonio_invierno", 2026),
    ("COL-NUP-2026", "Nupcial 2026", "Coleccion de novias y quinceaneras", "primavera_verano", 2026),
    ("COL-URB-2026", "Urbana Streetwear 2026", "Estilo urbano y streetwear", "primavera_verano", 2026),
    ("COL-RES-2026", "Resort Caribe 2026", "Linea resort y playa", "primavera_verano", 2026),
    ("COL-CWK-2026", "Casual Work 2026", "Moda laboral casual", "otonio_invierno", 2026),
    ("COL-GALA-2026", "Fiesta & Gala 2026", "Alta costura para eventos", "otonio_invierno", 2026),
    ("COL-DEP-2026", "Deportiva Elite 2026", "Ropa deportiva premium", "primavera_verano", 2026),
]

PRODUCTS_BY_CATEGORY = {
    "CAT-MUJ": [
        ("MUJ-001", "Vestido Floral Primavera", "Vestido largo con estampado floral", "mujer",
         Decimal("180000"), Decimal("90000"), True, False, "Algodon", "Lavar a maquina max 30C"),
        ("MUJ-002", "Blusa Seda Elegante", "Blusa de seda natural manga larga", "mujer",
         Decimal("250000"), Decimal("125000"), False, False, "Seda", "Lavado en seco"),
        ("MUJ-003", "Falda Plisada Midi", "Falda plisada hasta la rodilla", "mujer",
         Decimal("220000"), Decimal("110000"), False, False, "Poli\u00e9ster", "Lavar a mano"),
        ("MUJ-004", "Pantalon Palazzo", "Pantalon palazzo de tiro alto", "mujer",
         Decimal("280000"), Decimal("140000"), False, False, "Viscosa", "Lavar a maquina"),
        ("MUJ-005", "Chaqueta Jean Cropped", "Chaqueta vaquera corta", "mujer",
         Decimal("350000"), Decimal("175000"), True, False, "Denim", "Lavar del reves"),
        ("MUJ-006", "Top Basico Algodon", "Top basico de algodon mercerizado", "mujer",
         Decimal("85000"), Decimal("42500"), True, False, "Algodon mercerizado", "Lavar a maquina"),
        ("MUJ-007", "Enterizo Noche", "Enterizo de fiesta con escote", "mujer",
         Decimal("450000"), Decimal("225000"), False, False, "Tafeta", "Lavado en seco"),
        ("MUJ-008", "Cardigan Lana Merino", "Cardigan de lana merino suave", "mujer",
         Decimal("320000"), Decimal("160000"), False, True, "Lana merino", "Lavar a mano"),
    ],
    "CAT-HOM": [
        ("HOM-001", "Camisa Oxford", "Camisa clasica oxford manga larga", "hombre",
         Decimal("220000"), Decimal("110000"), True, False, "Algodon", "Lavar a maquina"),
        ("HOM-002", "Jean Slim Fit", "Jean ajustado elastizado", "hombre",
         Decimal("280000"), Decimal("140000"), True, False, "Denim elastizado", "Lavar del reves"),
        ("HOM-003", "Bermuda Gabardina", "Bermuda de gabardina clasica", "hombre",
         Decimal("190000"), Decimal("95000"), False, False, "Gabardina", "Lavar a maquina"),
        ("HOM-004", "Blazer Casual Lino", "Blazer de lino natural", "hombre",
         Decimal("550000"), Decimal("275000"), False, False, "Lino", "Lavado en seco"),
        ("HOM-005", "Polo Algodon Peruano", "Polo de algodon pima", "hombre",
         Decimal("200000"), Decimal("100000"), True, False, "Algodon pima", "Lavar a maquina"),
        ("HOM-006", "Chino Pant Clasico", "Pantalon chino clasico", "hombre",
         Decimal("250000"), Decimal("125000"), True, False, "Algodon sarzado", "Lavar a maquina"),
        ("HOM-007", "Campera Cuero", "Campera de cuero genuino", "hombre",
         Decimal("950000"), Decimal("475000"), False, False, "Cuero", "Limpieza profesional"),
        ("HOM-008", "Musculosa Deportiva", "Musculosa dry-fit", "hombre",
         Decimal("100000"), Decimal("50000"), True, False, "Poliester", "Lavar a maquina"),
    ],
    "CAT-NIN": [
        ("NIN-001", "Conjunto Bebe Algodon", "Conjunto body + pantalon bebe", "unisex",
         Decimal("95000"), Decimal("47500"), True, False, "Algodon organico", "Lavar a maquina"),
        ("NIN-002", "Vestido Nina Floral", "Vestido infantil con lazo", "nina",
         Decimal("130000"), Decimal("65000"), False, False, "Algodon", "Lavar a maquina"),
        ("NIN-003", "Short Nino Jean", "Short vaquero infantil", "nino",
         Decimal("110000"), Decimal("55000"), True, False, "Denim suave", "Lavar a maquina"),
        ("NIN-004", "Buzo Friza Disney", "Buzo con estampado Disney", "unisex",
         Decimal("160000"), Decimal("80000"), True, False, "Friza", "Lavar del reves"),
        ("NIN-005", "Enterito Bebe", "Enterito de algodon con botones", "unisex",
         Decimal("85000"), Decimal("42500"), True, False, "Algodon", "Lavar a maquina"),
        ("NIN-006", "Camiseta Estampada", "Camiseta con estampado infantil", "unisex",
         Decimal("75000"), Decimal("37500"), True, False, "Algodon", "Lavar a maquina"),
        ("NIN-007", "Pollera Tul", "Pollera de tul para nina", "nina",
         Decimal("120000"), Decimal("60000"), False, False, "Tul", "Lavar a mano"),
        ("NIN-008", "Camisa Nino Formal", "Camisa infantil para eventos", "nino",
         Decimal("140000"), Decimal("70000"), True, False, "Algodon", "Lavar a maquina"),
    ],
    "CAT-ACC": [
        ("ACC-001", "Cartera Cuero Natural", "Cartera de cuero vacuno", "mujer",
         Decimal("650000"), Decimal("325000"), False, False, "Cuero", "Limpiar con pa\u00f1o humedo"),
        ("ACC-002", "Reloj Acero Inoxidable", "Reloj analogo acero inoxidable", "hombre",
         Decimal("400000"), Decimal("200000"), False, False, "Acero inoxidable", "Evitar agua"),
        ("ACC-003", "Gafas Sol Polarizadas", "Gafas de sol con filtro UV400", "unisex",
         Decimal("280000"), Decimal("140000"), False, False, "Acetato", "Limpiar con microfibra"),
        ("ACC-004", "Cinturon Cuero", "Cinturon de cuero hebilla niquel", "hombre",
         Decimal("200000"), Decimal("100000"), True, False, "Cuero", "Limpiar con betun"),
        ("ACC-005", "Bufanda Cashmere", "Bufanda de cashmere italiano", "unisex",
         Decimal("350000"), Decimal("175000"), False, True, "Cashmere", "Lavado en seco"),
        ("ACC-006", "Sombrero Panama", "Sombrero panama de paja toquilla", "unisex",
         Decimal("250000"), Decimal("125000"), False, False, "Paja toquilla", "Limpiar con cepillo"),
        ("ACC-007", "Mochila Eco-Cuero", "Mochila de cuero ecologico", "unisex",
         Decimal("380000"), Decimal("190000"), False, False, "Cuero ecologico", "Limpiar con pa\u00f1o"),
        ("ACC-008", "Set Joyeria Fina", "Set aretes + collar + pulsera", "mujer",
         Decimal("500000"), Decimal("250000"), False, False, "Acero quirurgico", "Evitar agua"),
    ],
    "CAT-CAL": [
        ("CAL-001", "Zapato Tacon Aguja", "Zapato tacon aguja punta fina", "mujer",
         Decimal("380000"), Decimal("190000"), False, False, "Cuero charol", "Limpiar con betun"),
        ("CAL-002", "Zapatilla Urbana Blanca", "Zapatilla urbana cuero blanco", "unisex",
         Decimal("320000"), Decimal("160000"), True, False, "Cuero", "Limpiar con crema blanca"),
        ("CAL-003", "Sandalia Cuna", "Sandalia de cuna tejida", "mujer",
         Decimal("240000"), Decimal("120000"), False, False, "Cuero tejido", "Limpiar con pa\u00f1o"),
        ("CAL-004", "Zapato Oxford Hombre", "Zapato oxford capellada recta", "hombre",
         Decimal("420000"), Decimal("210000"), True, False, "Cuero", "Betun y cepillado"),
        ("CAL-005", "Bota Cuero Cana Alta", "Bota de cuero cana alta", "mujer",
         Decimal("600000"), Decimal("300000"), False, False, "Cuero", "Impermeabilizar"),
        ("CAL-006", "Ojota Havanna Estilo", "Ojota estilo havanna", "unisex",
         Decimal("110000"), Decimal("55000"), True, False, "Goma", "Lavar con agua"),
        ("CAL-007", "Mocasin Driving", "Mocasin tipo driving", "hombre",
         Decimal("350000"), Decimal("175000"), False, False, "Cuero suave", "Limpiar con crema"),
        ("CAL-008", "Botin Chelsea", "Botin chelsea elastico", "unisex",
         Decimal("480000"), Decimal("240000"), False, False, "Cuero", "Impermeabilizar"),
    ],
    "CAT-TMP": [
        ("TMP-001", "Traje Bano Entero", "Traje de bano entero push-up", "mujer",
         Decimal("220000"), Decimal("110000"), False, False, "Poliamida", "Enjuagar despues de usar"),
        ("TMP-002", "Bikini Triangulo", "Bikini triangulo top + bombacha", "mujer",
         Decimal("150000"), Decimal("75000"), False, False, "Poliamida", "Enjuagar despues de usar"),
        ("TMP-003", "Kimono Playa Estampado", "Kimono de playa estampado tropical", "mujer",
         Decimal("250000"), Decimal("125000"), False, False, "Viscosa", "Lavar a mano"),
        ("TMP-004", "Poncho Invierno Lana", "Ponco de lana gruesa", "unisex",
         Decimal("380000"), Decimal("190000"), False, True, "Lana", "Lavado en seco"),
        ("TMP-005", "Campera Rompeviento", "Campera rompeviento plegable", "unisex",
         Decimal("450000"), Decimal("225000"), True, False, "Nylon", "Lavar a maquina"),
        ("TMP-006", "Sweater Navidad Diseno", "Sweater navideno con grafico", "unisex",
         Decimal("200000"), Decimal("100000"), False, True, "Acrilico", "Lavar a mano"),
        ("TMP-007", "Guantes Cuero Forrados", "Guantes de cuero con forro polar", "unisex",
         Decimal("180000"), Decimal("90000"), False, True, "Cuero", "Limpieza profesional"),
        ("TMP-008", "Gorro Lana Navidad", "Gorro de lana con pompom", "unisex",
         Decimal("90000"), Decimal("45000"), True, False, "Acrilico", "Lavar a mano"),
    ],
}

CLIENT_NAMES = [
    "Maria Gonzalez", "Juan Perez", "Ana Martinez", "Carlos Lopez", "Laura Rodriguez",
    "Pedro Sanchez", "Sofia Gimenez", "Diego Benitez", "Valentina Acosta", "Mateo Duarte",
    "Camila Fleitas", "Sebastian Ibarra", "Luciana Jara", "Facundo Klassen", "Isabella Lird",
    "Santiago Mendez", "Emilia Nunez", "Benjamin Orte", "Martina Paredes", "Tomas Quintana",
    "Victoria Rivarola", "Nicolas Salinas", "Josefina Torres", "Gabriel Ugarte", "Catalina Valiente",
    "Daniela Acuna", "Eduardo Britez", "Florencia Cabrera", "Fernando Colman", "Guillermina Denis",
    "Agustin Encina", "Celeste Espinola", "Lautaro Figueredo", "Graciela Galeano", "Ignacio Godoy",
    "Marina Gonzalez", "Andres Guerrero", "Rocio Haedo", "Bruno Hermosilla", "Milagros Insfran",
    "Alejandro Jure", "Noelia Klassen", "Lucas Leguizamon", "Paulina Machuca", "Maximiliano Medina",
    "Carolina Melgarejo", "Hernan Oviedo", "Romina Penayo", "Julian Rojas", "Belen Servin",
]

CLIENT_EMAILS = [
    "maria.g@gmail.com", "juan.perez@yahoo.com", "ana.martinez@hotmail.com", "carlos.lopez@gmail.com",
    "laura.rodriguez@yahoo.com", "pedro.sanchez@hotmail.com", "sofia.gimenez@gmail.com",
    "diego.benitez@yahoo.com", "valentina.acosta@gmail.com", "mateo.duarte@hotmail.com",
    "camila.fleitas@gmail.com", "sebastian.ibarra@yahoo.com", "luciana.jara@hotmail.com",
    "facundo.klassen@gmail.com", "isabella.lird@yahoo.com", "santiago.mendez@gmail.com",
    "emilia.nunez@hotmail.com", "benjamin.orte@yahoo.com", "martina.paredes@gmail.com",
    "tomas.quintana@hotmail.com", "victoria.rivarola@gmail.com", "nicolas.salinas@yahoo.com",
    "josefina.torres@hotmail.com", "gabriel.ugarte@gmail.com", "catalina.valiente@yahoo.com",
    "daniela.acuna@hotmail.com", "eduardo.britez@gmail.com", "florencia.cabrera@yahoo.com",
    "fernando.colman@gmail.com", "guillermina.denis@hotmail.com", "agustin.encina@yahoo.com",
    "celeste.espinola@gmail.com", "lautaro.figueredo@hotmail.com", "graciela.galeano@yahoo.com",
    "ignacio.godoy@gmail.com", "marina.gonzalez@hotmail.com", "andres.guerrero@gmail.com",
    "rocio.haedo@yahoo.com", "bruno.hermosilla@gmail.com", "milagros.insfran@hotmail.com",
    "alejandro.jure@yahoo.com", "noelia.klassen@gmail.com", "lucas.leguizamon@hotmail.com",
    "paulina.machuca@yahoo.com", "maximiliano.medina@gmail.com", "carolina.melgarejo@hotmail.com",
    "hernan.oviedo@gmail.com", "romina.penayo@yahoo.com", "julian.rojas@hotmail.com",
    "belen.servin@gmail.com",
]

CLIENT_PHONES = [
    "+5959811001", "+5959811002", "+5959811003", "+5959811004", "+5959811005",
    "+5959811006", "+5959811007", "+5959811008", "+5959811009", "+5959811010",
    "+5959811011", "+5959811012", "+5959811013", "+5959811014", "+5959811015",
    "+5959811016", "+5959811017", "+5959811018", "+5959811019", "+5959811020",
    "+5959811021", "+5959811022", "+5959811023", "+5959811024", "+5959811025",
    "+5959811026", "+5959811027", "+5959811028", "+5959811029", "+5959811030",
    "+5959811031", "+5959811032", "+5959811033", "+5959811034", "+5959811035",
    "+5959811036", "+5959811037", "+5959811038", "+5959811039", "+5959811040",
    "+5959811041", "+5959811042", "+5959811043", "+5959811044", "+5959811045",
    "+5959811046", "+5959811047", "+5959811048", "+5959811049", "+5959811050",
]

ESTILOS = ["casual", "formal", "deportivo", "bohemio", "clasico"]
GENEROS_PREF = ["mujer", "hombre", "unisex", "nina", "nino"]
CANALES = ["tienda", "whatsapp", "instagram", "web"]
INTERACTION_TYPES = ["visita", "compra", "devolucion", "consulta", "fitting"]


async def main():
    conn = await asyncpg.connect(DB)
    print("Connected")

    # TRUNCATE everything
    print("Truncating bout_* tables...")
    await conn.execute("""
        TRUNCATE TABLE
            bout_event_guests, bout_events,
            bout_return_items, bout_returns,
            bout_sale_items, bout_sales,
            bout_stock_movements,
            bout_markdown_items, bout_markdown_rules,
            bout_product_ar, bout_gift_wrapping,
            bout_client_measurements, bout_client_documents,
            bout_client_interactions, bout_client_profiles,
            bout_loyalty_accounts, bout_loyalty_tiers, bout_loyalty_config,
            bout_collection_items, bout_collections,
            bout_product_variants, bout_products,
            bout_categories, bout_colors, bout_sizes
        RESTART IDENTITY CASCADE
    """)

    existing_customers = await conn.fetch(
        "SELECT id FROM customers WHERE company_id = $1 LIMIT 100", UUID(CID)
    )
    customer_ids = [r["id"] for r in existing_customers]
    print(f"Existing customers: {len(customer_ids)}")

    # ============================================================
    # 1. SIZES
    # ============================================================
    print("\n1. Sizes...")
    for codigo, nombre, categoria, orden, medida in SIZES:
        await conn.execute(
            """INSERT INTO bout_sizes (id, company_id, codigo, nombre, categoria, orden,
               medida_referencia_cm, activo, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())""",
            uuid4(), UUID(CID), codigo, nombre, categoria, orden, medida
        )
    print(f"  Created {len(SIZES)} sizes")

    size_records = await conn.fetch(
        "SELECT id, codigo, categoria FROM bout_sizes ORDER BY orden"
    )
    sizes_by_cod = {r["codigo"]: r for r in size_records}
    sizes_ropa = [s for s in size_records if s["categoria"] == "Ropa"]
    sizes_accesorios = [s for s in size_records if s["categoria"] == "Accesorios"]
    sizes_calzado = [s for s in size_records if s["categoria"] == "Calzado"]

    # ============================================================
    # 2. COLORS
    # ============================================================
    print("\n2. Colors...")
    for codigo, nombre, hex, familia in COLORS:
        await conn.execute(
            """INSERT INTO bout_colors (id, company_id, codigo, nombre, hex, familia,
               es_basico, orden, activo, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())""",
            uuid4(), UUID(CID), codigo, nombre, hex, familia,
            nombre in ("Negro", "Blanco", "Gris"), int(codigo[1:])
        )
    print(f"  Created {len(COLORS)} colors")

    color_records = await conn.fetch(
        "SELECT id, codigo, nombre FROM bout_colors ORDER BY orden"
    )
    colors_by_cod = {r["codigo"]: r for r in color_records}

    # ============================================================
    # 3. CATEGORIES
    # ============================================================
    print("\n3. Categories...")
    cat_ids = {}
    for i, (codigo, nombre, desc, parent_id, nivel) in enumerate(CATEGORIES):
        cid_uuid = uuid4()
        cat_ids[codigo] = cid_uuid
        await conn.execute(
            """INSERT INTO bout_categories (id, company_id, codigo, nombre, descripcion,
               nivel, activo, orden, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW())""",
            cid_uuid, UUID(CID), codigo, nombre, desc, nivel, i + 1
        )
    print(f"  Created {len(CATEGORIES)} categories")

    # ============================================================
    # 4. COLLECTIONS
    # ============================================================
    print("\n4. Collections...")
    collection_ids = {}
    for codigo, nombre, desc, temp, anio in COLLECTIONS:
        col_id = uuid4()
        collection_ids[codigo] = col_id
        await conn.execute(
            """INSERT INTO bout_collections (id, company_id, codigo, nombre, descripcion,
               temporada, anio, estado, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'activa', NOW())""",
            col_id, UUID(CID), codigo, nombre, desc, temp, anio
        )
    print(f"  Created {len(COLLECTIONS)} collections")

    # ============================================================
    # 5. PRODUCTS + VARIANTS
    # ============================================================
    print("\n5. Products & Variants...")
    total_products = 0
    total_variants = 0

    product_defs = []
    for cat_codigo, prods in PRODUCTS_BY_CATEGORY.items():
        for p in prods:
            product_defs.append((cat_codigo, p))

    for cat_codigo, (codigo, nombre, desc, genero, precio, costo, destacado,
                     incluye_gw, material, cuidados) in product_defs:
        total_products += 1
        prod_id = uuid4()
        await conn.execute(
            """INSERT INTO bout_products (id, company_id, codigo, nombre, descripcion,
               categoria_id, tipo_producto, genero, marca, material, cuidados,
               precio_base, costo_promedio, moneda, activo, destacado,
               incluye_gift_wrapping, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PYG',
                       true, $14, $15, NOW())""",
            prod_id, UUID(CID), codigo, nombre, desc,
            cat_ids[cat_codigo],
            "indumentaria" if cat_codigo != "CAT-CAL" else "calzado",
            genero, "InteliFashion", material, cuidados,
            precio, costo, destacado, incluye_gw
        )

        # Determine which sizes apply based on category
        if cat_codigo == "CAT-CAL":
            applicable_sizes = sizes_calzado
        elif cat_codigo == "CAT-ACC":
            applicable_sizes = sizes_accesorios
        else:
            # Ropa - choose based on genero
            if genero == "hombre":
                applicable_sizes = [s for s in sizes_ropa if s["codigo"] in ("S02", "S03", "S04", "S07", "S08", "S09")]
            elif genero == "nino":
                applicable_sizes = [s for s in sizes_ropa if s["codigo"] in ("S01", "S02", "S03")]
            elif genero == "nina":
                applicable_sizes = [s for s in sizes_ropa if s["codigo"] in ("S01", "S02", "S03")]
            else:
                applicable_sizes = sizes_ropa

        # Pick 2-4 sizes for this product
        num_sizes = min(random.randint(2, 4), len(applicable_sizes))
        selected_sizes = random.sample(applicable_sizes, k=num_sizes)

        # Pick 2-4 colors for this product
        all_colors = color_records
        num_colors = min(random.randint(2, 4), len(all_colors))
        selected_colors = random.sample(all_colors, k=num_colors)

        for sz in selected_sizes:
            for clr in selected_colors:
                total_variants += 1
                sku = f"SKU-{codigo}-{sz['codigo']}-{clr['codigo']}"
                sobrecargo = Decimal(str(random.choice([0, 0, 0, 5000, 10000, 15000])))
                stock = random.randint(5, 100)
                stock_min = random.randint(2, 10)
                await conn.execute(
                    """INSERT INTO bout_product_variants (id, product_id, size_id, color_id,
                       sku, precio_sobrecargo, stock_actual, stock_minimo, stock_reservado,
                       activo, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, true, NOW(), NOW())""",
                    uuid4(), prod_id, sz["id"], clr["id"],
                    sku, sobrecargo, stock, stock_min
                )

    print(f"  Created {total_products} products with {total_variants} variants")

    # ============================================================
    # 6. COLLECTION ITEMS
    # ============================================================
    print("\n6. Collection Items...")
    all_products = await conn.fetch(
        "SELECT id, codigo FROM bout_products WHERE company_id = $1", UUID(CID)
    )
    coll_items = 0
    for col_codigo in collection_ids:
        assigned = random.sample(all_products, k=random.randint(4, 8))
        for i, prod in enumerate(assigned):
            await conn.execute(
                """INSERT INTO bout_collection_items (id, company_id, collection_id, producto_id,
                   orden, destacado, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, NOW())""",
                uuid4(), UUID(CID), collection_ids[col_codigo], prod["id"],
                i + 1, i == 0
            )
            coll_items += 1
    print(f"  Created {coll_items} collection items")

    # ============================================================
    # 7. GIFT WRAPPING OPTIONS
    # ============================================================
    print("\n7. Gift Wrapping Options...")
    gift_options = [
        ("GIFT-001", "Papel de Regalo Estandar", "Papel kraft personalizado", Decimal("15000")),
        ("GIFT-002", "Caja de Regalo Premium", "Caja rigida con cinta de seda", Decimal("35000")),
        ("GIFT-003", "Bolsa Eco-Regalo", "Bolsa de tela reutilizable", Decimal("20000")),
        ("GIFT-004", "Pack Especial Bodas", "Caja blanca con moño y tarjeta", Decimal("50000")),
    ]
    for codigo, nombre, desc, precio in gift_options:
        await conn.execute(
            """INSERT INTO bout_gift_wrapping (id, company_id, codigo, nombre, descripcion,
               precio, activo, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, true, NOW())""",
            uuid4(), UUID(CID), codigo, nombre, desc, precio
        )
    print(f"  Created {len(gift_options)} gift wrapping options")

    # ============================================================
    # 8. AR METADATA (for some products)
    # ============================================================
    print("\n8. AR Try-On Metadata...")
    ar_products = random.sample(all_products, k=min(12, len(all_products)))
    for prod in ar_products:
        await conn.execute(
            """INSERT INTO bout_product_ar (id, company_id, producto_id,
               modelo_3d_url, glb_url, usdz_url, puntos_anclaje,
               talles_disponibles_ar, color_calibration_hex, proveedor_ar, activo, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW())""",
            uuid4(), UUID(CID), prod["id"],
            f"https://ar.intelimarket.com/models/{prod['codigo']}.glb",
            f"https://ar.intelimarket.com/models/{prod['codigo']}.glb",
            f"https://ar.intelimarket.com/models/{prod['codigo']}.usdz",
            json.dumps({"shoulders": {"x": 0, "y": 0.3, "z": 0}}),
            ["P", "M", "G"],
            "#FFFFFF", "zelig"
        )
    print(f"  Created {len(ar_products)} AR metadata entries")

    # ============================================================
    # 9. CLIENT PROFILES (50)
    # ============================================================
    print("\n9. Client Profiles...")
    profile_count = 0
    generated_customer_ids = []
    for i in range(50):
        cust_id = customer_ids[i] if i < len(customer_ids) else uuid4()
        generated_customer_ids.append(cust_id)
        estilo = random.choice(ESTILOS)
        genero_pref = random.choice(GENEROS_PREF)
        total_gastado = Decimal(str(random.randint(200000, 5000000)))
        total_compras = random.randint(1, 30)
        talla_id = random.choice(sizes_ropa)["id"] if sizes_ropa else None
        color_id = random.choice(color_records)["id"] if color_records else None
        cumple = date(random.choice([1980 + i for i in range(30)]), random.randint(1, 12), random.randint(1, 28))
        await conn.execute(
            """INSERT INTO bout_client_profiles (id, company_id, customer_id, tipo_cliente,
               fecha_alta, ultima_visita, genero_preferido, total_gastado, total_compras,
               talla_preferida_id, color_preferido_id, marcas_preferidas, estilo,
               temporada_preferida, cumpleanos, notas_estilista, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())""",
            uuid4(), UUID(CID), cust_id,
            random.choice(["regular", "regular", "regular", "vip", "vip", "wholesale"]),
            datetime.now() - timedelta(days=random.randint(30, 730)),
            datetime.now() - timedelta(days=random.randint(0, 60)),
            genero_pref, total_gastado, total_compras,
            talla_id, color_id,
            random.sample(["InteliFashion", "Nike", "Zara", "Adidas", "H&M", "Levis"], k=random.randint(1, 3)),
            estilo,
            random.choice(["primavera_verano", "otonio_invierno"]),
            cumple,
            f"Cliente {estilo}, prefiere tonos {random.choice(COLORS)[1].lower()}"
        )
        profile_count += 1
    print(f"  Created {profile_count} client profiles")

    # ============================================================
    # 10. CLIENT INTERACTIONS (50)
    # ============================================================
    print("\n10. Client Interactions...")
    for i in range(50):
        cust_id = generated_customer_ids[i % len(generated_customer_ids)]
        interaction_type = random.choice(INTERACTION_TYPES)
        notas = {
            "visita": "Visito la tienda y probo varias prendas",
            "compra": "Compro articulos de temporada",
            "devolucion": "Devolvio por talle incorrecto",
            "consulta": "Solicito informacion sobre coleccion nueva",
            "fitting": "Session de fitting para evento especial",
        }
        await conn.execute(
            """INSERT INTO bout_client_interactions (id, company_id, customer_id, tipo,
               fecha, canal, notas, proximo_seguimiento, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())""",
            uuid4(), UUID(CID), cust_id,
            interaction_type,
            datetime.now() - timedelta(days=random.randint(0, 90)),
            random.choice(CANALES),
            notas[interaction_type],
            date.today() + timedelta(days=random.randint(7, 60))
        )
    print(f"  Created 50 client interactions")

    # ============================================================
    # 11. CLIENT DOCUMENTS (a few)
    # ============================================================
    print("\n11. Client Documents...")
    doc_count = 0
    for cust_id in random.sample(generated_customer_ids, k=15):
        await conn.execute(
            """INSERT INTO bout_client_documents (id, company_id, customer_id, tipo, url,
               verificado, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())""",
            uuid4(), UUID(CID), cust_id,
            random.choice(["selfie", "documento", "comprobante_domicilio"]),
            f"https://docs.intelimarket.com/boutique/{uuid4().hex[:8]}.jpg",
            random.choice([True, True, False])
        )
        doc_count += 1
    print(f"  Created {doc_count} client documents")

    # ============================================================
    # 12. CLIENT MEASUREMENTS (some)
    # ============================================================
    print("\n12. Client Measurements...")
    meas_count = 0
    for cust_id in random.sample(generated_customer_ids, k=20):
        await conn.execute(
            """INSERT INTO bout_client_measurements (id, company_id, customer_id,
               tipo_medida, pecho_cm, cintura_cm, cadera_cm, largo_torso_cm,
               largo_brazo_cm, hombro_cm, talle_pantalon_cm, contorno_pierna_cm,
               zapato_br, notas_adicionales, fecha_tomada, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())""",
            uuid4(), UUID(CID), cust_id,
            "cuerpo",
            Decimal(str(random.randint(80, 110))),
            Decimal(str(random.randint(60, 95))),
            Decimal(str(random.randint(85, 115))),
            Decimal(str(random.randint(35, 50))),
            Decimal(str(random.randint(55, 70))),
            Decimal(str(random.randint(35, 48))),
            Decimal(str(random.randint(70, 95))),
            Decimal(str(random.randint(50, 70))),
            random.randint(34, 44),
            "Medidas tomadas en tienda",
            date.today() - timedelta(days=random.randint(0, 90))
        )
        meas_count += 1
    print(f"  Created {meas_count} client measurements")

    # ============================================================
    # 13. LOYALTY CONFIG + TIERS + ACCOUNTS
    # ============================================================
    print("\n13. Loyalty Program...")
    config_id = uuid4()
    await conn.execute(
        """INSERT INTO bout_loyalty_config (id, company_id, puntos_por_guarani,
           guarani_por_punto, activo, created_at, updated_at)
           VALUES ($1, $2, 0.01, 100, true, NOW(), NOW())""",
        config_id, UUID(CID)
    )

    tiers_data = [
        ("BRONZE", "Bronze", 1, None, None, Decimal("1.0"), Decimal("0"), False, False, False),
        ("SILVER", "Plata", 2, Decimal("1000000"), 1000, Decimal("1.5"), Decimal("5"), False, False, False),
        ("GOLD", "Oro", 3, Decimal("3000000"), 5000, Decimal("2.0"), Decimal("10"), True, True, False),
        ("PLATINUM", "Platino", 4, Decimal("8000000"), 15000, Decimal("3.0"), Decimal("15"), True, True, True),
    ]
    tier_ids = {}
    for codigo, nombre, nivel, gasto_min, puntos_min, mult, dto, envio, acceso, gw in tiers_data:
        tid = uuid4()
        tier_ids[codigo] = tid
        await conn.execute(
            """INSERT INTO bout_loyalty_tiers (id, config_id, codigo, nombre, nivel,
               gasto_minimo_acumulado, puntos_minimos, multiplicador_puntos,
               descuento_percent, beneficio_envio_gratis, beneficio_acceso_anticipado,
               beneficio_gift_wrapping_gratis, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())""",
            tid, config_id, codigo, nombre, nivel, gasto_min, puntos_min,
            mult, dto, envio, acceso, gw
        )

    # 20 loyalty accounts
    for i in range(20):
        cust_id = generated_customer_ids[i % len(generated_customer_ids)]
        tier = random.choice(list(tier_ids.values()))
        puntos_acum = random.randint(500, 20000)
        puntos_canj = random.randint(0, puntos_acum // 2)
        await conn.execute(
            """INSERT INTO bout_loyalty_accounts (id, company_id, customer_id, tier_id,
               puntos_acumulados, puntos_canjeados, puntos_disponibles, gasto_total,
               ultima_actualizacion, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())""",
            uuid4(), UUID(CID), cust_id, tier,
            puntos_acum, puntos_canj, puntos_acum - puntos_canj,
            Decimal(str(random.randint(500000, 8000000)))
        )
    print(f"  Created 1 loyalty config, 4 tiers, 20 accounts")

    # ============================================================
    # 14. EVENTS (8) + GUESTS
    # ============================================================
    print("\n14. Events & Guests...")
    events_data = [
        ("EVT-001", "Desfile Primavera-Verano 2026", "fashion_show",
         "Desfile de lanzamiento de la coleccion PV 2026", 200),
        ("EVT-002", "Pop-Up Store Shopping del Sol", "pop_up",
         "Tienda pop-up en Shopping del Sol", None),
        ("EVT-003", "Venta Privada Platinum", "private_sale",
         "Venta exclusiva para clientes Platinum", 80),
        ("EVT-004", "Lanzamiento Coleccion Nupcial", "lanzamiento",
         "Presentacion de la linea de novias 2026", 100),
        ("EVT-005", "Fashion Night Out", "fashion_show",
         "Noche de moda con disenadores locales", 300),
        ("EVT-006", "Pop-Up Outlet Temporada", "pop_up",
         "Outlet de fin de temporada con descuentos", None),
        ("EVT-007", "Taller de Estilo Personal", "lanzamiento",
         "Workshop de asesoria de imagen", 30),
        ("EVT-008", "Venta Privada San Valentin", "private_sale",
         "Evento especial de San Valentin", 60),
    ]
    event_ids = []
    for codigo, nombre, tipo, desc, capacidad in events_data:
        eid = uuid4()
        event_ids.append(eid)
        start = datetime.now() + timedelta(days=random.randint(10, 120))
        await conn.execute(
            """INSERT INTO bout_events (id, company_id, codigo, nombre, tipo, descripcion,
               fecha_inicio, fecha_fin, ubicacion, capacidad_maxima, invitados, estado, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())""",
            eid, UUID(CID), codigo, nombre, tipo, desc,
            start, start + timedelta(hours=4),
            random.choice(["Shopping del Sol", "Mcal. Lopez 1000", "Showroom InteliFashion", "Hotel Sheraton"]),
            capacidad, 0,
            random.choice(["borrador", "confirmado", "en_curso", "finalizado"])
        )

    guest_count = 0
    for eid in event_ids:
        guests = random.sample(generated_customer_ids, k=min(random.randint(3, 8), len(generated_customer_ids)))
        for cust_id in guests:
            await conn.execute(
                """INSERT INTO bout_event_guests (id, event_id, customer_id, confirmado,
                   asistio, acompanantes, notas, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())""",
                uuid4(), eid, cust_id,
                random.choice([True, True, False]),
                random.choice([True, False]),
                random.randint(0, 2),
                "Invitado por gerencia de marketing"
            )
            guest_count += 1
    print(f"  Created {len(events_data)} events with {guest_count} guests")

    # ============================================================
    # 15. MARKDOWN RULES + ITEMS
    # ============================================================
    print("\n15. Markdown Rules & Items...")
    rules_data = [
        ("MDW-001", "Liquidacion Fin Temporada", "fin_temporada", Decimal("70"), Decimal("15"), 30, Decimal("0.3")),
        ("MDW-002", "Descuento Exceso Stock", "exceso_stock", Decimal("50"), Decimal("10"), None, Decimal("2.0")),
        ("MDW-003", "Promo Lanzamiento", "lanzamiento", Decimal("30"), Decimal("5"), None, None),
    ]
    mdr_ids = []
    for codigo, nombre, tipo, dto_max, dto_min, dias, factor in rules_data:
        mid = uuid4()
        mdr_ids.append(mid)
        await conn.execute(
            """INSERT INTO bout_markdown_rules (id, company_id, codigo, nombre, tipo,
               descuento_maximo, descuento_minimo, dias_antes_fin_temporada,
               factor_rotacion_minimo, activo, prioridad, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, NOW())""",
            mid, UUID(CID), codigo, nombre, tipo, dto_max, dto_min,
            dias, factor, int(codigo[-1])
        )

    all_variants = await conn.fetch(
        "SELECT v.id, v.product_id, v.sku, p.precio_base FROM bout_product_variants v "
        "JOIN bout_products p ON v.product_id = p.id WHERE p.company_id = $1",
        UUID(CID)
    )

    md_item_count = 0
    for mid in mdr_ids:
        selected = random.sample(all_variants, k=min(random.randint(5, 10), len(all_variants)))
        for v in selected:
            dto_pct = Decimal(str(random.randint(15, 50)))
            precio_orig = Decimal(str(v["precio_base"]))
            precio_md = (precio_orig * (100 - dto_pct) / 100).quantize(Decimal("0.01"))
            await conn.execute(
                """INSERT INTO bout_markdown_items (id, company_id, rule_id, variant_id,
                   producto_id, descuento_aplicado, precio_original, precio_markdown,
                   fecha_inicio, fecha_fin, activo, aplicado_automaticamente, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, NOW())""",
                uuid4(), UUID(CID), mid, v["id"], v["product_id"],
                dto_pct, precio_orig, precio_md,
                date.today(),
                date.today() + timedelta(days=30),
                random.choice([True, False])
            )
            md_item_count += 1
    print(f"  Created {len(rules_data)} markdown rules with {md_item_count} items")

    # ============================================================
    # 16. STOCK MOVEMENTS
    # ============================================================
    print("\n16. Stock Movements...")
    mov_count = 0
    for v in random.sample(all_variants, k=min(200, len(all_variants))):
        movements = [
            ("ingreso", random.randint(10, 100)),
            ("egreso", random.randint(1, 10)),
            ("ajuste", random.choice([-2, -1, 1, 2])),
        ]
        for tipo, cant in movements:
            stock_result = random.randint(0, 200)
            ref_types = {"ingreso": "compra", "egreso": "venta", "ajuste": "inventario"}
            await conn.execute(
                """INSERT INTO bout_stock_movements (id, company_id, variant_id, tipo,
                   cantidad, stock_resultante, referencia_tipo, referencia_id, nota, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())""",
                uuid4(), UUID(CID), v["id"], tipo, cant, stock_result,
                ref_types[tipo], uuid4().hex[:8].upper(),
                f"Movimiento {tipo} automatico"
            )
            mov_count += 1
    print(f"  Created {mov_count} stock movements")

    # ============================================================
    # 17. SALES (some)
    # ============================================================
    print("\n17. Sales...")
    sale_count = 0
    item_count = 0
    for i in range(15):
        sale_id = uuid4()
        cust_id = generated_customer_ids[i % len(generated_customer_ids)]
        codigo = f"BOUT-VTA-{uuid4().hex[:6].upper()}"
        num_items = random.randint(1, 5)
        selected_variants = random.sample(all_variants, k=min(num_items, len(all_variants)))
        subtotal = Decimal("0")
        sale_items_data = []
        for v in selected_variants:
            cant = random.randint(1, 3)
            pu = Decimal(str(v["precio_base"])) + Decimal(str(random.choice([0, 5000, 10000])))
            subtotal += pu * cant
            sale_items_data.append((v["product_id"], v["id"], cant, pu))
        descuento = Decimal(str(random.randint(0, 50000)))
        iva = (subtotal - descuento) * Decimal("0.10")
        total = subtotal - descuento + iva
        await conn.execute(
            """INSERT INTO bout_sales (id, company_id, codigo, customer_id, fecha,
               subtotal, descuento, impuesto, total, moneda, tipo_venta,
               incluye_gift_wrapping, gift_wrapping_fee, notas, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PYG', $10, $11, $12, $13, NOW())""",
            sale_id, UUID(CID), codigo, cust_id,
            datetime.now() - timedelta(days=random.randint(0, 90)),
            subtotal, descuento, iva, total,
            random.choice(["tienda", "tienda", "online", "whatsapp", "feria"]),
            random.choice([True, False]),
            Decimal(str(random.choice([0, 15000, 20000, 35000]))),
            f"Venta de prueba {i+1}"
        )
        sale_count += 1
        for prod_id, var_id, cant, pu in sale_items_data:
            await conn.execute(
                """INSERT INTO bout_sale_items (id, sale_id, producto_id, variant_id,
                   cantidad, precio_unitario, descuento_item)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                uuid4(), sale_id, prod_id, var_id, cant, pu,
                Decimal(str(random.choice([0, 0, 0, 5000, 10000])))
            )
            item_count += 1
    print(f"  Created {sale_count} sales with {item_count} items")

    # ============================================================
    # 18. RETURNS (some)
    # ============================================================
    print("\n18. Returns...")
    sales = await conn.fetch(
        "SELECT id FROM bout_sales WHERE company_id = $1 ORDER BY created_at DESC", UUID(CID)
    )
    sale_items = await conn.fetch(
        "SELECT si.id, si.sale_id, si.producto_id, si.variant_id "
        "FROM bout_sale_items si JOIN bout_sales s ON si.sale_id = s.id "
        "WHERE s.company_id = $1", UUID(CID)
    )
    return_count = 0
    return_item_count = 0
    grouped_by_sale = {}
    for si in sale_items:
        grouped_by_sale.setdefault(si["sale_id"], []).append(si)

    for sale_id in random.sample([s["id"] for s in sales], k=min(5, len(sales))):
        items = grouped_by_sale.get(sale_id, [])
        if not items:
            continue
        return_id = uuid4()
        ret_codigo = f"BOUT-DEV-{uuid4().hex[:6].upper()}"
        await conn.execute(
            """INSERT INTO bout_returns (id, company_id, codigo, sale_id, customer_id, fecha,
               motivo, estado, tipo_reintegro, total_reintegro, notas, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())""",
            return_id, UUID(CID), ret_codigo, sale_id,
            customer_ids[random.randint(0, len(customer_ids) - 1)],
            datetime.now() - timedelta(days=random.randint(0, 30)),
            random.choice(["talle_incorrecto", "defecto", "cambio_opinion"]),
            random.choice(["pendiente", "aprobado", "rechazado", "completado"]),
            random.choice(["reembolso", "cambio", "credito_tienda"]),
            Decimal(str(random.randint(50000, 500000))),
            "Devolucion generada desde seed"
        )
        return_count += 1
        for si in random.sample(items, k=min(len(items), 2)):
            await conn.execute(
                """INSERT INTO bout_return_items (id, return_id, sale_item_id, variant_id,
                   cantidad, motivo, estado_item)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                uuid4(), return_id, si["id"], si["variant_id"],
                random.randint(1, 1),
                "Talle no corresponde",
                random.choice(["nuevo", "usado"])
            )
            return_item_count += 1
    print(f"  Created {return_count} returns with {return_item_count} items")

    # ============================================================
    # SUMMARY
    # ============================================================
    print("\n" + "=" * 60)
    print("=== SEED BOUTIQUE COMPLETED ===")
    print(f"  Sizes:             {len(SIZES)}")
    print(f"  Colors:            {len(COLORS)}")
    print(f"  Categories:        {len(CATEGORIES)}")
    print(f"  Collections:       {len(COLLECTIONS)} (+ {coll_items} items)")
    print(f"  Products:          {total_products}")
    print(f"  Variants:          {total_variants}")
    print(f"  Gift Wrapping:     {len(gift_options)}")
    print(f"  AR Metadata:       {len(ar_products)}")
    print(f"  Client Profiles:   {profile_count}")
    print(f"  Interactions:      50")
    print(f"  Documents:         {doc_count}")
    print(f"  Measurements:      {meas_count}")
    print(f"  Loyalty:           1 config, 4 tiers, 20 accounts")
    print(f"  Events:            {len(events_data)} ({guest_count} guests)")
    print(f"  Markdown:          {len(rules_data)} rules, {md_item_count} items")
    print(f"  Stock Movements:   {mov_count}")
    print(f"  Sales:             {sale_count} ({item_count} items)")
    print(f"  Returns:           {return_count} ({return_item_count} items)")
    print("=" * 60)

    await conn.close()


asyncio.run(main())
