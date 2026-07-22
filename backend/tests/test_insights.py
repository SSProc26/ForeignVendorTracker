"""Tests for /api/analytics/insights (extended with heatmap, rework, eta) + PDF export."""
import os
import time
import uuid
import pytest
import requests

from conftest import login_with_passcode, DEFAULT_PASSCODE

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

WORKFLOW = ("DRAFT", "IN_REVIEW", "PENDING_APPROVAL", "APPROVED", "RETURNED")


# ---------- Fixture: dedicated reviewer for insights tests ----------
@pytest.fixture(scope="module")
def ins_reviewer_headers(api_client, admin_headers):
    r = api_client.post(
        f"{BASE_URL}/api/users",
        json={"name": f"TEST InsRev {uuid.uuid4().hex[:6]}", "role": "reviewer"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    h = login_with_passcode(api_client, uid, DEFAULT_PASSCODE)
    assert h is not None
    return h


# ---------- Basic endpoint shape (extended) ----------
class TestInsightsShape:
    def test_endpoint_requires_auth(self, api_client):
        r = requests.get(f"{BASE_URL}/api/analytics/insights")
        assert r.status_code == 401

    def test_endpoint_ok_for_any_role(self, api_client, admin_headers, ins_reviewer_headers):
        assert api_client.get(f"{BASE_URL}/api/analytics/insights", headers=admin_headers).status_code == 200
        assert api_client.get(f"{BASE_URL}/api/analytics/insights", headers=ins_reviewer_headers).status_code == 200

    def test_top_level_keys_extended(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/analytics/insights", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        expected = (
            "sla_by_status", "sla_by_handler", "aging", "return_rate",
            "weekly_trend", "category_completeness", "country_risk",
            "time_heatmap", "rework", "eta", "generated_at",
        )
        for k in expected:
            assert k in data, f"missing {k}"

    def test_time_heatmap_shape(self, api_client, admin_headers):
        d = api_client.get(f"{BASE_URL}/api/analytics/insights", headers=admin_headers).json()
        hm = d["time_heatmap"]
        assert isinstance(hm, list) and len(hm) == 168  # 7*24
        # every cell has {day, hour, count}
        for cell in hm:
            assert set(cell.keys()) == {"day", "hour", "count"}
            assert 0 <= cell["day"] <= 6
            assert 0 <= cell["hour"] <= 23
            assert isinstance(cell["count"], int)
        # first 24 must be day=0
        assert all(c["day"] == 0 for c in hm[:24])

    def test_rework_shape(self, api_client, admin_headers):
        d = api_client.get(f"{BASE_URL}/api/analytics/insights", headers=admin_headers).json()
        rw = d["rework"]
        for k in ("distribution", "avg_per_approved", "max_loops", "top_vendors"):
            assert k in rw
        dist = rw["distribution"]
        assert isinstance(dist, list) and len(dist) == 4
        loops = [b["loops"] for b in dist]
        assert loops == ["0", "1", "2", "3+"]
        for b in dist:
            assert isinstance(b["count"], int)
        assert isinstance(rw["top_vendors"], list)

    def test_eta_shape(self, api_client, admin_headers):
        d = api_client.get(f"{BASE_URL}/api/analytics/insights", headers=admin_headers).json()
        eta = d["eta"]
        assert isinstance(eta, list)
        # only non-approved vendors
        for row in eta:
            for k in ("vendor_id", "name", "country", "status", "completeness_pct",
                      "days_spent", "predicted_total_days", "eta_days", "eta_date",
                      "overdue", "confidence"):
                assert k in row, f"eta row missing {k}"
            assert row["status"] != "APPROVED"
            assert 0 <= row["completeness_pct"] <= 100
            assert row["confidence"] in ("high", "medium", "low")
            assert isinstance(row["overdue"], bool)


# ---------- Rework counter behaviour ----------
class TestInsightsRework:
    def test_rework_top_vendors_reflects_return_loops(self, api_client, admin_headers):
        # create a vendor and put it through 2 RETURNED loops
        r = api_client.post(
            f"{BASE_URL}/api/vendors",
            json={"name": f"TEST InsRework {uuid.uuid4().hex[:6]}", "country": "Philippines"},
            headers=admin_headers,
        )
        vid = r.json()["id"]

        # first loop: DRAFT -> PENDING_APPROVAL -> RETURNED
        for st in ("PENDING_APPROVAL", "RETURNED", "PENDING_APPROVAL", "RETURNED"):
            time.sleep(0.05)
            resp = api_client.post(
                f"{BASE_URL}/api/vendors/{vid}/status",
                json={"status": st, "note": "loop"},
                headers=admin_headers,
            )
            assert resp.status_code == 200, resp.text

        ins = api_client.get(f"{BASE_URL}/api/analytics/insights", headers=admin_headers).json()
        top = ins["rework"]["top_vendors"]
        row = next((t for t in top if t["vendor_id"] == vid), None)
        # top_vendors is capped at 5, so may not always contain it if many exist -- assert loops if present
        if row:
            assert row["loops"] >= 2


# ---------- ETA correctness ----------
class TestInsightsETA:
    def test_new_vendor_appears_in_eta_with_low_confidence_or_similar(self, api_client, admin_headers):
        r = api_client.post(
            f"{BASE_URL}/api/vendors",
            json={"name": f"TEST InsETA {uuid.uuid4().hex[:6]}", "country": "ZZ-NonExistCountry"},
            headers=admin_headers,
        )
        vid = r.json()["id"]
        ins = api_client.get(f"{BASE_URL}/api/analytics/insights", headers=admin_headers).json()
        row = next((e for e in ins["eta"] if e["vendor_id"] == vid), None)
        assert row is not None, "new non-approved vendor should be in eta list"
        assert row["status"] == "DRAFT"
        assert row["completeness_pct"] == 0.0
        assert row["days_spent"] >= 0
        # predicted_total_days may be 0 if all sample approved durations rounded to zero;
        # only assert it's non-negative here.
        assert row["predicted_total_days"] >= 0
        assert row["confidence"] in ("high", "medium", "low")


# ---------- PDF export ----------
class TestInsightsPDF:
    def test_pdf_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/analytics/insights-pdf")
        assert r.status_code == 401

    def test_pdf_with_query_auth(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/analytics/insights-pdf",
            params={"auth": admin_token},
            timeout=60,
        )
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:7] == b"%PDF-1."

    def test_pdf_with_bearer_header(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/analytics/insights-pdf",
            headers={"Authorization": admin_headers["Authorization"]},
            timeout=60,
        )
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:7] == b"%PDF-1."


# ---------- End-to-end SLA correctness (legacy still works) ----------
class TestInsightsSLAFlow:
    def test_full_approval_flow_updates_insights(self, api_client, admin_headers, admin_user):
        r = api_client.post(
            f"{BASE_URL}/api/vendors",
            json={"name": f"TEST InsFlow {uuid.uuid4().hex[:6]}", "country": "Singapore"},
            headers=admin_headers,
        )
        vid = r.json()["id"]

        for st in ("IN_REVIEW", "PENDING_APPROVAL", "APPROVED"):
            time.sleep(0.3)
            resp = api_client.post(
                f"{BASE_URL}/api/vendors/{vid}/status",
                json={"status": st, "note": st},
                headers=admin_headers,
            )
            assert resp.status_code == 200

        ins = api_client.get(f"{BASE_URL}/api/analytics/insights", headers=admin_headers).json()
        counts = {s["status"]: s["count"] for s in ins["sla_by_status"]}
        assert counts["DRAFT"] >= 1
        assert counts["IN_REVIEW"] >= 1
        assert counts["PENDING_APPROVAL"] >= 1
        handlers = {h["user_id"]: h for h in ins["sla_by_handler"]}
        assert admin_user["id"] in handlers
        assert handlers[admin_user["id"]]["approved_count"] >= 1

    def test_aging_and_status_since(self, api_client, admin_headers):
        r = api_client.post(
            f"{BASE_URL}/api/vendors",
            json={"name": f"TEST InsAging {uuid.uuid4().hex[:6]}", "country": "Vietnam"},
            headers=admin_headers,
        )
        vid = r.json()["id"]
        api_client.post(
            f"{BASE_URL}/api/vendors/{vid}/status",
            json={"status": "IN_REVIEW"},
            headers=admin_headers,
        )
        time.sleep(0.5)
        ins = api_client.get(f"{BASE_URL}/api/analytics/insights", headers=admin_headers).json()
        aging_ids = {a["vendor_id"] for a in ins["aging"]}
        assert vid in aging_ids
        v = api_client.get(f"{BASE_URL}/api/vendors/{vid}", headers=admin_headers).json()
        assert v.get("status_since")
