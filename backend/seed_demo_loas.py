"""
Demo LOAs v2 — corrige les noms de colonnes selon le vrai schema.
Remplace le fichier seed_demo_loas.py dans backend/ puis relance :
    python -m backend.seed_demo_loas

Si une LOA echoue encore a cause d'une autre colonne NOT NULL, le script
te dit EXACTEMENT laquelle. Tu colles dans le chat, je corrige en 30 s.
"""

import uuid
from datetime import datetime, timedelta

try:
    from backend.models.loa import LOA
    from backend.models.database import SessionLocal
    from sqlalchemy import inspect as sa_inspect
except Exception as e:
    print(f"Import error: {e}")
    raise


today = datetime.utcnow()
def days_ago(n): return today - timedelta(days=n)


# Defaults appliques a toutes les LOAs (couvre les colonnes NOT NULL connues
# + valeurs neutres pour les flags / devises / totaux).
COMMON_DEFAULTS = {
    "cot": 0.0,
    "is_demo": True,
    "ai_suggestion_used": False,
    "currency": "EUR",
    "capex_opex": "OpEx",
    "adv_selling": "ADV",
    "fy_2025_total": 0.0,
    "q4_2025": 0.0,
    "q1_2026": 0.0,
    "q2_2026": 0.0,
    "q3_2026": 0.0,
    "q4_2026": 0.0,
    "fy_2026_total": 0.0,
    "ppt_slide_required": False,
}


DEMO_LOAS = [
    # 1) DRAFT
    {
        "loa_number": "LOA-DEMO-001",
        "event_purpose": "Ray-Ban Co-op France — Spring Activation",
        "cluster": "FRANCE",
        "country": "France Frames",
        "category": "Frames",
        "brand": "RB",
        "activity_type": "Coop",
        "vendor": "Optic 2000",
        "num_doors": 1200,
        "q1_2026": 45000.0, "q2_2026": 60000.0, "q3_2026": 45000.0, "q4_2026": 30000.0,
        "fy_2026_total": 180000.0,
        "avg_investment_per_door": 150.0,
        "status": "draft",
        "requestor_email": "france-marketer@laura-demo.local",
        "description": "Spring co-op campaign with Optic 2000 to drive Ray-Ban frame visibility across 1,200 doors. Window dressing kits, in-store visuals, and POSM rollout.",
        "kpi": "Sell-out volume +12% vs LY. Door activation rate >= 85%.",
        "tools": "Window kits, POSM, training videos for opticians.",
        "ppt_slide_required": True,
        "created_at": days_ago(2),
    },
    # 2) IN_COUNTRY_REVIEW
    {
        "loa_number": "LOA-DEMO-002",
        "event_purpose": "Oakley Tailor Made Seasonal — DACH Winter",
        "cluster": "DACH",
        "country": "Germany",
        "category": "Frames",
        "brand": "OO",
        "activity_type": "Tailor Made Seasonal",
        "vendor": "Apollo Optik",
        "num_doors": 850,
        "q3_2026": 120000.0, "q4_2026": 120000.0,
        "fy_2026_total": 240000.0,
        "avg_investment_per_door": 282.0,
        "status": "in_country_review",
        "requestor_email": "dach-marketer@laura-demo.local",
        "description": "Winter seasonal push for Oakley Performance line across Apollo Optik network in Germany and Austria. Tailored seasonal POS and digital extensions.",
        "kpi": "Sell-in +18%, sell-out +10%, premium SKU mix >= 35%.",
        "tools": "Tailored seasonal POS, digital extensions, ambassador clinics.",
        "ppt_slide_required": True,
        "created_at": days_ago(7),
        "submitted_at": days_ago(1),
    },
    # 3) IN_GLOBAL_REVIEW
    {
        "loa_number": "LOA-DEMO-003",
        "event_purpose": "Persol Events — Silmo Paris Activation",
        "cluster": "NORTH",
        "country": "Nordics",
        "category": "Frames",
        "brand": "PO",
        "activity_type": "Events",
        "vendor": "Silmo Paris",
        "num_doors": 0,
        "q3_2026": 95000.0,
        "fy_2026_total": 95000.0,
        "avg_investment_per_door": 0.0,
        "status": "in_global_review",
        "requestor_email": "north-marketer@laura-demo.local",
        "description": "Premium Persol activation at Silmo Paris — booth, ambassador appearances, B2B trade meetings, social amplification.",
        "kpi": "Trade leads >= 250, social impressions >= 5M, top-3 ranked booth.",
        "tools": "Booth design, ambassador kit, social toolkit, B2B meeting concierge.",
        "ppt_slide_required": True,
        "created_at": days_ago(14),
        "submitted_at": days_ago(8),
    },
    # 4) IN_REGIONAL_APPROVAL
    {
        "loa_number": "LOA-DEMO-004",
        "event_purpose": "Vogue Eyewear PR Push — Italy SS26",
        "cluster": "ITALY",
        "country": "Italy",
        "category": "Frames",
        "brand": "VO",
        "activity_type": "PR",
        "vendor": "Hill+Knowlton",
        "num_doors": 0,
        "q1_2026": 30000.0, "q2_2026": 30000.0,
        "fy_2026_total": 60000.0,
        "avg_investment_per_door": 0.0,
        "status": "in_regional_approval",
        "requestor_email": "italy-marketer@laura-demo.local",
        "description": "SS26 fashion press push to reinforce Vogue Eyewear's positioning with Italian fashion media. Influencer seeding + editor breakfasts.",
        "kpi": "Earned media value >= EUR 600k, top-tier placements >= 8.",
        "tools": "Influencer seeding kits, editor breakfasts, press release distribution.",
        "ppt_slide_required": True,
        "created_at": days_ago(21),
        "submitted_at": days_ago(15),
    },
    # 5) FINALIZED / APPROVED
    {
        "loa_number": "LOA-DEMO-005",
        "event_purpose": "Essilor Varilux In-Store — France National",
        "cluster": "FRANCE",
        "country": "France Lenses ESSILOR",
        "category": "Lenses",
        "brand": "ES",
        "activity_type": "In Store",
        "vendor": "GrandVision",
        "num_doors": 1800,
        "q1_2026": 36000.0, "q2_2026": 36000.0, "q3_2026": 36000.0, "q4_2026": 37000.0,
        "fy_2026_total": 145000.0,
        "avg_investment_per_door": 81.0,
        "status": "finalized",
        "requestor_email": "france-marketer@laura-demo.local",
        "description": "Year-long in-store activation for Varilux X across GrandVision France. Demonstration tools, optician training, customer testing kits.",
        "kpi": "Varilux mix +6 pts, premium upgrade rate +9%.",
        "tools": "Demo lenses, testing stations, optician training modules.",
        "ppt_slide_required": True,
        "created_at": days_ago(40),
        "submitted_at": days_ago(35),
        "approved_at": days_ago(5),
    },
    # 6) REJECTED
    {
        "loa_number": "LOA-DEMO-006",
        "event_purpose": "Ray-Ban Co-op East — Q2 Burst",
        "cluster": "EAST",
        "country": "Poland & Baltics",
        "category": "Frames",
        "brand": "RB",
        "activity_type": "Coop",
        "vendor": "Vision Express",
        "num_doors": 420,
        "q2_2026": 75000.0,
        "fy_2026_total": 75000.0,
        "avg_investment_per_door": 179.0,
        "status": "rejected",
        "requestor_email": "east-marketer@laura-demo.local",
        "description": "Q2 burst campaign with Vision Express across Poland and Baltics. POSM refresh + digital boost.",
        "kpi": "Sell-out +8%, door coverage 90%.",
        "tools": "POSM refresh kit, digital banners, opticians incentive.",
        "rejection_reason": "Budget excede l'enveloppe Q2 du cluster EAST. Re-soumettre avec un montant revu.",
        "ppt_slide_required": True,
        "created_at": days_ago(28),
        "submitted_at": days_ago(20),
    },
]


def discover_required_columns():
    """Imprime les colonnes NOT NULL sans default — celles qu'on DOIT fournir."""
    table = LOA.__table__
    required = []
    for col in table.columns:
        if not col.nullable and col.default is None and col.server_default is None and not col.autoincrement:
            required.append((col.name, str(col.type)))
    print("\nColonnes NOT NULL (obligatoires) du modele LOA :")
    if required:
        for name, type_ in required:
            print(f"   - {name:35s} {type_}")
    else:
        print("   (aucune)")
    return [r[0] for r in required]


def run():
    LOA_COLUMNS = {col.name for col in LOA.__table__.columns}
    required_cols = discover_required_columns()
    print()

    db = SessionLocal()
    created, updated, failed = 0, 0, 0
    try:
        for data in DEMO_LOAS:
            # 1. applique les defauts communs
            row = {**COMMON_DEFAULTS, **data}
            # 2. filtre sur les colonnes qui existent vraiment
            row = {k: v for k, v in row.items() if k in LOA_COLUMNS}
            # 3. previens si une colonne obligatoire manque
            missing = [c for c in required_cols if c not in row and c != "id"]
            if missing:
                print(f"   ! {data['loa_number']}: colonnes obligatoires manquantes -> {missing}")

            try:
                existing = db.query(LOA).filter(LOA.loa_number == data["loa_number"]).one_or_none()
                if existing:
                    for k, v in row.items():
                        setattr(existing, k, v)
                    db.commit()
                    updated += 1
                    print(f"   OK update {data['loa_number']}  (statut: {row.get('status')})")
                else:
                    if "id" not in row:
                        row["id"] = uuid.uuid4()
                    db.add(LOA(**row))
                    db.commit()
                    created += 1
                    print(f"   OK insert {data['loa_number']}  (statut: {row.get('status')})")
            except Exception as e:
                db.rollback()
                failed += 1
                print(f"   ECHEC {data['loa_number']}")
                print(f"           --> {type(e).__name__}: {str(e)[:300]}")
    finally:
        db.close()

    print(f"\n----- Resume -----")
    print(f"  {created} creees, {updated} mises a jour, {failed} en echec")
    if failed > 0:
        print(f"\nPour chaque ECHEC, copie la ligne 'ECHEC ...' ci-dessus dans le chat.")
    else:
        print(f"\nVa sur le tracker LAURA, refresh, tu dois voir 6 LOAs avec 6 statuts.")


if __name__ == "__main__":
    run()