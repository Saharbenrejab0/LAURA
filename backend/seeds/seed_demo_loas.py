"""
LAURA — Seed demo LOAs (v3 — clean replacement)
=================================================
10 realistic LOAs, one per workflow status.
Aligned with backend WORKFLOW_TRANSITIONS + client dropdown rules v2.

Usage (either works):
    python -m backend.seed_demo_loas
    python -m backend.seeds.seed_demo_loas
"""

import uuid
from datetime import datetime, timedelta

try:
    from backend.models.loa import LOA
    from backend.models.database import SessionLocal
except Exception as e:
    print(f"Import error: {e}")
    raise

today = datetime.utcnow()
def days_ago(n):
    return today - timedelta(days=n)

REQUESTOR = "sahar@aitomarket.com"

def draft_id(suffix):
    return f"LAURA-{today.strftime('%Y%m%d')}-{suffix.upper()}"

DEMO_LOAS = [
    {
        "status": "draft",
        "cluster": "FRANCE", "country": "France", "legal_entity": "Luxottica France",
        "activity_type": "Seasonal Visibility", "cot": "Independents",
        "category": ["Frames"], "brand": "HB - Ray-Ban",
        "capex_opex": "OpEx", "adv_selling": "ADV",
        "customer": "Krys Group", "vendor": "Altavia",
        "num_doors": 220, "num_customers": 1, "currency": "EUR",
        "q4_2025": 0, "q1_2026": 18000, "q2_2026": 17000, "q3_2026": 0, "q4_2026": 0,
        "description": "Drive Ray-Ban seasonal sell-through within Krys independent network via in-store POS refresh.",
        "detail": "Seasonal POS materials (counter displays, window visuals, glorifiers) for 220 Krys doors across France.",
        "kpi": "+8% Ray-Ban sell-through rate vs H1 2025",
        "cost_drill_down": "POS design: 5K€ · Production (220 kits): 22K€ · Distribution: 8K€",
        "start_date": "2026-02-01", "end_date": "2026-06-30",
        "created_at": days_ago(2),
    },
    {
        "status": "local_prep",
        "cluster": "FRANCE", "country": "France", "legal_entity": "Essilor France",
        "activity_type": "Permanent Visibility", "cot": "Chains",
        "category": ["Lenses"], "brand": "Essilor - Varilux",
        "capex_opex": "CapEx", "adv_selling": "ADV",
        "customer": "Optic 2000", "vendor": "Publicis Luxe",
        "num_doors": 1200, "num_customers": 1, "currency": "EUR",
        "q4_2025": 30000, "q1_2026": 30000, "q2_2026": 30000, "q3_2026": 30000, "q4_2026": 30000,
        "description": "Reinforce Varilux as the premium progressive lens within Optic 2000 via permanent branded spaces.",
        "detail": "Permanent Varilux corners with digital screens, lens demo stations in 1,200 Optic 2000 stores.",
        "kpi": "+15% Varilux sell-out within Optic 2000 · 90% installation rate",
        "cost_drill_down": "Corner design: 15K€ · Production (1,200): 72K€ · Digital: 18K€ · Installation: 15K€",
        "start_date": "2026-01-01", "end_date": "2026-12-31",
        "created_at": days_ago(5), "submitted_at": days_ago(3),
    },
    {
        "status": "country_review",
        "cluster": "DACH", "country": "Germany", "legal_entity": "EL Germany",
        "activity_type": "Coop Advertising", "cot": "Buying Groups",
        "category": ["Frames"], "brand": "HB - Oakley",
        "capex_opex": "OpEx", "adv_selling": "ADV",
        "customer": "Fielmann", "vendor": "Fielmann Marketing GmbH",
        "num_doors": 450, "num_customers": 1, "currency": "EUR",
        "q4_2025": 0, "q1_2026": 25000, "q2_2026": 30000, "q3_2026": 30000, "q4_2026": 0,
        "description": "Accelerate Oakley performance eyewear penetration within Fielmann through co-branded digital campaigns.",
        "detail": "Co-branded digital campaign (social, display, programmatic) targeting sports-active consumers.",
        "kpi": "+12% Oakley sell-out within Fielmann · 2M impressions · 0.8% CTR",
        "cost_drill_down": "Creative: 12K€ · Media spend: 55K€ · Landing page: 8K€ · Reporting: 10K€",
        "start_date": "2026-03-01", "end_date": "2026-09-30",
        "created_at": days_ago(8), "submitted_at": days_ago(5),
    },
    {
        "status": "global_review",
        "cluster": "NORTH", "country": "UK", "legal_entity": "Essilor Ltd",
        "activity_type": "Events", "event_type": "Trade Fairs",
        "event_purpose": "Transactional", "sap_event_code": "2026N1UKEV001",
        "cot": "All COT",
        "category": ["Frames", "Lenses"], "brand": "all HB + all LB",
        "capex_opex": "OpEx", "adv_selling": "ADV",
        "customer": "UK ECPs", "vendor": "George P. Johnson",
        "num_doors": 0, "num_customers": 350, "currency": "GBP",
        "q4_2025": 0, "q1_2026": 0, "q2_2026": 200000, "q3_2026": 0, "q4_2026": 0,
        "description": "Deliver strong brand performance at 100% Optical 2026 through an elevated booth experience.",
        "detail": "Full exhibition stand at 100% Optical (London ExCeL), product launches, training, networking.",
        "kpi": "350 ECP meetings · 85% positive feedback · £500K pipeline",
        "cost_drill_down": "Space: 45K£ · Stand: 80K£ · Staff: 25K£ · Catering: 15K£ · AV: 20K£ · Travel: 15K£",
        "start_date": "2026-05-10", "end_date": "2026-05-12",
        "created_at": days_ago(12), "submitted_at": days_ago(8),
    },
    {
        "status": "cmo_review",
        "cluster": "ITALY", "country": "Italy", "legal_entity": "ELWI",
        "activity_type": "Seasonal Visibility", "cot": "Independents",
        "category": ["Frames"], "brand": "LB - Prada",
        "capex_opex": "OpEx", "adv_selling": "ADV",
        "customer": "Italian independent ECPs", "vendor": "Luxottica Creative Studio",
        "num_doors": 600, "num_customers": 580, "currency": "EUR",
        "q4_2025": 0, "q1_2026": 25000, "q2_2026": 25000, "q3_2026": 25000, "q4_2026": 0,
        "description": "Strengthen Prada Eyewear positioning among Italian independents via seasonal campaigns.",
        "detail": "Seasonal POS refresh (window visuals, counter cards, digital) for SS26 and FW26 across 600 ECPs.",
        "kpi": "+10% Prada sell-out YoY · 85% sell-through on seasonal SKUs",
        "cost_drill_down": "Creative: 10K€ · Production SS26: 25K€ · FW26: 25K€ · Distribution: 15K€",
        "start_date": "2026-01-15", "end_date": "2026-10-31",
        "created_at": days_ago(15), "submitted_at": days_ago(12),
    },
    {
        "status": "cfo_review",
        "cluster": "FRANCE", "country": "France", "legal_entity": "Luxottica France",
        "activity_type": "Sponsorship", "cot": "All COT",
        "category": ["Wearables"], "brand": "HB - Ray-Ban Meta",
        "capex_opex": "OpEx", "adv_selling": "ADV",
        "customer": "Roland-Garros (FFT)", "vendor": "Havas Sports",
        "num_doors": 0, "num_customers": 0, "currency": "EUR",
        "q4_2025": 100000, "q1_2026": 100000, "q2_2026": 150000, "q3_2026": 100000, "q4_2026": 100000,
        "description": "Accelerate Ray-Ban Meta awareness among premium French consumers through Roland-Garros partnership.",
        "detail": "Title sponsorship of Ray-Ban Meta Lounge at Roland-Garros 2026, activations, player gifting, social.",
        "kpi": "50M social impressions · 25% awareness uplift · 500 trials on-site",
        "cost_drill_down": "Sponsorship: 200K€ · Lounge: 100K€ · Activation: 50K€ · PR: 60K€ · Social: 40K€",
        "start_date": "2025-10-01", "end_date": "2026-09-30",
        "created_at": days_ago(18), "submitted_at": days_ago(15),
    },
    {
        "status": "corporate_review",
        "cluster": "IBERIA", "country": "Spain", "legal_entity": "EssilorLuxottica Spain",
        "activity_type": "Trade Incentive", "cot": "Independents",
        "category": ["Lenses"], "brand": "Essilor - Stellest",
        "capex_opex": "OpEx", "adv_selling": "Selling",
        "customer": "Spanish independent ECPs", "vendor": "Internal sales team",
        "num_doors": 800, "num_customers": 750, "currency": "EUR",
        "q4_2025": 0, "q1_2026": 25000, "q2_2026": 25000, "q3_2026": 25000, "q4_2026": 20000,
        "description": "Drive Stellest myopia management adoption among Spanish ECPs through trade incentives.",
        "detail": "Tiered rebate program: ECPs reaching quarterly Stellest targets receive 2-5% incremental margin.",
        "kpi": "+20% Stellest volume vs 2025 · 300 new ECPs · 70% tier achievement",
        "cost_drill_down": "Rebates: 75K€ · Program mgmt: 10K€ · Onboarding: 10K€",
        "start_date": "2026-01-01", "end_date": "2026-12-31",
        "created_at": days_ago(22), "submitted_at": days_ago(18),
    },
    {
        "status": "ceo_validation",
        "cluster": "FRANCE", "country": "France", "legal_entity": "EL France",
        "activity_type": "Permanent Visibility", "cot": "Chains",
        "category": ["Frames", "Lenses"], "brand": "all HB + all LB",
        "capex_opex": "CapEx", "adv_selling": "ADV",
        "customer": "GrandVision France", "vendor": "AKQA",
        "num_doors": 500, "num_customers": 1, "currency": "EUR",
        "q4_2025": 50000, "q1_2026": 75000, "q2_2026": 75000, "q3_2026": 75000, "q4_2026": 75000,
        "description": "Deliver elevated in-store experience across GrandVision France with branded corners.",
        "detail": "EssilorLuxottica branded corners in 500 stores: digital lens demo, frame walls, Stellest space.",
        "kpi": "+18% sell-out all brands · 95% installation · +25% Varilux mix",
        "cost_drill_down": "Design: 30K€ · Production (500): 180K€ · CMS: 25K€ · Install: 40K€ · Refresh: 25K€",
        "start_date": "2026-01-01", "end_date": "2026-12-31",
        "created_at": days_ago(25), "submitted_at": days_ago(22),
    },
    {
        "status": "approved",
        "cluster": "NORTH", "country": "UK", "legal_entity": "Luxottica LNE",
        "activity_type": "Coop Advertising", "cot": "Chains",
        "category": ["Frames"], "brand": "HB - Oakley",
        "capex_opex": "OpEx", "adv_selling": "ADV",
        "customer": "Boots Opticians", "vendor": "WPP / VMLY&R",
        "num_doors": 350, "num_customers": 1, "currency": "GBP",
        "q4_2025": 0, "q1_2026": 20000, "q2_2026": 25000, "q3_2026": 20000, "q4_2026": 0,
        "description": "Grow Oakley Rx within Boots Opticians via co-branded digital and in-store campaign.",
        "detail": "Co-branded campaign across Boots digital channels + in-store POS (350 stores).",
        "kpi": "+14% Oakley Rx sell-out · 1.5M email reach · 12% conversion uplift",
        "cost_drill_down": "Creative: 10K£ · Digital: 30K£ · POS: 15K£ · Mgmt: 10K£",
        "start_date": "2026-01-15", "end_date": "2026-09-30",
        "created_at": days_ago(35), "submitted_at": days_ago(30), "approved_at": days_ago(2),
    },
    {
        "status": "rejected",
        "cluster": "DACH", "country": "Germany", "legal_entity": "Essilor Germany",
        "activity_type": "Training", "cot": "All COT",
        "category": ["Lenses"], "brand": "Essilor - Masterbrand",
        "capex_opex": "OpEx", "adv_selling": "ADV",
        "customer": "German ECPs", "vendor": "Essilor Academy DACH",
        "num_doors": 0, "num_customers": 200, "currency": "EUR",
        "q4_2025": 0, "q1_2026": 15000, "q2_2026": 15000, "q3_2026": 15000, "q4_2026": 0,
        "description": "Strengthen Essilor lens expertise among German ECPs through advanced training.",
        "detail": "3-day lens fitting certification across 4 cities (Munich, Berlin, Hamburg, Frankfurt), 50 ECPs/session.",
        "kpi": "200 ECPs certified · 90% satisfaction · +5% Essilor share among trained",
        "cost_drill_down": "Venues: 12K€ · Speakers: 10K€ · Materials: 8K€ · Catering: 6K€ · Travel: 9K€",
        "rejection_reason": "Budget exceeds DACH H1 2026 training envelope. Resubmit with 2 cities or split H1/H2.",
        "start_date": "2026-03-01", "end_date": "2026-09-30",
        "created_at": days_ago(24), "submitted_at": days_ago(20),
    },
]


def run():
    """Insert or update 10 demo LOAs — one per workflow status."""
    LOA_COLUMNS = {col.name for col in LOA.__table__.columns}
    db = SessionLocal()
    created, updated, failed = 0, 0, 0

    print("🌱 Seeding LAURA demo LOAs…\n")

    try:
        for i, data in enumerate(DEMO_LOAS):
            loa_id = str(uuid.uuid4())
            suffix = f"DEMO{i+1:02d}"
            did = draft_id(suffix)

            # Calculate totals
            q1 = data.get("q1_2026", 0)
            q2 = data.get("q2_2026", 0)
            q3 = data.get("q3_2026", 0)
            q4 = data.get("q4_2026", 0)
            fy26 = q1 + q2 + q3 + q4
            doors = data.get("num_doors", 0)

            row = {
                "id": loa_id,
                "loa_draft_id": did,
                "is_demo": True,
                "ai_suggestion_used": False,
                "requestor_email": REQUESTOR,
                "fy_2025_total": data.get("q4_2025", 0),
                "fy_2026_total": fy26,
                "avg_investment_per_door": (fy26 / doors) if doors > 0 else None,
                "ppt_slide_required": fy26 > 50000,
                **data,
            }

            # Keep only real LOA columns
            row = {k: v for k, v in row.items() if k in LOA_COLUMNS}

            try:
                existing = db.query(LOA).filter(LOA.loa_draft_id == did).one_or_none()
                if existing:
                    for k, v in row.items():
                        if k != "id":
                            setattr(existing, k, v)
                    db.commit()
                    updated += 1
                    tag = "updated"
                else:
                    row.setdefault('source', 'demo_seed')  # fixtures, never live data
                    db.add(LOA(**row))
                    db.commit()
                    created += 1
                    tag = "created"

                print(f"  ✓ {tag:8s} | {data['status']:20s} | {data['cluster']:8s} | {data['brand']}")

            except Exception as e:
                db.rollback()
                failed += 1
                print(f"  ✗ FAILED  | {data['status']:20s} | {data['cluster']:8s} | {data['brand']}")
                print(f"            → {type(e).__name__}: {str(e)[:200]}")
    finally:
        db.close()

    print(f"\n{'='*60}")
    print(f"  {created} created, {updated} updated, {failed} failed")
    if failed:
        print("  Copy the FAILED lines above and paste in chat.")
    else:
        print(f"  ✅ All 10 demo LOAs ready for {REQUESTOR}")
    print(f"{'='*60}")


# Compat alias
seed_demo_loas = run

if __name__ == "__main__":
    run()
