/* Reference endpoints only. See BLUEPRINT.md for remaining production services. */
var ATTENDANCE_HEADERS_ = ['key', 'dateKey', 'employeeId', 'status', 'revision', 'updatedAt', 'updatedBy', 'requestId'];
var REQUEST_HEADERS_ = ['requestId', 'fingerprint', 'responseJson', 'updatedAt'];
var AUDIT_HEADERS_ = ['auditId', 'entityKey', 'beforeJson', 'afterJson', 'updatedAt', 'updatedBy', 'requestId'];
var EMPLOYEE_HEADERS_ = ['employeeId', 'name', 'nickname', 'position', 'startDate', 'endDate', 'notes', 'photoVersion', 'revision', 'updatedAt'];
var MONTH_HEADERS_ = ['monthKey', 'state', 'revision', 'snapshotVersion', 'closedAt', 'closedBy'];

function owner_() {
  var configured = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL');
  var email = Session.getActiveUser().getEmail();
  requireValue_(configured && email && email.toLowerCase() === configured.toLowerCase(), 'AUTH_REQUIRED');
  return email.toLowerCase();
}

function spreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  requireValue_(id && /^[\w-]+$/.test(id), 'CONFIG_REQUIRED');
  return SpreadsheetApp.openById(id);
}

function bangkokToday_() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
}

function locked_(operation) {
  var lock = LockService.getScriptLock();
  requireValue_(lock.tryLock(3000), 'BUSY');
  try { return operation(); } finally { lock.releaseLock(); }
}

function table_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  requireValue_(sheet !== null, 'SCHEMA_REQUIRED');
  var data = sheet.getDataRange().getValues();
  requireValue_(data.length && data[0].length === headers.length && headers.every(function (h, i) { return data[0][i] === h; }), 'SCHEMA_MISMATCH');
  var rows = [];
  data.slice(1).forEach(function (values, index) {
    if (values.every(function (v) { return v === ''; })) return;
    var obj = { rowNumber: index + 2 };
    headers.forEach(function (h, i) { obj[h] = values[i]; });
    rows.push(obj);
  });
  return { sheet: sheet, rows: rows };
}

function unique_(rows, field, value) {
  var found = rows.filter(function (r) { return r[field] === value; });
  requireValue_(found.length <= 1, 'DUPLICATE_KEY');
  return found[0] || null;
}

function suffix_(month) { return monthKey_(month).replace('-', '_'); }

function monthState_(ss, month) {
  var row = unique_(table_(ss, 'MonthState', MONTH_HEADERS_).rows, 'monthKey', month);
  requireValue_(row && ['OPEN', 'CLOSED'].indexOf(row.state) >= 0, 'MONTH_NOT_INITIALIZED');
  return row;
}

function calendar_(ss) {
  // Reference supports one workweek plus date overrides. Production must add
  // effective-dated workweek versions before allowing schedule changes.
  var settings = table_(ss, 'Settings', ['key', 'value', 'revision', 'updatedAt']).rows;
  var week = unique_(settings, 'key', 'workweekJson');
  var start = unique_(settings, 'key', 'calendarEffectiveFrom');
  requireValue_(week && start, 'CALENDAR_REQUIRED');
  dateKey_(start.value);
  var overrides = Object.create(null);
  table_(ss, 'WorkCalendar', ['dateKey', 'kind', 'note', 'revision', 'updatedAt']).rows.forEach(function (r) {
    dateKey_(r.dateKey);
    requireValue_(!Object.prototype.hasOwnProperty.call(overrides, r.dateKey), 'DUPLICATE_KEY');
    requireValue_(['WORKDAY', 'HOLIDAY'].indexOf(r.kind) >= 0, 'INVALID_CALENDAR');
    overrides[r.dateKey] = r.kind;
  });
  return { weekdays: JSON.parse(week.value), overrides: overrides, startDate: start.value };
}

function normalizeAttendance_(payload) {
  requireValue_(payload && typeof payload === 'object' && !Array.isArray(payload), 'INVALID_INPUT');
  var fields = ['dateKey', 'employeeId', 'status', 'expectedRevision', 'requestId'];
  requireValue_(Object.keys(payload).length === fields.length && Object.keys(payload).every(function (k) { return fields.indexOf(k) >= 0; }), 'INVALID_INPUT');
  dateKey_(payload.dateKey);
  requireValue_(typeof payload.employeeId === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(payload.employeeId), 'INVALID_EMPLOYEE');
  requireValue_(['FULL', 'HALF', 'ABSENT', 'UNMARKED'].indexOf(payload.status) >= 0, 'INVALID_STATUS');
  requireValue_(Number.isSafeInteger(payload.expectedRevision) && payload.expectedRevision >= 0, 'INVALID_REVISION');
  requireValue_(typeof payload.requestId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.requestId), 'INVALID_REQUEST_ID');
  return { dateKey: payload.dateKey, employeeId: payload.employeeId, status: payload.status,
    expectedRevision: payload.expectedRevision, requestId: payload.requestId };
}

function fingerprint_(data) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(data), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function cells_(values) {
  return values.map(function (v) {
    if (typeof v === 'number') {
      requireValue_(Number.isFinite(v), 'INVALID_NUMBER');
      return { userEnteredValue: { numberValue: v } };
    }
    // Explicit stringValue prevents formula injection, including leading '='.
    return { userEnteredValue: { stringValue: String(v === undefined || v === null ? '' : v) } };
  });
}

function append_(sheet, values) {
  return { appendCells: { sheetId: sheet.getSheetId(), rows: [{ values: cells_(values) }], fields: 'userEnteredValue' } };
}

function publicRow_(row) {
  var value = {};
  ATTENDANCE_HEADERS_.forEach(function (h) { value[h] = row[h]; });
  return value;
}

function getDay(date) {
  owner_();
  dateKey_(date);
  return locked_(function () {
    var ss = spreadsheet_();
    var month = date.slice(0, 7);
    var monthState = monthState_(ss, month);
    var calendar = calendar_(ss);
    var dayRows = table_(ss, 'Attendance_' + suffix_(month), ATTENDANCE_HEADERS_).rows.filter(function (r) { return r.dateKey === date; });
    var seen = new Set();
    dayRows.forEach(function (r) {
      requireValue_(r.key === date + '|' + r.employeeId && !seen.has(r.key), 'DUPLICATE_KEY');
      requireValue_(['FULL', 'HALF', 'ABSENT', 'UNMARKED'].indexOf(r.status) >= 0 && Number.isSafeInteger(r.revision) && r.revision > 0, 'INVALID_DATA');
      seen.add(r.key);
    });
    var people = table_(ss, 'Employees', EMPLOYEE_HEADERS_).rows;
    var ids = new Set();
    people.forEach(function (e) { validateEmployeeDates_(e); requireValue_(!ids.has(e.employeeId), 'DUPLICATE_KEY'); ids.add(e.employeeId); });
    requireValue_(dayRows.every(function (r) { return ids.has(r.employeeId); }), 'ORPHAN_ATTENDANCE');
    return { dateKey: date, serverToday: bangkokToday_(), isClosed: monthState.state === 'CLOSED',
      isWorkday: date >= calendar.startDate && isWorkday_(date, calendar.weekdays, calendar.overrides),
      employees: people.filter(function (e) { return employedOn_(e, date); }).map(function (e) {
        return { employeeId: e.employeeId, name: e.name, nickname: e.nickname, position: e.position, photoVersion: e.photoVersion };
      }), attendance: dayRows.map(publicRow_) };
  });
}

function saveAttendance(payload) {
  var actor = owner_();
  var data = normalizeAttendance_(payload);
  return locked_(function () {
    var ss = spreadsheet_();
    var month = data.dateKey.slice(0, 7);
    var tag = suffix_(month);
    var fingerprint = fingerprint_(data);
    var requests = table_(ss, 'Requests_' + tag, REQUEST_HEADERS_);
    var receipt = unique_(requests.rows, 'requestId', data.requestId);
    if (receipt) {
      requireValue_(receipt.fingerprint === fingerprint, 'REQUEST_ID_REUSED');
      return JSON.parse(receipt.responseJson);
    }
    requireValue_(monthState_(ss, month).state === 'OPEN', 'MONTH_CLOSED');
    requireValue_(data.dateKey <= bangkokToday_(), 'FUTURE_ATTENDANCE');
    var employee = unique_(table_(ss, 'Employees', EMPLOYEE_HEADERS_).rows, 'employeeId', data.employeeId);
    requireValue_(employee, 'EMPLOYEE_NOT_FOUND');
    validateEmployeeDates_(employee);
    requireValue_(employedOn_(employee, data.dateKey), 'OUTSIDE_EMPLOYMENT');
    var calendar = calendar_(ss);
    requireValue_(data.dateKey >= calendar.startDate, 'BEFORE_SYSTEM_START');
    requireValue_(data.status === 'UNMARKED' || isWorkday_(data.dateKey, calendar.weekdays, calendar.overrides), 'ATTENDANCE_ON_HOLIDAY');
    var attendance = table_(ss, 'Attendance_' + tag, ATTENDANCE_HEADERS_);
    var key = data.dateKey + '|' + data.employeeId;
    var before = unique_(attendance.rows, 'key', key);
    requireValue_(!before || (before.dateKey === data.dateKey && before.employeeId === data.employeeId &&
      Number.isSafeInteger(before.revision) && before.revision > 0), 'INVALID_DATA');
    var revision = before ? before.revision : 0;
    requireValue_(revision === data.expectedRevision, 'CONFLICT');
    var timestamp = new Date().toISOString();
    var after = { key: key, dateKey: data.dateKey, employeeId: data.employeeId, status: data.status,
      revision: revision + 1, updatedAt: timestamp, updatedBy: actor, requestId: data.requestId };
    var response = { ok: true, attendance: after };
    var values = ATTENDANCE_HEADERS_.map(function (h) { return after[h]; });
    var change = before ? { updateCells: { start: { sheetId: attendance.sheet.getSheetId(), rowIndex: before.rowNumber - 1, columnIndex: 0 },
      rows: [{ values: cells_(values) }], fields: 'userEnteredValue' } } : append_(attendance.sheet, values);
    var audit = table_(ss, 'Audit_' + tag, AUDIT_HEADERS_);
    Sheets.Spreadsheets.batchUpdate({ requests: [change,
      append_(audit.sheet, [Utilities.getUuid(), key, JSON.stringify(before ? publicRow_(before) : null), JSON.stringify(after), timestamp, actor, data.requestId]),
      append_(requests.sheet, [data.requestId, fingerprint, JSON.stringify(response), timestamp])
    ] }, ss.getId());
    return response;
  });
}
