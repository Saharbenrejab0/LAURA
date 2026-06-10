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
REFERENCE_DATA_VERSION = "v2.0"
REFERENCE_DATA_SOURCE = "LAURA Dropdown Rules CLIENT v2 (June 2026)"


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
                "EL France",
                "Essilor France",
                "Luxottica France",
                "BBGR",
                "Nikon France",
                "NOVACEL",
                "France PS (all BU's)",
            ],
        },
    ],
    "ITALY": [
        {
            "name": "Italy",
            "legal_entities": ["ELWI", "Essilor Italie"],
        },
    ],
    "DACH": [
        {
            "name": "Germany",
            "legal_entities": [
                "EL Germany",
                "Essilor Germany",
                "Luxottica Germany",
                "Nika",
                "R+H",
            ],
        },
        {
            "name": "Austria",
            "legal_entities": [
                "EL Austria",
                "Essilor Austria",
                "Luxottica Austria",
            ],
        },
        {
            "name": "Switzerland",
            "legal_entities": [
                "Essilor Switzerland",
                "Luxottica Switzerland",
                "Reize",
            ],
        },
    ],
    "IBERIA": [
        {
            "name": "Spain",
            "legal_entities": [
                "Essilor Spain",
                "EssilorLuxottica Spain",
                "Luxottica Spain",
            ],
        },
        {
            "name": "Portugal",
            "legal_entities": [
                "Essilor Portugal",
                "EssilorLuxottica Portugal",
                "Luxottica Portugal",
            ],
        },
    ],
    "NORTH": [
        {
            "name": "UK",
            "legal_entities": [
                "Essilor Ltd",
                "LNE",
                "Luxottica LNE",
                "Transitions",
            ],
        },
        {
            "name": "Belgium",
            "legal_entities": ["EssilorLuxottica Belgium", "LNE"],
        },
        {
            "name": "Netherlands",
            "legal_entities": [
                "EssilorLuxottica Netherlands",
                "LNE",
                "Luxottica",
            ],
        },
        {
            "name": "Nordics",
            "legal_entities": ["Essilor", "LNE", "Luxottica LNE"],
        },
    ],
    "META": [
        {
            "name": "Israel",
            "legal_entities": ["Luxottica Israel"],
        },
        {
            "name": "GCC & Export",
            "legal_entities": [
                "Essilor KSA",
                "Essilor Optical Supplies UAE",
                "Essilor Saudi Arabia",
                "Luxottica Middle East",
            ],
        },
        {
            "name": "Turkey",
            "legal_entities": ["Essilor Luxottica Turkey"],
        },
        {
            "name": "North Africa",
            "legal_entities": ["Luxottica Middle East"],
        },
        {
            "name": "South Africa",
            "legal_entities": ["Luxottica Southern Africa"],
        },
    ],
    "EAST": [
        {
            "name": "Romania",
            "legal_entities": ["EssilorRomania", "Rhein Vision"],
        },
        {
            "name": "Czech Republic + Slovakia",
            "legal_entities": [
                "ESSILOR",
                "Luxottica Central Europe Kft",
                "OMEGA OPTIX",
            ],
        },
        {
            "name": "Hungary",
            "legal_entities": [
                "Essilor Optika Kft.",
                "Luxottica Central Europe Kft",
            ],
        },
        {
            "name": "Poland & Baltics",
            "legal_entities": [
                "ESSILOR",
                "Essilor Polonia",
                "JAI KUDO Poland",
                "JZO Poland",
                "Luxottica Baltics",
                "Luxottica Poland",
            ],
        },
        {
            "name": "Greece",
            "legal_entities": ["Bairamoglou", "LUXOTTICA HELLAS"],
        },
        {
            "name": "SEE",
            "legal_entities": [
                "Essilor Adria",
                "Essilor Bulgaria",
                "Essilor Croatia",
                "Essilor Serbia",
                "Essilor Slovenia",
                "Luxottica SEE",
            ],
        },
    ],
    "EMEA": [
        {
            "name": "EMEA",
            "legal_entities": ["Essilor International", "Transitions"],
        },
    ],
    "RUSSIA": [
        {
            "name": "Russia",
            "legal_entities": ["Essilor Luis Optica"],
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

ACTIVITY_TYPES: list[str] = [
    "Permanent Visibility",
    "Seasonal Visibility",
    "Coop Advertising",
    "e-Tools",
    "In Store / Consumer Activation",
    "Sponsorship",
    "Trade Incentive",
    "Training",
    "PR",
    "Catalogues & Brochures",
    "Medical Affairs",
    "Events",
    "Other ADV Expenses",
    "Others (non ADV)",
]


# Activity types that show Events-specific fields (SAP code, event type, event purpose)
EVENT_ACTIVITY_TYPES: list[str] = ["Events", "Medical Affairs"]


# Activity types where # Doors is meaningful (drives avg/door calc)
DOOR_ACTIVITY_TYPES: list[str] = [
    "Permanent Visibility",
    "Seasonal Visibility",
    "Coop Advertising",
    "In Store / Consumer Activation",
    "Trade Incentive",
    "Catalogues & Brochures",
]


# Activity types where # Doors is HIDDEN (per Vanessa Mtg 2)
NO_DOOR_ACTIVITY_TYPES: list[str] = ["Sponsorship"]


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


# Frames brands split into House Brands (HB) and License Brands (LB)
FRAMES_HOUSE_BRANDS: list[str] = [
    "HB - Ray-Ban",
    "HB - Ray-Ban Meta",  # SEPARATE from Ray-Ban
    "HB - Oakley",
    "HB - Vogue",
    "HB - Persol",
    "HB - Oliver Peoples",
    "HB - Alain Mikli",
    "HB - BLIZ",
    "HB - Arnette",
    "HB - Others",
    "all HB",
    "Sport (OO/ZB/OW)",
]

FRAMES_LICENSE_BRANDS: list[str] = [
    "LB - Luxury",
    "LB - PFF",
    "LB - Armani Exchange",
    "LB - Brunello Cucinelli",
    "LB - Burberry",
    "LB - Chanel",
    "LB - Dolce & Gabbana",
    "LB - Emporio Armani",
    "LB - Ferrari",
    "LB - Ferrari Scuderia",
    "LB - Giorgio Armani",
    "LB - Jimmy Choo",
    "LB - Michael Kors",
    "LB - Miu Miu",
    "LB - Moncler",
    "LB - Prada",
    "LB - Prada Linea Rossa",
    "LB - Polo Ralph Lauren",
    "LB - Polo",
    "LB - Ralph",
    "LB - Swarovski",
    "LB - Starck Eye",
    "LB - Tiffany",
    "LB - Versace",
    "LB - Others",
    "all LB",
]


BRANDS_BY_CATEGORY: dict[str, list[str]] = {
    "Frames": FRAMES_HOUSE_BRANDS + FRAMES_LICENSE_BRANDS + ["all HB + all LB"],
    "Lenses": [
        "Essilor - Varilux",
        "Essilor - Stellest",
        "Essilor - Eyezen",
        "Essilor - Crizal",
        "Essilor - Masterbrand",
        "Essilor - Multibrand",
        "Multibrand",
        "Nikon",
        "Kodak",
        "Transitions",
        "Galileo",
        "Reize",
        "R + H",
        "Others",
    ],
    "Audio": ["Nuance"],
    "Instruments": [
        "Essilor - Multibrand",
        "Essilor - Masterbrand",
        "Others",
    ],
    "Wearables": [
        "HB - Oakley",
        "HB - Oakley Meta",
        "HB - Ray-Ban",
        "HB - Ray-Ban Meta",
        # Full list to confirm with Vanessa
    ],
    "All cat.": [
        "all HB + all LB",
        "Essilor - Multibrand",
        "all HB",
        "Others",
    ],
}


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


def get_brands_for_categories(categories: list[str]) -> list[str]:
    """
    Return the union of brands for a multi-select category input.
    Preserves order, removes duplicates.
    """
    seen: set[str] = set()
    result: list[str] = []
    for cat in categories:
        for brand in BRANDS_BY_CATEGORY.get(cat, []):
            if brand not in seen:
                seen.add(brand)
                result.append(brand)
    return result


def is_valid_cluster(value: str) -> bool:
    return value in CLUSTERS


def is_valid_country(cluster: str, country: str) -> bool:
    return country in get_countries_for_cluster(cluster)


def is_valid_activity_type(value: str) -> bool:
    return value in ACTIVITY_TYPES


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