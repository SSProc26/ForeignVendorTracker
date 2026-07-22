"""Vendor Registration Tracker — FastAPI backend."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import csv
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import FastAPI, APIRouter, Header, HTTPException, UploadFile, File, Query, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict

from auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_from_db,
    require_role,
)
from storage_utils import init_storage, put_object, get_object
from reference_data import CATEGORIES, COUNTRY_DB, WORKFLOW_STATUSES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("vendor-tracker")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
APP_NAME = os.environ.get("APP_NAME", "vendor-tracker")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Vendor Tracker API")
api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def strip_mongo(doc: dict | None) -> dict | None:
    if not doc:
        return doc
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


async def _me(authorization: str | None) -> dict:
    return await get_current_user_from_db(db, authorization)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class LoginIn(BaseModel):
    user_id: str
    passcode: str = Field(pattern="^[0-9]{6}$")


class UserCreateIn(BaseModel):
    name: str = Field(min_length=1)
    role: str = Field(pattern="^(admin|approver|reviewer)$")
    email: EmailStr | None = None
    passcode: str | None = Field(default=None, pattern="^[0-9]{6}$")


class UserUpdateIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str | None = None
    role: str | None = Field(default=None, pattern="^(admin|approver|reviewer)$")
    active: bool | None = None


class PasswordResetIn(BaseModel):
    new_passcode: str | None = Field(default=None, pattern="^[0-9]{6}$")


class ChangePasscodeIn(BaseModel):
    current_passcode: str = Field(pattern="^[0-9]{6}$")
    new_passcode: str = Field(pattern="^[0-9]{6}$")


class VendorIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str
    country: str = ""


class StatusChangeIn(BaseModel):
    status: str = Field(pattern="^(DRAFT|IN_REVIEW|CLARIFICATION|PENDING_APPROVAL|APPROVED|RETURNED|MYSSC_REQUESTED|COMPLETED)$")
    note: str = ""


class HistoryIn(BaseModel):
    text: str
    date: str | None = None


class ThemeIn(BaseModel):
    theme: str = Field(pattern="^(steel|forest|burgundy|slate|copper)$")


DEFAULT_PASSCODE = "123456"


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup() -> None:
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("id", unique=True)
    await db.vendors.create_index("id", unique=True)
    await db.vendors.create_index("status")
    await db.vendors.create_index("country")
    await db.audit_log.create_index("ts")
    await db.transitions.create_index("vendor_id")
    await db.transitions.create_index("ts")

    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@vendortracker.io").lower()
    admin_passcode = os.environ.get("ADMIN_PASSCODE", DEFAULT_PASSCODE)
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Administrator",
            "role": "admin",
            "active": True,
            "password_hash": hash_password(admin_passcode),
            "theme": "steel",
            "created_at": now_iso(),
        })
        logger.info(f"Seeded admin user (passcode={admin_passcode})")
    elif not verify_password(admin_passcode, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_passcode)}},
        )
        logger.info("Updated admin passcode from env")

    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Storage init failed (uploads disabled): {e}")


@app.on_event("shutdown")
async def shutdown() -> None:
    client.close()


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------
async def log_audit(user: dict, action: str, target_type: str, target_id: str, meta: dict | None = None) -> None:
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()),
        "ts": now_iso(),
        "user_id": user["id"],
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "meta": meta or {},
    })


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.get("/auth/members")
async def auth_members():
    """Public list of active members for login dropdown. Only exposes id/name/role."""
    users = await db.users.find({"active": True}, {"_id": 0, "id": 1, "name": 1, "role": 1}).to_list(500)
    users.sort(key=lambda u: (u["role"] != "admin", u["name"].lower()))
    return users


@api.post("/auth/login")
async def login(payload: LoginIn):
    user = await db.users.find_one({"id": payload.user_id})
    if not user or not verify_password(payload.passcode, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Passcode salah")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    token = create_access_token(user["id"], user.get("email", ""), user["role"])
    await log_audit(user, "login", "user", user["id"])
    return {"token": token, "user": strip_mongo(user)}


@api.get("/auth/me")
async def me(authorization: str | None = Header(default=None)):
    return await _me(authorization)


@api.post("/auth/logout")
async def logout(authorization: str | None = Header(default=None)):
    user = await _me(authorization)
    await log_audit(user, "logout", "user", user["id"])
    return {"ok": True}


@api.post("/auth/change-passcode")
async def change_passcode(payload: ChangePasscodeIn, authorization: str | None = Header(default=None)):
    user = await _me(authorization)
    full = await db.users.find_one({"id": user["id"]})
    if not full or not verify_password(payload.current_passcode, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Passcode lama salah")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(payload.new_passcode)}},
    )
    await log_audit(user, "change_passcode", "user", user["id"])
    return {"ok": True}


# ---------------------------------------------------------------------------
# User management (admin)
# ---------------------------------------------------------------------------
@api.get("/users")
async def list_users(authorization: str | None = Header(default=None)):
    user = await _me(authorization)
    require_role(user, "admin")
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users


@api.post("/users")
async def create_user(payload: UserCreateIn, authorization: str | None = Header(default=None)):
    user = await _me(authorization)
    require_role(user, "admin")
    email = None
    if payload.email:
        email = payload.email.lower()
        if await db.users.find_one({"email": email}):
            raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    passcode = payload.passcode or DEFAULT_PASSCODE
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "role": payload.role,
        "active": True,
        "password_hash": hash_password(passcode),
        "theme": "steel",
        "created_at": now_iso(),
    }
    if email:
        doc["email"] = email
    await db.users.insert_one(doc)
    await log_audit(user, "create", "user", doc["id"], {"name": payload.name, "role": payload.role})
    return strip_mongo(doc)


@api.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdateIn, authorization: str | None = Header(default=None)):
    admin = await _me(authorization)
    require_role(admin, "admin")
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No changes")
    if user_id == admin["id"] and "active" in updates and not updates["active"]:
        raise HTTPException(status_code=400, detail="Tidak bisa menonaktifkan diri sendiri")
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await log_audit(admin, "update", "user", user_id, updates)
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return updated


@api.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, payload: PasswordResetIn | None = None, authorization: str | None = Header(default=None)):
    admin = await _me(authorization)
    require_role(admin, "admin")
    new_pc = (payload.new_passcode if payload else None) or DEFAULT_PASSCODE
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(new_pc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await log_audit(admin, "reset_password", "user", user_id, {"reset_to_default": new_pc == DEFAULT_PASSCODE})
    return {"ok": True, "passcode": new_pc}


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, authorization: str | None = Header(default=None)):
    admin = await _me(authorization)
    require_role(admin, "admin")
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus diri sendiri")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await log_audit(admin, "delete", "user", user_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------
@api.get("/reference/categories")
async def get_categories(authorization: str | None = Header(default=None)):
    await _me(authorization)
    return CATEGORIES


@api.get("/reference/countries")
async def get_countries(authorization: str | None = Header(default=None)):
    await _me(authorization)
    return COUNTRY_DB


@api.get("/reference/statuses")
async def get_statuses(authorization: str | None = Header(default=None)):
    await _me(authorization)
    return WORKFLOW_STATUSES


# ---------------------------------------------------------------------------
# Vendor CRUD
# ---------------------------------------------------------------------------
def _empty_vendor(name: str, country: str, user: dict) -> dict:
    categories = {c["key"]: {"complete": False, "note": "", "sourceValue": ""} for c in CATEGORIES}
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "country": country,
        "status": "DRAFT",
        "handler": user["name"],
        "handler_id": user["id"],
        "myssc": "",
        "mysscNote": "",
        "path": "",
        "reviewerNotes": "",
        "approverNotes": "",
        "categories": categories,
        "company": {
            "address": "", "city": "", "province": "", "email": "", "taxId": "",
            "note": "", "totalEquity": "",
            "shareholders": [], "bod": [], "boc": [], "subfields": [],
            "bank": {"account": "", "bankName": "", "holder": "", "note": ""},
        },
        "masterData": {
            "vendorId": "", "provinsi": "", "defaultEmailSap": "", "noteGeneral": "",
            "noteBank": "", "companyCode": "", "purchOrg": "", "extendKeterangan": "",
            "kualifikasi": "", "csms": "", "klasifikasiBidang": "",
            "direktur": "", "npwpDirektur": "", "ktpDirektur": "",
            "komisaris": "", "npwpKomisaris": "", "ktpKomisaris": "",
            "suratList": [], "blockUnblockRequest": "", "blockUnblockKeterangan": "",
            "mergedDocLink": "",
        },
        "documents": [],
        "history": [{
            "id": str(uuid.uuid4()),
            "ts": now_iso(),
            "type": "status",
            "text": f"Record dibuat oleh {user['name']}",
        }],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "created_by": user["id"],
    }


@api.get("/vendors")
async def list_vendors(
    authorization: str | None = Header(default=None),
    q: str | None = Query(default=None),
    status: str | None = Query(default=None),
    country: str | None = Query(default=None),
):
    await _me(authorization)
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    if country:
        query["country"] = country
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    vendors = await db.vendors.find(query, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    return vendors


@api.post("/vendors")
async def create_vendor(payload: VendorIn, authorization: str | None = Header(default=None)):
    user = await _me(authorization)
    doc = _empty_vendor(payload.name, payload.country, user)
    # merge any extra fields passed in
    extras = payload.model_dump(exclude={"name", "country"}, exclude_none=True)
    for k, v in extras.items():
        if k in doc and isinstance(doc[k], dict) and isinstance(v, dict):
            doc[k].update(v)
        else:
            doc[k] = v
    await db.vendors.insert_one(doc)
    await log_audit(user, "create", "vendor", doc["id"], {"name": doc["name"]})
    doc.pop("_id", None)
    return doc


@api.get("/vendors/{vendor_id}")
async def get_vendor(vendor_id: str, authorization: str | None = Header(default=None)):
    await _me(authorization)
    v = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return v


@api.put("/vendors/{vendor_id}")
async def update_vendor(vendor_id: str, payload: dict, authorization: str | None = Header(default=None)):
    user = await _me(authorization)
    existing = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Vendor not found")
    # Prevent overwriting immutable fields
    for k in ("id", "created_at", "created_by", "history"):
        payload.pop(k, None)
    payload["updated_at"] = now_iso()
    await db.vendors.update_one({"id": vendor_id}, {"$set": payload})
    await log_audit(user, "update", "vendor", vendor_id, {"fields": list(payload.keys())})
    return await db.vendors.find_one({"id": vendor_id}, {"_id": 0})


@api.post("/vendors/{vendor_id}/status")
async def change_vendor_status(vendor_id: str, payload: StatusChangeIn, authorization: str | None = Header(default=None)):
    user = await _me(authorization)
    v = await db.vendors.find_one({"id": vendor_id})
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    # Simple RBAC
    new_status = payload.status
    role = user["role"]
    if new_status == "APPROVED" and role not in ("admin", "approver"):
        raise HTTPException(status_code=403, detail="Hanya approver/admin yang dapat approve")
    if new_status == "RETURNED" and role not in ("admin", "approver"):
        raise HTTPException(status_code=403, detail="Hanya approver/admin yang dapat return")
    if new_status == "MYSSC_REQUESTED" and role not in ("admin", "approver"):
        raise HTTPException(status_code=403, detail="Hanya approver/admin yang dapat request MySSC")
    if new_status == "COMPLETED" and role not in ("admin", "approver"):
        raise HTTPException(status_code=403, detail="Hanya approver/admin yang dapat menandai completed")
    ts = now_iso()
    history_entry = {
        "id": str(uuid.uuid4()),
        "ts": ts,
        "type": "status",
        "from": v["status"],
        "to": new_status,
        "by_id": user["id"],
        "by_name": user["name"],
        "note": payload.note,
        "text": f"Status: {v['status']} → {new_status}" + (f" — {payload.note}" if payload.note else "") + f" (oleh {user['name']})",
    }
    await db.vendors.update_one(
        {"id": vendor_id},
        {"$set": {"status": new_status, "updated_at": ts, "status_since": ts},
         "$push": {"history": history_entry}},
    )
    await db.transitions.insert_one({
        "id": str(uuid.uuid4()),
        "vendor_id": vendor_id,
        "vendor_name": v["name"],
        "country": v.get("country", ""),
        "from": v["status"],
        "to": new_status,
        "by_id": user["id"],
        "by_name": user["name"],
        "ts": ts,
        "note": payload.note,
    })
    await log_audit(user, "status_change", "vendor", vendor_id, {"from": v["status"], "to": new_status})
    return await db.vendors.find_one({"id": vendor_id}, {"_id": 0})


@api.post("/vendors/{vendor_id}/history")
async def add_vendor_history(vendor_id: str, payload: HistoryIn, authorization: str | None = Header(default=None)):
    user = await _me(authorization)
    v = await db.vendors.find_one({"id": vendor_id})
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    entry = {
        "id": str(uuid.uuid4()),
        "ts": payload.date or now_iso(),
        "type": "manual",
        "text": f"{payload.text} — {user['name']}",
    }
    await db.vendors.update_one(
        {"id": vendor_id},
        {"$push": {"history": entry}, "$set": {"updated_at": now_iso()}},
    )
    return await db.vendors.find_one({"id": vendor_id}, {"_id": 0})


@api.delete("/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str, authorization: str | None = Header(default=None)):
    user = await _me(authorization)
    require_role(user, "admin")
    result = await db.vendors.delete_one({"id": vendor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    await log_audit(user, "delete", "vendor", vendor_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------
@api.post("/vendors/{vendor_id}/documents")
async def upload_document(
    vendor_id: str,
    category: str = Query(...),
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    user = await _me(authorization)
    v = await db.vendors.find_one({"id": vendor_id})
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    data = await file.read()
    ext = (file.filename or "bin").split(".")[-1].lower()
    path = f"{APP_NAME}/vendors/{vendor_id}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, file.content_type or "application/octet-stream")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Upload gagal: {e}")
    doc = {
        "id": str(uuid.uuid4()),
        "vendor_id": vendor_id,
        "category": category,
        "filename": file.filename,
        "content_type": file.content_type or "application/octet-stream",
        "size": result.get("size", len(data)),
        "storage_path": result["path"],
        "uploaded_by": user["id"],
        "uploaded_by_name": user["name"],
        "uploaded_at": now_iso(),
        "is_deleted": False,
    }
    await db.documents.insert_one(doc)
    await db.vendors.update_one(
        {"id": vendor_id},
        {"$push": {"history": {
            "id": str(uuid.uuid4()), "ts": now_iso(), "type": "document",
            "text": f"Upload dokumen [{category}] {file.filename} oleh {user['name']}"
        }}, "$set": {"updated_at": now_iso()}},
    )
    doc.pop("_id", None)
    return doc


@api.get("/vendors/{vendor_id}/documents")
async def list_documents(vendor_id: str, authorization: str | None = Header(default=None)):
    await _me(authorization)
    docs = await db.documents.find(
        {"vendor_id": vendor_id, "is_deleted": False}, {"_id": 0}
    ).sort("uploaded_at", -1).to_list(500)
    return docs


@api.get("/documents/{doc_id}/download")
async def download_document(doc_id: str, auth: str | None = Query(default=None), authorization: str | None = Header(default=None)):
    # img/pdf viewers can't send headers; also accept ?auth=<token>
    header = authorization or (f"Bearer {auth}" if auth else None)
    await get_current_user_from_db(db, header)
    doc = await db.documents.find_one({"id": doc_id, "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    data, ct = get_object(doc["storage_path"])
    return Response(
        content=data,
        media_type=doc.get("content_type") or ct,
        headers={"Content-Disposition": f'inline; filename="{doc["filename"]}"'},
    )


@api.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, authorization: str | None = Header(default=None)):
    user = await _me(authorization)
    doc = await db.documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.documents.update_one({"id": doc_id}, {"$set": {"is_deleted": True}})
    await db.vendors.update_one(
        {"id": doc["vendor_id"]},
        {"$push": {"history": {
            "id": str(uuid.uuid4()), "ts": now_iso(), "type": "document",
            "text": f"Hapus dokumen {doc['filename']} oleh {user['name']}"
        }}},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
@api.get("/analytics/summary")
async def analytics_summary(authorization: str | None = Header(default=None)):
    await _me(authorization)
    pipeline_status = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    pipeline_country = [{"$group": {"_id": "$country", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    status_counts = {s: 0 for s in WORKFLOW_STATUSES}
    async for row in db.vendors.aggregate(pipeline_status):
        if row["_id"]:
            status_counts[row["_id"]] = row["count"]
    country_counts = []
    async for row in db.vendors.aggregate(pipeline_country):
        if row["_id"]:
            country_counts.append({"country": row["_id"], "count": row["count"]})
    total = await db.vendors.count_documents({})
    users_total = await db.users.count_documents({})
    docs_total = await db.documents.count_documents({"is_deleted": False})
    return {
        "total_vendors": total,
        "total_users": users_total,
        "total_documents": docs_total,
        "status_counts": status_counts,
        "country_counts": country_counts,
    }


@api.get("/analytics/insights")
async def analytics_insights(authorization: str | None = Header(default=None)):
    """SLA per status, SLA per handler, aging, return rate, weekly trend, doc completeness, per-country risk."""
    from datetime import datetime as _dt
    from collections import defaultdict
    from statistics import mean, median

    await _me(authorization)

    def parse(ts):
        try:
            return _dt.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return None

    now = datetime.now(timezone.utc)

    vendors = await db.vendors.find({}, {"_id": 0}).to_list(2000)
    transitions = await db.transitions.find({}, {"_id": 0}).sort("ts", 1).to_list(20000)

    # Group transitions per vendor (sorted by ts asc)
    per_vendor = defaultdict(list)
    for t in transitions:
        per_vendor[t["vendor_id"]].append(t)

    # SLA per status: dwell time between entering (prev to == status) and leaving (next transition ts).
    status_dwell = {s: [] for s in WORKFLOW_STATUSES}
    handler_totals = defaultdict(lambda: {"count": 0, "durations": [], "name": ""})

    for v in vendors:
        created = parse(v.get("created_at")) or now
        ts_list = per_vendor.get(v["id"], [])
        # DRAFT was implicit start at created_at
        prev_ts = created
        prev_status = "DRAFT"
        approved_at = None
        for t in ts_list:
            t_ts = parse(t["ts"])
            if not t_ts:
                continue
            days = (t_ts - prev_ts).total_seconds() / 86400.0
            if prev_status in status_dwell and days >= 0:
                status_dwell[prev_status].append(days)
            prev_ts = t_ts
            prev_status = t["to"]
            if t["to"] == "APPROVED" and not approved_at:
                approved_at = t_ts
        if approved_at:
            # cumulative time to APPROVED, credited to last handler
            handler = ts_list[-1]
            hid = handler.get("by_id") or "unknown"
            handler_totals[hid]["count"] += 1
            handler_totals[hid]["durations"].append((approved_at - created).total_seconds() / 86400.0)
            handler_totals[hid]["name"] = handler.get("by_name") or "Unknown"

    sla_by_status = []
    for s in WORKFLOW_STATUSES:
        arr = status_dwell[s]
        sla_by_status.append({
            "status": s,
            "count": len(arr),
            "avg_days": round(mean(arr), 2) if arr else 0,
            "median_days": round(median(arr), 2) if arr else 0,
            "max_days": round(max(arr), 2) if arr else 0,
        })

    sla_by_handler = []
    for hid, data in handler_totals.items():
        arr = data["durations"]
        sla_by_handler.append({
            "user_id": hid,
            "name": data["name"],
            "approved_count": data["count"],
            "avg_days_to_approved": round(mean(arr), 2) if arr else 0,
            "median_days_to_approved": round(median(arr), 2) if arr else 0,
            "fastest_days": round(min(arr), 2) if arr else 0,
            "slowest_days": round(max(arr), 2) if arr else 0,
        })
    sla_by_handler.sort(key=lambda x: -x["approved_count"])

    # Aging report: vendors NOT in APPROVED, days in current status
    aging = []
    for v in vendors:
        if v.get("status") == "APPROVED":
            continue
        since = parse(v.get("status_since") or v.get("updated_at") or v.get("created_at")) or now
        days = (now - since).total_seconds() / 86400.0
        aging.append({
            "vendor_id": v["id"],
            "name": v["name"],
            "country": v.get("country", ""),
            "status": v["status"],
            "handler": v.get("handler", ""),
            "days_in_status": round(days, 2),
        })
    aging.sort(key=lambda x: -x["days_in_status"])

    # Return rate
    approved_count = sum(1 for v in vendors if v.get("status") == "APPROVED")
    returned_count = sum(1 for t in transitions if t["to"] == "RETURNED")
    total_decisions = approved_count + returned_count
    return_rate_pct = round(100.0 * returned_count / total_decisions, 1) if total_decisions else 0

    # Weekly trend last 8 weeks (created & approved)
    from datetime import timedelta as _td
    weeks = []
    start_of_week = (now - _td(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    for i in range(7, -1, -1):
        w_start = start_of_week - _td(weeks=i)
        w_end = w_start + _td(weeks=1)
        created_in = sum(1 for v in vendors if (p := parse(v.get("created_at"))) and w_start <= p < w_end)
        approved_in = sum(1 for t in transitions if t["to"] == "APPROVED" and (p := parse(t["ts"])) and w_start <= p < w_end)
        weeks.append({
            "week": w_start.strftime("%b %d"),
            "created": created_in,
            "approved": approved_in,
        })

    # Category completeness across all vendors
    total_v = len(vendors) or 1
    completeness = []
    for cat in CATEGORIES:
        k = cat["key"]
        complete = sum(1 for v in vendors if v.get("categories", {}).get(k, {}).get("complete"))
        completeness.append({
            "key": k,
            "label": cat["label"],
            "group": cat["group"],
            "complete": complete,
            "total": total_v,
            "rate": round(100.0 * complete / total_v, 1),
        })
    completeness.sort(key=lambda x: x["rate"])

    # Country risk: vendor count, avg days to approved, return count
    country_stats = defaultdict(lambda: {"count": 0, "approved": 0, "returned": 0, "durations": []})
    for v in vendors:
        c = v.get("country") or "—"
        country_stats[c]["count"] += 1
        if v.get("status") == "APPROVED":
            country_stats[c]["approved"] += 1
            # duration to approved
            ts_list = per_vendor.get(v["id"], [])
            approved_ts = next((parse(t["ts"]) for t in ts_list if t["to"] == "APPROVED"), None)
            created = parse(v.get("created_at"))
            if approved_ts and created:
                country_stats[c]["durations"].append((approved_ts - created).total_seconds() / 86400.0)
    for t in transitions:
        if t["to"] == "RETURNED":
            country_stats[t.get("country") or "—"]["returned"] += 1
    country_risk = []
    for country, data in country_stats.items():
        country_risk.append({
            "country": country,
            "count": data["count"],
            "approved": data["approved"],
            "returned": data["returned"],
            "avg_days_to_approved": round(mean(data["durations"]), 2) if data["durations"] else 0,
        })
    country_risk.sort(key=lambda x: -x["count"])

    # Time-of-day / day-of-week heatmap (from transitions) - 7 days x 24 hours
    heatmap = [[0] * 24 for _ in range(7)]
    for t in transitions:
        p = parse(t["ts"])
        if p:
            heatmap[p.weekday()][p.hour] += 1
    time_heatmap = []
    for d in range(7):
        for h in range(24):
            time_heatmap.append({"day": d, "hour": h, "count": heatmap[d][h]})

    # Rework loop counter: RETURNED transitions per vendor
    rework_by_vendor = defaultdict(int)
    for t in transitions:
        if t["to"] == "RETURNED":
            rework_by_vendor[t["vendor_id"]] += 1
    rework_dist = defaultdict(int)
    approved_reworks = []
    for v in vendors:
        n = rework_by_vendor.get(v["id"], 0)
        bucket = "3+" if n >= 3 else str(n)
        rework_dist[bucket] += 1
        if v.get("status") == "APPROVED":
            approved_reworks.append(n)
    rework_top = sorted(
        [{"vendor_id": vid, "name": next((v["name"] for v in vendors if v["id"] == vid), "?"),
          "country": next((v.get("country", "") for v in vendors if v["id"] == vid), ""),
          "status": next((v.get("status", "") for v in vendors if v["id"] == vid), ""),
          "loops": n}
         for vid, n in rework_by_vendor.items() if n > 0],
        key=lambda x: -x["loops"],
    )[:5]
    rework = {
        "distribution": [{"loops": k, "count": rework_dist[k]} for k in ["0", "1", "2", "3+"]],
        "avg_per_approved": round(mean(approved_reworks), 2) if approved_reworks else 0,
        "max_loops": max(approved_reworks) if approved_reworks else 0,
        "top_vendors": rework_top,
    }

    # Predictive ETA per non-approved vendor
    # baseline = avg days to approved for same country (fallback global)
    global_avg = 0
    all_durs = []
    for v in vendors:
        if v.get("status") != "APPROVED":
            continue
        ts_list = per_vendor.get(v["id"], [])
        approved_ts = next((parse(t["ts"]) for t in ts_list if t["to"] == "APPROVED"), None)
        created = parse(v.get("created_at"))
        if approved_ts and created:
            all_durs.append((approved_ts - created).total_seconds() / 86400.0)
    global_avg = max(mean(all_durs), 1.0) if all_durs else 7.0  # min 1 day baseline; default 7d if no data

    country_avg = {}
    for c, data in country_stats.items():
        if data["durations"]:
            country_avg[c] = mean(data["durations"])

    eta_rows = []
    for v in vendors:
        if v.get("status") == "APPROVED":
            continue
        cats = v.get("categories", {}) or {}
        total_cat = len(cats) or 1
        complete_cat = sum(1 for c in cats.values() if c.get("complete"))
        rate = complete_cat / total_cat
        c = v.get("country") or ""
        n_country = len([1 for vv in vendors if vv.get("country") == c and vv.get("status") == "APPROVED"])
        baseline = max(country_avg.get(c, global_avg), 1.0)  # floor 1 day
        confidence = "high" if n_country >= 5 else ("medium" if len(all_durs) >= 5 else "low")
        multiplier = 1.0 + (1.0 - rate) * 1.0  # 0%→2x, 100%→1x
        # Extra penalty for currently in RETURNED state (needs to re-approve)
        if v.get("status") == "RETURNED":
            multiplier *= 1.3
        created = parse(v.get("created_at")) or now
        days_spent = (now - created).total_seconds() / 86400.0
        predicted_total = baseline * multiplier
        remaining_days = predicted_total - days_spent
        overdue = remaining_days < 0
        eta_days = max(0, remaining_days)
        eta_date = (now + timedelta(days=eta_days)).date().isoformat()
        eta_rows.append({
            "vendor_id": v["id"],
            "name": v["name"],
            "country": c,
            "status": v["status"],
            "completeness_pct": round(100 * rate, 1),
            "days_spent": round(days_spent, 2),
            "predicted_total_days": round(predicted_total, 2),
            "eta_days": round(eta_days, 2),
            "eta_date": eta_date,
            "overdue": overdue,
            "confidence": confidence,
        })
    eta_rows.sort(key=lambda x: (not x["overdue"], x["eta_days"]))

    return {
        "sla_by_status": sla_by_status,
        "sla_by_handler": sla_by_handler,
        "aging": aging,
        "return_rate": {
            "approved": approved_count,
            "returned": returned_count,
            "rate_pct": return_rate_pct,
        },
        "weekly_trend": weeks,
        "category_completeness": completeness,
        "country_risk": country_risk,
        "time_heatmap": time_heatmap,
        "rework": rework,
        "eta": eta_rows,
        "generated_at": now.isoformat(),
    }


@api.get("/analytics/audit-log")
async def audit_log(authorization: str | None = Header(default=None), limit: int = 100):
    user = await _me(authorization)
    require_role(user, "admin")
    rows = await db.audit_log.find({}, {"_id": 0}).sort("ts", -1).to_list(limit)
    return rows


@api.get("/analytics/insights-pdf")
async def insights_pdf(auth: str | None = Query(default=None), authorization: str | None = Header(default=None)):
    """Export insights as PDF report. Accepts ?auth=<token> for direct-download links."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    )
    header = authorization or (f"Bearer {auth}" if auth else None)
    user = await get_current_user_from_db(db, header)

    insights = await analytics_insights(authorization=header)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm, title="Vendor Tracker — Insights Report",
    )
    styles = getSampleStyleSheet()
    body = styles["BodyText"]
    body.fontSize = 9
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=colors.HexColor("#0f172a"), fontSize=18, spaceAfter=6)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=colors.HexColor("#0f172a"), fontSize=12, spaceBefore=10, spaceAfter=4)
    caption = ParagraphStyle("caption", parent=body, textColor=colors.HexColor("#64748b"), fontSize=8)

    elems = []
    elems.append(Paragraph("Vendor Tracker — Insights &amp; SLA Report", h1))
    elems.append(Paragraph(f"Generated {now_str} · by {user.get('name', '')} · <b>Vendor Tracker</b>", caption))
    elems.append(Spacer(1, 8))

    rr = insights["return_rate"]
    kpi_data = [
        ["Total decisions", str(rr["approved"] + rr["returned"])],
        ["Approved", str(rr["approved"])],
        ["Returned", str(rr["returned"])],
        ["Return rate", f"{rr['rate_pct']}%"],
        ["Avg rework loops (approved vendors)", str(insights["rework"]["avg_per_approved"])],
    ]
    t = Table(kpi_data, colWidths=[80 * mm, 40 * mm])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#e2e8f0")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elems.append(t)

    def _table(title, header, rows, widths):
        elems.append(Paragraph(title, h2))
        if not rows:
            elems.append(Paragraph("<i>(no data)</i>", body))
            return
        data = [header] + rows
        tt = Table(data, colWidths=widths, repeatRows=1)
        tt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("PADDING", (0, 0), (-1, -1), 4),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#e2e8f0")),
        ]))
        elems.append(tt)

    _table(
        "SLA per Status (days)",
        ["Status", "Count", "Avg", "Median", "Max"],
        [[s["status"], s["count"], s["avg_days"], s["median_days"], s["max_days"]] for s in insights["sla_by_status"]],
        [45 * mm, 20 * mm, 20 * mm, 25 * mm, 25 * mm],
    )

    _table(
        "Handler Performance",
        ["Handler", "Approved", "Avg d", "Median d", "Fastest d", "Slowest d"],
        [[h["name"], h["approved_count"], h["avg_days_to_approved"], h["median_days_to_approved"],
          h["fastest_days"], h["slowest_days"]] for h in insights["sla_by_handler"][:15]],
        [50 * mm, 22 * mm, 20 * mm, 22 * mm, 22 * mm, 22 * mm],
    )

    _table(
        "Aging Report (top 10, non-approved)",
        ["Vendor", "Country", "Status", "Handler", "Days"],
        [[a["name"], a["country"], a["status"], a["handler"], a["days_in_status"]] for a in insights["aging"][:10]],
        [55 * mm, 25 * mm, 30 * mm, 30 * mm, 20 * mm],
    )

    _table(
        "Country Risk",
        ["Country", "Total", "Approved", "Returned", "Avg → Approved (d)"],
        [[c["country"], c["count"], c["approved"], c["returned"], c["avg_days_to_approved"]]
         for c in insights["country_risk"][:15]],
        [50 * mm, 20 * mm, 25 * mm, 25 * mm, 40 * mm],
    )

    elems.append(PageBreak())

    _table(
        "Predictive ETA (top 15)",
        ["Vendor", "Country", "Status", "Cmpl %", "Spent d", "ETA d", "ETA date", "Conf"],
        [[e["name"], e["country"], e["status"], e["completeness_pct"], e["days_spent"],
          e["eta_days"], e["eta_date"], e["confidence"]] for e in insights["eta"][:15]],
        [45 * mm, 20 * mm, 25 * mm, 15 * mm, 18 * mm, 15 * mm, 22 * mm, 15 * mm],
    )

    _table(
        "Rework Distribution",
        ["Loops", "Vendor count"],
        [[r["loops"], r["count"]] for r in insights["rework"]["distribution"]],
        [40 * mm, 40 * mm],
    )

    _table(
        "Rework — Top Vendors",
        ["Vendor", "Country", "Status", "Loops"],
        [[r["name"], r["country"], r["status"], r["loops"]] for r in insights["rework"]["top_vendors"]],
        [60 * mm, 30 * mm, 40 * mm, 20 * mm],
    )

    _table(
        "Category Completeness (lowest 15)",
        ["Category", "Group", "Complete", "Total", "Rate %"],
        [[c["label"][:60], c["group"], c["complete"], c["total"], c["rate"]]
         for c in insights["category_completeness"][:15]],
        [70 * mm, 40 * mm, 20 * mm, 20 * mm, 20 * mm],
    )

    doc.build(elems)
    buf.seek(0)
    return Response(
        content=buf.read(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="insights-{datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")}.pdf"'},
    )


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
@api.get("/vendors-export/csv")
async def export_csv(authorization: str | None = Header(default=None)):
    await _me(authorization)
    vendors = await db.vendors.find({}, {"_id": 0}).to_list(1000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["ID", "Name", "Country", "Status", "Handler", "MySSC", "Path", "Updated At"])
    for v in vendors:
        writer.writerow([
            v.get("id", ""), v.get("name", ""), v.get("country", ""),
            v.get("status", ""), v.get("handler", ""), v.get("myssc", ""),
            v.get("path", ""), v.get("updated_at", ""),
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="vendors.csv"'},
    )


# ---------------------------------------------------------------------------
# User settings
# ---------------------------------------------------------------------------
@api.post("/settings/theme")
async def set_theme(payload: ThemeIn, authorization: str | None = Header(default=None)):
    user = await _me(authorization)
    await db.users.update_one({"id": user["id"]}, {"$set": {"theme": payload.theme}})
    return {"theme": payload.theme}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"ok": True, "service": "vendor-tracker"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
