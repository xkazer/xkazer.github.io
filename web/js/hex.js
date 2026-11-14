(function () {
  'use strict';

  var Core = window.HexCore;
  var doc = new Core.Doc();

  // ===== 常量 =====
  var ROW_H = 22;
  var HEAD_H = 28;
  var PAD_X = 16;
  var MAX_SPACER = 8000000;          // 滚动条占位高度上限（避免超过浏览器限制）
  var MAX_COPY = 16 * 1024 * 1024;
  var MAX_LIST = 1000;               // 查找结果列表最多展示条数
  var MAX_FIND_ALL = 100000;
  var FONT = '15px Consolas, "Courier New", monospace';
  var BOLD_FONT = 'bold 15px Consolas, "Courier New", monospace';
  var COLORS = {
    bg: '#ffffff', head: '#eef4fd', headLine: '#d4e4fc', line: '#e3ecfa',
    offset: '#1a47c8', text: '#16306b', mod: '#d93025', dim: '#9aa9c4',
    sel: '#d6e4fb', cursor: '#9dbaf3', cursorLine: '#1457d9', rowBg: '#f6faff', empty: '#7b8798'
  };

  function $(id) { return document.getElementById(id); }

  var canvas = $('hexCanvas');
  var ctx = canvas.getContext('2d');
  var wrap = $('hexWrap');
  var main = $('hexMain');
  var scroller = $('hexScroll');
  var spacer = $('hexSpacer');
  var sink = $('hexSink');
  var fileInput = $('fileInput');

  // ===== 状态 =====
  var S = {
    loaded: false, name: '',
    bpr: 16, charset: 'ascii', insert: false, area: 'hex',
    anchor: 0, cur: 0, nib: 0, topRow: 0
  };
  // 布局度量
  var L = {
    cw: 9, offDigits: 8, hexStart: 0, asciiStart: 0, width: 0, height: 0,
    visRows: 10, totalRows: 1, maxTop: 0, capped: false, dpr: 1, sbw: 0
  };
  var lastHit = null;     // 最近一次查找命中 {start, len}；光标/选区被其他操作改变后置空
  var dragging = false;
  var raf = 0;
  var groupId = 0;
  var glyphs = [];

  // ===== 工具函数 =====
  var toastTimer = 0;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  function hexX(i) { return L.hexStart + i * 3 * L.cw + Math.floor(i / 8) * L.cw; }

  function offStr(v, digits) {
    var s = v.toString(16).toUpperCase();
    digits = digits || L.offDigits;
    while (s.length < digits) s = '0' + s;
    return s;
  }

  function fmtSize(n) {
    var s = n + ' 字节';
    if (n >= 1024 * 1024) s += '（' + (n / 1024 / 1024).toFixed(2) + ' MB）';
    else if (n >= 1024) s += '（' + (n / 1024).toFixed(2) + ' KB）';
    return s;
  }

  function buildGlyphs() {
    glyphs = [];
    for (var v = 0; v < 256; v++) {
      var ok = (v >= 0x20 && v < 0x7F) || (S.charset === 'ansi' && v >= 0xA0);
      glyphs.push(ok ? String.fromCharCode(v) : '.');
    }
  }

  function selRange() {
    var size = doc.size();
    var s = Math.min(S.anchor, S.cur);
    var e = Math.min(Math.max(S.anchor, S.cur), size - 1);
    if (S.anchor === S.cur || e < s) return null;
    return { s: s, e: e, len: e - s + 1 };
  }

  // ===================== 布局与滚动 =====================
  function measureScrollbar() {
    var d = document.createElement('div');
    d.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll';
    document.body.appendChild(d);
    var w = d.offsetWidth - d.clientWidth;
    document.body.removeChild(d);
    return w;
  }

  function layout() {
    ctx.font = FONT;
    var cw = ctx.measureText('0').width || 9;
    L.cw = cw;
    L.offDigits = Math.max(8, doc.size().toString(16).length);
    L.hexStart = PAD_X + L.offDigits * cw + 2 * cw;
    L.asciiStart = hexX(S.bpr - 1) + 2 * cw + 3 * cw;
    L.width = Math.ceil(L.asciiStart + S.bpr * cw + PAD_X);

    L.visRows = Math.max(4, Math.floor((main.clientHeight - HEAD_H) / ROW_H));
    L.height = HEAD_H + L.visRows * ROW_H;
    L.dpr = window.devicePixelRatio || 1;

    wrap.style.width = (L.width + L.sbw) + 'px';
    wrap.style.height = L.height + 'px';
    scroller.style.top = HEAD_H + 'px';
    canvas.width = Math.round(L.width * L.dpr);
    canvas.height = Math.round(L.height * L.dpr);
    canvas.style.width = L.width + 'px';
    canvas.style.height = L.height + 'px';
    updateScroll();
    invalidate();
  }

  function spacerHeight() { return L.capped ? MAX_SPACER : L.totalRows * ROW_H; }

  function scrollFromRow(row) {
    if (L.maxTop === 0) return 0;
    if (!L.capped) return row * ROW_H;
    return row / L.maxTop * (MAX_SPACER - L.visRows * ROW_H);
  }

  function rowFromScroll(st) {
    if (L.maxTop === 0) return 0;
    var row = L.capped ? st / (MAX_SPACER - L.visRows * ROW_H) * L.maxTop : st / ROW_H;
    return Math.max(0, Math.min(L.maxTop, Math.round(row)));
  }

  // 程序设置滚动位置后记录实际生效值，scroll 事件据此区分"程序设置"与"用户拖动"，
  // 避免超大文件上像素取整把行号反推偏移
  var programmaticScroll = -1;

  function applyScroll(row) {
    scroller.scrollTop = scrollFromRow(row);
    programmaticScroll = scroller.scrollTop;
  }

  function updateScroll() {
    L.totalRows = Math.floor(doc.size() / S.bpr) + 1;
    L.maxTop = Math.max(0, L.totalRows - L.visRows);
    L.capped = L.totalRows * ROW_H > MAX_SPACER;
    spacer.style.height = spacerHeight() + 'px';
    if (S.topRow > L.maxTop) S.topRow = L.maxTop;
    applyScroll(S.topRow);
  }

  function setTop(row) {
    row = Math.max(0, Math.min(L.maxTop, Math.round(row)));
    if (row === S.topRow) return;
    S.topRow = row;
    applyScroll(row);
    invalidate();
  }

  // 保证光标可见；center 为 true 时滚动到屏幕中部
  function reveal(center) {
    var row = Math.floor(S.cur / S.bpr);
    if (row >= S.topRow && row < S.topRow + L.visRows) return;
    if (center) setTop(row - Math.floor(L.visRows / 2));
    else setTop(row < S.topRow ? row : row - L.visRows + 1);
  }

  scroller.addEventListener('scroll', function () {
    if (scroller.scrollTop === programmaticScroll) return;
    var row = rowFromScroll(scroller.scrollTop);
    if (row !== S.topRow) {
      S.topRow = row;
      invalidate();
    }
  });

  // ===================== 绘制 =====================
  function invalidate() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function drawHeader() {
    var mid = HEAD_H / 2 + 1;
    ctx.fillStyle = COLORS.head;
    ctx.fillRect(0, 0, L.width, HEAD_H);
    ctx.fillStyle = COLORS.headLine;
    ctx.fillRect(0, HEAD_H - 1, L.width, 1);
    ctx.font = BOLD_FONT;
    ctx.fillStyle = COLORS.offset;
    ctx.textAlign = 'left';
    ctx.fillText('Offset', PAD_X, mid);
    ctx.textAlign = 'center';
    for (var i = 0; i < S.bpr; i++) ctx.fillText(i.toString(16).toUpperCase(), hexX(i) + L.cw, mid);
    ctx.textAlign = 'left';
    ctx.fillText(S.charset === 'ansi' ? 'ANSI' : 'ASCII', L.asciiStart, mid);
  }

  function drawCursor(y, ci) {
    var cw = L.cw, hx = hexX(ci), ax = L.asciiStart + ci * cw;
    var hexActive = S.area === 'hex';

    function active(x, w, nibble) {
      if (S.insert) {
        ctx.fillStyle = COLORS.cursorLine;
        ctx.fillRect(x + nibble, y + 2, 2, ROW_H - 4);
      } else {
        ctx.fillStyle = COLORS.cursor;
        ctx.fillRect(x - 1, y + 1, w + 2, ROW_H - 2);
        if (nibble !== null && hexActive) {
          ctx.strokeStyle = COLORS.cursorLine;
          ctx.strokeRect(x + nibble - 0.5, y + 1.5, cw + 1, ROW_H - 3);
        }
      }
    }
    function passive(x, w) {
      ctx.strokeStyle = COLORS.cursorLine;
      ctx.strokeRect(x - 0.5, y + 1.5, w + 1, ROW_H - 3);
    }

    if (hexActive) {
      active(hx, 2 * cw, S.nib * cw);
      passive(ax, cw);
    } else {
      active(ax, cw, 0);
      passive(hx, 2 * cw);
    }
  }

  function draw() {
    raf = 0;
    var size = doc.size();
    var digits = Math.max(8, size.toString(16).length);
    if (digits !== L.offDigits) { layout(); return; }

    var cw = L.cw, bpr = S.bpr, data = doc.data;
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, L.width, L.height);
    ctx.textBaseline = 'middle';

    if (!S.loaded) {
      ctx.font = FONT;
      ctx.fillStyle = COLORS.empty;
      ctx.textAlign = 'center';
      ctx.fillText('点击此处选择文件，或将文件拖放到页面中', L.width / 2, HEAD_H + (L.height - HEAD_H) / 2);
      ctx.textAlign = 'left';
      drawHeader();
      return;
    }

    // 竖线分隔
    ctx.fillStyle = COLORS.line;
    ctx.fillRect(Math.round(L.hexStart - cw), HEAD_H, 1, L.height - HEAD_H);
    ctx.fillRect(Math.round(L.asciiStart - 1.5 * cw), HEAD_H, 1, L.height - HEAD_H);

    var sel = selRange();
    var cur = S.cur;
    ctx.font = FONT;
    ctx.textAlign = 'left';

    for (var k = 0; k < L.visRows; k++) {
      var base = (S.topRow + k) * bpr;
      if (base > size) break;
      var y = HEAD_H + k * ROW_H, cy = y + ROW_H / 2 + 1;
      var count = Math.min(bpr, size - base);
      var i, x;

      if (cur >= base && cur < base + bpr) {
        ctx.fillStyle = COLORS.rowBg;
        ctx.fillRect(0, y, L.width, ROW_H);
      }

      if (sel && sel.e >= base && sel.s < base + bpr) {
        var c0 = Math.max(sel.s, base) - base, c1 = Math.min(sel.e, base + bpr - 1) - base;
        ctx.fillStyle = COLORS.sel;
        for (i = c0; i <= c1; i++) {
          x = hexX(i);
          var x1 = x + 2.5 * cw + (i < c1 && i % 8 === 7 ? cw : 0);
          ctx.fillRect(x - 0.5 * cw, y + 1, x1 - x + 0.5 * cw, ROW_H - 2);
        }
        ctx.fillRect(L.asciiStart + c0 * cw, y + 1, (c1 - c0 + 1) * cw, ROW_H - 2);
      }

      if (cur >= base && cur < base + bpr) drawCursor(y, cur - base);

      ctx.fillStyle = COLORS.offset;
      ctx.fillText(offStr(base), PAD_X, cy);

      var color = '';
      for (i = 0; i < count; i++) {
        var idx = base + i, v = data[idx];
        var c = doc.isModified(idx) ? COLORS.mod : COLORS.text;
        if (c !== color) { ctx.fillStyle = c; color = c; }
        ctx.fillText(Core.HEX[v], hexX(i), cy);
      }
      for (i = 0; i < count; i++) {
        var v2 = data[base + i], g = glyphs[v2];
        var c2 = doc.isModified(base + i) ? COLORS.mod : (g === '.' ? COLORS.dim : COLORS.text);
        if (c2 !== color) { ctx.fillStyle = c2; color = c2; }
        ctx.fillText(g, L.asciiStart + i * cw, cy);
      }
    }
    drawHeader();
  }

  // ===================== 状态栏与按钮 =====================
  function updateStatus() {
    var size = doc.size();
    $('fileName').textContent = S.loaded ? S.name : '';
    document.title = (S.loaded ? S.name + ' - ' : '') + '十六进制编辑器 - xkazer';
    $('stFile').textContent = S.loaded ? S.name + '  ·  ' + fmtSize(size) : '未打开文件';
    $('stMode').textContent = S.insert ? '插入' : '改写';

    if (!S.loaded) {
      $('stOff').textContent = '-';
      $('stVal').textContent = '-';
      $('stBlock').textContent = '-';
      $('stSel').textContent = '0';
      $('stMod').textContent = '未修改';
      $('stMod').className = '';
      return;
    }
    var cur = S.cur, r = selRange();
    $('stOff').textContent = offStr(cur);
    $('stOff').title = '十进制：' + cur;
    $('stVal').textContent = cur < size ? String(doc.data[cur]) : '-';
    $('stVal').title = cur < size ? '十六进制：' + Core.HEX[doc.data[cur]] + '，二进制：' + ('0000000' + doc.data[cur].toString(2)).slice(-8) : '';
    $('stBlock').textContent = r ? offStr(r.s) + ' - ' + offStr(r.e) : '-';
    $('stSel').textContent = r ? String(r.len) : '0';
    var dirty = doc.isDirty();
    $('stMod').textContent = dirty ? '已修改' : '未修改';
    $('stMod').className = dirty ? 'dirty' : '';
  }

  function updateButtons() {
    var on = S.loaded;
    $('btnSave').disabled = !on;
    $('btnUndo').disabled = !doc.canUndo();
    $('btnRedo').disabled = !doc.canRedo();
    $('btnFind').disabled = !on;
    $('btnReplace').disabled = !on;
    $('btnGoto').disabled = !on;
    $('btnMode').disabled = !on;
    $('btnMode').textContent = S.insert ? '插入' : '改写';
  }

  function refresh() {
    updateStatus();
    updateButtons();
    invalidate();
  }

  // 编辑后的统一收尾
  function afterEdit() {
    updateScroll();
    refresh();
  }

  // ===================== 光标与选区 =====================
  function moveTo(pos, extend) {
    pos = Math.max(0, Math.min(pos, doc.size()));
    S.cur = pos;
    if (!extend) S.anchor = pos;
    S.nib = 0;
    lastHit = null;
    reveal(false);
    updateStatus();
    invalidate();
  }

  function collapseSel() {
    var r = selRange();
    if (!r) return;
    S.cur = r.s;
    S.anchor = r.s;
    S.nib = 0;
  }

  function hitTest(x, y) {
    var cw = L.cw, bpr = S.bpr, size = doc.size();
    var row = Math.max(0, S.topRow + Math.floor(y / ROW_H));
    var area, i;
    if (x >= (hexX(bpr - 1) + 2 * cw + L.asciiStart) / 2) {
      area = 'ascii';
      i = Math.floor((x - L.asciiStart) / cw);
    } else {
      area = 'hex';
      for (i = 0; i < bpr - 1; i++) if (x < hexX(i + 1) - 0.5 * cw) break;
    }
    i = Math.max(0, Math.min(bpr - 1, i));
    return { area: area, pos: Math.min(row * bpr + i, size) };
  }

  scroller.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    var rect = scroller.getBoundingClientRect();
    var x = e.clientX - rect.left;
    if (x > scroller.clientWidth) return;       // 点在滚动条上
    e.preventDefault();
    if (!S.loaded) { fileInput.click(); return; }
    sink.focus();
    var hit = hitTest(x, e.clientY - rect.top);
    S.area = hit.area;
    dragging = true;
    moveTo(hit.pos, e.shiftKey);
  });

  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    var rect = scroller.getBoundingClientRect();
    var hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (hit.pos !== S.cur) moveTo(hit.pos, true);
  });

  window.addEventListener('mouseup', function () { dragging = false; });

  // ===================== 编辑 =====================
  function edit(offset, delLen, ins, group) {
    doc.edit(offset, delLen, ins, group);
    lastHit = null;
    afterEdit();
  }

  function typeNibble(d) {
    collapseSel();
    var cur = S.cur;
    if (S.nib === 0) {
      groupId = doc.newGroup();
      if (cur >= doc.size() || S.insert) edit(cur, 0, [d << 4], groupId);
      else edit(cur, 1, [(d << 4) | (doc.data[cur] & 15)], groupId);
      S.nib = 1;
    } else {
      edit(cur, 1, [(doc.data[cur] & 0xF0) | d], groupId);
      S.cur = cur + 1;
      S.anchor = S.cur;
      S.nib = 0;
    }
    reveal(false);
    updateStatus();
    invalidate();
  }

  function typeChar(ch) {
    var code = ch.charCodeAt(0);
    if (code > 255) { toast('该字符无法直接输入，请在十六进制区或查找替换中处理'); return; }
    collapseSel();
    var cur = S.cur;
    if (cur >= doc.size() || S.insert) edit(cur, 0, [code], 0);
    else edit(cur, 1, [code], 0);
    S.cur = cur + 1;
    S.anchor = S.cur;
    reveal(false);
    updateStatus();
    invalidate();
  }

  function doDelete(backspace) {
    var r = selRange();
    if (r) {
      edit(r.s, r.len, [], 0);
      S.cur = S.anchor = r.s;
    } else if (backspace) {
      if (S.cur === 0) return;
      edit(S.cur - 1, 1, [], 0);
      S.cur = S.anchor = S.cur - 1;
    } else {
      if (S.cur >= doc.size()) return;
      edit(S.cur, 1, [], 0);
    }
    S.nib = 0;
    reveal(false);
    updateStatus();
    invalidate();
  }

  function pasteBytes(bytes) {
    if (!bytes.length) return;
    var r = selRange(), size = doc.size(), s, del;
    if (r) {
      s = r.s;
      del = r.len;
    } else {
      s = S.cur;
      del = (S.insert || s >= size) ? 0 : Math.min(bytes.length, size - s);
    }
    edit(s, del, bytes, 0);
    S.cur = S.anchor = s + bytes.length;
    S.nib = 0;
    reveal(false);
    updateStatus();
    invalidate();
  }

  function afterHistory(res) {
    if (!res) return;
    if (res.pos !== null) S.cur = res.pos;
    S.cur = Math.min(S.cur, doc.size());
    S.anchor = S.cur;
    S.nib = 0;
    lastHit = null;
    updateScroll();
    reveal(false);
    refresh();
  }

  function undo() { afterHistory(doc.undo()); }
  function redo() { afterHistory(doc.redo()); }

  function toggleMode() {
    S.insert = !S.insert;
    refresh();
  }

  // ===================== 剪贴板 =====================
  function copyText() {
    var r = selRange(), s, len;
    if (r) { s = r.s; len = r.len; }
    else if (S.cur < doc.size()) { s = S.cur; len = 1; }
    else return null;
    if (len > MAX_COPY) { toast('选区过大，无法复制（上限 16MB）'); return null; }
    var bytes = doc.data.subarray(s, s + len);
    if (S.area === 'hex') return Core.toHex(bytes, ' ');
    var out = new Array(len);
    for (var i = 0; i < len; i++) out[i] = glyphs[bytes[i]];
    return out.join('');
  }

  sink.addEventListener('copy', function (e) {
    if (!S.loaded) return;
    var t = copyText();
    if (t === null) return;
    e.clipboardData.setData('text/plain', t);
    e.preventDefault();
  });

  sink.addEventListener('cut', function (e) {
    if (!S.loaded) return;
    var t = copyText();
    if (t === null) return;
    e.clipboardData.setData('text/plain', t);
    e.preventDefault();
    doDelete(false);
  });

  sink.addEventListener('paste', function (e) {
    e.preventDefault();
    if (!S.loaded) return;
    var text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;
    var bytes;
    try {
      bytes = S.area === 'hex' ? Core.parseHex(text, false).b : Core.textBytes(text, 'auto');
    } catch (err) {
      toast('粘贴失败：' + err.message);
      return;
    }
    pasteBytes(bytes);
  });

  sink.addEventListener('input', function () { sink.value = ''; });

  // ===================== 键盘 =====================
  sink.addEventListener('keydown', function (e) {
    if (!S.loaded) return;
    var ctrl = e.ctrlKey || e.metaKey;
    var size = doc.size(), last = Math.max(size - 1, 0);
    var key = e.key, handled = true;

    if (ctrl) {
      switch (key.toLowerCase()) {
        case 'z': if (e.shiftKey) redo(); else undo(); break;
        case 'y': redo(); break;
        case 'a':
          S.anchor = 0;
          S.cur = last;
          S.nib = 0;
          lastHit = null;
          updateStatus();
          invalidate();
          break;
        case 'home': moveTo(0, e.shiftKey); break;
        case 'end': moveTo(last, e.shiftKey); break;
        default: handled = false;     // 复制/粘贴/剪切及全局快捷键交由其他处理
      }
      if (handled) e.preventDefault();
      return;
    }

    switch (key) {
      case 'ArrowLeft': moveTo(S.cur - 1, e.shiftKey); break;
      case 'ArrowRight': moveTo(S.cur + 1, e.shiftKey); break;
      case 'ArrowUp': moveTo(Math.max(0, S.cur - S.bpr), e.shiftKey); break;
      case 'ArrowDown': moveTo(Math.min(last, S.cur + S.bpr), e.shiftKey); break;
      case 'PageUp': moveTo(Math.max(0, S.cur - S.bpr * L.visRows), e.shiftKey); break;
      case 'PageDown': moveTo(Math.min(last, S.cur + S.bpr * L.visRows), e.shiftKey); break;
      case 'Home': moveTo(S.cur - S.cur % S.bpr, e.shiftKey); break;
      case 'End': moveTo(Math.min(last, S.cur - S.cur % S.bpr + S.bpr - 1), e.shiftKey); break;
      case 'Tab':
        S.area = S.area === 'hex' ? 'ascii' : 'hex';
        S.nib = 0;
        invalidate();
        break;
      case 'Insert': toggleMode(); break;
      case 'Delete': doDelete(false); break;
      case 'Backspace':
        if (S.insert || selRange()) doDelete(true);
        else moveTo(S.cur - 1, false);
        break;
      case 'Escape': moveTo(S.cur, false); break;
      default:
        if (key.length === 1 && !e.altKey) {
          if (S.area === 'hex') {
            if (/^[0-9a-fA-F]$/.test(key)) typeNibble(parseInt(key, 16));
          } else {
            typeChar(key);
          }
        } else {
          handled = false;
        }
    }
    if (handled) e.preventDefault();
  });

  // 全局快捷键：焦点在查找框等输入控件内也生效
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    var k = e.key.toLowerCase();

    // 撤销/重做：焦点在按钮等非文本控件上时也生效（文本框保留其自身的撤销）
    if (k === 'z' || k === 'y') {
      var t = e.target, tag = t && t.tagName;
      var isText = tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && t.type !== 'checkbox' && t.type !== 'button');
      if (S.loaded && !isText) {
        e.preventDefault();
        if (k === 'y' || e.shiftKey) redo(); else undo();
      }
      return;
    }

    if (e.shiftKey || (k !== 'f' && k !== 'h' && k !== 'g' && k !== 's')) return;
    e.preventDefault();
    if (k === 's') save();
    else if (k === 'f') openFind(false);
    else if (k === 'h') openFind(true);
    else openGoto();
  });

  // ===================== 文件 =====================
  function loadFile(file) {
    if (!file) return;
    if (doc.isDirty() && !window.confirm('当前文件有未保存的修改，确定要打开新文件吗？')) return;
    $('stFile').textContent = '正在读取 ' + file.name + ' ...';
    file.arrayBuffer().then(function (buf) {
      doc.load(new Uint8Array(buf));
      S.loaded = true;
      S.name = file.name;
      S.anchor = S.cur = 0;
      S.nib = 0;
      S.topRow = 0;
      lastHit = null;
      closeFind();
      closeGoto();
      layout();
      refresh();
      sink.focus();
    }).catch(function () {
      toast('读取文件失败，文件可能过大');
      updateStatus();
    });
  }

  function save() {
    if (!S.loaded) return;
    var blob = new Blob([doc.data], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = S.name || 'file.bin';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    doc.markClean();
    refresh();
    toast('已开始下载：' + a.download);
  }

  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    loadFile(f);
  });

  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('drop', function (e) {
    e.preventDefault();
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    loadFile(f);
  });

  window.addEventListener('beforeunload', function (e) {
    if (doc.isDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ===================== 转到 =====================
  var gp = { panel: $('gotoPanel'), input: $('gInput'), base: $('gBase'), msg: $('gMsg') };

  function openGoto() {
    if (!S.loaded) { toast('请先打开文件'); return; }
    closeFind();
    gp.panel.hidden = false;
    gp.msg.textContent = '';
    gp.input.focus();
    gp.input.select();
  }

  function closeGoto() {
    if (gp.panel.hidden) return;
    gp.panel.hidden = true;
    sink.focus();
  }

  function doGoto() {
    var s = gp.input.value.trim(), rel = 0;
    var base = gp.base.value === 'dec' ? 10 : 16;
    gp.msg.className = 'fp-msg err';
    if (!s) return;
    if (s.charAt(0) === '+' || s.charAt(0) === '-') {
      rel = s.charAt(0) === '-' ? -1 : 1;
      s = s.slice(1).trim();
    }
    if (base === 16) s = s.replace(/^0x/i, '');
    if (!(base === 16 ? /^[0-9a-f]+$/i : /^\d+$/).test(s)) {
      gp.msg.textContent = '请输入有效的' + (base === 16 ? '十六进制' : '十进制') + '数字';
      return;
    }
    var v = parseInt(s, base);
    var pos = rel ? S.cur + rel * v : v;
    var max = Math.max(doc.size() - 1, 0);
    if (pos < 0 || pos > max) {
      gp.msg.textContent = '超出范围（0 ~ ' + offStr(max) + '）';
      return;
    }
    gp.msg.textContent = '';
    S.area = 'hex';
    moveTo(pos, false);
    reveal(true);
    sink.focus();
  }

  // ===================== 查找 / 替换 =====================
  var fp = {
    panel: $('findPanel'), input: $('fInput'), type: $('fType'), enc: $('fEnc'),
    icase: $('fCase'), rRow: $('rRow'), rInput: $('rInput'), msg: $('fMsg'), results: $('fResults'),
    repOnly: document.querySelector('.rep-only')
  };

  function syncFindOptions() {
    var text = fp.type.value === 'text';
    fp.enc.disabled = !text;
    fp.icase.disabled = !text;
  }

  function setMsg(t, err) {
    fp.msg.textContent = t || '';
    fp.msg.className = 'fp-msg' + (err ? ' err' : '');
  }

  function openFind(withReplace) {
    if (!S.loaded) { toast('请先打开文件'); return; }
    closeGoto();
    fp.panel.hidden = false;
    fp.rRow.hidden = !withReplace;
    fp.repOnly.hidden = !withReplace;
    var r = selRange();
    if (r && r.len <= 64 && fp.type.value === 'hex') fp.input.value = Core.toHex(doc.data.subarray(r.s, r.s + r.len), ' ');
    syncFindOptions();
    setMsg('');
    fp.input.focus();
    fp.input.select();
  }

  function closeFind() {
    if (fp.panel.hidden) return;
    fp.panel.hidden = true;
    fp.results.hidden = true;
    sink.focus();
  }

  function getPattern() {
    var s = fp.input.value;
    if (fp.type.value === 'hex') return Core.parseHex(s, true);
    return Core.textPattern(s, fp.enc.value, fp.icase.checked);
  }

  function getReplacement() {
    var s = fp.rInput.value;
    if (fp.type.value === 'hex') return s.trim() ? Core.parseHex(s, false).b : new Uint8Array(0);
    return Core.textBytes(s, fp.enc.value);
  }

  function selectMatch(pos, len) {
    S.anchor = pos;
    S.cur = pos + len - 1;
    S.area = fp.type.value === 'hex' ? 'hex' : 'ascii';
    S.nib = 0;
    lastHit = { start: pos, len: len };
    reveal(true);
    updateStatus();
    invalidate();
  }

  function runFind(forward) {
    var pat;
    try { pat = getPattern(); } catch (e) { setMsg(e.message, true); return false; }
    var r = selRange(), from;
    if (forward) from = lastHit ? lastHit.start + 1 : (r ? r.s + 1 : S.cur);
    else from = lastHit ? lastHit.start - 1 : (r ? r.s - 1 : S.cur - 1);
    var res = Core.findNext(doc.data, pat, from, forward, true);
    if (res.pos < 0) { setMsg('未找到', true); return false; }
    selectMatch(res.pos, pat.len);
    setMsg((res.wrapped ? '已循环到' + (forward ? '文件开头' : '文件末尾') + '，' : '') + '找到：偏移 ' + offStr(res.pos), false);
    return true;
  }

  function runFindAll() {
    var pat;
    try { pat = getPattern(); } catch (e) { setMsg(e.message, true); return; }
    var list = Core.findAll(doc.data, pat, MAX_FIND_ALL, false);
    fp.results.textContent = '';
    if (!list.length) { fp.results.hidden = true; setMsg('未找到', true); return; }

    var frag = document.createDocumentFragment();
    var shown = Math.min(list.length, MAX_LIST);
    for (var i = 0; i < shown; i++) {
      var p = list[i];
      var take = Math.min(pat.len, 12);
      var bytes = doc.data.subarray(p, p + take);
      var ascii = '';
      for (var j = 0; j < bytes.length; j++) ascii += glyphs[bytes[j]];
      var row = document.createElement('div');
      row.className = 'hit';
      row.setAttribute('data-pos', p);
      var o = document.createElement('span'); o.className = 'o'; o.textContent = offStr(p);
      var h = document.createElement('span'); h.textContent = Core.toHex(bytes, ' ') + (pat.len > take ? ' …' : '');
      var a = document.createElement('span'); a.className = 'a'; a.textContent = ascii;
      row.appendChild(o); row.appendChild(h); row.appendChild(a);
      frag.appendChild(row);
    }
    if (list.length > shown) {
      var more = document.createElement('div');
      more.className = 'more';
      more.textContent = '仅列出前 ' + shown + ' 条';
      frag.appendChild(more);
    }
    fp.results.appendChild(frag);
    fp.results.setAttribute('data-len', pat.len);
    fp.results.hidden = false;
    setMsg('共找到 ' + list.length + ' 处' + (list.length >= MAX_FIND_ALL ? '（已达上限）' : ''), false);
  }

  fp.results.addEventListener('click', function (e) {
    var row = e.target.closest('.hit');
    if (!row) return;
    selectMatch(Number(row.getAttribute('data-pos')), Number(fp.results.getAttribute('data-len')));
  });

  function runReplace() {
    var pat, rep;
    try { pat = getPattern(); rep = getReplacement(); } catch (e) { setMsg(e.message, true); return; }
    if (!(lastHit && lastHit.len === pat.len && Core.matchAt(doc.data, pat, lastHit.start))) {
      runFind(true);       // 当前选中的不是匹配项：先定位
      return;
    }
    var start = lastHit.start;
    edit(start, pat.len, rep, 0);
    S.cur = S.anchor = start + rep.length;
    S.nib = 0;
    var res = Core.findNext(doc.data, pat, S.cur, true, true);
    if (res.pos >= 0) {
      selectMatch(res.pos, pat.len);
      setMsg('已替换 1 处；下一个：偏移 ' + offStr(res.pos), false);
    } else {
      reveal(false);
      refresh();
      setMsg('已替换 1 处，没有更多匹配', false);
    }
  }

  function runReplaceAll() {
    var pat, rep, n;
    try { pat = getPattern(); rep = getReplacement(); } catch (e) { setMsg(e.message, true); return; }
    try {
      n = doc.replaceAll(pat, rep);
    } catch (e) {
      setMsg('替换失败：' + e.message, true);
      return;
    }
    if (!n) { setMsg('未找到', true); return; }
    lastHit = null;
    S.cur = S.anchor = Math.min(S.cur, doc.size());
    S.nib = 0;
    afterEdit();
    fp.results.hidden = true;
    setMsg('已替换 ' + n + ' 处（可撤销）', false);
  }

  fp.input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); runFind(!e.shiftKey); }
    else if (e.key === 'Escape') closeFind();
  });
  fp.rInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); runReplace(); }
    else if (e.key === 'Escape') closeFind();
  });
  gp.input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doGoto(); }
    else if (e.key === 'Escape') closeGoto();
  });
  fp.type.addEventListener('change', syncFindOptions);

  $('fNext').addEventListener('click', function () { runFind(true); });
  $('fPrev').addEventListener('click', function () { runFind(false); });
  $('fAll').addEventListener('click', runFindAll);
  $('rOne').addEventListener('click', runReplace);
  $('rAll').addEventListener('click', runReplaceAll);
  $('fClose').addEventListener('click', closeFind);
  $('gGo').addEventListener('click', doGoto);
  $('gClose').addEventListener('click', closeGoto);

  // ===================== 工具栏 =====================
  function focusSink() { if (S.loaded) sink.focus(); }

  $('btnOpen').addEventListener('click', function () { fileInput.click(); });
  $('btnSave').addEventListener('click', save);
  $('btnUndo').addEventListener('click', function () { undo(); focusSink(); });
  $('btnRedo').addEventListener('click', function () { redo(); focusSink(); });
  $('btnFind').addEventListener('click', function () { openFind(false); });
  $('btnReplace').addEventListener('click', function () { openFind(true); });
  $('btnGoto').addEventListener('click', openGoto);
  $('btnMode').addEventListener('click', function () { toggleMode(); focusSink(); });

  $('selBpr').addEventListener('change', function () {
    var old = S.bpr, next = Number(this.value);
    S.topRow = Math.floor(S.topRow * old / next);
    S.bpr = next;
    layout();
    reveal(false);
    refresh();
    focusSink();
  });

  $('selCharset').addEventListener('change', function () {
    S.charset = this.value;
    buildGlyphs();
    invalidate();
    focusSink();
  });

  // ===================== 初始化 =====================
  L.sbw = measureScrollbar();
  buildGlyphs();
  layout();
  refresh();
  if (window.ResizeObserver) new ResizeObserver(layout).observe(main);
  window.addEventListener('resize', layout);
})();
