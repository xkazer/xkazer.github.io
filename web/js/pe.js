(function () {
  'use strict';

  var Core = window.PECore;

  var MAX_IMPORT_ROWS = 2000;     // 筛选时自动展开的函数总数上限
  var MAX_EXPORT_ROWS = 2000;     // 导出表单次最多渲染行数

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

  function hx(v, w) { return '0x' + Core.hex(v, w === undefined ? 8 : w); }

  function fmtSize(n) {
    var s = n + ' 字节';
    if (n >= 1024 * 1024) s += '（' + (n / 1024 / 1024).toFixed(2) + ' MB）';
    else if (n >= 1024) s += '（' + (n / 1024).toFixed(2) + ' KB）';
    return s;
  }

  var toastTimer = 0;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  // ===================== 通用构件 =====================
  function kvGrid(items) {
    var g = h('div', { className: 'kv-grid' });
    items.forEach(function (it) {
      if (!it) return;
      g.appendChild(h('div', { className: 'kv' + (it[3] ? ' wide' : '') }, [
        h('span', { className: 'k', text: it[0] }),
        h('span', { className: 'v' + (it[2] ? ' mono' : ''), text: it[1] })
      ]));
    });
    return g;
  }

  /** cells：字符串 / 节点 / {t: 文本, c: 类名} */
  function table(headers, rows) {
    var thead = h('thead', {}, [h('tr', {}, headers.map(function (x) { return h('th', { text: x }); }))]);
    var tbody = h('tbody');
    rows.forEach(function (r) {
      var tr = h('tr', r.cls ? { className: r.cls } : null);
      r.cells.forEach(function (c) {
        var td = h('td');
        if (c && c.nodeType) td.appendChild(c);
        else if (c && typeof c === 'object') { td.textContent = c.t; if (c.c) td.className = c.c; if (c.title) td.title = c.title; }
        else td.textContent = c == null ? '' : String(c);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    return h('div', { className: 'table-wrap' }, [h('table', { className: 'pe-table' }, [thead, tbody])]);
  }

  function tags(list, warnFn) {
    var box = h('div', { className: 'flag-list' });
    list.forEach(function (f) {
      box.appendChild(h('span', { className: 'tag' + (warnFn && warnFn(f) ? ' warn' : ''), text: f.name, title: f.desc }));
    });
    if (!list.length) box.appendChild(h('span', { className: 'dim', text: '无' }));
    return box;
  }

  function entropyCell(e) {
    if (e === null) return { t: '-', c: 'dim' };
    var cls = e > 7.2 ? 'high' : e > 6.5 ? 'mid' : '';
    return h('div', { className: 'ent ' + cls, title: '香农熵 0~8，越接近 8 越像压缩 / 加密数据' }, [
      h('span', { className: 'bar' }, [h('i', { style: 'width:' + Math.min(100, e / 8 * 100).toFixed(1) + '%' })]),
      h('span', { className: 'val', text: e.toFixed(2) })
    ]);
  }

  function sectionLabel(info, idx) {
    return idx >= 0 && info.sections[idx] ? info.sections[idx].name : '-';
  }

  // ===================== 各标签页 =====================
  function renderOverview(info) {
    var ep = info.ep, o = info.opt, c = info.coff;
    var box = h('div');

    box.appendChild(h('h3', { text: '基本信息' }));
    box.appendChild(kvGrid([
      ['文件大小', fmtSize(info.fileSize)],
      ['文件类型', info.typeText + (info.isDotNet ? '（.NET 托管）' : '')],
      ['目标平台', c.machineName],
      ['子系统', o.subsystemName],
      ['入口点 (RVA)', ep.rva ? hx(ep.rva) : '无', true],
      ['文件偏移', ep.offset >= 0 ? hx(ep.offset) : (ep.rva ? '无法映射到文件' : '-'), true],
      ['入口所在节', ep.sectionIndex >= 0 ? ep.sectionName + '（第 ' + (ep.sectionIndex + 1) + ' 节）' : (ep.rva ? '不在任何节内' : '-')],
      ['入口首字节', ep.firstBytes || '-', true],
      ['链接器信息', info.linker + (info.linkerLabel ? '（' + info.linkerLabel + '）' : '')],
      ['编译时间', c.timeText],
      ['映像基址', '0x' + o.imageBase.hex, true],
      ['映像大小', hx(o.sizeOfImage) + '（' + o.sizeOfImage + '）', true],
      ['校验和', hx(o.checkSum), true],
      ['节数量', c.numberOfSections + (info.sections.length !== c.numberOfSections ? '（实际读取 ' + info.sections.length + '）' : '')],
      ['导入 / 导出', info.imports.length + ' 个 DLL，' + info.importFuncCount + ' 个导入函数 / ' + (info.exports ? info.exports.entries.length : 0) + ' 个导出'],
      ['附加数据', info.overlay ? hx(info.overlay.offset) + ' 起，' + info.overlay.size + ' 字节' : '无'],
      ['数字签名', info.cert ? '有（' + info.cert.size + ' 字节，未校验）' : '无']
    ]));

    box.appendChild(h('h3', { text: '识别结果' }));
    if (info.detections.length) {
      var list = h('div', { className: 'badges' });
      info.detections.forEach(function (d) {
        list.appendChild(h('div', { className: 'badge' + (d.level === 'warn' ? ' warn' : '') }, [
          h('b', { text: d.name }),
          d.note ? h('span', { text: d.note }) : null
        ]));
      });
      box.appendChild(list);
    } else {
      box.appendChild(h('div', { className: 'badge-empty', text: '未发现已知的壳 / 编译器特征，也没有明显异常。' }));
    }
    box.appendChild(h('p', { className: 'note', text: '以上结果由节名、入口点位置、熵值和链接器版本等特征推断，不是签名库匹配；加壳程序可以伪造这些特征，仅供参考。' }));

    if (info.warnings.length) {
      box.appendChild(h('h3', { text: '解析提示' }));
      var ul = h('ul', { className: 'warn-list' });
      info.warnings.slice(0, 50).forEach(function (w) { ul.appendChild(h('li', { text: w })); });
      if (info.warnings.length > 50) ul.appendChild(h('li', { text: '… 另有 ' + (info.warnings.length - 50) + ' 条提示' }));
      box.appendChild(ul);
    }
    return box;
  }

  function renderHeaders(info) {
    var o = info.opt, c = info.coff, is64 = info.is64;
    var box = h('div');
    var row = function (name, val, desc) { return { cells: [{ t: name, c: 'name' }, { t: val, c: 'mono' }, desc || '']}; };
    var big = function (v) { return '0x' + v.hex; };

    box.appendChild(h('h3', { text: 'DOS 头' }));
    box.appendChild(table(['字段', '值', '说明'], [
      row('e_magic', hx(info.dos.magic, 4), '"MZ"'),
      row('e_lfanew', hx(info.dos.lfanew), 'PE 头的文件偏移')
    ]));

    box.appendChild(h('h3', { text: '文件头 (COFF)' }));
    box.appendChild(table(['字段', '值', '说明'], [
      row('Machine', hx(c.machine, 4), c.machineName),
      row('NumberOfSections', String(c.numberOfSections), '节数量'),
      row('TimeDateStamp', hx(c.timeDateStamp), c.timeText),
      row('PointerToSymbolTable', hx(c.pointerToSymbolTable), ''),
      row('NumberOfSymbols', String(c.numberOfSymbols), ''),
      row('SizeOfOptionalHeader', hx(c.sizeOfOptionalHeader, 4) + '（' + c.sizeOfOptionalHeader + '）', '可选头大小'),
      { cells: [{ t: 'Characteristics', c: 'name' }, { t: hx(c.characteristics, 4), c: 'mono' }, tags(c.flags)] }
    ]));

    box.appendChild(h('h3', { text: '可选头 (' + (is64 ? 'PE32+' : 'PE32') + ')' }));
    var rows = [
      row('Magic', hx(o.magic, 4), is64 ? 'PE32+（64 位）' : 'PE32（32 位）'),
      row('LinkerVersion', info.linker, info.linkerLabel),
      row('SizeOfCode', hx(o.sizeOfCode), ''),
      row('SizeOfInitializedData', hx(o.sizeOfInitializedData), ''),
      row('SizeOfUninitializedData', hx(o.sizeOfUninitializedData), ''),
      row('AddressOfEntryPoint', hx(o.addressOfEntryPoint), '入口点 RVA'),
      row('BaseOfCode', hx(o.baseOfCode), '')
    ];
    if (!is64) rows.push(row('BaseOfData', hx(o.baseOfData), ''));
    rows.push(
      row('ImageBase', big(o.imageBase), '首选加载基址'),
      row('SectionAlignment', hx(o.sectionAlignment), '内存中节对齐'),
      row('FileAlignment', hx(o.fileAlignment), '文件中节对齐'),
      row('OperatingSystemVersion', o.majorOSVersion + '.' + o.minorOSVersion, ''),
      row('ImageVersion', o.majorImageVersion + '.' + o.minorImageVersion, ''),
      row('SubsystemVersion', o.majorSubsystemVersion + '.' + o.minorSubsystemVersion, ''),
      row('Win32VersionValue', hx(o.win32VersionValue), ''),
      row('SizeOfImage', hx(o.sizeOfImage), '映像在内存中的总大小'),
      row('SizeOfHeaders', hx(o.sizeOfHeaders), ''),
      row('CheckSum', hx(o.checkSum), ''),
      row('Subsystem', String(o.subsystem), o.subsystemName),
      { cells: [{ t: 'DllCharacteristics', c: 'name' }, { t: hx(o.dllCharacteristics, 4), c: 'mono' }, tags(o.dllFlags)] },
      row('SizeOfStackReserve', big(o.sizeOfStackReserve), ''),
      row('SizeOfStackCommit', big(o.sizeOfStackCommit), ''),
      row('SizeOfHeapReserve', big(o.sizeOfHeapReserve), ''),
      row('SizeOfHeapCommit', big(o.sizeOfHeapCommit), ''),
      row('LoaderFlags', hx(o.loaderFlags), ''),
      row('NumberOfRvaAndSizes', String(o.numberOfRvaAndSizes), '数据目录项数')
    );
    box.appendChild(table(['字段', '值', '说明'], rows));
    return box;
  }

  function renderDirs(info) {
    var rows = info.dirs.map(function (d) {
      var where = '-';
      if (d.present) where = d.index === 4 ? '文件末尾（证书区）' : (d.offset >= 0 ? sectionLabel(info, d.section) : '无法映射');
      return {
        cls: '',
        cells: [
          { t: String(d.index), c: 'num' }, { t: d.name, c: 'name' },
          { t: d.present ? hx(d.rva) : '-', c: d.present ? 'mono' : 'dim' },
          { t: d.present ? hx(d.size) : '-', c: d.present ? 'mono' : 'dim' },
          { t: d.present && d.offset >= 0 ? hx(d.offset) : '-', c: d.present && d.offset >= 0 ? 'mono' : 'dim' },
          where,
          { t: d.present ? '存在' : '无', c: d.present ? '' : 'dim' }
        ]
      };
    });
    var box = h('div');
    box.appendChild(table(['#', '名称', 'RVA', '大小', '文件偏移', '所在节', '状态'], rows));
    box.appendChild(h('p', { className: 'note', text: '安全证书目录的“RVA”实际是文件偏移，其余目录为内存相对地址。' }));
    return box;
  }

  function renderSections(info) {
    if (!info.sections.length) return h('div', { className: 'empty', text: '该文件没有节表' });
    var rows = info.sections.map(function (s) {
      var risky = s.perm === 'RWX' || s.truncated;
      return {
        cls: risky ? 'warn' : '',
        cells: [
          { t: String(s.index + 1), c: 'num' }, { t: s.name || '(空)', c: 'name' },
          { t: hx(s.virtualAddress), c: 'mono' }, { t: hx(s.virtualSize), c: 'mono' },
          { t: hx(s.pointerToRawData), c: 'mono' }, { t: hx(s.sizeOfRawData), c: 'mono' },
          { t: s.perm, c: 'mono', title: 'R 可读 / W 可写 / X 可执行' },
          entropyCell(s.entropy),
          { t: hx(s.characteristics), c: 'mono' },
          tags(s.flags, function (f) { return f.mask === 0x20000000 && s.writable; })
        ]
      };
    });
    var box = h('div');
    box.appendChild(table(['#', '名称', '虚拟地址', '虚拟大小', '原始偏移', '原始大小', '权限', '熵', '特征值', '属性'], rows));
    box.appendChild(h('p', { className: 'note', text: '橙色行表示可读写可执行（RWX）的节，或原始数据超出文件末尾。熵高于 7.2 标红，通常意味着数据已压缩或加密。' }));
    return box;
  }

  // ---- 导入表 ----
  function funcLabel(f) {
    return f.name !== null ? f.name : 'Ordinal #' + f.ordinal;
  }

  function renderImports(info) {
    if (!info.imports.length) return h('div', { className: 'empty', text: '该文件没有导入表' });

    var filter = h('input', { className: 'inp', type: 'text', placeholder: '按 DLL 名或函数名筛选，如 kernel32 / CreateFile', spellcheck: false });
    var tip = h('span', { className: 'filter-info' });
    var list = h('div', { className: 'imp-list' });

    function fill(det, funcs) {
      if (det.getAttribute('data-filled')) return;
      det.setAttribute('data-filled', '1');
      var rows = funcs.map(function (f) {
        return {
          cls: f.invalid ? 'warn' : '',
          cells: [
            { t: f.iatRva ? hx(f.iatRva) : '-', c: f.iatRva ? 'mono' : 'dim' },
            { t: f.hint !== null ? String(f.hint) : '-', c: 'num' },
            { t: funcLabel(f), c: f.name !== null ? 'wrap' : 'wrap dim' }
          ]
        };
      });
      det.appendChild(table(['IAT RVA', 'Hint', '函数'], rows));
    }

    function render() {
      var q = filter.value.trim().toLowerCase();
      list.textContent = '';
      var groups = [], total = 0;
      info.imports.forEach(function (m) {
        var dllHit = !q || m.dll.toLowerCase().indexOf(q) >= 0;
        var funcs = dllHit ? m.funcs : m.funcs.filter(function (f) { return funcLabel(f).toLowerCase().indexOf(q) >= 0; });
        if (!funcs.length && !(dllHit && !m.funcs.length)) return;
        groups.push({ m: m, funcs: funcs });
        total += funcs.length;
      });

      var autoOpen = q && total <= MAX_IMPORT_ROWS;
      groups.forEach(function (g) {
        var det = h('details', { className: 'imp-group' });
        det.appendChild(h('summary', {}, [
          h('span', { className: 'dll', text: g.m.dll }),
          g.m.delay ? h('span', { className: 'tag', text: '延迟加载' }) : null,
          h('span', { className: 'count', text: g.funcs.length + (q && g.funcs.length !== g.m.funcs.length ? ' / ' + g.m.funcs.length : '') + ' 个函数' })
        ]));
        det.addEventListener('toggle', function () { if (det.open) fill(det, g.funcs); });
        list.appendChild(det);
        if (autoOpen) det.open = true;
      });

      if (!groups.length) list.appendChild(h('div', { className: 'empty', text: '没有匹配项' }));
      tip.textContent = q
        ? '匹配 ' + groups.length + ' 个 DLL，' + total + ' 个函数' + (q && !autoOpen && groups.length ? '（匹配较多，请手动展开）' : '')
        : '共 ' + info.imports.length + ' 个 DLL，' + info.importFuncCount + ' 个函数';
    }

    function setAll(open) {
      var ds = list.querySelectorAll('details');
      if (open && ds.length > 40 && !window.confirm('将展开 ' + ds.length + ' 个 DLL，内容较多，是否继续？')) return;
      for (var i = 0; i < ds.length; i++) ds[i].open = open;
    }

    var t;
    filter.addEventListener('input', function () { clearTimeout(t); t = setTimeout(render, 150); });

    var box = h('div');
    box.appendChild(h('div', { className: 'filter-bar' }, [
      filter,
      h('button', { type: 'button', className: 'btn ghost sm', text: '全部展开', onclick: function () { setAll(true); } }),
      h('button', { type: 'button', className: 'btn ghost sm', text: '全部折叠', onclick: function () { setAll(false); } }),
      tip
    ]));
    box.appendChild(list);
    render();
    return box;
  }

  // ---- 导出表 ----
  function renderExports(info) {
    var ex = info.exports;
    if (!ex) return h('div', { className: 'empty', text: '该文件没有导出表' });

    var box = h('div');
    box.appendChild(kvGrid([
      ['模块名', ex.name || '-'],
      ['序号起始', String(ex.base)],
      ['函数数量', String(ex.numFunctions) + '（有效 ' + ex.entries.length + '）'],
      ['名称数量', String(ex.numNames)],
      ['时间戳', ex.timeText]
    ]));

    var filter = h('input', { className: 'inp', type: 'text', placeholder: '按函数名、转发目标或序号筛选', spellcheck: false });
    var tip = h('span', { className: 'filter-info' });
    var holder = h('div');

    function render() {
      var q = filter.value.trim().toLowerCase();
      var list = !q ? ex.entries : ex.entries.filter(function (e) {
        return (e.name && e.name.toLowerCase().indexOf(q) >= 0) ||
          (e.forwarder && e.forwarder.toLowerCase().indexOf(q) >= 0) ||
          String(e.ordinal) === q;
      });
      var shown = list.slice(0, MAX_EXPORT_ROWS);
      holder.textContent = '';
      if (!list.length) {
        holder.appendChild(h('div', { className: 'empty', text: '没有匹配项' }));
      } else {
        holder.appendChild(table(['序号', 'RVA', '名称', '转发'], shown.map(function (e) {
          return {
            cells: [
              { t: String(e.ordinal), c: 'num' }, { t: hx(e.rva), c: 'mono' },
              e.name !== null ? { t: e.name, c: 'wrap' } : { t: '(仅序号)', c: 'dim' },
              e.forwarder ? { t: e.forwarder, c: 'wrap' } : ''
            ]
          };
        })));
        if (list.length > shown.length) {
          holder.appendChild(h('div', { className: 'more-row', text: '仅显示前 ' + shown.length + ' 项，请用上方筛选缩小范围。' }));
        }
      }
      tip.textContent = (q ? '匹配 ' : '共 ') + list.length + ' 项';
    }

    var t;
    filter.addEventListener('input', function () { clearTimeout(t); t = setTimeout(render, 150); });
    box.appendChild(h('h3', { text: '导出函数' }));
    box.appendChild(h('div', { className: 'filter-bar' }, [filter, tip]));
    box.appendChild(holder);
    render();
    return box;
  }

  // ===================== 标签与加载 =====================
  var current = null;     // { name, info }
  var tabId = 'overview';
  var TABS = [
    { id: 'overview', label: '概览', render: renderOverview },
    { id: 'headers', label: '头信息', render: renderHeaders },
    { id: 'dirs', label: '数据目录', render: renderDirs },
    { id: 'sections', label: '节表', render: renderSections, count: function (i) { return i.sections.length; } },
    { id: 'imports', label: '导入表', render: renderImports, count: function (i) { return i.imports.length; } },
    { id: 'exports', label: '导出表', render: renderExports, count: function (i) { return i.exports ? i.exports.entries.length : 0; } }
  ];

  function showTab(id) {
    tabId = id;
    var tabs = $('peTabs'), panel = $('pePanel');
    var def = TABS.filter(function (t) { return t.id === id; })[0] || TABS[0];
    var btns = tabs.querySelectorAll('.pe-tab');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-id') === def.id;
      btns[i].classList.toggle('active', on);
      btns[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    panel.textContent = '';
    if (current) panel.appendChild(def.render(current.info));
  }

  function buildTabs(info) {
    var tabs = $('peTabs');
    tabs.textContent = '';
    TABS.forEach(function (t) {
      var b = h('button', { type: 'button', className: 'pe-tab', role: 'tab', 'data-id': t.id, onclick: function () { showTab(t.id); } }, [t.label]);
      if (t.count) b.appendChild(h('span', { className: 'cnt', text: String(t.count(info)) }));
      tabs.appendChild(b);
    });
  }

  function showError(msg) {
    var box = $('errorBox');
    box.textContent = msg;
    box.hidden = !msg;
  }

  function loadFile(file) {
    if (!file) return;
    showError('');
    $('dropZone').querySelector('.drop-title').textContent = '正在分析 ' + file.name + ' ...';
    file.arrayBuffer().then(function (buf) {
      var info;
      try {
        info = Core.parse(new Uint8Array(buf));
      } catch (e) {
        current = null;
        $('result').hidden = true;
        $('fileName').textContent = file.name;
        showError('解析失败：' + (e.message || String(e)));
        resetDrop();
        return;
      }
      current = { name: file.name, info: info };
      $('fileName').textContent = file.name;
      document.title = file.name + ' - PE文件分析 - xkazer';
      $('result').hidden = false;
      buildTabs(info);
      showTab('overview');
      resetDrop(true);
    }).catch(function () {
      showError('读取文件失败，文件可能过大或无法访问');
      resetDrop();
    });
  }

  function resetDrop(compact) {
    var dz = $('dropZone');
    dz.querySelector('.drop-title').textContent = compact ? '点击或拖放以打开其他文件' : '点击选择文件，或将文件拖放到此处';
    dz.classList.toggle('compact', !!compact);
  }

  var fileInput = $('fileInput'), dropZone = $('dropZone');
  dropZone.addEventListener('click', function () { fileInput.click(); });
  dropZone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    loadFile(f);
  });
  document.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('over'); });
  document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) dropZone.classList.remove('over'); });
  document.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('over');
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    loadFile(f);
  });
})();
