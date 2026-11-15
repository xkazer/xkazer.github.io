(function () {
  'use strict';

  var COLS = 10;
  var ROWS = 20;
  var MIN_DELAY = 80;
  var LINE_SCORE = [0, 100, 300, 500, 800];

  // 方块矩阵（顺时针旋转）
  var SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };
  var NAMES = Object.keys(SHAPES);
  var COLORS = {
    I: '#2fb6e8', O: '#f5c343', T: '#9b6df0', S: '#3ec47c',
    Z: '#ef5b5b', J: '#2f7cf0', L: '#f29a3a'
  };

  function $(id) { return document.getElementById(id); }

  var canvas = $('canvas');
  var ctx = canvas.getContext('2d');
  var nextCanvas = $('next');
  var nctx = nextCanvas.getContext('2d');
  var stageEl = $('stage');
  var overlayEl = $('overlay');
  var btnPause = $('btnPause');

  var board, cur, nextName, bag, score, lines, level, best, timer;
  var state = 'ready'; // ready | playing | paused | over
  var cell = 20;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* 隐私模式忽略 */ }
  }

  // ===== 方块 =====
  function rotate(m) {
    var n = m.length;
    var out = [];
    for (var r = 0; r < n; r++) {
      out.push([]);
      for (var c = 0; c < n; c++) out[r].push(m[n - 1 - c][r]);
    }
    return out;
  }

  function nextFromBag() {
    if (!bag.length) {
      bag = NAMES.slice();
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
      }
    }
    return bag.pop();
  }

  function firstRow(m) {
    for (var r = 0; r < m.length; r++) {
      if (m[r].some(function (v) { return v; })) return r;
    }
    return 0;
  }

  function makePiece(name) {
    var m = SHAPES[name].map(function (row) { return row.slice(); });
    return { name: name, m: m, x: Math.floor((COLS - m.length) / 2), y: -firstRow(m) };
  }

  function collides(m, x, y) {
    for (var r = 0; r < m.length; r++) {
      for (var c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        var bx = x + c;
        var by = y + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
    }
    return false;
  }

  // ===== 绘制 =====
  function drawBlock(g, x, y, size, color, alpha) {
    var pad = size * 0.06;
    g.globalAlpha = alpha || 1;
    g.fillStyle = color;
    g.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.fillRect(x + pad, y + pad, size - pad * 2, size * 0.18);
    g.fillStyle = 'rgba(13,58,158,.18)';
    g.fillRect(x + pad, y + size - pad - size * 0.14, size - pad * 2, size * 0.14);
    g.globalAlpha = 1;
  }

  function ghostY() {
    var y = cur.y;
    while (!collides(cur.m, cur.x, y + 1)) y++;
    return y;
  }

  function draw() {
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 网格底纹
    ctx.strokeStyle = 'rgba(47,124,240,.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var c = 1; c < COLS; c++) { ctx.moveTo(c * cell, 0); ctx.lineTo(c * cell, h); }
    for (var r = 1; r < ROWS; r++) { ctx.moveTo(0, r * cell); ctx.lineTo(w, r * cell); }
    ctx.stroke();

    if (!board) return;
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (board[y][x]) drawBlock(ctx, x * cell, y * cell, cell, COLORS[board[y][x]]);
      }
    }

    if (cur && state !== 'ready') {
      var gy = ghostY();
      var m = cur.m;
      for (var i = 0; i < m.length; i++) {
        for (var j = 0; j < m[i].length; j++) {
          if (!m[i][j]) continue;
          if (gy !== cur.y && gy + i >= 0) {
            drawBlock(ctx, (cur.x + j) * cell, (gy + i) * cell, cell, COLORS[cur.name], 0.22);
          }
        }
      }
      for (var i2 = 0; i2 < m.length; i2++) {
        for (var j2 = 0; j2 < m[i2].length; j2++) {
          if (m[i2][j2] && cur.y + i2 >= 0) {
            drawBlock(ctx, (cur.x + j2) * cell, (cur.y + i2) * cell, cell, COLORS[cur.name]);
          }
        }
      }
    }
  }

  function drawNext() {
    var w = nextCanvas.width;
    var h = nextCanvas.height;
    nctx.clearRect(0, 0, w, h);
    if (!nextName) return;
    var m = SHAPES[nextName];
    var rows = [];
    m.forEach(function (row, r) { if (row.some(function (v) { return v; })) rows.push(r); });
    var minC = m.length, maxC = 0;
    m.forEach(function (row) {
      row.forEach(function (v, c) { if (v) { minC = Math.min(minC, c); maxC = Math.max(maxC, c); } });
    });
    var cols = maxC - minC + 1;
    var count = rows.length;
    var size = Math.min(w / 4, h / 2);
    var ox = (w - cols * size) / 2;
    var oy = (h - count * size) / 2;
    rows.forEach(function (r, ri) {
      for (var c = minC; c <= maxC; c++) {
        if (m[r][c]) drawBlock(nctx, ox + (c - minC) * size, oy + ri * size, size, COLORS[nextName]);
      }
    });
  }

  function resize() {
    var ratio = window.devicePixelRatio || 1;
    var w = canvas.clientWidth;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(w * 2 * ratio);
    cell = canvas.width / COLS;
    nextCanvas.width = Math.round(nextCanvas.clientWidth * ratio);
    nextCanvas.height = Math.round(nextCanvas.clientHeight * ratio);
    draw();
    drawNext();
  }

  // ===== 游戏逻辑 =====
  function emptyBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) {
      b.push([]);
      for (var c = 0; c < COLS; c++) b[r].push(0);
    }
    return b;
  }

  function getDelay() {
    return Math.max(MIN_DELAY, 800 - (level - 1) * 70);
  }

  function updateStats() {
    level = Math.floor(lines / 10) + 1;
    $('score').textContent = score;
    $('lines').textContent = lines;
    if (score > best) {
      best = score;
      storageSet('tetris.best', String(best));
    }
    $('best').textContent = best;
  }

  function spawn() {
    cur = makePiece(nextName);
    nextName = nextFromBag();
    drawNext();
    if (collides(cur.m, cur.x, cur.y)) {
      draw();
      gameOver();
      return false;
    }
    return true;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(gravity, getDelay());
  }

  function gravity() {
    if (state !== 'playing') return;
    if (!collides(cur.m, cur.x, cur.y + 1)) {
      cur.y++;
      draw();
    } else {
      lock();
      if (state !== 'playing') return;
    }
    schedule();
  }

  function lock() {
    var m = cur.m;
    var topOut = false;
    for (var r = 0; r < m.length; r++) {
      for (var c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        var by = cur.y + r;
        if (by < 0) { topOut = true; continue; }
        board[by][cur.x + c] = cur.name;
      }
    }
    if (topOut) { draw(); gameOver(); return; }

    var cleared = 0;
    for (var y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(function (v) { return v; })) {
        board.splice(y, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        y++;
      }
    }
    if (cleared) {
      score += LINE_SCORE[cleared] * level;
      lines += cleared;
    }
    updateStats();
    if (spawn()) draw();
  }

  // ===== 操作 =====
  function canAct() { return state === 'playing'; }

  function moveX(dx) {
    if (!canAct()) return;
    if (!collides(cur.m, cur.x + dx, cur.y)) {
      cur.x += dx;
      draw();
    }
  }

  function softDrop() {
    if (!canAct()) return;
    if (!collides(cur.m, cur.x, cur.y + 1)) {
      cur.y++;
      score += 1;
      updateStats();
      draw();
      schedule();
    }
  }

  function hardDrop() {
    if (!canAct()) return;
    var gy = ghostY();
    score += (gy - cur.y) * 2;
    cur.y = gy;
    lock();
    if (state === 'playing') { draw(); schedule(); }
  }

  function doRotate() {
    if (!canAct()) return;
    var m = rotate(cur.m);
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (!collides(m, cur.x + kicks[i], cur.y)) {
        cur.m = m;
        cur.x += kicks[i];
        draw();
        return;
      }
    }
    // 贴顶时尝试上移一格（例如竖直 I 型旋转）
    if (!collides(m, cur.x, cur.y - 1)) {
      cur.m = m;
      cur.y--;
      draw();
    }
  }

  // ===== 状态切换 =====
  function showOverlay(title, desc, startText) {
    $('overTitle').textContent = title;
    $('overDesc').textContent = desc;
    $('btnStart').textContent = startText;
    overlayEl.hidden = false;
  }

  function start() {
    clearTimeout(timer);
    board = emptyBoard();
    bag = [];
    score = 0;
    lines = 0;
    level = 1;
    nextName = nextFromBag();
    updateStats();
    state = 'playing';
    overlayEl.hidden = true;
    btnPause.textContent = '暂停';
    if (spawn()) {
      draw();
      schedule();
    }
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    clearTimeout(timer);
    btnPause.textContent = '继续';
    showOverlay('已暂停', '点击继续或按 P 键', '继续游戏');
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    overlayEl.hidden = true;
    btnPause.textContent = '暂停';
    schedule();
  }

  function gameOver() {
    state = 'over';
    clearTimeout(timer);
    btnPause.textContent = '暂停';
    showOverlay('游戏结束', '得分 ' + score + '，消除 ' + lines + ' 行', '再来一局');
  }

  function togglePause() {
    if (state === 'playing') pause();
    else if (state === 'paused') resume();
  }

  // ===== 输入 =====
  var ACTIONS = {
    left: function () { moveX(-1); },
    right: function () { moveX(1); },
    down: softDrop,
    rotate: doRotate,
    drop: hardDrop
  };
  var REPEATABLE = { left: true, right: true, down: true };

  var KEYS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'rotate',
    a: 'left', d: 'right', s: 'drop', w: 'rotate',
    A: 'left', D: 'right', S: 'drop', W: 'rotate',
    ' ': 'drop'
  };

  function initKeyboard() {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        if (!e.repeat) togglePause();
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(KEYS, e.key)) return;
      e.preventDefault();
      var act = KEYS[e.key];
      if (state === 'ready' || state === 'over') {
        if (act === 'drop' && !e.repeat) start();
        return;
      }
      if (state === 'paused') {
        if (act === 'drop' && !e.repeat) resume();
        return;
      }
      // 旋转与落底不响应长按
      if (e.repeat && !REPEATABLE[act]) return;
      ACTIONS[act]();
    });
  }

  function initButtons() {
    var repeatTimer = 0;
    var repeatInterval = 0;

    function stopRepeat() {
      clearTimeout(repeatTimer);
      clearInterval(repeatInterval);
    }

    $('ctrl').addEventListener('pointerdown', function (e) {
      var btn = e.target.closest('.tp');
      if (!btn) return;
      e.preventDefault();
      var act = btn.getAttribute('data-act');
      ACTIONS[act]();
      stopRepeat();
      if (REPEATABLE[act]) {
        repeatTimer = setTimeout(function () {
          repeatInterval = setInterval(ACTIONS[act], 70);
        }, 180);
      }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (name) {
      $('ctrl').addEventListener(name, stopRepeat);
    });
    window.addEventListener('blur', stopRepeat);
  }

  function initGesture() {
    var tracking = false;
    var downX = 0, downY = 0, downTime = 0;
    var lastX = 0, lastY = 0;
    var dragged = false;

    stageEl.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      tracking = true;
      dragged = false;
      downX = lastX = e.clientX;
      downY = lastY = e.clientY;
      downTime = Date.now();
    });

    stageEl.addEventListener('pointermove', function (e) {
      if (!tracking) return;
      var step = canvas.clientWidth / COLS;
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      while (dx >= step) { moveX(1); lastX += step; dx -= step; dragged = true; }
      while (dx <= -step) { moveX(-1); lastX -= step; dx += step; dragged = true; }
      while (dy >= step) { softDrop(); lastY += step; dy -= step; dragged = true; }
    });

    stageEl.addEventListener('pointerup', function (e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.clientX - downX;
      var dy = e.clientY - downY;
      var dt = Date.now() - downTime;
      var dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (dist < 10 && dt < 300) { doRotate(); return; }
      if (dt < 300 && dy > 80 && Math.abs(dx) < dy * 0.5) hardDrop();
    });
    stageEl.addEventListener('pointercancel', function () { tracking = false; });
  }

  function init() {
    initKeyboard();
    initButtons();
    initGesture();

    $('btnStart').addEventListener('click', function () {
      if (state === 'paused') resume();
      else start();
    });
    btnPause.addEventListener('click', togglePause);
    $('btnRestart').addEventListener('click', start);

    // 切到后台自动暂停
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause();
    });
    window.addEventListener('resize', resize);
  }

  // ===== 启动 =====
  best = parseInt(storageGet('tetris.best'), 10) || 0;
  $('best').textContent = best;
  board = emptyBoard();
  bag = [];
  level = 1;
  init();
  resize();
})();
