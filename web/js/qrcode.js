/**
 * 轻量二维码编码器（仅字节模式，UTF-8，版本 1-40，纠错 L/M/Q/H）
 * 用法：var qr = QRCode.encode('文本', 'M'); qr.size; qr.get(x, y)
 */
(function (global) {
  'use strict';

  var ECL_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
  var ECL_FORMAT_BITS = [1, 0, 3, 2];

  var ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];
  var NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];

  function getNumRawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  function getNumDataCodewords(ver, ecl) {
    return Math.floor(getNumRawDataModules(ver) / 8) -
      ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
  }

  function appendBits(bb, val, len) {
    for (var i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
  }

  function getBit(x, i) {
    return ((x >>> i) & 1) !== 0;
  }

  // ===== Reed-Solomon (GF(256), 多项式 0x11D) =====
  function rsMultiply(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsComputeDivisor(degree) {
    var result = [];
    for (var i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (i = 0; i < degree; i++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = rsMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = rsMultiply(root, 0x02);
    }
    return result;
  }

  function rsComputeRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) {
        result[i] ^= rsMultiply(coef, factor);
      });
    });
    return result;
  }

  function addEccAndInterleave(data, ver, ecl) {
    var numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
    var blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][ver];
    var rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
    var numShortBlocks = numBlocks - rawCodewords % numBlocks;
    var shortBlockLen = Math.floor(rawCodewords / numBlocks);

    var blocks = [];
    var divisor = rsComputeDivisor(blockEccLen);
    for (var i = 0, k = 0; i < numBlocks; i++) {
      var datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
      var dat = data.slice(k, k + datLen);
      k += datLen;
      var ecc = rsComputeRemainder(dat, divisor);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }

    var result = [];
    for (i = 0; i < blocks[0].length; i++) {
      for (var j = 0; j < blocks.length; j++) {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
          result.push(blocks[j][i]);
        }
      }
    }
    return result;
  }

  // ===== 矩阵构建 =====
  function buildMatrix(ver, ecl, dataCodewords) {
    var size = ver * 4 + 17;
    var modules = [];
    var isFunction = [];
    for (var y = 0; y < size; y++) {
      modules.push(new Array(size).fill(0));
      isFunction.push(new Array(size).fill(false));
    }

    function setFunc(x, y, dark) {
      modules[y][x] = dark ? 1 : 0;
      isFunction[y][x] = true;
    }

    function drawFinder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy));
          var xx = cx + dx, yy = cy + dy;
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) {
            setFunc(xx, yy, dist !== 2 && dist !== 4);
          }
        }
      }
    }

    function drawAlignment(cx, cy) {
      for (var dy = -2; dy <= 2; dy++) {
        for (var dx = -2; dx <= 2; dx++) {
          setFunc(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }

    function getAlignmentPositions() {
      if (ver === 1) return [];
      var numAlign = Math.floor(ver / 7) + 2;
      var step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
      var result = [6];
      for (var pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
      return result;
    }

    function drawFormatBits(mask) {
      var data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
      var rem = data;
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412;

      for (i = 0; i <= 5; i++) setFunc(8, i, getBit(bits, i));
      setFunc(8, 7, getBit(bits, 6));
      setFunc(8, 8, getBit(bits, 7));
      setFunc(7, 8, getBit(bits, 8));
      for (i = 9; i < 15; i++) setFunc(14 - i, 8, getBit(bits, i));

      for (i = 0; i < 8; i++) setFunc(size - 1 - i, 8, getBit(bits, i));
      for (i = 8; i < 15; i++) setFunc(8, size - 15 + i, getBit(bits, i));
      setFunc(8, size - 8, true);
    }

    function drawVersion() {
      if (ver < 7) return;
      var rem = ver;
      for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var bits = (ver << 12) | rem;
      for (i = 0; i < 18; i++) {
        var color = getBit(bits, i);
        var a = size - 11 + i % 3;
        var b = Math.floor(i / 3);
        setFunc(a, b, color);
        setFunc(b, a, color);
      }
    }

    function drawFunctionPatterns() {
      for (var i = 0; i < size; i++) {
        setFunc(6, i, i % 2 === 0);
        setFunc(i, 6, i % 2 === 0);
      }
      drawFinder(3, 3);
      drawFinder(size - 4, 3);
      drawFinder(3, size - 4);

      var pos = getAlignmentPositions();
      var n = pos.length;
      for (i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
          if (!((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))) {
            drawAlignment(pos[i], pos[j]);
          }
        }
      }
      drawFormatBits(0);
      drawVersion();
    }

    function drawCodewords(data) {
      var i = 0;
      for (var right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (var vert = 0; vert < size; vert++) {
          for (var j = 0; j < 2; j++) {
            var x = right - j;
            var upward = ((right + 1) & 2) === 0;
            var y = upward ? size - 1 - vert : vert;
            if (!isFunction[y][x] && i < data.length * 8) {
              modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7)) ? 1 : 0;
              i++;
            }
          }
        }
      }
    }

    function applyMask(mask) {
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          var invert;
          switch (mask) {
            case 0: invert = (x + y) % 2 === 0; break;
            case 1: invert = y % 2 === 0; break;
            case 2: invert = x % 3 === 0; break;
            case 3: invert = (x + y) % 3 === 0; break;
            case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
            case 5: invert = x * y % 2 + x * y % 3 === 0; break;
            case 6: invert = (x * y % 2 + x * y % 3) % 2 === 0; break;
            default: invert = ((x + y) % 2 + x * y % 3) % 2 === 0; break;
          }
          if (!isFunction[y][x] && invert) modules[y][x] ^= 1;
        }
      }
    }

    function lineScore(line) {
      var s = 0, run = 1, i;
      for (i = 1; i < line.length; i++) {
        if (line[i] === line[i - 1]) {
          run++;
        } else {
          if (run >= 5) s += run - 2;
          run = 1;
        }
      }
      if (run >= 5) s += run - 2;
      var str = line.join('');
      ['10111010000', '00001011101'].forEach(function (p) {
        var idx = str.indexOf(p);
        while (idx !== -1) {
          s += 40;
          idx = str.indexOf(p, idx + 1);
        }
      });
      return s;
    }

    function penaltyScore() {
      var result = 0, x, y, dark = 0;
      for (y = 0; y < size; y++) {
        result += lineScore(modules[y]);
        var col = [];
        for (x = 0; x < size; x++) {
          col.push(modules[x][y]);
          dark += modules[y][x];
        }
        result += lineScore(col);
      }
      for (y = 0; y < size - 1; y++) {
        for (x = 0; x < size - 1; x++) {
          var c = modules[y][x];
          if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += 3;
        }
      }
      var total = size * size;
      var k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      result += Math.max(0, k) * 10;
      return result;
    }

    drawFunctionPatterns();
    drawCodewords(addEccAndInterleave(dataCodewords, ver, ecl));

    var bestMask = 0, minPenalty = Infinity;
    for (var m = 0; m < 8; m++) {
      applyMask(m);
      drawFormatBits(m);
      var p = penaltyScore();
      if (p < minPenalty) {
        minPenalty = p;
        bestMask = m;
      }
      applyMask(m);
    }
    applyMask(bestMask);
    drawFormatBits(bestMask);

    return { size: size, modules: modules };
  }

  /**
   * @param {string} text 任意文本（按 UTF-8 编码）
   * @param {string} eclName 纠错级别 L/M/Q/H
   */
  function encode(text, eclName) {
    var ecl = ECL_INDEX.hasOwnProperty(eclName) ? ECL_INDEX[eclName] : 1;
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(text));

    var ver, ccBits, capBits;
    for (ver = 1; ver <= 40; ver++) {
      ccBits = ver < 10 ? 8 : 16;
      capBits = getNumDataCodewords(ver, ecl) * 8;
      if (4 + ccBits + bytes.length * 8 <= capBits) break;
    }
    if (ver > 40) throw new Error('内容过长，无法生成二维码，请缩短内容或降低纠错级别');

    var bb = [];
    appendBits(bb, 4, 4);
    appendBits(bb, bytes.length, ccBits);
    bytes.forEach(function (b) { appendBits(bb, b, 8); });
    appendBits(bb, 0, Math.min(4, capBits - bb.length));
    appendBits(bb, 0, (8 - bb.length % 8) % 8);
    for (var pad = 0xEC; bb.length < capBits; pad ^= 0xEC ^ 0x11) appendBits(bb, pad, 8);

    var data = [];
    for (var i = 0; i < bb.length; i += 8) {
      var v = 0;
      for (var j = 0; j < 8; j++) v = (v << 1) | bb[i + j];
      data.push(v);
    }

    var matrix = buildMatrix(ver, ecl, data);
    return {
      version: ver,
      size: matrix.size,
      get: function (x, y) {
        return x >= 0 && x < matrix.size && y >= 0 && y < matrix.size && matrix.modules[y][x] === 1;
      }
    };
  }

  // 暴露内部函数仅用于自检
  global.QRCode = { encode: encode, _capacityBytes: function (ver, eclName) {
    var ecl = ECL_INDEX[eclName];
    return Math.floor((getNumDataCodewords(ver, ecl) * 8 - 4 - (ver < 10 ? 8 : 16)) / 8);
  } };
})(typeof window !== 'undefined' ? window : globalThis);
