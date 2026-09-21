(function (root) {
  'use strict';
  function numeric(v) { if (v == null || typeof v === 'boolean' || String(v).trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
  function value(record, metric) {
    if (!record || !metric) return null;
    const n = numeric(record.fields[metric.field]);
    if (n !== null) return n;
    if (metric.sourceFields) {
      const values = metric.sourceFields.map(f => numeric(record.fields[f])).filter(n => n !== null);
      return values.length ? values.reduce((s, n) => s + n, 0) / values.length : null;
    }
    return null;
  }
  function quantile(values, p) {
    const sorted = values.filter(v => v !== null && Number.isFinite(v)).slice().sort((a, b) => a - b);
    if (!sorted.length) return null;
    const i = (sorted.length - 1) * p, low = Math.floor(i), high = Math.ceil(i);
    return sorted[low] + (sorted[high] - sorted[low]) * (i - low);
  }
  function summary(records, metric) {
    const values = records.map(r => value(r, metric)).filter(v => v !== null);
    return { n: values.length, median: values.length >= 3 ? quantile(values, .5) : null, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, p5: quantile(values, .05), p95: quantile(values, .95) };
  }
  function rank(record, records, metric) {
    const v = value(record, metric), valid = records.filter(r => value(r, metric) !== null), n = valid.length;
    if (v === null) return { text: '未测', n };
    if (!valid.some(r => r.id === record.id)) return { text: '参考范围外', n };
    if (n < 3) return { text: `样本不足 · n=${n}`, n };
    const tied = valid.filter(r => value(r, metric) === v).length;
    const mode = metric.rankMode || 'neutral';
    const better = valid.filter(r => mode === 'higher' ? value(r, metric) > v : value(r, metric) < v).length;
    const position = better + 1;
    return { n, position, text: mode === 'neutral' ? `低→高 ${position}/${n}${tied > 1 ? ' · 并列' : ''}` : `前 ${Math.ceil(position / n * 100)}% · ${tied > 1 ? '并列 ' : ''}${position}/${n}` };
  }
  function score(record, metric, records) {
    const v = value(record, metric), s = summary(records, metric);
    if (v === null || s.n < 3) return null;
    if (s.p95 === s.p5) return 50;
    const position = Math.max(0, Math.min(100, (v - s.p5) / (s.p95 - s.p5) * 100));
    return Math.round(metric.rankMode === 'lower' ? 100 - position : position);
  }
  function select(ids, id, limit = 12) {
    if (ids.includes(id)) return { ids: ids.filter(x => x !== id), full: false };
    return ids.length >= limit ? { ids: ids.slice(), full: true } : { ids: [...ids, id], full: false };
  }
  const api = { numeric, value, quantile, summary, rank, score, select };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShoeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
