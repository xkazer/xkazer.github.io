(function () {
  'use strict';

  // ===================== 通用辅助 =====================
  function $(id) { return document.getElementById(id); }

  function h(tag, props, children) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (k === 'className') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k in el) el[k] = v;
        else el.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  var toastTimer = 0;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1500);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  function doCopy(text) {
    if (!text) { toast('没有可复制的内容'); return; }
    copyText(text).then(function () { toast('已复制'); }, function () { toast('复制失败'); });
  }

  function btn(text, onclick, cls) {
    return h('button', { type: 'button', className: 'btn' + (cls ? ' ' + cls : ''), text: text, onclick: onclick });
  }

  function select(opts, value) {
    var s = h('select', { className: 'sel' });
    opts.forEach(function (o) { s.appendChild(h('option', { value: String(o.v), text: o.label })); });
    s.value = String(value);
    return s;
  }

  function checkbox(label, checked) {
    var input = h('input', { type: 'checkbox', checked: !!checked });
    return { input: input, el: h('label', { className: 'opt' }, [input, label]) };
  }

  function opt(label, control) {
    return h('label', { className: 'opt' }, [label, control]);
  }

  // 一行"名称 + 只读输入框 + 复制"
  function resultRow(label) {
    var input = h('input', { className: 'inp', type: 'text', readOnly: true });
    var name = typeof label === 'string' ? h('span', { className: 'name', text: label }) : label;
    var el = h('div', { className: 'row' }, [
      name, input,
      btn('复制', function () { doCopy(input.value); }, 'ghost sm')
    ]);
    return { el: el, set: function (v) { input.value = v == null ? '' : v; } };
  }

  function section(title, children) {
    return h('div', { className: 'section' }, [h('h2', { text: title })].concat(children));
  }

  function statusBox() {
    var el = h('div', { className: 'status' });
    return {
      el: el,
      set: function (msg, isErr) {
        el.textContent = msg || '';
        el.className = 'status' + (msg ? (isErr ? ' err' : ' ok') : '');
      }
    };
  }

  /**
   * 通用"输入 → 输出"工具
   * cfg: { desc, placeholder, options: [元素], actions: [{label, run(text, ui)}] }
   */
  function ioTool(root, cfg) {
    var input = h('textarea', { className: 'ta', placeholder: cfg.placeholder || '在此输入内容', spellcheck: false });
    var output = h('textarea', { className: 'ta', readOnly: true, placeholder: '结果显示在这里', spellcheck: false });
    var status = statusBox();
    var ui = {
      ok: function (m) { status.set(m, false); },
      select: function (pos, len) {
        input.focus();
        input.setSelectionRange(pos, pos + (len || 1));
      }
    };

    function run(action) {
      status.set('');
      try {
        var r = action.run(input.value, ui);
        output.value = r == null ? '' : r;
      } catch (e) {
        output.value = '';
        status.set(e.message || String(e), true);
      }
    }

    var bar = h('div', { className: 'bar' });
    cfg.actions.forEach(function (a) {
      bar.appendChild(btn(a.label, function () { run(a); }));
    });
    bar.appendChild(btn('结果回填输入', function () {
      if (output.value) { input.value = output.value; output.value = ''; status.set(''); }
    }, 'ghost'));
    bar.appendChild(btn('清空', function () {
      input.value = '';
      output.value = '';
      status.set('');
      input.focus();
    }, 'ghost'));

    root.appendChild(h('p', { className: 'desc', text: cfg.desc }));
    if (cfg.options && cfg.options.length) root.appendChild(h('div', { className: 'opts' }, cfg.options));
    root.appendChild(h('label', { className: 'lbl', text: '输入' }));
    root.appendChild(input);
    root.appendChild(bar);
    root.appendChild(h('div', { className: 'lbl-row' }, [
      h('span', { className: 'lbl', text: '输出' }),
      btn('复制结果', function () { doCopy(output.value); }, 'ghost sm')
    ]));
    root.appendChild(output);
    root.appendChild(status.el);
  }

  function requireText(text) {
    if (!text) throw new Error('请输入内容');
    return text;
  }

  // ===================== 1. 时间戳转换 =====================
  function pad(n, len) {
    var s = String(Math.abs(n));
    while (s.length < len) s = '0' + s;
    return (n < 0 ? '-' : '') + s;
  }

  function tzLabel(min) {
    var names = { 480: '北京', 540: '东京', 0: '伦敦', 330: '新德里', 60: '巴黎', '-300': '纽约', '-480': '洛杉矶', 600: '悉尼', 240: '迪拜', 180: '莫斯科' };
    var sign = min < 0 ? '-' : '+';
    var a = Math.abs(min);
    var text = 'UTC' + sign + pad(Math.floor(a / 60), 2) + ':' + pad(a % 60, 2);
    return names[min] ? text + '（' + names[min] + '）' : text;
  }

  function formatTime(ms, offMin) {
    var d = new Date(ms + offMin * 60000);
    if (isNaN(d.getTime())) return null;
    var s = pad(d.getUTCFullYear(), 4) + '-' + pad(d.getUTCMonth() + 1, 2) + '-' + pad(d.getUTCDate(), 2) +
      ' ' + pad(d.getUTCHours(), 2) + ':' + pad(d.getUTCMinutes(), 2) + ':' + pad(d.getUTCSeconds(), 2);
    var msPart = d.getUTCMilliseconds();
    if (msPart) s += '.' + pad(msPart, 3);
    return s;
  }

  // 解析 "YYYY-MM-DD[ HH:mm[:ss[.SSS]]]"，按给定时区偏移返回 UTC 毫秒
  function parseTime(text, offMin) {
    var m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?$/.exec(text.trim());
    if (!m) throw new Error('时间格式不正确，示例：2024-01-01 12:30:00');
    var y = +m[1], mo = +m[2], d = +m[3], hh = +(m[4] || 0), mi = +(m[5] || 0), ss = +(m[6] || 0);
    var ms = m[7] ? +(m[7] + '00').slice(0, 3) : 0;
    var t = new Date(0);
    t.setUTCFullYear(y, mo - 1, d);
    t.setUTCHours(hh, mi, ss, ms);
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d || hh > 23 || mi > 59 || ss > 59) {
      throw new Error('日期或时间超出有效范围');
    }
    return t.getTime() - offMin * 60000;
  }

  function renderTimestamp(root) {
    var local = -new Date().getTimezoneOffset();
    var zoneList = [-720, -660, -600, -540, -480, -420, -360, -300, -240, -210, -180, -120, -60, 0, 60, 120, 180, 210, 240, 270, 300, 330, 345, 360, 390, 420, 480, 525, 540, 570, 600, 630, 660, 720, 765, 780, 840];
    if (zoneList.indexOf(local) < 0) {
      zoneList.push(local);
      zoneList.sort(function (a, b) { return a - b; });
    }
    var tz = select(zoneList.map(function (m) {
      return { v: m, label: tzLabel(m) + (m === local ? ' [本地]' : '') };
    }), local);
    var off = function () { return Number(tz.value); };

    // 当前时间
    var nowSec = h('code');
    var nowMs = h('code');
    var nowStr = h('code');
    function tick() {
      var n = Date.now();
      nowSec.textContent = Math.floor(n / 1000);
      nowMs.textContent = n;
      nowStr.textContent = formatTime(n, off());
    }
    tick();
    var timer = setInterval(tick, 1000);

    // 时间戳 → 时间
    var tsInput = h('input', { className: 'inp grow', type: 'text', placeholder: '输入时间戳，如 1700000000 或 1700000000000' });
    var unit = select([{ v: 'auto', label: '自动判断' }, { v: 's', label: '秒' }, { v: 'ms', label: '毫秒' }], 'auto');
    var tsOut = resultRow('本地时间');
    var tsStatus = statusBox();

    function tsToTime() {
      tsStatus.set('');
      var raw = tsInput.value.trim();
      if (!raw) { tsOut.set(''); return; }
      if (!/^[-+]?\d+(\.\d+)?$/.test(raw)) { tsOut.set(''); tsStatus.set('请输入数字形式的时间戳', true); return; }
      var v = Number(raw);
      var intLen = raw.replace(/^[-+]/, '').split('.')[0].length;
      var isSec = unit.value === 's' || (unit.value === 'auto' && intLen <= 11);
      var ms = Math.round(isSec ? v * 1000 : v);
      var s = formatTime(ms, off());
      if (!s) { tsOut.set(''); tsStatus.set('时间戳超出可表示的范围', true); return; }
      tsOut.set(s);
      if (unit.value === 'auto') tsStatus.set('按' + (isSec ? '秒' : '毫秒') + '解析', false);
    }

    // 时间 → 时间戳
    var dtInput = h('input', { className: 'inp grow', type: 'text', placeholder: '2024-01-01 12:30:00' });
    var secOut = resultRow('秒');
    var msOut = resultRow('毫秒');
    var dtStatus = statusBox();

    function timeToTs() {
      dtStatus.set('');
      if (!dtInput.value.trim()) { secOut.set(''); msOut.set(''); return; }
      try {
        var ms = parseTime(dtInput.value, off());
        secOut.set(Math.floor(ms / 1000));
        msOut.set(ms);
      } catch (e) {
        secOut.set('');
        msOut.set('');
        dtStatus.set(e.message, true);
      }
    }

    function fillNow() {
      dtInput.value = formatTime(Date.now(), off());
      timeToTs();
    }

    tsInput.addEventListener('input', tsToTime);
    unit.addEventListener('change', tsToTime);
    dtInput.addEventListener('input', timeToTs);
    tz.addEventListener('change', function () { tick(); tsToTime(); timeToTs(); });

    root.appendChild(h('p', { className: 'desc', text: '时间戳与日期时间互转，支持秒/毫秒与时区调整。' }));
    root.appendChild(h('div', { className: 'opts' }, [opt('时区', tz)]));
    root.appendChild(h('div', { className: 'now' }, [
      h('span', {}, ['当前时间 ', nowStr]),
      h('span', {}, ['秒 ', nowSec, btn('填入', function () { tsInput.value = nowSec.textContent; tsToTime(); }, 'ghost sm')]),
      h('span', {}, ['毫秒 ', nowMs, btn('填入', function () { tsInput.value = nowMs.textContent; tsToTime(); }, 'ghost sm')])
    ]));
    root.appendChild(section('时间戳 → 时间', [
      h('div', { className: 'row' }, [tsInput, unit]),
      tsOut.el,
      tsStatus.el
    ]));
    root.appendChild(section('时间 → 时间戳', [
      h('div', { className: 'row' }, [dtInput, btn('当前时间', fillNow, 'ghost')]),
      secOut.el,
      msOut.el,
      dtStatus.el
    ]));
    fillNow();

    return function () { clearInterval(timer); };
  }

  // ===================== 2. Base64 =====================
  function base64Encode(text, urlSafe) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    var b64 = btoa(bin);
    if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return b64;
  }

  function base64Decode(text) {
    var s = text.replace(/^data:[^,]*;base64,/i, '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin;
    try { bin = atob(s); } catch (e) { throw new Error('不是有效的 Base64 字符串'); }
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      throw new Error('解码结果不是有效的 UTF-8 文本（可能是二进制数据）');
    }
  }

  /**
   * 上下对照工具：上框为原文，下框为编码结果。
   * 编码 = 上 → 下，解码 = 下 → 上，两个框都可直接输入。
   * cfg: { desc, encodedName, plainHint, encodedHint, options: [元素],
   *        encode(text, ui) -> string, decode(text, ui) -> string }
   */
  function pairTool(root, cfg) {
    var name = cfg.encodedName;
    var plain = h('textarea', { className: 'ta', placeholder: cfg.plainHint || '在此输入原文', spellcheck: false });
    var encoded = h('textarea', { className: 'ta', placeholder: cfg.encodedHint || ('在此输入' + name), spellcheck: false });
    var status = statusBox();
    var ui = {
      ok: function (m) { status.set(m, false); },
      select: function (el, pos, len) { el.focus(); el.setSelectionRange(pos, pos + (len || 1)); }
    };

    function convert(from, to, fn) {
      status.set('');
      try {
        requireText(from.value);
        to.value = fn(from.value, ui);
      } catch (e) {
        status.set(e.message || String(e), true);
      }
    }

    root.appendChild(h('p', { className: 'desc', text: cfg.desc }));
    if (cfg.options && cfg.options.length) root.appendChild(h('div', { className: 'opts' }, cfg.options));

    root.appendChild(h('div', { className: 'lbl-row' }, [
      h('span', { className: 'lbl', text: '原文' }),
      btn('复制原文', function () { doCopy(plain.value); }, 'ghost sm')
    ]));
    root.appendChild(plain);

    root.appendChild(h('div', { className: 'bar' }, [
      btn('编码 ↓', function () { convert(plain, encoded, cfg.encode); }),
      btn('解码 ↑', function () { convert(encoded, plain, cfg.decode); }),
      btn('清空', function () {
        plain.value = '';
        encoded.value = '';
        status.set('');
        plain.focus();
      }, 'ghost')
    ]));

    root.appendChild(h('div', { className: 'lbl-row' }, [
      h('span', { className: 'lbl', text: name }),
      btn('复制' + name, function () { doCopy(encoded.value); }, 'ghost sm')
    ]));
    root.appendChild(encoded);
    root.appendChild(status.el);
  }

  // 上：原文；下：Base64
  function renderBase64(root) {
    var urlSafe = checkbox('URL 安全（- _ 代替 + /，去掉 =）', false);
    pairTool(root, {
      desc: '上方为原文，下方为 Base64（按 UTF-8 处理中文）。编码：原文 → Base64；解码：Base64 → 原文。',
      encodedName: 'Base64',
      options: [urlSafe.el],
      encode: function (text) { return base64Encode(text, urlSafe.input.checked); },
      decode: base64Decode
    });
  }

  // ===================== 3. UTF8 转换（\uXXXX ↔ 汉字）=====================
  function unescapeU(text) {
    var count = 0;
    var out = text.replace(/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})/g, function (m, a, b) {
      var cp = parseInt(a || b, 16);
      if (cp > 0x10FFFF) return m;
      count++;
      return String.fromCodePoint(cp);
    });
    return { text: out, count: count };
  }

  function renderUtf8(root) {
    var onlyNonAscii = checkbox('转码时仅转换非 ASCII 字符', true);
    pairTool(root, {
      desc: '上方为原文（汉字），下方为 \\u 编码。编码：汉字 → \\u4e00\\u4e09；解码：\\u4e00\\u4e09\\u4e0a\\u4e0b → 汉字。',
      encodedName: '\\u 编码',
      encodedHint: '例如：\\u4e00\\u4e09\\u4e0a\\u4e0b',
      options: [onlyNonAscii.el],
      encode: function (text) {
        var out = '';
        for (var i = 0; i < text.length; i++) {
          var c = text.charCodeAt(i);
          out += (c > 127 || !onlyNonAscii.input.checked)
            ? '\\u' + ('0000' + c.toString(16)).slice(-4)
            : text.charAt(i);
        }
        return out;
      },
      decode: function (text, ui) {
        var r = unescapeU(text);
        if (!r.count) throw new Error('未找到 \\uXXXX 形式的内容');
        ui.ok('已转换 ' + r.count + ' 处');
        return r.text;
      }
    });
  }

  // ===================== 4. URL 编解码 =====================
  function renderUrl(root) {
    var mode = select([{ v: 'component', label: '组件模式 encodeURIComponent' }, { v: 'uri', label: '整串模式 encodeURI' }], 'component');
    var plus = checkbox('解码时将 + 视为空格', false);
    pairTool(root, {
      desc: '上方为原文，下方为 URL 编码。组件模式会编码 : / ? & = 等保留字符，整串模式保留它们。',
      encodedName: 'URL 编码',
      encodedHint: '例如：%E4%B8%AD%E6%96%87',
      options: [opt('模式', mode), plus.el],
      encode: function (text) {
        try {
          return mode.value === 'uri' ? encodeURI(text) : encodeURIComponent(text);
        } catch (e) {
          throw new Error('编码失败：包含不完整的 Unicode 字符');
        }
      },
      decode: function (text) {
        var s = plus.input.checked ? text.replace(/\+/g, ' ') : text;
        try {
          return mode.value === 'uri' ? decodeURI(s) : decodeURIComponent(s);
        } catch (e) {
          throw new Error('解码失败：包含非法的百分号编码');
        }
      }
    });
  }

  // ===================== 5. Unicode 转换 =====================
  var UNICODE_FORMATS = [
    {
      v: 'u4', label: '\\uXXXX', fn: function (cp) {
        if (cp > 0xFFFF) {
          var x = cp - 0x10000;
          return '\\u' + (0xD800 + (x >> 10)).toString(16) + '\\u' + (0xDC00 + (x & 0x3FF)).toString(16);
        }
        return '\\u' + ('0000' + cp.toString(16)).slice(-4);
      }
    },
    { v: 'ubrace', label: '\\u{X}', fn: function (cp) { return '\\u{' + cp.toString(16) + '}'; } },
    { v: 'hex', label: '&#xX;', fn: function (cp) { return '&#x' + cp.toString(16).toUpperCase() + ';'; } },
    { v: 'dec', label: '&#N;', fn: function (cp) { return '&#' + cp + ';'; } },
    { v: 'uplus', label: 'U+XXXX', fn: function (cp) { return 'U+' + ('0000' + cp.toString(16).toUpperCase()).slice(-4); } }
  ];

  function renderUnicode(root) {
    var format = select(UNICODE_FORMATS, 'u4');
    var onlyNonAscii = checkbox('仅转换非 ASCII 字符', true);
    ioTool(root, {
      desc: '字符与 \\uXXXX、\\u{X}、&#xX;、&#N;、U+XXXX 互转；解码时自动识别以上全部格式。',
      options: [opt('编码格式', format), onlyNonAscii.el],
      actions: [
        {
          label: '字符 → 编码',
          run: function (text) {
            requireText(text);
            var fmt = UNICODE_FORMATS.filter(function (f) { return f.v === format.value; })[0];
            var pieces = Array.from(text).map(function (ch) {
              var cp = ch.codePointAt(0);
              return (cp > 127 || !onlyNonAscii.input.checked) ? fmt.fn(cp) : ch;
            });
            return pieces.join(fmt.v === 'uplus' ? ' ' : '');
          }
        },
        {
          label: '编码 → 字符',
          run: function (text, ui) {
            requireText(text);
            var count = 0;
            var out = text.replace(/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|&#[xX]([0-9a-fA-F]{1,6});|&#(\d{1,7});|U\+([0-9a-fA-F]{4,6})/g,
              function (m, a, b, c, d, e) {
                var cp = a ? parseInt(a, 16) : b ? parseInt(b, 16) : c ? parseInt(c, 16) : d ? parseInt(d, 10) : parseInt(e, 16);
                if (cp > 0x10FFFF) return m;
                count++;
                return String.fromCodePoint(cp);
              });
            if (!count) throw new Error('未找到可识别的 Unicode 编码');
            ui.ok('已转换 ' + count + ' 处');
            return out;
          }
        }
      ]
    });
  }

  // ===================== 6. JSON 格式化 =====================
  function describeJsonError(e, text, ui) {
    var msg = e.message || String(e);
    var pos = -1, line, col, m;
    if ((m = /line (\d+) column (\d+)/.exec(msg))) {
      line = +m[1];
      col = +m[2];
      var lines = text.split('\n');
      pos = 0;
      for (var i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
      pos += col - 1;
    } else if ((m = /position (\d+)/.exec(msg))) {
      pos = +m[1];
      var before = text.slice(0, pos).split('\n');
      line = before.length;
      col = before[before.length - 1].length + 1;
    }
    if (pos >= 0) {
      ui.select(Math.min(pos, text.length), 1);
      return 'JSON 语法错误（第 ' + line + ' 行，第 ' + col + ' 列）：' + msg;
    }
    return 'JSON 语法错误：' + msg;
  }

  // ---- 宽松模式（不校验，自动修正）----

  // 按 JSON 字符串规则去掉一层转义
  function unescapeLayer(s) {
    var map = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
    return s.replace(/\\(u[0-9a-fA-F]{4}|[\s\S])/g, function (m, e) {
      if (e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
      return map.hasOwnProperty(e) ? map[e] : m;
    });
  }

  // 去掉整体被转义的外层：{\"a\":1}、"{\"a\":1}"、{\\\"a\\\":1}（多层依次剥离）
  function stripEscapeLayers(text, notes) {
    var t = text.trim();
    var layers = 0;
    for (var guard = 0; guard < 10; guard++) {
      var parsed;
      var ok = true;
      try { parsed = JSON.parse(t); } catch (e) { ok = false; }
      if (ok) {
        if (typeof parsed === 'string' && /^\s*[\[{"]/.test(parsed)) {
          t = parsed.trim();
          layers++;
          continue;
        }
        break;
      }
      var body = t;
      if (body.length > 1 && body.charAt(0) === '"' && body.charAt(body.length - 1) === '"') body = body.slice(1, -1);
      // 所有双引号都被转义（不存在裸引号），说明整段是被转义过的内容
      if (/\\"/.test(body) && body.replace(/\\[\s\S]/g, '').indexOf('"') === -1) {
        var next = unescapeLayer(body);
        if (next === body) break;
        t = next.trim();
        layers++;
        continue;
      }
      break;
    }
    if (layers) notes.push('去除 ' + layers + ' 层转义');
    return t;
  }

  // 把字符串内容规整为合法的 JSON 字符串体
  function normalizeStringBody(body, notes) {
    return body.replace(/\\(u[0-9a-fA-F]{4}|[\s\S])|"|[\n\r\t]/g, function (m, esc) {
      if (esc !== undefined) {
        if (esc.length === 5 || '"\\/bfnrt'.indexOf(esc) >= 0) return m;
        if (esc === "'") return "'";
        if (esc === '\n') return '';
        notes.push('修正非法转义');
        return '\\\\' + esc;
      }
      if (m === '"') return '\\"';
      notes.push('转义字符串内的换行');
      return m === '\n' ? '\\n' : m === '\r' ? '\\r' : '\\t';
    });
  }

  function tokenizeLoose(text, notes) {
    var toks = [];
    var i = 0, n = text.length;

    function nextChar(from) {
      while (from < n && /\s/.test(text.charAt(from))) from++;
      return text.charAt(from);
    }

    while (i < n) {
      var c = text.charAt(i);
      if (/\s/.test(c)) { i++; continue; }

      if (c === '/' && text.charAt(i + 1) === '/') {
        while (i < n && text.charAt(i) !== '\n') i++;
        notes.push('移除注释');
        continue;
      }
      if (c === '/' && text.charAt(i + 1) === '*') {
        var end = text.indexOf('*/', i + 2);
        i = end < 0 ? n : end + 2;
        notes.push('移除注释');
        continue;
      }
      if ('{}[],:'.indexOf(c) >= 0) {
        toks.push({ t: 'p', v: c });
        i++;
        continue;
      }
      if (c === '"' || c === "'") {
        var j = i + 1, body = '', closed = false;
        while (j < n) {
          var ch = text.charAt(j);
          if (ch === '\\' && j + 1 < n) { body += ch + text.charAt(j + 1); j += 2; continue; }
          if (ch === c) { closed = true; j++; break; }
          body += ch;
          j++;
        }
        if (c === "'") notes.push('单引号改为双引号');
        if (!closed) notes.push('补全缺失的引号');
        toks.push({ t: 's', v: '"' + normalizeStringBody(body, notes) + '"' });
        i = j;
        continue;
      }

      var k = i;
      while (k < n && !/[\s{}\[\],:"']/.test(text.charAt(k))) k++;
      var word = text.slice(i, k);
      i = k;
      if (nextChar(i) === ':') {
        notes.push('为键名加引号');
        toks.push({ t: 's', v: '"' + word.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' });
      } else if (/^(true|false|null)$/.test(word) || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(word)) {
        toks.push({ t: 'w', v: word });
      } else {
        notes.push('为无引号的值加引号');
        toks.push({ t: 's', v: '"' + word.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' });
      }
    }
    return toks;
  }

  function repairTokens(toks, notes) {
    var isEnd = function (t) { return t && (t.t !== 'p' || t.v === '}' || t.v === ']'); };
    var isStart = function (t) { return t && (t.t !== 'p' || t.v === '{' || t.v === '['); };
    var out = [];
    var stack = [];
    var closerOf = { '{': '}', '[': ']' };

    toks.forEach(function (tok, idx) {
      var prev = out[out.length - 1];
      var next = toks[idx + 1];

      if (tok.t === 'p' && tok.v === ',') {
        var misplaced = !prev || (prev.t === 'p' && (prev.v === '{' || prev.v === '[' || prev.v === ',' || prev.v === ':'));
        var trailing = next && next.t === 'p' && (next.v === '}' || next.v === ']');
        if (misplaced || trailing || !next) { notes.push('移除多余的逗号'); return; }
      }

      if (tok.t === 'p' && (tok.v === '}' || tok.v === ']')) {
        if (!stack.length) { notes.push('移除多余的括号'); return; }
        var want = closerOf[stack.pop()];
        if (tok.v !== want) { notes.push('修正不匹配的括号'); tok = { t: 'p', v: want }; }
      } else if (tok.t === 'p' && (tok.v === '{' || tok.v === '[')) {
        stack.push(tok.v);
      }

      if (isEnd(prev) && isStart(tok)) {
        out.push({ t: 'p', v: ',' });
        notes.push('补全缺失的逗号');
      }
      out.push(tok);
    });

    if (stack.length) {
      notes.push('补全缺失的括号');
      while (stack.length) out.push({ t: 'p', v: closerOf[stack.pop()] });
    }
    return out;
  }

  // 令牌 → 文本（不重新解析数值，保持原样，不丢精度、不改键顺序）
  function printTokens(toks, unit) {
    var out = '';
    var level = 0;
    var ind = function (n) { var s = ''; for (var x = 0; x < n; x++) s += unit; return s; };
    for (var i = 0; i < toks.length; i++) {
      var tok = toks[i];
      if (tok.t !== 'p') { out += tok.v; continue; }
      if (tok.v === '{' || tok.v === '[') {
        var nxt = toks[i + 1];
        if (nxt && nxt.t === 'p' && (nxt.v === '}' || nxt.v === ']')) {
          out += tok.v + nxt.v;
          i++;
          continue;
        }
        out += tok.v;
        if (unit !== null) { level++; out += '\n' + ind(level); }
      } else if (tok.v === '}' || tok.v === ']') {
        if (unit !== null) { level = Math.max(0, level - 1); out += '\n' + ind(level); }
        out += tok.v;
      } else if (tok.v === ',') {
        out += unit !== null ? ',\n' + ind(level) : ',';
      } else {
        out += unit !== null ? ': ' : ':';
      }
    }
    return out;
  }

  // unit 为 null 表示压缩
  function looseJson(text, unit, ui) {
    var notes = [];
    var cleaned = stripEscapeLayers(text, notes);
    var toks = repairTokens(tokenizeLoose(cleaned, notes), notes);
    if (!toks.length) throw new Error('没有可处理的 JSON 内容');

    var uniq = notes.filter(function (m, i) { return notes.indexOf(m) === i; });
    ui.ok(uniq.length ? '已自动修正：' + uniq.join('、') : '无需修正');
    return printTokens(toks, unit);
  }

  function renderJson(root) {
    var indent = select([{ v: '2', label: '2 空格' }, { v: '4', label: '4 空格' }, { v: 'tab', label: 'Tab' }], '2');
    var validate = checkbox('校验（取消勾选则不校验，并自动修正）', true);
    var unit = function () { return indent.value === 'tab' ? '\t' : new Array(Number(indent.value) + 1).join(' '); };

    function parse(text, ui) {
      requireText(text.trim());
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(describeJsonError(e, text, ui));
      }
    }

    ioTool(root, {
      desc: '勾选"校验"时严格检查语法，出错会提示位置并在输入框中定位；不勾选时不校验，自动修正常见问题（转义的 JSON \\" 或 \\\\\\"、尾逗号、单引号、键名无引号、注释、括号缺失等）后再处理。',
      placeholder: '{"name":"xkazer","list":[1,2,3]}',
      options: [opt('缩进', indent), validate.el],
      actions: [
        {
          label: '格式化',
          run: function (text, ui) {
            requireText(text.trim());
            if (!validate.input.checked) return looseJson(text, unit(), ui);
            var obj = parse(text, ui);
            ui.ok('JSON 合法');
            return JSON.stringify(obj, null, indent.value === 'tab' ? '\t' : Number(indent.value));
          }
        },
        {
          label: '压缩',
          run: function (text, ui) {
            requireText(text.trim());
            if (!validate.input.checked) return looseJson(text, null, ui);
            var obj = parse(text, ui);
            ui.ok('JSON 合法');
            return JSON.stringify(obj);
          }
        }
      ]
    });
  }

  // ===================== 7. MD5 =====================
  var MD5_S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  var MD5_K = [];
  for (var ki = 0; ki < 64; ki++) MD5_K.push(Math.floor(Math.abs(Math.sin(ki + 1)) * 4294967296) >>> 0);

  // 增量 MD5：可分块 update，用于大文件
  function Md5() {
    this.s = [0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476];
    this.tail = new Uint8Array(64);
    this.tl = 0;
    this.len = 0;
    this.M = new Int32Array(16);
  }

  Md5.prototype.block = function (buf, off) {
    var M = this.M, s = this.s;
    for (var j = 0; j < 16; j++) {
      var p = off + j * 4;
      M[j] = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16) | (buf[p + 3] << 24);
    }
    var A = s[0], B = s[1], C = s[2], D = s[3];
    for (var i = 0; i < 64; i++) {
      var F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
      else { F = C ^ (B | ~D); g = (7 * i) & 15; }
      F = (F + A + MD5_K[i] + M[g]) | 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << MD5_S[i]) | (F >>> (32 - MD5_S[i])))) | 0;
    }
    s[0] = (s[0] + A) | 0;
    s[1] = (s[1] + B) | 0;
    s[2] = (s[2] + C) | 0;
    s[3] = (s[3] + D) | 0;
  };

  Md5.prototype.update = function (u8) {
    var n = u8.length, i = 0;
    this.len += n;
    if (this.tl > 0) {
      var take = Math.min(64 - this.tl, n);
      this.tail.set(u8.subarray(0, take), this.tl);
      this.tl += take;
      i = take;
      if (this.tl < 64) return this;
      this.block(this.tail, 0);
      this.tl = 0;
    }
    for (; i + 64 <= n; i += 64) this.block(u8, i);
    if (i < n) {
      this.tail.set(u8.subarray(i), 0);
      this.tl = n - i;
    }
    return this;
  };

  Md5.prototype.hex = function () {
    var t = this.tail, tl = this.tl;
    t[tl++] = 0x80;
    if (tl > 56) {
      t.fill(0, tl, 64);
      this.block(t, 0);
      tl = 0;
    }
    t.fill(0, tl, 64);
    var lo = (this.len % 0x20000000) * 8, hi = Math.floor(this.len / 0x20000000);
    for (var k = 0; k < 4; k++) {
      t[56 + k] = (lo >>> (8 * k)) & 255;
      t[60 + k] = (hi >>> (8 * k)) & 255;
    }
    this.block(t, 0);
    var hex = '';
    this.s.forEach(function (w) {
      for (var k2 = 0; k2 < 4; k2++) hex += ('0' + ((w >>> (8 * k2)) & 255).toString(16)).slice(-2);
    });
    return hex;
  };

  function md5(text) {
    return new Md5().update(new TextEncoder().encode(text)).hex();
  }

  // 按 4MB 分块读取文件计算 MD5，onProgress(已读字节)，isCancelled() 为 true 时中止并返回 null
  function md5File(file, onProgress, isCancelled) {
    var CHUNK = 4 * 1024 * 1024;
    var ctx = new Md5();
    var pos = 0;
    function next() {
      if (isCancelled()) return Promise.resolve(null);
      if (pos >= file.size) return Promise.resolve(ctx.hex());
      return file.slice(pos, pos + CHUNK).arrayBuffer().then(function (buf) {
        ctx.update(new Uint8Array(buf));
        pos += buf.byteLength;
        onProgress(pos);
        return new Promise(function (r) { setTimeout(r, 0); }).then(next);
      });
    }
    return next();
  }

  function fmtSize(n) {
    if (n < 1024) return n + ' 字节';
    var u = ['KB', 'MB', 'GB', 'TB'], i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return n.toFixed(2) + ' ' + u[i];
  }

  function renderMd5(root) {
    var input = h('textarea', { className: 'ta', placeholder: '输入要加密的文本，实时计算', spellcheck: false });
    var rows = {
      l32: resultRow('32 位小写'),
      u32: resultRow('32 位大写'),
      l16: resultRow('16 位小写'),
      u16: resultRow('16 位大写')
    };
    function setDigest(d) {
      rows.l32.set(d);
      rows.u32.set(d ? d.toUpperCase() : '');
      rows.l16.set(d ? d.slice(8, 24) : '');
      rows.u16.set(d ? d.slice(8, 24).toUpperCase() : '');
    }
    function update() {
      var t = input.value;
      setDigest(t ? md5(t) : '');
    }
    input.addEventListener('input', update);

    // ---- 文件模式 ----
    var fileInput = h('input', { type: 'file', hidden: true });
    var fileTitle = h('div', { className: 'drop-title', text: '点击选择或拖入文件' });
    var fileSub = h('div', { className: 'drop-sub', text: '在浏览器本地分块读取并计算，文件不会上传，支持大文件' });
    var drop = h('div', { className: 'file-drop', tabIndex: 0 }, [fileTitle, fileSub]);
    var progress = h('i');
    var progressWrap = h('div', { className: 'progress', hidden: true }, [progress]);
    var fileStatus = statusBox();
    var runId = 0;

    function computeFile(file) {
      if (!file) return;
      var id = ++runId;
      var t0 = Date.now();
      setDigest('');
      fileTitle.textContent = file.name;
      fileSub.textContent = fmtSize(file.size) + (file.size >= 1024 ? '（' + file.size + ' 字节）' : '');
      fileStatus.set('');
      progress.style.width = '0%';
      progressWrap.hidden = false;
      md5File(file, function (done) {
        if (id !== runId) return;
        var pct = file.size ? Math.floor(done / file.size * 100) : 100;
        progress.style.width = pct + '%';
        fileStatus.set('计算中 ' + pct + '%（' + fmtSize(done) + ' / ' + fmtSize(file.size) + '）');
      }, function () { return id !== runId; }).then(function (d) {
        if (d == null || id !== runId) return;
        setDigest(d);
        progressWrap.hidden = true;
        fileStatus.set('计算完成，用时 ' + ((Date.now() - t0) / 1000).toFixed(2) + ' 秒', false);
      }, function () {
        if (id !== runId) return;
        progressWrap.hidden = true;
        fileStatus.set('读取文件失败，文件可能已被移动、占用或无法访问', true);
      });
    }

    fileInput.addEventListener('change', function () {
      computeFile(fileInput.files[0]);
      fileInput.value = '';
    });
    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      computeFile(f);
    });

    var textPane = h('div', { className: 'pane' }, [
      h('label', { className: 'lbl', text: '输入' }),
      input,
      h('div', { className: 'bar' }, [
        btn('清空', function () { input.value = ''; update(); input.focus(); }, 'ghost')
      ])
    ]);
    var filePane = h('div', { className: 'pane', hidden: true }, [
      drop, fileInput, progressWrap, fileStatus.el,
      h('div', { className: 'bar' }, [
        btn('清空', function () {
          runId++;
          setDigest('');
          fileTitle.textContent = '点击选择或拖入文件';
          fileSub.textContent = '在浏览器本地分块读取并计算，文件不会上传，支持大文件';
          progressWrap.hidden = true;
          fileStatus.set('');
        }, 'ghost')
      ])
    ]);

    var modeText = btn('文本', function () { setMode('text'); }, 'sm');
    var modeFile = btn('文件', function () { setMode('file'); }, 'sm ghost');
    function setMode(m) {
      var isText = m === 'text';
      runId++;
      progressWrap.hidden = true;
      fileStatus.set('');
      textPane.hidden = !isText;
      filePane.hidden = isText;
      modeText.className = 'btn sm' + (isText ? '' : ' ghost');
      modeFile.className = 'btn sm' + (isText ? ' ghost' : '');
      if (isText) update(); else setDigest('');
    }

    root.appendChild(h('p', { className: 'desc', text: '计算文本或本地文件的 MD5 摘要，纯前端实现，内容不会上传。文本按 UTF-8 编码。' }));
    root.appendChild(h('div', { className: 'bar' }, [modeText, modeFile]));
    root.appendChild(textPane);
    root.appendChild(filePane);
    Object.keys(rows).forEach(function (k) { root.appendChild(rows[k].el); });
  }

  // ===================== 8. 进制转换 + 字符串反转 =====================
  function parseBig(str, base) {
    var s = str.trim().toLowerCase().replace(/[\s_]/g, '');
    var neg = false;
    if (s.charAt(0) === '-') { neg = true; s = s.slice(1); }
    else if (s.charAt(0) === '+') s = s.slice(1);
    var prefix = { 2: '0b', 8: '0o', 16: '0x' }[base];
    if (prefix && s.indexOf(prefix) === 0) s = s.slice(2);
    if (!s) throw new Error('请输入数字');
    var v = BigInt(0);
    var B = BigInt(base);
    for (var i = 0; i < s.length; i++) {
      var d = parseInt(s.charAt(i), 36);
      if (isNaN(d) || d >= base) throw new Error('"' + s.charAt(i) + '" 不是有效的 ' + base + ' 进制数字');
      v = v * B + BigInt(d);
    }
    return neg ? -v : v;
  }

  function reverseChars(s) { return Array.from(s).reverse().join(''); }

  function baseOptions() {
    var list = [];
    for (var b = 2; b <= 36; b++) list.push({ v: b, label: b + ' 进制' });
    return list;
  }

  function renderRadix(root) {
    // 进制转换
    var numInput = h('input', { className: 'inp grow', type: 'text', placeholder: '输入数字，如 255 或 0xFF' });
    var fromBase = select(baseOptions(), 10);
    var customBase = select(baseOptions(), 36);
    var outs = {
      2: resultRow('二进制'),
      8: resultRow('八进制'),
      10: resultRow('十进制'),
      16: resultRow('十六进制'),
      c: resultRow(customBase)
    };
    var radixStatus = statusBox();

    function convert() {
      radixStatus.set('');
      if (!numInput.value.trim()) { Object.keys(outs).forEach(function (k) { outs[k].set(''); }); return; }
      try {
        var v = parseBig(numInput.value, Number(fromBase.value));
        outs[2].set(v.toString(2));
        outs[8].set(v.toString(8));
        outs[10].set(v.toString(10));
        outs[16].set(v.toString(16).toUpperCase());
        outs.c.set(v.toString(Number(customBase.value)));
      } catch (e) {
        Object.keys(outs).forEach(function (k) { outs[k].set(''); });
        radixStatus.set(e.message, true);
      }
    }
    numInput.addEventListener('input', convert);
    fromBase.addEventListener('change', convert);
    customBase.addEventListener('change', convert);

    // 字符串反转
    var mode = select([
      { v: 'all', label: '整体反转' },
      { v: 'line', label: '逐行反转' },
      { v: 'word', label: '逐词反转（保持词序）' },
      { v: 'order', label: '反转词序' }
    ], 'all');
    var revInput = h('textarea', { className: 'ta', placeholder: '输入要反转的字符串，实时计算', spellcheck: false });
    var revOutput = h('textarea', { className: 'ta', readOnly: true, placeholder: '结果显示在这里', spellcheck: false });

    function reverse() {
      var t = revInput.value;
      var r;
      switch (mode.value) {
        case 'line': r = t.split(/\r?\n/).map(reverseChars).join('\n'); break;
        case 'word': r = t.replace(/\S+/g, reverseChars); break;
        case 'order': r = t.trim() ? t.trim().split(/\s+/).reverse().join(' ') : ''; break;
        default: r = reverseChars(t);
      }
      revOutput.value = r;
    }
    revInput.addEventListener('input', reverse);
    mode.addEventListener('change', reverse);

    root.appendChild(h('p', { className: 'desc', text: '二/八/十/十六进制及 2-36 进制互转（支持大整数与负数），以及字符串反转。' }));
    root.appendChild(section('进制转换', [
      h('div', { className: 'row' }, [numInput, fromBase]),
      outs[2].el, outs[8].el, outs[10].el, outs[16].el, outs.c.el,
      radixStatus.el
    ]));
    root.appendChild(section('字符串反转', [
      h('div', { className: 'opts' }, [opt('模式', mode)]),
      revInput,
      h('div', { className: 'bar' }, [
        btn('复制结果', function () { doCopy(revOutput.value); }),
        btn('清空', function () { revInput.value = ''; reverse(); revInput.focus(); }, 'ghost')
      ]),
      revOutput
    ]));
  }

  // ===================== 9. 二维码生成 =====================
  function renderQr(root) {
    var text = h('textarea', { className: 'ta', placeholder: '输入文本或链接，实时生成二维码', spellcheck: false });
    var ecl = select([
      { v: 'L', label: 'L 低（约 7%）' }, { v: 'M', label: 'M 中（约 15%）' },
      { v: 'Q', label: 'Q 较高（约 25%）' }, { v: 'H', label: 'H 高（约 30%）' }
    ], 'M');
    var sizeSel = select([{ v: 256, label: '256 px' }, { v: 512, label: '512 px' }, { v: 1024, label: '1024 px' }], 512);
    var canvas = h('canvas', { className: 'qr' });
    var placeholder = h('div', { className: 'qr-empty', text: '输入内容后在此预览' });
    var status = statusBox();
    var download = btn('下载 PNG', function () {
      if (!canvas.width) return;
      canvas.toBlob(function (blob) {
        if (!blob) { toast('生成图片失败'); return; }
        var url = URL.createObjectURL(blob);
        var a = h('a', { href: url, download: 'qrcode.png' });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }, 'image/png');
    });

    function draw() {
      status.set('');
      var v = text.value;
      if (!v) {
        canvas.style.display = 'none';
        placeholder.style.display = '';
        download.disabled = true;
        return;
      }
      try {
        var qr = QRCode.encode(v, ecl.value);
        var border = 4;
        var scale = Math.max(1, Math.floor(Number(sizeSel.value) / (qr.size + border * 2)));
        var px = scale * (qr.size + border * 2);
        canvas.width = px;
        canvas.height = px;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, px, px);
        ctx.fillStyle = '#000000';
        for (var y = 0; y < qr.size; y++) {
          for (var x = 0; x < qr.size; x++) {
            if (qr.get(x, y)) ctx.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
          }
        }
        canvas.style.display = '';
        placeholder.style.display = 'none';
        download.disabled = false;
        status.set('版本 ' + qr.version + '，' + qr.size + '×' + qr.size 
          + ' 模块，图片 ' + px + '×' + px + ' px', false);
      } catch (e) {
        canvas.style.display = 'none';
        placeholder.style.display = '';
        download.disabled = true;
        status.set(e.message, true);
      }
    }
    text.addEventListener('input', draw);
    ecl.addEventListener('change', draw);
    sizeSel.addEventListener('change', draw);

    root.appendChild(h('p', { className: 'desc', text: '输入文本或链接生成二维码，可预览并下载 PNG；内容不会上传。' }));
    root.appendChild(h('div', { className: 'qr-wrap' }, [
      h('div', { className: 'qr-side' }, [
        h('label', { className: 'lbl', text: '内容' }),
        text,
        h('div', { className: 'opts top' }, [opt('纠错级别', ecl), opt('图片尺寸', sizeSel)]),
        h('div', { className: 'bar' }, [
          download,
          btn('清空', function () { text.value = ''; draw(); text.focus(); }, 'ghost')
        ]),
        status.el
      ]),
      h('div', { className: 'qr-view' }, [canvas, placeholder])
    ]));
    draw();
  }

  // ===================== 路由 =====================
  var TOOLS = [
    { id: 'timestamp', title: '时间戳转换', render: renderTimestamp },
    { id: 'base64', title: 'Base64编解码', render: renderBase64 },
    { id: 'utf8', title: 'UTF8转换', render: renderUtf8 },
    { id: 'url', title: 'URL编解码', render: renderUrl },
    { id: 'unicode', title: 'Unicode转换', render: renderUnicode },
    { id: 'json', title: 'JSON格式化', render: renderJson },
    { id: 'md5', title: 'MD5加密', render: renderMd5 },
    { id: 'radix', title: '进制串字符串反转', render: renderRadix },
    { id: 'qrcode', title: '二维码生成', render: renderQr }
  ];

  var dispose = null;

  function route() {
    var id = decodeURIComponent(location.hash.slice(1));
    var tool = TOOLS.filter(function (t) { return t.id === id; })[0] || TOOLS[0];

    if (dispose) { dispose(); dispose = null; }
    var root = $('toolRoot');
    root.textContent = '';
    $('toolTitle').textContent = tool.title;
    document.title = tool.title + ' - xkazer';

    var chips = document.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('active', chips[i].getAttribute('data-id') === tool.id);
    }

    var r = tool.render(root);
    if (typeof r === 'function') dispose = r;
  }

  var nav = $('toolNav');
  TOOLS.forEach(function (t) {
    nav.appendChild(h('a', { className: 'chip', href: '#' + t.id, 'data-id': t.id, text: t.title }));
  });
  window.addEventListener('hashchange', route);
  route();
})();
