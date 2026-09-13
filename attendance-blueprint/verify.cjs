'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const base = __dirname;
let passed = 0;
function test(name, run) { run(); passed++; process.stdout.write(`PASS ${name}\n`); }
const ctx = require('./payroll-core.cjs');
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


for (const filename of ['mockup.fragment.html', 'preview.html']) {
  const source = fs.readFileSync(path.join(base, filename), 'utf8');
  for (const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1], { filename });
}
for (const filename of ['firebase.json', 'firestore.indexes.json']) {
  JSON.parse(fs.readFileSync(path.join(base, 'reference-config', filename), 'utf8'));
}
process.stdout.write(`${passed} payroll tests passed; preview JavaScript and reference JSON parse. Firebase integration is not tested.\n`);
