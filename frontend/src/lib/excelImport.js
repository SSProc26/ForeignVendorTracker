import * as XLSX from "xlsx";

/**
 * Excel import for the vendor-filled "FORM FOR FOREIGN ENTITY" template.
 * Ported from the original reference implementation: it detects the
 * "Company Information" + "Document checklist" sheets when present, and falls
 * back to a generic label/value scan for unknown sheet shapes.
 */

export const KEYWORDS = {
  name: ["nama vendor", "vendor name", "company name", "nama perusahaan", "legal name"],
  country: ["negara", "country", "country of origin", "negara asal"],
  boardOwnership: ["direktur", "director", "komisaris", "commissioner", "commisioner", "ownership", "pemegang saham", "shareholder", "ownershare", "board of"],
  companyRegistration: ["company registration", "certificate of registration", "registrasi perusahaan", "nomor registrasi", "registration number", "registration no"],
  businessLicense: ["business license", "izin usaha", "license", "lisensi"],
  domicile: ["domicile", "residence", "domisili"],
  deed: ["deed", "article of incorporation", "articles of association", "akta pendirian", "certificate of incorporation", "memorandum", "establishment"],
  taxId: ["tax id", "tax identification", "npwp", "ein", "tax reference", "uen", "vat number", "tin"],
  annualTaxReturn: ["annual income tax", "annual tax return", "spt tahunan", "tax return", "income tax return"],
  otherTax: ["other tax", "pajak lain", "vat return", "gst", "other tax document"],
  applicationLetter: ["application letter"],
  statementLetter: ["statement letter"],
  pactOfIntegrity: ["pact of integrity", "letter of undertaking", "undertaking"],
  bankReference: ["bank reference", "surat referensi bank", "referensi bank"],
  financialAudit: ["financial audit", "audit report", "laporan audit", "auditor"],
  workExperience: ["work experience", "pengalaman kerja", "experience list"],
  completionCertificate: ["completion certificate", "minutes of acceptance", "berita acara"],
  safetyCert: ["safety management", "contractor safety", "sistem manajemen keselamatan"],
  equipmentList: ["equipment list", "daftar peralatan"],
  representativePermission: ["representative permission", "power of attorney", "surat kuasa"],
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchLabel(label) {
  const l = String(label || "").toLowerCase();
  for (const key in KEYWORDS) {
    if (KEYWORDS[key].some((kw) => new RegExp("\\b" + escapeRegex(kw)).test(l))) return key;
  }
  return null;
}

function cellStr(rows, r, c) {
  return rows[r] && rows[r][c] !== undefined && rows[r][c] !== null ? String(rows[r][c]).trim() : "";
}

/**
 * Reads a sheet into a sparse 2D grid by addressing every cell in the used range
 * (rather than sheet_to_json, whose row-compaction can skip rows), then forward-fills
 * merged ranges so a merged cell's value is visible from every row/column it covers.
 */
function sheetToGrid(sheet) {
  const ref = sheet["!ref"];
  if (!ref) return { grid: [], rowStart: 0, rowEnd: -1 };
  const range = XLSX.utils.decode_range(ref);
  const grid = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      row[c] = cell && cell.v !== undefined && cell.v !== null ? cell.v : "";
    }
    grid[r] = row;
  }
  (sheet["!merges"] || []).forEach((m) => {
    const topVal = grid[m.s.r] ? grid[m.s.r][m.s.c] : undefined;
    if (topVal === undefined || topVal === "") return;
    for (let r = m.s.r; r <= m.e.r; r++) {
      if (!grid[r]) grid[r] = [];
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (grid[r][c] === undefined || grid[r][c] === "") grid[r][c] = topVal;
      }
    }
  });
  return { grid, rowStart: range.s.r, rowEnd: range.e.r };
}

export function parseCompanyInfoSheet(sheet) {
  const { grid: rows, rowStart, rowEnd } = sheetToGrid(sheet);
  const data = {
    name: "", address: "", city: "", province: "", email: "", taxId: "", note: "",
    shareholders: [], bod: [], boc: [],
    bank: { account: "", bankName: "", holder: "", note: "" },
    totalEquity: "", subfields: [],
  };
  let mode = null;
  for (let i = rowStart; i <= rowEnd; i++) {
    const label = cellStr(rows, i, 1); // column B
    const lower = label.toLowerCase();
    if (lower.startsWith("name")) { data.name = cellStr(rows, i, 3); mode = null; continue; }
    if (lower.startsWith("address")) { data.address = cellStr(rows, i, 3); mode = null; continue; }
    if (lower.startsWith("city")) { data.city = cellStr(rows, i, 3); mode = null; continue; }
    if (lower.startsWith("province")) { data.province = cellStr(rows, i, 3); mode = null; continue; }
    if (lower.startsWith("email")) { data.email = cellStr(rows, i, 3); mode = null; continue; }
    if (lower.includes("tax identification number") && !lower.includes("list")) { data.taxId = cellStr(rows, i, 3); mode = null; continue; }
    if (lower.startsWith("list of shareholder")) { mode = "shareholder"; continue; }
    if (lower.startsWith("list board of director") || lower.startsWith("list of board of director")) { mode = "bod"; continue; }
    if (lower.startsWith("list board of commis") || lower.startsWith("list of board of commis")) { mode = "boc"; continue; }
    if (lower.startsWith("bank account")) { data.bank.account = cellStr(rows, i, 3); mode = "bank"; continue; }
    if (lower.startsWith("bank name")) { data.bank.bankName = cellStr(rows, i, 3); mode = "bank"; continue; }
    if (lower.startsWith("account holder")) { data.bank.holder = cellStr(rows, i, 3); mode = "bank"; continue; }
    if (lower.startsWith("total equity")) { data.totalEquity = cellStr(rows, i, 3); mode = null; continue; }
    if (lower === "note" || lower.startsWith("note")) {
      if (mode === "bank") data.bank.note = cellStr(rows, i, 3);
      else data.note = cellStr(rows, i, 3);
      continue;
    }
    if (lower.startsWith("subfields")) { mode = "subfields"; continue; }
    if (lower.startsWith("bank information") || lower.startsWith("financial information") ||
        lower.startsWith("other document") || lower.startsWith("ownership") ||
        lower.startsWith("general information")) { mode = null; continue; }

    if (mode === "subfields" && !label) {
      const code = cellStr(rows, i, 4), workExp = cellStr(rows, i, 5), completion = cellStr(rows, i, 6);
      if (code || workExp || completion) data.subfields.push({ code, workExp, completion });
      continue;
    }
    if (mode && mode !== "subfields" && !label) {
      const nameCell = cellStr(rows, i, 3), field2 = cellStr(rows, i, 5), field3 = cellStr(rows, i, 6);
      if (nameCell || field2 || field3) {
        const names = nameCell.split("\n").map((s) => s.trim()).filter(Boolean);
        const f2s = field2.split("\n").map((s) => s.trim()).filter(Boolean);
        const f3s = field3.split("\n").map((s) => s.trim()).filter(Boolean);
        const n = Math.max(names.length, f2s.length, f3s.length, 1);
        for (let k = 0; k < n; k++) {
          const rec = { name: names[k] || names[0] || "", field2: f2s[k] || "", field3: f3s[k] || "" };
          if (!rec.name && !rec.field2 && !rec.field3) continue;
          if (mode === "shareholder") data.shareholders.push({ name: rec.name, pct: rec.field2, type: rec.field3 });
          else if (mode === "bod") data.bod.push({ name: rec.name, position: rec.field2, idnum: rec.field3 });
          else if (mode === "boc") data.boc.push({ name: rec.name, position: rec.field2, idnum: rec.field3 });
        }
      }
    }
  }
  return data;
}

export function parseDocumentChecklistSheet(sheet) {
  const { grid: rows, rowStart, rowEnd } = sheetToGrid(sheet);
  const items = [];
  for (let i = rowStart; i <= rowEnd; i++) {
    const doc = cellStr(rows, i, 2); // column C
    if (!doc || doc.toUpperCase() === "DOCUMENT") continue;
    items.push({ document: doc, checklist: cellStr(rows, i, 4), note: cellStr(rows, i, 5), rowIndex: i });
  }
  return items;
}

function listToText(list, fields) {
  return list.map((item) => fields.map((f) => item[f]).filter(Boolean).join(" — ")).join("\n");
}

function emptyCategories(categoryKeys) {
  const o = {};
  categoryKeys.forEach((k) => { o[k] = { complete: false, note: "", sourceValue: "", sourceRow: null }; });
  return o;
}

function findSheet(wb, needle) {
  return wb.SheetNames.find((n) => n.toLowerCase().includes(needle));
}

/**
 * Main entry point. Returns { detected, mode, sheetNames } where detected is
 * { name, country, categories, company } ready to be reviewed/corrected by the user.
 */
export function parseWorkbook(arrayBuffer, categoryKeys) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const companySheet = findSheet(wb, "company information");
  const checklistSheet = findSheet(wb, "document checklist");

  if (companySheet && checklistSheet) {
    return {
      mode: "template",
      sheetNames: wb.SheetNames,
      detected: runTemplateImport(wb, companySheet, checklistSheet, categoryKeys),
    };
  }
  // Generic fallback: scan the first sheet for label/value pairs.
  const first = wb.SheetNames[0];
  return {
    mode: "generic",
    sheetNames: wb.SheetNames,
    detected: runGenericImport(wb, first, categoryKeys),
  };
}

function runTemplateImport(wb, companySheetName, checklistSheetName, categoryKeys) {
  const company = parseCompanyInfoSheet(wb.Sheets[companySheetName]);
  const checklistItems = parseDocumentChecklistSheet(wb.Sheets[checklistSheetName]);

  const categories = emptyCategories(categoryKeys);
  checklistItems.forEach((it) => {
    const key = matchLabel(it.document);
    if (!key || !categories[key]) return;
    if (categories[key].note) return; // keep first match only
    // Completeness is a Reviewer decision, never read from the vendor's own
    // self-reported text — always start Incomplete so it must be ticked manually.
    categories[key].note = it.note || it.checklist || "";
    categories[key].complete = false;
    categories[key].sourceRow = it.rowIndex;
  });

  if (company.shareholders.length || company.bod.length || company.boc.length) {
    let txt = "";
    if (company.shareholders.length) txt += "Shareholders:\n" + listToText(company.shareholders, ["name", "pct", "type"]) + "\n\n";
    if (company.bod.length) txt += "Board of Directors:\n" + listToText(company.bod, ["name", "position", "idnum"]) + "\n\n";
    if (company.boc.length) txt += "Board of Commissioners:\n" + listToText(company.boc, ["name", "position", "idnum"]);
    if (categories.boardOwnership) categories.boardOwnership.sourceValue = txt.trim();
  }
  if (company.taxId && categories.taxId) categories.taxId.sourceValue = company.taxId;
  if ((company.address || company.city || company.province) && categories.domicile) {
    categories.domicile.sourceValue = [company.address, company.city, company.province].filter(Boolean).join(", ");
  }

  return {
    name: company.name,
    country: company.province,
    categories,
    company: {
      address: company.address, city: company.city, email: company.email,
      taxId: company.taxId, note: company.note,
      shareholders: company.shareholders,
      bod: company.bod,
      boc: company.boc,
      bank: company.bank,
      totalEquity: company.totalEquity,
      subfields: company.subfields,
    },
  };
}

function runGenericImport(wb, sheetName, categoryKeys) {
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  const detected = {
    name: "", country: "",
    categories: emptyCategories(categoryKeys),
    company: { address: "", city: "", email: "", taxId: "", note: "", shareholders: [], bod: [], boc: [], bank: {}, totalEquity: "", subfields: [] },
  };
  rows.forEach((row) => {
    const cells = row.map((c) => String(c).trim()).filter(Boolean);
    if (cells.length < 2) return;
    const label = cells[0];
    const value = cells.slice(1).join(" ").replace(/^:\s*/, "");
    const key = matchLabel(label);
    if (key === "name" && !detected.name) detected.name = value;
    else if (key === "country" && !detected.country) detected.country = value;
    else if (key && detected.categories[key] && !detected.categories[key].sourceValue) {
      detected.categories[key].sourceValue = value;
    }
  });
  return detected;
}
