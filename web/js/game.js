/**
 * 四面打砖块
 * 鼠标位置同时驱动上/下（水平）与左/右（垂直）四块挡板，把球弹回。
 */
(function () {
  'use strict';

  const BALL_R = 6;
  const PADDLE_LEN = 150;
  const PADDLE_THICK = 10;
  const COLS = 16;
  const ROWS = 9;
  const FILL_RATE = 0.55;       // 每格生成砖块的概率
  const MIN_BRICKS = 24;        // 随机后的兜底数量
  const CENTER_CLEAR_R = 100;   // 中心留给球出发的空区半径
  const BRICK_COLORS = ['#5BA4CF', '#7FB3D5', '#F5B7B1', '#F9E79F', '#A9DFBF', '#D7BDE2'];
  const BALL_DEFS = [
    { speed: 185, color: '#9FC9E3', name: '慢' },
    { speed: 260, color: '#5BA4CF', name: '中' },
    { speed: 340, color: '#2E86C1', name: '快' },
  ];
  const START_ANGLES = [-145, -35, 100]; // 度，三球分散出发
  const SPEED_UP_PER_LEVEL = 1.08;
  const READY_DELAY = 900;               // 开局留给玩家移动鼠标的时间（毫秒）

  const canvas = document.getElementById('game');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const els = {
    score: document.getElementById('score'),
    bricks: document.getElementById('bricks'),
    balls: document.getElementById('balls'),
    level: document.getElementById('level'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlayDesc: document.getElementById('overlayDesc'),
    startBtn: document.getElementById('startBtn'),
    restartBtn: document.getElementById('restart'),
  };

  const state = {
    w: 0,
    h: 0,
    mouse: { x: 0, y: 0 },
    paddles: { topX: 0, bottomX: 0, leftY: 0, rightY: 0 },
    balls: [],
    bricks: [],
    bricksLeft: 0,
    score: 0,
    level: 1,
    running: false,
    lastTs: 0,
    readyAt: 0,
    toast: '',
    toastUntil: 0,
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // ===== 尺寸 =====
  function measure() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const oldW = state.w;
    const oldH = state.h;

    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    state.w = rect.width;
    state.h = rect.height;

    if (!oldW || !oldH) {
      state.mouse.x = state.w / 2;
      state.mouse.y = state.h / 2;
      return;
    }

    // 窗口尺寸变化时按比例迁移已有元素
    const sx = state.w / oldW;
    const sy = state.h / oldH;
    for (const brick of state.bricks) {
      brick.x *= sx;
      brick.y *= sy;
      brick.w *= sx;
      brick.h *= sy;
    }
    for (const ball of state.balls) {
      ball.x *= sx;
      ball.y *= sy;
    }
    state.mouse.x = clamp(state.mouse.x * sx, 0, state.w);
    state.mouse.y = clamp(state.mouse.y * sy, 0, state.h);
  }

  // ===== 元素构造 =====
  function pickColor() {
    return BRICK_COLORS[Math.floor(Math.random() * BRICK_COLORS.length)];
  }

  /**
   * 细网格上随机撒砖：位置、尺寸、颜色都带随机，中心留一块空区给球出发
   */
  function buildBricks() {
    const inset = 22;
    const gap = 5;
    const areaW = state.w - inset * 2;
    const areaH = state.h * 0.62;
    const cellW = areaW / COLS;
    const cellH = areaH / ROWS;
    const startX = inset;
    const startY = (state.h - areaH) / 2;
    const centerX = state.w / 2;
    const centerY = state.h / 2;

    let bricks = [];
    for (let attempt = 0; attempt < 20 && bricks.length < MIN_BRICKS; attempt++) {
      bricks = [];
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (Math.random() > FILL_RATE) continue;

          const shrink = 0.8 + Math.random() * 0.2;
          const w = (cellW - gap) * shrink;
          const h = (cellH - gap) * shrink;
          const x = startX + col * cellW + (cellW - w) / 2 + (Math.random() - 0.5) * 4;
          const y = startY + row * cellH + (cellH - h) / 2 + (Math.random() - 0.5) * 4;

          const dx = x + w / 2 - centerX;
          const dy = y + h / 2 - centerY;
          if (Math.hypot(dx, dy) < CENTER_CLEAR_R) continue;

          bricks.push({ x, y, w, h, color: pickColor(), alive: true });
        }
      }
    }
    return bricks;
  }

  function spawnBalls() {
    const cx = state.w / 2;
    const cy = state.h / 2;

    return BALL_DEFS.map((def, index) => {
      const rad = (START_ANGLES[index % START_ANGLES.length] * Math.PI) / 180;
      return {
        x: cx + Math.cos(rad) * 10,
        y: cy + Math.sin(rad) * 10,
        vx: Math.cos(rad) * def.speed,
        vy: Math.sin(rad) * def.speed,
        speed: def.speed,
        color: def.color,
      };
    });
  }

  function normalizeSpeed(ball) {
    const len = Math.hypot(ball.vx, ball.vy) || 1;
    ball.vx = (ball.vx / len) * ball.speed;
    ball.vy = (ball.vy / len) * ball.speed;
  }

  // ===== 挡板跟随鼠标 =====
  function updatePaddles() {
    const maxOffset = PADDLE_LEN / 2;
    const x = clamp(state.mouse.x - maxOffset, 0, Math.max(0, state.w - PADDLE_LEN));
    const y = clamp(state.mouse.y - maxOffset, 0, Math.max(0, state.h - PADDLE_LEN));

    state.paddles.topX = x;
    state.paddles.bottomX = x;
    state.paddles.leftY = y;
    state.paddles.rightY = y;
  }

  // ===== 碰撞 =====
  const HIT = 'hit';

  function bounceOnBrick(ball, brick) {
    const nearestX = clamp(ball.x, brick.x, brick.x + brick.w);
    const nearestY = clamp(ball.y, brick.y, brick.y + brick.h);
    let dx = ball.x - nearestX;
    let dy = ball.y - nearestY;

    // 球心已在砖块内部时，用球心相对砖块中心的方向决定反射轴
    if (dx === 0 && dy === 0) {
      dx = ball.x - (brick.x + brick.w / 2);
      dy = ball.y - (brick.y + brick.h / 2);
    }

    if (dx * dx + dy * dy > BALL_R * BALL_R) return false;

    if (Math.abs(dx) > Math.abs(dy)) {
      ball.vx = -ball.vx;
    } else {
      ball.vy = -ball.vy;
    }

    brick.alive = false;
    state.bricksLeft--;
    state.score += 10;
    return true;
  }

  function hitSpeedLine(ball, axis, paddleStart, paddleLen) {
    const center = paddleStart + paddleLen / 2;
    const pos = axis === 'x' ? ball.x : ball.y;
    return (pos - center) / (paddleLen / 2); // -1 ~ 1
  }

  /**
   * 处理单个子步的碰撞
   * @return {'lost'|'hit'|null}
   */
  function resolveBall(ball) {
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      if (bounceOnBrick(ball, brick)) return HIT;
    }

    const T = PADDLE_THICK;
    const L = PADDLE_LEN;

    // 上挡板
    if (ball.y - BALL_R <= T) {
      if (ball.x >= state.paddles.topX && ball.x <= state.paddles.topX + L) {
        const offset = hitSpeedLine(ball, 'x', state.paddles.topX, L);
        ball.y = T + BALL_R;
        ball.vy = Math.abs(ball.vy);
        ball.vx += offset * Math.abs(ball.vy) * 0.7;
        normalizeSpeed(ball);
        return HIT;
      }
    }

    // 下挡板
    if (ball.y + BALL_R >= state.h - T) {
      if (ball.x >= state.paddles.bottomX && ball.x <= state.paddles.bottomX + L) {
        const offset = hitSpeedLine(ball, 'x', state.paddles.bottomX, L);
        ball.y = state.h - T - BALL_R;
        ball.vy = -Math.abs(ball.vy);
        ball.vx += offset * Math.abs(ball.vy) * 0.7;
        normalizeSpeed(ball);
        return HIT;
      }
    }

    // 左挡板
    if (ball.x - BALL_R <= T) {
      if (ball.y >= state.paddles.leftY && ball.y <= state.paddles.leftY + L) {
        const offset = hitSpeedLine(ball, 'y', state.paddles.leftY, L);
        ball.x = T + BALL_R;
        ball.vx = Math.abs(ball.vx);
        ball.vy += offset * Math.abs(ball.vx) * 0.7;
        normalizeSpeed(ball);
        return HIT;
      }
    }

    // 右挡板
    if (ball.x + BALL_R >= state.w - T) {
      if (ball.y >= state.paddles.rightY && ball.y <= state.paddles.rightY + L) {
        const offset = hitSpeedLine(ball, 'y', state.paddles.rightY, L);
        ball.x = state.w - T - BALL_R;
        ball.vx = -Math.abs(ball.vx);
        ball.vy += offset * Math.abs(ball.vx) * 0.7;
        normalizeSpeed(ball);
        return HIT;
      }
    }

    // 越过挡板缝隙飞出场外即漏球
    if (ball.x < 0 || ball.x > state.w || ball.y < 0 || ball.y > state.h) {
      return 'lost';
    }

    return null;
  }

  function moveBalls(dt) {
    for (let i = state.balls.length - 1; i >= 0; i--) {
      const ball = state.balls[i];
      let budget = ball.speed * dt;

      while (budget > 0) {
        const stepLen = Math.min(budget, BALL_R * 0.9);
        const len = Math.hypot(ball.vx, ball.vy) || 1;
        ball.x += (ball.vx / len) * stepLen;
        ball.y += (ball.vy / len) * stepLen;
        budget -= stepLen;

        if (resolveBall(ball) === 'lost') {
          state.balls.splice(i, 1);   // 出界即消失，只能重开恢复
          break;
        }
        if (state.bricksLeft <= 0) break;
      }

      if (state.bricksLeft <= 0) break;
    }
  }

  // ===== 绘制 =====
  function roundRect(x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPaddle(x, y, w, h) {
    const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, '#7EC8E3');
    gradient.addColorStop(1, '#2E86C1');
    roundRect(x, y, w, h, Math.min(w, h) / 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  function draw() {
    const { w, h } = state;
    ctx.clearRect(0, 0, w, h);

    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      roundRect(brick.x, brick.y, brick.w, brick.h, 4);
      ctx.fillStyle = brick.color;
      ctx.fill();
    }

    const T = PADDLE_THICK;
    const L = PADDLE_LEN;
    drawPaddle(state.paddles.topX, 0, L, T);
    drawPaddle(state.paddles.bottomX, h - T, L, T);
    drawPaddle(0, state.paddles.leftY, T, L);
    drawPaddle(w - T, state.paddles.rightY, T, L);

    for (const ball of state.balls) {
      ctx.save();
      ctx.shadowColor = ball.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = ball.color;
      ctx.fill();
      ctx.restore();
    }

    if (state.toast && performance.now() < state.toastUntil) {
      ctx.save();
      ctx.fillStyle = 'rgba(46, 134, 193, 0.9)';
      ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.toast, w / 2, h / 2 - 60);
      ctx.restore();
    }
  }

  function updateHud() {
    if (els.score) els.score.textContent = state.score;
    if (els.bricks) els.bricks.textContent = Math.max(0, state.bricksLeft);
    if (els.balls) els.balls.textContent = state.balls.length;
    if (els.level) els.level.textContent = state.level;
  }

  // ===== 流程 =====
  function prepareRound() {
    state.bricks = buildBricks();
    state.bricksLeft = state.bricks.length;
    state.balls = spawnBalls();
    updatePaddles();
    updateHud();
  }

  function nextLevel() {
    state.level++;
    const boosted = BALL_DEFS.map((def) => def.speed * Math.pow(SPEED_UP_PER_LEVEL, state.level - 1));
    state.bricks = buildBricks();
    state.bricksLeft = state.bricks.length;
    state.balls = spawnBalls();
    state.balls.forEach((ball, index) => {
      ball.speed = boosted[index];
      normalizeSpeed(ball);
    });
    state.toast = `第 ${state.level} 关`;
    state.toastUntil = performance.now() + 1400;
    state.readyAt = performance.now() + READY_DELAY;
    updateHud();
  }

  function showOverlay(title, desc, buttonLabel) {
    if (!els.overlay) return;
    if (els.overlayTitle) els.overlayTitle.textContent = title;
    if (els.overlayDesc) els.overlayDesc.textContent = desc;
    if (els.startBtn) els.startBtn.textContent = buttonLabel;
    els.overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    if (els.overlay) els.overlay.classList.add('hidden');
  }

  function startGame() {
    state.score = 0;
    state.level = 1;
    state.toast = '';
    hideOverlay();
    measure();
    prepareRound();
    state.running = true;
    state.lastTs = performance.now();
    state.readyAt = state.lastTs + READY_DELAY;
    requestAnimationFrame(loop);
  }

  function gameOver() {
    state.running = false;
    draw();
    showOverlay('球都用完了', `本局得分 ${state.score}`, '再来一局');
  }

  function loop(timestamp) {
    if (!state.running) return;

    const dt = Math.min((timestamp - state.lastTs) / 1000, 1 / 30);
    state.lastTs = timestamp;

    updatePaddles();

    // 准备期：球原地不动，挡板已可跟随鼠标，给玩家就位时间
    if (timestamp < state.readyAt) {
      draw();
      requestAnimationFrame(loop);
      return;
    }

    moveBalls(dt);
    updateHud();
    draw();

    if (state.bricksLeft <= 0) {
      nextLevel();
    } else if (state.balls.length === 0) {
      gameOver();
      return;
    }

    requestAnimationFrame(loop);
  }

  // ===== 事件 =====
  function onPointerMove(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    state.mouse.x = clamp(clientX - rect.left, 0, rect.width);
    state.mouse.y = clamp(clientY - rect.top, 0, rect.height);
  }

  window.addEventListener('mousemove', (event) => onPointerMove(event.clientX, event.clientY));
  window.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    onPointerMove(touch.clientX, touch.clientY);
    event.preventDefault();
  }, { passive: false });

  window.addEventListener('resize', () => {
    measure();
    if (!state.running) {
      updatePaddles();
      draw();
    }
  });

  if (els.startBtn) els.startBtn.addEventListener('click', startGame);
  if (els.restartBtn) els.restartBtn.addEventListener('click', startGame);

  // ===== 初始化：打开页面即开始，不显示引导弹层 =====
  startGame();
})();
