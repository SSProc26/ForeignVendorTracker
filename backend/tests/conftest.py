"""Shared pytest fixtures for backend tests (new passcode auth model)."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

DEFAULT_PASSCODE = "123456"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_id(api_client):
    """Fetch the admin user's id from the public /auth/members endpoint."""
    r = api_client.get(f"{BASE_URL}/api/auth/members")
    if r.status_code != 200:
        pytest.skip(f"/api/auth/members failed: {r.status_code} {r.text}")
    members = r.json()
    admin = next(
        (m for m in members if m.get("role") == "admin" and m.get("name") == "Administrator"),
        None,
    )
    if not admin:
        # fallback: any admin
        admin = next((m for m in members if m.get("role") == "admin"), None)
    if not admin:
        pytest.skip("No admin member found via /api/auth/members")
    return admin["id"]


@pytest.fixture(scope="session")
def admin_token(api_client, admin_id):
    r = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"user_id": admin_id, "passcode": DEFAULT_PASSCODE},
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_user(api_client, admin_headers):
    r = api_client.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
    return r.json() if r.status_code == 200 else None


def login_with_passcode(api_client, user_id: str, passcode: str = DEFAULT_PASSCODE):
    """Helper: login with new auth model, returns Authorization headers or None."""
    r = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"user_id": user_id, "passcode": passcode},
    )
    if r.status_code != 200:
        return None
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}
