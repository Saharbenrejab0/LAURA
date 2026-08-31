"""
Idempotent seed for reference tables: clusters, countries, legal_entities, brands.
Running twice produces the same result (INSERT ... ON CONFLICT DO NOTHING).

Usage:
    python -m backend.seeds.seed_reference_data
"""
from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.models.database import SessionLocal


# ── Cluster → Country → Legal Entity data ────────────────────────────────────

CLUSTER_DATA: list[dict] = [
    {
        "name": "FRANCE",
        "countries": [
            {
                "name": "France",
                "legal_entities": [
                    "LUXOTTICA FRANCE SASU",
                    "ESSILOR INTERNATIONAL SAS",
                    "BBGR",
                    "INVOPTIC",
                    "ESSILOR OUTRE-MER CARAÏBES",
                    "NOVACEL OPHTALMIQUE",
                    "MEGA OPTIC DESIGN",
                    "Manufacture Lorraine d'Optique MONT-ROYAL",
                ],
            },
        ],
    },
    {
        "name": "ITALY",
        "countries": [
            {
                "name": "Italy",
                "legal_entities": [
                    "LUXOTTICA ITALIA SRL",
                    "ESSILORLUXOTTICA WHOLESALE ITALIA SPA",
                    "L.T.L. Spa (LTL)",
                ],
            },
        ],
    },
    {
        "name": "DACH",
        "countries": [
            {
                "name": "Germany",
                "legal_entities": [
                    "LUXOTTICA GERMANY GMBH",
                    "ESSILOR GmbH",
                    "RUPP + HUBRACH OPTIK GMBH",
                    "Rupp & Hubrach - Branch IE",
                    "NIKA OPTICS GMBH",
                    "INFIELD Safety, GmbH",
                    "SIGNET ARMORLITE GERMANY HOLDING GmbH",
                    "SIGNET ARMORLITE OPTIC, GmbH",
                ],
            },
            {
                "name": "Austria",
                "legal_entities": [
                    "LUXOTTICA AUSTRIA GMBH",
                    "ESSILOR AUSTRIA GmbH",
                ],
            },
            {
                "name": "Switzerland",
                "legal_entities": [
                    "LUXOTTICA (SWITZERLAND) AG",
                    "ESSILOR SUISSE SA",
                    "REIZE OPTIK AG",
                ],
            },
        ],
    },
    {
        "name": "IBERIA",
        "countries": [
            {
                "name": "Spain",
                "legal_entities": [
                    "LUXOTTICA SPAIN SLU",
                    "ESSILOR ESPANA",
                    "ECP PLATFORM S.L.",
                ],
            },
            {
                "name": "Portugal",
                "legal_entities": [
                    "LUXOTTICA PORTUGAL SA",
                    "ESSILOR PORTUGAL - Sociedade Industrial de óptica, Lda",
                ],
            },
        ],
    },
    {
        "name": "NORTH",
        "countries": [
            {
                "name": "United Kingdom",
                "legal_entities": [
                    "LUXOTTICA NORTH EUROPE LTD",
                    "ESSILOR LIMITED",
                    "BBGR LIMITED",
                    "TRIFLE HOLDINGS LIMITED",
                    "LENSTEC",
                    "EMNUK Limited",
                ],
            },
            {
                "name": "Belgium",
                "legal_entities": [
                    "LUXOTTICA BELGIUM NV",
                    "ESSILOR BELGIUM SA",
                ],
            },
            {
                "name": "Netherlands",
                "legal_entities": [
                    "LUXOTTICA THE NETHERLANDS BV",
                    "ESSILOR NEDERLAND BV",
                    "INTERNATIONAL OPTICAL HOUSE HOLDING",
                    "ESSILOR NEDERLAND HOLDING BV",
                ],
            },
            {
                "name": "Finland",
                "legal_entities": [
                    "OY LUXOTTICA FINLAND AB",
                    "ESSILOR OY",
                ],
            },
            {
                "name": "Sweden",
                "legal_entities": [
                    "LUXOTTICA NORDIC AB",
                    "ESSILOR AB",
                ],
            },
            {
                "name": "Norway",
                "legal_entities": [
                    "LUXOTTICA NORGE AS",
                    "ESSILOR NORGE A/S",
                ],
            },
            {
                "name": "Denmark",
                "legal_entities": [
                    "ESSILOR DANMARK",
                ],
            },
            {
                "name": "Nigeria",
                "legal_entities": [
                    "ESSILOR OPTICAL SUPPLY NIGERIA LTD",
                ],
            },
        ],
    },
    {
        "name": "META Excl Turkey",
        "countries": [
            {
                "name": "South Africa",
                "legal_entities": [
                    "LUXOTTICA SOUTHERN AFRICA (PTY) LTD",
                    "ESSILOR SOUTH AFRICA (PROPRIETARY) LTD",
                    "RXPRESS OPTICAL PTY LTD",
                    "DAMAR OPTICAL (PTY) LTD",
                ],
            },
            {
                "name": "Israel",
                "legal_entities": [
                    "LUXOTTICA OPTICS LTD",
                    "ESSILOR ISRAELI HOLDINGS LTD",
                ],
            },
            {
                "name": "United Arab Emirates",
                "legal_entities": [
                    "LUXOTTICA MIDDLE EAST FZE",
                    "ESSILOR OPTICAL SUPPLIES L.L.C.",
                    "ESSILOR MIDDLE EAST LIMITED (EMEL)",
                    "ESSILOR MIDDLE EAST INVESTMENT HOLDING FZCO",
                    "OPTICAL SUPPLIES MIDDLE EAST FZE (OSME)",
                    "E.E.D FZC (EED)",
                    "GHANADA OPTICAL LLC",
                ],
            },
            {
                "name": "Cote D'Ivoire",
                "legal_entities": [
                    "SIVO WEST AFRICA",
                ],
            },
            {
                "name": "Cameroon",
                "legal_entities": [
                    "SIVO CENTRAL AFRICA",
                ],
            },
            {
                "name": "Algeria",
                "legal_entities": [
                    "ESSILOR SIVO ALGERIE",
                    "LTC Algeria",
                ],
            },
            {
                "name": "Estonia",
                "legal_entities": [
                    "OPTIKA HULGIKAUBANDUSE OÜ",
                ],
            },
            {
                "name": "Ethiopia",
                "legal_entities": [
                    "SUN OPTICAL TECHNOLOGIES PLC",
                ],
            },
            {
                "name": "Gabon",
                "legal_entities": [
                    "ESSILOR DISTRIBUTION AFRIQUE CENTRALE - EDAC",
                ],
            },
            {
                "name": "Kenya",
                "legal_entities": [
                    "ESSILOR EAST AFRICA LIMITED",
                ],
            },
            {
                "name": "Kuwait",
                "legal_entities": [
                    "ESSILOR AMICO TRADING COMPANY WLL",
                    "NIKON OPTICAL MIDDLE EAST FOR MEDICAL AND SUNGLASSES WLL.",
                ],
            },
            {
                "name": "Morocco",
                "legal_entities": [
                    "ESSILOR MOROCCO",
                    "MOVISIA S.A.",
                ],
            },
            {
                "name": "Mauritius",
                "legal_entities": [
                    "OPHTHALMIC LENSES LTD",
                ],
            },
            {
                "name": "Oman",
                "legal_entities": [
                    "ESSILOR OPTICAL MUSCAT LLC",
                ],
            },
            {
                "name": "Qatar",
                "legal_entities": [
                    "ESSILOR AMICO QATAR WLL",
                ],
            },
            {
                "name": "Serbia",
                "legal_entities": [
                    "ESSILOR OPTICS d.o.o.",
                ],
            },
            {
                "name": "Saudi Arabia",
                "legal_entities": [
                    "ESSILOR SAUDI ARABIA LTD",
                ],
            },
            {
                "name": "Senegal",
                "legal_entities": [
                    "ESSILOR -SIVO SENEGAL",
                ],
            },
            {
                "name": "Tunisia",
                "legal_entities": [
                    "ESSILOR SIVO SA",
                    "SIVO COMMERCIALE (SICOM DISTRIBUTION)",
                    "OPTICAL SUPPLY NORTH AFRICA (OSNA)",
                ],
            },
        ],
    },
    {
        "name": "TURKEY",
        "countries": [
            {
                "name": "Turkey",
                "legal_entities": [
                    "LUXOTTICA GOZLUK ENDUSTRI VE TICARET ANONIM SIRKETI",
                    "OPAK OPTIK SANAYI ve TICARET ANONIM SIRKETI",
                    "ISBIR OPTIK SANAYI ANONIM SIRKETI",
                    "ESEL OPTIK MAKINALARI ITHALAT IHRACAT PAZARLAMA VE TICARET ANONIM SIRKETI",
                ],
            },
        ],
    },
    {
        "name": "EAST",
        "countries": [
            {
                "name": "Greece",
                "legal_entities": [
                    "LUXOTTICA HELLAS AE",
                ],
            },
            {
                "name": "Poland",
                "legal_entities": [
                    "LUXOTTICA POLAND SP ZOO",
                    "ESSILOR POLONIA Sp Z.o.o.",
                    "JZO Spolka Akcyjna",
                    "JAI KUDO LENSES S.R.O",
                    "JAI KUDO POLSKA S.P Z.O.O",
                ],
            },
            {
                "name": "Croatia",
                "legal_entities": [
                    "LUXOTTICA SOUTH EASTERN EUROPE LTD",
                    "ESSILOR CROATIA",
                ],
            },
            {
                "name": "Hungary",
                "legal_entities": [
                    "LUXOTTICA CENTRAL EUROPE KFT",
                    "ESSILOR OPTIKA KFT",
                ],
            },
            {
                "name": "Czech Republic",
                "legal_entities": [
                    "ESSILOR OPTIKA spol. s.r.o.",
                    "OMEGA OPTIX S.R.O. - Tchéquie",
                ],
            },
            {
                "name": "Slovakia",
                "legal_entities": [
                    "ESSILOR d.o.o.",
                    "ESSILOR SLOVAKIA sro",
                ],
            },
            {
                "name": "Romania",
                "legal_entities": [
                    "ESSILOR ROMANIA S.R.L.",
                    "Rhein Romania",
                ],
            },
            {
                "name": "Bulgaria",
                "legal_entities": [
                    "ESSILOR BULGARIA EOOD",
                ],
            },
        ],
    },
    {
        "name": "RUSSIA",
        "countries": [
            {
                "name": "Russia",
                "legal_entities": [
                    "LUXOTTICA RUS LLC",
                    "ESSILOR LUIS OPTICA LLC",
                    "MARKETING OPTIC COMPANY (MOC)",
                    "MOC-BBGR",
                    "COMPANY GRANDVISION LLC",
                    "LOTUS FLOWER HOLDING BV",
                    "OPTIC CLUB LLC",
                ],
            },
        ],
    },
]


# ── Brand data (SAP codes) ────────────────────────────────────────────────────
# Deduplicated by code. [DUP] entries already removed from this list.
# Bvlgari (BV/BG) and Diesel (DL/DI) appear twice with different codes — both kept.

BRAND_DATA: list[tuple[str, str]] = [  # (code, name)
    ("6A", "Costa del Mar Optical"),
    ("FH", "Ferrari"),
    ("A0", "Alain Mikli"),
    ("AX", "Armani Exchange"),
    ("AN", "Arnette"),
    ("6E", "Balenciaga"),
    ("BE", "Burberry"),
    ("BC", "Brunello Cucinelli"),
    ("BV", "Bvlgari"),
    ("6L", "Cartier"),
    ("CE", "Celine"),
    ("CH", "Chanel"),
    ("CD", "Christian Dior"),
    ("HC", "Coach"),
    ("DB", "DBYD"),
    ("DY", "Dkny"),
    ("DG", "Dolce & Gabbana"),
    ("DK", "Donna Karan"),
    ("EA", "Emporio Armani"),
    ("EE", "Ess"),
    ("FN", "Fendi"),
    ("99", "Generic All"),
    ("Frames", "Generic Line Luxottica"),
    ("AR", "Giorgio Armani"),
    ("GC", "Gucci"),
    ("KX", "K & L Ophthalmic"),
    ("LU", "Luxottica"),
    ("MJ", "Maui Jim"),
    ("MK", "Michael Kors"),
    ("MU", "Miu Miu"),
    ("OX", "Oakley Ophtalmic"),
    ("OJ", "Oakley Sole Junior"),
    ("OO", "Oakley Sunglasses"),
    ("OY", "Oakley Vista Junior"),
    ("OW", "Oakley Wearable"),
    ("OV", "Oliver Peoples"),
    ("PO", "Persol"),
    ("PH", "Polo"),
    ("PP", "Polo Prep"),
    ("PR", "Prada"),
    ("PS", "Prada Linea Rossa"),
    ("RA", "Ralph"),
    ("RL", "Ralph Lauren"),
    ("RB", "Ray-Ban"),
    ("RJ", "Ray-Ban Junior Sole"),
    ("RY", "Ray-Ban Junior Vista"),
    ("RX", "Ray-Ban Vista"),
    ("SF", "Sferoflex"),
    ("SH", "Starck Eyes"),
    ("TF", "Tiffany"),
    ("TD", "Tom Ford"),
    ("TY", "Tory Burch"),
    ("VA", "Valentino"),
    ("VE", "Versace"),
    ("VR", "Versus"),
    ("VO", "Vogue"),
    ("VJ", "Vogue Kids Sole"),
    ("VY", "Vogue Kids Vista"),
    ("YS", "Yves Saint Laurent"),
    ("NE", "Seen"),
    ("UJ", "Unofficial Junior"),
    ("UO", "Unofficial"),
    ("6S", "Costa Del Mar"),
    ("XD", "Native"),
    ("RW", "Ray-Ban Wearable"),
    ("EK", "Emporio Armani Kids"),
    ("VK", "Versace Kids"),
    ("DX", "Dolce & Gabbana Kids"),
    ("MF", "Miraflex"),
    ("P4", "Polaroid"),
    ("DL", "Diesel"),
    ("JB", "Burberry Kids"),
    ("SK", "Swarovski"),
    ("0L", "Mont Blanc"),
    ("ZB", "Bliz"),
    ("ZK", "Bliz Goggle Kids"),
    ("ZG", "Bliz Goggle"),
    ("JC", "Jimmy Choo"),
    ("FZ", "Ferrari Scuderia"),
    ("ME", "Moncler"),
    ("AW", "Nuance Audio"),
    ("L6", "Levi's"),
    ("Q7", "EA7"),
    ("Q8", "EA7 Goggle Snow"),
    ("WX", "Moncler Goggles Snow"),
    ("OM", "Oakley Goggles Mx"),
    ("OZ", "Oakley Goggles Snow"),
    ("BG", "Bvlgari"),
    ("FO", "Foster Grant"),
    ("F1E", "Molsion"),
    ("BJ", "Bolon"),
    ("FE", "Ferragamo"),
    ("02", "Generic - Other"),
    ("2S", "Silhouette"),
    ("4Y", "Alaia"),
    ("BB", "Brooks Brothers"),
    ("UT", "Unbranded Tier 1"),
    ("OT", "Other Non Lux - Traditional"),
    ("DJ", "DBYD Junior"),
    ("NJ", "Seen Junior"),
    ("3E", "Disney"),
    ("DI", "Diesel"),
    ("LX", "Luxottica Lx"),
    ("CK", "Calvin Klein"),
    ("I1", "IC Berlin"),
    ("P7", "Pierre Cardin"),
    ("2C", "Prescriptions Brands - Turkey"),
    ("RO", "Ray-Ban Rox"),
    ("PL", "Rl Purple Label"),
    ("AV", "Adrienne Vittadini"),
    ("AK", "Anne Klein"),
    ("BY", "Byblos"),
    ("5S", "Carrera"),
    ("CT", "Charmant"),
    ("6N", "Chloe"),
    ("C8", "Chopard"),
    ("D4", "Dita"),
    ("GY", "Genny"),
    ("JS", "Jil Sander"),
    ("MO", "Moschino"),
    ("MT", "Mosley Tribes"),
    ("YY", "Other Marketing"),
    ("SM", "Stella Mccartney"),
    ("NL", "Polinelli"),
    ("8G", "Generic 3P Code"),
    ("LC", "Luxottica Collection"),
    ("FU", "Furla"),
    ("EU", "Stellest Frames"),
    ("EW", "Stellest Wearable"),
    ("0A", "Aes"),
]


# ── Seed logic ────────────────────────────────────────────────────────────────

def seed(db=None) -> None:
    close = db is None
    if db is None:
        db = SessionLocal()

    try:
        _seed_clusters(db)
        _seed_brands(db)
        db.commit()
        print("Reference data seeded successfully.")
    except Exception:
        db.rollback()
        raise
    finally:
        if close:
            db.close()


def _seed_clusters(db) -> None:
    from sqlalchemy import text

    for cluster_row in CLUSTER_DATA:
        # Upsert cluster
        db.execute(
            text("INSERT INTO clusters (name) VALUES (:name) ON CONFLICT (name) DO NOTHING"),
            {"name": cluster_row["name"]},
        )
        db.flush()

        cluster_id = db.execute(
            text("SELECT id FROM clusters WHERE name = :name"),
            {"name": cluster_row["name"]},
        ).scalar()

        for country_row in cluster_row["countries"]:
            # Upsert country
            db.execute(
                text(
                    "INSERT INTO countries (name, cluster_id) VALUES (:name, :cid) "
                    "ON CONFLICT (name) DO NOTHING"
                ),
                {"name": country_row["name"], "cid": cluster_id},
            )
            db.flush()

            country_id = db.execute(
                text("SELECT id FROM countries WHERE name = :name"),
                {"name": country_row["name"]},
            ).scalar()

            for le_name in country_row["legal_entities"]:
                existing = db.execute(
                    text(
                        "SELECT id FROM legal_entities WHERE name = :name AND country_id = :cid"
                    ),
                    {"name": le_name, "cid": country_id},
                ).scalar()
                if existing is None:
                    db.execute(
                        text(
                            "INSERT INTO legal_entities (name, country_id) VALUES (:name, :cid)"
                        ),
                        {"name": le_name, "cid": country_id},
                    )


def _seed_brands(db) -> None:
    from sqlalchemy import text

    for code, name in BRAND_DATA:
        db.execute(
            text(
                "INSERT INTO brands (code, name, is_active) VALUES (:code, :name, true) "
                "ON CONFLICT (code) DO NOTHING"
            ),
            {"code": code, "name": name},
        )


def _get_counts() -> dict:
    from sqlalchemy import text
    db = SessionLocal()
    try:
        return {
            "clusters":       db.execute(text("SELECT COUNT(*) FROM clusters")).scalar(),
            "countries":      db.execute(text("SELECT COUNT(*) FROM countries")).scalar(),
            "legal_entities": db.execute(text("SELECT COUNT(*) FROM legal_entities")).scalar(),
            "brands":         db.execute(text("SELECT COUNT(*) FROM brands")).scalar(),
        }
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    counts = _get_counts()
    print(f"  clusters:       {counts['clusters']}")
    print(f"  countries:      {counts['countries']}")
    print(f"  legal_entities: {counts['legal_entities']}")
    print(f"  brands:         {counts['brands']}")
