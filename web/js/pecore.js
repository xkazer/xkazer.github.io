/**
 * PE 文件解析核心：DOS/COFF/可选头、数据目录、节表（含熵）、导入/延迟导入、导出，
 * 以及类 PEiD 的入口点信息与加壳/编译器启发式识别。
 * 不依赖 DOM，浏览器与 Node 均可使用。所有读取都做边界检查，损坏的结构只产生警告，不会中断整体解析。
 */
(function (root) {
  'use strict';

  var MAX_SECTIONS = 512;
  var MAX_IMPORT_DLLS = 4096;
  var MAX_THUNKS = 65536;
  var MAX_EXPORTS = 65536;
  var MAX_STR = 512;

  // ===================== 常量表 =====================
  var MACHINES = {
    0x0: '未知 / 任意', 0x14c: 'x86 (Intel 386)', 0x8664: 'x64 (AMD64)', 0x1c0: 'ARM',
    0x1c4: 'ARM Thumb-2 (ARMNT)', 0xaa64: 'ARM64', 0x200: 'Intel Itanium (IA-64)',
    0xebc: 'EFI 字节码', 0x5032: 'RISC-V 32', 0x5064: 'RISC-V 64', 0x166: 'MIPS R4000'
  };

  var SUBSYSTEMS = {
    0: '未知', 1: 'Native（原生/驱动）', 2: 'Windows GUI', 3: 'Windows 控制台 (CUI)', 5: 'OS/2 控制台',
    7: 'POSIX 控制台', 9: 'Windows CE GUI', 10: 'EFI 应用程序', 11: 'EFI 启动服务驱动',
    12: 'EFI 运行时驱动', 13: 'EFI ROM', 14: 'Xbox', 16: 'Windows 启动应用程序'
  };

  var COFF_FLAGS = [
    [0x0001, 'RELOCS_STRIPPED', '重定位信息已剥离'], [0x0002, 'EXECUTABLE_IMAGE', '可执行映像'],
    [0x0004, 'LINE_NUMS_STRIPPED', '行号信息已剥离'], [0x0008, 'LOCAL_SYMS_STRIPPED', '本地符号已剥离'],
    [0x0020, 'LARGE_ADDRESS_AWARE', '可处理大于 2GB 的地址'], [0x0100, 'BIT32_MACHINE', '32 位机器'],
    [0x0200, 'DEBUG_STRIPPED', '调试信息已剥离'], [0x0400, 'REMOVABLE_RUN_FROM_SWAP', '可移动介质上先拷到交换文件再运行'],
    [0x0800, 'NET_RUN_FROM_SWAP', '网络上先拷到交换文件再运行'], [0x1000, 'SYSTEM', '系统文件（如驱动）'],
    [0x2000, 'DLL', '动态链接库'], [0x4000, 'UP_SYSTEM_ONLY', '仅限单处理器']
  ];

  var DLL_FLAGS = [
    [0x0020, 'HIGH_ENTROPY_VA', '64 位高熵 ASLR'], [0x0040, 'DYNAMIC_BASE', '支持 ASLR（可随机基址）'],
    [0x0080, 'FORCE_INTEGRITY', '强制代码完整性检查'], [0x0100, 'NX_COMPAT', '兼容 DEP（数据执行保护）'],
    [0x0200, 'NO_ISOLATION', '不使用隔离'], [0x0400, 'NO_SEH', '不使用 SEH'],
    [0x0800, 'NO_BIND', '不绑定'], [0x1000, 'APPCONTAINER', '须在 AppContainer 中运行'],
    [0x2000, 'WDM_DRIVER', 'WDM 驱动'], [0x4000, 'GUARD_CF', '控制流防护 (CFG)'],
    [0x8000, 'TERMINAL_SERVER_AWARE', '支持终端服务']
  ];

  var SECTION_FLAGS = [
    [0x00000020, 'CNT_CODE', '含代码'], [0x00000040, 'CNT_INITIALIZED_DATA', '含已初始化数据'],
    [0x00000080, 'CNT_UNINITIALIZED_DATA', '含未初始化数据'], [0x02000000, 'MEM_DISCARDABLE', '可丢弃'],
    [0x04000000, 'MEM_NOT_CACHED', '不缓存'], [0x08000000, 'MEM_NOT_PAGED', '不可换页'],
    [0x10000000, 'MEM_SHARED', '可共享'], [0x20000000, 'MEM_EXECUTE', '可执行'],
    [0x40000000, 'MEM_READ', '可读'], [0x80000000, 'MEM_WRITE', '可写']
  ];

  var DIR_NAMES = [
    '导出表 (Export)', '导入表 (Import)', '资源 (Resource)', '异常 (Exception)', '安全证书 (Security)',
    '基址重定位 (Relocation)', '调试 (Debug)', '架构 (Architecture)', '全局指针 (Global Ptr)', 'TLS',
    '加载配置 (Load Config)', '绑定导入 (Bound Import)', '导入地址表 (IAT)', '延迟导入 (Delay Import)',
    'CLR 运行时 (.NET)', '保留 (Reserved)'
  ];

  // 节名 → 壳/保护器/安装器（名称特征比较明确的才收录）
  var SECTION_SIGNS = {
    'upx0': 'UPX', 'upx1': 'UPX', 'upx2': 'UPX', 'upx!': 'UPX',
    '.aspack': 'ASPack', '.adata': 'ASPack',
    '.mpress1': 'MPRESS', '.mpress2': 'MPRESS',
    '.themida': 'Themida / WinLicense', '.winlice': 'Themida / WinLicense',
    '.vmp0': 'VMProtect', '.vmp1': 'VMProtect', '.vmp2': 'VMProtect',
    'pec1': 'PECompact', 'pec2': 'PECompact', 'pecompact2': 'PECompact',
    '.nsp0': 'NsPack', '.nsp1': 'NsPack', '.nsp2': 'NsPack', 'nsp0': 'NsPack', 'nsp1': 'NsPack', 'nsp2': 'NsPack',
    '.petite': 'Petite',
    '.enigma1': 'Enigma Protector', '.enigma2': 'Enigma Protector',
    '.ndata': 'Nullsoft 安装程序 (NSIS)'
  };

  // ===================== 工具 =====================
  function hex(v, w) {
    var s = Number(v).toString(16).toUpperCase();
    while (s.length < (w || 0)) s = '0' + s;
    return s;
  }

  function Reader(u8) {
    this.u8 = u8;
    this.n = u8.length;
    this.dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  }
  Reader.prototype.chk = function (off, len) {
    if (!(off >= 0) || off + len > this.n) throw new RangeError('读取越界（偏移 0x' + hex(off) + '）');
  };
  Reader.prototype.u8_ = function (off) { this.chk(off, 1); return this.u8[off]; };
  Reader.prototype.u16 = function (off) { this.chk(off, 2); return this.dv.getUint16(off, true); };
  Reader.prototype.u32 = function (off) { this.chk(off, 4); return this.dv.getUint32(off, true); };
  Reader.prototype.u64 = function (off) {
    var lo = this.u32(off), hi = this.u32(off + 4);
    return { lo: lo, hi: hi, num: hi * 4294967296 + lo, hex: hex(hi, 8) + hex(lo, 8) };
  };
  Reader.prototype.cstr = function (off, max) {
    this.chk(off, 1);
    var end = Math.min(this.n, off + (max || MAX_STR)), s = '';
    for (var i = off; i < end; i++) {
      var c = this.u8[i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };

  function flagList(table, value) {
    var out = [];
    table.forEach(function (f) { if ((value & f[0]) >>> 0 === f[0]) out.push({ name: f[1], desc: f[2], mask: f[0] }); });
    return out;
  }

  function entropy(u8, start, end) {
    var len = end - start;
    if (len <= 0) return 0;
    var cnt = new Uint32Array(256), i, e = 0;
    for (i = start; i < end; i++) cnt[u8[i]]++;
    for (i = 0; i < 256; i++) {
      if (cnt[i]) {
        var p = cnt[i] / len;
        e -= p * Math.log(p) / Math.LN2;
      }
    }
    return e;
  }

  function timeText(ts) {
    if (!ts) return '0（未设置）';
    var s = new Date(ts * 1000).toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
    if (ts * 1000 > Date.now() + 86400000) s += '（晚于当前时间，可能是可重现构建的哈希值）';
    return s;
  }

  function linkerLabel(maj, min) {
    if (maj === 14) {
      if (min < 10) return 'VS 2015';
      if (min < 20) return 'VS 2017';
      if (min < 30) return 'VS 2019';
      return 'VS 2022';
    }
    if (maj === 12 && min === 0) return 'VS 2013';
    if (maj === 11 && min === 0) return 'VS 2012';
    if (maj === 10 && min === 0) return 'VS 2010';
    if (maj === 9 && min === 0) return 'VS 2008';
    if (maj === 8 && min === 0) return 'VS 2005';
    if (maj === 7 && min === 10) return 'VS 2003';
    if (maj === 7 && min === 0) return 'VS 2002';
    if (maj === 6 && min === 0) return 'Visual C++ 6.0';
    return '';
  }

  // ===================== 解析 =====================
  function parse(u8) {
    var size = u8.length, r = new Reader(u8), warnings = [];
    function warn(m) { warnings.push(m); }

    // ---- DOS / PE 签名 ----
    if (size < 0x40 || r.u16(0) !== 0x5A4D) throw new Error('不是有效的 PE 文件：缺少 MZ 头（DOS 签名）');
    var lfanew = r.u32(0x3C);
    if (lfanew + 24 > size) throw new Error('不是有效的 PE 文件：PE 头偏移 0x' + hex(lfanew, 8) + ' 超出文件范围');
    if (r.u32(lfanew) !== 0x00004550) {
      var two = String.fromCharCode(u8[lfanew], u8[lfanew + 1]);
      if (two === 'NE' || two === 'LE' || two === 'LX') {
        throw new Error('这是 16 位 / OS2 的 ' + two + ' 格式可执行文件，不是 PE 文件');
      }
      throw new Error('不是有效的 PE 文件：未找到 PE 签名（偏移 0x' + hex(lfanew, 8) + '）');
    }

    // ---- COFF 文件头 ----
    var co = lfanew + 4;
    var coff = {
      machine: r.u16(co), numberOfSections: r.u16(co + 2), timeDateStamp: r.u32(co + 4),
      pointerToSymbolTable: r.u32(co + 8), numberOfSymbols: r.u32(co + 12),
      sizeOfOptionalHeader: r.u16(co + 16), characteristics: r.u16(co + 18)
    };
    coff.machineName = MACHINES[coff.machine] || ('未知 (0x' + hex(coff.machine, 4) + ')');
    coff.flags = flagList(COFF_FLAGS, coff.characteristics);
    coff.timeText = timeText(coff.timeDateStamp);

    // ---- 可选头 ----
    var oh = co + 20, sizeOpt = coff.sizeOfOptionalHeader;
    var magic = r.u16(oh);
    if (magic !== 0x10B && magic !== 0x20B) {
      throw new Error('不支持的可选头类型 0x' + hex(magic, 4) + (magic === 0x107 ? '（ROM 映像）' : ''));
    }
    var is64 = magic === 0x20B;
    var fixedLen = is64 ? 112 : 96;
    if (sizeOpt < fixedLen) throw new Error('可选头长度（' + sizeOpt + '）小于标准长度（' + fixedLen + '），文件可能已损坏');
    if (oh + fixedLen > size) throw new Error('文件被截断：PE 头不完整（可选头在偏移 0x' + hex(size) + ' 处结束）');

    var opt = {
      magic: magic, majorLinker: r.u8_(oh + 2), minorLinker: r.u8_(oh + 3),
      sizeOfCode: r.u32(oh + 4), sizeOfInitializedData: r.u32(oh + 8), sizeOfUninitializedData: r.u32(oh + 12),
      addressOfEntryPoint: r.u32(oh + 16), baseOfCode: r.u32(oh + 20),
      baseOfData: is64 ? null : r.u32(oh + 24),
      imageBase: is64 ? r.u64(oh + 24) : (function () { var v = r.u32(oh + 28); return { lo: v, hi: 0, num: v, hex: hex(v, 8) }; })(),
      sectionAlignment: r.u32(oh + 32), fileAlignment: r.u32(oh + 36),
      majorOSVersion: r.u16(oh + 40), minorOSVersion: r.u16(oh + 42),
      majorImageVersion: r.u16(oh + 44), minorImageVersion: r.u16(oh + 46),
      majorSubsystemVersion: r.u16(oh + 48), minorSubsystemVersion: r.u16(oh + 50),
      win32VersionValue: r.u32(oh + 52), sizeOfImage: r.u32(oh + 56), sizeOfHeaders: r.u32(oh + 60),
      checkSum: r.u32(oh + 64), subsystem: r.u16(oh + 68), dllCharacteristics: r.u16(oh + 70)
    };
    var big = function (off32, off64) {
      if (is64) return r.u64(off64);
      var v = r.u32(off32);
      return { lo: v, hi: 0, num: v, hex: hex(v, 8) };
    };
    opt.sizeOfStackReserve = big(oh + 72, oh + 72);
    opt.sizeOfStackCommit = big(oh + 76, oh + 80);
    opt.sizeOfHeapReserve = big(oh + 80, oh + 88);
    opt.sizeOfHeapCommit = big(oh + 84, oh + 96);
    opt.loaderFlags = r.u32(is64 ? oh + 104 : oh + 88);
    opt.numberOfRvaAndSizes = r.u32(is64 ? oh + 108 : oh + 92);
    opt.subsystemName = SUBSYSTEMS[opt.subsystem] || ('未知 (' + opt.subsystem + ')');
    opt.dllFlags = flagList(DLL_FLAGS, opt.dllCharacteristics);

    // ---- 数据目录 ----
    var dirBase = oh + fixedLen;
    var dirCount = Math.min(opt.numberOfRvaAndSizes, 16, Math.floor((sizeOpt - fixedLen) / 8), Math.floor((size - dirBase) / 8));
    if (opt.numberOfRvaAndSizes > 16) warn('NumberOfRvaAndSizes 为 ' + opt.numberOfRvaAndSizes + '，超过 16，仅解析前 16 项');
    var dirs = [];
    for (var di = 0; di < 16; di++) {
      var d = { index: di, name: DIR_NAMES[di], rva: 0, size: 0 };
      if (di < dirCount) {
        d.rva = r.u32(dirBase + di * 8);
        d.size = r.u32(dirBase + di * 8 + 4);
      }
      d.present = d.rva !== 0 && d.size !== 0;
      dirs.push(d);
    }

    // ---- 节表 ----
    var secTable = oh + sizeOpt;
    if (coff.numberOfSections > 96) warn('节数量为 ' + coff.numberOfSections + '，超过 Windows 加载器上限 96');
    var secCount = Math.min(coff.numberOfSections, MAX_SECTIONS);
    var sections = [];
    for (var si = 0; si < secCount; si++) {
      var sb = secTable + si * 40;
      if (sb + 40 > size) { warn('节表被截断：仅读取到 ' + si + ' / ' + coff.numberOfSections + ' 个节'); break; }
      var nm = '';
      for (var ni = 0; ni < 8; ni++) {
        var ch = u8[sb + ni];
        if (ch === 0) break;
        nm += (ch >= 0x20 && ch < 0x7F) ? String.fromCharCode(ch) : '?';
      }
      var sec = {
        index: si, name: nm, virtualSize: r.u32(sb + 8), virtualAddress: r.u32(sb + 12),
        sizeOfRawData: r.u32(sb + 16), pointerToRawData: r.u32(sb + 20),
        pointerToRelocations: r.u32(sb + 24), pointerToLinenumbers: r.u32(sb + 28),
        numberOfRelocations: r.u16(sb + 32), numberOfLinenumbers: r.u16(sb + 34),
        characteristics: r.u32(sb + 36)
      };
      var c = sec.characteristics;
      sec.perm = ((c & 0x40000000) ? 'R' : '-') + ((c & 0x80000000) ? 'W' : '-') + ((c & 0x20000000) ? 'X' : '-');
      sec.flags = flagList(SECTION_FLAGS, c);
      sec.executable = (c & 0x20000000) !== 0;
      sec.writable = (c & 0x80000000) !== 0;
      sec.truncated = false;
      sec.entropy = null;
      if (sec.sizeOfRawData > 0) {
        var s0 = sec.pointerToRawData, e0 = s0 + sec.sizeOfRawData;
        if (s0 >= size) {
          sec.truncated = true;
          warn('节 ' + nm + ' 的原始数据偏移 0x' + hex(s0, 8) + ' 超出文件范围');
        } else {
          if (e0 > size) {
            sec.truncated = true;
            e0 = size;
            warn('节 ' + nm + ' 的原始数据超出文件末尾（文件可能被截断）');
          }
          sec.entropy = entropy(u8, s0, e0);
        }
      }
      sections.push(sec);
    }

    function sectionIndexOfRva(rva) {
      for (var i = 0; i < sections.length; i++) {
        var s = sections[i];
        var span = Math.max(s.virtualSize, s.sizeOfRawData);
        if (rva >= s.virtualAddress && rva < s.virtualAddress + span) return i;
      }
      return -1;
    }

    // RVA → 文件偏移；无法映射（不在任何节内、或落在未初始化区域）返回 -1
    function rvaToOffset(rva) {
      if (rva < 0 || rva !== rva) return -1;
      var firstVA = sections.length ? sections[0].virtualAddress : Infinity;
      for (var i = 0; i < sections.length; i++) if (sections[i].virtualAddress < firstVA) firstVA = sections[i].virtualAddress;
      if (rva < Math.min(opt.sizeOfHeaders || size, firstVA)) return rva < size ? rva : -1;
      var idx = sectionIndexOfRva(rva);
      if (idx < 0) return -1;
      var s = sections[idx], delta = rva - s.virtualAddress;
      if (delta >= s.sizeOfRawData) return -1;
      var off = s.pointerToRawData + delta;
      return off < size ? off : -1;
    }

    dirs.forEach(function (dd) {
      if (!dd.present) { dd.offset = -1; dd.section = -1; return; }
      if (dd.index === 4) { dd.offset = dd.rva; dd.section = -1; return; }   // 证书目录：这里是文件偏移
      dd.offset = rvaToOffset(dd.rva);
      dd.section = sectionIndexOfRva(dd.rva);
    });

    var ctx = { r: r, u8: u8, size: size, is64: is64, rvaToOffset: rvaToOffset, opt: opt, warn: warn };

    // ---- 入口点 ----
    var epRva = opt.addressOfEntryPoint;
    var ep = {
      rva: epRva, offset: -1, sectionIndex: -1, sectionName: '', firstBytes: ''
    };
    if (epRva) {
      ep.sectionIndex = sectionIndexOfRva(epRva);
      ep.sectionName = ep.sectionIndex >= 0 ? sections[ep.sectionIndex].name : '';
      ep.offset = rvaToOffset(epRva);
      if (ep.offset >= 0) {
        var fb = [], lim = Math.min(16, size - ep.offset);
        for (var bi = 0; bi < lim; bi++) fb.push(hex(u8[ep.offset + bi], 2));
        ep.firstBytes = fb.join(' ');
      }
    }

    // ---- 导入 / 导出 ----
    var imports = [], exportsInfo = null;
    try { imports = parseImports(ctx, dirs[1], false).concat(parseImports(ctx, dirs[13], true)); }
    catch (e) { warn('导入表解析失败：' + e.message); }
    try { exportsInfo = parseExports(ctx, dirs[0]); }
    catch (e) { warn('导出表解析失败：' + e.message); }

    var importFuncCount = 0;
    imports.forEach(function (m) { importFuncCount += m.funcs.length; });

    // ---- Overlay / 证书 ----
    var dataEnd = opt.sizeOfHeaders;
    sections.forEach(function (s) {
      if (s.sizeOfRawData) dataEnd = Math.max(dataEnd, s.pointerToRawData + s.sizeOfRawData);
    });
    var overlay = size > dataEnd ? { offset: dataEnd, size: size - dataEnd, signedBytes: 0 } : null;
    var cert = dirs[4].present ? { offset: dirs[4].rva, size: dirs[4].size } : null;
    if (overlay && cert && cert.offset >= overlay.offset) overlay.signedBytes = Math.min(cert.size, overlay.size);

    var info = {
      fileSize: size, lfanew: lfanew,
      dos: { magic: r.u16(0), lastPageBytes: r.u16(2), pages: r.u16(4), lfanew: lfanew },
      coff: coff, opt: opt, is64: is64, dirs: dirs, sections: sections, ep: ep,
      imports: imports, importFuncCount: importFuncCount, exports: exportsInfo,
      overlay: overlay, cert: cert, isDotNet: dirs[14].present,
      isDll: (coff.characteristics & 0x2000) !== 0,
      isDriver: (coff.characteristics & 0x1000) !== 0 || opt.subsystem === 1,
      linker: opt.majorLinker + '.' + opt.minorLinker,
      linkerLabel: linkerLabel(opt.majorLinker, opt.minorLinker),
      warnings: warnings, sectionIndexOfRva: sectionIndexOfRva, rvaToOffset: rvaToOffset
    };
    info.typeText = (is64 ? '64 位 ' : '32 位 ') + (info.isDll ? 'DLL' : info.isDriver ? '驱动 / 原生程序' : 'EXE');
    info.detections = detect(info);
    return info;
  }

  // ===================== 导入表 =====================
  function readThunks(ctx, lookupRva, iatRva, flags) {
    var step = ctx.is64 ? 8 : 4, out = [], r = ctx.r;
    for (var i = 0; i < MAX_THUNKS; i++) {
      var off = ctx.rvaToOffset(lookupRva + i * step);
      if (off < 0 || off + step > ctx.size) {
        if (i === 0) ctx.warn('导入函数表 RVA 0x' + hex(lookupRva, 8) + ' 无法映射到文件' + (flags.dll ? '（' + flags.dll + '）' : ''));
        break;
      }
      var lo = r.u32(off), hi = ctx.is64 ? r.u32(off + 4) : 0;
      if (lo === 0 && hi === 0) break;
      var isOrd = ctx.is64 ? (hi & 0x80000000) !== 0 : (lo & 0x80000000) !== 0;
      var fn = { iatRva: iatRva ? iatRva + i * step : 0, hint: null, name: null, ordinal: null, invalid: false };
      if (isOrd) {
        fn.ordinal = lo & 0xFFFF;
      } else {
        var no = ctx.rvaToOffset(lo & 0x7FFFFFFF);
        if (no < 0 || no + 2 >= ctx.size) {
          fn.invalid = true;
          fn.name = '<无效 RVA 0x' + hex(lo, 8) + '>';
        } else {
          fn.hint = r.u16(no);
          fn.name = r.cstr(no + 2);
        }
      }
      out.push(fn);
      if (i === MAX_THUNKS - 1) ctx.warn('导入函数过多，仅读取前 ' + MAX_THUNKS + ' 个');
    }
    return out;
  }

  function parseImports(ctx, dir, delay) {
    var out = [];
    if (!dir.present) return out;
    var r = ctx.r, base = ctx.rvaToOffset(dir.rva);
    var label = delay ? '延迟导入表' : '导入表';
    if (base < 0) { ctx.warn(label + ' RVA 0x' + hex(dir.rva, 8) + ' 无法映射到文件'); return out; }
    var stride = delay ? 32 : 20;
    var toRva = function (v, attrs) {
      if (!delay || (attrs & 1) || v === 0) return v;
      return v - ctx.opt.imageBase.num;     // 旧式延迟导入使用 VA
    };

    for (var i = 0; i < MAX_IMPORT_DLLS; i++) {
      var p = base + i * stride;
      if (p + stride > ctx.size) { ctx.warn(label + '被截断'); break; }
      var m;
      if (delay) {
        var attrs = r.u32(p);
        var nameRva = toRva(r.u32(p + 4), attrs), iat = toRva(r.u32(p + 12), attrs), int_ = toRva(r.u32(p + 16), attrs);
        if (attrs === 0 && nameRva === 0 && !iat && !int_) break;
        m = { delay: true, nameRva: nameRva, lookupRva: int_, iatRva: iat, timeDateStamp: r.u32(p + 28) };
      } else {
        var oft = r.u32(p), tds = r.u32(p + 4), fc = r.u32(p + 8), nr = r.u32(p + 12), ft = r.u32(p + 16);
        if (!oft && !tds && !fc && !nr && !ft) break;
        m = { delay: false, nameRva: nr, lookupRva: oft || ft, iatRva: ft, timeDateStamp: tds, forwarderChain: fc };
      }
      var no = ctx.rvaToOffset(m.nameRva);
      m.dll = no >= 0 ? r.cstr(no, 260) : '<无效 RVA 0x' + hex(m.nameRva, 8) + '>';
      m.funcs = m.lookupRva ? readThunks(ctx, m.lookupRva, m.iatRva, { dll: m.dll }) : [];
      out.push(m);
      if (i === MAX_IMPORT_DLLS - 1) ctx.warn(label + '条目过多，仅读取前 ' + MAX_IMPORT_DLLS + ' 个');
    }
    return out;
  }

  // ===================== 导出表 =====================
  function parseExports(ctx, dir) {
    if (!dir.present) return null;
    var r = ctx.r, off = ctx.rvaToOffset(dir.rva);
    if (off < 0 || off + 40 > ctx.size) { ctx.warn('导出表 RVA 0x' + hex(dir.rva, 8) + ' 无法映射到文件'); return null; }
    var e = {
      characteristics: r.u32(off), timeDateStamp: r.u32(off + 4), majorVersion: r.u16(off + 8), minorVersion: r.u16(off + 10),
      nameRva: r.u32(off + 12), base: r.u32(off + 16), numFunctions: r.u32(off + 20), numNames: r.u32(off + 24),
      addrFuncs: r.u32(off + 28), addrNames: r.u32(off + 32), addrOrds: r.u32(off + 36), entries: []
    };
    var no = ctx.rvaToOffset(e.nameRva);
    e.name = no >= 0 ? r.cstr(no, 260) : '';
    e.timeText = timeText(e.timeDateStamp);

    var nf = e.numFunctions, nn = e.numNames;
    if (nf > MAX_EXPORTS) { ctx.warn('导出函数数量为 ' + nf + '，仅读取前 ' + MAX_EXPORTS + ' 个'); nf = MAX_EXPORTS; }
    if (nn > MAX_EXPORTS) { ctx.warn('导出名称数量为 ' + nn + '，仅读取前 ' + MAX_EXPORTS + ' 个'); nn = MAX_EXPORTS; }

    var fOff = ctx.rvaToOffset(e.addrFuncs), nOff = ctx.rvaToOffset(e.addrNames), oOff = ctx.rvaToOffset(e.addrOrds);
    if (fOff < 0 || fOff + 4 > ctx.size) { if (nf) ctx.warn('导出地址表无法映射到文件'); return e; }
    if (fOff + nf * 4 > ctx.size) { nf = Math.floor((ctx.size - fOff) / 4); ctx.warn('导出地址表被截断'); }

    var nameOf = {};
    if (nn && nOff >= 0 && oOff >= 0) {
      if (nOff + nn * 4 > ctx.size) { nn = Math.floor((ctx.size - nOff) / 4); ctx.warn('导出名称表被截断'); }
      if (oOff + nn * 2 > ctx.size) { nn = Math.floor((ctx.size - oOff) / 2); ctx.warn('导出序号表被截断'); }
      for (var j = 0; j < nn; j++) {
        var strOff = ctx.rvaToOffset(r.u32(nOff + j * 4));
        if (strOff >= 0) nameOf[r.u16(oOff + j * 2)] = r.cstr(strOff);
      }
    } else if (nn) {
      ctx.warn('导出名称表无法映射到文件');
    }

    for (var i = 0; i < nf; i++) {
      var frva = r.u32(fOff + i * 4);
      if (frva === 0) continue;
      var fwd = null;
      if (frva >= dir.rva && frva < dir.rva + dir.size) {
        var fo = ctx.rvaToOffset(frva);
        if (fo >= 0) fwd = r.cstr(fo, 260);
      }
      e.entries.push({ ordinal: e.base + i, rva: frva, name: nameOf[i] !== undefined ? nameOf[i] : null, forwarder: fwd });
    }
    return e;
  }

  // ===================== 启发式识别（仅供参考） =====================
  function detect(info) {
    var out = [], seen = {};
    function add(name, level, note) {
      var key = name + '|' + level;
      if (seen[key]) return;
      seen[key] = 1;
      out.push({ name: name, level: level, note: note || '' });
    }

    var secs = info.sections, names = secs.map(function (s) { return s.name.toLowerCase(); });

    // 节名特征
    secs.forEach(function (s) {
      var sign = SECTION_SIGNS[s.name.toLowerCase()];
      if (sign) add(sign, 'info', '依据节名 ' + s.name);
    });

    // 平台 / 编译器
    var mingw = names.indexOf('.crt') >= 0 || names.indexOf('.eh_fram') >= 0 || names.indexOf('.eh_frame') >= 0;
    var delphi = secs.length > 0 && secs[0].name === 'CODE' && names.indexOf('data') >= 0;
    if (info.isDotNet) add('.NET 托管程序', 'info', '存在 CLR 运行时头（数据目录第 15 项）');
    if (mingw) add('GCC / MinGW', 'info', '依据节名 .CRT / .eh_frame');
    if (delphi) add('Borland Delphi / C++ Builder', 'info', '依据节名 CODE / DATA');
    if (!info.isDotNet && !mingw && !delphi && info.linkerLabel) {
      add('Microsoft 链接器 ' + info.linker + '（' + info.linkerLabel + '）', 'info', '由链接器版本号推断，仅供参考');
    }

    // 启发式提示
    var ep = info.ep;
    if (ep.rva) {
      if (ep.sectionIndex < 0) {
        add('入口点不在任何节内', 'warn', 'EP RVA 0x' + hex(ep.rva, 8) + ' 未落在任何节中，常见于异常或加壳文件');
      } else {
        var es = secs[ep.sectionIndex];
        if (ep.sectionIndex === secs.length - 1 && secs.length > 1) {
          add('入口点位于最后一个节', 'warn', '节 ' + es.name + '：壳或感染型病毒常见，但部分正常程序也如此');
        }
        if (!es.executable) add('入口点所在节不可执行', 'warn', '节 ' + es.name + ' 缺少执行权限');
        if (es.entropy !== null && es.entropy > 7.0) {
          add('入口点所在节熵值很高', 'warn', '节 ' + es.name + ' 熵 ' + es.entropy.toFixed(2) + '，可能已压缩或加密');
        }
      }
    } else if (!info.isDll) {
      add('没有入口点', 'warn', 'AddressOfEntryPoint 为 0');
    }

    secs.forEach(function (s) {
      if (s.perm === 'RWX') add('存在可读写可执行 (RWX) 节', 'warn', '节 ' + s.name + '：壳和自修改代码常见');
      if (s.sizeOfRawData === 0 && s.virtualSize >= 0x10000 && (s.writable || s.executable)) {
        add('存在原始大小为 0 的大节', 'warn', '节 ' + s.name + '：运行时才填充，常见于压缩壳的解压目标');
      }
    });

    var hi = secs.filter(function (s) { return s.entropy !== null && s.entropy > 7.2 && s.sizeOfRawData >= 0x400; });
    if (hi.length) {
      add('存在高熵节', 'warn', hi.map(function (s) { return s.name + ' (' + s.entropy.toFixed(2) + ')'; }).join('、') + '：可能已压缩 / 加密（资源中的压缩数据也会如此）');
    }

    var names2 = {};
    info.imports.forEach(function (m) { m.funcs.forEach(function (f) { if (f.name) names2[f.name] = 1; }); });
    if (info.importFuncCount > 0 && info.importFuncCount <= 10 && names2.GetProcAddress && (names2.LoadLibraryA || names2.LoadLibraryW || names2.LoadLibraryExA || names2.LoadLibraryExW)) {
      add('导入表极简', 'warn', '仅 ' + info.importFuncCount + ' 个导入函数且含 LoadLibrary / GetProcAddress，常见于加壳程序');
    }

    if (info.overlay) {
      var extra = info.overlay.size - info.overlay.signedBytes;
      if (extra > 0) add('存在附加数据 (Overlay)', 'info', '偏移 0x' + hex(info.overlay.offset, 8) + '，共 ' + extra + ' 字节（安装包、自解压等常见）');
    }
    if (info.cert) add('含数字签名数据', 'info', '安全证书目录 ' + info.cert.size + ' 字节（此处不校验签名有效性）');
    if (info.coff.timeDateStamp === 0) add('编译时间戳为 0', 'info', '部分编译器 / 可重现构建会清零时间戳');

    return out;
  }

  var api = { parse: parse, hex: hex, entropy: entropy, flagList: flagList };
  root.PECore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
