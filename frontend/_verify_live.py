import json, urllib.request, urllib.error, re
BE="http://127.0.0.1:8000"; FE="http://localhost:3000"
def tok(e):
    r=urllib.request.Request(BE+"/auth/login",data=json.dumps({"email":e,"password":"laura2026"}).encode(),
                             headers={"Content-Type":"application/json"},method="POST")
    return json.load(urllib.request.urlopen(r))["token"]
def page(path, t):
    req=urllib.request.Request(FE+path, headers={"Cookie":"laura_token="+t})
    try:
        with urllib.request.urlopen(req) as r: return r.status, r.read().decode('utf-8','ignore')
    except urllib.error.HTTPError as e: return e.code, ''

# a real cycle + a real LOA for deep links
at=tok("sandrine@essilor.com")
def get(p,t):
    return json.load(urllib.request.urlopen(urllib.request.Request(BE+p,headers={"Authorization":"Bearer "+t})))
cid=get("/cycles",at)[0]["id"]
lid=get("/loa",at)[0]["id"]

ROLES=[("sandrine@essilor.com","admin"),("alexandra@essilor.com","cmo"),
       ("giulia@essilor.com","cfo"),("flora@laura.local","marketer"),
       ("local-alignment@laura.local","alignment"),("emea-creator@laura.local","emea"),
       ("paola@essilor.com","corporate")]

print("%-30s %-10s %s" % ("USER","IFACE","/  /loas  /cycles  /admin  deck  sheet  both  loa/:id"))
print("-"*104)
for email, want in ROLES:
    t=tok(email); out=[]
    for p in ["/", "/loas", "/cycles", "/admin",
              f"/cycles/{cid}/deck", f"/cycles/{cid}/sheet", f"/cycles/{cid}/both", f"/loa/{lid}"]:
        st,_=page(p,t); out.append(str(st))
    print("%-30s %-10s %s" % (email, want, "  ".join(o.ljust(5) for o in out)))

print("\n=== split-screen present on /loa/:id? (marketer + alignment) ===")
for email in ["flora@laura.local","local-alignment@laura.local","sandrine@essilor.com"]:
    t=tok(email); st,html=page(f"/loa/{lid}",t)
    print("  %-30s status=%s la-ssr=%s divider=%s actionbar=%s" % (
        email, st, html.count('la-ssr-pane'), html.count('la-ssr-divider'), html.count('la-ssr-actionbar')))

print("\n=== admin console: 11 screens listed, 6 pending ===")
t=tok("sandrine@essilor.com"); st,html=page("/admin",t)
labels=["Admin home","Users & people","Roles &amp; permissions","View access","Approval chain",
        "Cycles","Emergency LOAs","Reference data","Data &amp; imports","Audit log","Notifications"]
print("  status=%s  nav items found=%d/11  'pending' markers=%d  data-console=%d" % (
    st, sum(1 for l in labels if l in html), html.count('ac-nav-item-pending'), html.count('data-console')))
print("  hard-coded hex in served console HTML:", len(set(re.findall(r'#[0-9A-Fa-f]{6}', html.split('data-console')[1] if 'data-console' in html else ''))))
