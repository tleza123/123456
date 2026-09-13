'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const base = __dirname;
let passed = 0;
function test(name, run) { run(); passed++; process.stdout.write(`PASS ${name}\n`); }
const ctx = vm.createContext({ Date, Map, Set, JSON, Number, Object, Array, String, Math, Error });
vm.runInContext(fs.readFileSync(path.join(base,'Payroll.gs'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(base,'AttendanceService.gs'),'utf8'),ctx);
const plain = value => JSON.parse(JSON.stringify(value));
const fixture = () => ({month:'2026-09',today:'2026-09-30',systemStartDate:'2026-09-01',employee:{employeeId:'e1',startDate:'2026-09-01',endDate:''},rates:[{employeeId:'e1',effectiveFrom:'2026-09-01',dailySatang:50000}],attendance:[],extras:[],weekdays:[0,1,2,3,4,5,6],calendar:{}});
const marks = (days,status,start=1) => Array.from({length:days},(_,i)=>({employeeId:'e1',dateKey:`2026-09-${String(start+i).padStart(2,'0')}`,status}));
test('22 full + 4 half + 2 absent + monthly extras = 14,500 THB',()=>{
  const f=fixture(); f.employee.endDate='2026-09-28'; f.attendance=[...marks(22,'FULL'),...marks(4,'HALF',23),...marks(2,'ABSENT',27)];
  f.extras=[{employeeId:'e1',monthKey:f.month,extraId:'x1',label:'ค่าเดินทาง',amountSatang:150000},{employeeId:'e1',monthKey:f.month,extraId:'x2',label:'ค่าอาหาร',amountSatang:100000}];
  const r=ctx.calculateEmployeeMonth_(f); assert.equal(r.totalSatang,1450000); assert.equal(r.paidDayUnits,24);assert.equal(r.workedDays,26);assert.equal(r.absent,2);assert.equal(r.pending,0);
});
test('historical rates calculate each day, including half-days',()=>{
  const f=fixture();f.rates.push({employeeId:'e1',effectiveFrom:'2026-09-11',dailySatang:55000});f.attendance=[...marks(20,'FULL'),...marks(2,'HALF',21)];assert.equal(ctx.calculateEmployeeMonth_(f).baseSatang,1105000);
});
test('half satang rounds up per day',()=>assert.equal(ctx.dailyPay_('HALF',50001),25001));
test('strict money decimal conversion',()=>{assert.equal(ctx.moneySatang_('500.01'),50001);assert.equal(ctx.moneySatang_('0.1'),10);for(const bad of ['1e6','NaN','-1','0.001','1,000',' 500','01','Infinity','1000000.01'])assert.throws(()=>ctx.moneySatang_(bad));});
test('leap year and invalid date',()=>{assert.equal(ctx.monthDates_('2024-02').length,29);assert.equal(ctx.monthDates_('2026-02').length,28);assert.throws(()=>ctx.dateKey_('2026-02-29'));assert.throws(()=>ctx.dateKey_('2026-09-31'));});
test('unmarked days are pending, holidays and future days are excluded',()=>{
  const f=fixture();f.today='2026-09-03';f.calendar={'2026-09-02':'HOLIDAY'};const r=ctx.calculateEmployeeMonth_(f);assert.equal(r.pending,2);assert.equal(r.absent,0);assert.equal(r.days.find(x=>x.dateKey==='2026-09-02').amountSatang,null);
});
test('employment dates and system start bound pending days',()=>{const f=fixture();f.employee.startDate='2026-09-10';f.employee.endDate='2026-09-12';assert.equal(ctx.calculateEmployeeMonth_(f).pending,3);f.systemStartDate='2026-09-11';assert.equal(ctx.calculateEmployeeMonth_(f).pending,2);});
test('duplicate attendance, rates and extras fail closed',()=>{
  let f=fixture();f.attendance=[...marks(1,'FULL'),...marks(1,'HALF')];assert.throws(()=>ctx.calculateEmployeeMonth_(f),/DUPLICATE_ATTENDANCE/);
  f=fixture();f.rates.push({...f.rates[0]});assert.throws(()=>ctx.calculateEmployeeMonth_(f),/DUPLICATE_RATE/);
  f=fixture();const x={extraId:'x',employeeId:'e1',monthKey:f.month,label:'ค่ารถ',amountSatang:100};f.extras=[x,x];assert.throws(()=>ctx.calculateEmployeeMonth_(f),/DUPLICATE_EXTRA/);
});
test('missing rate never silently becomes zero',()=>{const f=fixture();f.attendance=marks(1,'FULL');f.rates=[];assert.throws(()=>ctx.calculateEmployeeMonth_(f),/MISSING_RATE/);});
test('holiday and future attendance are rejected',()=>{const f=fixture();f.attendance=marks(1,'FULL');f.calendar={'2026-09-01':'HOLIDAY'};assert.throws(()=>ctx.calculateEmployeeMonth_(f),/ATTENDANCE_ON_HOLIDAY/);f.calendar={};f.today='2026-08-31';assert.throws(()=>ctx.calculateEmployeeMonth_(f),/FUTURE_ATTENDANCE/);});
test('monthly bonus remains whole for partial-month employment',()=>{const f=fixture();f.employee.startDate='2026-09-30';f.extras=[{employeeId:'e1',monthKey:f.month,extraId:'x',label:'ค่าอาหาร',amountSatang:100000}];assert.equal(ctx.calculateEmployeeMonth_(f).extraSatang,100000);});

// Minimal fake services execute the actual endpoint logic. This does NOT
// validate Google identity availability, real atomicity, latency, or quotas.
let database, activeEmail, locked, canLock, batches, injectedFailure;
const objectRows=(headers,objects)=>[plain(headers),...objects.map(o=>headers.map(h=>o[h]??''))];
function setup(){
  activeEmail='owner@example.invalid';locked=false;canLock=true;batches=0;injectedFailure=false;
  database={
    Employees:objectRows(ctx.EMPLOYEE_HEADERS_,[{employeeId:'e1',name:'ตัวอย่าง',position:'ช่าง',startDate:'2026-09-01',revision:1}]),
    Settings:[['key','value','revision','updatedAt'],['workweekJson','[0,1,2,3,4,5,6]',1,''],['calendarEffectiveFrom','2026-09-01',1,'']],
    WorkCalendar:[['dateKey','kind','note','revision','updatedAt']],
    MonthState:objectRows(ctx.MONTH_HEADERS_,[{monthKey:'2026-09',state:'OPEN',revision:1}]),
    Attendance_2026_09:objectRows(ctx.ATTENDANCE_HEADERS_,[]),Requests_2026_09:objectRows(ctx.REQUEST_HEADERS_,[]),Audit_2026_09:objectRows(ctx.AUDIT_HEADERS_,[])
  };
}
const sheetId=name=>Object.keys(database).indexOf(name)+1;
const sheet=name=>({getSheetId:()=>sheetId(name),getDataRange:()=>({getValues:()=>plain(database[name])})});
ctx.PropertiesService={getScriptProperties:()=>({getProperty:key=>({OWNER_EMAIL:'owner@example.invalid',SPREADSHEET_ID:'test-id'}[key])})};
ctx.Session={getActiveUser:()=>({getEmail:()=>activeEmail})};
ctx.SpreadsheetApp={openById:()=>({getSheetByName:name=>database[name]?sheet(name):null,getId:()=>'test-id'})};
ctx.LockService={getScriptLock:()=>({tryLock:()=>{if(!canLock)return false;assert.equal(locked,false);locked=true;return true;},releaseLock:()=>{assert.equal(locked,true);locked=false;}})};
ctx.Utilities={formatDate:()=>'2026-09-14',getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(alg,text)=>Array.from(crypto.createHash(alg).update(text).digest())};
ctx.Sheets={Spreadsheets:{batchUpdate:({requests})=>{
  assert.equal(locked,true); const copy=plain(database);
  for(const request of requests){const update=request.updateCells||request.appendCells;const id=update.sheetId??update.start.sheetId;const name=Object.keys(database)[id-1];const values=update.rows[0].values.map(c=>c.userEnteredValue.stringValue??c.userEnteredValue.numberValue);if(request.updateCells)copy[name][update.start.rowIndex]=values;else copy[name].push(values);}
  if(injectedFailure)throw new Error('INJECTED_BATCH_FAILURE');database=copy;batches++;
}}};
const command=(overrides={})=>({dateKey:'2026-09-14',employeeId:'e1',status:'FULL',expectedRevision:0,requestId:crypto.randomUUID(),...overrides});
test('getDay returns scoped employees and records',()=>{setup();const r=ctx.getDay('2026-09-14');assert.equal(r.employees.length,1);assert.equal(r.isClosed,false);assert.equal(r.isWorkday,true);assert.equal(locked,false);});
test('data, audit and receipt written in one batch',()=>{setup();const r=ctx.saveAttendance(command());assert.equal(r.attendance.revision,1);assert.equal(batches,1);assert.equal(database.Attendance_2026_09.length,2);assert.equal(database.Audit_2026_09.length,2);assert.equal(database.Requests_2026_09.length,2);assert.equal(locked,false);});
test('retry after a lost response returns same receipt without extra write',()=>{setup();const cmd=command();const a=ctx.saveAttendance(cmd);const b=ctx.saveAttendance(cmd);assert.deepEqual(plain(a),plain(b));assert.equal(batches,1);});
test('requestId reuse with changed payload is rejected',()=>{setup();const cmd=command();ctx.saveAttendance(cmd);assert.throws(()=>ctx.saveAttendance({...cmd,status:'HALF'}),/REQUEST_ID_REUSED/);assert.equal(batches,1);});
test('stale second tab cannot overwrite first tab',()=>{setup();ctx.saveAttendance(command());assert.throws(()=>ctx.saveAttendance(command({status:'HALF'})),/CONFLICT/);assert.equal(database.Attendance_2026_09[1][3],'FULL');assert.equal(locked,false);});
test('clear is a versioned record and does not delete history',()=>{setup();ctx.saveAttendance(command());ctx.saveAttendance(command({status:'UNMARKED',expectedRevision:1}));assert.equal(database.Attendance_2026_09.length,2);assert.equal(database.Attendance_2026_09[1][4],2);assert.equal(database.Audit_2026_09.length,3);});
test('closed month rejects new mutation but honors old receipt',()=>{setup();const cmd=command();const r=ctx.saveAttendance(cmd);database.MonthState[1][1]='CLOSED';assert.throws(()=>ctx.saveAttendance(command({expectedRevision:1})),/MONTH_CLOSED/);assert.deepEqual(plain(ctx.saveAttendance(cmd)),plain(r));});
test('empty and unapproved identities denied on every public endpoint',()=>{setup();for(const email of ['', 'other@example.invalid']){activeEmail=email;assert.throws(()=>ctx.getDay('2026-09-14'),/AUTH_REQUIRED/);assert.throws(()=>ctx.saveAttendance(command()),/AUTH_REQUIRED/);}assert.equal(batches,0);});
test('invalid fields, dates, status, employee and future dates rejected',()=>{setup();for(const extra of [{injected:true},{dateKey:'2026-09-31'},{status:'LATE'},{employeeId:'unknown'},{dateKey:'2026-09-15'}])assert.throws(()=>ctx.saveAttendance(command(extra)));assert.equal(batches,0);});
test('busy lock returns without mutation',()=>{setup();canLock=false;assert.throws(()=>ctx.saveAttendance(command()),/BUSY/);assert.equal(batches,0);});
test('failed batch retains all original data and releases lock',()=>{setup();const before=plain(database);injectedFailure=true;assert.throws(()=>ctx.saveAttendance(command()),/INJECTED_BATCH_FAILURE/);assert.deepEqual(plain(database),before);assert.equal(locked,false);});
test('duplicate keys and malformed schema are rejected',()=>{setup();ctx.saveAttendance(command());database.Attendance_2026_09.push([...database.Attendance_2026_09[1]]);assert.throws(()=>ctx.saveAttendance(command()),/DUPLICATE_KEY/);setup();database.Employees[0][0]='renamed';assert.throws(()=>ctx.getDay('2026-09-14'),/SCHEMA_MISMATCH/);});
test('formula-like user text is written as an explicit string',()=>{const cell=ctx.cells_(['=IMPORTXML("x","y")'])[0];assert.equal(cell.userEnteredValue.stringValue,'=IMPORTXML("x","y")');assert.equal(cell.userEnteredValue.formulaValue,undefined);});
test('all embedded JavaScript parses and manifest is valid',()=>{
  for(const filename of ['mockup.fragment.html','ClientBridge.html']){const text=fs.readFileSync(path.join(base,filename),'utf8');for(const match of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(match[1],{filename});}
  const manifest=JSON.parse(fs.readFileSync(path.join(base,'appsscript.json'),'utf8'));assert.equal(manifest.timeZone,'Asia/Bangkok');assert.equal(manifest.dependencies.enabledAdvancedServices[0].serviceId,'sheets');
});
process.stdout.write(`\n${passed} tests passed. Mock services only; Google deployment and device QA remain.\n`);
