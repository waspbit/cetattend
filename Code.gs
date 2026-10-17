/**
 * CET Attendance & Penalty Portal — Backend (Google Apps Script)
 * NOTE: Student ID + Course lookup is a CONVENIENCE lookup, NOT secure authentication.
 */

// ===================== CONFIGURATION =====================
const CONFIG = {
  SPREADSHEET_ID: 'PASTE_YOUR_SPREADSHEET_ID_HERE', // from the sheet URL: /d/<THIS PART>/edit
  SHEET_NAME: 'Attendance Summary',
  HEADER_ROW: 1,
  PENALTY_HOURS_PER_ABSENCE: 0.5, // used only if the sheet's penalty cell is blank/invalid
  // Optional tab listing privileges that grant full exemption (one per row in column A, header in row 1).
  // If this tab is missing or empty, the fallback list below is used.
  PRIVILEGES_SHEET: 'Privileges',
  EXEMPT_PRIVILEGES: ['Athlete/Player', 'Golden Harvest', 'CAASUC', 'Student Council'],
  // Exact header names in your sheet:
  COLS: {
    id: 'StudentID', name: 'FullName', course: 'Course',
    attended: 'TotalAttendance', absent: 'NonAttendance',
    penalty: 'TotalPenaltyHours', privilege: 'Privilege'
  }
};
// =========================================================

/** GET ?action=courses  -> list of courses (JSON) */
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'courses') return json_({ ok: true, courses: getCourses() });
  return json_({ ok: true, message: 'CET portal API is running.' });
}

/** POST body (JSON text): { studentId, course } -> student record (JSON) */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    return json_(lookupStudent(String(body.studentId || ''), String(body.course || '')));
  } catch (err) {
    return json_({ ok: false, message: 'Invalid request.' });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Course list is built automatically from the Course column of the sheet. */
function getCourses() {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[CONFIG.HEADER_ROW - 1].map(h => String(h).trim());
    const ci = headers.indexOf(CONFIG.COLS.course);
    if (ci < 0) throw new Error('Missing column header: ' + CONFIG.COLS.course);
    const seen = {}, list = [];
    for (let r = CONFIG.HEADER_ROW; r < data.length; r++) {
      const label = String(data[r][ci] || '').trim(), key = normCourse_(label);
      if (key && !seen[key]) { seen[key] = true; list.push(label); }
    }
    return list.sort();
  } catch (err) {
    console.error(err);
    return [];
  }
}

/** Called from the browser. Returns ONLY the matching student's dashboard data. */
function lookupStudent(studentId, course) {
  try {
    const id = normId_(studentId), crs = normCourse_(course);
    if (!id || !crs || id.length > 30) return { ok: false, message: 'Please enter your Student ID and select your course.' };

    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) throw new Error('Sheet tab not found: ' + CONFIG.SHEET_NAME);

    const data = sheet.getDataRange().getValues(); // stays on the server
    const headers = data[CONFIG.HEADER_ROW - 1].map(h => String(h).trim());
    const ix = {};
    for (const k in CONFIG.COLS) {
      ix[k] = headers.indexOf(CONFIG.COLS[k]);
      if (ix[k] < 0) throw new Error('Missing column header: ' + CONFIG.COLS[k]);
    }

    const matches = [];
    for (let r = CONFIG.HEADER_ROW; r < data.length; r++) {
      const row = data[r];
      if (normId_(row[ix.id]) === id && normCourse_(row[ix.course]) === crs) matches.push(row);
    }
    if (matches.length === 0) return { ok: false, message: 'Student record not found. Please check your Student ID and course.' };
    if (matches.length > 1) return { ok: false, message: 'Your record could not be shown because multiple matching entries exist. Please contact the administrator.' };

    return { ok: true, student: buildStudent_(matches[0], ix) };
  } catch (err) {
    console.error(err);
    return { ok: false, message: 'The system could not read the records right now. Please contact the administrator.' };
  }
}

function buildStudent_(row, ix) {
  const attended = num_(row[ix.attended]), absent = num_(row[ix.absent]);
  const totalEvents = attended + absent;
  const rate = totalEvents > 0 ? Math.round((attended / totalEvents) * 1000) / 10 : null;

  // Privileges: complete-name, case-insensitive matches only
  const exemptSet = getExemptPrivileges_().map(p => p.toLowerCase());
  const seen = {}, privileges = [];
  String(row[ix.privilege] || '').split(',').forEach(p => {
    const name = p.trim(), key = name.toLowerCase();
    if (!name || key === 'none' || seen[key]) return;
    seen[key] = true;
    privileges.push({ name: name, recognized: exemptSet.includes(key) });
  });
  const exempt = privileges.some(p => p.recognized);

  // Sheet value is authoritative; fall back to calculation if blank/invalid
  const sheetPenalty = row[ix.penalty];
  const totalPenalty = (sheetPenalty !== '' && isFinite(Number(sheetPenalty)))
    ? Number(sheetPenalty) : absent * CONFIG.PENALTY_HOURS_PER_ABSENCE;
  const requiredPenalty = exempt ? 0 : totalPenalty;

  return {
    name: String(row[ix.name] || '').trim(),
    studentId: String(row[ix.id]).trim(),
    course: String(row[ix.course]).trim(),
    totalEvents: totalEvents, attended: attended, absent: absent, rate: rate,
    privileges: privileges, exempt: exempt,
    totalPenalty: totalPenalty, requiredPenalty: requiredPenalty,
    status: exempt ? 'exempt' : (requiredPenalty > 0 ? 'required' : 'none')
  };
}

/** Exempting privileges come from the 'Privileges' tab (column A), else from CONFIG. */
function getExemptPrivileges_() {
  try {
    const sh = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.PRIVILEGES_SHEET);
    if (sh && sh.getLastRow() > 1) {
      const list = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
        .map(r => String(r[0] || '').trim()).filter(Boolean);
      if (list.length) return list;
    }
  } catch (err) { console.error(err); }
  return CONFIG.EXEMPT_PRIVILEGES;
}

function num_(v) { const n = Number(v); return isFinite(n) && v !== '' && n > 0 ? n : 0; }
function normId_(v) { return String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase(); }
function normCourse_(v) { return String(v == null ? '' : v).replace(/[\s.\-_]/g, '').toUpperCase(); }