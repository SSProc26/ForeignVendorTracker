"""Comprehensive backend API tests for Vendor Tracker (passcode auth model)."""
import io
import os
import uuid
import pytest
import requests

from conftest import login_with_passcode, DEFAULT_PASSCODE

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


# ------------------------ Health ------------------------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data.get("service") == "vendor-tracker"


# ------------------------ Auth (new passcode model) ------------------------
class TestAuthMembers:
    def test_members_public_no_auth(self, api_client):
        r = requests.get(f"{BASE_URL}/api/auth/members")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        # only id/name/role, no password_hash / email
        for m in data:
            assert set(m.keys()) <= {"id", "name", "role"}
            assert "password_hash" not in m
        # admin first
        assert data[0]["role"] == "admin"


class TestAuthLogin:
    def test_login_success(self, api_client, admin_id):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"user_id": admin_id, "passcode": DEFAULT_PASSCODE},
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("token"), str) and data["token"]
        assert data["user"]["role"] == "admin"
        assert "password_hash" not in data["user"]

    def test_login_wrong_passcode(self, api_client, admin_id):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"user_id": admin_id, "passcode": "999999"},
        )
        assert r.status_code == 401

    def test_login_unknown_user_id(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"user_id": "does-not-exist", "passcode": DEFAULT_PASSCODE},
        )
        assert r.status_code == 401

    def test_login_invalid_passcode_format(self, api_client, admin_id):
        # non-6-digit rejected by pydantic 422
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"user_id": admin_id, "passcode": "abcdef"},
        )
        assert r.status_code == 422

    def test_login_legacy_email_password_rejected(self, api_client):
        # legacy payload shape should now be 422 (missing user_id/passcode)
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@vendortracker.io", "password": "Admin@12345"},
        )
        assert r.status_code == 422

    def test_me_with_token(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_without_token(self, api_client):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_logout(self, api_client, admin_headers):
        r = api_client.post(f"{BASE_URL}/api/auth/logout", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["ok"] is True


class TestChangePasscode:
    def test_change_passcode_flow(self, api_client, admin_headers):
        # Create a user, login with default, change passcode, verify new works and old fails
        create = api_client.post(
            f"{BASE_URL}/api/users",
            json={"name": f"TEST changepc {uuid.uuid4().hex[:6]}", "role": "reviewer"},
            headers=admin_headers,
        )
        assert create.status_code == 200, create.text
        uid = create.json()["id"]

        headers = login_with_passcode(api_client, uid, DEFAULT_PASSCODE)
        assert headers is not None, "login with default passcode failed"

        # wrong current -> 400
        r_bad = api_client.post(
            f"{BASE_URL}/api/auth/change-passcode",
            json={"current_passcode": "000000", "new_passcode": "654321"},
            headers=headers,
        )
        assert r_bad.status_code == 400

        # correct current -> 200
        r_ok = api_client.post(
            f"{BASE_URL}/api/auth/change-passcode",
            json={"current_passcode": DEFAULT_PASSCODE, "new_passcode": "654321"},
            headers=headers,
        )
        assert r_ok.status_code == 200
        assert r_ok.json()["ok"] is True

        # old passcode no longer works
        assert login_with_passcode(api_client, uid, DEFAULT_PASSCODE) is None
        # new passcode works
        assert login_with_passcode(api_client, uid, "654321") is not None

        # cleanup
        api_client.delete(f"{BASE_URL}/api/users/{uid}", headers=admin_headers)

    def test_change_passcode_requires_auth(self, api_client):
        r = requests.post(
            f"{BASE_URL}/api/auth/change-passcode",
            json={"current_passcode": DEFAULT_PASSCODE, "new_passcode": "111111"},
        )
        assert r.status_code == 401

    def test_change_passcode_invalid_format(self, api_client, admin_headers):
        r = api_client.post(
            f"{BASE_URL}/api/auth/change-passcode",
            json={"current_passcode": "abcdef", "new_passcode": "111111"},
            headers=admin_headers,
        )
        assert r.status_code == 422


# ------------------------ User CRUD (new create shape) ------------------------
@pytest.fixture(scope="module")
def reviewer_user(api_client, admin_headers):
    r = api_client.post(
        f"{BASE_URL}/api/users",
        json={"name": f"TEST Reviewer {uuid.uuid4().hex[:6]}", "role": "reviewer"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def approver_user(api_client, admin_headers):
    r = api_client.post(
        f"{BASE_URL}/api/users",
        json={"name": f"TEST Approver {uuid.uuid4().hex[:6]}", "role": "approver"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def reviewer_headers(api_client, reviewer_user):
    h = login_with_passcode(api_client, reviewer_user["id"], DEFAULT_PASSCODE)
    assert h is not None
    return h


@pytest.fixture(scope="module")
def approver_headers(api_client, approver_user):
    h = login_with_passcode(api_client, approver_user["id"], DEFAULT_PASSCODE)
    assert h is not None
    return h


class TestUsers:
    def test_create_only_needs_name_and_role(self, reviewer_user, approver_user):
        assert reviewer_user["role"] == "reviewer"
        assert approver_user["role"] == "approver"
        assert "password_hash" not in reviewer_user
        assert reviewer_user["active"] is True
        # email optional -> None when not provided
        assert reviewer_user.get("email") in (None, "")

    def test_new_user_can_login_with_default_passcode(self, api_client, reviewer_user):
        h = login_with_passcode(api_client, reviewer_user["id"], DEFAULT_PASSCODE)
        assert h is not None

    def test_list_users_as_admin_hides_password_hash(self, api_client, admin_headers, reviewer_user):
        r = api_client.get(f"{BASE_URL}/api/users", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()
        assert any(u["id"] == reviewer_user["id"] for u in users)
        assert all("password_hash" not in u for u in users)

    def test_list_users_as_reviewer_forbidden(self, api_client, reviewer_headers):
        r = api_client.get(f"{BASE_URL}/api/users", headers=reviewer_headers)
        assert r.status_code == 403

    def test_create_user_as_reviewer_forbidden(self, api_client, reviewer_headers):
        r = api_client.post(
            f"{BASE_URL}/api/users",
            json={"name": "x", "role": "reviewer"},
            headers=reviewer_headers,
        )
        assert r.status_code == 403

    def test_patch_user_role_and_active(self, api_client, admin_headers, reviewer_user):
        r = api_client.patch(
            f"{BASE_URL}/api/users/{reviewer_user['id']}",
            json={"role": "approver", "active": False},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["role"] == "approver"
        assert r.json()["active"] is False
        # inactive user -> login forbidden 403
        r_login = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"user_id": reviewer_user["id"], "passcode": DEFAULT_PASSCODE},
        )
        assert r_login.status_code == 403
        # revert
        api_client.patch(
            f"{BASE_URL}/api/users/{reviewer_user['id']}",
            json={"role": "reviewer", "active": True},
            headers=admin_headers,
        )

    def test_reset_password_empty_body_resets_to_default(self, api_client, admin_headers):
        # create user, change passcode, then admin resets and login with default works
        cr = api_client.post(
            f"{BASE_URL}/api/users",
            json={"name": f"TEST resetpc {uuid.uuid4().hex[:6]}", "role": "reviewer"},
            headers=admin_headers,
        )
        uid = cr.json()["id"]
        # change to something else
        h = login_with_passcode(api_client, uid, DEFAULT_PASSCODE)
        api_client.post(
            f"{BASE_URL}/api/auth/change-passcode",
            json={"current_passcode": DEFAULT_PASSCODE, "new_passcode": "424242"},
            headers=h,
        )
        assert login_with_passcode(api_client, uid, DEFAULT_PASSCODE) is None
        # admin reset with empty body
        r = api_client.post(
            f"{BASE_URL}/api/users/{uid}/reset-password",
            json={},
            headers=admin_headers,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["passcode"] == DEFAULT_PASSCODE
        # login with default works again
        assert login_with_passcode(api_client, uid, DEFAULT_PASSCODE) is not None
        # cleanup
        api_client.delete(f"{BASE_URL}/api/users/{uid}", headers=admin_headers)

    def test_reset_password_no_body_ok(self, api_client, admin_headers, reviewer_user):
        # body optional entirely
        r = requests.post(
            f"{BASE_URL}/api/users/{reviewer_user['id']}/reset-password",
            headers={"Authorization": admin_headers["Authorization"]},
        )
        assert r.status_code == 200
        assert r.json()["passcode"] == DEFAULT_PASSCODE

    def test_delete_user(self, api_client, admin_headers):
        cr = api_client.post(
            f"{BASE_URL}/api/users",
            json={"name": f"TEST del {uuid.uuid4().hex[:6]}", "role": "reviewer"},
            headers=admin_headers,
        )
        assert cr.status_code == 200
        uid = cr.json()["id"]
        d = api_client.delete(f"{BASE_URL}/api/users/{uid}", headers=admin_headers)
        assert d.status_code == 200

    def test_admin_cant_deactivate_self(self, api_client, admin_headers, admin_user):
        r = api_client.patch(
            f"{BASE_URL}/api/users/{admin_user['id']}",
            json={"active": False},
            headers=admin_headers,
        )
        assert r.status_code == 400


# ------------------------ Reference Data ------------------------
class TestReference:
    def test_categories(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/reference/categories", headers=admin_headers)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list) and len(cats) > 0
        assert "key" in cats[0]

    def test_countries(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/reference/countries", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), (dict, list))

    def test_statuses(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/reference/statuses", headers=admin_headers)
        assert r.status_code == 200
        st = r.json()
        assert "DRAFT" in st
        assert "APPROVED" in st

    def test_reference_requires_auth(self, api_client):
        r = requests.get(f"{BASE_URL}/api/reference/categories")
        assert r.status_code == 401


# ------------------------ Vendors ------------------------
@pytest.fixture(scope="module")
def vendor(api_client, admin_headers):
    r = api_client.post(
        f"{BASE_URL}/api/vendors",
        json={"name": f"TEST Vendor {uuid.uuid4().hex[:6]}", "country": "Indonesia"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return r.json()


class TestVendors:
    def test_create_default_shape(self, vendor):
        assert vendor["status"] == "DRAFT"
        assert isinstance(vendor["categories"], dict) and len(vendor["categories"]) > 0
        assert "company" in vendor and "masterData" in vendor
        assert isinstance(vendor["history"], list) and len(vendor["history"]) >= 1

    def test_get_vendor(self, api_client, admin_headers, vendor):
        r = api_client.get(f"{BASE_URL}/api/vendors/{vendor['id']}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["id"] == vendor["id"]

    def test_list_with_filters(self, api_client, admin_headers, vendor):
        r = api_client.get(
            f"{BASE_URL}/api/vendors",
            params={"q": vendor["name"][:10], "status": "DRAFT", "country": "Indonesia"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        ids = [v["id"] for v in r.json()]
        assert vendor["id"] in ids

    def test_update_nested_fields(self, api_client, admin_headers, vendor):
        payload = {
            "company": {**vendor["company"], "address": "Jl. Sudirman 1", "taxId": "01.234.567.8-999.000"},
            "categories": {**vendor["categories"], "taxId": {"complete": True, "note": "OK", "sourceValue": "01.234"}},
        }
        r = api_client.put(f"{BASE_URL}/api/vendors/{vendor['id']}", json=payload, headers=admin_headers)
        assert r.status_code == 200
        got = api_client.get(f"{BASE_URL}/api/vendors/{vendor['id']}", headers=admin_headers).json()
        assert got["company"]["address"] == "Jl. Sudirman 1"
        assert got["categories"]["taxId"]["complete"] is True

    def test_status_change_flow(self, api_client, admin_headers, vendor):
        r = api_client.post(
            f"{BASE_URL}/api/vendors/{vendor['id']}/status",
            json={"status": "IN_REVIEW", "note": "submitted"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "IN_REVIEW"
        assert any(h["type"] == "status" for h in r.json()["history"])
        api_client.post(
            f"{BASE_URL}/api/vendors/{vendor['id']}/status",
            json={"status": "PENDING_APPROVAL"},
            headers=admin_headers,
        )

    def test_approver_role_enforcement(self, api_client, reviewer_headers, admin_headers, vendor):
        r = api_client.post(
            f"{BASE_URL}/api/vendors/{vendor['id']}/status",
            json={"status": "APPROVED"},
            headers=reviewer_headers,
        )
        assert r.status_code == 403
        r2 = api_client.post(
            f"{BASE_URL}/api/vendors/{vendor['id']}/status",
            json={"status": "APPROVED", "note": "ok"},
            headers=admin_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "APPROVED"

    def test_approver_can_return(self, api_client, approver_headers, admin_headers, vendor):
        api_client.post(
            f"{BASE_URL}/api/vendors/{vendor['id']}/status",
            json={"status": "PENDING_APPROVAL"},
            headers=admin_headers,
        )
        r = api_client.post(
            f"{BASE_URL}/api/vendors/{vendor['id']}/status",
            json={"status": "RETURNED", "note": "fix docs"},
            headers=approver_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "RETURNED"

    def test_add_history_manual(self, api_client, admin_headers, vendor):
        r = api_client.post(
            f"{BASE_URL}/api/vendors/{vendor['id']}/history",
            json={"text": "Manual note"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert any("Manual note" in h["text"] for h in r.json()["history"])

    def test_delete_vendor_admin_only(self, api_client, admin_headers, reviewer_headers):
        r = api_client.post(
            f"{BASE_URL}/api/vendors",
            json={"name": "TEST DeleteMe", "country": "USA"},
            headers=admin_headers,
        )
        vid = r.json()["id"]
        rd = api_client.delete(f"{BASE_URL}/api/vendors/{vid}", headers=reviewer_headers)
        assert rd.status_code == 403
        d = api_client.delete(f"{BASE_URL}/api/vendors/{vid}", headers=admin_headers)
        assert d.status_code == 200


# ------------------------ Documents ------------------------
class TestDocuments:
    def test_upload_download_delete(self, api_client, admin_headers, admin_token, vendor):
        headers = {"Authorization": f"Bearer {admin_token}"}
        files = {"file": ("hello.txt", io.BytesIO(b"hello vendor tracker"), "text/plain")}
        r = requests.post(
            f"{BASE_URL}/api/vendors/{vendor['id']}/documents",
            params={"category": "taxId"},
            files=files,
            headers=headers,
            timeout=60,
        )
        if r.status_code == 500 and ("S3_BUCKET" in r.text or "AWS_ACCESS_KEY_ID" in r.text):
            pytest.skip("Storage not configured")
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["filename"] == "hello.txt"

        rl = api_client.get(f"{BASE_URL}/api/vendors/{vendor['id']}/documents", headers=admin_headers)
        assert rl.status_code == 200
        assert any(d["id"] == doc["id"] for d in rl.json())

        rd = requests.get(
            f"{BASE_URL}/api/documents/{doc['id']}/download",
            params={"auth": admin_token},
            timeout=60,
        )
        assert rd.status_code == 200
        assert rd.content == b"hello vendor tracker"

        rdel = api_client.delete(f"{BASE_URL}/api/documents/{doc['id']}", headers=admin_headers)
        assert rdel.status_code == 200

        rl2 = api_client.get(f"{BASE_URL}/api/vendors/{vendor['id']}/documents", headers=admin_headers)
        assert not any(d["id"] == doc["id"] for d in rl2.json())


# ------------------------ Analytics (legacy) ------------------------
class TestAnalytics:
    def test_summary(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/analytics/summary", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for key in ("total_vendors", "total_users", "total_documents", "status_counts", "country_counts"):
            assert key in data
        for s in ("DRAFT", "IN_REVIEW", "PENDING_APPROVAL", "APPROVED", "RETURNED"):
            assert s in data["status_counts"]
        counts = [c["count"] for c in data["country_counts"]]
        assert counts == sorted(counts, reverse=True)

    def test_audit_log_admin_only(self, api_client, admin_headers, reviewer_headers):
        r = api_client.get(f"{BASE_URL}/api/analytics/audit-log", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        r2 = api_client.get(f"{BASE_URL}/api/analytics/audit-log", headers=reviewer_headers)
        assert r2.status_code == 403


# ------------------------ Export ------------------------
class TestExport:
    def test_csv(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/vendors-export/csv", headers=admin_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        body = r.text
        first_line = body.splitlines()[0]
        assert "ID" in first_line and "Name" in first_line and "Country" in first_line
        assert len(body.splitlines()) >= 2


# ------------------------ Settings ------------------------
class TestSettings:
    def test_valid_theme(self, api_client, admin_headers):
        for t in ("steel", "forest", "burgundy", "slate", "copper"):
            r = api_client.post(
                f"{BASE_URL}/api/settings/theme",
                json={"theme": t},
                headers=admin_headers,
            )
            assert r.status_code == 200
            assert r.json()["theme"] == t

    def test_invalid_theme(self, api_client, admin_headers):
        r = api_client.post(
            f"{BASE_URL}/api/settings/theme",
            json={"theme": "neon"},
            headers=admin_headers,
        )
        assert r.status_code == 422


# ------------------------ PWA ------------------------
class TestPWA:
    def test_manifest(self):
        r = requests.get(f"{BASE_URL}/manifest.json", timeout=30)
        assert r.status_code == 200
        j = r.json()
        assert "icons" in j

    def test_service_worker(self):
        r = requests.get(f"{BASE_URL}/sw.js", timeout=30)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "javascript" in ct.lower() or "application/js" in ct.lower()
