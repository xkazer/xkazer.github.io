/**
 * 十六进制编辑器核心：文档（含撤销/重做、修改标记）、查找模式、查找与替换。
 * 不依赖 DOM，浏览器与 Node 均可使用。
 */
(function (root) {
  'use strict';

  var MAX_UNDO = 1000;     // 撤销栈最大条数
  var MAX_SNAPSHOTS = 2;   // 撤销栈中最多保留的整体快照数（全部替换产生，占内存）

  var HEX = [];
  for (var hi = 0; hi < 256; hi++) HEX.push((hi < 16 ? '0' : '') + hi.toString(16).toUpperCase());

  function toU8(a) {
    return a instanceof Uint8Array ? a : Uint8Array.from(a);
  }

  function toHex(bytes, sep) {
    var out = new Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) out[i] = HEX[bytes[i]];
    return out.join(sep === undefined ? ' ' : sep);
  }

  // ===================== 文档 =====================
  function Doc() {
    this.load(new Uint8Array(0));
  }

  Doc.prototype.load = function (u8) {
    this.data = u8;
    this.mod = null;          // 与 data 等长的"已修改"标记，首次编辑时才分配
    this.undoStack = [];
    this.redoStack = [];
    this.cleanLen = 0;        // 保存点对应的撤销栈长度，-1 表示保存点已不可达
    this.groupSeq = 0;
  };

  Doc.prototype.size = function () { return this.data.length; };
  Doc.prototype.isModified = function (i) { return this.mod !== null && this.mod[i] === 1; };
  Doc.prototype.isDirty = function () { return this.cleanLen !== this.undoStack.length; };
  Doc.prototype.markClean = function () { this.cleanLen = this.undoStack.length; };
  Doc.prototype.canUndo = function () { return this.undoStack.length > 0; };
  Doc.prototype.canRedo = function () { return this.redoStack.length > 0; };
  Doc.prototype.newGroup = function () { return ++this.groupSeq; };

  // 用 ins 替换 [offset, offset+delLen)，返回可还原该操作的逆操作
  Doc.prototype._apply = function (offset, delLen, ins, insMod) {
    var data = this.data, n = data.length;
    if (offset < 0 || delLen < 0 || offset + delLen > n) throw new RangeError('范围越界');
    ins = toU8(ins);
    if (!this.mod) this.mod = new Uint8Array(n);
    var mod = this.mod, insLen = ins.length;
    var removed = data.slice(offset, offset + delLen);
    var removedMod = mod.slice(offset, offset + delLen);

    if (insLen === delLen) {
      data.set(ins, offset);
      if (insMod) mod.set(insMod, offset); else mod.fill(1, offset, offset + insLen);
    } else {
      var nd = new Uint8Array(n - delLen + insLen);
      var nm = new Uint8Array(nd.length);
      nd.set(data.subarray(0, offset), 0);
      nd.set(ins, offset);
      nd.set(data.subarray(offset + delLen), offset + insLen);
      nm.set(mod.subarray(0, offset), 0);
      if (insMod) nm.set(insMod, offset); else nm.fill(1, offset, offset + insLen);
      nm.set(mod.subarray(offset + delLen), offset + insLen);
      this.data = nd;
      this.mod = nm;
    }
    return { offset: offset, delLen: insLen, ins: removed, insMod: removedMod };
  };

  Doc.prototype._push = function (entry) {
    if (this.cleanLen > this.undoStack.length) this.cleanLen = -1;
    this.redoStack.length = 0;
    this.undoStack.push(entry);

    var st = this.undoStack, drop = 0;
    if (st.length > MAX_UNDO) drop = st.length - MAX_UNDO;
    if (entry.snap) {
      var idx = [];
      for (var i = 0; i < st.length; i++) if (st[i].snap) idx.push(i);
      if (idx.length > MAX_SNAPSHOTS) drop = Math.max(drop, idx[idx.length - MAX_SNAPSHOTS - 1] + 1);
    }
    if (drop) {
      st.splice(0, drop);
      if (this.cleanLen >= 0) this.cleanLen = Math.max(-1, this.cleanLen - drop);
    }
  };

  /** 编辑：用 ins 替换 [offset, offset+delLen)。group 相同的连续编辑会被一次撤销。 */
  Doc.prototype.edit = function (offset, delLen, ins, group) {
    var inv = this._apply(offset, delLen, ins, null);
    inv.group = group || 0;
    this._push(inv);
  };

  Doc.prototype._applyEntry = function (e) {
    if (e.snap) {
      var rev = { snap: true, data: this.data, mod: this.mod, group: e.group };
      this.data = e.data;
      this.mod = e.mod;
      return rev;
    }
    var inv = this._apply(e.offset, e.delLen, e.ins, e.insMod);
    inv.group = e.group;
    return inv;
  };

  Doc.prototype._step = function (from, to) {
    if (!from.length) return null;
    var e = from.pop();
    var pos = e.snap ? null : e.offset;
    to.push(this._applyEntry(e));
    while (e.group && from.length && from[from.length - 1].group === e.group) {
      e = from.pop();
      if (!e.snap) pos = e.offset;
      to.push(this._applyEntry(e));
    }
    return { pos: pos };
  };

  Doc.prototype.undo = function () { return this._step(this.undoStack, this.redoStack); };
  Doc.prototype.redo = function () { return this._step(this.redoStack, this.undoStack); };

  /** 全部替换：一次遍历重建缓冲区，旧缓冲区作为快照入撤销栈。返回替换处数。 */
  Doc.prototype.replaceAll = function (pat, rep) {
    var pos = findAll(this.data, pat, Infinity, false);
    if (!pos.length) return 0;
    rep = toU8(rep);
    var data = this.data, oldMod = this.mod;
    var nd = new Uint8Array(data.length + (rep.length - pat.len) * pos.length);
    var nm = new Uint8Array(nd.length);
    var r = 0, w = 0, i, p;

    for (i = 0; i < pos.length; i++) {
      p = pos[i];
      nd.set(data.subarray(r, p), w);
      if (oldMod) nm.set(oldMod.subarray(r, p), w);
      w += p - r;
      nd.set(rep, w);
      nm.fill(1, w, w + rep.length);
      w += rep.length;
      r = p + pat.len;
    }
    nd.set(data.subarray(r), w);
    if (oldMod) nm.set(oldMod.subarray(r), w);

    this._push({ snap: true, data: data, mod: oldMod, group: 0 });
    this.data = nd;
    this.mod = nm;
    return pos.length;
  };

  // ===================== 查找模式 =====================
  function makePattern(b, alt, wild) {
    return { len: b.length, b: b, alt: alt, wild: wild };
  }

  /**
   * 解析十六进制串："49 4E 44"、"0x49,0x4E"、"494E44"；allowWild 时 ?? 表示任意字节。
   */
  function parseHex(str, allowWild) {
    var s = String(str).replace(/0x/gi, '').replace(/[\s,]+/g, '');
    if (!s) throw new Error('请输入十六进制内容');
    if (s.length % 2) throw new Error('十六进制长度必须为偶数（每字节 2 位）');
    var len = s.length / 2, b = new Uint8Array(len), wild = null;
    for (var i = 0; i < len; i++) {
      var pair = s.substr(i * 2, 2);
      if (pair === '??') {
        if (!allowWild) throw new Error('此处不支持通配符 ??');
        if (!wild) wild = new Uint8Array(len);
        wild[i] = 1;
      } else if (/^[0-9a-fA-F]{2}$/.test(pair)) {
        b[i] = parseInt(pair, 16);
      } else {
        throw new Error('包含非法的十六进制字符：' + pair);
      }
    }
    return makePattern(b, null, wild);
  }

  /** 文本 → 字节。enc: utf8 / utf16le / latin1 / auto（全部 ≤ 0xFF 用 latin1，否则 utf8） */
  function textBytes(str, enc) {
    var i, out;
    if (enc === 'auto') {
      enc = 'latin1';
      for (i = 0; i < str.length; i++) if (str.charCodeAt(i) > 255) { enc = 'utf8'; break; }
    }
    if (enc === 'utf16le') {
      out = new Uint8Array(str.length * 2);
      for (i = 0; i < str.length; i++) {
        var u = str.charCodeAt(i);
        out[i * 2] = u & 255;
        out[i * 2 + 1] = u >> 8;
      }
      return out;
    }
    if (enc === 'latin1') {
      out = new Uint8Array(str.length);
      for (i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c > 255) throw new Error('字符 “' + str.charAt(i) + '” 超出 ANSI 范围，请改用 UTF-8 或 UTF-16');
        out[i] = c;
      }
      return out;
    }
    return new TextEncoder().encode(str);
  }

  function isLetter(v) { return (v >= 65 && v <= 90) || (v >= 97 && v <= 122); }

  /** 文本查找模式；ignoreCase 仅对 ASCII 字母生效 */
  function textPattern(str, enc, ignoreCase) {
    if (!str) throw new Error('请输入要查找的内容');
    var b = textBytes(str, enc), alt = null;
    if (ignoreCase) {
      for (var i = 0; i < b.length; i++) {
        var letter = isLetter(b[i]) && (enc !== 'utf16le' || (i % 2 === 0 && b[i + 1] === 0));
        if (letter) {
          if (!alt) alt = new Int16Array(b.length).fill(-1);
          alt[i] = b[i] ^ 0x20;
        }
      }
    }
    return makePattern(b, alt, null);
  }

  // ===================== 查找 =====================
  function matchAt(data, pat, i) {
    var b = pat.b, alt = pat.alt, wild = pat.wild;
    if (i < 0 || i + pat.len > data.length) return false;
    for (var j = 0; j < pat.len; j++) {
      if (wild && wild[j]) continue;
      var v = data[i + j];
      if (v === b[j]) continue;
      if (alt && alt[j] === v) continue;
      return false;
    }
    return true;
  }

  /** 在起点范围 [lo, hi] 内查找：forward 取最小起点，否则取最大起点；未找到返回 -1 */
  function findRange(data, pat, lo, hi, forward) {
    var m = pat.len, n = data.length;
    if (m === 0 || m > n) return -1;
    hi = Math.min(hi, n - m);
    lo = Math.max(lo, 0);
    if (lo > hi) return -1;
    var b0 = pat.b[0];
    var fast = !(pat.wild && pat.wild[0]) && !(pat.alt && pat.alt[0] >= 0);
    var i;
    if (forward) {
      for (i = lo; i <= hi; i++) {
        if (fast) {
          i = data.indexOf(b0, i);
          if (i < 0 || i > hi) return -1;
        }
        if (matchAt(data, pat, i)) return i;
      }
    } else {
      for (i = hi; i >= lo; i--) {
        if (fast) {
          i = data.lastIndexOf(b0, i);
          if (i < lo) return -1;
        }
        if (matchAt(data, pat, i)) return i;
      }
    }
    return -1;
  }

  /** 从 from 起向前/向后查找，wrap 为 true 时到头后循环 */
  function findNext(data, pat, from, forward, wrap) {
    var n = data.length, m = pat.len, p;
    if (forward) {
      if (from < 0) from = 0;
      p = findRange(data, pat, from, n - m, true);
      if (p < 0 && wrap && from > 0) {
        p = findRange(data, pat, 0, from - 1, true);
        return { pos: p, wrapped: p >= 0 };
      }
      return { pos: p, wrapped: false };
    }
    if (from > n - m) from = n - m;
    p = findRange(data, pat, 0, from, false);
    if (p < 0 && wrap) {
      p = findRange(data, pat, from + 1, n - m, false);
      return { pos: p, wrapped: p >= 0 };
    }
    return { pos: p, wrapped: false };
  }

  function findAll(data, pat, max, overlap) {
    var out = [], m = pat.len, n = data.length, i = 0;
    while (out.length < max) {
      var p = findRange(data, pat, i, n - m, true);
      if (p < 0) break;
      out.push(p);
      i = p + (overlap ? 1 : m);
    }
    return out;
  }

  var api = {
    Doc: Doc, HEX: HEX, toHex: toHex,
    parseHex: parseHex, textBytes: textBytes, textPattern: textPattern,
    matchAt: matchAt, findNext: findNext, findAll: findAll
  };
  root.HexCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
