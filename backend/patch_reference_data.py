"""
patch_reference_data.py
-----------------------
Jalankan SEKALI untuk memperbaiki dua bug flag apostille di reference_data.py
dan menambahkan auto-sync via apostille_data.py.

Cara pakai (dari root repo):
    python backend/patch_reference_data.py

Script ini idempotent — aman dijalankan ulang, hasilnya sama.
"""

import ast
import pathlib
import shutil
import sys

TARGET = pathlib.Path(__file__).parent / "reference_data.py"

if not TARGET.exists():
    sys.exit(f"[ERROR] File tidak ditemukan: {TARGET}")

src = TARGET.read_text(encoding="utf-8")

# ---- Terapkan perubahan ----
patched = src

# 1. India: False → True (anggota HCCH sejak 14-VII-2005, EIF bersama Indonesia)
OLD_INDIA  = '"India": {"tag": "IN", "apostille": False,'
NEW_INDIA  = '"India": {"tag": "IN", "apostille": True,'   # diperbaiki: anggota HCCH A** EIF 2005-07-14
if OLD_INDIA in patched:
    patched = patched.replace(OLD_INDIA, NEW_INDIA, 1)
    print("[FIX] India: apostille False → True")
elif NEW_INDIA in patched:
    print("[SKIP] India sudah True — tidak perlu diubah")
else:
    print("[WARN] Baris India tidak ditemukan — cek manual!")

# 2. Malaysia: True → False (BUKAN anggota Konvensi Apostille — wajib legalisir KBRI KL)
OLD_MY = '"Malaysia": {"tag": "MY", "apostille": True,'
NEW_MY = '"Malaysia": {"tag": "MY", "apostille": False,'   # diperbaiki: bukan anggota HCCH
if OLD_MY in patched:
    patched = patched.replace(OLD_MY, NEW_MY, 1)
    print("[FIX] Malaysia: apostille True → False")
elif NEW_MY in patched:
    print("[SKIP] Malaysia sudah False — tidak perlu diubah")
else:
    print("[WARN] Baris Malaysia tidak ditemukan — cek manual!")

# 3. Tambah auto-sync di akhir (jika belum ada)
AUTOSYNC_MARKER = "apply_apostille_status"
AUTOSYNC_BLOCK = """

# ---------------------------------------------------------------------------
# Auto-sync flag apostille/authentication dari apostille_data.py (HCCH)
# Baris ini OVERRIDE semua flag "apostille" manual di atas — jangan dihapus.
# Sumber: HCCH Convention #12 Status Table (hcch.net)
# ---------------------------------------------------------------------------
try:
    from apostille_data import apply_apostille_status as _aas  # noqa: E402
    _aas(COUNTRY_DB)
except ImportError:
    pass  # fallback aman bila apostille_data.py belum terpasang di lingkungan ini
"""

if AUTOSYNC_MARKER not in patched:
    patched = patched.rstrip() + AUTOSYNC_BLOCK
    print("[ADD] Auto-sync block ditambahkan di akhir file")
else:
    print("[SKIP] Auto-sync block sudah ada")

# ---- Validasi syntax sebelum tulis ----
try:
    ast.parse(patched)
except SyntaxError as e:
    sys.exit(f"[ERROR] Syntax error setelah patch: {e}")

# ---- Backup + tulis ----
backup = TARGET.with_suffix(".py.bak")
shutil.copy2(TARGET, backup)
TARGET.write_text(patched, encoding="utf-8")

print(f"\n✅ Patch berhasil diterapkan ke {TARGET}")
print(f"   Backup tersimpan di {backup}")
print("\nVerifikasi cepat:")
print("  python -c \"from reference_data import COUNTRY_DB; "
      "print({k: v['apostille'] for k, v in COUNTRY_DB.items()})\"")
print("  Harapan: Malaysia=False, India=True, sisanya=True")
