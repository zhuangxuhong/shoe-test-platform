'use strict';
const $ = id => document.getElementById(id), C = ShoeCore;
const PALETTE = ['#128675','#5789b6','#cc9860','#9870aa','#c97679','#8aa24e','#54a9b5','#7889c8','#bca44e','#bd839b','#6f9a85','#b58064'];
const STORAGE = 'shoe-lab-preview.v1', PRESETS = 'shoe-lab-preview.presets.v1';
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = v => Array.isArray(v) ? v.map(text).join('、') : v && typeof v === 'object' ? v.name || '' : String(v ?? '').trim();
const list = v => Array.isArray(v) ? v.map(text) : text(v).split(/[、,;；]/).filter(Boolean);
const format = v => v === null || v === undefined ? '—' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
const signed = v => v === null ? '—' : `${v > 0 ? '+' : ''}${format(v)}`;
function readStorage(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function writeStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Preview also works when storage is blocked. */ } }
const saved = readStorage(STORAGE, {});
const state = { query:'', category:'跑鞋', brands:[], tags:[], ranges:[], selected:[], radar:[], baseline:'', view:'metric', group:'core', metric:'整鞋重量(g)', scope:'filtered', listSort:'complete', chartSort:'asc', onlySelected:false, ...saved, page:1 };
for (const key of ['brands','tags','ranges','selected','radar']) if (!Array.isArray(state[key])) state[key] = [];
if (!['metric','radar','table'].includes(state.view)) state.view = 'metric';
let config, records = [], fields = [], metrics = [], filtered = [], nameCounts = new Map(), bar, radar, toastTimer, loading = false, firstLoad = true;
let colors = {}, sortTable = {field:'',direction:1};
let presets = readStorage(PRESETS, []); if (!Array.isArray(presets)) presets=[];
const GROUPS = {core:'常用核心指标',size:'重量与尺寸',cushion:'缓震与回弹',structure:'弯折与扭转',biomechanics:'生物力学',metabolic:'代谢指标',all:'全部指标'};
function notify(message) { $('toast').textContent=message; $('toast').classList.remove('hidden'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),3800); }
function persist() { writeStorage(STORAGE, state); }
function currentMetric() { return metrics.find(m => m.field === state.metric) || metrics[0]; }
function selectedRecords() { return state.selected.map(id=>records.find(r=>r.id===id)).filter(Boolean); }
function baselineRecord() { return records.find(r=>r.id===state.baseline) || selectedRecords()[0]; }
function color(id) {
  if (!colors[id]) { const used=state.selected.filter(x=>x!==id).map(x=>colors[x]); colors[id]=PALETTE.find(c=>!used.includes(c)) || PALETTE[state.selected.indexOf(id)%12]; }
  return colors[id];
}
function reference() {
  if (state.scope === 'category') { const base=baselineRecord(); return base ? records.filter(r=>r.category===base.category) : []; }
  return filtered;
}
function referenceName() { return state.scope==='category' ? `基准同品类 · ${baselineRecord()?.category || '未分类'}` : '当前筛选'; }
function groupMetrics(group=state.group) {
  return metrics.filter(m=>group==='all' || (group==='core' ? (config.metrics || []).some(x=>x.field===m.field) : m.group===group));
}
function metricOptions(items=metrics) { return items.map(m=>`<option value="${escape(m.field)}">${escape(m.label)}${m.unit?` (${escape(m.unit)})`:''}</option>`).join(''); }
function makeMetrics() {
  const hidden=new Set(Object.entries(config.metricRankModes || {}).filter(([,v])=>v==='hidden').map(([k])=>k));
  const definitions=[...(config.metrics || []), ...(config.derivedMetrics || [])];
  const names=[...new Set([...definitions.map(m=>m.field), ...fields.filter(f=>f.type==='number').map(f=>f.name)])].filter(n=>!hidden.has(n)&&!['落锤ID','扭转ID'].includes(n));
  metrics=names.map(name=>{
    const definition=definitions.find(m=>m.field===name) || {};
    let group='biomechanics';
    if (/重量|高度|宽度|落差|起翘/.test(name)) group='size';
    else if (/减震|回弹|压缩|峰值力/.test(name)) group='cushion';
    else if (/扭转|弯折|__derived/.test(name)) group='structure';
    else if (/耗氧|能量消耗|心率/.test(name)) group='metabolic';
    return {field:name,label:name.replace(/[（(].*?[）)]/g,''),unit:(name.match(/[（(](.*?)[）)]/)||[])[1]||'',rankMode:config.metricRankModes?.[name]||'neutral',...definition,group};
  });
}
function matches(r) {
  if (state.category && r.category!==state.category) return false;
  if (state.brands.length && !state.brands.includes(r.brand)) return false;
  const query=String(state.query).trim().toLocaleLowerCase();
  if (query && !r.search.includes(query)) return false;
  const groups=new Map();
  for(const t of state.tags) groups.set(t.field,[...(groups.get(t.field)||[]),t.name]);
  for(const [field,tags] of groups) if(!tags.some(t=>list(r.fields[field]).includes(t))) return false;
  for(const condition of state.ranges) {
    if(condition.min===''&&condition.max==='') continue;
    const metric=metrics.find(m=>m.field===condition.field), n=C.value(r,metric);
    if(n===null || (condition.min!==''&&n<Number(condition.min)) || (condition.max!==''&&n>Number(condition.max))) return false;
  }
  return true;
}
function applyFilters(resetPage=true) {
  if(!config) return;
  if(resetPage) state.page=1;
  filtered=records.filter(matches);
  $('secondaryCount').textContent=state.tags.length ? `${state.tags.length} 项` : '全部';
  $('secondaryDescription').textContent=state.category ? `${state.category} · 同组内满足任意一个，组间同时满足` : '请先选择一级品类';
  $('applySecondary').textContent=`查看 ${filtered.length} 条结果`;
  const n=state.tags.length+state.ranges.filter(c=>c.min!==''||c.max!=='').length;
  $('extraCount').textContent=n; $('extraCount').classList.toggle('hidden',!n);
  $('applyFilters').textContent=`查看 ${filtered.length} 条结果`;
  renderFilterChips(); renderCatalog(); renderDock(); renderAnalysis(); persist();
}
function renderFilterChips() {
  const chips=[];
  if(state.query) chips.push(['query',0,`搜索：${state.query}`]);
  if(state.category) chips.push(['category',0,state.category]);
  state.brands.forEach((b,i)=>chips.push(['brand',i,b]));
  state.tags.forEach((t,i)=>chips.push(['tag',i,t.name]));
  state.ranges.forEach((c,i)=>{if(c.min!==''||c.max!=='') chips.push(['range',i,`${metrics.find(m=>m.field===c.field)?.label || c.field} ${c.min!==''?`≥ ${c.min}`:''}${c.min!==''&&c.max!==''?' 且 ':''}${c.max!==''?`≤ ${c.max}`:''}`]);});
  $('activeFilters').innerHTML=chips.length ? chips.map(([kind,index,label])=>`<button class="filter-chip" data-kind="${kind}" data-index="${index}" aria-label="移除筛选 ${escape(label)}">${escape(label)} <span>×</span></button>`).join('')+'<button class="clear-filters" data-clear="true">清除筛选</button>' : '<span class="filter-hint">全部测试记录 · 使用品牌、品类或数值条件缩小范围</span>';
}
function renderCatalog() {
  let shown=filtered.filter(r=>!state.onlySelected||state.selected.includes(r.id));
  shown.sort((a,b)=>state.listSort==='name' ? a.name.localeCompare(b.name,'zh-CN') : state.listSort==='date' ? (Date.parse(b.date)||0)-(Date.parse(a.date)||0) : state.listSort==='weight' ? (C.numeric(a.fields['整鞋重量(g)'])??Infinity)-(C.numeric(b.fields['整鞋重量(g)'])??Infinity) : b.complete-a.complete || a.name.localeCompare(b.name,'zh-CN'));
  const pages=Math.max(1,Math.ceil(shown.length/30)); state.page=Math.max(1,Math.min(pages,state.page));
  const page=shown.slice((state.page-1)*30,state.page*30);
  $('recordList').innerHTML=page.length ? page.map(r=>{
    const active=state.selected.includes(r.id);
    return `<button class="record-card ${active?'selected':''}" data-record="${escape(r.id)}" aria-pressed="${active}" aria-label="${active?'移出':'选入'} ${escape(r.name)} ${escape(r.uid)}"><span class="select-square">✓</span><span class="record-main"><strong title="${escape(r.name)}">${escape(r.name)}</strong><span class="record-meta">${escape(r.brand||'未填品牌')} · ${escape(r.uid)} · ${escape(r.date?r.date.slice(0,10):'未填日期')}</span><span class="record-bottom"><span>${format(C.numeric(r.fields['整鞋重量(g)']))} g</span>${nameCounts.get(r.name)>1?`<span class="repeat-label">同名 ${nameCounts.get(r.name)} 次</span>`:''}<span class="completeness">核心 ${r.complete}/${config.metrics.length}</span></span></span></button>`;
  }).join('') : '<div class="no-results"><strong>没有符合条件的记录</strong>试着放宽数值范围或移除部分筛选。<br>已选记录仍保留在底部对比栏。</div>';
  $('pageInfo').textContent=`${shown.length} 条 · ${state.page} / ${pages} 页`;
  $('prevPage').disabled=state.page<=1; $('nextPage').disabled=state.page>=pages;
  $('catalogSelected').textContent=state.selected.length;
  $('addVisible').disabled=!page.length || state.selected.length>=12;
}
function renderDock() {
  if(state.dockCollapsed)$('toggleDock').textContent=`展开对比栏 · ${state.selected.length} 条 ↑`;
  $('dockCount').innerHTML=`${state.selected.length}<span>/ 12</span>`;
  const ids=new Set(filtered.map(r=>r.id));
  $('dockChips').innerHTML=selectedRecords().map(r=>`<div class="dock-chip ${ids.has(r.id)?'':'outside'}"><i class="color-dot" style="background:${color(r.id)}"></i><div><strong title="${escape(r.name)}">${escape(r.name)}</strong><small>${escape(r.uid)}${ids.has(r.id)?'':' · 筛选范围外'}</small></div><button data-remove="${escape(r.id)}" aria-label="移除 ${escape(r.name)}">×</button></div>`).join('') || '<span class="muted">点击鞋款卡片加入对比，最多 12 条</span>';
  $('clearSelection').disabled=!state.selected.length; $('export').disabled=!state.selected.length;
}
function selectionChanged() {
  state.radar=state.radar.filter(id=>state.selected.includes(id));
  if(!state.selected.includes(state.baseline)) state.baseline=state.selected[0]||'';
  renderCatalog(); renderDock(); renderAnalysis(); persist();
}
function toggleRecord(id) {
  const result=C.select(state.selected,id);
  if(result.full) return notify('最多同时对比 12 条。请先移除一条，已选记录不会被自动替换。');
  const adding=!state.selected.includes(id);
  state.selected=result.ids;
  if(adding&&state.radar.length<6) state.radar.push(id);
  selectionChanged();
}
function renderMetricSelector() {
  if(!GROUPS[state.group]) state.group='core';
  $('metricGroup').innerHTML=Object.entries(GROUPS).map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
  $('metricGroup').value=state.group;
  const options=groupMetrics();
  if(!options.some(m=>m.field===state.metric)) state.metric=options[0]?.field || metrics[0]?.field;
  $('metric').innerHTML=metricOptions(options); $('metric').value=state.metric;
}
function renderAnalysis() {
  if(!config) return;
  const selected=selectedRecords(), metric=currentMetric(), scope=reference(), summary=C.summary(scope,metric), base=baselineRecord();
  $('selectionCount').textContent=`${selected.length} 条记录`;
  $('baseline').innerHTML=selected.map(r=>`<option value="${escape(r.id)}">${escape(r.name)} · ${escape(r.uid)}</option>`).join('') || '<option>请先选鞋</option>';
  $('baseline').value=base?.id || ''; $('scope').value=state.scope;
  $('emptyState').classList.toggle('hidden',!!selected.length); $('analysisContent').classList.toggle('hidden',!selected.length);
  document.querySelectorAll('.tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-selected',b.dataset.view===state.view);});
  ['metric','radar','table'].forEach(view=>$(view+'View').classList.toggle('hidden',state.view!==view));
  $('analysis').classList.toggle('radar-mode',state.view==='radar');
  if(!selected.length) return;
  const measured=selected.filter(r=>C.value(r,metric)!==null).length;
  const cards=[['筛选结果',filtered.length,'条','每条代表一次测试记录'],['参与对比',selected.length,'条',`${measured} 条有当前指标数据`],['参考中位数',format(summary.median),metric.unit,`${referenceName()} · 有效 n=${summary.n}`],['基准数值',format(C.value(base,metric)),metric.unit,`${base?.name || '未选'} · ${base?.uid || ''}`]];
  $('summaryCards').innerHTML=cards.map(([label,v,unit,note])=>`<div class="summary-card"><span class="label">${escape(label)}</span><span class="number">${escape(v)}</span><span class="unit">${escape(unit)}</span><span class="footnote" title="${escape(note)}">${escape(note)}</span></div>`).join('');
  if(state.view==='metric') renderBar(selected,metric,scope,summary,base);
  else if(state.view==='radar') renderRadar(selected,scope);
  else renderTable(selected);
}
function renderBar(selected,metric,scope,summary,base) {
  const values=selected.filter(r=>C.value(r,metric)!==null);
  if(state.chartSort!=='selected') values.sort((a,b)=>(C.value(a,metric)-C.value(b,metric))*(state.chartSort==='asc'?1:-1));
  $('chartTitle').textContent=`${metric.label}${metric.unit?` · ${metric.unit}`:''}`;
  $('chartSubtitle').textContent=`${referenceName()}：${scope.length} 条记录 / ${summary.n} 个有效值`;
  $('barChart').style.height=`${Math.max(230,values.length*45+55)}px`;
  if(!bar) bar=echarts.init($('barChart'), null, {renderer:'svg'});
  const showLine=summary.median!==null;
  bar.setOption({textStyle:{fontFamily:'Microsoft YaHei, Segoe UI, sans-serif'},animationDuration:240,grid:{left:window.innerWidth<801?140:215,right:90,top:45,bottom:36,containLabel:false},tooltip:{trigger:'axis',axisPointer:{type:'shadow'},confine:true,textStyle:{fontSize:14,color:'#243b32'},formatter:items=>{const item=items[0],r=values[item.dataIndex];return r?`${escape(r.name)} · ${escape(r.uid)}<br>${escape(metric.label)}：${format(item.value)} ${escape(metric.unit)}<br>${escape(C.rank(r,scope,metric).text)}`:'';}},xAxis:{type:'value',axisLabel:{fontSize:13,color:'#52615c'},splitLine:{lineStyle:{color:'#edf1e9',type:'dashed'}},axisLine:{show:false}},yAxis:{type:'category',inverse:true,data:values.map(r=>r.name),axisTick:{show:false},axisLine:{show:false},axisLabel:{color:'#263d35',fontSize:window.innerWidth<801?12:14,width:window.innerWidth<801?130:200,overflow:'truncate'}},series:[{type:'bar',barWidth:24,data:values.map(r=>({value:C.value(r,metric),itemStyle:{color:color(r.id),borderRadius:[0,4,4,0],opacity:r.id===base?.id?1:.82}})),label:{show:true,position:'right',fontSize:14,fontWeight:600,color:'#263d35',formatter:p=>format(p.value)},markLine:showLine?{silent:true,symbol:'none',lineStyle:{color:'#a6b39c',type:'dashed'},label:{show:true,position:'start',distance:10,rotate:0,color:'#52654d',fontSize:12,formatter:`中位数 ${format(summary.median)}${metric.unit?' '+metric.unit:''}`},data:[{xAxis:summary.median}]}:undefined}],graphic:values.length?[]:[{type:'text',left:'center',top:'middle',style:{text:'所选记录尚无此指标数据\n可切换指标，或选择其他测试记录',fontSize:13,fill:'#8d9d82',textAlign:'center',lineHeight:26}}]},true);
  bar.resize();
  const baseValue=C.value(base,metric);
  $('differenceTable').innerHTML=`<table><thead><tr><th>测试记录</th><th>原始数值</th><th>相对基准</th><th>参考排名</th></tr></thead><tbody>${values.concat(selected.filter(r=>C.value(r,metric)===null)).map(r=>{
    const v=C.value(r,metric), diff=v===null||baseValue===null?null:v-baseValue, pct=diff===null||baseValue===0?null:diff/Math.abs(baseValue)*100;
    return `<tr><td><i class="color-dot" style="background:${color(r.id)}"></i>${escape(r.name)} <small>${escape(r.uid)}</small></td><td>${format(v)} <small>${escape(metric.unit)}</small></td><td class="${r.id===base?.id?'base-cell':''}">${r.id===base?.id?'基准':`<span class="delta ${diff<0?'negative':''}">${signed(diff)}</span> <small>${pct===null?'百分比不适用':`(${signed(pct)}%)`}</small>`}</td><td>${escape(C.rank(r,scope,metric).text)}</td></tr>`;
  }).join('')}</tbody></table>`;
}
function radarMetrics() {
  const preset=$('radarPreset').value;
  return metrics.filter(m=>preset==='core'?(config.metrics||[]).some(d=>d.field===m.field):preset==='cushion'?m.group==='cushion':['size','structure'].includes(m.group)).slice(0,8);
}
function renderRadar(selected,scope) {
  $('radarPicker').innerHTML=selected.map(r=>`<button class="radar-chip ${state.radar.includes(r.id)?'active':''}" data-radar="${escape(r.id)}" aria-pressed="${state.radar.includes(r.id)}"><i style="background:${color(r.id)}"></i>${escape(r.name)} <small>${escape(r.uid)}</small></button>`).join('');
  const highlighted=selected.filter(r=>state.radar.includes(r.id));
  const candidates=radarMetrics(), usable=candidates.filter(m=>C.summary(scope,m).n>=3&&highlighted.every(r=>C.value(r,m)!==null));
  if(!radar) radar=echarts.init($('radarChart'), null, {renderer:'svg'});
  const ready=highlighted.length>0 && usable.length>=3;
  radar.setOption(ready?{textStyle:{fontFamily:'Microsoft YaHei, Segoe UI, sans-serif'},animationDuration:240,tooltip:{trigger:'item',confine:true},legend:{show:false},radar:{indicator:usable.map(m=>({name:m.label,max:100})),radius:'74%',center:['50%','50%'],axisName:{fontSize:14,color:'#435b3d'},splitArea:{areaStyle:{color:['#fff','#f8faf5']}},splitLine:{lineStyle:{color:'#e2eadd'}},axisLine:{lineStyle:{color:'#e2eadd'}}},series:[{type:'radar',data:highlighted.map(r=>({name:`${r.name} · ${r.uid}`,value:usable.map(m=>C.score(r,m,scope)),lineStyle:{color:color(r.id),width:2},itemStyle:{color:color(r.id)},areaStyle:{color:color(r.id),opacity:.045}}))}],graphic:[]}:{series:[],graphic:[{type:'text',left:'center',top:'middle',style:{text:highlighted.length?'共同有效指标不足 3 项\n请选择数据更完整的记录或切换指标组合':'勾选左侧记录，最多突出 6 条',textAlign:'center',fontSize:13,lineHeight:27,fill:'#8a9b7d'}}]},true);
  radar.resize();
  const cats=new Set(scope.map(r=>r.category));
  const descriptions={weight:'整鞋质量，反映鞋款轻重。',heelHeight:'后跟部位的高度，反映鞋底厚度。',drop:'后跟与前掌的高度差，反映前后落差。',cushion:'后跟冲击测试的加速度值，较低表示该测试条件下传递的冲击较小。',rebound:'后跟测试的回弹读数，反映回弹表现。',peakForce:'冲击测试中的最大力值，反映峰值冲击。',torsionAvg:'左右扭转力矩有效值的算术平均；仅有一侧时使用该侧。较高表示更抗扭转。',flex:'弯折测试的力值，较高表示更难弯折，不直接代表更好。'};
  const describe=m=>descriptions[m.key] || (/重量/.test(m.label)?'部件质量，反映轻重。':/高度/.test(m.label)?'对应部位的高度尺寸。':/宽度/.test(m.label)?'对应部位的宽度尺寸。':/压缩/.test(m.label)?'受载测试中的压缩变形量。':/回弹速率/.test(m.label)?'测试中回弹过程的速度指标。':/起翘/.test(m.label)?'鞋底前部起翘的几何尺寸或位置。':'该项目的测试原始读数；具体测试条件以团队测试规范为准。');
  $('radarNote').innerHTML=`<section><h4>如何读图</h4><p>参考范围：${escape(referenceName())}，共 ${scope.length} 条记录。当前绘制 ${usable.length} 项指标，${candidates.length-usable.length} 项未绘制。${cats.size>1?'参考范围包含多个品类，可切换为“基准记录同品类”。':''}</p><p>高优、低优指标越靠外，越符合当前平台设定的优先方向；中性指标越靠外仅表示原始数值越大。方向沿用项目配置，不等于对所有使用者都更好。</p></section><section><h4>各指标含义与方向</h4><div class="guide-table"><table><thead><tr><th>指标 / 单位</th><th>当前方向</th><th>指标含义</th><th>参考数据</th><th>绘制状态</th></tr></thead><tbody>${candidates.map(m=>{const s=C.summary(scope,m),missing=highlighted.filter(r=>C.value(r,m)===null).length;return `<tr><td>${escape(m.label)}${m.unit?` (${escape(m.unit)})`:''}</td><td><span class="direction-tag">${m.rankMode==='lower'?'低优 ↓':m.rankMode==='higher'?'高优 ↑':'中性 ↔'}</span></td><td>${escape(describe(m))}</td><td>n=${s.n}<br>P5=${format(s.p5)} · P95=${format(s.p95)}</td><td>${s.n<3?'样本不足 3 条':missing?`${missing} 条记录缺失`:highlighted.length?'已绘制':'未选记录'}</td></tr>`;}).join('')}</tbody></table></div></section><section><h4>0–100 如何计算</h4><ol><li>对每项指标分别提取参考范围内的有效数据，升序排列，用线性插值计算第 5 百分位 P5 与第 95 百分位 P95。</li><li>先计算位置值 p = (原始值 − P5) ÷ (P95 − P5) × 100，再把 p 限定在 0–100 内。</li><li><strong>高优：得分 = p；低优：得分 = 100 − p；中性：位置值 = p。</strong>最终四舍五入为整数。例如 P5=100、P95=300、原始值=150，则 p=25，高优/中性显示 25，低优显示 75。</li><li>P5=P95 时统一显示 50；缺失值不记为 0。参考有效样本不足 3 条，或任一突出记录缺失时，整条指标轴不绘制；共同有效指标少于 3 项时不生成雷达图。</li></ol><p>0–100 是逐项归一化刻度，不是权重或百分位排名。各轴独立展示，未做加权求和，也不计算综合总分。更换参考范围会改变刻度；参考范围外记录可以按同一刻度展示，但不纳入该范围统计。</p></section>`;
}
function renderTable(selected) {
  const columns=groupMetrics(), base=baselineRecord(); let sorted=selected.slice();
  const sortMetric=metrics.find(m=>m.field===sortTable.field);
  if(sortMetric) sorted.sort((a,b)=>{const x=C.value(a,sortMetric),y=C.value(b,sortMetric);return x===null?y===null?0:1:y===null?-1:(x-y)*sortTable.direction;});
  $('detailTable').innerHTML=`<table><thead><tr><th>测试记录</th>${columns.map(m=>`<th><button data-sort="${escape(m.field)}">${escape(m.label)} ${sortTable.field===m.field?(sortTable.direction===1?'↑':'↓'):'↕'}</button><small>${escape(m.unit||'未定义单位')}</small></th>`).join('')}</tr></thead><tbody>${sorted.map(r=>`<tr><td><i class="color-dot" style="background:${color(r.id)}"></i>${escape(r.name)}<br><small>${escape(r.uid)} · ${escape(r.date?r.date.slice(0,10):'未填日期')}${r.id===base?.id?' · 基准':''}</small></td>${columns.map(m=>{const v=C.value(r,m),b=C.value(base,m);return `<td class="${r.id===base?.id?'base-cell':''}">${format(v)}${r.id!==base?.id&&v!==null&&b!==null?`<br><small>Δ ${signed(v-b)}</small>`:''}</td>`;}).join('')}</tr>`).join('')}<tr><td>参考中位数</td>${columns.map(m=>{const s=C.summary(reference(),m);return `<td>${format(s.median)}<br><small>有效 n=${s.n}</small></td>`;}).join('')}</tr></tbody></table>`;
}
const BRAND_ZH = {"361°": "三六一度", "adidas": "阿迪达斯", "Altra": "奥创", "ANTA": "安踏", "ASICS": "亚瑟士", "Bmai": "必迈", "Brooks": "布鲁克斯", "Do-Win": "多威", "Erke": "鸿星尔克", "FILA": "斐乐", "HEALTH": "海尔斯", "HOKA": "霍卡", "Joma": "荷马", "Kailas": "凯乐石", "LA SPORTIVA": "拉思珀蒂瓦", "Li-Ning": "李宁", "Mizuno": "美津浓", "New Balance": "新百伦", "Nike": "耐克", "On": "昂跑", "Other": "其他", "Peak": "匹克", "PUMA": "彪马", "Qiaodan": "乔丹", "Salomon": "萨洛蒙", "Saucony": "索康尼", "TANSHEZHE": "弹射者", "Umbro": "茵宝", "Vibram": "维布拉姆", "VICTOR": "威克多", "Volante": "沃兰迪", "Xtep": "特步", "YONEX": "尤尼克斯"};
function brandLabels(name){return /[\u3400-\u9fff]/.test(name)?{zh:name,en:name==='开野'?'KAIYE':'英文名待补充'}:{zh:BRAND_ZH[name]||'中文名待补充',en:name};}
function renderBrands() {
  const q=$('brandSearch').value.trim().toLowerCase();
  const names=[...new Set(records.map(r=>r.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  $('brandOptions').innerHTML=names.filter(name=>{const b=config.brands?.find(x=>x.name===name);return [name,brandLabels(name).zh,brandLabels(name).en,...(b?.aliases||[])].join(' ').toLowerCase().includes(q);}).map(name=>{
    const b=config.brands?.find(x=>x.name===name), logo=b?.logo?.startsWith('/static/brand-logos/')?`<img src="${escape(b.logo)}" alt="" loading="lazy">`:'';
    return `<button class="brand-option ${state.brands.includes(name)?'active':''}" data-brand="${escape(name)}" aria-pressed="${state.brands.includes(name)}">${logo}<span class="brand-names"><strong>${escape(brandLabels(name).zh)}</strong><small>${escape(brandLabels(name).en)}</small></span></button>`;
  }).join('')||'<p class="muted">没有匹配品牌</p>';
}
function renderTags(target='tagOptions') {
  const groups=config.taxonomy.find(c=>c.name===state.category)?.groups || [];
  $(target).innerHTML=groups.length?groups.map(g=>`<div class="tag-group"><span>${escape(g.name)} · 多选</span><div class="tag-buttons">${g.tags.map(t=>{const name=typeof t==='string'?t:t.name;return `<button class="tag-button ${state.tags.some(x=>x.field===g.field&&x.name===name)?'active':''}" data-tag="${escape(name)}" data-field="${escape(g.field)}" aria-pressed="${state.tags.some(x=>x.field===g.field&&x.name===name)}" title="${escape(typeof t==='string'?'':t.description||'')}">${escape(name.replace(/【.*?】/g,''))}</button>`;}).join('')}</div></div>`).join(''):`<p class="muted">${state.category?'该品类暂未设置细分标签。':'先在顶部选择一个品类，即可显示适用标签。'}</p>`;
}
function renderRanges() {
  $('rangeRows').innerHTML=state.ranges.map((c,i)=>`<div class="range-row" data-range-index="${i}"><div class="range-row-header"><select data-part="field" aria-label="数值条件 ${i+1} 指标">${metrics.map(m=>`<option value="${escape(m.field)}" ${c.field===m.field?'selected':''}>${escape(m.label)} ${escape(m.unit)}</option>`).join('')}</select><button class="remove-range" data-remove-range="${i}" aria-label="删除数值条件 ${i+1}">×</button></div><div class="range-inputs"><input type="number" step="any" data-part="min" value="${escape(c.min)}" placeholder="最低（不限）" aria-label="数值条件 ${i+1} 最低值"><span>至</span><input type="number" step="any" data-part="max" value="${escape(c.max)}" placeholder="最高（不限）" aria-label="数值条件 ${i+1} 最高值"></div></div>`).join('');
}
function renderPresets() {
  $('preset').innerHTML='<option value="">常用筛选</option><option value="carbon">碳板跑鞋</option><option value="light">轻量跑鞋 ≤ 250g</option><option value="basketball">篮球鞋</option>'+presets.map((p,i)=>`<option value="saved-${i}">${escape(p.name)}</option>`).join('');
  $('savedPresets').innerHTML=presets.map((p,i)=>`<div class="saved-preset"><button class="button" data-preset="${i}">${escape(p.name)}</button><button class="delete-preset" data-delete-preset="${i}" aria-label="删除筛选 ${escape(p.name)}">×</button></div>`).join('')||'<p class="muted">在顶部点击“保存筛选”，留住常用的筛选组合。</p>';
}
function openFilters() { if(!config) return notify('数据尚未加载，请稍后重试。'); renderBrands();renderTags();renderRanges();renderPresets();$('filterDialog').showModal(); }
function syncFilters() { $('search').value=state.query; $('category').value=state.category; $('onlySelected').checked=state.onlySelected; }
function resetFilters() { Object.assign(state,{query:'',category:'',brands:[],tags:[],ranges:[],onlySelected:false});syncFilters();applyFilters();renderTags();renderBrands();renderRanges(); }
function loadPreset(value) {
  let filters;
  if(value.startsWith('saved-')) filters=presets[Number(value.slice(6))]?.filters;
  else filters={query:'',category:value==='basketball'?'篮球鞋':'跑鞋',brands:[],tags:value==='carbon'?[{field:'结构标签',name:'碳板'}]:[],ranges:value==='light'?[{field:'整鞋重量(g)',min:'',max:250}]:[]};
  if(!filters) return;
  Object.assign(state,JSON.parse(JSON.stringify(filters)),{onlySelected:false});syncFilters();applyFilters();
  if($('filterDialog').open){renderBrands();renderTags();renderRanges();}
  notify('已应用筛选，保留当前已选记录。');
}
function demo() {
  let candidates=filtered.filter(r=>r.complete>=6).slice().sort((a,b)=>b.complete-a.complete);
  const found=[], names=new Set(), brands=new Set();
  for(const r of candidates) if(!names.has(r.name)&&!brands.has(r.brand)) {found.push(r.id);names.add(r.name);brands.add(r.brand);if(found.length===3) break;}
  if(!found.length) return notify('当前范围没有足够完整的记录，请放宽筛选后再试。');
  state.selected=found;state.radar=found.slice();state.baseline=found[0];selectionChanged();notify('已选入示例记录。你可以自由替换，或继续增加到 12 条。');
}
function exportCsv() {
  const columns=groupMetrics();
  const cells=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s)&&typeof v!=='number')s="'"+s;return `"${s.replaceAll('"','""')}"`;};
  const rows=[['测试记录编号','鞋款名称','品牌','品类','测试日期',...columns.map(m=>m.unit?`${m.label} (${m.unit})`:m.label)],...selectedRecords().map(r=>[r.uid,r.name,r.brand,r.category,r.date,...columns.map(m=>C.value(r,m))])];
  const blob=new Blob(['\ufeff'+rows.map(r=>r.map(cells).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}), url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=`鞋类对比_${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('已导出当前分组的原始数值，缺失数据保持为空。');
}
async function loadData() {
  if(loading) return;loading=true;
  try {
    const data=await Promise.all(['/api/config','/api/records'].map(async url=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(25000)});const d=await r.json();if(!r.ok)throw new Error(d.error||'读取失败');return d;}));
    config=data[0];$('teableEntry').href=config.entryUrl||'#';$('teableEntry').classList.toggle('hidden',!config.entryUrl);fields=data[1].fields;makeMetrics();nameCounts=new Map();
    const f=config.fieldNames;
    records=data[1].records.map(r=>{
      const name=text(r.fields[f.name])||'未命名记录',uid=text(r.fields[f.id])||r.id,brand=text(r.fields[f.brand]),category=text(r.fields[f.primaryCategory])||'未分类';
      nameCounts.set(name,(nameCounts.get(name)||0)+1);
      return {...r,name,uid,brand,category,date:text(r.fields[f.date]),search:[name,uid,brand,text(r.fields[f.tester])].join(' ').toLowerCase(),complete:config.metrics.filter(m=>C.value(r,m)!==null).length};
    });
    state.selected=[...new Set(state.selected)].filter(id=>records.some(r=>r.id===id)).slice(0,12);
    state.radar=state.radar.filter(id=>state.selected.includes(id)).slice(0,6);
    if(!state.selected.includes(state.baseline))state.baseline=state.selected[0]||'';
    const categories=[...config.taxonomy.map(c=>c.name),'未分类'];
    $('category').innerHTML='<option value="">全部品类</option>'+categories.map(c=>`<option value="${escape(c)}">${escape(c)}</option>`).join('');
    if(!categories.includes(state.category))state.category='';
    syncFilters();$('listSort').value=state.listSort;$('chartSort').value=state.chartSort;renderMetricSelector();renderPresets();applyFilters(false);
    $('errorBanner').classList.add('hidden');
    if(firstLoad && !Object.keys(saved).length && !state.selected.length)demo();
    else if($('filterDialog').open){renderBrands();renderTags();renderRanges();}
    firstLoad=false;
  } catch(error) {
    $('errorBanner').innerHTML=`${escape(error.message)} <button class="button" id="retry">重试</button> <a href="http://127.0.0.1:8088" target="_blank" rel="noopener">检查原版服务 ↗</a>${records.length?' · 页面保留上次成功读取的数据。':''}`;
    $('errorBanner').classList.remove('hidden');
    if(!records.length)$('recordList').innerHTML='<div class="no-results"><strong>暂时无法读取数据</strong>请确认原版分析平台已启动，再点击重试。</div>';
  } finally { loading=false; }
}
// Events are attached once. Re-rendering data never duplicates handlers.
$('errorBanner').onclick=e=>{if(e.target.closest('#retry'))loadData();};
let searchTimer;$('search').oninput=e=>{state.query=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>applyFilters(),120);};
$('category').onchange=e=>{const had=state.tags.length;state.category=e.target.value;state.tags=[];applyFilters();if(had)notify('已切换品类，并清除原品类标签。');};
$('secondaryFilter').onclick=()=>{if(!config)return notify('数据尚未加载。');renderTags('secondaryTags');$('secondaryDialog').showModal();};
$('moreFilters').onclick=openFilters;
$('clearSecondary').onclick=()=>{state.tags=[];renderTags('secondaryTags');applyFilters();};
$('applySecondary').onclick=()=>$('secondaryDialog').close();
$('activeFilters').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.clear)return resetFilters();const i=Number(b.dataset.index);if(b.dataset.kind==='query')state.query='';if(b.dataset.kind==='category'){state.category='';state.tags=[];}if(b.dataset.kind==='brand')state.brands.splice(i,1);if(b.dataset.kind==='tag')state.tags.splice(i,1);if(b.dataset.kind==='range')state.ranges.splice(i,1);syncFilters();applyFilters();};
$('brandSearch').oninput=renderBrands;
$('brandOptions').onclick=e=>{const b=e.target.closest('[data-brand]');if(!b)return;const name=b.dataset.brand;state.brands=state.brands.includes(name)?state.brands.filter(x=>x!==name):[...state.brands,name];renderBrands();applyFilters();};
function toggleTag(e){const b=e.target.closest('[data-tag]');if(!b)return;const t={name:b.dataset.tag,field:b.dataset.field};const i=state.tags.findIndex(x=>x.name===t.name&&x.field===t.field);if(i>=0)state.tags.splice(i,1);else state.tags.push(t);renderTags();renderTags('secondaryTags');applyFilters();}
$('tagOptions').onclick=toggleTag;$('secondaryTags').onclick=toggleTag;
$('addRange').onclick=()=>{if(state.ranges.length>=6)return notify('最多组合 6 个数值条件。');state.ranges.push({field:currentMetric().field,min:'',max:''});renderRanges();};
$('rangeRows').onchange=e=>{const row=e.target.closest('[data-range-index]');if(!row||!e.target.dataset.part)return;const i=Number(row.dataset.rangeIndex),part=e.target.dataset.part,old=state.ranges[i][part];state.ranges[i][part]=e.target.value;const c=state.ranges[i];if(c.min!==''&&c.max!==''&&Number(c.min)>Number(c.max)){c[part]=old;renderRanges();return notify('最低值不能大于最高值。');}applyFilters();};
$('rangeRows').oninput=e=>{const row=e.target.closest('[data-range-index]');if(!row||!['min','max'].includes(e.target.dataset.part))return;const c=state.ranges[Number(row.dataset.rangeIndex)],part=e.target.dataset.part,next=e.target.value;if(next!==''&&!Number.isFinite(Number(next)))return;const min=part==='min'?next:c.min,max=part==='max'?next:c.max;if(min!==''&&max!==''&&Number(min)>Number(max))return;c[part]=next;applyFilters();};
$('rangeRows').onclick=e=>{const b=e.target.closest('[data-remove-range]');if(!b)return;state.ranges.splice(Number(b.dataset.removeRange),1);renderRanges();applyFilters();};
$('resetFilters').onclick=resetFilters;$('applyFilters').onclick=()=>$('filterDialog').close();
$('onlySelected').onchange=e=>{state.onlySelected=e.target.checked;state.page=1;renderCatalog();persist();};
$('listSort').onchange=e=>{state.listSort=e.target.value;state.page=1;renderCatalog();persist();};
$('recordList').onclick=e=>{const card=e.target.closest('[data-record]');if(card)toggleRecord(card.dataset.record);};
$('prevPage').onclick=()=>{state.page--;renderCatalog();$('recordList').scrollTop=0;};
$('nextPage').onclick=()=>{state.page++;renderCatalog();$('recordList').scrollTop=0;};
$('addVisible').onclick=()=>{const pageIds=[...$('recordList').querySelectorAll('[data-record]')].map(b=>b.dataset.record).filter(id=>!state.selected.includes(id));const count=Math.min(12-state.selected.length,pageIds.length);state.selected.push(...pageIds.slice(0,count));for(const id of state.selected)if(state.radar.length<6&&!state.radar.includes(id))state.radar.push(id);selectionChanged();notify(`已选入 ${count} 条记录，共 ${state.selected.length} 条。`);};
$('dockChips').onclick=e=>{const b=e.target.closest('[data-remove]');if(b)toggleRecord(b.dataset.remove);};
$('clearSelection').onclick=()=>{state.selected=[];selectionChanged();};
document.querySelector('.tabs').onclick=e=>{const b=e.target.closest('[data-view]');if(!b)return;state.view=b.dataset.view;renderAnalysis();persist();};
$('metricGroup').onchange=e=>{state.group=e.target.value;renderMetricSelector();renderAnalysis();persist();};
$('metric').onchange=e=>{state.metric=e.target.value;renderAnalysis();persist();};
$('baseline').onchange=e=>{state.baseline=e.target.value;renderAnalysis();persist();};
$('scope').onchange=e=>{state.scope=e.target.value;renderAnalysis();persist();};
$('chartSort').onchange=e=>{state.chartSort=e.target.value;renderAnalysis();persist();};
$('radarPreset').onchange=()=>renderAnalysis();
$('openRadarGuide').onclick=()=>$('radarGuideDialog').showModal();
$('radarPicker').onclick=e=>{const b=e.target.closest('[data-radar]');if(!b)return;const result=C.select(state.radar,b.dataset.radar,6);if(result.full)return notify('雷达图最多突出 6 条，请先取消一条；其他图表仍比较全部已选记录。');state.radar=result.ids;renderAnalysis();persist();};
$('detailTable').onclick=e=>{const b=e.target.closest('[data-sort]');if(!b)return;sortTable={field:b.dataset.sort,direction:sortTable.field===b.dataset.sort?-sortTable.direction:1};renderTable(selectedRecords());};
$('demo').onclick=demo;$('export').onclick=exportCsv;
$('preset').onchange=e=>{if(e.target.value&&config)loadPreset(e.target.value);e.target.value='';};
$('savePreset').onclick=()=>{if(!config)return notify('请等待数据加载。');$('presetName').value='';$('saveDialog').showModal();};
$('cancelSave').onclick=()=>$('saveDialog').close();
$('saveForm').onsubmit=e=>{e.preventDefault();const name=$('presetName').value.trim();if(!name)return;const filters={};for(const k of ['query','category','brands','tags','ranges'])filters[k]=JSON.parse(JSON.stringify(state[k]));const index=presets.findIndex(p=>p.name===name);if(index>=0)presets[index]={name,filters};else presets.push({name,filters});writeStorage(PRESETS,presets);renderPresets();$('saveDialog').close();notify('筛选已保存到当前浏览器。');};
$('savedPresets').onclick=e=>{const apply=e.target.closest('[data-preset]'),remove=e.target.closest('[data-delete-preset]');if(apply)loadPreset(`saved-${apply.dataset.preset}`);if(remove){presets.splice(Number(remove.dataset.deletePreset),1);writeStorage(PRESETS,presets);renderPresets();}};
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)&&!$('filterDialog').open&&!$('saveDialog').open&&!$('secondaryDialog').open){e.preventDefault();$('search').focus();}});
function setDockCollapsed(collapsed){state.dockCollapsed=collapsed;document.body.classList.toggle('dock-collapsed',collapsed);$('toggleDock').textContent=collapsed?`展开对比栏 · ${state.selected.length} 条 ↑`:'收起对比栏 ↓';$('toggleDock').setAttribute('aria-expanded',String(!collapsed));persist();}
$('toggleDock').onclick=()=>setDockCollapsed(!state.dockCollapsed);
setDockCollapsed(Boolean(state.dockCollapsed));
function setCatalogCollapsed(collapsed){state.catalogCollapsed=collapsed;$('workGrid').classList.toggle('collapsed',collapsed);$('toggleCatalog').textContent=collapsed?'▶':'◀';$('toggleCatalog').setAttribute('aria-label',collapsed?'展开选鞋区':'收起选鞋区');$('toggleCatalog').title=collapsed?'展开选鞋区':'收起选鞋区';$('toggleCatalog').setAttribute('aria-expanded',String(!collapsed));persist();}
$('toggleCatalog').onclick=()=>setCatalogCollapsed(!state.catalogCollapsed);
setCatalogCollapsed(Boolean(state.catalogCollapsed));
const resizeObserver=new ResizeObserver(()=>{bar?.resize();radar?.resize();});resizeObserver.observe($('analysis'));resizeObserver.observe($('radarChart'));
loadData();
