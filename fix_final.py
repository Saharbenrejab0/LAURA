"""
LAURA Sprint 4 #28 - Final fix
Replaces the current page.tsx with correct ReviewBeforeSubmit placement.
Run: python fix_final.py
"""
import os, sys

# Find the file
paths = [
    r"frontend\src\app\loa\new\page.tsx",
    "frontend/src/app/loa/new/page.tsx",
]
FILE = None
for p in paths:
    if os.path.exists(p):
        FILE = p
        break

if not FILE:
    print("ERROR: Run this from C:\\Users\\sahar\\Desktop\\Laura")
    sys.exit(1)

with open(FILE, "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Read {len(lines)} lines from {FILE}")

# Step 1: Remove ANY existing ReviewBeforeSubmit JSX (not the import)
clean = []
removing = False
for line in lines:
    if "<ReviewBeforeSubmit" in line and "import" not in line:
        removing = True
        continue
    if removing:
        if "/>" in line.strip():
            removing = False
        continue
    clean.append(line)

print(f"After cleanup: {len(clean)} lines")

# Step 2: Find the correct insertion point
# We need to find the pattern at the end:
#     </div>   <- closes min-h-screen (4 spaces indent)
#   )          <- closes return
# The component goes BEFORE this </div>

# Work backwards to find closing )
ret_idx = None
for i in range(len(clean)-1, -1, -1):
    if clean[i].strip() == ")":
        ret_idx = i
        break

# Find the </div> before )
div_idx = None
for i in range(ret_idx-1, -1, -1):
    s = clean[i].strip()
    if s == "</div>":
        div_idx = i
        break
    elif s:  # non-blank, non-div = stop
        break

if div_idx is None:
    print("ERROR: Cannot find insertion point")
    sys.exit(1)

# Step 3: Check for duplicate </div> above
# The line ABOVE div_idx should close the grid (</div> with more indent)
# If there's an extra </div> with wrong indent, remove it
prev_idx = div_idx - 1
while prev_idx >= 0 and clean[prev_idx].strip() == "":
    prev_idx -= 1

# Count consecutive </div> before the insertion point
consec_divs = []
check = div_idx
while check >= 0 and clean[check].strip() == "</div>":
    consec_divs.insert(0, check)
    check -= 1
    # skip blanks
    while check >= 0 and clean[check].strip() == "":
        check -= 1

# Remove any extra orphaned </div> with weird indentation
to_remove = set()
for idx in consec_divs[:-1]:  # keep the last one (min-h-screen close)
    indent = len(clean[idx]) - len(clean[idx].lstrip())
    # Orphaned divs from bad insertion typically have 0-1 space indent
    if indent <= 1:
        to_remove.add(idx)

if to_remove:
    clean = [l for i, l in enumerate(clean) if i not in to_remove]
    print(f"Removed {len(to_remove)} orphaned </div>")
    # Recalculate
    ret_idx = None
    for i in range(len(clean)-1, -1, -1):
        if clean[i].strip() == ")":
            ret_idx = i
            break
    div_idx = None
    for i in range(ret_idx-1, -1, -1):
        s = clean[i].strip()
        if s == "</div>":
            div_idx = i
            break
        elif s:
            break

# Step 4: Insert the component
component_lines = [
    "\n",
    "      <ReviewBeforeSubmit\n",
    "        open={showReview}\n",
    "        onClose={() => setShowReview(false)}\n",
    "        onConfirm={() => { setShowReview(false); handleSubmit(false) }}\n",
    "        saving={saving}\n",
    "        errors={errors}\n",
    "        cluster={cluster}\n",
    "        country={country}\n",
    "        legalEntity={legalEntity}\n",
    "        activityType={activityType}\n",
    "        eventType={eventType}\n",
    "        eventPurpose={eventPurpose}\n",
    "        sapEventCode={sapEventCode}\n",
    "        cot={cot}\n",
    "        category={category}\n",
    "        brand={brand}\n",
    "        capexOpex={capexOpex}\n",
    "        advSelling={advSelling}\n",
    "        currency={currency}\n",
    "        q4_2025={q4_2025}\n",
    "        q1={q1}\n",
    "        q2={q2}\n",
    "        q3={q3}\n",
    "        q4={q4}\n",
    "        fyTotal={fyTotal}\n",
    "        avgPerDoor={avgPerDoor}\n",
    "        pptRequired={pptRequired}\n",
    "        customer={customer}\n",
    "        vendor={vendor}\n",
    "        numCustomers={numCustomers}\n",
    "        numDoors={numDoors}\n",
    "        description={description}\n",
    "        detail={detail}\n",
    "        tools={tools}\n",
    "        kpi={kpi}\n",
    "        timing={timing}\n",
    "        costDrillDown={costDrillDown}\n",
    "        startDate={startDate}\n",
    "        endDate={endDate}\n",
    "        isPermanent={isPermanent}\n",
    "        costSplitLenses={costSplitLenses}\n",
    "        costSplitFrames={costSplitFrames}\n",
    "        forecastedLenses={forecastedLenses}\n",
    "        forecastedFrames={forecastedFrames}\n",
    "        forecastedInstruments={forecastedInstruments}\n",
    "        requestorEmail={requestorEmail}\n",
    "        financeEmail={financeEmail}\n",
    "        photos={photos}\n",
    "      />\n",
]

final = clean[:div_idx] + component_lines + clean[div_idx:]

with open(FILE, "w", encoding="utf-8") as f:
    f.writelines(final)

# Verify
with open(FILE, "r", encoding="utf-8") as f:
    result = f.read()

total = result.count("\n") + 1
jsx_count = result.count("open={showReview}")
import_count = result.count("import ReviewBeforeSubmit")

print(f"\nResult: {total} lines")
print(f"Import: {import_count} (should be 1)")
print(f"JSX: {jsx_count} (should be 1)")

# Show last 10 lines
rlines = result.split("\n")
print("\n--- Last 10 lines ---")
for l in rlines[-10:]:
    print(f"  |{l}")

if import_count == 1 and jsx_count == 1:
    print("\n✅ SUCCESS — refresh localhost:3000/loa/new")
else:
    print("\n❌ Something went wrong — share the output")
