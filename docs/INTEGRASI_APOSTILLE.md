# Integrasi kriteria Apostille / Legalisir

Perubahan dirancang **aditif** — file lama tidak perlu ditulis ulang, cukup tambah
beberapa baris. Total ada 4 titik sentuh (2 backend, 2 frontend), dan hanya
titik #1 yang wajib.

---

## 1. `backend/reference_data.py` — WAJIB (3 baris)

Tambahkan di **paling bawah file**, setelah `WORKFLOW_STATUSES`:

```python
# --- Sinkronisasi status Apostille/Legalisir dengan status table HCCH ---
from apostille_data import apply_apostille_status  # noqa: E402

apply_apostille_status(COUNTRY_DB)
```

Efeknya untuk setiap negara di `COUNTRY_DB`:

- field `apostille` di-overwrite dengan status resmi (jadi flag manual tidak bisa
  lagi menyimpang — India otomatis jadi `True`, Malaysia jadi `False`);
- ditambahkan field baru `authentication`, isinya:

```json
{
  "code": "MY",
  "country": "Malaysia",
  "is_party": false,
  "in_force": false,
  "eif": null,
  "method": "LEGALISIR",
  "label": "Wajib Legalisir",
  "requires_legalization": true,
  "steps": ["Notarisasi dokumen di negara asal (notary public).", "..."],
  "objection_flag": false,
  "note": "Tidak terdaftar sebagai Contracting Party ..."
}
```

Endpoint `GET /api/reference/countries` yang sudah ada langsung ikut mengirim
field baru ini — **tanpa perubahan di `server.py`**. Frontend lama tetap jalan
karena `apostille` masih boolean seperti semula.

> Kalau import relatif bermasalah (misal `reference_data` di-import sebagai bagian
> package), ganti barisnya jadi `from .apostille_data import apply_apostille_status`.

---

## 2. `backend/server.py` — opsional (endpoint daftar negara)

Berguna kalau mau menampilkan halaman referensi lengkap 130 negara di UI.

Di blok import:

```python
from apostille_data import apostille_reference, apostille_status
```

Di section `# Reference data`, sejajar dengan `get_countries`:

```python
@api.get("/reference/apostille")
async def get_apostille_reference(authorization: str | None = Header(default=None)):
    await _me(authorization)
    return apostille_reference()


@api.get("/reference/apostille/{country}")
async def get_apostille_for_country(country: str, authorization: str | None = Header(default=None)):
    await _me(authorization)
    return apostille_status(country)
```

Endpoint kedua menerima nama bebas ("Malaysia", "malaysia", "MY", "Inggris / UK")
sehingga bisa dipakai untuk negara vendor yang belum ada di `COUNTRY_DB`.

---

## 3. `frontend/src/pages/Directory.jsx` — opsional (badge di UI)

Objek `info` yang sudah ada sekarang membawa `info.authentication`. Tempelkan
badge di dekat judul negara:

```jsx
{info?.authentication && (
  <span
    className={
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
      (info.authentication.requires_legalization
        ? "bg-amber-500/10 text-amber-600 border border-amber-500/30"
        : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30")
    }
    title={info.authentication.note}
  >
    <ShieldCheck className="w-3.5 h-3.5" />
    {info.authentication.label}
  </span>
)}
```

`ShieldCheck` sudah ter-import di file itu. Untuk menampilkan langkahnya:

```jsx
<ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-1">
  {info.authentication.steps.map((s, i) => <li key={i}>{s}</li>)}
</ol>
```

---

## 4. `frontend/src/lib/wording.js` — opsional

Tambahkan di dalam `WORDING_DEFS` supaya labelnya bisa diedit dari menu Settings:

```js
"directory.apostille":      { default: "Apostille",       group: "Panduan Negara", label: "Badge negara anggota Konvensi Den Haag" },
"directory.legalization":   { default: "Wajib Legalisir", group: "Panduan Negara", label: "Badge negara non-anggota" },
"directory.authTitle":      { default: "Otentikasi Dokumen", group: "Panduan Negara", label: "Judul blok apostille/legalisir" },
```

---

## Verifikasi setelah merge

```bash
# 1. modul berdiri sendiri
python backend/apostille_data.py

# harapan:
#   Singapura -> Apostille
#   Malaysia  -> Wajib Legalisir
#   India     -> Apostille
#   Vietnam   -> Wajib Legalisir (Apostille berlaku 2026-09-11)

# 2. sinkronisasi COUNTRY_DB
python -c "import sys; sys.path.insert(0,'backend'); \
from reference_data import COUNTRY_DB; \
print({k: v['apostille'] for k, v in COUNTRY_DB.items()})"

# harapan: Malaysia False, India True, sisanya True
```

Tambahan test yang bisa dimasukkan ke `backend/tests/test_backend.py`:

```python
def test_apostille_flags_synced(self, api_client, admin_headers):
    r = api_client.get(f"{BASE_URL}/api/reference/countries", headers=admin_headers)
    db = r.json()
    assert db["Malaysia"]["apostille"] is False
    assert db["India"]["apostille"] is True
    assert db["Malaysia"]["authentication"]["method"] == "LEGALISIR"
    assert db["Singapura"]["authentication"]["method"] == "APOSTILLE"
```
