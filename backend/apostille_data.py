"""
Referensi legalisasi dokumen asing: Apostille (Konvensi Den Haag 1961) vs Legalisir konsuler.

Sumber otoritatif : HCCH Convention #12 — Status Table
                    https://www.hcch.net/en/instruments/conventions/status-table/?cid=41
Snapshot data     : status table "Last update: 30-VI-2026", 130 Contracting Parties.
Tanggal snapshot  : 2026-07-23

ATURAN DASAR (dipakai di Vendor Tracker)
----------------------------------------
Negara asal vendor TERDAFTAR di Konvensi Apostille  -> cukup APOSTILLE
Negara asal vendor TIDAK terdaftar                  -> WAJIB LEGALISIR konsuler
                                                       (Notaris -> Kemenlu/otoritas setempat
                                                        -> KBRI/KJRI negara tsb)

Indonesia sendiri sudah menjadi Contracting Party sejak 4 Juni 2022
(Perpres No. 2 Tahun 2021; Competent Authority = Kementerian Hukum / AHU).
Aksesi Indonesia bertipe "A" pada status table = TIDAK ada negara yang mengajukan
keberatan, sehingga Konvensi berlaku antara Indonesia dan seluruh Contracting Party
yang Konvensinya sudah entry into force.

DUA JEBAKAN YANG SERING TERLEWAT
--------------------------------
1. "Contracting Party" != "sudah berlaku". Beberapa negara sudah menyerahkan
   instrumen aksesi tetapi Entry Into Force (EIF) baru di masa depan. Selama
   belum EIF, dokumennya MASIH WAJIB LEGALISIR. Per 23 Juli 2026 kasusnya:
       - Viet Nam  : EIF 11 September 2026
       - Thailand  : EIF 28 Februari 2027
2. Objection bilateral. Negara bertanda `objection=True` aksesinya pernah
   dikeberatani minimal satu negara lain, sehingga Konvensi tidak berlaku
   antara pasangan negara tersebut. Untuk Vendor Tracker negara tujuan selalu
   Indonesia dan Indonesia tidak mengajukan keberatan, jadi ini normalnya aman —
   tetap dicantumkan sebagai penanda agar reviewer bisa verifikasi bila perlu.

CARA PAKAI
----------
    from apostille_data import (
        apostille_status, requires_legalization,
        apply_apostille_status, APOSTILLE_SOURCE,
    )

    apostille_status("Malaysia")
    # {'method': 'LEGALISIR', 'label': 'Wajib Legalisir', 'is_party': False, ...}

    apostille_status("Singapura")
    # {'method': 'APOSTILLE', 'label': 'Apostille', 'is_party': True, ...}
"""

from __future__ import annotations

from datetime import date

# ---------------------------------------------------------------------------
# Metadata sumber
# ---------------------------------------------------------------------------
APOSTILLE_SOURCE = {
    "convention": "HCCH Convention of 5 October 1961 (Apostille Convention, #12)",
    "status_table_url": "https://www.hcch.net/en/instruments/conventions/status-table/?cid=41",
    "status_table_last_update": "2026-06-30",
    "contracting_parties": 130,
    "snapshot_date": "2026-07-23",
    "destination_country": "Indonesia",
    "destination_eif": "2022-06-04",
    "destination_competent_authority": "Kementerian Hukum RI (Ditjen AHU) — apostille.ahu.go.id",
    "note": (
        "Daftar ini snapshot. Sebelum menolak/menerima dokumen vendor, cek ulang status "
        "table HCCH karena negara bisa aksesi kapan saja."
    ),
}

# ---------------------------------------------------------------------------
# Daftar Contracting Party (130) + wilayah ekstensi yang relevan (HK, MO)
#   eif       : Entry Into Force (YYYY-MM-DD). None = belum ditetapkan.
#   objection : True bila aksesinya bertanda A** (ada keberatan dari negara lain)
#   name_id   : nama Indonesia bila lazim dipakai internal
# ---------------------------------------------------------------------------
HAGUE_PARTIES: dict[str, dict] = {
    "AL": {"en": "Albania", "id": "Albania", "eif": "2004-05-09", "objection": False},
    "DZ": {"en": "Algeria", "id": "Aljazair", "eif": "2026-07-09", "objection": True},
    "AD": {"en": "Andorra", "id": "Andorra", "eif": "1996-12-31", "objection": False},
    "AG": {"en": "Antigua and Barbuda", "id": "Antigua dan Barbuda", "eif": "1981-11-01", "objection": False},
    "AR": {"en": "Argentina", "id": "Argentina", "eif": "1988-02-18", "objection": False},
    "AM": {"en": "Armenia", "id": "Armenia", "eif": "1994-08-14", "objection": False},
    "AU": {"en": "Australia", "id": "Australia", "eif": "1995-03-16", "objection": False},
    "AT": {"en": "Austria", "id": "Austria", "eif": "1968-01-13", "objection": False},
    "AZ": {"en": "Azerbaijan", "id": "Azerbaijan", "eif": "2005-03-02", "objection": True},
    "BS": {"en": "Bahamas", "id": "Bahama", "eif": "1973-07-10", "objection": False},
    "BH": {"en": "Bahrain", "id": "Bahrain", "eif": "2013-12-31", "objection": False},
    "BD": {"en": "Bangladesh", "id": "Bangladesh", "eif": "2025-03-30", "objection": True},
    "BB": {"en": "Barbados", "id": "Barbados", "eif": "1966-11-30", "objection": False},
    "BY": {"en": "Belarus", "id": "Belarus", "eif": "1992-05-31", "objection": False},
    "BE": {"en": "Belgium", "id": "Belgia", "eif": "1976-02-09", "objection": False},
    "BZ": {"en": "Belize", "id": "Belize", "eif": "1993-04-11", "objection": False},
    "BO": {"en": "Bolivia", "id": "Bolivia", "eif": "2018-05-07", "objection": False},
    "BA": {"en": "Bosnia and Herzegovina", "id": "Bosnia dan Herzegovina", "eif": "1992-03-06", "objection": False},
    "BW": {"en": "Botswana", "id": "Botswana", "eif": "1966-09-30", "objection": False},
    "BR": {"en": "Brazil", "id": "Brasil", "eif": "2016-08-14", "objection": False},
    "BN": {"en": "Brunei Darussalam", "id": "Brunei Darussalam", "eif": "1987-12-03", "objection": False},
    "BG": {"en": "Bulgaria", "id": "Bulgaria", "eif": "2001-04-29", "objection": False},
    "BI": {"en": "Burundi", "id": "Burundi", "eif": "2015-02-13", "objection": True},
    "CV": {"en": "Cabo Verde", "id": "Tanjung Verde", "eif": "2010-02-13", "objection": False},
    "CA": {"en": "Canada", "id": "Kanada", "eif": "2024-01-11", "objection": False},
    "CL": {"en": "Chile", "id": "Cile", "eif": "2016-08-30", "objection": False},
    "CN": {"en": "China (People's Republic of)", "id": "Tiongkok", "eif": "2023-11-07", "objection": True},
    "CO": {"en": "Colombia", "id": "Kolombia", "eif": "2001-01-30", "objection": False},
    "CK": {"en": "Cook Islands", "id": "Kepulauan Cook", "eif": "2005-04-30", "objection": False},
    "CR": {"en": "Costa Rica", "id": "Kosta Rika", "eif": "2011-12-14", "objection": False},
    "HR": {"en": "Croatia", "id": "Kroasia", "eif": "1991-10-08", "objection": False},
    "CY": {"en": "Cyprus", "id": "Siprus", "eif": "1973-04-30", "objection": False},
    "CZ": {"en": "Czechia", "id": "Ceko", "eif": "1999-03-16", "objection": False},
    "DK": {"en": "Denmark", "id": "Denmark", "eif": "2006-12-29", "objection": False},
    "DM": {"en": "Dominica", "id": "Dominika", "eif": "1978-11-03", "objection": False},
    "DO": {"en": "Dominican Republic", "id": "Republik Dominika", "eif": "2009-08-30", "objection": True},
    "EC": {"en": "Ecuador", "id": "Ekuador", "eif": "2005-04-02", "objection": False},
    "SV": {"en": "El Salvador", "id": "El Salvador", "eif": "1996-05-31", "objection": False},
    "EE": {"en": "Estonia", "id": "Estonia", "eif": "2001-09-30", "objection": False},
    "SZ": {"en": "Eswatini", "id": "Eswatini", "eif": "1968-09-06", "objection": False},
    "FJ": {"en": "Fiji", "id": "Fiji", "eif": "1970-10-10", "objection": False},
    "FI": {"en": "Finland", "id": "Finlandia", "eif": "1985-08-26", "objection": False},
    "FR": {"en": "France", "id": "Prancis", "eif": "1965-01-24", "objection": False},
    "GE": {"en": "Georgia", "id": "Georgia", "eif": "2007-05-14", "objection": False},
    "DE": {"en": "Germany", "id": "Jerman", "eif": "1966-02-13", "objection": False},
    "GR": {"en": "Greece", "id": "Yunani", "eif": "1985-05-18", "objection": False},
    "GD": {"en": "Grenada", "id": "Grenada", "eif": "2002-04-07", "objection": False},
    "GT": {"en": "Guatemala", "id": "Guatemala", "eif": "2017-09-18", "objection": False},
    "GY": {"en": "Guyana", "id": "Guyana", "eif": "2019-04-18", "objection": False},
    "HN": {"en": "Honduras", "id": "Honduras", "eif": "2004-09-30", "objection": False},
    "HU": {"en": "Hungary", "id": "Hungaria", "eif": "1973-01-18", "objection": False},
    "IS": {"en": "Iceland", "id": "Islandia", "eif": "2004-11-27", "objection": False},
    "IN": {"en": "India", "id": "India", "eif": "2005-07-14", "objection": True},
    "ID": {"en": "Indonesia", "id": "Indonesia", "eif": "2022-06-04", "objection": False},
    "IE": {"en": "Ireland", "id": "Irlandia", "eif": "1999-03-09", "objection": False},
    "IL": {"en": "Israel", "id": "Israel", "eif": "1978-08-14", "objection": False},
    "IT": {"en": "Italy", "id": "Italia", "eif": "1978-02-11", "objection": False},
    "JM": {"en": "Jamaica", "id": "Jamaika", "eif": "2021-07-03", "objection": False},
    "JP": {"en": "Japan", "id": "Jepang", "eif": "1970-07-27", "objection": False},
    "KZ": {"en": "Kazakhstan", "id": "Kazakhstan", "eif": "2001-01-30", "objection": False},
    "XK": {"en": "Kosovo", "id": "Kosovo", "eif": "2016-07-14", "objection": True},
    "KG": {"en": "Kyrgyzstan", "id": "Kirgizstan", "eif": "2011-07-31", "objection": True},
    "LV": {"en": "Latvia", "id": "Latvia", "eif": "1996-01-30", "objection": False},
    "LS": {"en": "Lesotho", "id": "Lesotho", "eif": "1966-10-04", "objection": False},
    "LR": {"en": "Liberia", "id": "Liberia", "eif": "1996-02-08", "objection": True},
    "LI": {"en": "Liechtenstein", "id": "Liechtenstein", "eif": "1972-09-17", "objection": False},
    "LT": {"en": "Lithuania", "id": "Lituania", "eif": "1997-07-19", "objection": False},
    "LU": {"en": "Luxembourg", "id": "Luksemburg", "eif": "1979-06-03", "objection": False},
    "MW": {"en": "Malawi", "id": "Malawi", "eif": "1967-12-02", "objection": False},
    "MT": {"en": "Malta", "id": "Malta", "eif": "1968-03-03", "objection": False},
    "MH": {"en": "Marshall Islands", "id": "Kepulauan Marshall", "eif": "1992-08-14", "objection": False},
    "MU": {"en": "Mauritius", "id": "Mauritius", "eif": "1968-03-12", "objection": False},
    "MX": {"en": "Mexico", "id": "Meksiko", "eif": "1995-08-14", "objection": False},
    "MC": {"en": "Monaco", "id": "Monako", "eif": "2002-12-31", "objection": False},
    "MN": {"en": "Mongolia", "id": "Mongolia", "eif": "2009-12-31", "objection": True},
    "ME": {"en": "Montenegro", "id": "Montenegro", "eif": "2006-06-03", "objection": False},
    "MA": {"en": "Morocco", "id": "Maroko", "eif": "2016-08-14", "objection": True},
    "NA": {"en": "Namibia", "id": "Namibia", "eif": "2001-01-30", "objection": False},
    "NL": {"en": "Netherlands (Kingdom of the)", "id": "Belanda", "eif": "1965-10-08", "objection": False},
    "NZ": {"en": "New Zealand", "id": "Selandia Baru", "eif": "2001-11-22", "objection": False},
    "NI": {"en": "Nicaragua", "id": "Nikaragua", "eif": "2013-05-14", "objection": False},
    "NU": {"en": "Niue", "id": "Niue", "eif": "1999-03-02", "objection": False},
    "MK": {"en": "North Macedonia", "id": "Makedonia Utara", "eif": "1991-11-17", "objection": False},
    "NO": {"en": "Norway", "id": "Norwegia", "eif": "1983-07-29", "objection": False},
    "OM": {"en": "Oman", "id": "Oman", "eif": "2012-01-30", "objection": False},
    "PK": {"en": "Pakistan", "id": "Pakistan", "eif": "2023-03-09", "objection": True},
    "PW": {"en": "Palau", "id": "Palau", "eif": "2020-06-23", "objection": False},
    "PA": {"en": "Panama", "id": "Panama", "eif": "1991-08-04", "objection": False},
    "PY": {"en": "Paraguay", "id": "Paraguay", "eif": "2014-08-30", "objection": False},
    "PE": {"en": "Peru", "id": "Peru", "eif": "2010-09-30", "objection": True},
    "PH": {"en": "Philippines", "id": "Filipina", "eif": "2019-05-14", "objection": True},
    "PL": {"en": "Poland", "id": "Polandia", "eif": "2005-08-14", "objection": False},
    "PT": {"en": "Portugal", "id": "Portugal", "eif": "1969-02-04", "objection": False},
    "KR": {"en": "Republic of Korea", "id": "Korea Selatan", "eif": "2007-07-14", "objection": False},
    "MD": {"en": "Republic of Moldova", "id": "Moldova", "eif": "2007-03-16", "objection": False},
    "RO": {"en": "Romania", "id": "Rumania", "eif": "2001-03-16", "objection": False},
    "RU": {"en": "Russian Federation", "id": "Rusia", "eif": "1992-05-31", "objection": False},
    "RW": {"en": "Rwanda", "id": "Rwanda", "eif": "2024-06-05", "objection": True},
    "KN": {"en": "Saint Kitts and Nevis", "id": "Saint Kitts dan Nevis", "eif": "1994-12-14", "objection": False},
    "LC": {"en": "Saint Lucia", "id": "Saint Lucia", "eif": "2002-07-31", "objection": False},
    "VC": {"en": "Saint Vincent and the Grenadines", "id": "Saint Vincent dan Grenadines", "eif": "1979-10-27", "objection": False},
    "WS": {"en": "Samoa", "id": "Samoa", "eif": "1999-09-13", "objection": False},
    "SM": {"en": "San Marino", "id": "San Marino", "eif": "1995-02-13", "objection": False},
    "ST": {"en": "Sao Tome and Principe", "id": "Sao Tome dan Principe", "eif": "2008-09-13", "objection": False},
    "SA": {"en": "Saudi Arabia", "id": "Arab Saudi", "eif": "2022-12-07", "objection": False},
    "SN": {"en": "Senegal", "id": "Senegal", "eif": "2023-03-23", "objection": True},
    "RS": {"en": "Serbia", "id": "Serbia", "eif": "1992-04-27", "objection": False},
    "SC": {"en": "Seychelles", "id": "Seychelles", "eif": "1979-03-31", "objection": False},
    "SG": {"en": "Singapore", "id": "Singapura", "eif": "2021-09-16", "objection": False},
    "SK": {"en": "Slovakia", "id": "Slowakia", "eif": "2002-02-18", "objection": False},
    "SI": {"en": "Slovenia", "id": "Slovenia", "eif": "1991-06-25", "objection": False},
    "ZA": {"en": "South Africa", "id": "Afrika Selatan", "eif": "1995-04-30", "objection": False},
    "ES": {"en": "Spain", "id": "Spanyol", "eif": "1978-09-25", "objection": False},
    "SR": {"en": "Suriname", "id": "Suriname", "eif": "1975-11-25", "objection": False},
    "SE": {"en": "Sweden", "id": "Swedia", "eif": "1999-05-01", "objection": False},
    "CH": {"en": "Switzerland", "id": "Swiss", "eif": "1973-03-11", "objection": False},
    "TJ": {"en": "Tajikistan", "id": "Tajikistan", "eif": "2015-10-31", "objection": True},
    "TH": {"en": "Thailand", "id": "Thailand", "eif": "2027-02-28", "objection": False},
    "TO": {"en": "Tonga", "id": "Tonga", "eif": "1970-06-04", "objection": False},
    "TT": {"en": "Trinidad and Tobago", "id": "Trinidad dan Tobago", "eif": "2000-07-14", "objection": False},
    "TN": {"en": "Tunisia", "id": "Tunisia", "eif": "2018-03-30", "objection": True},
    "TR": {"en": "Turkiye", "id": "Turki", "eif": "1985-09-29", "objection": False},
    "UA": {"en": "Ukraine", "id": "Ukraina", "eif": "2003-12-22", "objection": False},
    "GB": {"en": "United Kingdom of Great Britain and Northern Ireland", "id": "Inggris / UK", "eif": "1965-01-24", "objection": False},
    "US": {"en": "United States of America", "id": "Amerika Serikat", "eif": "1981-10-15", "objection": False},
    "UY": {"en": "Uruguay", "id": "Uruguay", "eif": "2012-10-14", "objection": False},
    "UZ": {"en": "Uzbekistan", "id": "Uzbekistan", "eif": "2012-04-15", "objection": True},
    "VU": {"en": "Vanuatu", "id": "Vanuatu", "eif": "1980-07-30", "objection": False},
    "VE": {"en": "Venezuela (Bolivarian Republic of)", "id": "Venezuela", "eif": "1999-03-16", "objection": False},
    "VN": {"en": "Viet Nam", "id": "Vietnam", "eif": "2026-09-11", "objection": True},

    # --- Wilayah/ekstensi yang secara praktik diperlakukan sebagai "negara" oleh vendor ---
    "HK": {
        "en": "Hong Kong SAR (China)", "id": "Hong Kong", "eif": "1965-04-25", "objection": False,
        "territory_of": "CN",
        "territory_note": "Berlaku sejak ekstensi UK 1965, dilanjutkan RRT sejak 1 Juli 1997. "
                          "Competent Authority: High Court of Hong Kong SAR.",
    },
    "MO": {
        "en": "Macao SAR (China)", "id": "Makau", "eif": "1969-02-04", "objection": False,
        "territory_of": "CN",
        "territory_note": "Berlaku sejak ekstensi Portugal, dilanjutkan RRT sejak 20 Desember 1999.",
    },
}

# ---------------------------------------------------------------------------
# Negara non-anggota yang sering muncul sebagai asal vendor -> WAJIB LEGALISIR.
# Bukan daftar lengkap; apa pun yang tidak ada di HAGUE_PARTIES = wajib legalisir.
# ---------------------------------------------------------------------------
NON_PARTY_COMMON = {
    "MY": "Malaysia",
    "TW": "Taiwan",
    "AE": "Uni Emirat Arab",
    "QA": "Qatar",
    "KW": "Kuwait",
    "IQ": "Irak",
    "IR": "Iran",
    "JO": "Yordania",
    "LB": "Lebanon",
    "EG": "Mesir",
    "LY": "Libya",
    "NG": "Nigeria",
    "KE": "Kenya",
    "GH": "Ghana",
    "ET": "Etiopia",
    "TZ": "Tanzania",
    "UG": "Uganda",
    "LK": "Sri Lanka",
    "NP": "Nepal",
    "MM": "Myanmar",
    "KH": "Kamboja",
    "LA": "Laos",
    "TL": "Timor-Leste",
    "PG": "Papua Nugini",
    "AF": "Afghanistan",
    "SY": "Suriah",
    "YE": "Yaman",
    "CU": "Kuba",
    "HT": "Haiti",
    "BF": "Burkina Faso",
    "CM": "Kamerun",
    "CI": "Pantai Gading",
    "CD": "Republik Demokratik Kongo",
    "ZW": "Zimbabwe",
    "ZM": "Zambia",
    "MZ": "Mozambik",
    "AO": "Angola",
    "SD": "Sudan",
    "DJ": "Djibouti",
    "MV": "Maladewa",
    "BT": "Bhutan",
    "KP": "Korea Utara",
}

# ---------------------------------------------------------------------------
# Alias nama -> kode ISO. Menampung ejaan Indonesia, Inggris, dan gaya penulisan
# yang dipakai di COUNTRY_DB (reference_data.py) maupun hasil import Excel vendor.
# ---------------------------------------------------------------------------
COUNTRY_ALIASES: dict[str, str] = {
    # dipakai langsung oleh COUNTRY_DB
    "singapura": "SG", "singapore": "SG",
    "amerika serikat": "US", "amerika": "US", "united states": "US",
    "united states of america": "US", "usa": "US", "us": "US",
    "inggris / uk": "GB", "inggris": "GB", "uk": "GB", "britania raya": "GB",
    "united kingdom": "GB", "great britain": "GB", "england": "GB",
    "hong kong": "HK", "hongkong": "HK", "hong kong sar": "HK",
    "jepang": "JP", "japan": "JP",
    "australia": "AU",
    "jerman": "DE", "germany": "DE", "deutschland": "DE",
    "india": "IN",
    "tiongkok": "CN", "china": "CN", "cina": "CN", "rrt": "CN",
    "people's republic of china": "CN", "prc": "CN",
    # non-anggota yang paling sering
    "malaysia": "MY",
    "taiwan": "TW", "chinese taipei": "TW",
    "uni emirat arab": "AE", "uae": "AE", "united arab emirates": "AE",
    # anggota lain yang lazim
    "indonesia": "ID",
    "korea selatan": "KR", "korea": "KR", "south korea": "KR",
    "republic of korea": "KR",
    "belanda": "NL", "netherlands": "NL", "holland": "NL",
    "prancis": "FR", "perancis": "FR", "france": "FR",
    "italia": "IT", "italy": "IT",
    "spanyol": "ES", "spain": "ES",
    "swiss": "CH", "switzerland": "CH",
    "kanada": "CA", "canada": "CA",
    "brasil": "BR", "brazil": "BR",
    "meksiko": "MX", "mexico": "MX",
    "arab saudi": "SA", "saudi arabia": "SA",
    "turki": "TR", "turkiye": "TR", "türkiye": "TR", "turkey": "TR",
    "rusia": "RU", "russia": "RU", "russian federation": "RU",
    "filipina": "PH", "philippines": "PH",
    "vietnam": "VN", "viet nam": "VN",
    "thailand": "TH", "muangthai": "TH",
    "selandia baru": "NZ", "new zealand": "NZ",
    "afrika selatan": "ZA", "south africa": "ZA",
    "makau": "MO", "macau": "MO", "macao": "MO",
    "brunei": "BN", "brunei darussalam": "BN",
    "pakistan": "PK", "bangladesh": "BD", "sri lanka": "LK",
    "oman": "OM", "bahrain": "BH", "qatar": "QA", "kuwait": "KW",
}


def _norm(name: str) -> str:
    return " ".join(str(name or "").strip().lower().replace("_", " ").split())


def resolve_code(country: str) -> str | None:
    """Terjemahkan nama negara (ID/EN/alias) ke kode ISO-2. None bila tidak dikenal."""
    if not country:
        return None
    raw = str(country).strip()
    if len(raw) == 2 and raw.upper() in HAGUE_PARTIES:
        return raw.upper()
    if len(raw) == 2 and raw.upper() in NON_PARTY_COMMON:
        return raw.upper()

    key = _norm(raw)
    if key in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[key]
    for code, meta in HAGUE_PARTIES.items():
        if key in (_norm(meta["en"]), _norm(meta.get("id", ""))):
            return code
    for code, nama in NON_PARTY_COMMON.items():
        if key == _norm(nama):
            return code
    return None


def _as_date(value: str | None) -> date | None:
    if not value:
        return None
    y, m, d = (int(x) for x in value.split("-"))
    return date(y, m, d)


# Konstanta method — dipakai juga oleh frontend lewat endpoint /reference/apostille
METHOD_APOSTILLE = "APOSTILLE"
METHOD_LEGALIZATION = "LEGALISIR"

LEGALIZATION_STEPS = [
    "Notarisasi dokumen di negara asal (notary public).",
    "Autentikasi oleh otoritas negara asal (Kemenlu/Secretary of State/Chamber of Commerce sesuai negara).",
    "Legalisasi di KBRI/KJRI yang membawahi wilayah tersebut.",
    "Terjemahan tersumpah ke Bahasa Indonesia/Inggris bila dokumen berbahasa lain.",
]

APOSTILLE_STEPS = [
    "Dokumen diterbitkan/dinotarisasi sesuai ketentuan negara asal.",
    "Ajukan Apostille ke Competent Authority negara asal (satu sertifikat, tanpa KBRI).",
    "Pastikan sertifikat Apostille menyatu/terlampir pada dokumen aslinya, bukan lembar terpisah tanpa referensi.",
    "Terjemahan tersumpah bila dokumen berbahasa selain Indonesia/Inggris.",
]


def apostille_status(country: str, as_of: date | None = None) -> dict:
    """
    Tentukan kebutuhan otentikasi dokumen dari `country` untuk dipakai di Indonesia.

    Return dict:
        code, country, is_party, in_force, eif, method, label, requires_legalization,
        steps, objection_flag, note
    """
    as_of = as_of or date.today()
    code = resolve_code(country)
    meta = HAGUE_PARTIES.get(code) if code else None

    if meta is None:
        known_non_party = bool(code and code in NON_PARTY_COMMON)
        return {
            "code": code,
            "country": (NON_PARTY_COMMON.get(code) if known_non_party else str(country or "").strip()),
            "is_party": False,
            "in_force": False,
            "eif": None,
            "method": METHOD_LEGALIZATION,
            "label": "Wajib Legalisir",
            "requires_legalization": True,
            "steps": LEGALIZATION_STEPS,
            "objection_flag": False,
            "note": (
                "Tidak terdaftar sebagai Contracting Party Konvensi Apostille 1961 — "
                "dokumen wajib melalui legalisasi berjenjang sampai KBRI/KJRI."
                if known_non_party else
                "Negara tidak dikenali dalam daftar Contracting Party. Perlakukan sebagai "
                "WAJIB LEGALISIR dan verifikasi manual ke status table HCCH."
            ),
        }

    eif = _as_date(meta["eif"])
    in_force = bool(eif and eif <= as_of)

    if in_force:
        note = "Terdaftar di Konvensi Apostille Den Haag — cukup Apostille, tanpa legalisasi KBRI."
        if meta.get("territory_note"):
            note = f"{note} {meta['territory_note']}"
        if meta.get("objection"):
            note += (
                " Aksesinya pernah dikeberatani negara lain (tanda A** di status table); "
                "Indonesia tidak termasuk yang keberatan, namun verifikasi bila dokumen "
                "juga akan dipakai di negara ketiga."
            )
        return {
            "code": code,
            "country": meta.get("id") or meta["en"],
            "is_party": True,
            "in_force": True,
            "eif": meta["eif"],
            "method": METHOD_APOSTILLE,
            "label": "Apostille",
            "requires_legalization": False,
            "steps": APOSTILLE_STEPS,
            "objection_flag": bool(meta.get("objection")),
            "note": note,
        }

    # Sudah menyerahkan instrumen aksesi tetapi belum entry into force.
    return {
        "code": code,
        "country": meta.get("id") or meta["en"],
        "is_party": True,
        "in_force": False,
        "eif": meta["eif"],
        "method": METHOD_LEGALIZATION,
        "label": "Wajib Legalisir (Apostille berlaku " + str(meta["eif"]) + ")",
        "requires_legalization": True,
        "steps": LEGALIZATION_STEPS,
        "objection_flag": bool(meta.get("objection")),
        "note": (
            f"Sudah menjadi Contracting Party tetapi Konvensi baru berlaku "
            f"{meta['eif']}. Sampai tanggal tersebut dokumen MASIH wajib legalisir KBRI/KJRI."
        ),
    }


def requires_legalization(country: str, as_of: date | None = None) -> bool:
    """Shortcut boolean: True = wajib legalisir, False = cukup apostille."""
    return apostille_status(country, as_of)["requires_legalization"]


def is_apostille_country(country: str, as_of: date | None = None) -> bool:
    """Shortcut boolean: True = cukup apostille."""
    return apostille_status(country, as_of)["method"] == METHOD_APOSTILLE


def apply_apostille_status(country_db: dict, as_of: date | None = None) -> dict:
    """
    Sinkronkan COUNTRY_DB (reference_data.py) dengan status resmi HCCH.

    Untuk tiap negara ditambahkan/di-overwrite:
        apostille            -> bool (cukup apostille atau tidak)
        authentication       -> dict lengkap hasil apostille_status()

    Dipanggil sekali saat import reference_data agar flag manual tidak pernah
    lagi menyimpang dari status table.
    """
    for name, entry in country_db.items():
        status = apostille_status(name, as_of)
        entry["apostille"] = status["method"] == METHOD_APOSTILLE
        entry["authentication"] = status
    return country_db


def apostille_reference(as_of: date | None = None) -> dict:
    """Payload siap-serve untuk endpoint /api/reference/apostille."""
    as_of = as_of or date.today()
    parties, pending = [], []
    for code, meta in HAGUE_PARTIES.items():
        row = {
            "code": code,
            "name_en": meta["en"],
            "name_id": meta.get("id") or meta["en"],
            "eif": meta["eif"],
            "objection": bool(meta.get("objection")),
            "territory_of": meta.get("territory_of"),
        }
        eif = _as_date(meta["eif"])
        (parties if eif and eif <= as_of else pending).append(row)

    parties.sort(key=lambda r: r["name_en"])
    pending.sort(key=lambda r: r["eif"] or "")
    return {
        "source": APOSTILLE_SOURCE,
        "as_of": as_of.isoformat(),
        "rule": {
            "apostille": "Negara terdaftar & Konvensi sudah berlaku -> cukup Apostille.",
            "legalisir": "Negara tidak terdaftar (atau belum entry into force) -> wajib legalisir KBRI/KJRI.",
        },
        "apostille_countries": parties,
        "pending_entry_into_force": pending,
        "non_party_common": [
            {"code": c, "name_id": n} for c, n in sorted(NON_PARTY_COMMON.items(), key=lambda kv: kv[1])
        ],
        "apostille_steps": APOSTILLE_STEPS,
        "legalization_steps": LEGALIZATION_STEPS,
    }


if __name__ == "__main__":  # smoke test cepat: python backend/apostille_data.py
    for c in ["Singapura", "Malaysia", "India", "Tiongkok", "Hong Kong",
              "Vietnam", "Thailand", "Taiwan", "Amerika Serikat", "Narnia"]:
        s = apostille_status(c)
        print(f"{c:18s} -> {s['label']:45s} ({s['method']})")
    print(f"\nTotal contracting parties in file: "
          f"{len([k for k, v in HAGUE_PARTIES.items() if not v.get('territory_of')])}")
