/* =========================================================================
 * future-home · core.js
 * 参考《几猫国产3A大作》技术实现文档：
 *   3.1 画质档位  / 3.2 像素预算 + 动态分辨率  / 3.3 全屏三角形后处理链
 *   4   程序化贴图 / 6 自研 AABB 碰撞（圆柱近似）/ 11 程序化音频 / 13 输入抽象
 * 铁律：零外部资源 —— 贴图、声音、几何全部由代码生成
 * ========================================================================= */
window.HOME = window.HOME || {};
(function (H) {
  'use strict';

  var T = window.THREE;

  /* ============================ 0. 工具 ============================ */
  H.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  H.lerp = function (a, b, t) { return a + (b - a) * t; };
  H.rand = function (a, b) { return a + Math.random() * (b - a); };
  H.TAU = Math.PI * 2;
  // 帧率无关的指数逼近
  H.damp = function (a, b, lambda, dt) { return H.lerp(a, b, 1 - Math.exp(-lambda * dt)); };
  H.smoothstep = function (e0, e1, x) {
    var t = H.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function hash2(x, y) {
    var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return h - Math.floor(h);
  }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return H.lerp(
      H.lerp(hash2(xi, yi), hash2(xi + 1, yi), u),
      H.lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
  }
  H.vnoise = vnoise;
  H.fbm = function (x, y, oct) {
    var s = 0, amp = 0.5, f = 1;
    for (var i = 0; i < (oct || 4); i++) { s += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; }
    return s;
  };

  // 可平铺（周期）版本：贴图要 RepeatWrapping，不能有接缝
  function pnoise(x, y, px, py) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    function h(a, b) { return hash2(((a % px) + px) % px, ((b % py) + py) % py); }
    return H.lerp(
      H.lerp(h(xi, yi), h(xi + 1, yi), u),
      H.lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  }
  // x/y 取 0~1，period 为基频格数
  H.pfbm = function (x, y, period, oct) {
    var s = 0, amp = 0.5, f = 1, norm = 0;
    for (var i = 0; i < (oct || 4); i++) {
      s += amp * pnoise(x * period * f, y * period * f, period * f, period * f);
      norm += amp; f *= 2; amp *= 0.5;
    }
    return s / norm;
  };

  /* ============================ 1. 事件总线 ============================ */
  var handlers = {};
  H.on = function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); };
  H.emit = function (name, payload) {
    var list = handlers[name];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (e) { console.warn('[event] ' + name, e); }
    }
  };

  /* ============================ 2. 画质档位 ============================ */
  // detail：0 关闭细节几何 / 1 中等 / 2 全开；aniso：各向异性过滤上限；env：环境反射立方图分辨率
  // lights：同时在场景里的点光源槽位数（全屋登记了 24 盏，见 H.Lights）。
  //         每盏灯都是全屏逐片元成本，而且会被 three.js 展开进 shader，
  //         集成显卡上这一项比分辨率更要命
  var TIERS = {
    low:    { name: 'low',    scale: 0.72, shadow: 0,    tex: 512,  bloom: 1, aniso: 4,  env: 64,  detail: 0, fxaa: 0, lights: 8,  blur: 1 },
    // medium 原本给了 1024 的平行光阴影：它要覆盖 48×40m 的整层，折算下来每米只有
    // 21 像素，糊得几乎看不出是阴影，却要（a）多渲一遍全场景（b）在每个受光材质里
    // 做 PCF 软采样。家具的落地感本来就有 shadowBlob 贴片兜着，直接关掉最划算
    medium: { name: 'medium', scale: 0.88, shadow: 0,    tex: 1024, bloom: 1, aniso: 8,  env: 128, detail: 1, fxaa: 1, lights: 9,  blur: 1 },
    high:   { name: 'high',   scale: 1.00, shadow: 2048, tex: 1024, bloom: 2, aniso: 16, env: 256, detail: 2, fxaa: 1, lights: 16, blur: 2 }
  };
  var BUDGET = { low: 1.05e6, medium: 1.7e6, high: 2.6e6 };

  function readGPU() {
    try {
      var gl = document.createElement('canvas').getContext('webgl2') ||
               document.createElement('canvas').getContext('webgl');
      if (!gl) return '';
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return '';
      return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    } catch (e) { return ''; }
  }

  function pickQuality() {
    var forced = (location.search.match(/[?&]q=(low|medium|high)/) || [])[1];
    if (forced) return JSON.parse(JSON.stringify(TIERS[forced]));

    var mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
    if (mobile) return JSON.parse(JSON.stringify(TIERS.low));

    var gpu = readGPU();
    // 软件渲染（没驱动 / 虚拟机）给 medium 等于直接卡死
    if (/SwiftShader|llvmpipe|Software|Basic Render|Microsoft Basic/i.test(gpu)) {
      return JSON.parse(JSON.stringify(TIERS.low));
    }
    if (/Mali|Adreno|PowerVR/i.test(gpu) || (/Intel/i.test(gpu) && !/Arc/i.test(gpu))) {
      return JSON.parse(JSON.stringify(TIERS.medium));          // 集成显卡：中档 + 动态降级
    }
    if (!gpu) return JSON.parse(JSON.stringify(TIERS.medium));   // 读不到型号，保守一点

    return JSON.parse(JSON.stringify(TIERS.high));
  }

  var QUALITY = pickQuality();
  H.QUALITY = QUALITY;

  /* ============================ 3. 渲染器 / 场景 / 相机 ============================ */
  var renderer = null, scene = null, camera = null, post = null;
  var dynScale = 1;
  H.size = new T.Vector2(1, 1);
  H.maxAniso = 4;

  H.init3D = function (canvas) {
    renderer = new T.WebGLRenderer({
      canvas: canvas, antialias: false, powerPreference: 'high-performance', stencil: false
    });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NoToneMapping;      // 色调映射在最后一个 pass 里自研
    renderer.setClearColor(0x05070c, 1);
    renderer.shadowMap.enabled = QUALITY.shadow > 0;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    // 场景几乎全是静物：阴影贴图不必每帧重画（见 H.tickShadow），
    // 这一条在集成显卡上直接省掉「每帧多渲染一遍全场景」
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    try {
      H.maxAniso = Math.max(1, Math.min(QUALITY.aniso, renderer.capabilities.getMaxAnisotropy()));
    } catch (e) { H.maxAniso = 4; }

    scene = new T.Scene();
    // 室内也留一点空气感：远处墙面轻微发灰，拉开纵深
    scene.fog = new T.FogExp2(0x080e18, 0.0155);

    camera = new T.PerspectiveCamera(74, 1, 0.08, 260);

    H.renderer = renderer;
    H.scene = scene;
    H.camera = camera;

    post = H.createPost(renderer, scene, camera);
    H.post = post;
    H.resize();
    return { renderer: renderer, scene: scene, camera: camera };
  };

  /* ---- 像素预算 + 动态分辨率（文档 3.2 的简化版） ---- */
  H.resize = function () {
    if (!renderer) return;
    var w = window.innerWidth, h = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var scale = QUALITY.scale * dynScale;
    var need = w * dpr * h * dpr * scale * scale;
    var budget = BUDGET[QUALITY.name] || BUDGET.medium;
    if (need > budget) scale *= Math.sqrt(budget / need);

    renderer.setPixelRatio(dpr * scale);
    renderer.setSize(w, h, false);

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    var db = renderer.getDrawingBufferSize(H.size);
    if (post) post.setSize(db.x, db.y);
  };

  /* ============================ 3.5 点光源槽位池 ============================ *
   * MeshStandardMaterial 里每一盏点光源都是「全屏逐片元」的成本，而且 three.js
   * 会按场景里的灯数编译 shader —— 全屋 20 多盏灯同时在编译期展开，集成显卡直接趴下。
   * 做法：各房间只登记「灯的描述」，真正进场景的是固定 N 个槽位；每隔 0.3s 按
   * 玩家位置挑出最该亮的 N 盏填进槽位。灯数恒定 ⇒ 不会触发 shader 重编译。
   * 被换下的都是隔着墙、离玩家 8m 以上的灯，观感上察觉不到。
   * ======================================================================== */
  H.Lights = (function () {
    var defs = [], pool = [], sel = [], acc = 1e9, inited = false;

    function add(color, intensity, dist, x, y, z, decay) {
      var d = {
        color: new T.Color(color),
        intensity: intensity,
        distance: dist || 10,
        decay: decay === undefined ? 1.6 : decay,
        x: x, y: y, z: z,
        on: false, score: 0
      };
      defs.push(d);
      return d;
    }

    function select(px, py, pz) {
      var i;
      for (i = 0; i < defs.length; i++) {
        var d = defs[i];
        var dx = d.x - px, dy = d.y - py, dz = d.z - pz;
        var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // 评分 = 亮度 / (1 + 「光球表面到玩家的距离」²)
        // 玩家在衰减半径内的灯按亮度排；半径外的按差多远迅速掉分。
        // 不能只看「照到玩家没有」—— 餐区吊灯这种照不到人、但画面里看得见的灯也得留着
        var gap = dist - d.distance;
        if (gap < 0) gap = 0;
        var s = d.intensity / (1 + gap * gap);
        if (d.on) s *= 1.3;                  // 迟滞，避免在临界点反复开关
        d.score = s;
      }
      var order = defs.slice().sort(function (a, b) { return b.score - a.score; });
      for (i = 0; i < defs.length; i++) defs[i].on = false;
      sel.length = 0;
      for (i = 0; i < pool.length && i < order.length; i++) {
        order[i].on = true;
        sel.push(order[i]);
      }
    }

    function apply() {
      for (var i = 0; i < pool.length; i++) {
        var l = pool[i], d = sel[i];
        if (!d) { l.intensity = 0; continue; }
        l.color.copy(d.color);
        l.intensity = d.intensity;
        l.distance = d.distance;
        l.decay = d.decay;
        l.position.set(d.x, d.y, d.z);
      }
    }

    return {
      add: add,
      count: function () { return pool.length + '/' + defs.length; },
      init: function (px, py, pz) {
        if (inited || !scene) return;
        inited = true;
        var n = Math.min(defs.length, Math.max(1, QUALITY.lights || 12));
        for (var i = 0; i < n; i++) {
          var l = new T.PointLight(0xffffff, 0, 10, 1.6);
          l.castShadow = false;
          scene.add(l);
          pool.push(l);
        }
        select(px || 0, py || 1.6, pz || 0);
        apply();
      },
      // 调整槽位数：灯数变了 three.js 必须重编所有受光材质（卡顿一下），
      // 所以只在降级阶梯里调用。返回 true 表示真的变了，需要重编译
      setBudget: function (n, px, py, pz) {
        if (!inited) return false;
        n = Math.max(1, Math.min(defs.length, n));
        if (n === pool.length) return false;
        while (pool.length > n) scene.remove(pool.pop());
        while (pool.length < n) {
          var l = new T.PointLight(0xffffff, 0, 10, 1.6);
          l.castShadow = false;
          scene.add(l);
          pool.push(l);
        }
        acc = 1e9;
        select(px || 0, py || 1.6, pz || 0);
        apply();
        return true;
      },
      update: function (dt, px, py, pz) {
        if (!inited) return;
        acc += dt;
        if (acc > 0.3) { acc = 0; select(px, py, pz); }
        apply();
      }
    };
  })();
  H.addPoint = H.Lights.add;

  /* ---- 几何缓存：同尺寸的 Box 共用一份 BufferGeometry ----
   * 全屋几千个盒子里有大量重复尺寸（格栅、分缝、柜门、通风口……），
   * 共用之后显存占用和启动时的上传次数都能明显下降 */
  var boxCache = {};
  H.boxGeo = function (w, h, d) {
    var k = w.toFixed(4) + '_' + h.toFixed(4) + '_' + d.toFixed(4);
    var g = boxCache[k];
    if (!g) { g = new T.BoxGeometry(w, h, d); boxCache[k] = g; }
    return g;
  };

  /* ---- 阴影贴图节流 ---- *
   * 全屋只有门扇和机器人在动，阴影贴图按固定频率刷新即可；
   * shadowEvery < 0 表示彻底冻结（保留最后一帧的阴影） */
  var shadowEvery = 1 / 6, shadowAcc = 1e9;
  H.tickShadow = function (dt) {
    if (!renderer || !renderer.shadowMap.enabled) return;
    if (shadowEvery < 0) { renderer.shadowMap.needsUpdate = false; return; }
    shadowAcc += dt;
    if (shadowAcc >= shadowEvery) {
      shadowAcc = 0;
      renderer.shadowMap.needsUpdate = true;
    }
  };

  /* ---- 画质档位阶梯（可升可降） ---- *
   * 动态分辨率已经触底还是跑不满帧时，按顺序砍掉最贵的那几项特效；
   * 等帧率重新宽裕了再逐级加回来 —— 启动那几秒（建场景 + 编译 shader）帧率天然很低，
   * 如果只降不升，开场的卡顿会把 bloom / 浮尘永久误杀掉。
   * applyLevel 是幂等的：按目标等级把所有开关重新设一遍，不依赖当前状态。
   * 等级 4、5 会改「进 shader 的开关」（阴影、灯数），翻转一次要重编译材质
   * （卡顿约半秒），所以放在最后，并且要求更长的观察期才动。
   * ======================================================================== */
  var degradeLevel = 0;
  H.degradeLevel = function () { return degradeLevel; };

  // 改了阴影 / 灯数这类「会进 shader 的开关」之后，必须让材质重新编译。
  // 这件事本身就是一次几百毫秒的卡顿 —— 必须让测速器把接下来这段时间整段丢掉，
  // 否则就会变成「降级 → 重编译卡顿 → 又测到慢 → 再降级」的雪崩
  function recompileAll() {
    if (!scene) return;
    scene.traverse(function (o) {
      var m = o.material;
      if (!m) return;
      if (Array.isArray(m)) {
        for (var i = 0; i < m.length; i++) m[i].needsUpdate = true;
      } else m.needsUpdate = true;
    });
    H.stall(4);
  }

  function applyLevel(lv) {
    var i, recompile = false;

    // 1 级：宽光晕（3 个额外 pass）+ 阴影降频
    if (post && post.setWide) post.setWide(lv < 1);
    // 2 级：阴影冻结 + 浮尘
    shadowEvery = lv >= 2 ? -1 : (lv >= 1 ? 1 / 3 : 1 / 6);
    if (H.dust) H.dust.visible = lv < 2;
    // 3 级：体积光锥 + 整条 bloom
    if (H.shafts) {
      // 用 material.visible：对象自身的 visible 由区域剔除管，不能互相覆盖
      for (i = 0; i < H.shafts.length; i++) H.shafts[i].material.visible = lv < 3;
    }
    if (post && post.setBloom) post.setBloom(lv < 3);
    // 4 级：FXAA + 阴影彻底下线（连「采样阴影贴图」的代价一起省掉）
    if (post && post.setFxaa) post.setFxaa(lv < 4);
    if (renderer) {
      var wantShadow = QUALITY.shadow > 0 && lv < 4;
      if (renderer.shadowMap.enabled !== wantShadow) {
        renderer.shadowMap.enabled = wantShadow;
        if (wantShadow) renderer.shadowMap.needsUpdate = true;
        recompile = true;
      }
    }
    // 5 级：点光源减到七成。砍太狠会让房间直接发灰发暗（9→5 肉眼就是「掉了一档」），
    // 这一级的画质代价很大，所以只在「持续极慢」时才会被用到
    var base = QUALITY.lights || 8;
    var wantLights = lv >= 5 ? Math.max(6, Math.round(base * 0.7)) : base;
    if (H.Lights.setBudget(wantLights,
      camera ? camera.position.x : 0,
      camera ? camera.position.y : 1.6,
      camera ? camera.position.z : 0)) recompile = true;

    if (recompile) recompileAll();
  }

  H.degrade = function (lv) {
    lv = Math.min(5, Math.max(0, lv));
    if (lv === degradeLevel) return;
    degradeLevel = lv;
    applyLevel(lv);
    H.stall(1.5);                                  // 每次变档都给一段冷却再重新测速
    H.emit('quality', dynScale);
  };

  // settle 的头几秒要跨过「首帧编译 shader + 上传贴图」的尖峰，
  // 否则开场的卡顿会把特效误判成「跑不动」而砍掉。
  // lock：恢复过两次又掉回来的等级，之后不再尝试，避免画面反复明暗抖动
  var gov = {
    settle: 5.0, acc: 0, n: 0, upWait: 0, floorHits: 0, good: 0,
    lock: 0, tries: {}, samples: []
  };

  // 「接下来这 sec 秒别测速」：用在所有已知会制造尖峰的操作后面
  // （材质重编译、切后台回来、重新拿指针锁、生成音频缓冲区……）
  H.stall = function (sec) {
    gov.settle = Math.max(gov.settle, sec || 1.5);
    gov.acc = 0; gov.n = 0; gov.samples.length = 0;
    gov.floorHits = 0; gov.good = 0;
  };

  H.govern = function (dtMs) {
    if (dtMs > 1500) { H.stall(1.5); return; }      // 切后台 / 断点
    gov.settle -= dtMs / 1000;
    if (gov.settle > 0) { gov.acc = 0; gov.n = 0; gov.samples.length = 0; return; }

    gov.acc += dtMs; gov.n++;
    gov.samples.push(dtMs);
    if (gov.n < 45 && gov.acc < 900) return;

    // 用中位数而不是平均值：一次 GC / 贴图上传的尖峰就能把 45 帧的均值从 16.7
    // 拉到 27ms，足够误判成「跑不动」。中位数对这种孤立尖峰免疫，
    // 只有「真的持续慢」才会体现出来
    var sorted = gov.samples.slice().sort(function (a, b) { return a - b; });
    var med = sorted[sorted.length >> 1];
    gov.acc = 0; gov.n = 0; gov.samples.length = 0;
    var s = dynScale;

    // 约 46fps 以下算慢，约 57fps 以上算「有余量」。
    // 注意上限受垂直同步限制：60Hz 下最快也就 16.7ms，所以好帧的阈值只能贴着它定
    //
    // ⚠ 改动下面这些阈值 / 迟滞计数后，请跑一遍 `node tools/sim-governor.js`
    //   确认不会出现「偶发卡顿 → 一路降到底」的雪崩。
    //   那个脚本镜像了本函数的决策逻辑，改这里就要同步改它。
    var SLOW = 21.5, GOOD = 17.6;

    if (med > SLOW && s > 0.6) {                   // 太慢：先降分辨率，这一步最便宜
      s = med > 45 ? 0.6 : Math.max(0.6, s - (med > 30 ? 0.2 : 0.1));
      gov.upWait = Math.min(20, Math.max(2, gov.upWait * 2));
      gov.good = 0;
    } else if (med > SLOW) {                       // 分辨率已经触底 → 砍特效
      gov.good = 0;
      gov.floorHits++;
      var next = degradeLevel + 1;
      // 4、5 级要重编译材质（几百毫秒卡顿）且画质代价大，
      // 必须「持续地、明显地慢」才动：连续 6 个窗口 + 中位数掉到 30fps 以下。
      // 偶发一下卡顿绝不该走到这里
      var needHits = next >= 4 ? 6 : 2;
      if (next >= 4 && med < 33) needHits = Infinity;
      if (gov.floorHits >= needHits) {
        gov.floorHits = 0;
        if ((gov.tries[next] || 0) >= 2) gov.lock = next;
        H.degrade(next);
      }
    } else if (med < GOOD) {
      gov.good++;
      // 恢复顺序：先抢回画质收益最大的（bloom / 光锥 / FXAA / 灯光），
      // 再把分辨率还回去，最后才补宽光晕、浮尘这类锦上添花的。
      // 反过来做的话，分辨率会把预算吃光，bloom 永远回不来 —— 这个场景的
      // 灯带和全息屏全靠 bloom 出效果，它比最后 20% 分辨率值钱得多
      var canUp = degradeLevel > gov.lock;
      if (canUp && (degradeLevel >= 3 || s >= 1)) {
        var need = degradeLevel >= 4 ? 5 : 3;
        // 已经被垂直同步顶住了，说明余量很大，不用再慢慢观察
        if (med <= 17.0) need = Math.max(2, need - 2);
        if (gov.good >= need) {
          gov.good = 0;
          gov.tries[degradeLevel] = (gov.tries[degradeLevel] || 0) + 1;
          H.degrade(degradeLevel - 1);
        }
      } else if (s < 1 && gov.upWait <= 0) {
        s = Math.min(1, s + 0.1);
        gov.upWait = 2;
        gov.good = 0;
      }
    } else {
      gov.good = 0;                                // 处在中间地带：保持现状
    }
    if (med < 20) gov.floorHits = 0;
    if (gov.upWait > 0) gov.upWait--;

    s = Math.round(s * 10) / 10;
    if (s !== dynScale) {
      dynScale = s;
      gov.settle = Math.max(gov.settle, 1);
      H.resize();
      H.emit('quality', s);
    }
  };

  /* ============================ 4. 后处理链 ============================ */
  var FS_FRAG_HEAD = 'varying vec2 vUv;';

  H.createPost = function (rd, sc, cam) {
    var fsGeo = new T.BufferGeometry();
    fsGeo.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    fsGeo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    var quad = new T.Mesh(fsGeo, null);
    quad.frustumCulled = false;
    var ortho = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    var halfOk = false;
    try {
      halfOk = !!(rd.extensions.has('EXT_color_buffer_float') ||
                  rd.extensions.has('EXT_color_buffer_half_float'));
    } catch (e) { halfOk = false; }
    var TYPE = halfOk ? T.HalfFloatType : T.UnsignedByteType;

    var optsA = { type: TYPE, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true, stencilBuffer: false };
    var optsB = { type: TYPE, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, stencilBuffer: false };

    var wide = QUALITY.bloom > 1;        // 是否启用第二级宽光晕
    var sharp = QUALITY.detail > 1;      // 锐化是全屏 4 次采样，只给高画质
    var blurIter = Math.max(1, QUALITY.blur || 2);
    var wideOn = wide, bloomOn = !!QUALITY.bloom, fxaaOn = !!QUALITY.fxaa;

    var rtScene = new T.WebGLRenderTarget(2, 2, optsA);
    var rtA = new T.WebGLRenderTarget(2, 2, optsB);        // 1/4：紧光晕
    var rtB = new T.WebGLRenderTarget(2, 2, optsB);
    // 1/8：宽光晕（灯带的大面积溢光）——用不到就别占显存
    var rtC = wide ? new T.WebGLRenderTarget(2, 2, optsB) : null;
    var rtD = wide ? new T.WebGLRenderTarget(2, 2, optsB) : null;
    // 色调映射之后的 LDR 缓冲，专门喂给 FXAA
    var rtLDR = QUALITY.fxaa ? new T.WebGLRenderTarget(2, 2, {
      type: T.UnsignedByteType, minFilter: T.LinearFilter, magFilter: T.LinearFilter,
      depthBuffer: false, stencilBuffer: false
    }) : null;

    var VS = FS_FRAG_HEAD + ' void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }';

    // 亮度提取：4 tap 盒式降采样，顺手压掉单像素高光的闪烁（firefly）
    var brightMat = new T.ShaderMaterial({
      uniforms: {
        tSrc: { value: null },
        uThresh: { value: halfOk ? 0.70 : 0.52 },
        uTexel: { value: new T.Vector2(1, 1) }
      },
      vertexShader: VS,
      fragmentShader: [
        FS_FRAG_HEAD,
        'uniform sampler2D tSrc; uniform float uThresh; uniform vec2 uTexel;',
        'vec3 samp(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }',
        'void main(){',
        '  vec3 c = (samp(vec2(-1.0,-1.0)) + samp(vec2(1.0,-1.0)) +',
        '            samp(vec2(-1.0, 1.0)) + samp(vec2(1.0, 1.0))) * 0.25;',
        '  float l = max(c.r, max(c.g, c.b));',
        '  float w = smoothstep(uThresh, uThresh * 2.1, l);',
        '  gl_FragColor = vec4(c * w, 1.0);',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });

    var blurMat = new T.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uDir: { value: new T.Vector2(1, 0) } },
      vertexShader: VS,
      fragmentShader: [
        FS_FRAG_HEAD,
        'uniform sampler2D tSrc; uniform vec2 uDir;',
        'void main(){',
        '  vec3 s = texture2D(tSrc, vUv).rgb * 0.2270270270;',
        '  s += texture2D(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;',
        '  s += texture2D(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;',
        '  s += texture2D(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;',
        '  s += texture2D(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;',
        '  gl_FragColor = vec4(s, 1.0);',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });

    var compMat = new T.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        tBloom2: { value: null },
        uBloom: { value: 0.42 },
        uWide: { value: 0.62 },
        uExposure: { value: 1.02 },
        uSharp: { value: 0.26 },
        uSat: { value: 1.14 },
        uRes: { value: new T.Vector2(2, 2) },
        uTexel: { value: new T.Vector2(1, 1) },
        uTime: { value: 0 },
        uTint: { value: new T.Color(1, 1, 1) }
      },
      vertexShader: VS,
      fragmentShader: [
        FS_FRAG_HEAD,
        'uniform sampler2D tScene, tBloom, tBloom2;',
        'uniform float uBloom, uWide, uExposure, uSharp, uSat, uTime;',
        'uniform vec2 uRes, uTexel;',
        'uniform vec3 uTint;',
        // ACES 近似拟合
        'vec3 aces(vec3 x){',
        '  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;',
        '  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);',
        '}',
        'vec3 toSRGB(vec3 c){',
        '  vec3 lo = c * 12.92;',
        '  vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(0.41666667)) - 0.055;',
        '  return mix(hi, lo, step(c, vec3(0.0031308)));',
        '}',
        'void main(){',
        '  vec2 uv = vUv;',
        '  vec2 q = uv - 0.5;',
        '  float r2 = dot(q, q);',
        // 横向色散：三个通道各自偏移，比整体偏移更像真镜头（只在画面外圈可见）
        '  vec2 ca = q * r2 * 0.0036;',
        '  vec3 col = vec3(',
        '    texture2D(tScene, uv + ca).r,',
        '    texture2D(tScene, uv).g,',
        '    texture2D(tScene, uv - ca).b);',
        sharp ? [
          // 轻度非锐化掩模：把动态分辨率缩放带来的糊边拉回来
          '  vec3 nb = texture2D(tScene, uv + vec2(uTexel.x, 0.0)).rgb',
          '          + texture2D(tScene, uv - vec2(uTexel.x, 0.0)).rgb',
          '          + texture2D(tScene, uv + vec2(0.0, uTexel.y)).rgb',
          '          + texture2D(tScene, uv - vec2(0.0, uTexel.y)).rgb;',
          '  col += (col - nb * 0.25) * uSharp;'
        ].join('\n') : '',
        '  vec3 glow = texture2D(tBloom, uv).rgb;',
        wide ? '  glow += texture2D(tBloom2, uv).rgb * uWide;' : '',
        '  col = max(col, vec3(0.0)) + glow * uBloom;',
        '  col *= uExposure * uTint;',
        '  col = aces(col);',
        // 分离色调：暗部压向青蓝、亮部推向暖白，营造科幻夜景的冷暖对比
        '  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));',
        '  col *= mix(vec3(0.80, 0.94, 1.14), vec3(1.07, 1.01, 0.93), smoothstep(0.06, 0.60, l));',
        '  col = clamp(mix(vec3(l), col, uSat), 0.0, 1.0);',
        // 暗角 + 外圈轻微失焦感
        '  col *= 1.0 - 0.40 * pow(clamp(length(q) * 1.36, 0.0, 1.0), 2.2);',
        '  float g = fract(sin(dot(uv * uRes + uTime * 61.7, vec2(12.9898, 78.233))) * 43758.5453);',
        '  col += (g - 0.5) * 0.009;',
        '  gl_FragColor = vec4(toSRGB(col), 1.0);',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });

    // FXAA（NVIDIA 3.11 精简版）：在 sRGB 空间做，边缘锯齿是「糙」的主要来源
    var fxaaMat = new T.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new T.Vector2(1, 1) } },
      vertexShader: VS,
      fragmentShader: [
        FS_FRAG_HEAD,
        'uniform sampler2D tSrc; uniform vec2 uTexel;',
        'const vec3 LUM = vec3(0.299, 0.587, 0.114);',
        'void main(){',
        '  vec3 rgbM  = texture2D(tSrc, vUv).rgb;',
        '  vec3 rgbNW = texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb;',
        '  vec3 rgbNE = texture2D(tSrc, vUv + vec2( 1.0, -1.0) * uTexel).rgb;',
        '  vec3 rgbSW = texture2D(tSrc, vUv + vec2(-1.0,  1.0) * uTexel).rgb;',
        '  vec3 rgbSE = texture2D(tSrc, vUv + vec2( 1.0,  1.0) * uTexel).rgb;',
        '  float lM = dot(rgbM, LUM);',
        '  float lNW = dot(rgbNW, LUM), lNE = dot(rgbNE, LUM);',
        '  float lSW = dot(rgbSW, LUM), lSE = dot(rgbSE, LUM);',
        '  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));',
        '  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));',
        '  if (lMax - lMin < lMax * 0.055 + 0.018) { gl_FragColor = vec4(rgbM, 1.0); return; }',
        '  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));',
        '  float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);',
        '  float rcpMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);',
        '  dir = clamp(dir * rcpMin, vec2(-8.0), vec2(8.0)) * uTexel;',
        '  vec3 rgbA = 0.5 * (texture2D(tSrc, vUv + dir * (1.0 / 3.0 - 0.5)).rgb',
        '                   + texture2D(tSrc, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);',
        '  vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tSrc, vUv - dir * 0.5).rgb',
        '                                 + texture2D(tSrc, vUv + dir * 0.5).rgb);',
        '  float lB = dot(rgbB, LUM);',
        '  gl_FragColor = vec4((lB < lMin || lB > lMax) ? rgbA : rgbB, 1.0);',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });

    function blit(mat, target) {
      quad.material = mat;
      rd.setRenderTarget(target);
      rd.render(quad, ortho);
    }

    function blurPair(src, tmp, spread) {
      blurMat.uniforms.tSrc.value = src.texture;
      blurMat.uniforms.uDir.value.set(spread / src.width, 0);
      blit(blurMat, tmp);
      blurMat.uniforms.tSrc.value = tmp.texture;
      blurMat.uniforms.uDir.value.set(0, spread / src.height);
      blit(blurMat, src);
    }

    var api = {
      uniforms: compMat.uniforms,
      setWide: function (on) {
        wideOn = wide && on !== false;
        compMat.uniforms.uWide.value = wideOn ? 0.62 : 0.0;
      },
      setBloom: function (on) {
        bloomOn = !!QUALITY.bloom && on !== false;
        compMat.uniforms.uBloom.value = bloomOn ? 0.42 : 0.0;
      },
      setFxaa: function (on) {
        fxaaOn = !!rtLDR && on !== false;
      },
      setSize: function (w, h) {
        w = Math.max(2, w); h = Math.max(2, h);
        rtScene.setSize(w, h);
        if (rtLDR) rtLDR.setSize(w, h);
        var bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
        rtA.setSize(bw, bh);
        rtB.setSize(bw, bh);
        if (rtC) rtC.setSize(Math.max(2, w >> 3), Math.max(2, h >> 3));
        if (rtD) rtD.setSize(Math.max(2, w >> 3), Math.max(2, h >> 3));
        compMat.uniforms.uRes.value.set(w, h);
        compMat.uniforms.uTexel.value.set(1 / w, 1 / h);
        fxaaMat.uniforms.uTexel.value.set(1 / w, 1 / h);
        brightMat.uniforms.uTexel.value.set(1 / w, 1 / h);
      },
      render: function (time) {
        compMat.uniforms.uTime.value = time;

        rd.setRenderTarget(rtScene);
        rd.clear();
        rd.render(sc, cam);

        if (bloomOn) {
          brightMat.uniforms.tSrc.value = rtScene.texture;
          blit(brightMat, rtA);
          for (var bi = 0; bi < blurIter; bi++) blurPair(rtA, rtB, 1.0);
          compMat.uniforms.tBloom.value = rtA.texture;

          if (wideOn) {
            // 1/8 分辨率再糊两轮：灯带、屏幕的大范围溢光
            blurMat.uniforms.tSrc.value = rtA.texture;
            blurMat.uniforms.uDir.value.set(1.0 / rtA.width, 0);
            blit(blurMat, rtC);
            blurPair(rtC, rtD, 1.4);
            compMat.uniforms.tBloom2.value = rtC.texture;
          }
        }

        compMat.uniforms.tScene.value = rtScene.texture;
        if (fxaaOn) {
          blit(compMat, rtLDR);
          fxaaMat.uniforms.tSrc.value = rtLDR.texture;
          blit(fxaaMat, null);
        } else {
          blit(compMat, null);
        }
      }
    };
    return api;
  };

  H.renderFrame = function (time) { if (post) post.render(time); };

  /* ============================ 5. 碰撞（圆柱 vs AABB） ============================ */
  var boxes = [];
  H.physics = {
    add: function (minX, minZ, maxX, maxZ, minY, maxY, tag) {
      var b = { minX: minX, minZ: minZ, maxX: maxX, maxZ: maxZ, minY: minY, maxY: maxY, tag: tag || '' };
      boxes.push(b);
      return b;
    },
    clear: function () { boxes.length = 0; },
    boxes: boxes,
    // 圆（半径 r）在 (x,z) 处被推出后的位置；y 范围用于判定是否需要碰撞（家具可跨过）
    resolve: function (x, z, r, y0, y1) {
      for (var pass = 0; pass < 2; pass++) {
        for (var i = 0; i < boxes.length; i++) {
          var b = boxes[i];
          if (b.maxY <= y0 || b.minY >= y1) continue;
          var cx = H.clamp(x, b.minX, b.maxX);
          var cz = H.clamp(z, b.minZ, b.maxZ);
          var dx = x - cx, dz = z - cz;
          var d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-7) {
            var d = Math.sqrt(d2);
            x = cx + dx / d * r;
            z = cz + dz / d * r;
          } else {
            // 圆心落在盒内：沿最近的边推出
            var l = x - b.minX, rt = b.maxX - x, t = z - b.minZ, bt = b.maxZ - z;
            var m = Math.min(l, rt, t, bt);
            if (m === l) x = b.minX - r;
            else if (m === rt) x = b.maxX + r;
            else if (m === t) z = b.minZ - r;
            else z = b.maxZ + r;
          }
        }
      }
      return { x: x, z: z };
    }
  };

  /* ============================ 6. 输入抽象 ============================ */
  var KEYS = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'up', KeyC: 'down'
  };

  H.Input = (function () {
    var held = {}, fresh = {};
    var look = { dx: 0, dy: 0 };
    var pointerLocked = false, dragging = false;
    var lastX = 0, lastY = 0;
    var canvas = null;
    var sens = 0.0022;

    // 触屏：左下虚拟摇杆（x 右 / y 前，长度 0~1）+ 画布拖拽转视角
    var stick = { x: 0, y: 0 };
    var touchId = null, touchX = 0, touchY = 0;
    var TOUCH_SENS = 0.0042;

    function onKey(e, down) {
      var a = KEYS[e.code];
      if (!a) return;
      if (down) { if (!held[a]) fresh[a] = true; held[a] = true; }
      else held[a] = false;
      if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    }

    function bind(cv) {
      canvas = cv;

      window.addEventListener('keydown', function (e) {
        if (e.metaKey || e.ctrlKey) return;         // 不干扰浏览器快捷键
        onKey(e, true);
        H.emit('key', e.code);
      });
      window.addEventListener('keyup', function (e) { onKey(e, false); });

      window.addEventListener('blur', function () { held = {}; });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) held = {};
      });

      canvas.addEventListener('click', function () {
        H.Audio.unlock();
        // 触屏没有指针锁，拖拽转视角就够了
        if (pointerLocked || touchId !== null) return;
        if (matchMedia('(hover: none) and (pointer: coarse)').matches) return;
        if (canvas.requestPointerLock) {
          try { canvas.requestPointerLock(); } catch (err) { /* 不支持则忽略 */ }
        }
      });

      document.addEventListener('pointerlockchange', function () {
        pointerLocked = document.pointerLockElement === canvas;
        H.emit('lock', pointerLocked);
      });

      document.addEventListener('mousemove', function (e) {
        if (pointerLocked) {
          look.dx += (e.movementX || 0) * sens;
          look.dy += (e.movementY || 0) * sens;
        } else if (dragging) {
          look.dx += (e.clientX - lastX) * sens * 0.85;
          look.dy += (e.clientY - lastY) * sens * 0.85;
          lastX = e.clientX; lastY = e.clientY;
        }
      });

      // 指针锁被拒时的拖拽回退
      canvas.addEventListener('pointerdown', function (e) {
        H.Audio.unlock();
        if (pointerLocked) return;
        if (e.pointerType === 'touch') {
          if (touchId !== null) return;
          touchId = e.pointerId;
          touchX = e.clientX; touchY = e.clientY;
          try { canvas.setPointerCapture(e.pointerId); } catch (err2) { /* 忽略 */ }
        } else {
          dragging = true; lastX = e.clientX; lastY = e.clientY;
        }
      });

      // 触屏转视角：pointermove 才会在触摸时触发（mousemove 不会）
      canvas.addEventListener('pointermove', function (e) {
        if (pointerLocked || dragging) return;
        if (e.pointerType !== 'touch' || e.pointerId !== touchId) return;
        look.dx += (e.clientX - touchX) * TOUCH_SENS;
        look.dy += (e.clientY - touchY) * TOUCH_SENS;
        touchX = e.clientX; touchY = e.clientY;
      }, { passive: true });

      function endTouch(e) {
        if (e.pointerId === touchId) touchId = null;
      }
      canvas.addEventListener('pointerup', endTouch);
      canvas.addEventListener('pointercancel', endTouch);
      window.addEventListener('pointerup', function (e) {
        dragging = false;
        endTouch(e);
      });
    }

    var lastMag = 0;

    return {
      bind: bind,
      down: function (a) { return !!held[a]; },
      pressed: function (a) { return !!fresh[a]; },
      look: look,
      endFrame: function () { fresh = {}; look.dx = 0; look.dy = 0; },
      // 虚拟摇杆：x 右正、y 前正，模长 > 1 时归一化（超出半径视为推满）
      setStick: function (x, y) {
        if (!isFinite(x) || !isFinite(y)) { stick.x = stick.y = 0; return; }
        stick.x = H.clamp(x, -1, 1);
        stick.y = H.clamp(y, -1, 1);
      },
      stickActive: function () { return stick.x !== 0 || stick.y !== 0; },
      moveAxis: function () {
        var x = stick.x, y = stick.y;
        if (held.forward) y += 1;
        if (held.back) y -= 1;
        if (held.right) x += 1;
        if (held.left) x -= 1;
        var len = Math.sqrt(x * x + y * y);
        lastMag = Math.min(1, len);
        if (len > 1) { x /= len; y /= len; }
        return { x: x, y: y };
      },
      // 本帧输入的力度（0~1）：键盘推满为 1，摇杆可半推
      mag: function () { return lastMag; },
      isLocked: function () { return pointerLocked; },
      exitLock: function () { if (document.exitPointerLock) document.exitPointerLock(); },
      release: function () { held = {}; stick.x = stick.y = 0; }
    };
  })();

  /* ============================ 7. 程序化贴图 ============================ */
  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h || w;
    return c;
  }

  function finishTex(canvas, rx, ry, srgb) {
    var t = new T.CanvasTexture(canvas);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = H.maxAniso || 4;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.magFilter = T.LinearFilter;
    t.generateMipmaps = true;
    if (srgb !== false) t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  var S = Math.max(256, Math.min(QUALITY.tex, 1024));

  /* ---- 噪声工具：低分辨率可平铺噪声 + drawImage 拉伸，比逐像素 fbm 快很多 ---- */
  function noiseCanvas(res, period, oct) {
    var c = makeCanvas(res), g = c.getContext('2d');
    var img = g.createImageData(res, res), d = img.data;
    for (var y = 0; y < res; y++) {
      for (var x = 0; x < res; x++) {
        var v = Math.round(H.clamp(H.pfbm(x / res, y / res, period, oct || 4), 0, 1) * 255);
        var i = (y * res + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function overlayNoise(g, size, res, period, mode, alpha, filter) {
    var n = noiseCanvas(res, period, 4);
    g.save();
    g.globalCompositeOperation = mode || 'soft-light';
    g.globalAlpha = alpha === undefined ? 0.4 : alpha;
    if (filter) { try { g.filter = filter; } catch (e) {} }
    g.drawImage(n, 0, 0, size, size);
    g.restore();
  }

  // 细颗粒：逐像素操作比画几千个矩形快
  function grain(g, size, amount) {
    var img = g.getImageData(0, 0, size, size), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() - 0.5) * amount;
      d[i] = H.clamp(d[i] + n, 0, 255);
      d[i + 1] = H.clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = H.clamp(d[i + 2] + n, 0, 255);
    }
    g.putImageData(img, 0, 0);
  }

  // 凹缝：暗槽 + 一侧亮边，模拟倒角，远看就是一条有体积的分缝
  function seam(g, x0, y0, x1, y1, w, dark, lite) {
    g.lineCap = 'butt';
    g.strokeStyle = dark || 'rgba(26,32,42,0.62)';
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    var nx = (y1 - y0) === 0 ? 0 : 1, ny = (x1 - x0) === 0 ? 0 : 1;
    g.strokeStyle = lite || 'rgba(238,248,255,0.22)';
    g.lineWidth = Math.max(1, w * 0.45);
    g.beginPath();
    g.moveTo(x0 + nx * w * 0.8, y0 + ny * w * 0.8);
    g.lineTo(x1 + nx * w * 0.8, y1 + ny * w * 0.8);
    g.stroke();
  }

  /* ---- 抛光微晶石：低对比云斑 + 晶点 + 2×2 分缝（纹理必须克制，否则像迷彩） ---- */
  function texMarble() {
    var c = makeCanvas(S), g = c.getContext('2d');
    g.fillStyle = '#cbd2db';
    g.fillRect(0, 0, S, S);
    overlayNoise(g, S, 64, 5, 'soft-light', 0.30);
    overlayNoise(g, S, 128, 16, 'soft-light', 0.26);
    for (var i = 0; i < 3000; i++) {
      var x = Math.random() * S, y = Math.random() * S, r = H.rand(0.4, 1.8);
      var v = H.rand(0.78, 1.08);
      g.fillStyle = 'rgba(' + Math.round(203 * v) + ',' + Math.round(210 * v) + ',' + Math.round(220 * v) + ',0.30)';
      g.beginPath(); g.arc(x, y, r, 0, H.TAU); g.fill();
    }
    var w = Math.max(1.5, S / 300);
    [0, S * 0.5, S].forEach(function (p) {
      seam(g, p, 0, p, S, w, 'rgba(126,136,150,0.58)', 'rgba(252,255,255,0.26)');
      seam(g, 0, p, S, p, w, 'rgba(126,136,150,0.58)', 'rgba(252,255,255,0.26)');
    });
    grain(g, S, 9);
    return finishTex(c, 1, 1);
  }

  /* ---- 烟熏木地板：长条 + 倒角缝 ---- */
  function texWood() {
    var c = makeCanvas(S), g = c.getContext('2d');
    var planks = 5, ph = S / planks;
    for (var p = 0; p < planks; p++) {
      var b = H.rand(0.82, 1.14);
      g.fillStyle = 'rgb(' + Math.round(74 * b) + ',' + Math.round(54 * b) + ',' + Math.round(40 * b) + ')';
      g.fillRect(0, p * ph, S, ph);
      for (var i = 0; i < 64; i++) {
        var y = p * ph + Math.random() * ph;
        var amp = H.rand(-ph * 0.14, ph * 0.14);
        g.strokeStyle = 'rgba(' + (Math.random() < 0.72 ? '28,19,13' : '148,116,84') + ',' + H.rand(0.04, 0.20).toFixed(3) + ')';
        g.lineWidth = H.rand(0.5, 1.8);
        g.beginPath();
        g.moveTo(0, y);
        // 两端 y 相同，保证左右无缝
        g.bezierCurveTo(S * 0.33, y + amp, S * 0.66, y - amp, S, y);
        g.stroke();
      }
    }
    overlayNoise(g, S, 96, 12, 'overlay', 0.26);
    var w = Math.max(1.5, S / 320);
    for (var k = 0; k <= planks; k++) {
      seam(g, 0, k * ph, S, k * ph, w, 'rgba(18,12,8,0.80)', 'rgba(255,224,182,0.14)');
    }
    grain(g, S, 12);
    return finishTex(c, 1, 1);
  }

  /* ---- 复合墙板：竖向渐变 + 水泥云斑 + 2×2 板缝 + 板内暗角 ---- */
  function texWall() {
    var c = makeCanvas(S), g = c.getContext('2d');
    var bg = g.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#aeb8c6');
    bg.addColorStop(0.55, '#c2cad5');
    bg.addColorStop(1, '#a7b1be');
    g.fillStyle = bg;
    g.fillRect(0, 0, S, S);
    overlayNoise(g, S, 64, 4, 'soft-light', 0.70);
    overlayNoise(g, S, 128, 18, 'overlay', 0.20);
    // 每块板四边压暗，大墙面才有「板」的体积
    var half = S * 0.5;
    for (var py = 0; py < 2; py++) {
      for (var px = 0; px < 2; px++) {
        var rg = g.createRadialGradient(px * half + half * 0.5, py * half + half * 0.5, half * 0.18,
                                        px * half + half * 0.5, py * half + half * 0.5, half * 0.78);
        rg.addColorStop(0, 'rgba(255,255,255,0.05)');
        rg.addColorStop(1, 'rgba(40,48,60,0.16)');
        g.fillStyle = rg;
        g.fillRect(px * half, py * half, half, half);
      }
    }
    var w = Math.max(1.6, S / 280);
    [0, half, S].forEach(function (p) {
      seam(g, p, 0, p, S, w);
      seam(g, 0, p, S, p, w);
    });
    grain(g, S, 9);
    return finishTex(c, 1, 1);
  }

  /* ---- 深色微水泥：暗部墙地通用 ---- */
  function texConcrete() {
    var c = makeCanvas(S), g = c.getContext('2d');
    g.fillStyle = '#39414f';
    g.fillRect(0, 0, S, S);
    overlayNoise(g, S, 64, 3, 'soft-light', 0.90);
    overlayNoise(g, S, 128, 14, 'overlay', 0.24);
    for (var i = 0; i < 700; i++) {
      var x = Math.random() * S, y = Math.random() * S;
      g.fillStyle = 'rgba(16,20,26,' + H.rand(0.04, 0.14).toFixed(3) + ')';
      g.beginPath(); g.arc(x, y, H.rand(0.6, 2.6), 0, H.TAU); g.fill();
    }
    grain(g, S, 11);
    return finishTex(c, 1, 1);
  }

  /* ---- 拉丝金属 ---- */
  function texBrushed() {
    var R = Math.min(S, 512);
    var c = makeCanvas(R), g = c.getContext('2d');
    g.fillStyle = '#8f99a6';
    g.fillRect(0, 0, R, R);
    for (var i = 0; i < R * 3; i++) {
      var y = Math.random() * R;
      g.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '58,66,78') + ',' + H.rand(0.02, 0.10).toFixed(3) + ')';
      g.lineWidth = H.rand(0.4, 1.4);
      g.beginPath(); g.moveTo(0, y); g.lineTo(R, y); g.stroke();
    }
    overlayNoise(g, R, 64, 22, 'overlay', 0.16);
    return finishTex(c, 1, 1);
  }

  /* ---- 天花微穿孔吸音板 ---- */
  function texCeil() {
    var R = Math.min(S, 512);
    var c = makeCanvas(R), g = c.getContext('2d');
    g.fillStyle = '#b6bec9';
    g.fillRect(0, 0, R, R);
    overlayNoise(g, R, 48, 4, 'soft-light', 0.55);
    var step = R / 24;
    for (var y = 0; y < 24; y++) {
      for (var x = 0; x < 24; x++) {
        g.fillStyle = 'rgba(68,76,88,' + H.rand(0.22, 0.34).toFixed(3) + ')';
        g.beginPath();
        g.arc((x + 0.5) * step, (y + 0.5) * step, step * 0.14, 0, H.TAU);
        g.fill();
      }
    }
    var w = Math.max(1.4, R / 260);
    [0, R * 0.5, R].forEach(function (p) {
      seam(g, p, 0, p, R, w, 'rgba(60,68,80,0.55)', 'rgba(255,255,255,0.18)');
      seam(g, 0, p, R, p, w, 'rgba(60,68,80,0.55)', 'rgba(255,255,255,0.18)');
    });
    grain(g, R, 8);
    return finishTex(c, 1, 1);
  }

  /* ---- 斜纹织物 ---- */
  function texFabric() {
    var R = 256, c = makeCanvas(R), g = c.getContext('2d');
    g.fillStyle = '#434a55';
    g.fillRect(0, 0, R, R);
    g.lineWidth = 1.2;
    for (var k = -R; k < R * 2; k += 4) {
      g.strokeStyle = 'rgba(255,255,255,0.055)';
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k + R, R); g.stroke();
      g.strokeStyle = 'rgba(14,18,24,0.10)';
      g.beginPath(); g.moveTo(k + 2, 0); g.lineTo(k + 2 + R, R); g.stroke();
    }
    overlayNoise(g, R, 64, 20, 'overlay', 0.30);
    grain(g, R, 14);
    return finishTex(c, 1, 1);
  }

  /* ---- 地毯：短绒 + 发光等高纹 ---- */
  function texRug() {
    var R = 512, c = makeCanvas(R), g = c.getContext('2d');
    g.fillStyle = '#1d212a';
    g.fillRect(0, 0, R, R);
    overlayNoise(g, R, 128, 26, 'overlay', 0.40);
    g.lineWidth = 2;
    for (var i = 0; i < 10; i++) {
      g.strokeStyle = 'rgba(126,196,236,' + (0.06 + i * 0.016).toFixed(3) + ')';
      g.strokeRect(18 + i * 11, 18 + i * 11, R - 36 - i * 22, R - 36 - i * 22);
    }
    g.strokeStyle = 'rgba(126,196,236,0.07)';
    g.lineWidth = 1;
    for (var k = 0; k <= 8; k++) {
      g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64, R); g.stroke();
      g.beginPath(); g.moveTo(0, k * 64); g.lineTo(R, k * 64); g.stroke();
    }
    // 绒毛方向感
    for (var j = 0; j < 6000; j++) {
      var x = Math.random() * R, y = Math.random() * R;
      g.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '210,226,240' : '8,10,14') + ',' + H.rand(0.02, 0.07).toFixed(3) + ')';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + H.rand(-2, 2), y + H.rand(1.5, 4)); g.stroke();
    }
    return finishTex(c, 1, 1);
  }

  /* ---- 由颜色贴图派生凹凸 / 粗糙度贴图 ---- */
  H.lumaMap = function (srcCanvas, rx, ry, opt) {
    opt = opt || {};
    var res = Math.min(opt.res || 512, srcCanvas.width);
    var c = makeCanvas(res), g = c.getContext('2d');
    g.drawImage(srcCanvas, 0, 0, res, res);
    var img = g.getImageData(0, 0, res, res), d = img.data;
    var k = opt.contrast === undefined ? 1 : opt.contrast;
    var bias = opt.bias || 0;
    for (var i = 0; i < d.length; i += 4) {
      var l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      if (opt.invert) l = 1 - l;
      l = (l - 0.5) * k + 0.5 + bias;
      var v = Math.round(H.clamp(l, 0, 1) * 255);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    g.putImageData(img, 0, 0);
    return finishTex(c, rx, ry, false);
  };

  // 圆形点精灵（Points 默认是方块，需要贴一张径向渐变）
  var spriteTex = null;
  H.pointSprite = function () {
    if (spriteTex) return spriteTex;
    var c = makeCanvas(64), g = c.getContext('2d');
    var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.62)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    spriteTex = new T.CanvasTexture(c);
    return spriteTex;
  };

  H.tex = {
    marble: texMarble,
    wood: texWood,
    wall: texWall,
    concrete: texConcrete,
    brushed: texBrushed,
    ceil: texCeil,
    fabric: texFabric,
    rug: texRug,
    noise: noiseCanvas,
    canvas: makeCanvas,
    finish: finishTex
  };

  /* ---- 动态「大屏」内容：时间 / 天气 / 家庭状态 ---- */
  H.createScreenCanvas = function (w, h) {
    var c = makeCanvas(w || 1024, h || 576);
    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.minFilter = T.LinearFilter;
    return { canvas: c, ctx: c.getContext('2d'), texture: tex };
  };

  /* ============================ 8. 程序化音频 ============================ */
  H.Audio = (function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    var ctx = null, master = null, wet = null, noiseBuf = null;
    var rainGain = null, rainSrc = null, humGain = null, humOsc = null, humOsc2 = null;
    var enabled = true, ready = false;

    function makeNoise(seconds) {
      var len = Math.floor(ctx.sampleRate * seconds);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    function makeIR(seconds, decay) {
      var len = Math.floor(ctx.sampleRate * seconds);
      var buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch);
        for (var i = 0; i < len; i++) {
          var t = i / len;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 80 ? i / 80 : 1);
        }
      }
      return buf;
    }

    function init() {
      if (ctx || !AC) return ctx;
      try {
        // 混响脉冲（1.9s 立体声）+ 2s 噪声底 ≈ 50 万个采样点，全在主线程上现算。
        // 它发生在「第一次点击」那一刻，正好是玩家开始走动的时候 —— 不打招呼的话，
        // 测速器会把这一下算成「场景跑不动」
        H.stall(1.5);
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.85;
        master.connect(ctx.destination);

        var conv = ctx.createConvolver();
        conv.buffer = makeIR(1.9, 3.0);
        wet = ctx.createGain();
        wet.gain.value = 0.32;                 // 室内混响，克制
        wet.connect(conv);
        conv.connect(master);

        noiseBuf = makeNoise(2.0);
        ready = true;
      } catch (e) { ctx = null; }
      return ctx;
    }

    function unlock() {
      if (!enabled) return;
      init();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    function out(gain) {
      var g = ctx.createGain();
      g.gain.value = gain;
      g.connect(master);
      g.connect(wet);
      return g;
    }

    // 脚步：短促的低通噪声
    function step(strength) {
      if (!ready || !enabled || ctx.state !== 'running') return;
      var t = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.playbackRate.value = H.rand(0.9, 1.25);

      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = H.rand(420, 780);
      bp.Q.value = 1.1;

      var g = out((strength || 1) * 0.10);
      g.gain.setValueAtTime((strength || 1) * 0.10, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

      src.connect(bp); bp.connect(g);
      src.start(t); src.stop(t + 0.16);
    }

    // 自动门：气动滑轨声（噪声扫频）+ 轻金属咔哒
    function door(open) {
      if (!ready || !enabled || ctx.state !== 'running') return;
      var t = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.playbackRate.value = 1;

      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(open ? 520 : 900, t);
      bp.frequency.exponentialRampToValueAtTime(open ? 1500 : 420, t + 0.55);

      var g = out(0.16);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);

      src.connect(bp); bp.connect(g);
      src.start(t); src.stop(t + 0.66);

      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1500, t + 0.5);
      osc.frequency.exponentialRampToValueAtTime(700, t + 0.58);
      var og = out(0.07);
      og.gain.setValueAtTime(0.0001, t + 0.5);
      og.gain.exponentialRampToValueAtTime(0.07, t + 0.51);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.68);
      osc.connect(og);
      osc.start(t + 0.5); osc.stop(t + 0.7);
    }

    // 交互反馈音
    function click(freq) {
      if (!ready || !enabled || ctx.state !== 'running') return;
      var t = ctx.currentTime;
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq || 880, t);
      osc.frequency.exponentialRampToValueAtTime((freq || 880) * 1.5, t + 0.09);
      var g = out(0.09);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(g);
      osc.start(t); osc.stop(t + 0.18);
    }

    // 雨声：常驻循环，用增益淡入淡出
    function setRain(on, level) {
      if (!ready || !enabled) return;
      if (on && !rainSrc) {
        // 4 秒循环雨声 = 十几万个采样点，在主线程上现算，是一次实打实的掉帧
        H.stall(1);
        rainSrc = ctx.createBufferSource();
        rainSrc.buffer = makeNoise(4);
        rainSrc.loop = true;
        var hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 700;
        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 5200;
        rainGain = ctx.createGain();
        rainGain.gain.value = 0.0001;
        rainSrc.connect(hp); hp.connect(lp); lp.connect(rainGain);
        rainGain.connect(master);
        rainSrc.start();
      }
      if (rainGain) {
        var target = on ? (level || 0.12) : 0.0001;
        rainGain.gain.setTargetAtTime(target, ctx.currentTime, 0.6);
      }
    }

    // 全息台低频嗡鸣
    function setHum(on, level) {
      if (!ready || !enabled) return;
      if (on && !humOsc) {
        humOsc = ctx.createOscillator();
        humOsc.type = 'sine';
        humOsc.frequency.value = 58;
        humOsc2 = ctx.createOscillator();
        humOsc2.type = 'sine';
        humOsc2.frequency.value = 87;
        humGain = ctx.createGain();
        humGain.gain.value = 0.0001;
        humOsc.connect(humGain); humOsc2.connect(humGain);
        humGain.connect(master);
        humOsc.start(); humOsc2.start();
      }
      if (humGain) {
        var tgt = on ? (level || 0.02) : 0.0001;
        humGain.gain.setTargetAtTime(tgt, ctx.currentTime, 0.35);
      }
    }

    return {
      unlock: unlock,
      step: step,
      door: door,
      click: click,
      setRain: setRain,
      setHum: setHum,
      isReady: function () { return ready; },
      state: function () { return ctx ? ctx.state : 'none'; },
      setEnabled: function (on) {
        enabled = on;
        if (master) master.gain.setTargetAtTime(on ? 0.85 : 0.0001, ctx.currentTime, 0.2);
      },
      isEnabled: function () { return enabled; }
    };
  })();
})(window.HOME);
