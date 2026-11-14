(function () {
  'use strict';

  var Core = window.DiffCore;
  var H = 20;                 // 行高（与 CSS 一致）
  var BUF = 12;               // 可视区上下多渲染的行数
  var BPR = 16;               // 二进制每行字节数
  var MAX_LINE = 10000;       // 单行最多显示的字符数
  var MAX_TEXT_BYTES = 100 * 1024 * 1024;   // 文本对比的文件大小上限
  var TA_MAX_BYTES = 4 * 1024 * 1024;       // 超过该大小的文件不放进输入框

  var HEX = [];
  for (var hi = 0; hi < 256; hi++) HEX.push((hi < 16 ? '0' : '') + hi.toString(16).toUpperCase());

  function $(id) { return document.getElementById(id); }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fmtSize(n) {
    if (n < 1024) return n + ' 字节';
    var u = ['KB', 'MB', 'GB', 'TB'], i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return n.toFixed(2) + ' ' + u[i];
  }

  function fmtTime(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  var toastTimer = 0;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  // ===================== 状态 =====================
  var mode = 'text';          // text | bin
  var view = 'input';         // input | result
  var showMode = 'all';       // all | diff | same
  var ctxLines = 3;
  var opts = { ws: 'none', icase: false, ignoreEol: true };
  var sides = [newSide(), newSide()];
  var res = null;             // 当前对比结果
  var lay = null;             // 当前视图布局
  var expanded = new Set();   // 已展开的折叠段（起始行）
  var cur = -1;               // 当前差异序号
  var inlineCache = new Map();
  var charW = 7.8;
  var rf = -1, rl = -1;       // 当前已渲染的显示行区间
  var raf = 0;
  var busy = false;

  function newSide() {
    return { name: '', size: 0, mtime: 0, bytes: null, text: '', textFor: null, enc: 'auto', encShown: 'utf-8', edited: false };
  }

  function hasContent(s) { return (s.bytes && !s.edited) || s.text !== ''; }
  function fromFile(s) { return !!(s.bytes && !s.edited); }

  function ensureText(s) {
    if (!fromFile(s) || s.textFor === s.enc) return;
    var d = Core.decode(s.bytes, s.enc);
    s.text = d.text;
    s.encShown = d.enc;
    s.textFor = s.enc;
  }

  function getBytes(s) {
    return fromFile(s) ? s.bytes : new TextEncoder().encode(s.text);
  }

  // ===================== 输入视图 =====================
  var tas = [$('ta0'), $('ta1')];
  var metas = [$('meta0'), $('meta1')];
  var fileInput = $('fileInput');
  var pendingSide = 0;

  function renderInput(i) {
    var s = sides[i], ta = tas[i], meta = metas[i];
    var big = fromFile(s) && (mode === 'bin' || s.bytes.length > TA_MAX_BYTES);
    if (fromFile(s)) {
      var encTxt = '';
      if (mode === 'text' && !big) { ensureText(s); encTxt = ' · ' + Core.ENC_LABEL[s.encShown]; }
      meta.textContent = s.name + ' · ' + fmtSize(s.bytes.length) + encTxt;
      meta.title = meta.textContent;
      if (big) {
        ta.value = '';
        ta.disabled = true;
        ta.placeholder = mode === 'bin' ? '已载入文件，二进制对比不显示内容' : '文件较大，不在输入框中显示，点击“对比”直接比较';
      } else {
        ta.value = s.text;
        ta.disabled = false;
        ta.placeholder = '';
      }
    } else {
      ta.disabled = false;
      ta.value = s.text;
      ta.placeholder = mode === 'bin' ? '选择文件或拖入文件；也可输入文本，按 UTF-8 字节对比' : '粘贴文本，或拖入 / 打开文件';
      if (s.edited) meta.textContent = s.name + '（已编辑）· ' + s.text.length + ' 字符';
      else meta.textContent = s.text ? '文本 · ' + s.text.length + ' 字符' : '空';
      meta.title = '';
    }
  }

  tas.forEach(function (ta, i) {
    ta.addEventListener('input', function () {
      var s = sides[i];
      if (s.bytes && !s.edited) { s.edited = true; s.textFor = null; }
      s.text = ta.value;
      renderInputMeta(i);
    });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runCompare(); }
    });
  });

  function renderInputMeta(i) {
    var s = sides[i];
    if (s.edited) metas[i].textContent = s.name + '（已编辑）· ' + s.text.length + ' 字符';
    else metas[i].textContent = s.text ? '文本 · ' + s.text.length + ' 字符' : '空';
  }

  document.querySelectorAll('[data-open]').forEach(function (b) {
    b.addEventListener('click', function () { pendingSide = +b.getAttribute('data-open'); fileInput.click(); });
  });
  document.querySelectorAll('[data-clear]').forEach(function (b) {
    b.addEventListener('click', function () {
      var i = +b.getAttribute('data-clear');
      sides[i] = newSide();
      renderInput(i);
      if (view === 'result') backToInput();
    });
  });

  fileInput.multiple = true;
  fileInput.addEventListener('change', function () {
    var fs = Array.prototype.slice.call(fileInput.files || []);
    fileInput.value = '';
    if (!fs.length) return;
    if (fs.length >= 2) loadFiles([[0, fs[0]], [1, fs[1]]]);
    else loadFiles([[pendingSide, fs[0]]]);
  });

  function loadFiles(pairs) {
    Promise.all(pairs.map(function (p) {
      return p[1].arrayBuffer().then(function (buf) {
        var s = newSide();
        s.name = p[1].name;
        s.size = p[1].size;
        s.mtime = p[1].lastModified;
        s.bytes = new Uint8Array(buf);
        return [p[0], s];
      });
    })).then(function (list) {
      list.forEach(function (x) { sides[x[0]] = x[1]; });
      if (view === 'result') { sides.forEach(function (_, i) { renderInput(i); }); }
      else list.forEach(function (x) { renderInput(x[0]); });
      if (view === 'result' || (hasContent(sides[0]) && hasContent(sides[1]))) runCompare();
    }, function () {
      toast('读取文件失败，文件可能过大或无法访问');
    });
  }

  // 拖放：拖入两个文件时左右同时载入；单个文件按落点所在半边决定
  var dragDepth = 0;
  var mainEl = $('main');
  function hasFiles(e) {
    var t = e.dataTransfer && e.dataTransfer.types;
    if (!t) return false;
    for (var i = 0; i < t.length; i++) if (t[i] === 'Files') return true;
    return false;
  }
  document.addEventListener('dragenter', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    mainEl.classList.add('drag');
  });
  document.addEventListener('dragover', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
  });
  document.addEventListener('dragleave', function (e) {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) mainEl.classList.remove('drag');
  });
  document.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    mainEl.classList.remove('drag');
    var fs = Array.prototype.slice.call(e.dataTransfer.files || []);
    if (!fs.length) return;
    if (fs.length >= 2) { loadFiles([[0, fs[0]], [1, fs[1]]]); return; }
    var r = mainEl.getBoundingClientRect();
    loadFiles([[e.clientX < r.left + r.width / 2 ? 0 : 1, fs[0]]]);
  });

  // ===================== 对比 =====================
  var statusEl = $('status');
  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = 'df-status' + (cls ? ' ' + cls : '');
  }

  function showNotice(msg, btnText, fn) {
    var n = $('notice');
    n.textContent = '';
    if (!msg) { n.hidden = true; return; }
    n.appendChild(document.createTextNode(msg));
    if (btnText) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn sm';
      b.textContent = btnText;
      b.addEventListener('click', fn);
      n.appendChild(b);
    }
    n.hidden = false;
  }

  function runCompare() {
    if (busy) return;
    if (!hasContent(sides[0]) && !hasContent(sides[1])) { toast('请先输入或打开要对比的内容'); return; }
    if (mode === 'text') {
      for (var k = 0; k < 2; k++) {
        if (fromFile(sides[k]) && sides[k].bytes.length > MAX_TEXT_BYTES) {
          toast('文件超过 100MB，请使用二进制对比');
          return;
        }
      }
    }
    busy = true;
    setStatus('正在对比…');
    setTimeout(function () {
      try { doCompare(); }
      catch (e) { setStatus('对比失败：' + (e && e.message ? e.message : e), 'err'); }
      busy = false;
    }, 20);
  }

  function doCompare() {
    var t0 = performance.now();
    showNotice('');
    inlineCache.clear();
    expanded.clear();
    cur = -1;
    if (mode === 'text') {
      sides.forEach(ensureText);
      res = Core.diffText(sides[0].text, sides[1].text, opts);
      var binSide = -1;
      for (var i = 0; i < 2; i++) {
        if (fromFile(sides[i]) && Core.looksBinary(sides[i].bytes, sides[i].encShown)) binSide = i;
      }
      if (binSide >= 0) {
        showNotice('“' + (binSide ? '右' : '左') + '侧”文件看起来是二进制文件，文本对比的结果可能没有意义。', '切换到二进制对比', function () { setMode('bin'); });
      }
    } else {
      var a = getBytes(sides[0]), b = getBytes(sides[1]);
      var d = Core.diffBytes(a, b);
      res = { a: a, b: b, d: d, rows: Math.ceil(Math.max(a.length, b.length) / BPR), iv: Core.byteRangesToRows(d, BPR) };
    }
    res.ms = Math.round(performance.now() - t0);
    showResult();
  }

  // ===================== 结果视图 =====================
  var panes = [$('pane0'), $('pane1')];
  var spacers = [$('sp0'), $('sp1')];
  var rowsEl = [$('rows0'), $('rows1')];
  var mini = $('mini');
  var markCv = document.createElement('canvas');

  function showResult() {
    setView('result');
    buildInfos();
    var cols = mode === 'text' ? Math.max(colsOf(res.A), colsOf(res.B)) : 80;
    var W = Math.ceil((mode === 'text' ? 64 : 24) + (cols + 2) * charW + 20);
    spacers.forEach(function (s) { s.style.width = W + 'px'; s.style.minWidth = '100%'; });
    panes.forEach(function (p) { p.scrollTop = 0; p.scrollLeft = 0; });
    rebuildLayout(false);
    updateStatus();
  }

  function colsOf(lines) {
    var m = 0;
    for (var i = 0; i < lines.n; i++) {
      var t = lines.t[i], l = t.length;
      if (l > MAX_LINE) l = MAX_LINE;
      if (l * 4 > m && t.indexOf('\t') >= 0) l += 3 * (t.split('\t').length - 1);
      if (l > m) m = l;
    }
    return m;
  }

  function buildInfos() {
    for (var i = 0; i < 2; i++) {
      var s = sides[i], el = $('info' + i);
      var name = fromFile(s) ? s.name : (s.edited ? s.name + '（已编辑）' : '粘贴的文本');
      var parts = [];
      if (fromFile(s) && s.mtime) parts.push(fmtTime(s.mtime));
      var size = fromFile(s) ? s.bytes.length : getBytes(s).length;
      parts.push(fmtSize(size) + (size >= 1024 ? '（' + size + ' 字节）' : ''));
      var html = '<div class="top"><div class="nm" title="' + esc(name) + '">' + esc(name) + '</div>' +
        '<button type="button" class="btn ghost sm" data-open-r="' + i + '">打开文件</button></div><div class="mt">';
      if (mode === 'text') {
        var lines = i ? res.B : res.A;
        parts.push(lines.n + ' 行');
        parts.push('换行符 ' + (i ? res.eolB : res.eolA));
        html += parts.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('');
        if (fromFile(s)) {
          html += '<select class="sel" data-enc="' + i + '" title="文本编码">';
          html += '<option value="auto"' + (s.enc === 'auto' ? ' selected' : '') + '>自动 (' + esc(Core.ENC_LABEL[s.encShown]) + ')</option>';
          Object.keys(Core.ENC_LABEL).forEach(function (k) {
            html += '<option value="' + k + '"' + (s.enc === k ? ' selected' : '') + '>' + esc(Core.ENC_LABEL[k]) + '</option>';
          });
          html += '</select>';
        } else {
          html += '<span>UTF-8</span>';
        }
      } else {
        html += parts.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('');
        if (!fromFile(s)) html += '<span>文本按 UTF-8 编码</span>';
      }
      el.innerHTML = html + '</div>';
    }
  }

  [$('info0'), $('info1')].forEach(function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-open-r]') : null;
      if (!b) return;
      pendingSide = +b.getAttribute('data-open-r');
      fileInput.click();
    });
    el.addEventListener('change', function (e) {
      var t = e.target;
      if (!t.getAttribute || t.getAttribute('data-enc') === null) return;
      var s = sides[+t.getAttribute('data-enc')];
      s.enc = t.value;
      s.textFor = null;
      runCompare();
    });
  });

  // 显示行 -> 数据行
  function rowAtDisplay(l, d) {
    if (!l.segs.length) return 0;
    var seg = l.segs[Core.segIndex(l, d)];
    return seg.t === 1 ? seg.r0 : seg.r0 + (d - seg.d0);
  }

  function rebuildLayout(keepAnchor) {
    var pane = panes[1];
    var anchor = -1;
    if (keepAnchor && lay && lay.total) anchor = rowAtDisplay(lay, Math.min(lay.total - 1, Math.floor(pane.scrollTop / H)));
    var total = mode === 'text' ? res.n : res.rows;
    var iv = mode === 'text' ? { s: res.secStart, e: res.secEnd } : res.iv;
    lay = Core.layout(total, iv, showMode, ctxLines, expanded);
    spacers.forEach(function (s) { s.style.height = (lay.total * H) + 'px'; });
    var top = 0;
    if (anchor >= 0) {
      var d = Core.displayOf(lay, anchor);
      if (d >= 0) top = d * H;
    }
    panes.forEach(function (p) { p.scrollTop = top; });
    rf = rl = -1;
    render(true);
    drawMini();
  }

  // ----- 渲染可视区 -----
  function inlineOf(row) {
    var v = inlineCache.get(row);
    if (v === undefined) {
      v = Core.inlineDiff(res.A.t[res.L[row]], res.B.t[res.R[row]], opts);
      if (inlineCache.size > 5000) inlineCache.clear();
      inlineCache.set(row, v);
    }
    return v;
  }

  function markedText(t, ranges) {
    if (!ranges || !ranges.length) return esc(t);
    var out = '', pos = 0;
    for (var i = 0; i < ranges.length; i++) {
      var a = ranges[i][0], b = ranges[i][1];
      out += esc(t.slice(pos, a)) + '<i>' + esc(t.slice(a, b)) + '</i>';
      pos = b;
    }
    return out + esc(t.slice(pos));
  }

  function textRow(side, row) {
    var kind = res.kind[row];
    var li = side ? res.R[row] : res.L[row];
    if (li < 0) return '<div class="r gap" data-r="' + row + '"><span class="ln"></span></div>';
    var t = (side ? res.B : res.A).t[li];
    var inner;
    if (kind === Core.KIND_CHANGE) {
      var inl = inlineOf(row);
      inner = inl ? markedText(t, side ? inl.b : inl.a) : esc(t.length > MAX_LINE ? t.slice(0, MAX_LINE) : t);
    } else {
      inner = esc(t.length > MAX_LINE ? t.slice(0, MAX_LINE) : t);
    }
    if (t.length > MAX_LINE) inner += '…';
    var c = 'r k' + kind + (cur >= 0 && res.sec[row] === cur ? ' cur' : '');
    return '<div class="' + c + '" data-r="' + row + '"><span class="ln">' + (li + 1) + '</span><span class="tx">' + inner + '</span></div>';
  }

  function binRow(side, row) {
    var u = side ? res.b : res.a, o = side ? res.a : res.b;
    var off = row * BPR, len = u.length, olen = o.length;
    if (off >= len) return '<div class="r b gap" data-r="' + row + '"></div>';
    var cs = -1, ce = -1;
    if (cur >= 0) { cs = res.d.starts[cur]; ce = res.d.ends[cur]; }
    var hx = '', as = '', rowdiff = false;
    for (var j = 0; j < BPR; j++) {
      var p = off + j;
      hx += j === 0 ? '' : (j === 8 ? '  ' : ' ');
      if (p >= len) { hx += '<span class="nb">  </span>'; as += ' '; continue; }
      var b = u[p], diff = p >= olen || o[p] !== b;
      var ch = b >= 0x20 && b < 0x7f ? esc(String.fromCharCode(b)) : '.';
      if (diff) {
        rowdiff = true;
        hx += '<i class="bd' + (p >= cs && p < ce ? ' bc' : '') + '">' + HEX[b] + '</i>';
        as += '<i class="bd' + (p >= cs && p < ce ? ' bc' : '') + '">' + ch + '</i>';
      } else {
        hx += HEX[b];
        as += ch;
      }
    }
    var o8 = ('0000000' + off.toString(16).toUpperCase()).slice(-8);
    if (off > 0xFFFFFFFF) o8 = off.toString(16).toUpperCase();
    return '<div class="r b' + (rowdiff ? ' rowdiff' : '') + '" data-r="' + row + '"><span class="off">' + o8 + '</span><span class="hx">' + hx + '</span><span class="as">' + as + '</span></div>';
  }

  function foldRow(seg) {
    var n = seg.r1 - seg.r0;
    var label = '▸ ' + n + ' 行相同（点击展开）';
    if (mode === 'bin') {
      var a = seg.r0 * BPR, b = seg.r1 * BPR - 1;
      label = '▸ ' + n + ' 行相同，偏移 0x' + a.toString(16).toUpperCase() + ' - 0x' + b.toString(16).toUpperCase() + '（点击展开）';
    }
    return '<div class="r fold" data-f="' + seg.r0 + '"><span>' + label + '</span></div>';
  }

  function render(force) {
    if (view !== 'result' || !lay) return;
    var pane = panes[1];
    var top = pane.scrollTop, hgt = pane.clientHeight;
    var first = Math.max(0, Math.floor(top / H) - BUF);
    var last = Math.min(lay.total, Math.ceil((top + hgt) / H) + BUF);
    if (!force && first === rf && last === rl) { drawMiniViewport(); return; }
    rf = first; rl = last;
    var hl = [], hr = [];
    if (last > first) {
      var si = Core.segIndex(lay, first);
      var seg = lay.segs[si];
      for (var d = first; d < last; d++) {
        while (d >= seg.d0 + (seg.t === 1 ? 1 : seg.r1 - seg.r0)) seg = lay.segs[++si];
        if (seg.t === 1) {
          var f = foldRow(seg);
          hl.push(f); hr.push(f);
        } else {
          var row = seg.r0 + (d - seg.d0);
          if (mode === 'text') { hl.push(textRow(0, row)); hr.push(textRow(1, row)); }
          else { hl.push(binRow(0, row)); hr.push(binRow(1, row)); }
        }
      }
    }
    rowsEl[0].innerHTML = hl.join('');
    rowsEl[1].innerHTML = hr.join('');
    rowsEl[0].style.top = rowsEl[1].style.top = (first * H) + 'px';
    drawMiniViewport();
  }

  function scheduleRender() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; render(false); });
  }

  panes.forEach(function (p, i) {
    p.addEventListener('scroll', function () {
      var o = panes[1 - i];
      if (o.scrollTop !== p.scrollTop) o.scrollTop = p.scrollTop;
      if (o.scrollLeft !== p.scrollLeft) o.scrollLeft = p.scrollLeft;
      scheduleRender();
    });
    p.addEventListener('click', function (e) {
      var r = e.target.closest ? e.target.closest('.r') : null;
      if (!r) return;
      var f = r.getAttribute('data-f');
      if (f !== null) {
        expanded.add(+f);
        rebuildLayout(true);
        return;
      }
      var row = +r.getAttribute('data-r');
      if (mode === 'text') {
        var s = res.sec[row];
        if (s >= 0 && s !== cur) selectItem(s, false);
      }
    });
  });

  // ----- 概览条 -----
  function itemCount() { return mode === 'text' ? res.sections : res.d.count; }
  function itemRow(k) { return mode === 'text' ? res.secStart[k] : Math.floor(res.d.starts[k] / BPR); }
  function itemRows(k) {
    return mode === 'text' ? res.secEnd[k] - res.secStart[k] : Math.floor((res.d.ends[k] - 1) / BPR) - Math.floor(res.d.starts[k] / BPR) + 1;
  }

  function drawMini() {
    if (view !== 'result' || !lay) return;
    var h = mini.clientHeight, w = mini.clientWidth, dpr = window.devicePixelRatio || 1;
    if (!h || !w) return;
    markCv.width = Math.round(w * dpr);
    markCv.height = Math.round(h * dpr);
    var c = markCv.getContext('2d');
    c.scale(dpr, dpr);
    c.fillStyle = '#f3f7ff';
    c.fillRect(0, 0, w, h);
    if (lay.total) {
      var n = itemCount();
      for (var k = 0; k < n; k++) {
        if (k === cur) continue;
        drawMark(c, k, h, w, '#e57373');
      }
      if (cur >= 0 && cur < n) drawMark(c, cur, h, w, '#b71c1c');
    }
    drawMiniViewport();
  }

  function drawMark(c, k, h, w, color) {
    var d = Core.displayOf(lay, itemRow(k));
    if (d < 0) return;
    var y = d / lay.total * h, hh = Math.max(2, itemRows(k) / lay.total * h);
    c.fillStyle = color;
    c.fillRect(2, Math.floor(y), w - 4, Math.ceil(hh));
  }

  function drawMiniViewport() {
    if (view !== 'result' || !lay) return;
    var h = mini.clientHeight, w = mini.clientWidth, dpr = window.devicePixelRatio || 1;
    if (!h || !w) return;
    if (mini.width !== Math.round(w * dpr)) { mini.width = Math.round(w * dpr); mini.height = Math.round(h * dpr); }
    var c = mini.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(markCv, 0, 0);
    c.scale(dpr, dpr);
    var pane = panes[1], tot = lay.total * H;
    if (!tot) return;
    var y = pane.scrollTop / tot * h, vh = Math.max(4, Math.min(h, pane.clientHeight / tot * h));
    c.fillStyle = 'rgba(47, 124, 240, .18)';
    c.fillRect(0, y, w, vh);
    c.strokeStyle = '#2f7cf0';
    c.lineWidth = 1;
    c.strokeRect(0.5, y + 0.5, w - 1, Math.max(1, vh - 1));
  }

  var miniDown = false;
  function miniJump(e) {
    if (!lay || !lay.total) return;
    var r = mini.getBoundingClientRect();
    var y = Math.max(0, Math.min(r.height, e.clientY - r.top));
    var target = y / r.height * lay.total * H - panes[1].clientHeight / 2;
    panes[1].scrollTop = Math.max(0, target);
  }
  mini.addEventListener('mousedown', function (e) { miniDown = true; miniJump(e); e.preventDefault(); });
  window.addEventListener('mousemove', function (e) { if (miniDown) miniJump(e); });
  window.addEventListener('mouseup', function () { miniDown = false; });

  // ----- 差异导航 -----
  function selectItem(k, scroll) {
    cur = k;
    if (scroll) {
      var d = Core.displayOf(lay, itemRow(k));
      if (d >= 0) panes[1].scrollTop = Math.max(0, d * H - panes[1].clientHeight / 3);
    }
    render(true);
    drawMini();
    updateStatus();
  }

  function nav(dir) {
    if (view !== 'result') return;
    var n = itemCount();
    if (!n) { toast('没有差异'); return; }
    if (showMode === 'same') { toast('当前为“仅相同”视图，请切换到“全部”或“仅差异”'); return; }
    var k;
    if (cur < 0) {
      var topD = Math.floor(panes[1].scrollTop / H);
      var lo = 0, hi = n;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (Core.displayOf(lay, itemRow(mid)) >= topD) hi = mid; else lo = mid + 1;
      }
      k = dir > 0 ? lo : lo - 1;
      if (k >= n) { k = 0; toast('已回到第一处差异'); }
      else if (k < 0) { k = n - 1; toast('已到最后一处差异'); }
    } else {
      k = cur + dir;
      if (k >= n) { k = 0; toast('已回到第一处差异'); }
      else if (k < 0) { k = n - 1; toast('已到最后一处差异'); }
    }
    selectItem(k, true);
  }

  function gotoOffset() {
    if (view !== 'result' || mode !== 'bin') return;
    var v = $('gotoOff').value.trim().replace(/^0x/i, '');
    if (!/^[0-9a-f]+$/i.test(v)) { toast('请输入十六进制偏移，如 1F40'); return; }
    var off = parseInt(v, 16);
    var max = Math.max(res.a.length, res.b.length);
    if (off >= max) { toast('偏移超出文件范围（最大 0x' + Math.max(0, max - 1).toString(16).toUpperCase() + '）'); return; }
    var d = Core.displayOf(lay, Math.floor(off / BPR));
    if (d < 0) { toast('该偏移所在行在当前视图中被隐藏，请切换到“全部”'); return; }
    if (lay.segs[Core.segIndex(lay, d)].t === 1) {
      expanded.add(lay.segs[Core.segIndex(lay, d)].r0);
      rebuildLayout(false);
      d = Core.displayOf(lay, Math.floor(off / BPR));
    }
    panes[1].scrollTop = Math.max(0, d * H - panes[1].clientHeight / 3);
  }

  // ----- 状态栏 -----
  function updateStatus() {
    if (view !== 'result') return;
    var parts = [], cls = '';
    if (mode === 'text') {
      var st = res.stats, n = res.sections;
      if (!n) {
        var ign = [];
        if (st.minor) ign.push(st.minor + ' 行空白/大小写差异');
        if (res.eolA !== res.eolB) ign.push('换行符不同（' + res.eolA + ' / ' + res.eolB + '）');
        parts.push(ign.length ? '内容相同（已忽略：' + ign.join('，') + '）' : '两侧内容相同');
        cls = 'ok';
      } else {
        parts.push('共 ' + n + ' 处差异');
        parts.push('修改 ' + st.changed + ' 行');
        parts.push('仅左侧 ' + st.leftOnly + ' 行');
        parts.push('仅右侧 ' + st.rightOnly + ' 行');
        if (st.minor) parts.push('可忽略差异 ' + st.minor + ' 行');
        if (cur >= 0) parts.push('当前 ' + (cur + 1) + '/' + n);
      }
      if (res.timedOut) { parts.push('对比超时，结果可能不是最小差异'); cls = cls || 'warn'; }
    } else {
      var d = res.d;
      if (!d.count) { parts.push('两个文件完全相同（' + fmtSize(d.lenA) + '）'); cls = 'ok'; }
      else {
        parts.push('共 ' + d.count + (d.truncated ? '+' : '') + ' 处差异区段');
        parts.push('不同字节 ' + d.diffBytes);
        if (d.lenA !== d.lenB) parts.push('大小不同：' + d.lenA + ' / ' + d.lenB + ' 字节');
        parts.push('首处偏移 0x' + d.starts[0].toString(16).toUpperCase());
        if (cur >= 0) parts.push('当前 ' + (cur + 1) + '/' + d.count + '，偏移 0x' + d.starts[cur].toString(16).toUpperCase() + '，长度 ' + (d.ends[cur] - d.starts[cur]));
        if (d.truncated) { parts.push('差异区段过多，仅列出前 ' + d.count + ' 处'); cls = 'warn'; }
      }
    }
    parts.push('耗时 ' + res.ms + ' ms');
    setStatus(parts.join(' · '), cls);
  }

  // ===================== 工具栏 =====================
  function setView(v) {
    view = v;
    $('inputView').hidden = v !== 'input';
    $('resView').hidden = v !== 'result';
    $('btnEdit').hidden = v !== 'result';
    $('btnCompare').textContent = v === 'result' ? '重新对比' : '对比';
    var dis = v !== 'result';
    ['btnPrev', 'btnNext', 'btnGoto'].forEach(function (id) { $(id).disabled = dis; });
    document.querySelectorAll('[data-view]').forEach(function (b) { b.disabled = dis; });
    $('ctxNum').disabled = dis;
  }

  function backToInput() {
    res = null; lay = null; cur = -1;
    showNotice('');
    setView('input');
    sides.forEach(function (_, i) { renderInput(i); });
    setStatus('请在左右两侧输入文本或打开文件，然后点击“对比”');
  }

  function setMode(m) {
    if (m === mode) return;
    mode = m;
    $('modeText').className = 'btn sm' + (m === 'text' ? '' : ' ghost');
    $('modeBin').className = 'btn sm' + (m === 'bin' ? '' : ' ghost');
    document.querySelectorAll('[data-for]').forEach(function (el) { el.hidden = el.getAttribute('data-for') !== m; });
    document.querySelectorAll('[data-view]').forEach(function (b) {
      if (b.getAttribute('data-view') === 'diff') b.title = m === 'text' ? '隐藏相同内容，只显示差异及其上下几行' : '隐藏相同的字节行，只显示有差异的行及其上下几行';
    });
    if (view === 'result') runCompare();
    else sides.forEach(function (_, i) { renderInput(i); });
  }

  $('modeText').addEventListener('click', function () { setMode('text'); });
  $('modeBin').addEventListener('click', function () { setMode('bin'); });
  $('btnCompare').addEventListener('click', runCompare);
  $('btnEdit').addEventListener('click', backToInput);
  $('btnSwap').addEventListener('click', function () {
    sides.reverse();
    sides.forEach(function (_, i) { renderInput(i); });
    if (view === 'result') runCompare();
  });
  $('btnPrev').addEventListener('click', function () { nav(-1); });
  $('btnNext').addEventListener('click', function () { nav(1); });
  $('btnGoto').addEventListener('click', gotoOffset);
  $('gotoOff').addEventListener('keydown', function (e) { if (e.key === 'Enter') gotoOffset(); });

  function rerunIfText() { if (view === 'result' && mode === 'text') runCompare(); }
  $('selWs').addEventListener('change', function () { opts.ws = this.value; rerunIfText(); });
  $('chkEol').addEventListener('change', function () { opts.ignoreEol = this.checked; rerunIfText(); });
  $('chkCase').addEventListener('change', function () { opts.icase = this.checked; rerunIfText(); });

  document.querySelectorAll('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      showMode = b.getAttribute('data-view');
      document.querySelectorAll('[data-view]').forEach(function (x) {
        x.className = 'btn sm' + (x === b ? '' : ' ghost');
      });
      if (view === 'result') rebuildLayout(true);
    });
  });

  $('ctxNum').addEventListener('change', function () {
    var v = parseInt(this.value, 10);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 50) v = 50;
    this.value = v;
    ctxLines = v;
    expanded.clear();
    if (view === 'result') rebuildLayout(true);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'F8') { e.preventDefault(); nav(e.shiftKey ? -1 : 1); }
    else if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); nav(1); }
    else if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); nav(-1); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !(e.target && e.target.tagName === 'TEXTAREA')) { e.preventDefault(); runCompare(); }
  });

  window.addEventListener('resize', function () {
    if (view !== 'result') return;
    render(true);
    drawMini();
  });

  // ===================== 初始化 =====================
  (function init() {
    var probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:13px/20px Consolas,"SFMono-Regular","Courier New",monospace';
    probe.textContent = new Array(101).join('M');
    document.body.appendChild(probe);
    var w = probe.getBoundingClientRect().width / 100;
    if (w > 4) charW = w;
    document.body.removeChild(probe);

    document.querySelectorAll('[data-for]').forEach(function (el) { el.hidden = el.getAttribute('data-for') !== mode; });
    setView('input');
    sides.forEach(function (_, i) { renderInput(i); });
  })();
})();
