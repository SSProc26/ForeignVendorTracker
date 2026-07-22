"""
Full audit test suite — positive AND negative scenarios for every backend feature.
Runs against an in-memory MongoDB (mongomock) so no external services are required.
"""
import os, sys, asyncio

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "vendor_tracker_test")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-audit")
os.environ.setdefault("ADMIN_PASSCODE", "123456")
os.environ.setdefault("ADMIN_EMAIL", "admin@vendortracker.io")
os.environ.setdefault("CORS_ORIGINS", "*")

from mongomock_motor import AsyncMongoMockClient
import motor.motor_asyncio
motor.motor_asyncio.AsyncIOMotorClient = AsyncMongoMockClient

sys.path.insert(0, "/home/claude/ForeignVendorTracker-main/backend")
import server
from httpx import AsyncClient, ASGITransport

PASS, FAIL = [], []

def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
        print(f"  ✅ {name}")
    else:
        FAIL.append((name, detail))
        print(f"  ❌ {name}  {detail}")

async def main():
    # Run startup handlers (index creation + admin seeding)
    for h in server.app.router.on_startup:
        await h()

    transport = ASGITransport(app=server.app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:

        print("\n=== 1. HEALTH & PUBLIC ENDPOINTS ===")
        r = await c.get("/api/")
        check("GET /api/ returns ok", r.status_code == 200 and r.json().get("ok") is True, r.text[:120])

        r = await c.get("/api/settings/wording")
        check("GET /api/settings/wording is public (no auth)", r.status_code == 200, f"got {r.status_code}")

        print("\n=== 2. AUTH — POSITIVE ===")
        r = await c.get("/api/auth/members")
        check("GET members list (public)", r.status_code == 200, r.text[:120])
        members = r.json() if r.status_code == 200 else []
        check("Seeded admin exists", len(members) >= 1, f"members={len(members)}")
        admin_id = members[0]["id"] if members else None

        r = await c.post("/api/auth/login", json={"user_id": admin_id, "passcode": "123456"})
        check("Login with correct passcode", r.status_code == 200, r.text[:150])
        token = r.json().get("token") if r.status_code == 200 else None
        AH = {"Authorization": f"Bearer {token}"}

        r = await c.get("/api/auth/me", headers=AH)
        check("GET /auth/me with valid token", r.status_code == 200, r.text[:120])
        check("Logged-in user has admin role", r.json().get("role") == "admin" if r.status_code == 200 else False)

        print("\n=== 3. AUTH — NEGATIVE ===")
        r = await c.post("/api/auth/login", json={"user_id": admin_id, "passcode": "999999"})
        check("Login rejects wrong passcode", r.status_code in (400, 401), f"got {r.status_code}")

        r = await c.post("/api/auth/login", json={"user_id": "nonexistent-id", "passcode": "123456"})
        check("Login rejects unknown user", r.status_code in (400, 401, 404), f"got {r.status_code}")

        r = await c.post("/api/auth/login", json={"user_id": admin_id, "passcode": "abc"})
        check("Login rejects non-numeric passcode (validation)", r.status_code == 422, f"got {r.status_code}")

        r = await c.post("/api/auth/login", json={"user_id": admin_id, "passcode": "12345"})
        check("Login rejects 5-digit passcode", r.status_code == 422, f"got {r.status_code}")

        r = await c.get("/api/auth/me")
        check("Protected route rejects missing token", r.status_code in (401, 403), f"got {r.status_code}")

        r = await c.get("/api/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
        check("Protected route rejects malformed token", r.status_code in (401, 403), f"got {r.status_code}")

        print("\n=== 4. USER MANAGEMENT — POSITIVE ===")
        r = await c.post("/api/users", json={"name": "Veronica", "role": "admin", "passcode": "111111"}, headers=AH)
        check("Admin can create user", r.status_code == 200, r.text[:150])
        veronica_id = r.json().get("id") if r.status_code == 200 else None

        r = await c.post("/api/users", json={"name": "Giovanni", "role": "reviewer", "passcode": "222222"}, headers=AH)
        check("Admin can create reviewer", r.status_code == 200, r.text[:150])
        reviewer_id = r.json().get("id") if r.status_code == 200 else None

        r = await c.post("/api/users", json={"name": "Andi Approver", "role": "approver", "passcode": "333333"}, headers=AH)
        check("Admin can create approver", r.status_code == 200, r.text[:150])
        approver_id = r.json().get("id") if r.status_code == 200 else None

        r = await c.get("/api/users", headers=AH)
        check("Admin can list users", r.status_code == 200 and len(r.json()) >= 4, f"count={len(r.json()) if r.status_code==200 else 'err'}")

        r = await c.patch(f"/api/users/{reviewer_id}", json={"name": "Giovanni Updated"}, headers=AH)
        check("Admin can update user", r.status_code == 200, r.text[:120])

        print("\n=== 5. USER MANAGEMENT — NEGATIVE ===")
        r = await c.post("/api/users", json={"name": "Bad", "role": "superuser", "passcode": "444444"}, headers=AH)
        check("Rejects invalid role", r.status_code == 422, f"got {r.status_code}")

        r = await c.post("/api/users", json={"name": "", "role": "reviewer"}, headers=AH)
        check("Rejects empty name", r.status_code == 422, f"got {r.status_code}")

        r = await c.post("/api/users", json={"name": "X", "role": "reviewer", "passcode": "12"}, headers=AH)
        check("Rejects short passcode", r.status_code == 422, f"got {r.status_code}")

        r = await c.delete(f"/api/users/{admin_id}", headers=AH)
        check("Cannot delete self", r.status_code == 400, f"got {r.status_code}")

        r = await c.delete("/api/users/does-not-exist", headers=AH)
        check("Delete unknown user returns 404", r.status_code == 404, f"got {r.status_code}")

        # login as reviewer to test RBAC
        r = await c.post("/api/auth/login", json={"user_id": reviewer_id, "passcode": "222222"})
        rev_token = r.json().get("token") if r.status_code == 200 else None
        RH = {"Authorization": f"Bearer {rev_token}"}
        r = await c.post("/api/auth/login", json={"user_id": approver_id, "passcode": "333333"})
        app_token = r.json().get("token") if r.status_code == 200 else None
        PH = {"Authorization": f"Bearer {app_token}"}

        r = await c.get("/api/users", headers=RH)
        check("Reviewer CANNOT list users (RBAC)", r.status_code == 403, f"got {r.status_code}")

        r = await c.post("/api/users", json={"name": "Hack", "role": "admin"}, headers=RH)
        check("Reviewer CANNOT create users (RBAC)", r.status_code == 403, f"got {r.status_code}")

        print("\n=== 6. VENDOR CRUD — POSITIVE ===")
        r = await c.post("/api/vendors", json={"name": "PT Contoh Vendor", "country": "Singapura"}, headers=RH)
        check("Reviewer can create vendor", r.status_code == 200, r.text[:150])
        vid = r.json().get("id") if r.status_code == 200 else None
        check("New vendor starts in DRAFT", r.json().get("status") == "DRAFT" if r.status_code == 200 else False)
        check("New vendor has categories scaffold", bool(r.json().get("categories")) if r.status_code == 200 else False)

        r = await c.get(f"/api/vendors/{vid}", headers=RH)
        check("Can fetch vendor by id", r.status_code == 200, r.text[:120])

        r = await c.put(f"/api/vendors/{vid}", json={"name": "PT Contoh Vendor", "country": "Singapura", "reviewerNotes": "cek dokumen"}, headers=RH)
        check("Can update vendor", r.status_code == 200, r.text[:120])

        r = await c.get("/api/vendors", params={"q": "Contoh"}, headers=RH)
        check("Search vendor by name works", r.status_code == 200 and len(r.json()) >= 1, f"count={len(r.json()) if r.status_code==200 else 'err'}")

        r = await c.get("/api/vendors", params={"country": "Singapura"}, headers=RH)
        check("Filter vendor by country works", r.status_code == 200 and len(r.json()) >= 1, f"count={len(r.json()) if r.status_code==200 else 'err'}")

        r = await c.get("/api/vendors", params={"q": "ZZZNoMatch"}, headers=RH)
        check("Search with no match returns empty", r.status_code == 200 and len(r.json()) == 0, f"count={len(r.json()) if r.status_code==200 else 'err'}")

        print("\n=== 7. VENDOR CRUD — NEGATIVE ===")
        r = await c.get("/api/vendors/nonexistent-id", headers=RH)
        check("Fetch unknown vendor returns 404", r.status_code == 404, f"got {r.status_code}")

        r = await c.post("/api/vendors", json={"country": "Singapura"}, headers=RH)
        check("Create vendor without name rejected", r.status_code == 422, f"got {r.status_code}")

        r = await c.get("/api/vendors", headers={"Authorization": "Bearer bad"})
        check("List vendors rejects bad token", r.status_code in (401, 403), f"got {r.status_code}")

        print("\n=== 8. WORKFLOW — ALL 8 STATUSES ===")
        flow = [
            ("IN_REVIEW", RH, 200, "Reviewer: DRAFT → IN_REVIEW"),
            ("CLARIFICATION", RH, 200, "Reviewer: IN_REVIEW → CLARIFICATION"),
            ("IN_REVIEW", RH, 200, "Reviewer: CLARIFICATION → IN_REVIEW"),
            ("PENDING_APPROVAL", RH, 200, "Reviewer: IN_REVIEW → PENDING_APPROVAL"),
        ]
        for status, hdr, expect, label in flow:
            r = await c.post(f"/api/vendors/{vid}/status", json={"status": status, "note": "test"}, headers=hdr)
            check(label, r.status_code == expect, f"got {r.status_code}: {r.text[:100]}")

        r = await c.post(f"/api/vendors/{vid}/status", json={"status": "APPROVED"}, headers=RH)
        check("Reviewer CANNOT approve (RBAC)", r.status_code == 403, f"got {r.status_code}")

        r = await c.post(f"/api/vendors/{vid}/status", json={"status": "RETURNED"}, headers=RH)
        check("Reviewer CANNOT return (RBAC)", r.status_code == 403, f"got {r.status_code}")

        r = await c.post(f"/api/vendors/{vid}/status", json={"status": "MYSSC_REQUESTED"}, headers=RH)
        check("Reviewer CANNOT request MySSC (RBAC)", r.status_code == 403, f"got {r.status_code}")

        r = await c.post(f"/api/vendors/{vid}/status", json={"status": "COMPLETED"}, headers=RH)
        check("Reviewer CANNOT mark completed (RBAC)", r.status_code == 403, f"got {r.status_code}")

        r = await c.post(f"/api/vendors/{vid}/status", json={"status": "APPROVED", "note": "ok"}, headers=PH)
        check("Approver CAN approve", r.status_code == 200, f"got {r.status_code}: {r.text[:100]}")

        r = await c.post(f"/api/vendors/{vid}/status", json={"status": "MYSSC_REQUESTED"}, headers=PH)
        check("Approver CAN request MySSC", r.status_code == 200, f"got {r.status_code}: {r.text[:100]}")

        r = await c.post(f"/api/vendors/{vid}/status", json={"status": "COMPLETED"}, headers=PH)
        check("Approver CAN mark completed", r.status_code == 200, f"got {r.status_code}: {r.text[:100]}")

        r = await c.get(f"/api/vendors/{vid}", headers=RH)
        final_status = r.json().get("status") if r.status_code == 200 else None
        check("Final status is COMPLETED", final_status == "COMPLETED", f"got {final_status}")
        hist = r.json().get("history", []) if r.status_code == 200 else []
        check("Status history recorded", len(hist) >= 7, f"history entries={len(hist)}")

        print("\n=== 9. WORKFLOW — NEGATIVE ===")
        r = await c.post(f"/api/vendors/{vid}/status", json={"status": "NOT_A_STATUS"}, headers=PH)
        check("Rejects invalid status value", r.status_code == 422, f"got {r.status_code}")

        r = await c.post("/api/vendors/bad-id/status", json={"status": "IN_REVIEW"}, headers=RH)
        check("Status change on unknown vendor → 404", r.status_code == 404, f"got {r.status_code}")

        print("\n=== 10. REFERENCE DATA ===")
        r = await c.get("/api/reference/categories", headers=RH)
        cats = r.json() if r.status_code == 200 else []
        check("GET categories returns 18 items", r.status_code == 200 and len(cats) == 18, f"count={len(cats)}")

        r = await c.get("/api/reference/countries", headers=RH)
        countries = r.json() if r.status_code == 200 else {}
        check("GET countries returns 10 countries", r.status_code == 200 and len(countries) == 10, f"count={len(countries)}")

        r = await c.get("/api/reference/general-docs", headers=RH)
        gd = r.json() if r.status_code == 200 else {}
        check("GET general-docs returns 10 entries", r.status_code == 200 and len(gd) == 10, f"count={len(gd)}")

        r = await c.get("/api/reference/statuses", headers=RH)
        sts = r.json() if r.status_code == 200 else []
        check("GET statuses returns all 8", r.status_code == 200 and len(sts) == 8, f"got {sts}")

        r = await c.get("/api/reference/categories")
        check("Reference data requires auth", r.status_code in (401, 403), f"got {r.status_code}")

        print("\n=== 11. WORDING CONFIG ===")
        r = await c.put("/api/settings/wording", json={"values": {"login.title": "Selamat Datang"}}, headers=AH)
        check("Admin can save wording", r.status_code == 200, r.text[:150])

        r = await c.get("/api/settings/wording")
        check("Wording override persisted & public", r.status_code == 200 and r.json().get("login.title") == "Selamat Datang", r.text[:150])

        r = await c.put("/api/settings/wording", json={"values": {"x": "y"}}, headers=RH)
        check("Reviewer CANNOT change wording (RBAC)", r.status_code == 403, f"got {r.status_code}")

        r = await c.put("/api/settings/wording", json={"values": "not-an-object"}, headers=AH)
        check("Rejects malformed wording payload", r.status_code == 400, f"got {r.status_code}")

        r = await c.put("/api/settings/wording", json={"values": {"empty.key": "   "}}, headers=AH)
        check("Blank wording values stripped", r.status_code == 200 and "empty.key" not in r.json(), r.text[:120])

        print("\n=== 12. THEME SETTINGS ===")
        for th in ["steel", "forest", "burgundy", "slate", "copper", "editorial"]:
            r = await c.post("/api/settings/theme", json={"theme": th}, headers=AH)
            check(f"Theme '{th}' accepted", r.status_code == 200, f"got {r.status_code}")

        r = await c.post("/api/settings/theme", json={"theme": "neon-pink"}, headers=AH)
        check("Rejects unknown theme", r.status_code == 422, f"got {r.status_code}")

        print("\n=== 13. ANALYTICS ===")
        r = await c.get("/api/analytics/summary", headers=RH)
        check("GET analytics summary", r.status_code == 200, r.text[:150])
        if r.status_code == 200:
            s = r.json()
            check("Summary has total_vendors", "total_vendors" in s)
            check("Summary has status_counts", "status_counts" in s)
            check("Summary has country_counts", "country_counts" in s)

        r = await c.get("/api/analytics/insights", headers=RH)
        check("GET analytics insights (SLA)", r.status_code == 200, r.text[:200])
        if r.status_code == 200:
            ins = r.json()
            check("Insights has sla_by_status", "sla_by_status" in ins, str(list(ins.keys()))[:120])
            sla = ins.get("sla_by_status", [])
            check("SLA covers all 8 statuses", len(sla) == 8, f"got {len(sla)}")

        r = await c.get("/api/analytics/audit-log", headers=AH)
        check("Admin can read audit log", r.status_code == 200, r.text[:120])
        r = await c.get("/api/analytics/audit-log", headers=RH)
        check("Reviewer CANNOT read audit log (RBAC)", r.status_code == 403, f"got {r.status_code}")

        print("\n=== 14. CSV EXPORT ===")
        r = await c.get("/api/vendors-export/csv", headers=RH)
        check("CSV export works", r.status_code == 200, f"got {r.status_code}")
        check("CSV has content", len(r.content) > 0 if r.status_code == 200 else False)

        print("\n=== 15. IMPORT-SHAPED VENDOR (Excel payload) ===")
        import_payload = {
            "name": "PT Import Test",
            "country": "Singapura",
            "categories": {"taxId": {"complete": False, "note": "UEN 123", "sourceValue": "201512345K", "sourceRow": 5}},
            "company": {"address": "1 Marina Blvd", "email": "a@b.sg", "taxId": "201512345K",
                        "bod": [{"name": "Bethany", "position": "MD", "idnum": "S123"}]},
        }
        r = await c.post("/api/vendors", json=import_payload, headers=RH)
        check("Vendor created from Excel-shaped payload", r.status_code == 200, r.text[:200])
        if r.status_code == 200:
            v = r.json()
            check("Imported categories persisted", v.get("categories", {}).get("taxId", {}).get("note") == "UEN 123",
                  str(v.get("categories", {}).get("taxId"))[:120])
            check("Imported company profile persisted", v.get("company", {}).get("email") == "a@b.sg",
                  str(v.get("company"))[:120])
            check("Imported BOD list persisted", len(v.get("company", {}).get("bod", [])) == 1)

        print("\n=== 16. VENDOR DELETE ===")
        r = await c.post("/api/vendors", json={"name": "To Delete"}, headers=AH)
        del_id = r.json().get("id") if r.status_code == 200 else None
        r = await c.delete(f"/api/vendors/{del_id}", headers=AH)
        check("Admin can delete vendor", r.status_code == 200, f"got {r.status_code}: {r.text[:100]}")
        r = await c.get(f"/api/vendors/{del_id}", headers=AH)
        check("Deleted vendor is gone", r.status_code == 404, f"got {r.status_code}")

        print("\n=== 17. PASSCODE CHANGE ===")
        r = await c.post("/api/auth/change-passcode", json={"current_passcode": "222222", "new_passcode": "555555"}, headers=RH)
        check("User can change own passcode", r.status_code == 200, r.text[:150])
        r = await c.post("/api/auth/login", json={"user_id": reviewer_id, "passcode": "555555"})
        check("Login works with new passcode", r.status_code == 200, f"got {r.status_code}")
        r = await c.post("/api/auth/login", json={"user_id": reviewer_id, "passcode": "222222"})
        check("Old passcode no longer works", r.status_code in (400, 401), f"got {r.status_code}")
        r = await c.post("/api/auth/change-passcode", json={"current_passcode": "000000", "new_passcode": "666666"},
                         headers={"Authorization": f"Bearer {rev_token}"})
        check("Change passcode rejects wrong current", r.status_code in (400, 401, 403), f"got {r.status_code}")

    print("\n" + "=" * 70)
    print(f"RESULT:  {len(PASS)} passed,  {len(FAIL)} failed")
    if FAIL:
        print("\nFAILURES:")
        for name, detail in FAIL:
            print(f"  ❌ {name}\n     {detail}")
    print("=" * 70)
    return 1 if FAIL else 0

sys.exit(asyncio.run(main()))
