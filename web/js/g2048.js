(function () {
  'use strict';

  var SIZE = 4;
  var WIN = 2048;
  var GAP = 3;                         // 间距占棋盘宽度的百分比
  var CELL = (100 - GAP * (SIZE + 1)) / SIZE;
  var SLIDE_MS = 110;
  var SWIPE_MIN = 24;

  function $(id) { return document.getElementById(id); }

  var boardEl = $('board');
  var stageEl = $('stage');
  var overlayEl = $('overlay');

  var grid, score, best, won, over, paused;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* 隐私模式忽略 */ }
  }

  // ===== 棋盘与方块 =====
  function emptyGrid() {
    var g = [];
    for (var r = 0; r < SIZE; r++) {
      g.push([]);
      for (var c = 0; c < SIZE; c++) g[r].push(null);
    }
    return g;
  }

  function posOf(i) { return (GAP + i * (CELL + GAP)) + '%'; }

  function buildBackground() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cell = document.createElement('div');
        cell.className = 'g2048-cell';
        cell.style.left = posOf(c);
        cell.style.top = posOf(r);
        boardEl.appendChild(cell);
      }
    }
  }

  function applyValue(tile) {
    var inner = tile.inner;
    var v = tile.v;
    var len = String(v).length;
    inner.textContent = v;
    inner.className = 'g2048-inner ' +
      (v <= 2048 ? 'v' + v : 'vsuper') +
      (len >= 3 ? ' len' + len : '');
  }

  function placeTile(tile) {
    tile.el.style.left = posOf(tile.c);
    tile.el.style.top = posOf(tile.r);
  }

  function createTile(v, r, c) {
    var el = document.createElement('div');
    el.className = 'g2048-tile';
    var inner = document.createElement('div');
    el.appendChild(inner);
    var tile = { v: v, r: r, c: c, el: el, inner: inner, merged: false, into: null };
    applyValue(tile);
    inner.classList.add('appear');
    placeTile(tile);
    boardEl.appendChild(el);
    grid[r][c] = tile;
    return tile;
  }

  function spawn() {
    var empties = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (!grid[r][c]) empties.push([r, c]);
      }
    }
    if (!empties.length) return;
    var p = empties[Math.floor(Math.random() * empties.length)];
    createTile(Math.random() < 0.9 ? 2 : 4, p[0], p[1]);
  }

  // 按方向取第 i 行（列）的第 k 个格子，k = 0 为朝向边缘的一端
  // 方向：0 上，1 右，2 下，3 左
  function coord(dir, i, k) {
    switch (dir) {
      case 0: return [k, i];
      case 1: return [i, SIZE - 1 - k];
      case 2: return [SIZE - 1 - k, i];
      default: return [i, k];
    }
  }

  // ===== 移动 =====
  function move(dir) {
    if (over || paused) return;

    var next = emptyGrid();
    var moved = false;
    var gained = 0;
    var mergedTiles = [];
    var reached = false;

    for (var i = 0; i < SIZE; i++) {
      var out = [];
      for (var k = 0; k < SIZE; k++) {
        var p = coord(dir, i, k);
        var t = grid[p[0]][p[1]];
        if (!t) continue;
        var last = out[out.length - 1];
        if (last && !last.merged && last.v === t.v) {
          var lp = coord(dir, i, out.length - 1);
          last.v *= 2;
          last.merged = true;
          gained += last.v;
          if (last.v === WIN) reached = true;
          t.r = lp[0];
          t.c = lp[1];
          t.into = last;
          mergedTiles.push(t);
          moved = true;
        } else {
          out.push(t);
        }
      }
      for (var j = 0; j < out.length; j++) {
        var q = coord(dir, i, j);
        var tile = out[j];
        if (tile.r !== q[0] || tile.c !== q[1]) moved = true;
        tile.r = q[0];
        tile.c = q[1];
        next[q[0]][q[1]] = tile;
      }
    }

    if (!moved) return;
    grid = next;

    // 滑动动画
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c]) placeTile(grid[r][c]);
      }
    }
    mergedTiles.forEach(function (t) { placeTile(t); });

    // 合并标记仅在本次移动内有效，立即清除，避免连续快速操作时影响下一次合并
    var targets = [];
    mergedTiles.forEach(function (t) {
      t.into.merged = false;
      if (targets.indexOf(t.into) === -1) targets.push(t.into);
    });

    // 滑动结束后：移除被吞掉的方块，目标方块显示新数值
    setTimeout(function () {
      mergedTiles.forEach(function (t) {
        if (t.el.parentNode) t.el.parentNode.removeChild(t.el);
      });
      targets.forEach(function (target) {
        applyValue(target);
        target.inner.classList.add('pop');
      });
    }, SLIDE_MS);

    if (gained) {
      score += gained;
      updateScore();
    }
    spawn();

    if (reached && !won) {
      won = true;
      paused = true;
      showOverlay('达成 2048！', '太棒了，要继续挑战更高的数字吗？', true);
    } else if (!canMove()) {
      over = true;
      showOverlay('游戏结束', '最终得分 ' + score, false);
    }
  }

  function canMove() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var t = grid[r][c];
        if (!t) return true;
        if (c + 1 < SIZE && grid[r][c + 1] && grid[r][c + 1].v === t.v) return true;
        if (r + 1 < SIZE && grid[r + 1][c] && grid[r + 1][c].v === t.v) return true;
      }
    }
    return false;
  }

  // ===== 界面 =====
  function updateScore() {
    $('score').textContent = score;
    if (score > best) {
      best = score;
      storageSet('g2048.best', String(best));
    }
    $('best').textContent = best;
  }

  function showOverlay(title, desc, canContinue) {
    $('overTitle').textContent = title;
    $('overDesc').textContent = desc;
    $('btnContinue').hidden = !canContinue;
    overlayEl.hidden = false;
  }

  function newGame() {
    Array.prototype.slice.call(boardEl.querySelectorAll('.g2048-tile')).forEach(function (el) {
      boardEl.removeChild(el);
    });
    grid = emptyGrid();
    score = 0;
    won = false;
    over = false;
    paused = false;
    overlayEl.hidden = true;
    updateScore();
    spawn();
    spawn();
  }

  function resize() {
    boardEl.style.setProperty('--fs', (boardEl.clientWidth * 0.1) + 'px');
  }

  // ===== 输入 =====
  var KEYS = {
    ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3,
    w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3
  };

  function initInput() {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!Object.prototype.hasOwnProperty.call(KEYS, e.key)) return;
      e.preventDefault();
      move(KEYS[e.key]);
    });

    var startX = 0, startY = 0, tracking = false;

    stageEl.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
    });
    stageEl.addEventListener('pointerup', function (e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : 3);
      else move(dy > 0 ? 2 : 0);
    });
    stageEl.addEventListener('pointercancel', function () { tracking = false; });

    $('btnNew').addEventListener('click', newGame);
    $('btnAgain').addEventListener('click', newGame);
    $('btnContinue').addEventListener('click', function () {
      paused = false;
      overlayEl.hidden = true;
    });

    window.addEventListener('resize', resize);
  }

  // ===== 启动 =====
  best = parseInt(storageGet('g2048.best'), 10) || 0;
  buildBackground();
  resize();
  initInput();
  newGame();
})();
