/**
 * 文件对比核心：编码识别、按行拆分、Myers 差异、忽略空白/大小写/换行符、
 * 行内差异、二进制差异、"仅显示差异及上下文"的视图布局。
 * 不依赖 DOM，浏览器与 Node 均可使用。
 */
(function (root) {
  'use strict';

  var KIND_SAME = 0, KIND_MINOR = 1, KIND_CHANGE = 2, KIND_DEL = 3, KIND_INS = 4;
  var MAX_RANGES = 200000;      // 二进制差异区段上限
  var INLINE_MAX_LEN = 4000;    // 超过该长度的行不做行内差异
  var DEFAULT_TIMEOUT = 5000;   // 单次文本对比的时间上限（毫秒）

  // ===================== 编码 =====================
  var ENC_LABEL = {
    'utf-8': 'UTF-8',
    'utf-16le': 'UTF-16LE',
    'utf-16be': 'UTF-16BE',
    'gbk': 'GBK',
    'windows-1252': 'ANSI (Latin-1)'
  };

  function bomEncoding(u8) {
    var n = u8.length;
    if (n >= 3 && u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return 'utf-8';
    if (n >= 2 && u8[0] === 0xFF && u8[1] === 0xFE) return 'utf-16le';
    if (n >= 2 && u8[0] === 0xFE && u8[1] === 0xFF) return 'utf-16be';
    return '';
  }

  // 无 BOM 的 UTF-16：采样中 0 字节几乎都落在奇数位（LE）或偶数位（BE）
  function utf16Guess(u8) {
    var m = Math.min(u8.length, 4096), even = 0, odd = 0;
    if (m < 4) return '';
    for (var i = 0; i < m; i++) {
      if (u8[i] === 0) { if (i & 1) odd++; else even++; }
    }
    var half = m / 2;
    if (odd > half * 0.3 && even < half * 0.02) return 'utf-16le';
    if (even > half * 0.3 && odd < half * 0.02) return 'utf-16be';
    return '';
  }

  function tdecode(enc, u8, fatal) {
    return new TextDecoder(enc, { fatal: !!fatal }).decode(u8);
  }

  // enc 为空或 'auto' 时自动识别；返回 { text, enc }
  function decode(u8, enc) {
    if (enc && enc !== 'auto') {
      try { return { text: tdecode(enc, u8, false), enc: enc }; }
      catch (e) { return { text: tdecode('windows-1252', u8, false), enc: 'windows-1252' }; }
    }
    var e1 = bomEncoding(u8) || utf16Guess(u8);
    if (e1) return { text: tdecode(e1, u8, false), enc: e1 };
    try { return { text: tdecode('utf-8', u8, true), enc: 'utf-8' }; } catch (e) { /* 不是合法 UTF-8 */ }
    try { return { text: tdecode('gbk', u8, false), enc: 'gbk' }; }
    catch (e2) { return { text: tdecode('windows-1252', u8, false), enc: 'windows-1252' }; }
  }

  // 含 NUL 字节且不是 UTF-16 时认为是二进制文件
  function looksBinary(u8, enc) {
    if (enc && enc.indexOf('utf-16') === 0) return false;
    var m = Math.min(u8.length, 8192);
    for (var i = 0; i < m; i++) if (u8[i] === 0) return true;
    return false;
  }

  // ===================== 按行拆分 =====================
  // 返回 { t: 行文本[], e: 行结束符[]（'' | '\n' | '\r\n' | '\r'）, n }
  function splitLines(text) {
    var t = [], e = [], n = text.length, s = 0;
    for (var i = 0; i < n; i++) {
      var c = text.charCodeAt(i);
      if (c === 10) {
        t.push(text.slice(s, i)); e.push('\n'); s = i + 1;
      } else if (c === 13) {
        t.push(text.slice(s, i));
        if (text.charCodeAt(i + 1) === 10) { e.push('\r\n'); i++; } else e.push('\r');
        s = i + 1;
      }
    }
    if (s < n) { t.push(text.slice(s)); e.push(''); }
    return { t: t, e: e, n: t.length };
  }

  function eolKind(lines) {
    var lf = 0, crlf = 0, cr = 0;
    for (var i = 0; i < lines.n; i++) {
      var x = lines.e[i];
      if (x === '\n') lf++; else if (x === '\r\n') crlf++; else if (x === '\r') cr++;
    }
    var kinds = (lf ? 1 : 0) + (crlf ? 1 : 0) + (cr ? 1 : 0);
    if (kinds === 0) return '无';
    if (kinds > 1) return '混合';
    return lf ? 'LF' : crlf ? 'CRLF' : 'CR';
  }

  // ===================== 行比较键 =====================
  function normOpts(o) {
    o = o || {};
    return {
      ws: o.ws || 'none',                          // none | trim | all | collapse
      icase: !!o.icase,
      ignoreEol: o.ignoreEol === undefined ? true : !!o.ignoreEol,
      timeout: o.timeout || DEFAULT_TIMEOUT
    };
  }

  function normText(s, o) {
    if (o.icase) s = s.toLowerCase();
    if (o.ws === 'trim') s = s.replace(/^\s+|\s+$/g, '');
    else if (o.ws === 'all') s = s.replace(/\s+/g, '');
    else if (o.ws === 'collapse') s = s.replace(/\s+/g, ' ');
    return s;
  }

  function lineKeys(lines, o, intern) {
    var ids = new Int32Array(lines.n);
    for (var i = 0; i < lines.n; i++) {
      var k = normText(lines.t[i], o);
      if (!o.ignoreEol) k += '\u0001' + lines.e[i];
      var id = intern.get(k);
      if (id === undefined) { id = intern.size; intern.set(k, id); }
      ids[i] = id;
    }
    return ids;
  }

  // ===================== Myers 差异（线性空间，二分中间蛇形） =====================
  function pushRun(out, op, len) {
    if (!len) return;
    var m = out.length;
    if (m && out[m - 2] === op) out[m - 1] += len;
    else out.push(op, len);
  }

  // 返回 [x, y] 切分点；无公共元素或超时返回 null
  function bisect(a, b, ctx) {
    var an = a.length, bn = b.length;
    var maxD = Math.ceil((an + bn) / 2);
    var vOff = maxD, vLen = 2 * maxD + 2;
    var v1 = new Int32Array(vLen).fill(-1);
    var v2 = new Int32Array(vLen).fill(-1);
    v1[vOff + 1] = 0;
    v2[vOff + 1] = 0;
    var delta = an - bn;
    var front = (delta % 2 !== 0);
    var k1s = 0, k1e = 0, k2s = 0, k2e = 0;
    var x1, y1, x2, y2, k1o, k2o;

    for (var d = 0; d < maxD; d++) {
      if ((d & 63) === 0 && Date.now() > ctx.deadline) { ctx.timedOut = true; break; }
      for (var k1 = -d + k1s; k1 <= d - k1e; k1 += 2) {
        k1o = vOff + k1;
        if (k1 === -d || (k1 !== d && v1[k1o - 1] < v1[k1o + 1])) x1 = v1[k1o + 1];
        else x1 = v1[k1o - 1] + 1;
        y1 = x1 - k1;
        while (x1 < an && y1 < bn && a[x1] === b[y1]) { x1++; y1++; }
        v1[k1o] = x1;
        if (x1 > an) k1e += 2;
        else if (y1 > bn) k1s += 2;
        else if (front) {
          k2o = vOff + delta - k1;
          if (k2o >= 0 && k2o < vLen && v2[k2o] !== -1) {
            x2 = an - v2[k2o];
            if (x1 >= x2) return [x1, y1];
          }
        }
      }
      for (var k2 = -d + k2s; k2 <= d - k2e; k2 += 2) {
        k2o = vOff + k2;
        if (k2 === -d || (k2 !== d && v2[k2o - 1] < v2[k2o + 1])) x2 = v2[k2o + 1];
        else x2 = v2[k2o - 1] + 1;
        y2 = x2 - k2;
        while (x2 < an && y2 < bn && a[an - x2 - 1] === b[bn - y2 - 1]) { x2++; y2++; }
        v2[k2o] = x2;
        if (x2 > an) k2e += 2;
        else if (y2 > bn) k2s += 2;
        else if (!front) {
          k1o = vOff + delta - k2;
          if (k1o >= 0 && k1o < vLen && v1[k1o] !== -1) {
            x1 = v1[k1o];
            y1 = vOff + x1 - k1o;
            x2 = an - x2;
            if (x1 >= x2) return [x1, y1];
          }
        }
      }
    }
    return null;
  }

  function diffRec(a, b, ctx, out) {
    var an = a.length, bn = b.length;
    if (!an && !bn) return;
    var m = Math.min(an, bn), p = 0;
    while (p < m && a[p] === b[p]) p++;
    if (p) pushRun(out, 0, p);
    var ra = an - p, rb = bn - p;
    m = Math.min(ra, rb);
    var s = 0;
    while (s < m && a[an - 1 - s] === b[bn - 1 - s]) s++;
    var a2 = a.subarray(p, an - s), b2 = b.subarray(p, bn - s);
    if (!a2.length) pushRun(out, 1, b2.length);
    else if (!b2.length) pushRun(out, -1, a2.length);
    else {
      var cut = bisect(a2, b2, ctx);
      if (cut) {
        diffRec(a2.subarray(0, cut[0]), b2.subarray(0, cut[1]), ctx, out);
        diffRec(a2.subarray(cut[0]), b2.subarray(cut[1]), ctx, out);
      } else {
        pushRun(out, -1, a2.length);
        pushRun(out, 1, b2.length);
      }
    }
    if (s) pushRun(out, 0, s);
  }

  // 返回 { runs: [op, len, op, len, ...]（0 相同，-1 仅 a，1 仅 b）, timedOut }
  function diffSeq(a, b, timeout) {
    var ctx = { deadline: Date.now() + (timeout || DEFAULT_TIMEOUT), timedOut: false };
    var out = [];
    diffRec(a, b, ctx, out);
    return { runs: out, timedOut: ctx.timedOut };
  }

  // ===================== 文本差异 =====================
  function diffText(textA, textB, opts) {
    var o = normOpts(opts);
    var A = splitLines(textA), B = splitLines(textB);
    var intern = new Map();
    var ia = lineKeys(A, o, intern), ib = lineKeys(B, o, intern);
    var sq = diffSeq(ia, ib, o.timeout);
    var runs = sq.runs;

    var cap = A.n + B.n;
    var kind = new Uint8Array(cap), L = new Int32Array(cap), R = new Int32Array(cap), sec = new Int32Array(cap);
    var secStart = [], secEnd = [];
    var n = 0, i = 0, j = 0;
    var st = { changed: 0, leftOnly: 0, rightOnly: 0, minor: 0, same: 0 };

    var hunk = false, hi = 0, hj = 0, hp = 0, hq = 0;
    function flush() {
      if (!hunk) return;
      var id = secStart.length;
      secStart.push(n);
      var m = Math.min(hp, hq), k;
      for (k = 0; k < m; k++) { kind[n] = KIND_CHANGE; L[n] = hi + k; R[n] = hj + k; sec[n] = id; n++; }
      for (k = m; k < hp; k++) { kind[n] = KIND_DEL; L[n] = hi + k; R[n] = -1; sec[n] = id; n++; }
      for (k = m; k < hq; k++) { kind[n] = KIND_INS; L[n] = -1; R[n] = hj + k; sec[n] = id; n++; }
      secEnd.push(n);
      st.changed += m;
      st.leftOnly += hp - m;
      st.rightOnly += hq - m;
      hunk = false;
    }

    for (var r = 0; r < runs.length; r += 2) {
      var op = runs[r], len = runs[r + 1];
      if (op === 0) {
        flush();
        for (var k = 0; k < len; k++) {
          var minor = A.t[i + k] !== B.t[j + k];
          kind[n] = minor ? KIND_MINOR : KIND_SAME;
          L[n] = i + k; R[n] = j + k; sec[n] = -1; n++;
          if (minor) st.minor++; else st.same++;
        }
        i += len; j += len;
      } else {
        if (!hunk) { hunk = true; hi = i; hj = j; hp = 0; hq = 0; }
        if (op < 0) { hp += len; i += len; } else { hq += len; j += len; }
      }
    }
    flush();

    return {
      n: n,
      kind: kind.subarray(0, n), L: L.subarray(0, n), R: R.subarray(0, n), sec: sec.subarray(0, n),
      secStart: Int32Array.from(secStart), secEnd: Int32Array.from(secEnd),
      A: A, B: B,
      eolA: eolKind(A), eolB: eolKind(B),
      stats: st,
      sections: secStart.length,
      timedOut: sq.timedOut,
      opts: o
    };
  }

  // ===================== 行内差异 =====================
  var TOKEN_RE = /[A-Za-z0-9_]+|\s+|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g;
  var WS_RE = /^\s+$/;

  function tokenize(s, o) {
    var toks = s.match(TOKEN_RE) || [];
    var out = [], pos = 0, i;
    for (i = 0; i < toks.length; i++) {
      out.push({ s: toks[i], a: pos, b: pos + toks[i].length, ws: WS_RE.test(toks[i]) });
      pos += toks[i].length;
    }
    if (o.ws === 'all') {
      out = out.filter(function (t) { return !t.ws; });
    } else if (o.ws === 'trim') {
      while (out.length && out[0].ws) out.shift();
      while (out.length && out[out.length - 1].ws) out.pop();
    }
    return out;
  }

  function tokenKey(t, o) {
    var k = t.s;
    if (t.ws && o.ws === 'collapse') k = ' ';
    if (o.icase) k = k.toLowerCase();
    return k;
  }

  // 返回 { a: [[起, 止), ...], b: [...] }：两行中不同的字符区间；差异过大或行过长返回 null
  function inlineDiff(sa, sb, opts) {
    if (sa.length > INLINE_MAX_LEN || sb.length > INLINE_MAX_LEN) return null;
    var o = normOpts(opts);
    var ta = tokenize(sa, o), tb = tokenize(sb, o);
    var intern = new Map();
    function ids(ts) {
      var out = new Int32Array(ts.length);
      for (var i = 0; i < ts.length; i++) {
        var k = tokenKey(ts[i], o), id = intern.get(k);
        if (id === undefined) { id = intern.size; intern.set(k, id); }
        out[i] = id;
      }
      return out;
    }
    var sq = diffSeq(ids(ta), ids(tb), 200);
    var ra = [], rb = [], i = 0, j = 0, same = 0, total = 0;
    function add(list, toks, from, cnt) {
      if (!cnt) return;
      var a = toks[from].a, b = toks[from + cnt - 1].b;
      var m = list.length;
      if (m && list[m - 1][1] >= a) list[m - 1][1] = b; else list.push([a, b]);
    }
    for (var r = 0; r < sq.runs.length; r += 2) {
      var op = sq.runs[r], len = sq.runs[r + 1];
      if (op === 0) {
        for (var k = 0; k < len; k++) same += ta[i + k].b - ta[i + k].a;
        i += len; j += len;
      } else if (op < 0) { add(ra, ta, i, len); i += len; }
      else { add(rb, tb, j, len); j += len; }
    }
    total = Math.max(sa.length, sb.length);
    // 相同部分太少说明整行都不同，行内标记没有意义
    if (total && same / total < 0.3) return null;
    return { a: ra, b: rb };
  }

  // ===================== 二进制差异 =====================
  // 按偏移逐字节比较；长度不同时，多出的部分算作一个差异区段。
  // 返回 { starts, ends（Int32Array/数组，[起,止) ）, count, diffBytes, truncated, lenA, lenB }
  function diffBytes(a, b) {
    var n = Math.min(a.length, b.length);
    var starts = [], ends = [];
    var diffBytes = 0, truncated = false;
    var a32 = null, b32 = null;
    if (a.byteOffset % 4 === 0 && b.byteOffset % 4 === 0 && n >= 4) {
      a32 = new Uint32Array(a.buffer, a.byteOffset, n >> 2);
      b32 = new Uint32Array(b.buffer, b.byteOffset, n >> 2);
    }
    var i = 0, cur = -1;
    function close(end) {
      if (cur < 0) return;
      diffBytes += end - cur;
      if (starts.length < MAX_RANGES) { starts.push(cur); ends.push(end); } else truncated = true;
      cur = -1;
    }
    while (i < n) {
      if (cur < 0 && a32 && (i & 3) === 0 && i + 4 <= n) {
        // 整字快速跳过相同区域
        var w = i >> 2, wn = n >> 2;
        while (w < wn && a32[w] === b32[w]) w++;
        i = w << 2;
        if (i >= n) break;
      }
      if (a[i] !== b[i]) { if (cur < 0) cur = i; }
      else if (cur >= 0) close(i);
      i++;
    }
    close(n);
    var maxLen = Math.max(a.length, b.length);
    if (maxLen > n) {
      // 与前一个区段首尾相接时合并
      var last = starts.length - 1;
      if (last >= 0 && ends[last] === n) { ends[last] = maxLen; diffBytes += maxLen - n; }
      else {
        diffBytes += maxLen - n;
        if (starts.length < MAX_RANGES) { starts.push(n); ends.push(maxLen); } else truncated = true;
      }
    }
    return {
      starts: starts, ends: ends, count: starts.length,
      diffBytes: diffBytes, truncated: truncated, lenA: a.length, lenB: b.length
    };
  }

  // 差异字节区段 -> 差异行区间 [起, 止)（已合并）
  function byteRangesToRows(res, bpr) {
    var s = [], e = [];
    for (var i = 0; i < res.count; i++) {
      var r0 = Math.floor(res.starts[i] / bpr), r1 = Math.floor((res.ends[i] - 1) / bpr) + 1;
      var m = s.length;
      if (m && r0 <= e[m - 1]) { if (r1 > e[m - 1]) e[m - 1] = r1; }
      else { s.push(r0); e.push(r1); }
    }
    return { s: s, e: e };
  }

  // ===================== 视图布局（仅差异 / 仅相同 / 全部） =====================
  // intervals: { s: [], e: [] } 已排序且互不重叠的差异行区间 [s, e)
  // mode: 'all' | 'diff' | 'same'；ctx: 差异上下保留的行数；expanded: 已展开的折叠段（Set，键为起始行）
  // 返回 { segs: [{ t: 0 行段 | 1 折叠段, r0, r1, d0 }], total: 显示行数 }
  function layout(totalRows, intervals, mode, ctx, expanded) {
    var segs = [], d = 0;
    function rows(r0, r1) {
      if (r1 <= r0) return;
      segs.push({ t: 0, r0: r0, r1: r1, d0: d });
      d += r1 - r0;
    }
    function fold(r0, r1) {
      if (r1 <= r0) return;
      if (expanded && expanded.has(r0)) { rows(r0, r1); return; }
      segs.push({ t: 1, r0: r0, r1: r1, d0: d });
      d += 1;
    }
    var k, S = intervals.s, E = intervals.e;
    if (mode === 'same') {
      var pos = 0;
      for (k = 0; k < S.length; k++) { rows(pos, S[k]); pos = E[k]; }
      rows(pos, totalRows);
    } else if (mode === 'diff') {
      var pos2 = 0, vs = -1, ve = -1;
      for (k = 0; k < S.length; k++) {
        var a = Math.max(0, S[k] - ctx), b = Math.min(totalRows, E[k] + ctx);
        if (vs >= 0 && a <= ve) { if (b > ve) ve = b; continue; }
        if (vs >= 0) { fold(pos2, vs); rows(vs, ve); pos2 = ve; }
        vs = a; ve = b;
      }
      if (vs >= 0) { fold(pos2, vs); rows(vs, ve); pos2 = ve; }
      fold(pos2, totalRows);
    } else {
      rows(0, totalRows);
    }
    return { segs: segs, total: d };
  }

  // 显示行号 -> 段下标（二分）
  function segIndex(lay, d) {
    var lo = 0, hi = lay.segs.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (lay.segs[mid].d0 <= d) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  // 数据行号 -> 显示行号；该行被隐藏时返回 -1
  function displayOf(lay, row) {
    var segs = lay.segs;
    if (!segs.length) return -1;
    var lo = 0, hi = segs.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (segs[mid].r0 <= row) lo = mid; else hi = mid - 1;
    }
    var s = segs[lo];
    if (row < s.r0 || row >= s.r1) return -1;
    return s.t === 1 ? s.d0 : s.d0 + (row - s.r0);
  }

  var api = {
    KIND_SAME: KIND_SAME, KIND_MINOR: KIND_MINOR, KIND_CHANGE: KIND_CHANGE, KIND_DEL: KIND_DEL, KIND_INS: KIND_INS,
    ENC_LABEL: ENC_LABEL,
    decode: decode, looksBinary: looksBinary,
    splitLines: splitLines, eolKind: eolKind,
    diffSeq: diffSeq, diffText: diffText, inlineDiff: inlineDiff,
    diffBytes: diffBytes, byteRangesToRows: byteRangesToRows,
    layout: layout, segIndex: segIndex, displayOf: displayOf
  };
  root.DiffCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
