(function () {
  'use strict';

  var COLS = 20;
  var ROWS = 20;
  var START_DELAY = 150;   // 初始每步间隔（毫秒）
  var MIN_DELAY = 70;      // 最快间隔
  var STEP_DOWN = 4;       // 每吃一个食物缩短的间隔
  var SWIPE_MIN = 20;

  var DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  function $(id) { return document.getElementById(id); }

  var canvas = $('canvas');
  var ctx = canvas.getContext('2d');
  var stageEl = $('stage');
  var overlayEl = $('overlay');
  var btnPause = $('btnPause');

  var snake, dir, queue, food, score, best, delay, timer;
  var state = 'ready'; // ready | playing | paused | over
  var cell = 20;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* 隐私模式忽略 */ }
  }

  // ===== 画布 =====
  function resize() {
    var w = canvas.clientWidth;
    var ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(w * ratio);
    cell = canvas.width / COLS;
    draw();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    var size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    // 棋盘格底纹
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#e8f1fe' : '#f2f7ff';
        ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }
    if (!snake) return;

    // 食物
    if (food) {
      var fx = food.x * cell + cell / 2;
      var fy = food.y * cell + cell / 2;
      ctx.fillStyle = '#ef4b4b';
      ctx.beginPath();
      ctx.arc(fx, fy, cell * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.beginPath();
      ctx.arc(fx - cell * 0.12, fy - cell * 0.12, cell * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 蛇身（颜色由头到尾渐浅）
    var pad = cell * 0.08;
    for (var i = snake.length - 1; i >= 0; i--) {
      var s = snake[i];
      var t = snake.length > 1 ? i / (snake.length - 1) : 0;
      ctx.fillStyle = i === 0 ? '#0d3a9e' : 'rgb(' +
        Math.round(20 + t * 90) + ',' + Math.round(87 + t * 80) + ',' + Math.round(217 + t * 20) + ')';
      roundRect(s.x * cell + pad, s.y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.28);
      ctx.fill();
    }

    // 蛇眼
    var head = snake[0];
    var d = DIRS[dir];
    var cx = head.x * cell + cell / 2;
    var cy = head.y * cell + cell / 2;
    var px = -d.y, py = d.x; // 垂直于前进方向
    ctx.fillStyle = '#fff';
    [-1, 1].forEach(function (side) {
      ctx.beginPath();
      ctx.arc(cx + d.x * cell * 0.18 + px * side * cell * 0.2,
              cy + d.y * cell * 0.18 + py * side * cell * 0.2,
              cell * 0.1, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ===== 游戏逻辑 =====
  function placeFood() {
    var free = [];
    var occupied = {};
    snake.forEach(function (s) { occupied[s.x + ',' + s.y] = true; });
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (!occupied[x + ',' + y]) free.push({ x: x, y: y });
      }
    }
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function reset() {
    var cx = Math.floor(COLS / 2);
    var cy = Math.floor(ROWS / 2);
    snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
    dir = 'right';
    queue = [];
    score = 0;
    delay = START_DELAY;
    placeFood();
    updateScore();
    draw();
  }

  function updateScore() {
    $('score').textContent = score;
    if (score > best) {
      best = score;
      storageSet('snake.best', String(best));
    }
    $('best').textContent = best;
  }

  function turn(name) {
    if (state === 'ready' || state === 'over') return;
    if (state === 'paused') resume();
    // 以队列末尾的方向为基准，避免一步内连按造成反向自撞
    var base = queue.length ? queue[queue.length - 1] : dir;
    if (name === base) return;
    if (DIRS[name].x + DIRS[base].x === 0 && DIRS[name].y + DIRS[base].y === 0) return;
    if (queue.length < 2) queue.push(name);
  }

  function tick() {
    if (state !== 'playing') return;
    if (queue.length) dir = queue.shift();

    var d = DIRS[dir];
    var head = { x: snake[0].x + d.x, y: snake[0].y + d.y };

    var eating = food && head.x === food.x && head.y === food.y;
    // 不吃食物时尾巴会前移，所以允许头移入当前尾巴的位置
    var body = eating ? snake : snake.slice(0, -1);
    var hitWall = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
    var hitSelf = body.some(function (s) { return s.x === head.x && s.y === head.y; });

    if (hitWall || hitSelf) {
      gameOver();
      return;
    }

    snake.unshift(head);
    if (eating) {
      score += 10;
      delay = Math.max(MIN_DELAY, delay - STEP_DOWN);
      placeFood();
      updateScore();
      if (!food) {
        draw();
        gameOver(true);
        return;
      }
    } else {
      snake.pop();
    }
    draw();
    timer = setTimeout(tick, delay);
  }

  function showOverlay(title, desc, startText) {
    $('overTitle').textContent = title;
    $('overDesc').textContent = desc;
    $('btnStart').textContent = startText;
    overlayEl.hidden = false;
  }

  function start() {
    clearTimeout(timer);
    reset();
    state = 'playing';
    overlayEl.hidden = true;
    btnPause.textContent = '暂停';
    timer = setTimeout(tick, delay);
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    clearTimeout(timer);
    btnPause.textContent = '继续';
    showOverlay('已暂停', '点击继续或按空格键', '继续游戏');
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    overlayEl.hidden = true;
    btnPause.textContent = '暂停';
    timer = setTimeout(tick, delay);
  }

  function gameOver(cleared) {
    state = 'over';
    clearTimeout(timer);
    btnPause.textContent = '暂停';
    showOverlay(cleared ? '通关了！' : '游戏结束', '最终得分 ' + score, '再来一局');
  }

  // ===== 输入 =====
  var KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right'
  };

  function initInput() {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (state === 'playing') pause();
        else if (state === 'paused') resume();
        else start();
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(KEYS, e.key)) return;
      e.preventDefault();
      turn(KEYS[e.key]);
    });

    var startX = 0, startY = 0, tracking = false;
    stageEl.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
    });
    // 滑动过程中就响应，手感更跟手
    stageEl.addEventListener('pointermove', function (e) {
      if (!tracking) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
      if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 'right' : 'left');
      else turn(dy > 0 ? 'down' : 'up');
      startX = e.clientX;
      startY = e.clientY;
    });
    function stopTrack() { tracking = false; }
    stageEl.addEventListener('pointerup', stopTrack);
    stageEl.addEventListener('pointercancel', stopTrack);

    $('dpad').addEventListener('pointerdown', function (e) {
      var btn = e.target.closest('.dp');
      if (!btn) return;
      e.preventDefault();
      turn(btn.getAttribute('data-dir'));
    });

    $('btnStart').addEventListener('click', function () {
      if (state === 'paused') resume();
      else start();
    });
    btnPause.addEventListener('click', function () {
      if (state === 'playing') pause();
      else if (state === 'paused') resume();
    });

    // 切到后台自动暂停
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause();
    });
    window.addEventListener('resize', resize);
  }

  // ===== 启动 =====
  best = parseInt(storageGet('snake.best'), 10) || 0;
  $('best').textContent = best;
  initInput();
  reset();
  resize();
})();
