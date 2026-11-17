/* =========================================================================
 * future-home · main.js
 * 第一人称控制器（WASD + 指针锁 / 拖拽回退）、区域触发、E 交互、启动时序
 * 启动分片参考文档 2.3：每步让出主线程，逐条更新进度
 * ========================================================================= */
(function (H) {
  'use strict';

  var T = window.THREE;

  var canvas = document.getElementById('view');
  var bootEl = document.getElementById('boot');
  var bootBar = document.getElementById('bootBar');
  var bootTip = document.getElementById('bootTip');
  var lockEl = document.getElementById('lock');
  var zoneEl = document.getElementById('zone');
  var hintEl = document.getElementById('hint');
  var fpsEl = document.getElementById('fps');
  var modeEl = document.getElementById('mode');

  if (!window.THREE) {
    bootEl.innerHTML = '<div class="boot-tip">three.js 加载失败</div>';
    return;
  }

  var rooms = H.rooms;
  var player = {
    x: 17.6, z: 0.0,
    yaw: Math.PI / 2,          // 面向 -x，正对入户门
    pitch: -0.02,
    vx: 0, vz: 0,
    eye: 1.66,
    bob: 0,
    stepAcc: 0,
    zone: ''
  };

  var SPEED = { walk: 3.0, sprint: 5.2 };
  var RADIUS = 0.32;
  var time = 0;
  var zoneTimer = 0;
  var activeInteract = null;
  var interactCool = 0;

  /* ============================ 启动时序 ============================ */
  var STEPS = [
    ['正在浇筑地面与墙体', function () { H.buildShell(); }],
    ['正在点亮室内灯光', function () { H.buildLights(); }],
    ['正在布置入户门厅', function () { H.buildPorch(); }],
    ['正在布置客厅', function () { rooms.living = H.buildLiving(); }],
    ['正在初始化全息游戏房', function () { rooms.arcade = H.buildArcade(); }],
    ['正在调试 360° 影院', function () { rooms.cinema = H.buildCinema(); }],
    ['正在设置卧室场景', function () { rooms.bedroom = H.buildBedroom(); }],
    ['正在打磨卫生间', function () { rooms.bath = H.buildBath(); }],
    ['正在布置康养室', function () { rooms.care = H.buildCare(); }],
    ['正在唤醒家务机器人', function () { rooms.robot = H.buildRobot(); }],
    ['正在准备首帧画面', function () { prepare(); }]
  ];

  var stepIdx = 0;

  function bootNext() {
    if (stepIdx >= STEPS.length) {
      bootBar.style.width = '100%';
      setTimeout(function () {
        bootEl.classList.add('done');
        setTimeout(function () { bootEl.style.display = 'none'; }, 850);
      }, 220);
      startLoop();
      return;
    }
    var s = STEPS[stepIdx];
    bootTip.textContent = s[0];
    bootBar.style.width = Math.round(stepIdx / STEPS.length * 100) + '%';
    setTimeout(function () {
      try {
        s[1]();
      } catch (err) {
        console.error('[boot] ' + s[0], err);
      }
      stepIdx++;
      bootNext();
    }, 20);
  }

  function prepare() {
    H.camera.rotation.order = 'YXZ';
    syncCamera();
    H.renderer.compile(H.scene, H.camera);
  }

  /* ============================ 相机 ============================ */
  function syncCamera() {
    var cam = H.camera;
    cam.position.set(player.x, player.eye + Math.sin(player.bob) * 0.022, player.z);
    cam.rotation.y = player.yaw;
    cam.rotation.x = player.pitch;
  }

  /* ============================ 区域 ============================ */
  function setZone(zone, silent) {
    if (zone === player.zone) return;
    player.zone = zone;

    if (!silent) {
      zoneEl.textContent = H.ZONE_NAME[zone] || zone;
      zoneEl.classList.add('show');
      clearTimeout(zoneTimer);
      zoneTimer = setTimeout(function () { zoneEl.classList.remove('show'); }, 1900);
    }

    if (rooms.arcade) rooms.arcade.setActive(zone === 'arcade');
    if (rooms.cinema) rooms.cinema.setPlaying(zone === 'cinema');
    if (rooms.bedroom) {
      var isRain = H.BED_SCENES[rooms.bedroom.sceneIndex()].key === 'rain';
      H.Audio.setRain(zone === 'bedroom' && isRain, 0.10);
    }
  }

  /* ============================ 交互 ============================ */
  function updateInteract() {
    var best = null, bestD = 1e9;
    for (var i = 0; i < H.interactables.length; i++) {
      var it = H.interactables[i];
      var dx = player.x - it.x, dz = player.z - it.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < it.r && d < bestD) { best = it; bestD = d; }
    }
    activeInteract = best;

    if (best) {
      hintEl.innerHTML = '<b>E</b> ' + best.label;
      hintEl.classList.add('show');
    } else {
      hintEl.classList.remove('show');
    }
  }

  function doInteract() {
    if (interactCool > 0) return;
    interactCool = 0.25;
    if (activeInteract && activeInteract.action) activeInteract.action();
  }

  /* ============================ 开场自动步入 ============================ */
  var WALK = {
    active: false, done: false, t: 0, phase: 0, stepAcc: 0,
    seq: [
      { d: 1.6, x0: 17.6, x1: 15.35 },   // 走到门前
      { d: 0.7, x0: 15.35, x1: 15.35 },  // 停一下，等门滑开
      { d: 2.4, x0: 15.35, x1: 9.9 }     // 穿门进屋
    ]
  };
  WALK.total = WALK.seq.reduce(function (s, k) { return s + k.d; }, 0);

  function startWalkIn() {
    if (WALK.active || WALK.done) return;
    WALK.active = true;
    WALK.t = 0; WALK.phase = 0; WALK.stepAcc = 0;
    player.x = WALK.seq[0].x0;
    player.z = 0;
    player.yaw = Math.PI / 2;
    player.pitch = -0.02;
    player.vx = player.vz = 0;
    H.Audio.click(520);
  }

  function updateWalkIn(dt) {
    WALK.t += dt;
    var t = WALK.t, acc = 0, x = WALK.seq[WALK.seq.length - 1].x1;
    for (var i = 0; i < WALK.seq.length; i++) {
      var s = WALK.seq[i];
      if (t < acc + s.d) {
        var u = (t - acc) / s.d;
        u = u * u * (3 - 2 * u);
        x = s.x0 + (s.x1 - s.x0) * u;
        break;
      }
      acc += s.d;
    }

    var moved = Math.abs(x - player.x);
    player.x = x;
    player.z = H.damp(player.z, 0, 8, dt);

    WALK.phase += moved * 9.0;
    WALK.stepAcc += moved;
    if (WALK.stepAcc > 0.82) { WALK.stepAcc = 0; H.Audio.step(0.8); }

    var cam = H.camera;
    cam.position.set(player.x, player.eye + Math.sin(WALK.phase) * 0.017, player.z);
    cam.rotation.y = player.yaw;
    cam.rotation.x = player.pitch + Math.sin(WALK.phase * 0.5) * 0.005;

    if (t >= WALK.total) {
      WALK.active = false;
      WALK.done = true;
      player.x = WALK.seq[WALK.seq.length - 1].x1;
      player.vx = player.vz = 0;
      zoneEl.textContent = '欢迎回家';
      zoneEl.classList.add('show');
      clearTimeout(zoneTimer);
      zoneTimer = setTimeout(function () { zoneEl.classList.remove('show'); }, 2200);
      H.Audio.click(640);
    }
  }

  /* ============================ 玩家 ============================ */
  function updatePlayer(dt) {
    if (WALK.active) { updateWalkIn(dt); return; }
    if (!WALK.done) { syncCamera(); return; }   // 未点击开始前不响应移动

    var look = H.Input.look;
    player.yaw -= look.dx;
    player.pitch = H.clamp(player.pitch - look.dy, -1.35, 1.35);

    var axis = H.Input.moveAxis();
    var sprint = H.Input.down('sprint');
    var maxSpeed = sprint ? SPEED.sprint : SPEED.walk;

    var fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    var rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);

    var tx = (fx * axis.y + rx * axis.x) * maxSpeed;
    var tz = (fz * axis.y + rz * axis.x) * maxSpeed;

    player.vx = H.damp(player.vx, tx, 14, dt);
    player.vz = H.damp(player.vz, tz, 14, dt);

    var nx = player.x + player.vx * dt;
    var nz = player.z + player.vz * dt;

    var solved = H.physics.resolve(nx, nz, RADIUS, 0.05, 1.72);
    player.x = solved.x;
    player.z = solved.z;

    // 脚步 + 头部起伏
    var speed = Math.sqrt(player.vx * player.vx + player.vz * player.vz);
    player.bob += speed * dt * 2.4;
    player.stepAcc += speed * dt;
    var stride = sprint ? 1.95 : 1.5;
    if (player.stepAcc > stride && speed > 0.6) {
      player.stepAcc = 0;
      H.Audio.step(sprint ? 1.15 : 0.85);
    }

    syncCamera();
  }

  /* ============================ 主循环 ============================ */
  var clock = new T.Clock();
  var fpsAcc = 0, fpsFrames = 0, running = false;

  function stepSim(dt) {
    time += dt;

    if (interactCool > 0) interactCool -= dt;

    updatePlayer(dt);
    setZone(H.zoneAt(player.x, player.z), false);

    if (H.shell.door) H.shell.door.update(dt, player.x, player.z);
    if (H.autoDoors) {
      for (var di = 0; di < H.autoDoors.length; di++) H.autoDoors[di].update(dt, player.x, player.z);
    }
    if (rooms.living) rooms.living.update(dt, time);
    if (rooms.arcade) rooms.arcade.update(dt, time);
    if (rooms.cinema) rooms.cinema.update(dt, time);
    if (rooms.bedroom) rooms.bedroom.update(dt, time);
    if (rooms.bath) rooms.bath.update(dt, time);
    if (rooms.care) rooms.care.update(dt, time);
    if (rooms.robot) rooms.robot.update(dt, time);

    updateInteract();
    H.renderFrame(time);
    H.Input.endFrame();
  }

  function tick() {
    var raw = clock.getDelta();
    stepSim(Math.min(raw, 0.05));

    fpsAcc += raw; fpsFrames++;
    if (fpsAcc > 0.5) {
      fpsEl.textContent = Math.round(fpsFrames / fpsAcc) + ' FPS';
      fpsAcc = 0; fpsFrames = 0;
    }

    H.govern(raw * 1000);

    if (running) requestAnimationFrame(tick);
  }

  function startLoop() {
    if (running) return;
    running = true;
    clock.getDelta();
    requestAnimationFrame(tick);
    setZone(H.zoneAt(player.x, player.z), true);
    if (window.__HOME__) window.__HOME__.ready = true;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
    } else if (bootEl.classList.contains('done') || bootEl.style.display === 'none') {
      running = true;
      clock.getDelta();
      requestAnimationFrame(tick);
    }
  });

  /* ============================ 事件绑定 ============================ */
  H.Input.bind(canvas);

  function requestLock() {
    H.Audio.unlock();
    startWalkIn();
    if (canvas.requestPointerLock) {
      var p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(function () { /* 被拒绝时用拖拽 */ });
    }
    lockEl.classList.add('hidden');
  }

  lockEl.addEventListener('click', requestLock);

  H.on('lock', function (locked) {
    lockEl.classList.toggle('hidden', locked);
    if (locked) H.Audio.click(720);
  });

  H.on('key', function (code) {
    if (code === 'KeyE') doInteract();
    if (code === 'Escape') {
      H.Input.exitLock();
      lockEl.classList.remove('hidden');
    }
  });

  H.on('bedroom:scene', function (s) {
    zoneEl.textContent = '卧室场景 · ' + s.name;
    zoneEl.classList.add('show');
    clearTimeout(zoneTimer);
    zoneTimer = setTimeout(function () { zoneEl.classList.remove('show'); }, 1600);
    var isRain = s.key === 'rain';
    H.Audio.setRain(isRain && player.zone === 'bedroom', 0.10);
  });

  H.on('quality', function (scale) {
    modeEl.textContent = H.QUALITY.name + ' ' + Math.round(scale * 100) + '%';
  });

  window.addEventListener('resize', function () { H.resize(); });

  /* ============================ 启动 ============================ */
  H.init3D(canvas);
  modeEl.textContent = H.QUALITY.name + ' 100%';
  bootNext();

  /* ============================ 调试钩子 ============================ */
  window.__HOME__ = {
    ready: false,
    rooms: rooms,
    player: player,
    camera: H.camera,
    scene: H.scene,
    renderer: H.renderer,
    audio: H.Audio,
    teleport: function (x, z, yaw) {
      player.x = x; player.z = z;
      if (typeof yaw === 'number') player.yaw = yaw;
      player.vx = player.vz = 0;
      syncCamera();
    },
    interact: doInteract,
    walkIn: startWalkIn,
    walk: WALK,
    // 调试/自动化：手动推进若干帧（rAF 在后台或自动化环境里会冻结）
    step: function (dt, n) {
      var f = dt || 1 / 60, c = n || 1;
      for (var i = 0; i < c; i++) stepSim(f);
      return time;
    },
    state: function () {
      var meshes = 0;
      H.scene.traverse(function (o) { if (o.isMesh || o.isPoints) meshes++; });
      return {
        zone: player.zone,
        pos: { x: +player.x.toFixed(2), z: +player.z.toFixed(2) },
        door: H.shell.door ? +H.shell.door.isOpen().toFixed(2) : -1,
        bedroom: rooms.bedroom ? rooms.bedroom.sceneName() : '',
        boxes: H.physics.boxes.length,
        meshes: meshes,
        quality: H.QUALITY.name
      };
    }
  };
})(window.HOME);
