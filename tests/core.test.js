const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../analysis-web/static/core');
const metric = {field:'weight',rankMode:'lower'};
const rows = [{id:'a',fields:{weight:100}}, {id:'b',fields:{weight:100}}, {id:'c',fields:{weight:120}}];
test('same values have equal rank',()=>{
  assert.equal(C.rank(rows[0],rows,metric).position,C.rank(rows[1],rows,metric).position);
  assert.match(C.rank(rows[0],rows,metric).text,/并列/);
});
test('a selected record outside reference never receives rank zero',()=>{
  assert.equal(C.rank({id:'outside',fields:{weight:90}},rows,metric).text,'参考范围外');
});
test('benchmark uses per-metric sample count and needs three valid values',()=>{
  const s=C.summary([{id:'a',fields:{weight:100}},{id:'b',fields:{}},{id:'c',fields:{weight:null}}],metric);
  assert.equal(s.n,1);assert.equal(s.median,null);
  assert.equal(C.summary(rows,metric).median,100);
});
test('missing is not zero but a measured zero remains valid',()=>{
  assert.equal(C.numeric(''),null);assert.equal(C.numeric('  '),null);assert.equal(C.numeric(null),null);assert.equal(C.numeric(false),null);
  assert.equal(C.numeric(0),0);assert.equal(C.numeric('8,3'),null);
});
test('selection supports twelve and never silently evicts an existing record',()=>{
  let ids=[];for(let i=0;i<12;i++)ids=C.select(ids,String(i)).ids;
  const overflow=C.select(ids,'13');assert.equal(overflow.full,true);assert.deepEqual(overflow.ids,ids);
  assert.equal(C.select(ids,'3').ids.length,11);
});
test('derived metrics preserve missingness',()=>{
  const derived={field:'average',sourceFields:['left','right']};
  assert.equal(C.value({fields:{}},derived),null);
  assert.equal(C.value({fields:{left:10,right:20}},derived),15);
});
test('radar score is relative and handles equal reference values',()=>{
  assert.equal(C.score(rows[0],metric,rows),100);assert.equal(C.score(rows[2],metric,rows),0);
  const same=rows.map(r=>({...r,fields:{weight:10}}));assert.equal(C.score(same[0],metric,same),50);
});
