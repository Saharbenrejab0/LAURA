"""
LAURA — Reference data (single source of truth)
================================================

This file is THE one place where all reference data lives.
Frontend, backend, validation, PPT engine, Excel engine — all read from here.

If a cluster changes, a brand is added, or a cascade is updated:
EDIT THIS FILE ONLY. The whole app picks it up.

Source: LAURA Dropdown Rules CLIENT v2 (Essilor — June 2026)

When something changes:
  1. Edit the constant below
  2. Bump REFERENCE_DATA_VERSION
  3. Frontend cache (24h TTL) will refresh automatically

NEVER hardcode dropdown values anywhere else in the codebase.
"""

from typing import TypedDict


# ════════════════════════════════════════════════════════════════════════
#  Version — bump this whenever the data below changes
# ════════════════════════════════════════════════════════════════════════
REFERENCE_DATA_VERSION = "v3.0"
REFERENCE_DATA_SOURCE = "LAURA Dropdown Rules CLIENT v3 (August 2026) — SAP brand codes + official legal entities"


# ════════════════════════════════════════════════════════════════════════
#  1. Cluster → Country → Legal Entity cascade
# ════════════════════════════════════════════════════════════════════════
#  - 9 confirmed clusters
#  - GCC & Export is a country under META (NOT a cluster)
#  - Russia is its own cluster (NOT a country under EMEA)
#  - Legal Entity list: official list pending from Finance/Thibault
#    → users can pick from this list OR type a custom value (combobox)
# ════════════════════════════════════════════════════════════════════════

class CountryEntry(TypedDict):
    name: str
    legal_entities: list[str]


CLUSTER_CASCADE: dict[str, list[CountryEntry]] = {
    "FRANCE": [
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
    "ITALY": [
        {
            "name": "Italy",
            "legal_entities": [
                "LUXOTTICA ITALIA SRL",
                "ESSILORLUXOTTICA WHOLESALE ITALIA SPA",
                "L.T.L. Spa (LTL)",
            ],
        },
    ],
    "DACH": [
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
    "IBERIA": [
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
    "NORTH": [
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
    "META Excl Turkey": [
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
    "TURKEY": [
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
    "EAST": [
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
    "RUSSIA": [
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
}


# Derived: flat list of all clusters (preserves the order of CLUSTER_CASCADE)
CLUSTERS: list[str] = list(CLUSTER_CASCADE.keys())


# ════════════════════════════════════════════════════════════════════════
#  2. Activity types — 14 confirmed
# ════════════════════════════════════════════════════════════════════════
#  Order reflects usage frequency from the 1,320 historical LOAs
#  (Tailor Made Seasonal is the most common at 419 rows)
# ════════════════════════════════════════════════════════════════════════

# The CODE is the stored value; the label is presentation only.
#
# Settled by the 2026-08-25 audit (question 3): 2,609 rows used these UPPER_SNAKE
# codes and only 144 used the Title Case labels this list used to hold. The
# volume was on the side the official list did not recognise, so the list moved
# to the data rather than rewriting 2,609 rows. The four confirmed synonym pairs
# were merged first — see migration `merge_activity_synonyms`.
#
# Anything reading a stored activity_type gets a code. Anything showing one to a
# person passes it through ACTIVITY_TYPE_LABELS.
ACTIVITY_TYPE_LABELS: dict[str, str] = {
    "TM_PERMANENT":         "Permanent Visibility",
    "TM_SEASONAL":          "Seasonal Visibility",
    "COOP_ADVERTISING":     "Coop Advertising",
    "E_TOOLS":              "e-Tools",
    "IN_STORE":             "In Store / Consumer Activation",
    "SPONSORSHIP":          "Sponsorship",
    "TRADE_INCENTIVE":      "Trade Incentive",
    "TRAINING":             "Training",
    "PR":                   "PR",
    "CATALOGUES_BROCHURES": "Catalogues & Brochures",
    "MEDICAL_AFFAIRS":      "Medical Affairs",
    "EVENTS":               "Events",
    "OTHER_ADVERTISING":    "Other ADV Expenses",
    "OTHER":                "Others (non ADV)",
}

ACTIVITY_TYPES: list[str] = list(ACTIVITY_TYPE_LABELS.keys())

# The Title Case spellings still sitting on 144 historical rows. Accepted on
# input and mapped to the code, so an older client or a re-import of an old file
# does not fail validation — but nothing new is written in this form.
ACTIVITY_TYPE_ALIASES: dict[str, str] = {
    label.lower(): code for code, label in ACTIVITY_TYPE_LABELS.items()
}


def activity_label(code: str | None) -> str:
    """Display form for a stored activity code. Unknown codes pass through."""
    if not code:
        return ""
    return ACTIVITY_TYPE_LABELS.get(code, code)


def normalise_activity_type(value: str | None) -> str | None:
    """Stored form for whatever a client sent — code, label, or old spelling."""
    if not value:
        return value
    v = str(value).strip()
    if v in ACTIVITY_TYPE_LABELS:
        return v
    return ACTIVITY_TYPE_ALIASES.get(v.lower(), v)


# Activity types that show Events-specific fields (SAP code, event type, event purpose)
EVENT_ACTIVITY_TYPES: list[str] = ["EVENTS", "MEDICAL_AFFAIRS"]


# Activity types where # Doors is meaningful (drives avg/door calc)
DOOR_ACTIVITY_TYPES: list[str] = [
    "TM_PERMANENT",
    "TM_SEASONAL",
    "COOP_ADVERTISING",
    "IN_STORE",
    "TRADE_INCENTIVE",
    "CATALOGUES_BROCHURES",
]


# Activity types where # Doors is HIDDEN (per Vanessa Mtg 2)
NO_DOOR_ACTIVITY_TYPES: list[str] = ["SPONSORSHIP"]


# ════════════════════════════════════════════════════════════════════════
#  3. Event TYPE & Event PURPOSE (shown only for Events / Medical Affairs)
# ════════════════════════════════════════════════════════════════════════

EVENT_TYPES: list[str] = [
    "Roadshow",
    "Showroom",
    "Sales Convention",
    "Trade Fairs",
    "Medical Symposium",
    "Client Award Travel",
    "Tortona EL Days",
]

EVENT_PURPOSES: list[str] = [
    "Transactional",
    "Inspirational",
    "Influential",
    "Relational",
]


# ════════════════════════════════════════════════════════════════════════
#  4. Category → Brand mapping
# ════════════════════════════════════════════════════════════════════════
#  - Categories are MULTI-SELECT (e.g. Frames + Lenses on the same LOA)
#  - Ray-Ban ≠ Ray-Ban Meta (confirmed separate entries, Vanessa Mtg 2)
#  - Wearables: full list pending from Vanessa
# ════════════════════════════════════════════════════════════════════════

CATEGORIES: list[str] = [
    "Frames",
    "Lenses",
    "Wearables",
    "Audio",
    "Instruments",
    "All cat.",
]


# ── Brand list with SAP codes ─────────────────────────────────────────────────
# Source: LAURA Dropdown Rules CLIENT v3 (August 2026)
# Deduplicated by code. Bvlgari (BV/BG) and Diesel (DL/DI) appear with
# different codes — both are valid distinct entries.
# Display format in dropdowns: "Name (CODE)", e.g. "Ray-Ban (RB)".

BRANDS: list[dict] = [
    {"code": "6A",     "name": "Costa del Mar Optical"},
    {"code": "FH",     "name": "Ferrari"},
    {"code": "A0",     "name": "Alain Mikli"},
    {"code": "AX",     "name": "Armani Exchange"},
    {"code": "AN",     "name": "Arnette"},
    {"code": "6E",     "name": "Balenciaga"},
    {"code": "BE",     "name": "Burberry"},
    {"code": "BC",     "name": "Brunello Cucinelli"},
    {"code": "BV",     "name": "Bvlgari"},
    {"code": "6L",     "name": "Cartier"},
    {"code": "CE",     "name": "Celine"},
    {"code": "CH",     "name": "Chanel"},
    {"code": "CD",     "name": "Christian Dior"},
    {"code": "HC",     "name": "Coach"},
    {"code": "DB",     "name": "DBYD"},
    {"code": "DY",     "name": "Dkny"},
    {"code": "DG",     "name": "Dolce & Gabbana"},
    {"code": "DK",     "name": "Donna Karan"},
    {"code": "EA",     "name": "Emporio Armani"},
    {"code": "EE",     "name": "Ess"},
    {"code": "FN",     "name": "Fendi"},
    {"code": "99",     "name": "Generic All"},
    {"code": "Frames", "name": "Generic Line Luxottica"},
    {"code": "AR",     "name": "Giorgio Armani"},
    {"code": "GC",     "name": "Gucci"},
    {"code": "KX",     "name": "K & L Ophthalmic"},
    {"code": "LU",     "name": "Luxottica"},
    {"code": "MJ",     "name": "Maui Jim"},
    {"code": "MK",     "name": "Michael Kors"},
    {"code": "MU",     "name": "Miu Miu"},
    {"code": "OX",     "name": "Oakley Ophtalmic"},
    {"code": "OJ",     "name": "Oakley Sole Junior"},
    {"code": "OO",     "name": "Oakley Sunglasses"},
    {"code": "OY",     "name": "Oakley Vista Junior"},
    {"code": "OW",     "name": "Oakley Wearable"},
    {"code": "OV",     "name": "Oliver Peoples"},
    {"code": "PO",     "name": "Persol"},
    {"code": "PH",     "name": "Polo"},
    {"code": "PP",     "name": "Polo Prep"},
    {"code": "PR",     "name": "Prada"},
    {"code": "PS",     "name": "Prada Linea Rossa"},
    {"code": "RA",     "name": "Ralph"},
    {"code": "RL",     "name": "Ralph Lauren"},
    {"code": "RB",     "name": "Ray-Ban"},
    {"code": "RJ",     "name": "Ray-Ban Junior Sole"},
    {"code": "RY",     "name": "Ray-Ban Junior Vista"},
    {"code": "RX",     "name": "Ray-Ban Vista"},
    {"code": "SF",     "name": "Sferoflex"},
    {"code": "SH",     "name": "Starck Eyes"},
    {"code": "TF",     "name": "Tiffany"},
    {"code": "TD",     "name": "Tom Ford"},
    {"code": "TY",     "name": "Tory Burch"},
    {"code": "VA",     "name": "Valentino"},
    {"code": "VE",     "name": "Versace"},
    {"code": "VR",     "name": "Versus"},
    {"code": "VO",     "name": "Vogue"},
    {"code": "VJ",     "name": "Vogue Kids Sole"},
    {"code": "VY",     "name": "Vogue Kids Vista"},
    {"code": "YS",     "name": "Yves Saint Laurent"},
    {"code": "NE",     "name": "Seen"},
    {"code": "UJ",     "name": "Unofficial Junior"},
    {"code": "UO",     "name": "Unofficial"},
    {"code": "6S",     "name": "Costa Del Mar"},
    {"code": "XD",     "name": "Native"},
    {"code": "RW",     "name": "Ray-Ban Wearable"},
    {"code": "EK",     "name": "Emporio Armani Kids"},
    {"code": "VK",     "name": "Versace Kids"},
    {"code": "DX",     "name": "Dolce & Gabbana Kids"},
    {"code": "MF",     "name": "Miraflex"},
    {"code": "P4",     "name": "Polaroid"},
    {"code": "DL",     "name": "Diesel"},
    {"code": "JB",     "name": "Burberry Kids"},
    {"code": "SK",     "name": "Swarovski"},
    {"code": "0L",     "name": "Mont Blanc"},
    {"code": "ZB",     "name": "Bliz"},
    {"code": "ZK",     "name": "Bliz Goggle Kids"},
    {"code": "ZG",     "name": "Bliz Goggle"},
    {"code": "JC",     "name": "Jimmy Choo"},
    {"code": "FZ",     "name": "Ferrari Scuderia"},
    {"code": "ME",     "name": "Moncler"},
    {"code": "AW",     "name": "Nuance Audio"},
    {"code": "L6",     "name": "Levi's"},
    {"code": "Q7",     "name": "EA7"},
    {"code": "Q8",     "name": "EA7 Goggle Snow"},
    {"code": "WX",     "name": "Moncler Goggles Snow"},
    {"code": "OM",     "name": "Oakley Goggles Mx"},
    {"code": "OZ",     "name": "Oakley Goggles Snow"},
    {"code": "BG",     "name": "Bvlgari"},
    {"code": "FO",     "name": "Foster Grant"},
    {"code": "F1E",    "name": "Molsion"},
    {"code": "BJ",     "name": "Bolon"},
    {"code": "FE",     "name": "Ferragamo"},
    {"code": "02",     "name": "Generic - Other"},
    {"code": "2S",     "name": "Silhouette"},
    {"code": "4Y",     "name": "Alaia"},
    {"code": "BB",     "name": "Brooks Brothers"},
    {"code": "UT",     "name": "Unbranded Tier 1"},
    {"code": "OT",     "name": "Other Non Lux - Traditional"},
    {"code": "DJ",     "name": "DBYD Junior"},
    {"code": "NJ",     "name": "Seen Junior"},
    {"code": "3E",     "name": "Disney"},
    {"code": "DI",     "name": "Diesel"},
    {"code": "LX",     "name": "Luxottica Lx"},
    {"code": "CK",     "name": "Calvin Klein"},
    {"code": "I1",     "name": "IC Berlin"},
    {"code": "P7",     "name": "Pierre Cardin"},
    {"code": "2C",     "name": "Prescriptions Brands - Turkey"},
    {"code": "RO",     "name": "Ray-Ban Rox"},
    {"code": "PL",     "name": "Rl Purple Label"},
    {"code": "AV",     "name": "Adrienne Vittadini"},
    {"code": "AK",     "name": "Anne Klein"},
    {"code": "BY",     "name": "Byblos"},
    {"code": "5S",     "name": "Carrera"},
    {"code": "CT",     "name": "Charmant"},
    {"code": "6N",     "name": "Chloe"},
    {"code": "C8",     "name": "Chopard"},
    {"code": "D4",     "name": "Dita"},
    {"code": "GY",     "name": "Genny"},
    {"code": "JS",     "name": "Jil Sander"},
    {"code": "MO",     "name": "Moschino"},
    {"code": "MT",     "name": "Mosley Tribes"},
    {"code": "YY",     "name": "Other Marketing"},
    {"code": "SM",     "name": "Stella Mccartney"},
    {"code": "NL",     "name": "Polinelli"},
    {"code": "8G",     "name": "Generic 3P Code"},
    {"code": "LC",     "name": "Luxottica Collection"},
    {"code": "FU",     "name": "Furla"},
    {"code": "EU",     "name": "Stellest Frames"},
    {"code": "EW",     "name": "Stellest Wearable"},
    {"code": "0A",     "name": "Aes"},
]

# Flat display options for dropdowns: "Name (CODE)"
BRAND_OPTIONS: list[str] = [f"{b['name']} ({b['code']})" for b in BRANDS]

# Legacy alias — kept so get_all_reference_data() consumers still receive brand data.
# Now returns all brands under a single "All" key; the category-filtered UI is gone.
FRAMES_HOUSE_BRANDS: list[str] = []
FRAMES_LICENSE_BRANDS: list[str] = []
BRANDS_BY_CATEGORY: dict[str, list[str]] = {"All": BRAND_OPTIONS}


# ════════════════════════════════════════════════════════════════════════
#  5. Other dropdowns
# ════════════════════════════════════════════════════════════════════════

CAPEX_OPEX: list[str] = ["CapEx", "OpEx"]

ADV_SELLING: list[str] = ["ADV", "Selling", "Others"]

COT_OPTIONS: list[str] = [
    "All COT",
    "Chains",
    "Buying Groups",
    "Independents",
    "E-Wholesale",
    "Sport channel",
    "Travel Retail",
    "Distr. & Export",
    "Others",
]


# ════════════════════════════════════════════════════════════════════════
#  6. LOA status workflow
# ════════════════════════════════════════════════════════════════════════
#  Old workflow (currently in use): draft → submitted → approved/rejected
#  New workflow (relay baton — coming in approval workflow lot):
#    draft → in_country_review → in_global_review →
#    in_regional_approval → in_corporate_review → finalized
#  Both kept available so the migration is non-breaking.
# ════════════════════════════════════════════════════════════════════════

LOA_STATUSES: list[str] = [
    # Current
    "draft",
    "submitted",
    "brand_review",
    "cmo_review",
    "cfo_review",
    "approved",
    "rejected",
    # Future relay workflow (not yet wired)
    "in_country_review",
    "in_global_review",
    "in_regional_approval",
    "in_corporate_review",
    "finalized",
]


# Human-readable labels + Tailwind color classes for the UI
STATUS_LABELS: dict[str, dict[str, str]] = {
    "draft":                  {"label": "Draft",                 "color": "bg-slate-700 text-slate-300"},
    "submitted":              {"label": "Submitted",             "color": "bg-blue-900 text-blue-300"},
    "brand_review":           {"label": "Brand review",          "color": "bg-purple-900 text-purple-300"},
    "cmo_review":             {"label": "CMO review",            "color": "bg-amber-900 text-amber-300"},
    "cfo_review":             {"label": "CFO review",            "color": "bg-orange-900 text-orange-300"},
    "approved":               {"label": "Approved",              "color": "bg-green-900 text-green-300"},
    "rejected":               {"label": "Rejected",              "color": "bg-red-900 text-red-300"},
    "in_country_review":      {"label": "Country review",        "color": "bg-emerald-900 text-emerald-300"},
    "in_global_review":       {"label": "Global brands review",  "color": "bg-rose-900 text-rose-300"},
    "in_regional_approval":   {"label": "Regional approval",     "color": "bg-amber-900 text-amber-300"},
    "in_corporate_review":    {"label": "Corporate review",      "color": "bg-red-900 text-red-300"},
    "finalized":              {"label": "Finalized",             "color": "bg-green-900 text-green-300"},
}


# ════════════════════════════════════════════════════════════════════════
#  7. Hard business rules (referenced by validation + engines)
# ════════════════════════════════════════════════════════════════════════

PPT_SLIDE_THRESHOLD_EUR = 50_000   # FY total > €50K → PPT slide auto-generated
MAX_PHOTOS_PER_LOA = 2
MIN_PHOTO_WIDTH = 1200
MIN_PHOTO_HEIGHT = 900
DEFAULT_CURRENCY = "EUR"


# ════════════════════════════════════════════════════════════════════════
#  Helpers — used by validation, API, and the /reference-data endpoint
# ════════════════════════════════════════════════════════════════════════

def get_countries_for_cluster(cluster: str) -> list[str]:
    """Return country names for a given cluster (used by cascade dropdown)."""
    entries = CLUSTER_CASCADE.get(cluster, [])
    return [e["name"] for e in entries]


def get_legal_entities_for_country(cluster: str, country: str) -> list[str]:
    """Return legal entities for a given cluster+country pair."""
    entries = CLUSTER_CASCADE.get(cluster, [])
    for e in entries:
        if e["name"] == country:
            return e["legal_entities"]
    return []


def get_brands_for_categories(_categories: list[str]) -> list[str]:
    """Return all brand display strings (category filtering removed in v3)."""
    return BRAND_OPTIONS


def is_valid_cluster(value: str) -> bool:
    return value in CLUSTERS


def is_valid_country(cluster: str, country: str) -> bool:
    return country in get_countries_for_cluster(cluster)


def is_valid_activity_type(value: str) -> bool:
    """True for a canonical code, and for the Title Case spelling it replaced."""
    return normalise_activity_type(value) in ACTIVITY_TYPE_LABELS


def get_all_reference_data() -> dict:
    """
    Single payload used by GET /reference-data.
    Frontend fetches this once, caches 24h in localStorage.
    """
    return {
        "version":           REFERENCE_DATA_VERSION,
        "source":            REFERENCE_DATA_SOURCE,
        "clusters":          CLUSTERS,
        "cluster_cascade":   CLUSTER_CASCADE,
        "activity_types":    ACTIVITY_TYPES,
        # code -> display label, so the frontend stops carrying its own copy.
        "activity_type_labels": ACTIVITY_TYPE_LABELS,
        "event_activity_types": EVENT_ACTIVITY_TYPES,
        "door_activity_types":  DOOR_ACTIVITY_TYPES,
        "no_door_activity_types": NO_DOOR_ACTIVITY_TYPES,
        "event_types":       EVENT_TYPES,
        "event_purposes":    EVENT_PURPOSES,
        "categories":        CATEGORIES,
        "brands_by_category": BRANDS_BY_CATEGORY,
        "capex_opex":        CAPEX_OPEX,
        "adv_selling":       ADV_SELLING,
        "cot_options":       COT_OPTIONS,
        "loa_statuses":      LOA_STATUSES,
        "status_labels":     STATUS_LABELS,
        "rules": {
            "ppt_slide_threshold_eur": PPT_SLIDE_THRESHOLD_EUR,
            "max_photos_per_loa":      MAX_PHOTOS_PER_LOA,
            "min_photo_width":         MIN_PHOTO_WIDTH,
            "min_photo_height":        MIN_PHOTO_HEIGHT,
            "default_currency":        DEFAULT_CURRENCY,
        },
    }