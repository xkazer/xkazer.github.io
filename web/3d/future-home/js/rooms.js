/* =========================================================================
 * future-home · rooms.js
 * 客厅（大屏 / 沙发）/ 全息游戏房 / 360° 影院 / 可调场景卧室 / 家务机器人
 * 交互统一登记到 H.interactables，由 main.js 处理 E 键
 * ========================================================================= */
(function (H) {
  'use strict';

  var T = window.THREE;
  var mats = null;

  H.rooms = {};
  H.interactables = [];

  function addInteract(x, z, radius, label, action) {
    var it = { x: x, z: z, r: radius, label: label, action: action };
    H.interactables.push(it);
    return it;
  }

  /* =======================================================================
   *  客厅：5.4m 大屏 + 沙发 + 茶几 + 地毯 + 餐区 + 半开放厨房
   * ===================================================================== */
  H.buildLiving = function () {
    mats = H.mats;
    var L = H.LAYOUT;
    var scene = H.scene;

    // ---- 大屏（北墙，朝 +z）----
    var sc = H.createScreenCanvas(1024, 512);
    var screenMat = new T.MeshBasicMaterial({ map: sc.texture });
    var panel = new T.Mesh(new T.PlaneGeometry(5.4, 2.7), screenMat);
    panel.position.set(4.4, 1.72, L.z0 + 0.13);
    scene.add(panel);
    // 屏幕金属边框
    scene.add(H.box(5.6, 0.06, 0.1, mats.darkMetal, 4.4, 3.09, L.z0 + 0.14));
    scene.add(H.box(5.6, 0.06, 0.1, mats.darkMetal, 4.4, 0.35, L.z0 + 0.14));
    scene.add(H.box(0.06, 2.8, 0.1, mats.darkMetal, 1.68, 1.72, L.z0 + 0.14));
    scene.add(H.box(0.06, 2.8, 0.1, mats.darkMetal, 7.12, 1.72, L.z0 + 0.14));

    // ---- 媒体柜 ----
    var console_ = H.box(5.4, 0.34, 0.5, mats.wood, 4.4, 0.17, L.z0 + 0.45);
    scene.add(console_);
    scene.add(H.glowStrip(5.2, 0.02, 0.06, 4.4, 0.34, L.z0 + 0.68, mats.strip));
    H.physics.add(1.7, L.z0 + 0.2, 7.1, L.z0 + 0.72, 0, 0.34, 'console');

    // ---- 地毯 ----
    var rug = new T.Mesh(new T.PlaneGeometry(7.6, 6.4), mats.rug);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(4.4, 0.008, -4.9);
    rug.receiveShadow = true;
    scene.add(rug);

    // ---- 沙发（面向大屏，-z）----
    var sofa = new T.Group();
    function sbox(w, h, d, x, y, z, mat) {
      var m = H.box(w, h, d, mat || mats.fabric, x, y, z);
      sofa.add(m);
      return m;
    }
    sbox(3.8, 0.34, 1.05, 0, 0.19, 0);              // 底座
    sbox(3.8, 0.62, 0.2, 0, 0.62, -0.44);           // 靠背
    sbox(0.2, 0.52, 1.05, -1.8, 0.4, 0);            // 左扶手
    sbox(0.2, 0.52, 1.05, 1.8, 0.4, 0);             // 右扶手
    for (var i = -1; i <= 1; i++) sbox(1.16, 0.16, 0.86, i * 1.2, 0.43, 0.02);  // 坐垫
    for (var j = -1; j <= 1; j++) sbox(1.1, 0.34, 0.16, j * 1.2, 0.7, -0.36);   // 靠垫
    // 沙发朝 -z，正对大屏（靠背在 +z 侧）
    sofa.position.set(4.4, 0, -4.0);
    sofa.rotation.y = Math.PI;
    scene.add(sofa);
    H.physics.add(2.4, -4.62, 6.4, -3.4, 0, 0.9, 'sofa');
    H.shadowBlob(4.4, -4.0, 2.2, 0.85, 0.5);

    // ---- 茶几 ----
    var table = new T.Group();
    table.add(H.box(2.4, 0.08, 1.1, mats.glass, 0, 0.36, 0));
    table.add(H.box(2.2, 0.3, 0.9, mats.darkMetal, 0, 0.15, 0));
    table.position.set(4.4, 0, -5.75);
    scene.add(table);
    H.physics.add(3.2, -6.3, 5.6, -5.2, 0, 0.4, 'table');
    H.shadowBlob(4.4, -5.75, 1.4, 0.78, 0.42);

    // 茶几上的一盏小灯
    var lampBase = H.box(0.12, 0.18, 0.12, mats.metal, 5.15, 0.49, -5.95);
    scene.add(lampBase);
    var lampBulb = new T.Mesh(new T.SphereGeometry(0.07, 12, 10), new T.MeshBasicMaterial({ color: 0xffe2b8 }));
    lampBulb.position.set(5.15, 0.63, -5.95);
    scene.add(lampBulb);

    // ---- 茶几上的果盘 / 水果 / 水杯 / 遥控器 ----
    var ceramic = new T.MeshStandardMaterial({ color: 0x2f3742, roughness: 0.42, metalness: 0.12 });
    var glassMat = new T.MeshStandardMaterial({
      color: 0xcfeaff, transparent: true, opacity: 0.34, roughness: 0.05, metalness: 0.2
    });

    // 果盘
    var bowl = new T.Mesh(new T.CylinderGeometry(0.19, 0.13, 0.065, 22), ceramic);
    bowl.position.set(3.95, 0.435, -5.78);
    bowl.castShadow = true;
    scene.add(bowl);

    // 水果
    var fruits = [
      { c: 0xd8552f, r: 0.052, x: 3.87, z: -5.83, y: 0.475 },   // 橙
      { c: 0xc23a3a, r: 0.05, x: 4.01, z: -5.86, y: 0.47 },     // 苹果
      { c: 0x9fbf4a, r: 0.046, x: 3.99, z: -5.72, y: 0.468 },   // 青柠
      { c: 0xe0b84a, r: 0.044, x: 3.88, z: -5.72, y: 0.462 }    // 柠檬
    ];
    fruits.forEach(function (f) {
      var m = new T.Mesh(new T.SphereGeometry(f.r, 14, 10),
        new T.MeshStandardMaterial({ color: f.c, roughness: 0.72, metalness: 0.02 }));
      m.position.set(f.x, f.y, f.z);
      m.castShadow = true;
      scene.add(m);
    });
    // 盘里再压一个顶果，做出堆叠感
    var topFruit = new T.Mesh(new T.SphereGeometry(0.048, 14, 10),
      new T.MeshStandardMaterial({ color: 0xcf5a2e, roughness: 0.72 }));
    topFruit.position.set(3.94, 0.515, -5.78);
    scene.add(topFruit);

    // 水杯（含半杯水）
    var cup = new T.Mesh(new T.CylinderGeometry(0.042, 0.036, 0.115, 18, 1, true), glassMat);
    cup.position.set(4.72, 0.457, -5.62);
    scene.add(cup);
    var water = new T.Mesh(new T.CylinderGeometry(0.036, 0.033, 0.07, 16),
      new T.MeshStandardMaterial({ color: 0x9fd8f0, transparent: true, opacity: 0.45, roughness: 0.1 }));
    water.position.set(4.72, 0.435, -5.62);
    scene.add(water);
    var cupBase = new T.Mesh(new T.CircleGeometry(0.037, 16), glassMat);
    cupBase.rotation.x = -Math.PI / 2;
    cupBase.position.set(4.72, 0.401, -5.62);
    scene.add(cupBase);

    // 水壶
    var jug = new T.Mesh(new T.CylinderGeometry(0.055, 0.075, 0.22, 18), glassMat);
    jug.position.set(4.98, 0.51, -5.86);
    scene.add(jug);
    var jugWater = new T.Mesh(new T.CylinderGeometry(0.05, 0.068, 0.13, 16),
      new T.MeshStandardMaterial({ color: 0x8ecfe8, transparent: true, opacity: 0.5, roughness: 0.1 }));
    jugWater.position.set(4.98, 0.47, -5.86);
    scene.add(jugWater);
    var jugHandle = new T.Mesh(new T.TorusGeometry(0.055, 0.011, 8, 16, Math.PI), glassMat);
    jugHandle.position.set(5.05, 0.55, -5.86);
    jugHandle.rotation.z = -0.4;
    scene.add(jugHandle);

    // 遥控器 + 纸巾盒
    scene.add(H.box(0.07, 0.022, 0.19, mats.darkMetal, 4.35, 0.411, -5.55));
    scene.add(H.box(0.16, 0.06, 0.11,
      new T.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 0.85 }), 4.96, 0.43, -5.5));

    // ---- 落地灯 ----
    var pole = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.85, 10), mats.metal);
    pole.position.set(8.2, 0.92, -6.6);
    scene.add(pole);
    var shade = new T.Mesh(new T.CylinderGeometry(0.24, 0.3, 0.26, 14, 1, true),
      new T.MeshBasicMaterial({ color: 0xffd7a8, side: T.DoubleSide }));
    shade.position.set(8.2, 1.9, -6.6);
    scene.add(shade);
    H.physics.add(8.05, -6.75, 8.35, -6.45, 0, 1.9, 'lamp');
    H.shadowBlob(8.2, -6.6, 0.4, 0.4, 0.4);

    /* ---- 餐区：餐桌 + 四把餐椅 + 长条吊灯 ---- */
    var stoneMat = new T.MeshStandardMaterial({ color: 0xc7cfda, roughness: 0.3, metalness: 0.12 });
    var cabinetMat = new T.MeshStandardMaterial({ color: 0x3b4650, roughness: 0.62, metalness: 0.18 });
    var warmStripMat = new T.MeshBasicMaterial({ color: 0xffd9a4 });
    var lampPanelMat = new T.MeshBasicMaterial({ color: 0xfff2dd });

    var dining = new T.Group();
    dining.add(H.box(1.9, 0.07, 1.0, stoneMat, 0, 0.735, 0));       // 桌面
    dining.add(H.box(1.72, 0.1, 0.82, mats.darkMetal, 0, 0.66, 0)); // 桌裙
    [[-0.85, -0.4], [0.85, -0.4], [-0.85, 0.4], [0.85, 0.4]].forEach(function (p) {
      dining.add(H.box(0.075, 0.7, 0.075, mats.darkMetal, p[0], 0.35, p[1]));
    });
    dining.position.set(5.2, 0, 5.4);
    scene.add(dining);
    H.physics.add(4.2, 4.45, 6.2, 6.35, 0, 0.8, 'dining');
    H.shadowBlob(5.2, 5.4, 1.35, 0.85, 0.45);

    // 餐椅（靠背在本地 -z，朝桌子）
    function chair(x, z, ry) {
      var c = new T.Group();
      c.add(H.box(0.46, 0.07, 0.46, mats.fabric, 0, 0.45, 0));
      c.add(H.box(0.44, 0.5, 0.07, mats.fabric, 0, 0.7, -0.2));
      [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(function (p) {
        c.add(H.box(0.045, 0.43, 0.045, mats.darkMetal, p[0], 0.215, p[1]));
      });
      c.position.set(x, 0, z);
      c.rotation.y = ry;
      scene.add(c);
    }
    chair(4.68, 4.75, 0);
    chair(5.72, 4.75, 0);
    chair(4.68, 6.05, Math.PI);
    chair(5.72, 6.05, Math.PI);

    // 餐桌吊灯（线性 + 两根吊杆）
    var pendY = 2.0;
    scene.add(H.box(1.2, 0.1, 0.16, mats.darkMetal, 5.2, pendY, 5.4));
    scene.add(H.glowStrip(1.1, 0.012, 0.1, 5.2, pendY - 0.056, 5.4, warmStripMat));
    scene.add(H.box(0.014, L.h - pendY - 0.06, 0.014, mats.darkMetal, 4.86, (L.h + pendY) / 2, 5.4));
    scene.add(H.box(0.014, L.h - pendY - 0.06, 0.014, mats.darkMetal, 5.54, (L.h + pendY) / 2, 5.4));

    // 桌面陈设：花瓶 + 两个餐盘 + 两只杯子
    var vase = new T.Mesh(new T.CylinderGeometry(0.055, 0.042, 0.2, 16), ceramic);
    vase.position.set(5.2, 0.87, 5.4);
    scene.add(vase);
    for (var v = 0; v < 3; v++) {
      var a = v * H.TAU / 3 + 0.4;
      var stem = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.24, 6),
        new T.MeshStandardMaterial({ color: 0x3d6b4a, roughness: 0.9 }));
      stem.position.set(5.2 + Math.cos(a) * 0.03, 1.06, 5.4 + Math.sin(a) * 0.03);
      stem.rotation.z = Math.cos(a) * 0.28;
      stem.rotation.x = -Math.sin(a) * 0.28;
      scene.add(stem);
      var bloom = new T.Mesh(new T.SphereGeometry(0.035, 10, 8),
        new T.MeshStandardMaterial({ color: v === 1 ? 0xf0b45e : 0xe8788c, roughness: 0.75 }));
      bloom.position.set(5.2 + Math.cos(a) * 0.07, 1.17, 5.4 + Math.sin(a) * 0.07);
      scene.add(bloom);
    }
    [[4.72, 5.12], [5.68, 5.68]].forEach(function (p) {
      var plate = new T.Mesh(new T.CylinderGeometry(0.135, 0.115, 0.016, 22),
        new T.MeshStandardMaterial({ color: 0xeef1f6, roughness: 0.35, metalness: 0.05 }));
      plate.position.set(p[0], 0.778, p[1]);
      scene.add(plate);
      var gcup = new T.Mesh(new T.CylinderGeometry(0.04, 0.034, 0.11, 16), glassMat);
      gcup.position.set(p[0] + 0.22, 0.825, p[1] + 0.2);
      scene.add(gcup);
    });

    /* ---- 半开放厨房（东南角，矮吧台隔断）---- */
    var KX0 = 9.3, KX1 = 13.86, KZ0 = 3.12, KZ1 = 7.86;

    // 厨房地面（浅灰石材分区，比客厅稍暗但不会发黑）
    var kTileTex = H.tex.marble();
    kTileTex.repeat.set(4, 4);
    var kTileMat = new T.MeshStandardMaterial({
      map: kTileTex, color: 0x7a838f, roughness: 0.38, metalness: 0.14
    });
    var kFloor = new T.Mesh(new T.PlaneGeometry(KX1 - KX0, KZ1 - KZ0), kTileMat);
    kFloor.rotation.x = -Math.PI / 2;
    kFloor.position.set((KX0 + KX1) / 2, 0.013, (KZ0 + KZ1) / 2);
    kFloor.receiveShadow = true;
    scene.add(kFloor);

    // 天花：两盏厨房灯盘 + 分区金属线
    [4.5, 6.6].forEach(function (lz) {
      scene.add(H.box(1.4, 0.04, 1.4, mats.darkMetal, 11.55, L.h - 0.05, lz));
      scene.add(H.box(1.26, 0.018, 1.26, lampPanelMat, 11.55, L.h - 0.072, lz));
    });
    scene.add(H.box(KX1 - KX0, 0.08, 0.1, mats.darkMetal, (KX0 + KX1) / 2, L.h - 0.06, KZ0));

    // 吧台：矮柜 + 悬挑石台面 + 柜底灯带
    var barX0 = 10.56, barX1 = 13.86, barZ = 3.4;
    scene.add(H.box(barX1 - barX0, 0.98, 0.55, cabinetMat, (barX0 + barX1) / 2, 0.49, barZ));
    scene.add(H.box(barX1 - barX0 + 0.18, 0.055, 0.78, stoneMat, (barX0 + barX1) / 2, 1.0, barZ - 0.05));
    scene.add(H.glowStrip(barX1 - barX0 - 0.24, 0.02, 0.03,
      (barX0 + barX1) / 2, 0.955, barZ - 0.3, warmStripMat));
    H.physics.add(barX0, barZ - 0.44, barX1, barZ + 0.34, 0, 1.05, 'bar');

    // 吧凳（四腿高脚凳，坐面朝吧台）
    var stoolMat = new T.MeshStandardMaterial({ color: 0x8d6446, roughness: 0.68, metalness: 0.05 });
    function stool(x, z) {
      var s = new T.Group();
      var seat = new T.Mesh(new T.CylinderGeometry(0.185, 0.185, 0.065, 20), stoolMat);
      seat.position.y = 0.655;
      s.add(seat);
      var frame = new T.Mesh(new T.CylinderGeometry(0.195, 0.185, 0.03, 20), mats.darkMetal);
      frame.position.y = 0.61;
      s.add(frame);
      [-0.13, 0.13].forEach(function (lx) {
        [-0.13, 0.13].forEach(function (lz) {
          s.add(H.box(0.03, 0.6, 0.03, mats.darkMetal, lx, 0.3, lz));
        });
      });
      var ring = new T.Mesh(new T.TorusGeometry(0.155, 0.012, 8, 24), mats.metal);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.2;
      s.add(ring);
      s.position.set(x, 0, z);
      scene.add(s);
      H.physics.add(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 0, 0.7, 'stool');
      H.shadowBlob(x, z, 0.28, 0.28, 0.35);
    }
    stool(11.5, 2.62);
    stool(12.9, 2.62);

    // 南墙地柜 + 台面
    var ctrZ = 7.55;
    scene.add(H.box(3.4, 0.86, 0.62, cabinetMat, 12.16, 0.43, ctrZ));
    scene.add(H.box(3.44, 0.05, 0.66, stoneMat, 12.16, 0.885, ctrZ));
    scene.add(H.box(3.2, 0.018, 0.02, mats.metal, 12.16, 0.78, ctrZ - 0.315));
    H.physics.add(10.46, ctrZ - 0.33, 13.86, ctrZ + 0.33, 0, 0.91, 'counter');

    // 灶台 + 两个灶眼
    var cookX = 11.05;
    scene.add(H.box(0.92, 0.02, 0.44, mats.black, cookX, 0.918, 7.53));
    [-0.22, 0.22].forEach(function (dx) {
      var ring = new T.Mesh(new T.TorusGeometry(0.1, 0.011, 8, 24),
        new T.MeshBasicMaterial({ color: 0xff7a3c }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cookX + dx, 0.932, 7.53);
      scene.add(ring);
    });
    // 锅
    var pan = new T.Mesh(new T.CylinderGeometry(0.15, 0.13, 0.1, 20), mats.darkMetal);
    pan.position.set(cookX + 0.22, 0.985, 7.53);
    scene.add(pan);
    scene.add(H.box(0.26, 0.022, 0.04, mats.darkMetal, cookX + 0.22, 1.0, 7.32));

    // 油烟机
    scene.add(H.box(0.86, 0.07, 0.5, mats.metal, cookX, 1.52, 7.6));
    scene.add(H.box(0.34, 0.52, 0.34, mats.metal, cookX, 1.81, 7.72));
    scene.add(H.glowStrip(0.7, 0.012, 0.03, cookX, 1.48, 7.36, warmStripMat));

    // 南墙吊柜（避开烟机）+ 柜下灯带
    scene.add(H.box(1.62, 0.7, 0.34, cabinetMat, 12.9, 1.85, 7.69));
    scene.add(H.glowStrip(1.5, 0.012, 0.03, 12.9, 1.51, 7.51, warmStripMat));
    scene.add(H.box(1.5, 0.018, 0.02, mats.metal, 12.9, 1.6, 7.51));

    // 东墙地柜 + 台面 + 水槽 + 龙头
    var eastZc = 5.63;
    scene.add(H.box(0.62, 0.86, 3.26, cabinetMat, 13.54, 0.43, eastZc));
    scene.add(H.box(0.66, 0.05, 3.3, stoneMat, 13.54, 0.885, eastZc));
    scene.add(H.box(0.018, 0.018, 3.1, mats.metal, 13.24, 0.78, eastZc));
    H.physics.add(13.21, 4.0, 13.86, 7.26, 0, 0.91, 'counter');

    var sinkZ = 6.35;
    scene.add(H.box(0.48, 0.018, 0.58, new T.MeshStandardMaterial(
      { color: 0x4b545f, roughness: 0.28, metalness: 0.8 }), 13.54, 0.916, sinkZ));
    scene.add(H.box(0.05, 0.24, 0.05, mats.metal, 13.78, 1.01, sinkZ));
    scene.add(H.box(0.22, 0.045, 0.045, mats.metal, 13.67, 1.115, sinkZ));

    // 东墙吊柜
    scene.add(H.box(0.34, 0.7, 1.1, cabinetMat, 13.71, 1.85, 4.85));
    scene.add(H.box(0.02, 0.018, 0.98, mats.metal, 13.53, 1.6, 4.85));
    scene.add(H.glowStrip(0.03, 0.012, 0.98, 13.52, 1.49, 4.85, warmStripMat));

    // 台面小物：砧板 / 瓶罐
    scene.add(H.box(0.34, 0.026, 0.5, mats.wood, 13.5, 0.923, 5.2));
    [[12.35, 0x89b0c9], [12.55, 0xd9e2ea], [12.75, 0xc9a06a]].forEach(function (b) {
      var jar = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.19, 12),
        new T.MeshStandardMaterial({ color: b[1], roughness: 0.5, metalness: 0.15 }));
      jar.position.set(b[0], 1.005, 7.6);
      scene.add(jar);
    });

    // 冰箱（南墙西端，门朝厨房）
    var fridgeMat = new T.MeshStandardMaterial({ color: 0xc3ccd6, roughness: 0.42, metalness: 0.35 });
    var fx = 9.95, fz = 7.5;
    scene.add(H.box(0.78, 1.86, 0.7, fridgeMat, fx, 0.95, fz));
    scene.add(H.box(0.74, 0.06, 0.66, mats.black, fx, 0.03, fz));
    scene.add(H.box(0.02, 1.76, 0.02, mats.darkMetal, fx, 0.97, fz - 0.355));
    scene.add(H.box(0.02, 0.7, 0.045, mats.darkMetal, fx + 0.07, 1.02, fz - 0.37));
    scene.add(H.box(0.02, 0.7, 0.045, mats.darkMetal, fx - 0.07, 1.02, fz - 0.37));
    // 门上的智能面板（与把手错开，避免连成十字）
    scene.add(H.box(0.44, 0.18, 0.012, mats.black, fx, 1.7, fz - 0.352));
    scene.add(H.glowStrip(0.3, 0.012, 0.004, fx, 1.7, fz - 0.358, mats.strip));
    H.physics.add(fx - 0.4, fz - 0.36, fx + 0.4, KZ1 + 0.01, 0, 1.9, 'fridge');
    H.shadowBlob(fx, fz - 0.1, 0.55, 0.5, 0.45);

    var acc = 0;

    function drawScreen(time) {
      var g = sc.ctx, w = sc.canvas.width, h = sc.canvas.height;
      var d = new Date();
      var hh = ('0' + d.getHours()).slice(-2);
      var mm = ('0' + d.getMinutes()).slice(-2);

      var bg = g.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#071018');
      bg.addColorStop(0.55, '#0a1a2a');
      bg.addColorStop(1, '#07131f');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);

      // 顶部状态条
      g.fillStyle = 'rgba(120,200,255,0.10)';
      g.fillRect(0, 0, w, 54);
      g.fillStyle = 'rgba(160,225,255,0.85)';
      g.font = '600 22px "PingFang SC", system-ui, sans-serif';
      g.fillText('HOME OS · 家庭中枢', 28, 36);

      // 大时间
      g.fillStyle = '#ffffff';
      g.font = '700 132px "PingFang SC", system-ui, sans-serif';
      g.fillText(hh + ':' + mm, 28, 190);
      // 日期/天气靠右，避让大时间
      var wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
      g.fillStyle = 'rgba(150,210,245,0.7)';
      g.font = '400 24px "PingFang SC", system-ui, sans-serif';
      g.textAlign = 'right';
      g.fillText((d.getMonth() + 1) + '月' + d.getDate() + '日 ' + wd +
        ' · 室外 18℃ 晴 · 湿度 52%', w - 28, 168);
      g.textAlign = 'left';

      // 三块卡片
      var cards = [
        ['室温', '23.5 ℃', '#6fe3c0'],
        ['空气', 'PM2.5 8', '#8fd0ff'],
        ['能耗', '-12% 今日', '#ffd08a']
      ];
      for (var i = 0; i < 3; i++) {
        var cx = 28 + i * 320, cy = 236;
        g.fillStyle = 'rgba(255,255,255,0.045)';
        g.fillRect(cx, cy, 300, 118);
        g.strokeStyle = 'rgba(140,210,255,0.18)';
        g.lineWidth = 1.5;
        g.strokeRect(cx, cy, 300, 118);
        g.fillStyle = 'rgba(160,215,245,0.6)';
        g.font = '400 20px "PingFang SC", system-ui, sans-serif';
        g.fillText(cards[i][0], cx + 20, cy + 34);
        g.fillStyle = cards[i][2];
        g.font = '700 38px "PingFang SC", system-ui, sans-serif';
        g.fillText(cards[i][1], cx + 20, cy + 84);
      }

      // 底部波形（能耗 / 声音）
      g.strokeStyle = 'rgba(111,227,192,0.75)';
      g.lineWidth = 2.5;
      g.beginPath();
      for (var x = 0; x <= w - 56; x += 4) {
        var y = 420 + Math.sin(x * 0.021 + time * 1.7) * 12 +
                Math.sin(x * 0.063 + time * 0.9) * 6 +
                H.vnoise(x * 0.05, time * 0.6) * 10;
        if (x === 0) g.moveTo(28 + x, y); else g.lineTo(28 + x, y);
      }
      g.stroke();

      g.fillStyle = 'rgba(140,200,235,0.45)';
      g.font = '400 18px "PingFang SC", system-ui, sans-serif';
      g.fillText('语音助手 · 待机中', 28, 486);

      sc.texture.needsUpdate = true;
    }

    drawScreen(0);

    return {
      update: function (dt, time) {
        acc += dt;
        if (acc > 0.4) { acc = 0; drawScreen(time); }
      },
      screen: sc
    };
  };

  /* =======================================================================
   *  全息游戏房：两张并排电竞躺椅 + 悬浮全息主屏 + 墙面比分条
   * ===================================================================== */
  H.buildArcade = function () {
    mats = H.mats;
    var scene = H.scene;

    var SX = -9.3, SZ = -5.25;        // 两张椅子的中心
    var POD_GAP = 0.62;               // 两椅在 z 方向各偏一半
    var SCREEN_X = -12.35;            // 悬浮全息屏

    var ACCENT = [0x6ff0ff, 0xc79bff];   // 玩家一 / 玩家二

    /* ---- 材质 ---- */
    var shellMat = new T.MeshStandardMaterial({ color: 0x99a3b1, roughness: 0.55, metalness: 0.28 });
    var baseMat = new T.MeshStandardMaterial({ color: 0x1b2029, roughness: 0.45, metalness: 0.6 });
    var padMat = new T.MeshStandardMaterial({ color: 0x4d5763, roughness: 0.92, metalness: 0.04 });
    var padMat2 = new T.MeshStandardMaterial({ color: 0x3b434f, roughness: 0.86, metalness: 0.1 });
    var trimMat = new T.MeshStandardMaterial({ color: 0x7d8794, roughness: 0.3, metalness: 0.9 });

    /* ---- 一把电竞躺椅（本地 +z 朝前，正对幕墙）---- */
    function buildPod(accent) {
      var g = new T.Group();
      var glowMat = new T.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.55 });

      // 椭圆底盘 + 底盘光环
      var base = new T.Mesh(new T.CylinderGeometry(0.44, 0.48, 0.07, 30), baseMat);
      base.scale.z = 1.36;
      base.position.y = 0.035;
      base.castShadow = true;
      base.receiveShadow = true;
      g.add(base);

      var baseRing = new T.Mesh(new T.RingGeometry(0.395, 0.455, 30), glowMat);
      baseRing.rotation.x = -Math.PI / 2;
      baseRing.scale.y = 1.36;
      baseRing.position.y = 0.073;
      g.add(baseRing);

      // 立柱
      var post = new T.Mesh(new T.CylinderGeometry(0.085, 0.105, 0.31, 16), trimMat);
      post.position.y = 0.215;
      post.castShadow = true;
      g.add(post);

      // 座框（浅色外壳）+ 坐垫
      g.add(H.box(0.62, 0.11, 0.64, shellMat, 0, 0.395, 0.02));
      g.add(H.box(0.66, 0.12, 0.70, padMat, 0, 0.495, 0.02));
      // 座垫两侧的浅色包边
      g.add(H.box(0.035, 0.13, 0.72, shellMat, -0.345, 0.495, 0.02));
      g.add(H.box(0.035, 0.13, 0.72, shellMat, 0.345, 0.495, 0.02));

      // 腿托（向前伸出，略上扬）
      var legG = new T.Group();
      legG.position.set(0, 0.455, 0.32);
      legG.rotation.x = -0.10;   // 脚尖略抬高，与坐垫齐平
      g.add(legG);
      legG.add(H.box(0.58, 0.10, 0.60, shellMat, 0, -0.005, 0.30));
      legG.add(H.box(0.52, 0.11, 0.54, padMat, 0, 0.045, 0.30));
      legG.add(H.glowStrip(0.012, 0.012, 0.56, -0.295, 0.0, 0.30, glowMat));
      legG.add(H.glowStrip(0.012, 0.012, 0.56, 0.295, 0.0, 0.30, glowMat));

      // 靠背（后仰 33°，入座后再多倒一点）
      var back = new T.Group();
      back.position.set(0, 0.52, -0.30);
      back.rotation.x = -0.58;
      g.add(back);
      back.add(H.box(0.70, 0.94, 0.11, shellMat, 0, 0.45, -0.02));  // 靠背外壳
      back.add(H.box(0.62, 0.84, 0.10, padMat, 0, 0.45, 0.055));    // 软垫
      back.add(H.box(0.70, 0.34, 0.16, padMat2, 0, 0.17, 0.05));    // 腰托
      back.add(H.box(0.09, 0.82, 0.19, shellMat, -0.315, 0.44, 0.01)); // 侧翼
      back.add(H.box(0.09, 0.82, 0.19, shellMat, 0.315, 0.44, 0.01));
      back.add(H.box(0.40, 0.21, 0.15, padMat2, 0, 0.895, 0.05));   // 头枕
      back.add(H.glowStrip(0.010, 0.60, 0.010, -0.365, 0.44, 0.10, glowMat));
      back.add(H.glowStrip(0.010, 0.60, 0.010, 0.365, 0.44, 0.10, glowMat));
      // 椅背外侧轮廓：从入口（背面）看过去也能读出椅形
      back.add(H.glowStrip(0.010, 0.70, 0.010, -0.315, 0.46, -0.078, glowMat));
      back.add(H.glowStrip(0.010, 0.70, 0.010, 0.315, 0.46, -0.078, glowMat));
      back.add(H.glowStrip(0.63, 0.010, 0.010, 0, 0.885, -0.078, glowMat));
      // 背壳中缝，避免整块黑板
      back.add(H.box(0.055, 0.80, 0.02, padMat2, 0, 0.44, -0.082));

      // 扶手 + 摇杆手柄
      for (var s = -1; s <= 1; s += 2) {
        g.add(H.box(0.09, 0.055, 0.50, padMat2, s * 0.40, 0.655, 0.06));
        g.add(H.box(0.05, 0.16, 0.05, shellMat, s * 0.40, 0.575, 0.26));
        g.add(H.glowStrip(0.075, 0.007, 0.42, s * 0.40, 0.685, 0.06, glowMat));
        var socket = new T.Mesh(new T.CylinderGeometry(0.030, 0.038, 0.05, 12), shellMat);
        socket.position.set(s * 0.40, 0.712, 0.245);
        g.add(socket);
        var knob = new T.Mesh(new T.SphereGeometry(0.030, 12, 10), glowMat);
        knob.position.set(s * 0.40, 0.748, 0.245);
        g.add(knob);
      }

      return { group: g, back: back, legG: legG, glowMat: glowMat, ring: baseRing, seat: 0 };
    }

    var pods = [];

    // 地毯：把两张椅子圈成一块"游戏区"
    var PAD_X = SX - 0.22, PAD_Z = SZ;
    var padTex = H.tex.fabric();
    padTex.repeat.set(3, 2);
    var pad = H.box(3.9, 0.03, 2.85, new T.MeshStandardMaterial({
      map: padTex, color: 0x232a34, roughness: 0.98, metalness: 0.0
    }), PAD_X, 0.015, PAD_Z);
    pad.castShadow = false;
    scene.add(pad);
    var padGlowMat = new T.MeshBasicMaterial({ color: 0x4fd4ff, transparent: true, opacity: 0.5 });
    scene.add(H.glowStrip(3.9, 0.012, 0.03, PAD_X, 0.032, PAD_Z - 1.425, padGlowMat));
    scene.add(H.glowStrip(3.9, 0.012, 0.03, PAD_X, 0.032, PAD_Z + 1.425, padGlowMat));
    scene.add(H.glowStrip(0.03, 0.012, 2.85, PAD_X - 1.95, 0.032, PAD_Z, padGlowMat));
    scene.add(H.glowStrip(0.03, 0.012, 2.85, PAD_X + 1.95, 0.032, PAD_Z, padGlowMat));

    for (var pi = 0; pi < 2; pi++) {
      var pz = SZ + (pi === 0 ? -POD_GAP : POD_GAP);
      var p = buildPod(ACCENT[pi]);
      p.group.position.set(SX, 0, pz);
      p.group.rotation.y = -Math.PI / 2;      // 本地 +z → 世界 -x，正对幕墙
      scene.add(p.group);
      // 腿托伸向 -x，所以碰撞盒在 x 上更靠西
      H.physics.add(SX - 1.02, pz - 0.50, SX + 0.46, pz + 0.50, 0, 1.05, 'pod' + pi);
      var sb = H.shadowBlob(SX - 0.20, pz, 0.62, 0.52, 0.5);
      sb.position.y = 0.036;
      pods.push(p);
    }

    // 座位区中性补光：蓝调环境里给浅色外壳补一点灰白，避免整把椅子糊成黑块
    if (H.QUALITY.name !== 'low') {
      var podLight = new T.PointLight(0xffeede, 1.5, 4.6, 2.0);
      podLight.position.set(SX - 0.35, 2.45, SZ);
      scene.add(podLight);
    }

    /* ---- 走道灯带：把入口到游戏区的动线拉出来 ---- */
    var pathGlow = new T.MeshBasicMaterial({ color: 0x2f8ea1, transparent: true, opacity: 0.55 });
    for (var wi = 0; wi < 2; wi++) {
      var wz = SZ + (wi === 0 ? -1.62 : 1.62);
      scene.add(H.glowStrip(5.4, 0.010, 0.035, -5.0, 0.010, wz, pathGlow));
    }

    /* ---- 北墙装备台：两台头显 + 手柄 ---- */
    var GEAR_Z = -7.66;
    scene.add(H.box(2.5, 0.70, 0.52, padMat2, -9.5, 0.35, GEAR_Z));
    scene.add(H.box(2.58, 0.05, 0.58, trimMat, -9.5, 0.725, GEAR_Z));
    H.physics.add(-10.79, GEAR_Z - 0.29, -8.21, GEAR_Z + 0.29, 0, 0.75, 'gear');
    H.shadowBlob(-9.5, GEAR_Z, 1.3, 0.36, 0.45);
    for (var hi = 0; hi < 2; hi++) {
      var hx = -9.5 + (hi === 0 ? -0.62 : 0.62);
      var hAccent = new T.MeshBasicMaterial({ color: ACCENT[hi] });
      scene.add(H.box(0.28, 0.12, 0.17, padMat2, hx, 0.81, GEAR_Z + 0.02));   // 头显
      scene.add(H.box(0.05, 0.09, 0.05, trimMat, hx, 0.77, GEAR_Z + 0.02));   // 支架
      scene.add(H.glowStrip(0.22, 0.012, 0.012, hx, 0.81, GEAR_Z + 0.108, hAccent));
    }
    scene.add(H.glowStrip(2.2, 0.014, 0.014, -9.5, 0.60, GEAR_Z + 0.27, pathGlow));

    /* ---- 悬浮全息主屏 ---- */
    var scr = H.createScreenCanvas(1024, 576);
    var holoMat = new T.MeshBasicMaterial({
      map: scr.texture, transparent: true, opacity: 0.9, side: T.DoubleSide
    });
    var holo = new T.Mesh(new T.PlaneGeometry(3.2, 1.8), holoMat);
    holo.position.set(SCREEN_X, 1.48, SZ);
    holo.rotation.y = Math.PI / 2;
    scene.add(holo);

    // 屏幕后的柔光
    var halo = new T.Mesh(new T.PlaneGeometry(5.0, 3.2),
      new T.MeshBasicMaterial({
        map: H.pointSprite(), color: 0x2f8ea1, transparent: true, opacity: 0.42,
        blending: T.AdditiveBlending, depthWrite: false
      }));
    halo.position.set(SCREEN_X - 0.03, 1.48, SZ);
    halo.rotation.y = Math.PI / 2;
    scene.add(halo);

    // 全息边框（四根发光条）
    var frameMat = new T.MeshBasicMaterial({ color: 0x9ff2ff, transparent: true, opacity: 0.8 });
    var FW = 3.28, FH = 1.88;
    scene.add(H.glowStrip(0.02, 0.014, FW, SCREEN_X, 1.48 + FH / 2, SZ, frameMat));
    scene.add(H.glowStrip(0.02, 0.014, FW, SCREEN_X, 1.48 - FH / 2, SZ, frameMat));
    scene.add(H.glowStrip(0.02, FH, 0.014, SCREEN_X, 1.48, SZ - FW / 2, frameMat));
    scene.add(H.glowStrip(0.02, FH, 0.014, SCREEN_X, 1.48, SZ + FW / 2, frameMat));

    /* ---- 墙面比分条 ---- */
    var bscr = H.createScreenCanvas(1024, 168);
    var board = new T.Mesh(new T.PlaneGeometry(3.05, 0.50),
      new T.MeshBasicMaterial({ map: bscr.texture, transparent: true, opacity: 0.95, side: T.DoubleSide }));
    board.position.set(SCREEN_X, 2.70, SZ);
    board.rotation.y = Math.PI / 2;
    scene.add(board);
    // 比分条细边框
    var bFrame = new T.MeshBasicMaterial({ color: 0x9ff2ff, transparent: true, opacity: 0.55 });
    scene.add(H.glowStrip(0.02, 0.010, 3.10, SCREEN_X, 2.945, SZ, bFrame));
    scene.add(H.glowStrip(0.02, 0.010, 3.10, SCREEN_X, 2.444, SZ, bFrame));

    /* ---- 主屏画面：驾驶舱视角 + HUD ---- */
    var GAME_NAMES = ['星际竞速', '战术沙盘', '光轨对战'];
    var gameIdx = 0;

    function drawHolo(t) {
      var g = scr.ctx, w = scr.canvas.width, h = scr.canvas.height;
      var hz = h * 0.56, cx = w / 2;

      // 天空
      var sky = g.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0, '#07202e');
      sky.addColorStop(0.55, '#17546c');
      sky.addColorStop(1, '#39869b');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, hz);

      // 远山
      g.fillStyle = 'rgba(10,34,46,0.9)';
      g.beginPath();
      g.moveTo(0, hz);
      for (var i = 0; i <= 24; i++) {
        g.lineTo(i / 24 * w, hz - 24 - Math.sin(i * 1.6) * 20 - Math.cos(i * 0.53) * 15);
      }
      g.lineTo(w, hz);
      g.closePath();
      g.fill();

      // 地面
      g.fillStyle = '#08151d';
      g.fillRect(0, hz, w, h - hz);

      // 赛道
      g.fillStyle = '#1d2c36';
      g.beginPath();
      g.moveTo(cx - 44, hz);
      g.lineTo(cx + 44, hz);
      g.lineTo(w * 1.25, h);
      g.lineTo(-w * 0.25, h);
      g.closePath();
      g.fill();

      g.strokeStyle = 'rgba(150,240,255,0.5)';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx - 44, hz); g.lineTo(-w * 0.25, h); g.stroke();
      g.beginPath(); g.moveTo(cx + 44, hz); g.lineTo(w * 1.25, h); g.stroke();

      // 中线虚线（随速度滚动）
      g.fillStyle = 'rgba(210,240,255,0.7)';
      for (var k = 0; k < 10; k++) {
        var ph = (k / 10 + (t * 0.42) % 0.1) % 1;
        var ph2 = Math.min(1, ph + 0.028);
        var y0 = hz + Math.pow(ph, 2.5) * (h - hz);
        var y1 = hz + Math.pow(ph2, 2.5) * (h - hz);
        var s0 = (y0 - hz) / (h - hz), s1 = (y1 - hz) / (h - hz);
        g.beginPath();
        g.moveTo(cx - 3 - s0 * 20, y0);
        g.lineTo(cx + 3 + s0 * 20, y0);
        g.lineTo(cx + 3 + s1 * 20, y1);
        g.lineTo(cx - 3 - s1 * 20, y1);
        g.closePath();
        g.fill();
      }

      // 路边的光柱
      g.fillStyle = 'rgba(111,240,255,0.5)';
      for (var m = 0; m < 7; m++) {
        var pm = (m / 7 + (t * 0.42) % 0.145) % 1;
        var ym = hz + Math.pow(pm, 2.5) * (h - hz);
        var sm = (ym - hz) / (h - hz);
        var bw = 2 + sm * 7;
        g.fillRect(cx - 60 - sm * 300 - bw / 2, ym, bw, bw * 3.4);
        g.fillRect(cx + 60 + sm * 300 - bw / 2, ym, bw, bw * 3.4);
      }

      // 车头（驾驶舱视角）
      g.fillStyle = '#0b1116';
      g.beginPath();
      g.moveTo(w * 0.30, h);
      g.lineTo(w * 0.40, h * 0.80);
      g.lineTo(w * 0.60, h * 0.80);
      g.lineTo(w * 0.70, h);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(111,240,255,0.75)';
      g.lineWidth = 2;
      g.stroke();

      // HUD 左上：小地图
      var mx = 92, my = 84, mr = 46;
      g.fillStyle = 'rgba(4,14,20,0.55)';
      g.beginPath(); g.arc(mx, my, mr, 0, H.TAU); g.fill();
      g.strokeStyle = 'rgba(111,240,255,0.75)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(mx, my, mr, 0, H.TAU); g.stroke();
      g.strokeStyle = 'rgba(111,240,255,0.28)';
      g.lineWidth = 1;
      g.beginPath(); g.arc(mx, my, mr * 0.62, 0, H.TAU); g.stroke();
      var ang = t * 0.6;
      g.save();
      g.translate(mx, my);
      g.rotate(ang);
      g.fillStyle = 'rgba(255,190,120,0.95)';
      g.beginPath();
      g.moveTo(0, -12); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9);
      g.closePath();
      g.fill();
      g.restore();

      // HUD 右上：时间 / 名次
      g.textAlign = 'right';
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.font = '700 34px monospace';
      g.fillText('02:' + ('0' + (Math.floor(t) % 60)).slice(-2), w - 40, 66);
      g.fillStyle = 'rgba(111,240,255,0.85)';
      g.font = '600 20px "PingFang SC", system-ui, sans-serif';
      g.fillText('第 1 名 · 双人对战', w - 40, 96);
      g.textAlign = 'left';

      // HUD 左下：速度
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.font = '700 46px monospace';
      g.fillText(String(268 + Math.floor(Math.sin(t * 0.9) * 12)), 40, h - 56);
      g.fillStyle = 'rgba(111,240,255,0.7)';
      g.font = '600 18px monospace';
      g.fillText('KM/H', 40, h - 30);

      // HUD 底部中央：推进能量
      var bw2 = 300, bx = cx - bw2 / 2, by = h - 44;
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(bx, by, bw2, 12);
      g.fillStyle = 'rgba(111,240,255,0.9)';
      g.fillRect(bx, by, bw2 * (0.45 + 0.35 * Math.sin(t * 1.3)), 12);
      g.strokeStyle = 'rgba(111,240,255,0.5)';
      g.lineWidth = 1;
      g.strokeRect(bx, by, bw2, 12);

      // 顶部标题
      g.fillStyle = 'rgba(9,20,28,0.72)';
      g.fillRect(0, 0, w, 42);
      g.fillStyle = 'rgba(160,235,255,0.9)';
      g.font = '700 22px "PingFang SC", system-ui, sans-serif';
      g.fillText(GAME_NAMES[gameIdx] + ' · 全息竞技场', 20, 29);

      scr.texture.needsUpdate = true;
    }

    /* ---- 墙面比分条 ---- */
    function drawBoard(t) {
      var g = bscr.ctx, w = bscr.canvas.width, h = bscr.canvas.height;
      g.fillStyle = '#04090e';
      g.fillRect(0, 0, w, h);

      g.strokeStyle = 'rgba(111,240,255,0.28)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(w / 2, 18); g.lineTo(w / 2, h - 18); g.stroke();

      var s = [128 + Math.floor(t * 3) % 40, 126 + Math.floor(t * 2.4 + 5) % 44];

      g.textAlign = 'left';
      g.fillStyle = 'rgba(111,240,255,0.95)';
      g.font = '700 26px "PingFang SC", system-ui, sans-serif';
      g.fillText('玩家一 · P1', 36, 46);
      g.font = '700 64px monospace';
      g.fillText(String(s[0]), 36, 118);
      g.fillStyle = 'rgba(200,230,240,0.6)';
      g.font = '500 20px "PingFang SC", system-ui, sans-serif';
      g.fillText('能量 86% · 连胜 3', 196, 116);

      g.fillStyle = 'rgba(199,155,255,0.95)';
      g.font = '700 26px "PingFang SC", system-ui, sans-serif';
      g.fillText('玩家二 · P2', w / 2 + 36, 46);
      g.font = '700 64px monospace';
      g.fillText(String(s[1]), w / 2 + 36, 118);
      g.fillStyle = 'rgba(200,230,240,0.6)';
      g.font = '500 20px "PingFang SC", system-ui, sans-serif';
      g.fillText('能量 74% · 连胜 2', w / 2 + 196, 116);

      g.textAlign = 'center';
      g.fillStyle = 'rgba(255,255,255,0.34)';
      g.font = '600 15px monospace';
      g.fillText('ROUND ' + (1 + Math.floor(t / 24) % 5), w / 2, h - 16);
      g.textAlign = 'left';

      bscr.texture.needsUpdate = true;
    }

    /* ---- 入座 / 离开 ---- */
    var seated = false;
    var seatT = 0;

    var seatIt = addInteract(SX - 1.25, SZ, 1.75, '电竞舱 · 双人入座', function () {
      seated = !seated;
      seatIt.label = seated ? '电竞舱 · 离开' : '电竞舱 · 双人入座';
      H.Audio.click(seated ? 720 : 520);
      H.Audio.setHum(seated, 0.016);
    });

    addInteract(-9.5, GEAR_Z + 0.62, 1.45, '装备台 · 切换对局', function () {
      gameIdx = (gameIdx + 1) % GAME_NAMES.length;
      H.Audio.click(1180);
    });

    drawHolo(0);
    drawBoard(0);

    var active = false, acc = 0;

    return {
      update: function (dt, time) {
        seatT = H.damp(seatT, seated ? 1 : 0, 4, dt);

        for (var i = 0; i < pods.length; i++) {
          var p = pods[i];
          p.glowMat.opacity = 0.45 + seatT * 0.5 + Math.sin(time * 2.4 + i) * 0.05;
          p.back.rotation.x = -0.58 - seatT * 0.13;          // 入座后更躺
          p.legG.scale.z = 1 + seatT * 0.24;                 // 腿托向前展开（近端不脱开坐垫）
          p.legG.rotation.x = -0.10 - seatT * 0.06;
          p.ring.material.opacity = 0.35 + seatT * 0.55 + Math.sin(time * 1.8 + i) * 0.06;
        }

        // 全息屏轻微浮动 + 亮度呼吸
        holo.position.y = 1.48 + Math.sin(time * 0.9) * 0.012;
        holoMat.opacity = (active ? 0.94 : 0.82) + Math.sin(time * 3.1) * 0.02;
        halo.material.opacity = (active ? 0.5 : 0.34) + Math.sin(time * 1.6) * 0.05;
        frameMat.opacity = 0.7 + Math.sin(time * 1.5) * 0.12;

        acc += dt;
        if (acc > 0.1) {
          acc = 0;
          drawHolo(time);
          drawBoard(time);
        }
      },
      setActive: function (on) {
        if (active === on) return;
        active = on;
        holoMat.opacity = on ? 0.94 : 0.82;
      }
    };
  };

  /* =======================================================================
   *  360° 私人影院：一体式椭圆环幕（墙 + 天花连续曲面）
   * ===================================================================== */
  H.buildCinema = function () {
    mats = H.mats;
    var scene = H.scene;
    var CX = -7.6, CZ = 5.5;
    var RX = 3.6, RZ = 2.3;       // 环幕椭圆半径（x 长轴 / z 短轴）

    var uni = {
      uTime: { value: 0 },
      uMode: { value: 0 },
      uGlow: { value: 0.45 }
    };
    var mat = new T.ShaderMaterial({
      uniforms: uni,
      side: T.DoubleSide,
      vertexShader: [
        'varying vec3 vWorld;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position, 1.0);',
        '  vWorld = wp.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vWorld;',
        'uniform float uTime, uMode, uGlow;',
        'float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }',
        'float noise2(vec2 p){',
        '  vec2 i = floor(p), f = fract(p);',
        '  vec2 u = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(h21(i), h21(i + vec2(1.0,0.0)), u.x),',
        '             mix(h21(i + vec2(0.0,1.0)), h21(i + vec2(1.0,1.0)), u.x), u.y);',
        '}',
        'float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * noise2(p); p *= 2.03; a *= 0.5; } return s; }',
        'void main(){',
        '  vec3 pos = vWorld;',
        // 世界坐标斜投影取噪声：任何朝向的面都有二维变化，墙顶连成一片云海
        '  vec2 p = vec2(pos.x * 0.34 + pos.z * 0.21 + uTime * 0.010,',
        '                pos.y * 0.26 + pos.z * 0.15);',
        '  float n = fbm2(p * 2.3);',
        '  float n2 = fbm2(p * 4.4 + 11.0 - uTime * 0.008);',
        '  vec3 deep = vec3(0.02, 0.04, 0.10);',
        '  vec3 neb  = mix(vec3(0.30, 0.16, 0.62), vec3(0.10, 0.42, 0.70), n2);',
        '  vec3 sea  = mix(vec3(0.01, 0.10, 0.16), vec3(0.03, 0.36, 0.44), n);',
        '  vec3 city = mix(vec3(0.03, 0.05, 0.09), vec3(0.42, 0.24, 0.42), n2);',
        '  vec3 col;',
        '  if (uMode < 0.5) col = deep + neb * pow(n, 1.7) * 1.5;',
        '  else if (uMode < 1.5) col = sea + sea * pow(n2, 2.0) * 2.2;',
        '  else col = city + vec3(0.9, 0.55, 0.28) * pow(n2, 3.5) * 1.4;',
        // 星点：三维网格，墙与天花是同一片星空
        '  vec3 cell = floor(pos * 22.0);',
        '  float st = step(0.9962, h21(cell.xy + cell.z * 13.7));',
        '  float tw = 0.55 + 0.45 * sin(uTime * 1.7 + h21(cell.xy) * 30.0);',
        '  col += vec3(0.85, 0.92, 1.0) * st * tw;',
        // 大尺度明暗，拉开云团与暗空的层次
        '  col *= 0.42 + 0.85 * smoothstep(0.22, 0.80, n);',
        // 越靠地面越暗，抬头最亮
        '  col *= mix(0.40, 1.0, smoothstep(-0.1, 1.5, pos.y));',
        '  col *= 0.45 + 0.55 * uGlow;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });

    // ---- 一体式曲面：直墙段 → 圆角 → 天花 ----
    // 墙体留出入口开口，天花完整闭合（开口处形成门楣，不会露缝）
    var Y_RIM = 2.5, FILLET = 0.62, Y_TOP = Y_RIM + FILLET, R_IN = 1 - FILLET;
    var GAP = 0.6;      // 入口侧开口半角，开口正对 +x（房间东侧门洞）

    var wallProf = [new T.Vector2(1, 0.02), new T.Vector2(1, Y_RIM)];
    var capProf = [];
    for (var ai = 0; ai <= 10; ai++) {
      var th = ai / 10 * Math.PI / 2;
      capProf.push(new T.Vector2(R_IN + Math.cos(th) * FILLET, Y_RIM + Math.sin(th) * FILLET));
    }
    capProf.push(new T.Vector2(0, Y_TOP));

    var wall = new T.Mesh(
      new T.LatheGeometry(wallProf, 120, Math.PI / 2 + GAP, H.TAU - GAP * 2), mat);
    var cap = new T.Mesh(new T.LatheGeometry(capProf, 120, 0, H.TAU), mat);
    [wall, cap].forEach(function (m) {
      m.position.set(CX, 0, CZ);
      m.scale.set(RX, 1, RZ);
      scene.add(m);
    });

    // 开口两侧金属立柱收边
    [Math.PI / 2 + GAP, Math.PI / 2 - GAP].forEach(function (phi) {
      var ex = CX + RX * Math.sin(phi), ez = CZ + RZ * Math.cos(phi);
      scene.add(H.box(0.09, Y_RIM, 0.09, mats.darkMetal, ex, Y_RIM / 2, ez));
    });

    // 环幕碰撞（20 段包围盒近似椭圆）
    var SEG = 20;
    for (var si = 0; si < SEG; si++) {
      var q0 = Math.PI / 2 + GAP + (H.TAU - GAP * 2) * si / SEG;
      var q1 = Math.PI / 2 + GAP + (H.TAU - GAP * 2) * (si + 1) / SEG;
      var px0 = CX + RX * Math.sin(q0), pz0 = CZ + RZ * Math.cos(q0);
      var px1 = CX + RX * Math.sin(q1), pz1 = CZ + RZ * Math.cos(q1);
      H.physics.add(Math.min(px0, px1) - 0.1, Math.min(pz0, pz1) - 0.1,
        Math.max(px0, px1) + 0.1, Math.max(pz0, pz1) + 0.1, 0, 3.2, 'screen');
    }

    // 座位前的过道氛围灯
    scene.add(H.glowStrip(0.06, 0.02, 4.4, -7.4, 0.012, CZ, mats.strip));

    // 座椅（3 个，面朝 -x 主画面）
    for (var i = -1; i <= 1; i++) {
      var sz = CZ + i * 1.15;
      var seat = new T.Group();
      seat.add(H.box(1.0, 0.36, 0.9, mats.fabric, 0, 0.22, 0));
      seat.add(H.box(1.0, 0.75, 0.16, mats.fabric, 0, 0.66, 0.4));
      seat.add(H.box(0.12, 0.45, 0.8, mats.darkMetal, -0.52, 0.4, 0));
      seat.add(H.box(0.12, 0.45, 0.8, mats.darkMetal, 0.52, 0.4, 0));
      seat.position.set(-6.4, 0, sz);
      seat.rotation.y = Math.PI / 2;
      scene.add(seat);
      H.physics.add(-6.95, sz - 0.55, -5.9, sz + 0.55, 0, 0.9, 'seat');
      H.shadowBlob(-6.4, sz, 0.62, 0.62, 0.42);
    }

    var mode = 0, playing = false;

    addInteract(CX, CZ + 1.0, 3.4, '切换影片', function () {
      mode = (mode + 1) % 3;
      uni.uMode.value = mode;
      H.Audio.click(660);
    });

    return {
      update: function (dt, time) {
        uni.uTime.value = time;
        // 站进影院时整体提亮，离开后回落到待机亮度
        uni.uGlow.value = H.damp(uni.uGlow.value, playing ? 1.0 : 0.42, 2.2, dt);
      },
      setPlaying: function (on) { playing = on; }
    };
  };

  /* =======================================================================
   *  卧室：可切换景观（雨 / 海滩 / 星空 / 雪夜）
   * ===================================================================== */
  var BED_SCENES = [
    { key: 'rain',   name: '雨夜',  light: 0x6f8fbf, strip: 0x8fb6ff, fog: 0x0a1420 },
    { key: 'beach',  name: '海滩日出', light: 0xffb877, strip: 0xffc89a, fog: 0x2a1a14 },
    { key: 'stars',  name: '星空极光', light: 0x7f8fd0, strip: 0x9fb8ff, fog: 0x08101c },
    { key: 'snow',   name: '雪夜',  light: 0xbfd4ff, strip: 0xcfe2ff, fog: 0x141c26 },
    { key: 'bamboo', name: '竹林',   light: 0x9fe0a8, strip: 0xa8ecb0, fog: 0x0a1c10 }
  ];
  H.BED_SCENES = BED_SCENES;

  H.buildBedroom = function () {
    mats = H.mats;
    var scene = H.scene;
    var L = H.LAYOUT;

    // ---- 床（床头靠南墙 z=westZ2）----
    var bed = new T.Group();
    var bx = -11.9, bz = 1.55;
    bed.add(H.box(2.3, 0.34, 2.0, mats.wood, 0, 0.17, 0));
    bed.add(H.box(2.2, 0.26, 1.9, new T.MeshStandardMaterial({ color: 0xd7dce6, roughness: 0.92 }), 0, 0.45, 0));
    bed.add(H.box(2.24, 0.1, 1.5, new T.MeshStandardMaterial({ color: 0x37455c, roughness: 0.95 }), 0, 0.62, 0.2));
    bed.add(H.box(2.34, 1.0, 0.14, mats.wood, 0, 0.62, 1.0));      // 床头板
    bed.add(H.box(0.8, 0.16, 0.42, new T.MeshStandardMaterial({ color: 0xeef1f6, roughness: 0.95 }), -0.5, 0.63, 0.72));
    bed.add(H.box(0.8, 0.16, 0.42, new T.MeshStandardMaterial({ color: 0xeef1f6, roughness: 0.95 }), 0.5, 0.63, 0.72));
    bed.position.set(bx, 0, bz);
    scene.add(bed);
    H.physics.add(bx - 1.18, bz - 1.02, bx + 1.18, bz + 1.08, 0, 0.7, 'bed');
    H.shadowBlob(bx, bz, 1.42, 1.2, 0.5);

    // 床头柜（左右各一只，跟着床走）
    [bz + 0.95, bz - 0.95].forEach(function (z) {
      var nx = bx - 1.45;
      var n = H.box(0.5, 0.42, 0.5, mats.wood, nx, 0.21, z);
      scene.add(n);
      var b = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), new T.MeshBasicMaterial({ color: 0xffd9a8 }));
      b.position.set(nx, 0.5, z);
      scene.add(b);
      H.shadowBlob(nx, z, 0.42, 0.42, 0.4);
    });

    // 地毯：压住床这一块，别让地面全黑
    var rug = H.box(3.3, 0.014, 2.5, new T.MeshStandardMaterial({ color: 0x3f4550, roughness: 0.99 }),
      bx - 0.1, 0.009, bz + 0.05);
    rug.castShadow = false;
    scene.add(rug);

    /* ---- 衣柜（北墙西侧）---- */
    var WD_W = 1.8, WD_D = 0.62, WD_H = 2.12;
    var WD_X = -14.85, WD_Z = -2.37 + WD_D / 2;
    var wardrobe = new T.Group();
    wardrobe.add(H.box(WD_W, WD_H, WD_D, mats.wood, 0, WD_H / 2, 0));
    var doorMat = new T.MeshStandardMaterial({ color: 0xd2bb9f, roughness: 0.5, metalness: 0.05 });
    var doorZ = WD_D / 2 + 0.016;
    wardrobe.add(H.box(WD_W / 2 - 0.05, WD_H - 0.12, 0.032, doorMat, -WD_W / 4, WD_H / 2, doorZ));
    wardrobe.add(H.box(WD_W / 2 - 0.05, WD_H - 0.12, 0.032, doorMat, WD_W / 4, WD_H / 2, doorZ));
    var handleMat = new T.MeshStandardMaterial({ color: 0xe6e0d4, roughness: 0.26, metalness: 0.92 });
    wardrobe.add(H.box(0.022, 0.46, 0.022, handleMat, -0.075, 1.12, doorZ + 0.02));
    wardrobe.add(H.box(0.022, 0.46, 0.022, handleMat, 0.075, 1.12, doorZ + 0.02));
    wardrobe.add(H.box(WD_W - 0.06, 0.10, WD_D - 0.06, mats.darkMetal, 0, 0.05, 0));    // 底座
    wardrobe.add(H.glowStrip(WD_W - 0.12, 0.018, 0.018, 0, WD_H - 0.05, WD_D / 2 + 0.01));
    wardrobe.position.set(WD_X, 0, WD_Z);
    scene.add(wardrobe);
    H.physics.add(WD_X - WD_W / 2, WD_Z - WD_D / 2, WD_X + WD_W / 2, WD_Z + WD_D / 2, 0, WD_H, 'wardrobe');
    H.shadowBlob(WD_X, WD_Z + 0.30, 1.05, 0.5, 0.45);

    /* ---- 书桌 + 椅子（北墙东侧，面朝衣柜与幕墙）---- */
    var DK_W = 1.75, DK_D = 0.66, DK_H = 0.74;
    var DK_X = -12.55, DK_Z = -2.37 + DK_D / 2;
    var desk = new T.Group();
    desk.add(H.box(DK_W, 0.05, DK_D, mats.wood, 0, DK_H, 0));
    desk.add(H.box(0.05, DK_H, DK_D - 0.04, mats.darkMetal, -DK_W / 2 + 0.06, DK_H / 2, 0));
    desk.add(H.box(0.05, DK_H, DK_D - 0.04, mats.darkMetal, DK_W / 2 - 0.06, DK_H / 2, 0));
    desk.add(H.box(DK_W - 0.2, 0.04, DK_D - 0.1, mats.darkMetal, 0, 0.30, 0));         // 下层隔板
    desk.add(H.box(DK_W - 0.2, 0.24, 0.03, mats.darkMetal, 0, DK_H - 0.14, -DK_D / 2 + 0.02)); // 挡板
    // 显示器：桌面支架式，屏面朝 +z（房间/座椅一侧），支架在屏后靠墙
    var monMat = new T.MeshStandardMaterial({ color: 0x0d1117, roughness: 0.42, metalness: 0.5 });
    var MON_Z = -DK_D / 2 + 0.16;                                                   // 面板所在进深
    desk.add(H.box(0.26, 0.02, 0.16, mats.darkMetal, 0.06, 0.775, MON_Z - 0.05));   // 底座（贴桌面）
    desk.add(H.box(0.06, 0.30, 0.06, mats.darkMetal, 0.06, 0.93, MON_Z - 0.05));    // 支架柱（在屏后）
    desk.add(H.box(0.86, 0.50, 0.035, monMat, 0.06, 1.20, MON_Z));                  // 面板本体
    desk.add(H.box(0.78, 0.42, 0.004, new T.MeshBasicMaterial({ color: 0x6fe8ff, transparent: true, opacity: 0.10 }),
      0.06, 1.20, MON_Z + 0.021));                                                  // 屏面（朝房间）
    // 台灯
    desk.add(H.box(0.10, 0.02, 0.10, mats.darkMetal, -0.62, DK_H + 0.03, -DK_D / 2 + 0.22));
    desk.add(H.box(0.02, 0.26, 0.02, mats.darkMetal, -0.62, DK_H + 0.16, -DK_D / 2 + 0.22));
    desk.add(H.box(0.16, 0.04, 0.10, new T.MeshBasicMaterial({ color: 0xffd9a8 }),
      -0.62, DK_H + 0.29, -DK_D / 2 + 0.26));
    // 桌面小物：书堆 + 笔筒
    desk.add(H.box(0.22, 0.05, 0.16, new T.MeshStandardMaterial({ color: 0x8e3b3b, roughness: 0.9 }), 0.62, DK_H + 0.055, 0.05));
    desk.add(H.box(0.20, 0.04, 0.15, new T.MeshStandardMaterial({ color: 0x2f4f6f, roughness: 0.9 }), 0.63, DK_H + 0.10, 0.05));
    desk.position.set(DK_X, 0, DK_Z);
    scene.add(desk);
    H.physics.add(DK_X - DK_W / 2, DK_Z - DK_D / 2, DK_X + DK_W / 2, DK_Z + DK_D / 2, 0, DK_H, 'desk');
    H.shadowBlob(DK_X, DK_Z + 0.28, 1.0, 0.45, 0.4);

    var chair = new T.Group();
    chair.add(H.box(0.50, 0.07, 0.50, mats.fabric, 0, 0.45, 0));
    chair.add(H.box(0.48, 0.50, 0.06, mats.fabric, 0, 0.70, 0.225));
    chair.add(H.box(0.06, 0.40, 0.06, mats.darkMetal, 0, 0.24, 0));
    chair.add(H.box(0.44, 0.035, 0.44, mats.darkMetal, 0, 0.04, 0));
    chair.position.set(DK_X + 0.10, 0, DK_Z + 0.80);
    scene.add(chair);
    H.physics.add(chair.position.x - 0.28, chair.position.z - 0.28,
      chair.position.x + 0.28, chair.position.z + 0.28, 0, 0.5, 'chair');
    H.shadowBlob(chair.position.x, chair.position.z, 0.36, 0.36, 0.45);

    /* ---- 落地灯（床东侧）---- */
    var lampX = bx + 1.85, lampZ = bz + 0.95;
    var lamp = new T.Group();
    lamp.add(H.box(0.30, 0.03, 0.30, mats.darkMetal, 0, 0.02, 0));
    lamp.add(H.box(0.035, 1.44, 0.035, mats.darkMetal, 0, 0.74, 0));
    lamp.add(H.box(0.26, 0.20, 0.26, new T.MeshBasicMaterial({ color: 0xffd9a8 }), 0, 1.55, 0));
    lamp.position.set(lampX, 0, lampZ);
    scene.add(lamp);
    H.physics.add(lampX - 0.16, lampZ - 0.16, lampX + 0.16, lampZ + 0.16, 0, 1.7, 'lamp');
    H.shadowBlob(lampX, lampZ, 0.3, 0.3, 0.45);

    /* ---- 收藏展示柜（北墙中段：书桌与卧室门之间）---- */
    var DC_W = 1.8, DC_D = 0.45, DC_H = 2.06;
    var DC_X = -9.25, DC_Z = -2.37 + DC_D / 2;
    var cab = new T.Group();
    // 柜体：背板 / 两侧板 / 顶板 / 踢脚
    cab.add(H.box(DC_W, DC_H, 0.035, mats.darkMetal, 0, DC_H / 2, -DC_D / 2 + 0.018));
    cab.add(H.box(0.05, DC_H, DC_D, mats.wood, -DC_W / 2 + 0.025, DC_H / 2, 0));
    cab.add(H.box(0.05, DC_H, DC_D, mats.wood, DC_W / 2 - 0.025, DC_H / 2, 0));
    cab.add(H.box(DC_W, 0.06, DC_D, mats.wood, 0, DC_H - 0.03, 0));
    cab.add(H.box(DC_W - 0.08, 0.10, DC_D - 0.06, mats.darkMetal, 0, 0.05, 0));
    // 层板 + 每层背光
    var SHELF_Y = [0.13, 0.62, 1.11, 1.60];
    SHELF_Y.forEach(function (y) {
      cab.add(H.box(DC_W - 0.1, 0.04, DC_D - 0.06, mats.wood, 0, y, 0));
      cab.add(H.glowStrip(DC_W - 0.26, 0.012, 0.012, 0, y + 0.026, -DC_D / 2 + 0.055, mats.stripWarm));
    });
    // 玻璃门（对开）+ 中缝竖梃与把手
    var doorGlass = new T.MeshStandardMaterial({
      color: 0xbfe6ff, transparent: true, opacity: 0.12,
      roughness: 0.05, metalness: 0.45, side: T.DoubleSide, depthWrite: false
    });
    cab.add(H.box(DC_W - 0.14, DC_H - 0.18, 0.012, doorGlass, 0, DC_H / 2 + 0.01, DC_D / 2 - 0.02));
    cab.add(H.box(0.016, DC_H - 0.14, 0.024, mats.metal, 0, DC_H / 2, DC_D / 2 - 0.02));
    cab.add(H.box(0.014, 0.32, 0.02, mats.metal, -0.045, 1.26, DC_D / 2 + 0.002));
    cab.add(H.box(0.014, 0.32, 0.02, mats.metal, 0.045, 1.26, DC_D / 2 + 0.002));

    var BOOK_COL = [0x8e3b3b, 0x2f4f6f, 0x3f5f4a, 0xa8823f, 0x4a3f63, 0x6b6f78, 0x9c5a3c];

    // 底层：手办三只 + 收藏盒
    function addFigure(x, color, hgt) {
      var g = new T.Group();
      var base = new T.Mesh(new T.CylinderGeometry(0.055, 0.062, 0.014, 18), mats.darkMetal);
      base.position.y = 0.007;
      g.add(base);
      var body = new T.Mesh(new T.CylinderGeometry(0.028, 0.040, hgt, 14), H.matEmissive(color, 0.65));
      body.position.y = 0.014 + hgt / 2;
      g.add(body);
      var head = new T.Mesh(new T.SphereGeometry(0.036, 14, 12), H.matEmissive(color, 0.95));
      head.position.y = 0.014 + hgt + 0.034;
      g.add(head);
      g.position.set(x, 0.15, 0.03);
      cab.add(g);
    }
    addFigure(-0.62, 0x6fe8ff, 0.16);
    addFigure(-0.44, 0xff8fc4, 0.21);
    addFigure(-0.26, 0xffb46b, 0.18);
    cab.add(H.box(0.24, 0.16, 0.18, new T.MeshStandardMaterial({ color: 0x22262e, roughness: 0.8 }), 0.40, 0.23, 0.02));
    cab.add(H.box(0.22, 0.14, 0.16, new T.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.8 }), 0.46, 0.38, 0.02));

    // 第二层：书
    for (var bi = 0; bi < 11; bi++) {
      var bw = 0.036 + (bi * 7 % 5) * 0.007;
      var bh = 0.20 + (bi * 13 % 6) * 0.022;
      var bd = 0.15 + (bi % 3) * 0.018;
      cab.add(H.box(bw, bh, bd,
        new T.MeshStandardMaterial({ color: BOOK_COL[bi % BOOK_COL.length], roughness: 0.86 }),
        -0.74 + bi * 0.058, 0.64 + bh / 2, 0.02));
    }
    cab.add(H.box(0.26, 0.035, 0.19, new T.MeshStandardMaterial({ color: 0x2f4f6f, roughness: 0.9 }), 0.38, 0.658, 0.02));
    cab.add(H.box(0.24, 0.032, 0.18, new T.MeshStandardMaterial({ color: 0xa8823f, roughness: 0.9 }), 0.37, 0.692, 0.02));
    cab.add(H.box(0.22, 0.030, 0.17, new T.MeshStandardMaterial({ color: 0x6b6f78, roughness: 0.9 }), 0.39, 0.724, 0.02));

    // 第三层：玻璃罩晶体 + 小飞船模型
    var domeBase = new T.Mesh(new T.CylinderGeometry(0.21, 0.23, 0.045, 28), mats.wood);
    domeBase.position.set(0.42, 1.132, 0.02);
    cab.add(domeBase);
    var dome = new T.Mesh(new T.SphereGeometry(0.185, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), doorGlass);
    dome.position.set(0.42, 1.155, 0.02);
    cab.add(dome);
    var crystal = new T.Mesh(new T.IcosahedronGeometry(0.072, 0), H.matEmissive(0x7fd8ff, 0.9));
    crystal.position.set(0.42, 1.24, 0.02);
    cab.add(crystal);

    var shipStand = new T.Mesh(new T.CylinderGeometry(0.09, 0.105, 0.03, 18), mats.darkMetal);
    shipStand.position.set(-0.48, 1.125, 0.02);
    cab.add(shipStand);
    var ship = new T.Group();
    ship.add(new T.Mesh(new T.CylinderGeometry(0.042, 0.046, 0.19, 16), mats.metal));
    var shipNose = new T.Mesh(new T.ConeGeometry(0.042, 0.10, 16), mats.metal);
    shipNose.position.y = 0.145;
    ship.add(shipNose);
    ship.add(H.box(0.012, 0.07, 0.05, mats.darkMetal, 0, -0.06, 0.05));
    ship.add(H.box(0.012, 0.07, 0.05, mats.darkMetal, 0, -0.06, -0.05));
    ship.add(H.box(0.05, 0.07, 0.012, mats.darkMetal, 0.05, -0.06, 0));
    ship.add(H.box(0.05, 0.07, 0.012, mats.darkMetal, -0.05, -0.06, 0));
    ship.position.set(-0.48, 1.29, 0.02);
    ship.rotation.z = 0.26;
    cab.add(ship);

    // 顶层：悬浮全息摆件 + 立着的书
    var holoBase = new T.Mesh(new T.CylinderGeometry(0.15, 0.17, 0.03, 24), mats.darkMetal);
    holoBase.position.set(-0.42, 1.625, 0.02);
    cab.add(holoBase);
    var holoRing = new T.Mesh(new T.RingGeometry(0.095, 0.125, 32),
      new T.MeshBasicMaterial({ color: 0x6fe8ff, transparent: true, opacity: 0.5, side: T.DoubleSide }));
    holoRing.rotation.x = -Math.PI / 2;
    holoRing.position.set(-0.42, 1.645, 0.02);
    cab.add(holoRing);
    var holo = new T.Mesh(new T.IcosahedronGeometry(0.082, 0), new T.MeshBasicMaterial({
      color: 0x8fe8ff, wireframe: true, transparent: true, opacity: 0.8
    }));
    holo.position.set(-0.42, 1.80, 0.02);
    cab.add(holo);
    for (var ti = 0; ti < 4; ti++) {
      var th = 0.24 + (ti % 3) * 0.03;
      cab.add(H.box(0.05, th, 0.17,
        new T.MeshStandardMaterial({ color: BOOK_COL[(ti + 2) % BOOK_COL.length], roughness: 0.86 }),
        0.30 + ti * 0.062, 1.62 + th / 2, 0.02));
    }

    cab.position.set(DC_X, 0, DC_Z);
    scene.add(cab);
    H.physics.add(DC_X - DC_W / 2, DC_Z - DC_D / 2, DC_X + DC_W / 2, DC_Z + DC_D / 2, 0, DC_H, 'cabinet');
    H.shadowBlob(DC_X, DC_Z + 0.24, 0.95, 0.36, 0.45);
    if (H.QUALITY.name !== 'low') {
      // 柜内顶灯：放在柜体内部，避免在玻璃门上打出一块高光
      var cabLight = new T.PointLight(0xffcf9a, 1.8, 2.6, 2.0);
      cabLight.position.set(DC_X, DC_H - 0.16, DC_Z + 0.04);
      scene.add(cabLight);
    }

    /* ---- 阅读角（房间中部偏东，面朝西侧景观幕墙）---- */
    var NT_X = -6.3, NT_Z = 1.3;
    var nookRug = H.box(2.2, 0.014, 1.8, new T.MeshStandardMaterial({ color: 0x564b3f, roughness: 0.99 }),
      NT_X, 0.008, NT_Z - 0.05);
    nookRug.castShadow = false;
    scene.add(nookRug);

    /* ---- 多功能椅：普通座椅 / 摇摇椅 / 躺椅 ---- */
    var seatMat = new T.MeshStandardMaterial({ color: 0xb9b3a8, roughness: 0.95 });
    var backMat = new T.MeshStandardMaterial({ color: 0xa7a196, roughness: 0.96 });
    var frameMat = new T.MeshStandardMaterial({ color: 0x3b352e, roughness: 0.72, metalness: 0.22 });
    var LOUNGE_MODES = ['普通座椅', '摇摇椅', '躺椅'];
    var loungeMode = 0;
    var loungeState = { rock: 0, recline: 0 };
    var ROCK_R = 1.40;                       // 摇椅弧轨半径（= 摆动支点高度）

    var lounge = new T.Group();
    var rockPivot = new T.Group();           // 摆动支点：弧轨圆心，摇摆时整体绕它转
    rockPivot.position.y = ROCK_R;
    lounge.add(rockPivot);
    var body = new T.Group();                // 椅身（回到地面坐标）
    body.position.y = -ROCK_R;
    rockPivot.add(body);

    // 转盘底座（座椅 / 躺椅态；摇椅态收起）
    var pedestal = new T.Group();
    var lbase = new T.Mesh(new T.CylinderGeometry(0.30, 0.32, 0.035, 24), frameMat);
    lbase.position.y = 0.018;
    pedestal.add(lbase);
    var lstem = new T.Mesh(new T.CylinderGeometry(0.036, 0.036, 0.16, 12), mats.metal);
    lstem.position.y = 0.11;
    pedestal.add(lstem);
    body.add(pedestal);

    // 摇椅弧轨：两条沿前后方向的弧形木轨，圆心正好在摆动支点上
    var rocker = new T.Group();
    for (var rs = -1; rs <= 1; rs += 2) {
      for (var ri = 0; ri < 9; ri++) {
        var ra = -0.34 + ri * 0.085;
        var seg = H.box(0.055, 0.045, 0.152, mats.wood,
          rs * 0.335, ROCK_R - Math.cos(ra) * ROCK_R + 0.022, Math.sin(ra) * ROCK_R);
        seg.rotation.x = -ra;
        rocker.add(seg);
      }
    }
    rocker.scale.z = 0.04;
    rocker.visible = false;
    body.add(rocker);

    // 弧轨与座框之间的立柱（摇椅态伸出，把椅身撑起来，避免整把椅子悬空）
    var rmounts = new T.Group();
    for (var ms = -1; ms <= 1; ms += 2) {
      for (var mz = -1; mz <= 1; mz += 2) {
        rmounts.add(H.box(0.05, 0.15, 0.05, mats.wood, ms * 0.335, 0.105, mz * 0.22));
      }
    }
    rmounts.scale.y = 0.02;
    rmounts.visible = false;
    body.add(rmounts);

    body.add(H.box(0.70, 0.09, 0.62, mats.wood, 0, 0.215, 0));        // 座框
    body.add(H.box(0.74, 0.13, 0.66, seatMat, 0, 0.315, 0));          // 坐垫
    body.add(H.box(0.06, 0.05, 0.60, mats.wood, -0.39, 0.545, 0.02)); // 扶手
    body.add(H.box(0.06, 0.05, 0.60, mats.wood, 0.39, 0.545, 0.02));
    // 扶手立柱：前两根落在座框上，后两根贴靠背侧
    for (var as = -1; as <= 1; as += 2) {
      body.add(H.box(0.045, 0.38, 0.05, mats.wood, as * 0.39, 0.35, 0.27));
      body.add(H.box(0.045, 0.38, 0.05, mats.wood, as * 0.39, 0.35, -0.26));
    }

    // 靠背（支点在座面后沿，躺椅态向后翻）
    var backPivot = new T.Group();
    backPivot.position.set(0, 0.40, -0.30);
    backPivot.rotation.x = -0.12;
    body.add(backPivot);
    backPivot.add(H.box(0.74, 0.58, 0.12, backMat, 0, 0.27, 0));
    backPivot.add(H.box(0.74, 0.045, 0.13, mats.wood, 0, 0.555, 0.004));    // 顶横档
    backPivot.add(H.box(0.045, 0.58, 0.13, mats.wood, -0.35, 0.27, 0.004)); // 侧档
    backPivot.add(H.box(0.045, 0.58, 0.13, mats.wood, 0.35, 0.27, 0.004));
    var lpillow = H.box(0.36, 0.32, 0.10, new T.MeshStandardMaterial({ color: 0x9c6b52, roughness: 0.98 }), 0, 0.14, 0.11);
    lpillow.rotation.x = -0.16;
    backPivot.add(lpillow);

    // 脚托：收在坐垫内部，躺椅态从坐垫下伸出
    var footRest = new T.Group();
    footRest.position.set(0, 0.33, 0);
    body.add(footRest);
    footRest.add(H.box(0.56, 0.10, 0.46, seatMat, 0, 0, 0));
    footRest.add(H.box(0.50, 0.03, 0.40, frameMat, 0, -0.065, 0));    // 托板

    lounge.position.set(NT_X, 0, NT_Z);
    lounge.rotation.y = -Math.PI / 2 + 0.18;
    scene.add(lounge);
    H.physics.add(NT_X - 0.42, NT_Z - 0.42, NT_X + 0.42, NT_Z + 0.42, 0, 0.9, 'lounge');
    H.shadowBlob(NT_X, NT_Z, 0.44, 0.44, 0.45);

    var loungeIt = null;
    function setLoungeMode(i) {
      loungeMode = i;
      if (loungeIt) loungeIt.label = '椅子 · ' + LOUNGE_MODES[i];
      H.Audio.click(i === 1 ? 620 : (i === 2 ? 700 : 660));
    }
    loungeIt = addInteract(NT_X, NT_Z, 1.6, '椅子 · ' + LOUNGE_MODES[0], function () {
      setLoungeMode((loungeMode + 1) % LOUNGE_MODES.length);
    });

    // 小圆边几 + 书与杯
    var tableG = new T.Group();
    var tTop = new T.Mesh(new T.CylinderGeometry(0.24, 0.24, 0.035, 28), mats.wood);
    tTop.position.y = 0.50;
    tableG.add(tTop);
    var tStem = new T.Mesh(new T.CylinderGeometry(0.028, 0.028, 0.48, 12), mats.darkMetal);
    tStem.position.y = 0.25;
    tableG.add(tStem);
    var tBase = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 0.02, 20), mats.darkMetal);
    tBase.position.y = 0.01;
    tableG.add(tBase);
    tableG.add(H.box(0.20, 0.035, 0.15, new T.MeshStandardMaterial({ color: 0x2f4f6f, roughness: 0.9 }), 0, 0.535, 0));
    tableG.add(H.box(0.18, 0.030, 0.14, new T.MeshStandardMaterial({ color: 0x8e3b3b, roughness: 0.9 }), 0, 0.568, 0));
    var cup = new T.Mesh(new T.CylinderGeometry(0.035, 0.030, 0.09, 16),
      new T.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.6 }));
    cup.position.set(0.13, 0.572, 0.05);
    tableG.add(cup);
    tableG.position.set(NT_X, 0, 0.6);
    scene.add(tableG);
    H.physics.add(NT_X - 0.26, 0.34, NT_X + 0.26, 0.86, 0, 0.56, 'side-table');
    H.shadowBlob(NT_X, 0.6, 0.3, 0.3, 0.4);

    // 弧臂落地阅读灯（灯头悬在座椅上方）
    var RL_X = -7.32, RL_Z = 1.55;
    var rlamp = new T.Group();
    var rbase = new T.Mesh(new T.CylinderGeometry(0.18, 0.22, 0.03, 24), mats.darkMetal);
    rbase.position.y = 0.015;
    rlamp.add(rbase);
    rlamp.add(H.box(0.03, 1.62, 0.03, mats.metal, 0, 0.81, 0));
    rlamp.add(H.box(0.90, 0.028, 0.028, mats.metal, 0.45, 1.62, 0));
    var rshade = new T.Mesh(new T.ConeGeometry(0.16, 0.20, 20, 1, true), mats.darkMetal);
    rshade.position.set(0.90, 1.50, 0);
    rlamp.add(rshade);
    var rbulb = new T.Mesh(new T.CircleGeometry(0.115, 20), new T.MeshBasicMaterial({ color: 0xffe2b8 }));
    rbulb.rotation.x = Math.PI / 2;   // 法线朝下，从下方能看到发光的灯口
    rbulb.position.set(0.90, 1.404, 0);
    rlamp.add(rbulb);
    // 灯口一圈暖光 + 臂下一条细光带：暗背景里也能看清灯的结构
    var rrim = new T.Mesh(new T.CylinderGeometry(0.163, 0.163, 0.008, 24, 1, true),
      new T.MeshBasicMaterial({ color: 0xffca7a }));
    rrim.position.set(0.90, 1.402, 0);
    rlamp.add(rrim);
    rlamp.add(H.glowStrip(0.86, 0.006, 0.006, 0.45, 1.603, 0,
      new T.MeshBasicMaterial({ color: 0xffca7a })));
    rlamp.position.set(RL_X, 0, RL_Z);
    scene.add(rlamp);
    H.physics.add(RL_X - 0.20, RL_Z - 0.20, RL_X + 0.20, RL_Z + 0.20, 0, 1.62, 'reading-lamp');
    H.shadowBlob(RL_X, RL_Z, 0.28, 0.28, 0.4);
    if (H.QUALITY.name !== 'low') {
      var rlLight = new T.PointLight(0xffd2a6, 2.6, 4.4, 2.0);
      rlLight.position.set(RL_X + 0.90, 1.34, RL_Z);
      scene.add(rlLight);
    }

    // ---- 景观幕墙（西墙，朝 +x）----
    var uni = {
      uTime: { value: 0 },
      uMode: { value: 0 },        // 0 雨 1 海滩 2 星空 3 雪
      uBlend: { value: 0 }
    };
    var winMat = new T.ShaderMaterial({
      uniforms: uni,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'varying vec2 vUv;',
        'uniform float uTime, uMode;',
        'float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }',
        'float noise2(vec2 p){',
        '  vec2 i = floor(p), f = fract(p);',
        '  vec2 u = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(h21(i), h21(i + vec2(1.0,0.0)), u.x),',
        '             mix(h21(i + vec2(0.0,1.0)), h21(i + vec2(1.0,1.0)), u.x), u.y);',
        '}',
        'float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * noise2(p); p *= 2.03; a *= 0.5; } return s; }',
        'void main(){',
        '  vec2 uv = vUv;',
        '  float t = uTime;',
        '  vec3 col;',
        '  if (uMode < 0.5) {',                                    // ---------- 雨夜 ----------
        '    col = mix(vec3(0.006,0.012,0.026), vec3(0.014,0.026,0.048), uv.y);',
        '    col += vec3(0.055,0.075,0.12) * smoothstep(0.40, 0.0, uv.y);',   // 城市余光
        '    for (int i = 0; i < 3; i++) {',
        '      float fi = float(i);',
        '      float dens = 46.0 + fi * 30.0;',
        '      vec2 rp = vec2(uv.x * dens + uv.y * dens * 0.12 + fi * 5.3,',
        '                     uv.y * 3.0 + t * (1.5 + fi * 0.85));',
        '      float lane = abs(fract(rp.x) - 0.5) * 2.0;',
        '      float thin = pow(max(0.0, 1.0 - lane), 9.0);',
        '      float seg = fract(rp.y + h21(vec2(floor(rp.x), fi)) * 3.1);',
        '      float drop = smoothstep(0.42, 0.0, abs(seg - 0.5));',
        '      col += vec3(0.24,0.32,0.46) * thin * drop * (0.16 - fi * 0.035);',
        '    }',
        '  } else if (uMode < 1.5) {',                             // ---------- 海滩日出 ----------
        '    float HOR = 0.44;',
        '    float sunX = 0.60;',
        // 天空：地平线一层暖橙，往上过渡到冷蓝
        '    float sy = clamp((uv.y - HOR) / (1.0 - HOR), 0.0, 1.0);',
        '    vec3 sky = mix(vec3(0.52,0.27,0.11), vec3(0.26,0.15,0.13), smoothstep(0.0, 0.40, sy));',
        '    sky = mix(sky, vec3(0.045,0.062,0.150), smoothstep(0.32, 1.0, sy));',
        // 横向云带：贴着地平线薄、往上散
        '    float cl = fbm2(vec2(uv.x * 3.2 + t * 0.010, uv.y * 12.0 - t * 0.006));',
        '    sky += vec3(0.32,0.20,0.12) * pow(cl, 2.6) * (1.0 - smoothstep(0.30, 0.95, sy)) * 0.85;',
        // 太阳 + 大气光晕（贴在地平线上）
        '    float sdx = (uv.x - sunX);',
        '    float sdy = (uv.y - HOR - 0.035) * 1.35;',
        '    float sd = sqrt(sdx * sdx + sdy * sdy);',
        '    sky += vec3(1.0,0.80,0.50) * smoothstep(0.060, 0.0, sd) * 1.15;',
        '    sky += vec3(0.55,0.26,0.10) * smoothstep(0.30, 0.0, sd) * 0.35;',
        '    if (uv.y < HOR) {',
        '      float d = (HOR - uv.y) / HOR;',                        // 0 地平线 → 1 底部
        // 海面：靠地平线偏亮偏暖，越近越深
        '      vec3 sea = mix(vec3(0.135,0.185,0.195), vec3(0.012,0.030,0.050), smoothstep(0.0, 0.72, d));',
        '      sea += vec3(0.075,0.100,0.100) * smoothstep(0.22, 0.0, d);',   // 地平线附近的雾亮带
        // 横向细浪（只沿 y 变化，避免出现竖向光柱）
        '      float w = sin(uv.y * 130.0 - t * 1.6 + sin(uv.x * 6.0 + t * 0.4) * 1.3);',
        '      float wob = 0.40 + 0.60 * fbm2(vec2(uv.x * 5.0 + t * 0.05, uv.y * 2.0));',
        '      float band = smoothstep(0.55, 1.0, w) * (1.0 - smoothstep(0.05, 0.85, d));',
        '      sea += vec3(0.085,0.110,0.115) * band * wob * 0.40;',
        // 水面的太阳倒影：越近越散、越暗
        '      float rx = (uv.x - sunX) * (8.0 + d * 20.0);',
        '      float refl = exp(-rx * rx) * (1.0 - smoothstep(0.18, 1.0, d));',
        '      float glit = 0.55 + 0.45 * sin(uv.y * 150.0 - t * 2.2 + uv.x * 40.0);',
        '      sea += vec3(1.0,0.68,0.36) * refl * glit * 0.50;',
        '      col = sea;',
        '    } else {',
        '      col = sky;',
        '    }',
        // 地平线：柔和的暖雾，不再是一条白线
        '    col += vec3(1.0,0.82,0.55) * smoothstep(0.012, 0.0, abs(uv.y - HOR)) * 0.14;',
        '  } else if (uMode < 2.5) {',                             // ---------- 星空 ----------
        '    col = mix(vec3(0.004,0.006,0.018), vec3(0.010,0.016,0.036), uv.y);',
        '    float aur = fbm2(vec2(uv.x * 2.4 + t * 0.02, uv.y * 3.0 - t * 0.03));',
        '    col += mix(vec3(0.03,0.20,0.16), vec3(0.09,0.06,0.26), uv.y) * pow(aur, 2.6) * 0.85;',
        '    vec2 cell = floor(vec2(uv.x * 300.0, uv.y * 150.0));',
        '    float st = step(0.997, h21(cell));',
        '    float tw = 0.55 + 0.45 * sin(t * 2.0 + h21(cell) * 30.0);',
        '    col += vec3(0.75,0.82,0.95) * st * tw * 0.65;',
        '  } else if (uMode < 3.5) {',                             // ---------- 雪夜 ----------
        '    col = mix(vec3(0.050,0.070,0.100), vec3(0.095,0.130,0.180), uv.y);',
        '    float hill = 0.14 + fbm2(vec2(uv.x * 4.0, 3.0)) * 0.09;',
        '    if (uv.y < hill) col = mix(vec3(0.30,0.36,0.45), vec3(0.13,0.17,0.23), uv.y / hill);',
        '    for (int i = 0; i < 3; i++) {',
        '      float fi = float(i);',
        '      vec2 sp = vec2(uv.x * 74.0 + sin(t * 0.6 + fi) * 1.5, uv.y * 48.0 + t * (2.0 + fi * 1.4) + fi * 13.0);',
        '      vec2 cell2 = floor(sp);',
        '      float s2 = step(0.984, h21(cell2 + fi * 3.7));',
        '      vec2 fp = fract(sp) - 0.5;',
        '      float dot = smoothstep(0.36, 0.12, length(fp));',
        '      col += vec3(0.55,0.60,0.68) * s2 * dot * 0.9;',
        '    }',
        '  } else {',                                              // ---------- 竹林 ----------
        // 背景：远处的深绿雾 + 缓慢漂移的雾团
        '    col = mix(vec3(0.006,0.016,0.010), vec3(0.014,0.032,0.018), uv.y);',
        '    col += vec3(0.012,0.026,0.014) * fbm2(vec2(uv.x * 2.4 + t * 0.02, uv.y * 1.5));',
        // 四层竹子：越靠后越暗越细，带轻微倾斜与摆动
        '    for (int i = 0; i < 4; i++) {',
        '      float fi = float(i);',
        '      float scale = 13.0 - fi * 2.4;',
        '      float sid = floor(uv.x * scale + fi * 4.7);',
        '      float rnd = h21(vec2(sid, fi * 5.1));',
        '      float lean = (rnd - 0.5) * 0.05;',
        '      float cx = (sid + 0.15 + 0.7 * rnd) / scale + lean * (uv.y - 0.5)',
        '                 + sin(t * 0.4 + rnd * 6.3) * 0.0020;',
        '      float hw = (0.0025 + 0.006 * rnd * rnd) * (1.0 + fi * 0.35);',
        '      float d = abs(uv.x - cx);',
        '      float body = smoothstep(hw, hw * 0.45, d);',
        // 竹节
        '      float seg = fract((uv.y + rnd * 2.0) * (8.0 + rnd * 5.0));',
        '      float node = smoothstep(0.05, 0.0, abs(seg)) * 0.65;',
        // 每根竹子明暗不同，才有前后层次
        '      float tone = 0.35 + 0.75 * h21(vec2(sid, 9.1 + fi));',
        '      vec3 rod = mix(vec3(0.045,0.105,0.045), vec3(0.170,0.310,0.115), 0.35 + 0.4 * rnd) * tone;',
        '      rod *= 1.0 - node;',
        '      rod += vec3(0.060,0.110,0.040) * smoothstep(hw * 0.9, 0.0, abs(d - hw * 0.45)) * tone;',
        '      col = mix(col, rod, body * (0.50 + fi * 0.12));',
        '    }',
        // 竹叶：上部叠加斜向碎叶，越往上越密
        '    float lv = fbm2(vec2(uv.x * 5.0 + t * 0.02, uv.y * 7.0 - t * 0.03));',
        '    float leaf = smoothstep(0.40, 0.66, lv) * smoothstep(0.10, 0.55, uv.y);',
        '    col = mix(col, vec3(0.022,0.070,0.028), leaf * 0.85);',
        // 地面附近浮起的雾
        '    col += vec3(0.014,0.032,0.020) * smoothstep(0.32, 0.0, uv.y);',
        '  }',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    /* ---- 天花天幕：墙那套是给竖直面写的，铺到水平面会变成横条纹，
            所以天花单独一套「天空」着色器，但共用 uTime / uMode，切场景同步 ---- */
    var ceilMat = new T.ShaderMaterial({
      uniforms: { uTime: uni.uTime, uMode: uni.uMode },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'varying vec2 vUv;',
        'uniform float uTime, uMode;',
        'float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }',
        'float noise2(vec2 p){',
        '  vec2 i = floor(p), f = fract(p);',
        '  vec2 u = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(h21(i), h21(i + vec2(1.0,0.0)), u.x),',
        '             mix(h21(i + vec2(0.0,1.0)), h21(i + vec2(1.0,1.0)), u.x), u.y);',
        '}',
        'float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * noise2(p); p *= 2.03; a *= 0.5; } return s; }',
        'void main(){',
        '  vec2 p = vUv * vec2(5.0, 2.2);',
        '  float n = fbm2(p * 1.3 + vec2(uTime * 0.020, uTime * 0.010));',
        '  vec3 col;',
        '  if (uMode < 0.5) {',                                    // 雨夜：厚云
        '    col = mix(vec3(0.010,0.018,0.034), vec3(0.040,0.055,0.090), n);',
        '    col += vec3(0.06,0.08,0.13) * pow(n, 3.5);',
        '  } else if (uMode < 1.5) {',                             // 海滩：日出天幕
        // vUv.x = 0 在西侧（太阳那面），暖色只压在那一半
        '    float g = smoothstep(0.0, 0.85, vUv.x);',
        '    col = mix(vec3(0.40,0.21,0.09), vec3(0.045,0.062,0.150), g);',
        '    col += mix(vec3(0.26,0.14,0.06), vec3(0.05,0.07,0.17), g) * pow(n, 1.6) * 0.9;',
        '    col += vec3(0.30,0.17,0.07) * pow(n, 3.4) * (1.0 - g) * 0.8;',
        '  } else if (uMode < 2.5) {',                             // 星空：极光
        '    col = mix(vec3(0.004,0.006,0.018), vec3(0.016,0.024,0.048), n);',
        '    col += mix(vec3(0.03,0.24,0.17), vec3(0.10,0.06,0.28), vUv.y) * pow(n, 2.2) * 0.9;',
        '    vec2 cell = floor(vUv * vec2(130.0, 52.0));',
        '    float tw = 0.55 + 0.45 * sin(uTime * 2.0 + h21(cell) * 30.0);',
        '    col += vec3(0.75,0.82,0.95) * step(0.9955, h21(cell)) * tw * 0.8;',
        '  } else if (uMode < 3.5) {',                             // 雪夜：薄云
        '    col = mix(vec3(0.055,0.070,0.100), vec3(0.150,0.175,0.220), n);',
        '    col += vec3(0.08,0.10,0.13) * pow(n, 3.5);',
        '  } else {',                                              // 竹林：竹叶冠层
        '    col = mix(vec3(0.010,0.028,0.014), vec3(0.030,0.062,0.026), n);',
        '    col += vec3(0.050,0.090,0.030) * pow(n, 2.4);',
        // 叶隙透光
        '    float gap = fbm2(p * 2.6 + vec2(7.0, 3.0));',
        '    col += vec3(0.18,0.24,0.14) * smoothstep(0.76, 0.94, gap) * 0.5;',
        '  }',
        // 靠墙一圈压暗，和墙面顶部的暗调接上
        '  float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));',
        '  col *= 0.55 + 0.45 * smoothstep(0.0, 0.20, e);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });

    /* ---- 四面墙同步成屏幕：共用同一套场景着色器，切场景一起变 ---- */
    // u 按墙长换算，保证不同长度的墙图案尺度一致（每 8m 一个循环）
    var UPM = 1 / 8;
    function wallScreen(w, h, cx, cy, cz, ry, u0, u1, v0, v1, rx) {
      var geo = new T.PlaneGeometry(w, h);
      var uv = geo.attributes.uv;
      for (var ui = 0; ui < uv.count; ui++) {
        uv.setXY(ui, u0 + uv.getX(ui) * (u1 - u0), v0 + uv.getY(ui) * (v1 - v0));
      }
      uv.needsUpdate = true;
      var m = new T.Mesh(geo, winMat);
      m.position.set(cx, cy, cz);
      m.rotation.set(rx || 0, ry, 0);
      scene.add(m);
      return m;
    }
    var WZ = L.westZ2, SZ = L.westZ1;              // 北墙 / 南墙中心线
    var DOOR_W = 1.0, DOOR_H = 2.35;               // 门洞半宽 / 洞高

    // 西墙（朝 +x）：整面成屏
    wallScreen(5.5, 3.2, L.x0 + 0.13, 1.6, 0.25, Math.PI / 2, 0, 5.5 * UPM, 0, 1);

    // 北墙（朝 -z）与南墙（朝 +z）
    wallScreen(14, 3.2, -9, 1.6, WZ - 0.13, Math.PI, 0, 14 * UPM, 0, 1);
    wallScreen(14, 3.2, -9, 1.6, SZ + 0.13, 0, 0, 14 * UPM, 0, 1);
    // 东墙（朝 -x）：门洞两侧 + 门楣
    wallScreen(1.5, 3.2, L.innerX - 0.11, 1.6, SZ + 0.75, -Math.PI / 2,
      0, 1.5 * UPM, 0, 1);
    wallScreen(2, 3.2, L.innerX - 0.11, 1.6, WZ - 1.0, -Math.PI / 2,
      3.5 * UPM, 5.5 * UPM, 0, 1);
    wallScreen(DOOR_W * 2, 3.2 - DOOR_H, L.innerX - 0.11, (3.2 + DOOR_H) / 2, 0,
      -Math.PI / 2, 1.5 * UPM, 3.5 * UPM, DOOR_H / 3.2, 1);
    // 天花（朝 -y）：天幕
    var ceilMesh = new T.Mesh(new T.PlaneGeometry(14, 5.5), ceilMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(-9, L.h - 0.012, 0.25);
    scene.add(ceilMesh);

    // ---- 场景控制面板（放在房间中部，离开门洞）----
    var PANEL_X = -5.6, PANEL_Z = -1.45;
    scene.add(H.box(0.5, 0.92, 0.36, mats.darkMetal, PANEL_X, 0.46, PANEL_Z));
    H.physics.add(PANEL_X - 0.27, PANEL_Z - 0.2, PANEL_X + 0.27, PANEL_Z + 0.2, 0, 0.92, 'panel');
    var panelScr = H.createScreenCanvas(256, 384);
    var pMesh = new T.Mesh(new T.PlaneGeometry(0.28, 0.42), new T.MeshBasicMaterial({ map: panelScr.texture }));
    pMesh.position.set(PANEL_X, 0.88, PANEL_Z + 0.19);
    pMesh.rotation.x = -0.3;
    scene.add(pMesh);
    var statusRing = new T.Mesh(new T.RingGeometry(1.1, 1.24, 48),
      new T.MeshBasicMaterial({ color: 0x8fb6ff, transparent: true, opacity: 0.35, side: T.DoubleSide }));
    statusRing.rotation.x = -Math.PI / 2;
    statusRing.position.set(PANEL_X, 0.012, PANEL_Z);
    scene.add(statusRing);

    function drawPanel(idx, name) {
      var sc = panelScr, g = sc.ctx, w = sc.canvas.width, h = sc.canvas.height;
      g.fillStyle = '#050c14';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,200,255,0.4)';
      g.lineWidth = 2;
      g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = 'rgba(150,220,255,0.85)';
      g.font = '600 20px "PingFang SC", system-ui, sans-serif';
      g.fillText('场景', 20, 40);
      g.fillStyle = '#ffffff';
      g.font = '700 34px "PingFang SC", system-ui, sans-serif';
      g.fillText(name, 20, 86);
      for (var i = 0; i < BED_SCENES.length; i++) {
        var y = 108 + i * 50;
        var on = i === idx;
        g.fillStyle = on ? 'rgba(120,200,255,0.22)' : 'rgba(255,255,255,0.05)';
        g.fillRect(16, y, w - 32, 40);
        if (on) {
          g.strokeStyle = 'rgba(140,220,255,0.85)';
          g.lineWidth = 2;
          g.strokeRect(16, y, w - 32, 40);
        }
        g.fillStyle = on ? '#bfeaff' : 'rgba(220,235,250,0.65)';
        g.font = '600 20px "PingFang SC", system-ui, sans-serif';
        g.fillText(BED_SCENES[i].name, 30, y + 27);
      }
      g.fillStyle = 'rgba(150,200,230,0.5)';
      g.font = '400 16px "PingFang SC", system-ui, sans-serif';
      g.fillText('按 E 切换', 20, h - 16);
      sc.texture.needsUpdate = true;
    }

    var idx = 0;
    function applyScene(i, silent) {
      idx = i;
      var s = BED_SCENES[i];
      uni.uMode.value = i;
      drawPanel(i, s.name);
      if (H.bedroomLight) H.bedroomLight.color.setHex(s.light);
      if (H.bedroomStrip) H.bedroomStrip.material.color.setHex(s.strip);
      statusRing.material.color.setHex(s.strip);
      H.Audio.setRain(s.key === 'rain', 0.10);
      if (!silent) H.emit('bedroom:scene', s);
    }
    applyScene(0, true);

    addInteract(PANEL_X, PANEL_Z + 0.9, 2.4, '切换卧室场景', function () {
      applyScene((idx + 1) % BED_SCENES.length, false);
      H.Audio.click(760);
    });

    return {
      update: function (dt, time) {
        uni.uTime.value = time;
        statusRing.material.opacity = 0.22 + 0.12 * Math.sin(time * 1.6);
        // 展示柜里的全息摆件与晶体，给静止的柜子一点活气
        holo.rotation.y += dt * 0.7;
        holo.rotation.x += dt * 0.25;
        holo.position.y = 1.80 + Math.sin(time * 1.4) * 0.012;
        crystal.rotation.y += dt * 0.35;

        // 多功能椅：底座收起 / 弧轨展开 / 靠背后翻 / 脚托伸出
        var st = loungeState;
        st.rock = H.damp(st.rock, loungeMode === 1 ? 1 : 0, 5, dt);
        st.recline = H.damp(st.recline, loungeMode === 2 ? 1 : 0, 3.6, dt);
        var srock = Math.max(0.02, 1 - st.rock * 0.98);
        pedestal.scale.set(srock, srock, srock);
        rocker.scale.z = 0.04 + st.rock * 0.96;
        rocker.visible = st.rock > 0.02;
        rmounts.scale.y = 0.02 + st.rock * 0.98;
        rmounts.visible = st.rock > 0.02;
        rockPivot.rotation.x = Math.sin(time * 1.25) * 0.06 * st.rock;
        backPivot.rotation.x = -0.12 - st.recline * 0.74 - st.rock * 0.05;
        footRest.position.z = st.recline * 0.56;
      },
      loungeMode: function () { return LOUNGE_MODES[loungeMode]; },
      sceneIndex: function () { return idx; },
      sceneName: function () { return BED_SCENES[idx].name; },
      cycle: function () { applyScene((idx + 1) % BED_SCENES.length, false); }
    };
  };

  /* =======================================================================
   *  卫生间：白色石材 + 发光淋浴房 + 悬浮台盆 + 背光镜（玄关东北角）
   * ===================================================================== */
  H.buildBath = function () {
    mats = H.mats;
    var scene = H.scene;

    /* ---- 房间范围（内壁）---- */
    var X0 = 10.05, X1 = 13.88;
    var Z0 = -7.88, Z1 = -4.67;
    var WT2 = 0.12;
    var DX0 = 11.30, DX1 = 12.20, DH = 2.15;   // 门洞

    /* ---- 材质 ---- */
    // 白瓷砖贴图：几乎纯白 + 细板缝（复用 marble 会发灰）
    function tileTex(n) {
      var c = H.tex.canvas(256), g = c.getContext('2d');
      g.fillStyle = '#fcfdff';
      g.fillRect(0, 0, 256, 256);
      for (var i = 0; i < 620; i++) {
        g.fillStyle = 'rgba(228,235,243,' + (0.12 + Math.random() * 0.22).toFixed(2) + ')';
        g.fillRect(Math.random() * 256, Math.random() * 256,
          2 + Math.random() * 7, 1 + Math.random() * 3);
      }
      g.strokeStyle = 'rgba(208,218,228,0.85)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, 0.75); g.lineTo(256, 0.75);
      g.moveTo(0.75, 0); g.lineTo(0.75, 256);
      g.stroke();
      var t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(n, n);
      return t;
    }
    // 纯白 + 强灯光会直接过曝成一片糊，基色压到浅灰，靠环境反射还原「白瓷砖」
    var floorMat = new T.MeshStandardMaterial({
      map: tileTex(4), color: 0xc8d2dc, roughness: 0.16, metalness: 0.10, envMapIntensity: 1.3
    });
    var tileMat = new T.MeshStandardMaterial({
      map: tileTex(5), color: 0xccd5de, roughness: 0.26, metalness: 0.05, envMapIntensity: 0.9
    });
    var shellMat = new T.MeshStandardMaterial({
      color: 0xd5d2cc, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.6,
      emissive: 0xf2ece2, emissiveIntensity: 0.08   // 门厅侧背光，补一点自发光免得掉成一片蓝
    });
    var porcelain = new T.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.12, metalness: 0.05, envMapIntensity: 1.4 });
    // 有了环境贴图，镀铬可以真的金属化
    var chrome = new T.MeshStandardMaterial({ color: 0xdce6f0, roughness: 0.14, metalness: 0.92, envMapIntensity: 1.8 });
    var glassMat = new T.MeshStandardMaterial({
      color: 0xdff2ff, transparent: true, opacity: 0.18,
      roughness: 0.04, metalness: 0.2, depthWrite: false
    });
    var edgeGlow = new T.MeshBasicMaterial({ color: 0xeafcff, transparent: true, opacity: 0.9 });
    var warmGlow = new T.MeshBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.8 });
    var coolGlow = new T.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.6 });

    /* ---- 隔墙 ---- */
    // 西隔墙（z 从北墙到南隔墙外皮）
    scene.add(H.box(WT2, 3.2, Z1 - Z0 + WT2, shellMat, X0 - WT2 / 2, 1.6, (Z0 + Z1 - WT2) / 2));
    H.physics.add(X0 - WT2, Z0, X0, Z1 + WT2, 0, 3.2, 'bath-wall');

    // 南隔墙：门洞两侧 + 门楣
    scene.add(H.box(DX0 - (X0 - WT2), 3.2, WT2, shellMat, (X0 - WT2 + DX0) / 2, 1.6, Z1 + WT2 / 2));
    scene.add(H.box(X1 - DX1, 3.2, WT2, shellMat, (DX1 + X1) / 2, 1.6, Z1 + WT2 / 2));
    var bathLintel = H.box(DX1 - DX0, 3.2 - DH, WT2, shellMat, (DX0 + DX1) / 2, DH + (3.2 - DH) / 2, Z1 + WT2 / 2);
    bathLintel.castShadow = false;   // 门楣投影会在门洞上方压出一条黑带
    scene.add(bathLintel);
    H.physics.add(X0 - WT2, Z1, DX0, Z1 + WT2, 0, 3.2, 'bath-wall');
    H.physics.add(DX1, Z1, X1, Z1 + WT2, 0, 3.2, 'bath-wall');
    H.physics.add(DX0, Z1, DX1, Z1 + WT2, DH, 3.2, 'bath-wall');

    // 门洞金属门套
    scene.add(H.box(0.05, DH, 0.14, chrome, DX0 + 0.025, DH / 2, Z1 + WT2 / 2));
    scene.add(H.box(0.05, DH, 0.14, chrome, DX1 - 0.025, DH / 2, Z1 + WT2 / 2));
    scene.add(H.box(DX1 - DX0, 0.05, 0.14, chrome, (DX0 + DX1) / 2, DH - 0.025, Z1 + WT2 / 2));
    // 门洞上口内衬：朝下的面接不到光会发黑，铺一块微亮板
    var soffitMat = new T.MeshStandardMaterial({
      color: 0xf2ece2, roughness: 0.72, metalness: 0.02,
      emissive: 0xf7efe2, emissiveIntensity: 0.46
    });
    var bathSoffit = H.box(DX1 - DX0 - 0.02, 0.018, WT2, soffitMat,
      (DX0 + DX1) / 2, DH - 0.059, Z1 + WT2 / 2);
    bathSoffit.castShadow = false; bathSoffit.receiveShadow = false;
    scene.add(bathSoffit);

    // 磨砂玻璃自动移门（走近自动滑进墙里）
    var doorGlass = new T.MeshStandardMaterial({
      color: 0xe6eff8, transparent: true, opacity: 0.45, roughness: 0.6, metalness: 0.05
    });
    H.buildAutoDoor({
      x: (DX0 + DX1) / 2, z: Z1 + WT2 / 2 + 0.01,
      w: 0.90, h: 2.12, dir: 'x', leaves: 1, thick: WT2,
      panel: doorGlass, frame: false, track: false
    });

    /* ---- 地面 / 天花 / 内壁瓷砖 ---- */
    var fl = new T.Mesh(new T.PlaneGeometry(X1 - X0, Z1 - Z0), floorMat);
    fl.rotation.x = -Math.PI / 2;
    fl.position.set((X0 + X1) / 2, 0.014, (Z0 + Z1) / 2);
    fl.receiveShadow = true;
    scene.add(fl);

    var ceilP = new T.Mesh(new T.PlaneGeometry(X1 - X0, Z1 - Z0),
      new T.MeshStandardMaterial({ color: 0xf4f7fa, roughness: 0.72, metalness: 0.02 }));
    ceilP.rotation.x = Math.PI / 2;
    ceilP.position.set((X0 + X1) / 2, 3.19, (Z0 + Z1) / 2);
    scene.add(ceilP);

    function tilePlane(w, h, x, y, z, ry) {
      var p = new T.Mesh(new T.PlaneGeometry(w, h), tileMat);
      p.position.set(x, y, z);
      if (ry) p.rotation.y = ry;
      p.receiveShadow = true;
      scene.add(p);
      return p;
    }
    tilePlane(Z1 - Z0, 3.16, X0 + 0.004, 1.58, (Z0 + Z1) / 2, Math.PI / 2);   // 西
    tilePlane(Z1 - Z0, 3.16, X1 - 0.004, 1.58, (Z0 + Z1) / 2, -Math.PI / 2);  // 东
    tilePlane(X1 - X0, 3.16, (X0 + X1) / 2, 1.58, Z0 + 0.004, 0);             // 北
    tilePlane(DX0 - X0, 3.16, (X0 + DX0) / 2, 1.58, Z1 - 0.004, Math.PI);     // 南（左）
    tilePlane(X1 - DX1, 3.16, (DX1 + X1) / 2, 1.58, Z1 - 0.004, Math.PI);     // 南（右）

    /* ---- 淋浴房（西北角，玻璃正/侧两面，边框发光）---- */
    var SX0 = 10.09, SX1 = 11.44, SZ0 = -7.84, SZ1 = -6.56;
    var SCX = (SX0 + SX1) / 2, SCZ = (SZ0 + SZ1) / 2;
    var SW = SX1 - SX0, SD = SZ1 - SZ0;

    // 底盘
    scene.add(H.box(SW, 0.075, SD, porcelain, SCX, 0.038, SCZ));
    scene.add(H.box(SW - 0.10, 0.02, SD - 0.10,
      new T.MeshStandardMaterial({ color: 0xe6ecf1, roughness: 0.5 }), SCX, 0.076, SCZ));
    // 地漏
    scene.add(H.box(0.16, 0.008, 0.05, chrome, SCX, 0.088, SZ1 - 0.26));

    // 玻璃：正面（朝 +z）+ 右侧（朝 +x）
    var gFront = new T.Mesh(new T.PlaneGeometry(SW, 2.0), glassMat);
    gFront.position.set(SCX, 1.10, SZ1);
    gFront.renderOrder = 2;
    scene.add(gFront);
    var gSide = new T.Mesh(new T.PlaneGeometry(SD, 2.0), glassMat);
    gSide.position.set(SX1, 1.10, SCZ);
    gSide.rotation.y = Math.PI / 2;
    gSide.renderOrder = 2;
    scene.add(gSide);

    // 边框 + 发光边条
    scene.add(H.box(SW + 0.02, 0.035, 0.04, chrome, SCX, 2.12, SZ1));
    scene.add(H.box(0.04, 0.035, SD + 0.02, chrome, SX1, 2.12, SCZ));
    scene.add(H.box(0.035, 2.02, 0.035, chrome, SX0 + 0.02, 1.10, SZ1));
    scene.add(H.box(0.035, 2.02, 0.035, chrome, SX1, 1.10, SZ1));
    scene.add(H.box(0.035, 2.02, 0.035, chrome, SX1, 1.10, SZ0 + 0.02));
    // 门缝竖梃 + 把手
    scene.add(H.box(0.026, 2.0, 0.028, chrome, SCX + 0.02, 1.10, SZ1));
    scene.add(H.box(0.022, 0.30, 0.05, chrome, SCX + 0.20, 1.16, SZ1 + 0.03));
    // 边条灯：上沿 + 立边
    scene.add(H.glowStrip(SW, 0.010, 0.016, SCX, 2.138, SZ1, edgeGlow));
    scene.add(H.glowStrip(0.010, 2.02, 0.016, SX1 + 0.018, 1.10, SZ1, edgeGlow));
    scene.add(H.glowStrip(0.016, 0.010, SD, SX1 - 0.018, 2.138, SCZ, edgeGlow));

    // 顶喷 + 支臂：横臂从墙面伸出，再下垂接喷头，否则喷头会凭空浮着
    var arm = new T.Mesh(new T.CylinderGeometry(0.017, 0.017, 0.34, 12), chrome);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(SCX, 2.185, SZ0 + 0.17);
    scene.add(arm);
    var flange = new T.Mesh(new T.CylinderGeometry(0.048, 0.048, 0.022, 14), chrome);
    flange.rotation.x = Math.PI / 2;
    flange.position.set(SCX, 2.185, SZ0 + 0.014);
    scene.add(flange);
    scene.add(H.box(0.034, 0.14, 0.034, chrome, SCX, 2.120, SZ0 + 0.32));
    var head = new T.Mesh(new T.CylinderGeometry(0.115, 0.105, 0.016, 22), chrome);
    head.position.set(SCX, 2.05, SZ0 + 0.32);
    scene.add(head);
    var headGlow = new T.Mesh(new T.CircleGeometry(0.10, 22),
      new T.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.35 }));
    headGlow.rotation.x = Math.PI / 2;
    headGlow.position.set(SCX, 2.040, SZ0 + 0.32);
    scene.add(headGlow);

    // 侧喷面板（北墙内侧）
    scene.add(H.box(0.26, 0.68, 0.035,
      new T.MeshStandardMaterial({ color: 0xaeb9c6, roughness: 0.3, metalness: 0.45 }),
      SCX - 0.34, 1.34, SZ0 + 0.03));
    for (var jr = 0; jr < 3; jr++) {
      for (var jc = 0; jc < 2; jc++) {
        var jet = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.012, 10), chrome);
        jet.rotation.x = Math.PI / 2;
        jet.position.set(SCX - 0.42 + jc * 0.14, 1.56 - jr * 0.20, SZ0 + 0.052);
        scene.add(jet);
      }
    }

    // 手持花洒：立杆 + 头
    scene.add(H.box(0.028, 0.86, 0.028, chrome, SX1 - 0.10, 1.42, SZ0 + 0.04));
    var hand = new T.Mesh(new T.CylinderGeometry(0.042, 0.050, 0.03, 14), chrome);
    hand.position.set(SX1 - 0.10, 1.66, SZ0 + 0.10);
    hand.rotation.x = 0.5;
    scene.add(hand);

    /* ---- 淋浴水流（可开关）---- */
    var water = new T.Group();
    water.position.set(SCX, 2.02, SZ0 + 0.32);
    var wc = H.tex.canvas(32, 128), wg = wc.getContext('2d');
    var wgr = wg.createLinearGradient(0, 0, 0, 128);
    wgr.addColorStop(0, 'rgba(226,246,255,0.60)');
    wgr.addColorStop(0.55, 'rgba(208,240,255,0.26)');
    wgr.addColorStop(1, 'rgba(200,236,255,0.0)');
    wg.fillStyle = wgr;
    wg.fillRect(0, 0, 32, 128);
    var wtex = new T.CanvasTexture(wc);
    wtex.colorSpace = T.SRGBColorSpace;
    var wMat = new T.MeshBasicMaterial({
      map: wtex, color: 0xa8d8ef, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false
    });
    var sheet = new T.Mesh(new T.CylinderGeometry(0.22, 0.30, 1.90, 18, 1, true), wMat);
    sheet.position.y = -0.95;
    water.add(sheet);
    var streaks = [];
    var sMat = new T.MeshBasicMaterial({ color: 0xc9e9fb, transparent: true, opacity: 0.5, depthWrite: false });
    for (var si = 0; si < 16; si++) {
      var ang = si / 16 * Math.PI * 2;
      var rr = 0.04 + (si % 4) * 0.052;
      var stk = H.box(0.006, 0.26, 0.006, sMat,
        Math.cos(ang) * rr, -0.15 - (si % 6) * 0.30, Math.sin(ang) * rr);
      stk.castShadow = false;
      water.add(stk);
      streaks.push(stk);
    }
    water.visible = false;
    scene.add(water);

    /* ---- 壁挂马桶（西墙）---- */
    var WC_Z = -5.80;
    // 背光壁龛板（参考图里马桶后方的发光面板）
    scene.add(H.box(0.012, 1.05, 0.94, new T.MeshStandardMaterial({
      color: 0xeaf3fa, emissive: 0x9ccbe8, emissiveIntensity: 0.20,
      roughness: 0.45, metalness: 0.05
    }), X0 + 0.020, 1.02, WC_Z));
    scene.add(H.glowStrip(0.012, 0.014, 0.94, X0 + 0.034, 0.50, WC_Z, coolGlow));
    scene.add(H.glowStrip(0.012, 0.014, 0.94, X0 + 0.034, 1.54, WC_Z, coolGlow));

    // 冲水面板（水箱藏在墙里，只留面板）
    var plate = H.box(0.02, 0.15, 0.26, chrome, X0 + 0.05, 1.10, WC_Z);
    scene.add(plate);
    [[-0.045, 0.045], [0.045, 0.045]].forEach(function (p) {
      var b = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.008, 14),
        new T.MeshStandardMaterial({ color: 0xc3ced9, roughness: 0.3, metalness: 0.3 }));
      b.rotation.z = Math.PI / 2;
      b.position.set(X0 + 0.062, 1.10 + p[0], WC_Z + p[1]);
      scene.add(b);
    });

    // 盆体：上宽下窄的椭圆碗，靠墙再用一段短箱体接住
    var bowl = new T.Mesh(new T.CylinderGeometry(0.178, 0.112, 0.22, 26), porcelain);
    bowl.scale.set(1.26, 1, 1);
    bowl.position.set(X0 + 0.280, 0.370, WC_Z);
    bowl.castShadow = true;
    scene.add(bowl);
    scene.add(H.box(0.11, 0.19, 0.22, porcelain, X0 + 0.045, 0.375, WC_Z));

    // 座圈（椭圆，边缘略微外挑）
    var seat = new T.Mesh(new T.CylinderGeometry(0.186, 0.186, 0.028, 26), porcelain);
    seat.scale.set(1.24, 1, 1.02);
    seat.position.set(X0 + 0.285, 0.494, WC_Z);
    scene.add(seat);
    var seatHole = new T.Mesh(new T.CylinderGeometry(0.118, 0.118, 0.016, 22),
      new T.MeshStandardMaterial({ color: 0xc8d3de, roughness: 0.45 }));
    seatHole.scale.set(1.30, 1, 0.95);
    seatHole.position.set(X0 + 0.305, 0.497, WC_Z);
    scene.add(seatHole);

    // 盖板（立起，铰接在座圈后端，微微后仰）
    var lid = H.box(0.028, 0.38, 0.30, porcelain, X0 + 0.100, 0.695, WC_Z);
    lid.rotation.z = 0.09;
    scene.add(lid);
    // 铰链：横轴 + 两侧支座
    var hinge = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.18, 12), chrome);
    hinge.rotation.x = Math.PI / 2;
    hinge.position.set(X0 + 0.088, 0.505, WC_Z);
    scene.add(hinge);
    [-0.075, 0.075].forEach(function (hz) {
      scene.add(H.box(0.048, 0.038, 0.040, porcelain, X0 + 0.088, 0.490, WC_Z + hz));
    });
    H.physics.add(X0, WC_Z - 0.22, X0 + 0.52, WC_Z + 0.22, 0, 0.6, 'wc');
    H.shadowBlob(X0 + 0.30, WC_Z, 0.34, 0.28, 0.5).position.y = 0.02;

    /* ---- 悬浮台盆柜（东墙）---- */
    var VC_Z0 = -7.45, VC_Z1 = -5.70, VC_Z = (VC_Z0 + VC_Z1) / 2, VC_L = VC_Z1 - VC_Z0;
    var cabMat = new T.MeshStandardMaterial({ color: 0xe4e9ef, roughness: 0.4, metalness: 0.08 });
    scene.add(H.box(0.46, 0.44, VC_L, cabMat, X1 - 0.23, 0.60, VC_Z));
    // 抽屉缝 + 拉手槽
    scene.add(H.box(0.008, 0.012, VC_L - 0.04,
      new T.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.5 }), X1 - 0.462, 0.60, VC_Z));
    scene.add(H.box(0.02, 0.026, VC_L - 0.10,
      new T.MeshStandardMaterial({ color: 0x8d99a6, roughness: 0.5, metalness: 0.15 }),
      X1 - 0.462, 0.735, VC_Z));
    // 柜底灯带
    scene.add(H.glowStrip(0.42, 0.008, VC_L - 0.06, X1 - 0.23, 0.377, VC_Z, warmGlow));

    // 台面 + 一体盆
    scene.add(H.box(0.50, 0.05, VC_L + 0.06, porcelain, X1 - 0.25, 0.845, VC_Z));
    scene.add(H.box(0.30, 0.022, 0.56, new T.MeshStandardMaterial({
      color: 0xeef3f8, roughness: 0.22, metalness: 0.05
    }), X1 - 0.26, 0.862, VC_Z));
    scene.add(H.box(0.26, 0.006, 0.48, new T.MeshStandardMaterial({
      color: 0xdae3ec, roughness: 0.18
    }), X1 - 0.26, 0.871, VC_Z));

    // 龙头
    var faucet = new T.Mesh(new T.CylinderGeometry(0.015, 0.017, 0.24, 12), chrome);
    faucet.position.set(X1 - 0.115, 0.97, VC_Z);
    scene.add(faucet);
    scene.add(H.box(0.15, 0.019, 0.019, chrome, X1 - 0.185, 1.085, VC_Z));
    scene.add(H.box(0.019, 0.045, 0.019, chrome, X1 - 0.255, 1.062, VC_Z));

    // 台面小物：漱口杯 + 洗手液
    var cupG = new T.Mesh(new T.CylinderGeometry(0.036, 0.031, 0.10, 16), porcelain);
    cupG.position.set(X1 - 0.30, 0.925, VC_Z + 0.44);
    scene.add(cupG);
    var soap = new T.Mesh(new T.CylinderGeometry(0.032, 0.035, 0.15, 14),
      new T.MeshStandardMaterial({ color: 0x8fb7c9, roughness: 0.3, metalness: 0.1 }));
    soap.position.set(X1 - 0.30, 0.95, VC_Z + 0.62);
    scene.add(soap);

    H.physics.add(X1 - 0.50, VC_Z0, X1, VC_Z1, 0, 0.9, 'vanity');

    /* ---- 软装：地垫 / 毛巾 / 绿植，避免整间只剩白盒子 ---- */
    // 毛巾 / 地垫用灰蓝，纯白贴在白墙上会直接消失
    var clothMat = new T.MeshStandardMaterial({ color: 0xb7c8d8, roughness: 0.96, metalness: 0.02 });
    var clothMat2 = new T.MeshStandardMaterial({ color: 0x8fa6ba, roughness: 0.96 });

    // 淋浴前的地垫
    scene.add(H.box(1.18, 0.018, 0.66, clothMat2, 11.32, 0.026, -6.06));
    scene.add(H.box(1.10, 0.010, 0.58, clothMat, 11.32, 0.036, -6.06));

    // 北墙毛巾杆 + 搭着的毛巾
    var TR_X = 12.66, TR_Y = 1.46, TR_Z = Z0 + 0.055;
    scene.add(H.box(0.60, 0.022, 0.022, chrome, TR_X, TR_Y, TR_Z));
    [-0.28, 0.28].forEach(function (ox) {
      scene.add(H.box(0.022, 0.022, 0.055, chrome, TR_X + ox, TR_Y, TR_Z - 0.020));
      scene.add(H.box(0.032, 0.032, 0.020, chrome, TR_X + ox, TR_Y, Z0 + 0.010));
    });
    // 毛巾顶边略高过横杆，杆两端的头露出来，才像搭在杆上而不是贴在墙上
    scene.add(H.box(0.46, 0.68, 0.028, clothMat, TR_X - 0.06, TR_Y - 0.30, TR_Z + 0.030));
    // 顶端的卷边：一条圆棒，读起来才是"搭"在杆上
    var roll = new T.Mesh(new T.CylinderGeometry(0.030, 0.030, 0.46, 12), clothMat);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(TR_X - 0.06, TR_Y + 0.010, TR_Z + 0.040);
    scene.add(roll);
    scene.add(H.box(0.46, 0.045, 0.032, clothMat2, TR_X - 0.06, TR_Y - 0.585, TR_Z + 0.030));

    // 台面北端的折叠毛巾
    scene.add(H.box(0.24, 0.045, 0.34, clothMat2, X1 - 0.245, 0.882, VC_Z - 0.70));
    scene.add(H.box(0.22, 0.040, 0.32, clothMat, X1 - 0.245, 0.924, VC_Z - 0.70));

    // 门边地上的绿植
    var potG = new T.Mesh(new T.CylinderGeometry(0.088, 0.072, 0.30, 16),
      new T.MeshStandardMaterial({ color: 0xd3dae3, roughness: 0.4, metalness: 0.18 }));
    potG.position.set(13.56, 0.15, -4.98);
    potG.castShadow = true;
    scene.add(potG);
    var leafMat = new T.MeshStandardMaterial({ color: 0x3f7f5c, roughness: 0.72 });
    for (var li = 0; li < 7; li++) {
      var la = li / 7 * Math.PI * 2;
      var lf = new T.Mesh(new T.ConeGeometry(0.032, 0.30 + (li % 3) * 0.10, 6), leafMat);
      lf.position.set(13.56 + Math.cos(la) * 0.06, 0.40 + (li % 3) * 0.05, -4.98 + Math.sin(la) * 0.06);
      lf.rotation.z = Math.cos(la) * 0.42;
      lf.rotation.x = -Math.sin(la) * 0.42;
      scene.add(lf);
    }
    H.physics.add(13.42, -5.12, 13.70, -4.84, 0, 0.4, 'plant');

    /* ---- 背光镜（东墙，两块镜门）---- */
    var msc = H.createScreenCanvas(640, 432);
    (function (sc) {
      var g = sc.ctx, w = sc.canvas.width, h = sc.canvas.height;
      // 没有真实反射，用冷调渐变 + 斜向高光模拟镜面，别做成一块发光板
      var grd = g.createLinearGradient(0, 0, w * 0.7, h);
      grd.addColorStop(0, '#8d9fb2');
      grd.addColorStop(0.34, '#b9c8d6');
      grd.addColorStop(0.52, '#dbe6ef');
      grd.addColorStop(0.70, '#a9bacb');
      grd.addColorStop(1, '#6d8093');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      // 斜向高光
      var hl = g.createLinearGradient(w * 0.1, 0, w * 0.55, h);
      hl.addColorStop(0, 'rgba(255,255,255,0)');
      hl.addColorStop(0.42, 'rgba(255,255,255,0.20)');
      hl.addColorStop(0.56, 'rgba(255,255,255,0.04)');
      hl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = hl;
      g.fillRect(0, 0, w, h);
      // 门缝
      g.fillStyle = 'rgba(96,112,128,0.55)';
      g.fillRect(w / 2 - 1, 0, 2, h);
      // 智能信息（底色压深了，白字才看得见）
      g.textAlign = 'left';
      g.shadowColor = 'rgba(40,58,76,0.55)';
      g.shadowBlur = 6;
      g.fillStyle = 'rgba(250,253,255,0.97)';
      g.font = '600 27px "PingFang SC", system-ui, sans-serif';
      g.fillText('水温 36℃', w * 0.55, h * 0.40);
      g.fillText('空气 优', w * 0.55, h * 0.52);
      g.fillStyle = 'rgba(240,248,255,0.82)';
      g.font = '500 23px "PingFang SC", system-ui, sans-serif';
      g.fillText('日程 20:30 电影', w * 0.55, h * 0.63);
      sc.texture.needsUpdate = true;
    })(msc);

    var mirror = new T.Mesh(new T.PlaneGeometry(VC_L - 0.10, 1.06),
      new T.MeshBasicMaterial({ map: msc.texture }));
    mirror.position.set(X1 - 0.012, 1.74, VC_Z);
    mirror.rotation.y = -Math.PI / 2;
    scene.add(mirror);

    // 镜框：细金属边
    var MW = VC_L - 0.10, MH = 1.06;
    scene.add(H.box(0.014, MH + 0.03, 0.012, chrome, X1 - 0.018, 1.74, VC_Z - MW / 2 - 0.008));
    scene.add(H.box(0.014, MH + 0.03, 0.012, chrome, X1 - 0.018, 1.74, VC_Z + MW / 2 + 0.008));
    scene.add(H.box(0.014, 0.012, MW + 0.03, chrome, X1 - 0.018, 1.74 + MH / 2 + 0.008, VC_Z));
    scene.add(H.box(0.014, 0.012, MW + 0.03, chrome, X1 - 0.018, 1.74 - MH / 2 - 0.008, VC_Z));
    scene.add(H.glowStrip(0.012, 0.012, MW + 0.03, X1 - 0.016, 1.74 + MH / 2, VC_Z, warmGlow));
    scene.add(H.glowStrip(0.012, 0.012, MW + 0.03, X1 - 0.016, 1.74 - MH / 2, VC_Z, warmGlow));
    scene.add(H.glowStrip(0.012, MH, 0.012, X1 - 0.016, 1.74, VC_Z - MW / 2, warmGlow));
    scene.add(H.glowStrip(0.012, MH, 0.012, X1 - 0.016, 1.74, VC_Z + MW / 2, warmGlow));

    /* ---- 天花：洗墙灯带 + 淋浴区灯盘 ---- */
    scene.add(H.glowStrip(X1 - X0 - 0.08, 0.012, 0.028, (X0 + X1) / 2, 3.02, Z0 + 0.05, warmGlow));
    scene.add(H.glowStrip(X1 - X0 - 0.08, 0.012, 0.028, (X0 + X1) / 2, 3.02, Z1 - 0.05, warmGlow));
    scene.add(H.glowStrip(0.028, 0.012, Z1 - Z0 - 0.1, X0 + 0.05, 3.02, (Z0 + Z1) / 2, warmGlow));
    scene.add(H.glowStrip(0.028, 0.012, Z1 - Z0 - 0.1, X1 - 0.05, 3.02, (Z0 + Z1) / 2, warmGlow));

    // 淋浴区顶灯（带风口质感）
    scene.add(H.box(0.52, 0.035, 0.52,
      new T.MeshStandardMaterial({ color: 0xb7c1cd, roughness: 0.42, metalness: 0.25 }),
      SCX, 3.16, SCZ + 0.06));
    scene.add(H.box(0.46, 0.014, 0.46, new T.MeshBasicMaterial({ color: 0xf2fbff }), SCX, 3.14, SCZ + 0.06));
    // 台盆上方筒灯
    scene.add(H.box(0.16, 0.012, 0.16, new T.MeshBasicMaterial({ color: 0xfff3e4 }), X1 - 0.42, 3.15, VC_Z));

    /* ---- 灯 ---- */
    var keyLight = new T.PointLight(0xfff7ee, 6.2, 8.0, 1.8);
    keyLight.position.set(11.95, 2.72, -6.00);
    scene.add(keyLight);
    // 两侧补光：只靠一盏顶灯会在墙上烧出一块死白
    var fillW = new T.PointLight(0xe4f1ff, 1.9, 4.6, 1.8);
    fillW.position.set(10.85, 2.05, -5.70);
    scene.add(fillW);
    var fillE = new T.PointLight(0xfff0e4, 2.4, 4.6, 1.8);
    fillE.position.set(13.35, 2.00, -6.30);
    scene.add(fillE);

    if (H.QUALITY.name !== 'low') {
      var showerLight = new T.PointLight(0xcfe8ff, 1.6, 3.4, 2.0);
      showerLight.position.set(SCX, 2.34, SCZ);
      scene.add(showerLight);
    }

    /* ---- 交互：开 / 关淋浴 ---- */
    var wet = 0, wetTarget = 0;
    var bathIt = addInteract(11.72, -6.05, 1.6, '淋浴 · 开启', function () {
      wetTarget = wetTarget ? 0 : 1;
      bathIt.label = wetTarget ? '淋浴 · 关闭' : '淋浴 · 开启';
      H.Audio.click(wetTarget ? 900 : 620);
    });

    return {
      update: function (dt, time) {
        wet = H.damp(wet, wetTarget, 3.4, dt);

        water.visible = wet > 0.02;
        water.scale.y = 0.25 + wet * 0.75;
        wMat.opacity = 0.55 * wet;
        sMat.opacity = 0.5 * wet;
        if (wet > 0.02) {
          for (var i = 0; i < streaks.length; i++) {
            var s = streaks[i];
            s.position.y -= dt * (1.5 + (i % 3) * 0.28);
            if (s.position.y < -1.95) s.position.y = -0.06;
          }
        }

        // 水汽：顶灯轻微呼吸
        headGlow.material.opacity = 0.22 + wet * 0.2 + Math.sin(time * 2.1) * 0.03;
      },
      wet: function () { return wetTarget === 1; }
    };
  };

  /* =======================================================================
   *  智能康养室（客厅西侧空白带：x -1.88~1.44，z -7.88~-4.42）
   *  南墙内缩，让出客厅通往全息游戏房的门洞
   * ===================================================================== */
  H.buildCare = function () {
    mats = H.mats;
    var scene = H.scene;

    /* ---- 室内净空 ---- */
    var CX0 = -1.88, CX1 = 1.44;
    var CZ0 = -7.88, CZ1 = -4.42;
    var WT3 = 0.12;
    var DW0 = -0.86, DW1 = 0.14, DH3 = 2.12;    // 南墙门洞（x 区间）
    var WX = CX1 + WT3 / 2;                     // 东墙中心 1.50
    var WZ = CZ1 + WT3 / 2;                     // 南墙中心 -4.36

    /* ---- 材质 ---- */
    var cream = new T.MeshStandardMaterial({ color: 0xd8d2c7, roughness: 0.8, metalness: 0.06, envMapIntensity: 0.55 });
    var creamDeep = new T.MeshStandardMaterial({ color: 0xc3bcae, roughness: 0.86, metalness: 0.05, envMapIntensity: 0.5 });
    var podShell = new T.MeshStandardMaterial({ color: 0xf8f9fb, roughness: 0.32, metalness: 0.08 });
    var podShell2 = new T.MeshStandardMaterial({ color: 0xeceff4, roughness: 0.44, metalness: 0.05 });
    var trim = new T.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.26, metalness: 0.36 });
    var cushion = new T.MeshStandardMaterial({ color: 0xe6d9c2, roughness: 0.94, metalness: 0.0 });
    var cushionDeep = new T.MeshStandardMaterial({ color: 0xbf9663, roughness: 0.9, metalness: 0.0 });
    var neon = new T.MeshBasicMaterial({ color: 0x8fe8ff });
    var warmGlow = new T.MeshBasicMaterial({ color: 0xffe4c0 });
    var cyanGlow = new T.MeshBasicMaterial({ color: 0x86dcff, transparent: true, opacity: 0.8 });

    /* ---- 地面（暖白磨光石）---- */
    function stoneTex() {
      var c = H.tex.canvas(512), g = c.getContext('2d');
      g.fillStyle = '#f7f3ec';
      g.fillRect(0, 0, 512, 512);
      for (var i = 0; i < 1100; i++) {
        g.fillStyle = 'rgba(226,218,204,' + (0.08 + Math.random() * 0.22).toFixed(2) + ')';
        g.beginPath();
        g.arc(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 4, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = 'rgba(216,207,192,0.75)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 1); g.lineTo(512, 1);
      g.moveTo(1, 0); g.lineTo(1, 512);
      g.stroke();
      var t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(3, 4.6);
      return t;
    }
    var fl = new T.Mesh(new T.PlaneGeometry(CX1 - CX0, CZ1 - CZ0),
      new T.MeshStandardMaterial({ map: stoneTex(), color: 0xffffff, roughness: 0.22, metalness: 0.06 }));
    fl.rotation.x = -Math.PI / 2;
    fl.position.set((CX0 + CX1) / 2, 0.018, (CZ0 + CZ1) / 2);
    fl.receiveShadow = true;
    scene.add(fl);

    /* ---- 隔墙 ---- */
    // 东墙（客厅侧）
    scene.add(H.box(WT3, 3.2, (WZ + WT3 / 2) - (CZ0 - WT3), cream,
      WX, 1.6, ((CZ0 - WT3) + WZ + WT3 / 2) / 2));
    H.physics.add(CX1, CZ0 - WT3, CX1 + WT3, WZ + WT3 / 2, 0, 3.2, 'care-wall');

    // 南墙：门洞两侧 + 门楣
    scene.add(H.box(DW0 - (CX0 - WT3), 3.2, WT3, cream,
      (CX0 - WT3 + DW0) / 2, 1.6, WZ));
    scene.add(H.box((CX1 + WT3) - DW1, 3.2, WT3, cream,
      (DW1 + CX1 + WT3) / 2, 1.6, WZ));
    var careLintel = H.box(DW1 - DW0, 3.2 - DH3, WT3, cream,
      (DW0 + DW1) / 2, DH3 + (3.2 - DH3) / 2, WZ);
    careLintel.castShadow = false;
    scene.add(careLintel);
    H.physics.add(CX0 - WT3, WZ - WT3 / 2, DW0, WZ + WT3 / 2, 0, 3.2, 'care-wall');
    H.physics.add(DW1, WZ - WT3 / 2, CX1 + WT3, WZ + WT3 / 2, 0, 3.2, 'care-wall');
    H.physics.add(DW0, WZ - WT3 / 2, DW1, WZ + WT3 / 2, DH3, 3.2, 'care-wall');

    // 门套：细白框 + 顶部灯带
    scene.add(H.box(0.05, DH3, 0.10, trim, DW0 + 0.025, DH3 / 2, WZ - 0.01));
    scene.add(H.box(0.05, DH3, 0.10, trim, DW1 - 0.025, DH3 / 2, WZ - 0.01));
    scene.add(H.box(DW1 - DW0, 0.05, 0.10, trim, (DW0 + DW1) / 2, DH3 - 0.025, WZ - 0.01));
    scene.add(H.glowStrip(DW1 - DW0 - 0.06, 0.012, 0.012, (DW0 + DW1) / 2, DH3 - 0.06, WZ - 0.055, warmGlow));
    var careSoffit = H.box(DW1 - DW0 - 0.02, 0.018, WT3, H.mats.softWhite || trim,
      (DW0 + DW1) / 2, DH3 - 0.059, WZ);
    careSoffit.material = new T.MeshStandardMaterial({
      color: 0xf3eee5, roughness: 0.72, metalness: 0.02,
      emissive: 0xf7efe2, emissiveIntensity: 0.40
    });
    careSoffit.castShadow = false; careSoffit.receiveShadow = false;
    scene.add(careSoffit);

    // 磨砂自动移门：走近滑进西侧墙里
    H.buildAutoDoor({
      x: (DW0 + DW1) / 2, z: WZ, w: DW1 - DW0, h: 2.06,
      dir: 'x', leaves: 1, thick: WT3, frame: false
    });

    /* ---- 天花：环光 + 椭圆凹顶 ---- */
    var CPX = -0.20, CPZ = -6.28;
    scene.add((function () {
      var m = new T.Mesh(new T.PlaneGeometry(CX1 - CX0, CZ1 - CZ0),
        new T.MeshStandardMaterial({
          color: 0xf3efe8, roughness: 0.86, metalness: 0.02,
          emissive: 0xf6ead9, emissiveIntensity: 0.30   // 顶板没有光打到，自发光补亮
        }));
      m.rotation.x = Math.PI / 2;
      m.position.set((CX0 + CX1) / 2, 3.188, (CZ0 + CZ1) / 2);
      return m;
    })());
    // 外圈灯环
    var cRing = new T.Mesh(new T.RingGeometry(0.86, 0.99, 64), new T.MeshBasicMaterial({
      color: 0xfff6ea, transparent: true, opacity: 0.95
    }));
    cRing.rotation.x = Math.PI / 2;
    cRing.position.set(CPX, 3.176, CPZ);
    scene.add(cRing);
    // 凹顶椭圆 + 中央冷光
    var oDisc = new T.Mesh(new T.CircleGeometry(0.87, 56), new T.MeshStandardMaterial({
      color: 0xdfeaf4, roughness: 0.7, metalness: 0.02,
      emissive: 0xbfe4ff, emissiveIntensity: 0.55
    }));
    oDisc.rotation.x = Math.PI / 2;
    oDisc.position.set(CPX, 3.170, CPZ);
    oDisc.scale.set(1, 1.18, 1);
    scene.add(oDisc);
    var oGlow = new T.Mesh(new T.CircleGeometry(0.58, 48), new T.MeshBasicMaterial({
      color: 0x9fe4ff, transparent: true, opacity: 0.5
    }));
    oGlow.rotation.x = Math.PI / 2;
    oGlow.position.set(CPX, 3.164, CPZ);
    oGlow.scale.set(1, 1.16, 1);
    scene.add(oGlow);
    // 顶部暖光洗墙
    scene.add(H.glowStrip(CX1 - CX0 - 0.1, 0.012, 0.026, (CX0 + CX1) / 2, 3.02, CZ0 + 0.05, warmGlow));
    scene.add(H.glowStrip(CX1 - CX0 - 0.1, 0.012, 0.026, (CX0 + CX1) / 2, 3.02, CZ1 - 0.05, warmGlow));

    // 北墙：外壳墙是冷灰，补一层暖白，否则舱体背后是一条深色带
    scene.add((function () {
      var m = new T.Mesh(new T.PlaneGeometry(CX1 - CX0, 3.19), cream);
      m.position.set((CX0 + CX1) / 2, 1.595, CZ0 + 0.006);
      m.receiveShadow = true;
      return m;
    })());

    // 西墙（借用客厅隔墙）：贴一层暖白墙板，否则一直是隔墙的冷灰
    scene.add((function () {
      var m = new T.Mesh(new T.PlaneGeometry(CZ1 - CZ0, 3.19), cream);
      m.rotation.y = Math.PI / 2;
      m.position.set(CX0 + 0.006, 1.595, (CZ0 + CZ1) / 2);
      m.receiveShadow = true;
      return m;
    })());

    /* ---- 踢脚暖光 ---- */
    scene.add(H.glowStrip(0.014, 0.014, CZ1 - CZ0 - 0.1, CX0 + 0.02, 0.10, (CZ0 + CZ1) / 2, warmGlow));
    scene.add(H.glowStrip(0.014, 0.014, CZ1 - CZ0 - 0.1, CX1 - 0.02, 0.10, (CZ0 + CZ1) / 2, warmGlow));
    scene.add(H.glowStrip(CX1 - CX0 - 0.1, 0.014, 0.014, (CX0 + CX1) / 2, 0.10, CZ0 + 0.02, warmGlow));

    /* ---- 墙上的身体扫描投影 ---- */
    var holoG = new T.Group();
    // 稍微转向门口，站在门口也能读，而不是贴墙侧看
    holoG.position.set(CX0 + 0.30, 1.62, -6.20);
    holoG.rotation.y = Math.PI / 2 - 0.62;
    scene.add(holoG);

    var hc = H.createScreenCanvas(640, 640);
    function drawHolo(scan) {
      var g = hc.ctx, w = hc.canvas.width, h = hc.canvas.height;
      g.clearRect(0, 0, w, h);
      var cx2 = w / 2, cy2 = h / 2;

      // 外圈：两段弧 + 刻度
      g.strokeStyle = 'rgba(120,220,255,0.65)';
      g.lineWidth = 3;
      g.beginPath(); g.arc(cx2, cy2, w * 0.455, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(150,235,255,0.95)';
      g.lineWidth = 5;
      g.beginPath(); g.arc(cx2, cy2, w * 0.455, -0.5, 1.15); g.stroke();
      g.beginPath(); g.arc(cx2, cy2, w * 0.455, 2.2, 2.65); g.stroke();
      for (var i = 0; i < 60; i++) {
        var a = i / 60 * Math.PI * 2;
        var r0 = w * 0.415, r1 = w * (i % 5 === 0 ? 0.445 : 0.430);
        g.strokeStyle = 'rgba(130,225,255,' + (i % 5 === 0 ? 0.55 : 0.25) + ')';
        g.lineWidth = i % 5 === 0 ? 2 : 1;
        g.beginPath();
        g.moveTo(cx2 + Math.cos(a) * r0, cy2 + Math.sin(a) * r0);
        g.lineTo(cx2 + Math.cos(a) * r1, cy2 + Math.sin(a) * r1);
        g.stroke();
      }

      // 卡片
      var cw = w * 0.62, chh = h * 0.40;
      var cardX = cx2 - cw / 2, cardY = cy2 - chh / 2 + 10;
      g.fillStyle = 'rgba(14,48,74,0.42)';
      g.strokeStyle = 'rgba(140,232,255,0.75)';
      g.lineWidth = 2;
      roundRect(g, cardX, cardY, cw, chh, 18);
      g.fill();
      g.stroke();

      // 标题胶囊
      g.fillStyle = 'rgba(96,206,240,0.92)';
      roundRect(g, cx2 - cw * 0.36, cardY + 16, cw * 0.72, 52, 26);
      g.fill();
      g.fillStyle = '#f4fdff';
      g.font = '600 28px "PingFang SC", system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(scan ? '身体扫描中 …' : '身体扫描完成', cx2, cardY + 43);

      var rows = scan
        ? [['心率', '72 bpm'], ['呼吸', '平稳'], ['预计剩余', '00:48']]
        : [['疲劳指数', '低'], ['建议指数', '低风险'], ['建议放松', '15 分钟']];
      g.textAlign = 'left';
      for (var r = 0; r < 3; r++) {
        var ry = cardY + 108 + r * 62;
        g.fillStyle = 'rgba(130,226,255,0.85)';
        g.beginPath(); g.arc(cardX + 40, ry, 8, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(238,250,255,0.95)';
        g.font = '500 26px "PingFang SC", system-ui, sans-serif';
        g.fillText(rows[r][0], cardX + 62, ry);
        g.textAlign = 'right';
        g.fillStyle = 'rgba(160,240,255,0.95)';
        g.font = '600 26px "PingFang SC", system-ui, sans-serif';
        g.fillText(rows[r][1], cardX + cw - 28, ry);
        g.textAlign = 'left';
      }
      hc.texture.needsUpdate = true;
    }
    function roundRect(g, x, y, w2, h2, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w2, y, x + w2, y + h2, r);
      g.arcTo(x + w2, y + h2, x, y + h2, r);
      g.arcTo(x, y + h2, x, y, r);
      g.arcTo(x, y, x + w2, y, r);
      g.closePath();
    }
    drawHolo(false);

    var holoPlane = new T.Mesh(new T.PlaneGeometry(1.86, 1.86),
      new T.MeshBasicMaterial({ map: hc.texture, transparent: true, opacity: 0.94, depthWrite: false }));
    holoG.add(holoPlane);

    // 悬浮旋转弧，给投影一点动态
    var holoArc = new T.Mesh(new T.RingGeometry(0.66, 0.70, 64, 1, 0, Math.PI * 1.35), cyanGlow);
    holoArc.position.z = 0.03;
    holoG.add(holoArc);
    var holoArc2 = new T.Mesh(new T.RingGeometry(0.78, 0.805, 64, 1, 0, Math.PI * 0.85), cyanGlow);
    holoArc2.position.z = 0.03;
    holoG.add(holoArc2);

    /* ---- 康养舱 ---- */
    var PX = -0.20, PZ = -6.30;
    var pod = new T.Group();
    pod.position.set(PX, 0, PZ);
    scene.add(pod);

    // 地面光带
    var fRing = new T.Mesh(new T.RingGeometry(1.00, 1.09, 64), cyanGlow);
    fRing.rotation.x = -Math.PI / 2;
    fRing.position.y = 0.022;
    fRing.scale.set(1, 1.16, 1);
    pod.add(fRing);

    // 底盘 + 抬升台
    var base = new T.Mesh(new T.CylinderGeometry(1.00, 1.05, 0.08, 48), podShell);
    base.scale.set(1, 1, 1.14);
    base.position.y = 0.058;
    base.castShadow = true;
    pod.add(base);
    var plinth = new T.Mesh(new T.CylinderGeometry(0.92, 0.97, 0.16, 48), podShell2);
    plinth.scale.set(1, 1, 1.12);
    plinth.position.y = 0.178;
    plinth.castShadow = true;
    pod.add(plinth);

    // 舱体：蛋形外壳（后半球）+ 前开口主环
    var shellMat = new T.MeshStandardMaterial({
      color: 0xf8f9fb, roughness: 0.36, metalness: 0.06, side: T.DoubleSide
    });
    var POD_Y = 0.98, POD_R = 0.80;
    var backShell = new T.Mesh(
      new T.SphereGeometry(POD_R, 40, 26, 0, Math.PI * 2, 0, Math.PI * 0.5), shellMat);
    backShell.rotation.x = -Math.PI / 2;
    backShell.scale.set(1, 1, 1.42);
    backShell.position.set(0, POD_Y, -0.10);
    backShell.castShadow = true;
    pod.add(backShell);

    // 主环（前开口的边缘）
    var ring = new T.Mesh(new T.TorusGeometry(POD_R, 0.062, 14, 64), podShell);
    ring.position.set(0, POD_Y, -0.10);
    ring.scale.set(1, 1.42, 1);
    ring.castShadow = true;
    pod.add(ring);
    var ringNeon = new T.Mesh(new T.TorusGeometry(POD_R - 0.052, 0.011, 8, 64), neon);
    ringNeon.position.set(0, POD_Y, -0.075);
    ringNeon.scale.set(1, 1.42, 1);
    pod.add(ringNeon);

    // 座椅
    var chair = new T.Group();
    chair.position.set(0, 0, 0.10);
    pod.add(chair);

    var ped = new T.Mesh(new T.CylinderGeometry(0.26, 0.32, 0.24, 28), podShell2);
    ped.position.set(0, 0.41, 0.02);
    chair.add(ped);

    // 座垫（椭圆）
    var seatBase = new T.Mesh(new T.CylinderGeometry(0.32, 0.29, 0.13, 30), podShell2);
    seatBase.scale.set(1.04, 1, 1.04);
    seatBase.position.set(0, 0.46, 0.06);
    chair.add(seatBase);
    var seatPad = new T.Mesh(new T.CylinderGeometry(0.335, 0.335, 0.17, 30), cushion);
    seatPad.scale.set(0.94, 1, 1.02);
    seatPad.position.set(0, 0.60, 0.06);
    chair.add(seatPad);

    // 腰靠（圆滚，贴着靠背根部）
    var lumbar = new T.Mesh(new T.CylinderGeometry(0.058, 0.058, 0.34, 16), cushion);
    lumbar.rotation.z = Math.PI / 2;
    lumbar.position.set(0, 0.735, -0.075);
    chair.add(lumbar);

    // 靠背（可后仰）
    var backG = new T.Group();
    backG.position.set(0, 0.66, -0.19);
    backG.rotation.x = -0.34;
    chair.add(backG);
    backG.add(H.box(0.54, 0.78, 0.14, cushion, 0, 0.39, 0));
    [-1, 1].forEach(function (s2) {
      backG.add(H.box(0.07, 0.80, 0.18, podShell2, s2 * 0.30, 0.39, 0));
    });
    var headPad = H.box(0.42, 0.21, 0.15, cushion, 0, 0.84, 0.015);
    headPad.rotation.x = -0.14;
    backG.add(headPad);
    [-1, 1].forEach(function (s2) {
      backG.add(H.box(0.06, 0.21, 0.14, podShell2, s2 * 0.24, 0.825, 0.015));
    });

    // 腿托（可抬起）
    var legG = new T.Group();
    legG.position.set(0, 0.575, 0.30);
    legG.rotation.x = -0.16;
    chair.add(legG);
    legG.add(H.box(0.48, 0.11, 0.52, cushion, 0, -0.01, 0.26));
    legG.add(H.box(0.50, 0.05, 0.54, podShell, 0, -0.09, 0.26));   // 下层薄壳做支撑

    // 扶手：侧板 + 圆棍垫
    [-1, 1].forEach(function (s2) {
      chair.add(H.box(0.05, 0.17, 0.50, podShell, s2 * 0.365, 0.705, 0.05));
      var arm = new T.Mesh(new T.CylinderGeometry(0.058, 0.052, 0.48, 16), cushion);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(s2 * 0.365, 0.795, 0.05);
      arm.castShadow = true;
      chair.add(arm);
    });

    // 舱内小屏（挂在环上）
    var tabs = H.createScreenCanvas(256, 160);
    (function (sc) {
      var g = sc.ctx, w = sc.canvas.width, h = sc.canvas.height;
      g.fillStyle = '#0b2230'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#8ef0ff';
      g.font = '600 30px "PingFang SC", system-ui, sans-serif';
      g.fillText('16', 18, 42);
      g.fillStyle = 'rgba(150,235,255,0.55)';
      g.fillRect(18, 58, 150, 3);
      g.strokeStyle = 'rgba(120,230,255,0.85)';
      g.lineWidth = 3;
      g.beginPath();
      for (var i = 0; i < 12; i++) {
        var px2 = 18 + i * 18, py = 118 - Math.sin(i * 0.9) * 18 - (i % 3) * 6;
        if (i === 0) g.moveTo(px2, py); else g.lineTo(px2, py);
      }
      g.stroke();
      sc.texture.needsUpdate = true;
    })(tabs);
    // 扶手侧的控制屏：立柱 + 微倾屏，别让它凭空浮着
    pod.add(H.box(0.05, 0.42, 0.05, podShell, 0.45, 1.02, -0.10));
    pod.add(H.box(0.12, 0.045, 0.05, podShell2, 0.40, 0.805, -0.10));
    var tab = new T.Mesh(new T.PlaneGeometry(0.27, 0.17),
      new T.MeshBasicMaterial({ map: tabs.texture }));
    tab.position.set(0.45, 1.26, -0.055);
    tab.rotation.x = -0.28;
    pod.add(tab);
    pod.add(H.box(0.30, 0.02, 0.06, podShell, 0.45, 1.352, -0.085));

    H.physics.add(PX - 1.10, PZ - 1.20, PX + 1.10, PZ + 1.20, 0, 1.2, 'pod');
    H.shadowBlob(PX, PZ, 1.20, 1.36, 0.28).position.y = 0.021;

    /* ---- 东墙：器械柜 ---- */
    var CB_X = 1.29;
    var CB_Z0 = -7.34, CB_Z1 = -4.62;
    var CB_Z = (CB_Z0 + CB_Z1) / 2, CB_L = CB_Z1 - CB_Z0;
    var CB_F = CB_X - 0.13;                // 前脸
    // 背板 + 两侧 + 顶底：前脸留空，凹龛才看得进去
    scene.add(H.box(0.04, 2.40, CB_L, creamDeep, CB_X + 0.11, 1.48, CB_Z));
    scene.add(H.box(0.26, 2.40, 0.04, cream, CB_X, 1.48, CB_Z0 + 0.02));
    scene.add(H.box(0.26, 2.40, 0.04, cream, CB_X, 1.48, CB_Z1 - 0.02));
    scene.add(H.box(0.26, 0.06, CB_L, cream, CB_X, 2.66, CB_Z));
    scene.add(H.box(0.26, 0.06, CB_L, cream, CB_X, 0.30, CB_Z));
    // 层板
    [2.10, 1.58, 1.10, 0.58].forEach(function (yy) {
      scene.add(H.box(0.24, 0.035, CB_L - 0.08, cream, CB_X, yy, CB_Z));
    });
    // 封闭段门板
    [[2.38, 0.54], [1.34, 0.46], [0.44, 0.26]].forEach(function (d) {
      scene.add(H.box(0.02, d[1], CB_L / 2 - 0.05, cream, CB_F + 0.01, d[0], CB_Z - CB_L / 4));
      scene.add(H.box(0.02, d[1], CB_L / 2 - 0.05, cream, CB_F + 0.01, d[0], CB_Z + CB_L / 4));
    });
    // 层板灯带（两层开口）
    [2.086, 1.076].forEach(function (yy) {
      scene.add(H.glowStrip(0.02, 0.010, CB_L - 0.12, CB_X - 0.09, yy, CB_Z, warmGlow));
    });

    // 上层：靠放的平板（暖/冷色交替）
    var padCols = [0xe8b98c, 0xe4e4dd, 0xdfe9f2, 0xe8e0cf, 0xd8e6ef];
    for (var pi = 0; pi < 5; pi++) {
      var padMat2 = new T.MeshStandardMaterial({
        color: padCols[pi], roughness: 0.72, metalness: 0.05
      });
      var pd = H.box(0.022, 0.30, 0.19, padMat2,
        CB_X - 0.03, 1.76, CB_Z0 + 0.36 + pi * 0.50);
      pd.rotation.z = -0.10;
      scene.add(pd);
      scene.add(H.box(0.012, 0.26, 0.15, new T.MeshBasicMaterial({ color: 0x2f4d5e }),
        CB_X - 0.044, 1.76, CB_Z0 + 0.36 + pi * 0.50));
    }

    // 中层：两合白色检测仪
    [CB_Z - 0.62, CB_Z + 0.58].forEach(function (dz) {
      scene.add(H.box(0.22, 0.30, 0.40, podShell, CB_X - 0.02, 0.85, dz));
      var scr = H.createScreenCanvas(128, 96);
      (function (sc2, warm) {
        var g = sc2.ctx, w = sc2.canvas.width, h = sc2.canvas.height;
        g.fillStyle = warm ? '#12303f' : '#0e2a3a';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#8ef0ff';
        g.font = '600 34px system-ui, sans-serif';
        g.fillText(warm ? '16' : 'OK', 14, 48);
        g.fillStyle = 'rgba(150,235,255,0.5)';
        g.fillRect(14, 62, 76, 3);
        sc2.texture.needsUpdate = true;
      })(scr, dz > CB_Z);
      var sm = new T.Mesh(new T.PlaneGeometry(0.20, 0.15), new T.MeshBasicMaterial({ map: scr.texture }));
      sm.rotation.y = -Math.PI / 2;
      sm.position.set(CB_X - 0.135, 0.89, dz);
      scene.add(sm);
    });
    H.physics.add(CB_X - 0.14, CB_Z0, CX1, CB_Z1, 0, 2.66, 'care-cab');

    /* ---- 玻璃植物箱 ---- */
    var TX = -1.55, TZ = -4.72;
    [[-0.26, -0.19], [0.26, -0.19], [-0.26, 0.19], [0.26, 0.19]].forEach(function (lg) {
      scene.add(H.box(0.035, 0.17, 0.035, podShell2, TX + lg[0], 0.085, TZ + lg[1]));
    });
    scene.add(H.box(0.62, 0.06, 0.50, podShell, TX, 0.20, TZ));
    var tGlass = new T.Mesh(new T.BoxGeometry(0.60, 0.42, 0.48),
      new T.MeshStandardMaterial({
        color: 0xdff2ff, transparent: true, opacity: 0.16,
        roughness: 0.05, metalness: 0.2, depthWrite: false
      }));
    tGlass.position.set(TX, 0.44, TZ);
    scene.add(tGlass);
    scene.add(H.box(0.60, 0.02, 0.48, new T.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.98 }), TX, 0.25, TZ));
    var leafA = new T.MeshStandardMaterial({ color: 0x4f8a63, roughness: 0.78 });
    var leafB = new T.MeshStandardMaterial({ color: 0x6aa87a, roughness: 0.78 });
    for (var li = 0; li < 11; li++) {
      var lx = TX - 0.21 + (li % 4) * 0.14;
      var lz = TZ - 0.14 + Math.floor(li / 4) * 0.14;
      var rr2 = 0.05 + (li % 3) * 0.016;
      var lf = new T.Mesh(new T.SphereGeometry(rr2, 8, 6), li % 2 ? leafA : leafB);
      lf.scale.set(1, 0.72, 1);
      lf.position.set(lx, 0.30 + (li % 3) * 0.03, lz);
      scene.add(lf);
      if (li % 3 === 0) {
        var stem = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.10, 5),
          new T.MeshStandardMaterial({ color: 0x4a6b52, roughness: 0.9 }));
        stem.position.set(lx, 0.26, lz);
        scene.add(stem);
      }
    }
    scene.add(H.glowStrip(0.54, 0.008, 0.42, TX, 0.262, TZ, warmGlow));
    H.physics.add(TX - 0.32, TZ - 0.26, TX + 0.32, TZ + 0.26, 0, 0.66, 'care-plant');

    /* ---- 灯光 ---- */
    var keyLight = new T.PointLight(0xfff1e0, 5.2, 7.5, 1.9);
    keyLight.position.set(0.10, 2.82, -6.10);
    scene.add(keyLight);

    var holoLight = new T.PointLight(0x66d6ff, 1.8, 4.4, 1.8);
    holoLight.position.set(-1.35, 1.70, -6.34);
    scene.add(holoLight);

    var doorLight = new T.PointLight(0xffe9d4, 2.0, 4.6, 1.9);
    doorLight.position.set(-0.36, 2.05, -5.05);
    scene.add(doorLight);

    if (H.QUALITY.name !== 'low') {
      var cabLight = new T.PointLight(0xffe6c8, 1.4, 3.2, 2.0);
      cabLight.position.set(0.95, 1.75, -6.00);
      scene.add(cabLight);
    }

    /* ---- 交互：进舱 / 出舱 ---- */
    var seated = false, seatT = 0;
    var careIt = addInteract(PX + 0.55, PZ + 1.40, 1.62, '康养舱 · 进入', function () {
      seated = !seated;
      careIt.label = seated ? '康养舱 · 起身' : '康养舱 · 进入';
      drawHolo(seated);
      H.Audio.click(seated ? 860 : 560);
      H.Audio.setHum(seated, 0.018);
    });

    return {
      update: function (dt, time) {
        seatT = H.damp(seatT, seated ? 1 : 0, 2.6, dt);
        // 靠背后仰、腿托抬起
        backG.rotation.x = -0.34 - seatT * 0.26;
        legG.rotation.x = -0.16 - seatT * 0.16;
        legG.position.z = 0.30 + seatT * 0.06;
        ringNeon.scale.y = 1.42 + seatT * 0.014;
        neon.color.setHex(seated ? 0xb6f4ff : 0x8fe8ff);

        // 投影的动态弧
        holoArc.rotation.z = time * 0.55;
        holoArc2.rotation.z = -time * 0.38;
        holoArc.material.opacity = 0.55 + Math.sin(time * 2.2) * 0.18;
        holoArc2.material.opacity = 0.45 + Math.sin(time * 1.7 + 1) * 0.15;
        holoPlane.material.opacity = 0.86 + Math.sin(time * 1.4) * 0.06;

        oGlow.material.opacity = 0.40 + Math.sin(time * 1.1) * 0.06 + seatT * 0.18;
      }
    };
  };

  /* =======================================================================
   *  家务机器人（半机械结构 + 悬浮底座）
   * ===================================================================== */
  H.buildRobot = function () {
    mats = H.mats;
    var scene = H.scene;

    var g = new T.Group();
    scene.add(g);

    var bodyMat = new T.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.38, metalness: 0.35 });
    var jointMat = new T.MeshStandardMaterial({ color: 0x8d97a5, roughness: 0.35, metalness: 0.85 });
    var accentMat = new T.MeshBasicMaterial({ color: 0x6fe8ff });

    // 悬浮底座
    var base = new T.Mesh(new T.CylinderGeometry(0.26, 0.20, 0.12, 24), jointMat);
    base.position.y = 0.16;
    g.add(base);
    var baseGlow = new T.Mesh(new T.RingGeometry(0.22, 0.30, 32),
      new T.MeshBasicMaterial({ color: 0x6fe8ff, transparent: true, opacity: 0.65, side: T.DoubleSide }));
    baseGlow.rotation.x = -Math.PI / 2;
    baseGlow.position.y = 0.105;
    g.add(baseGlow);

    // 躯干
    var torso = new T.Mesh(new T.CylinderGeometry(0.17, 0.21, 0.55, 20), bodyMat);
    torso.position.y = 0.55;
    torso.castShadow = true;
    g.add(torso);
    // 胸前机械面板
    var chest = H.box(0.26, 0.2, 0.06, jointMat, 0, 0.62, 0.16);
    g.add(chest);
    var chestLight = H.glowStrip(0.16, 0.02, 0.01, 0, 0.66, 0.2, accentMat);
    g.add(chestLight);
    var chestLight2 = H.glowStrip(0.1, 0.015, 0.01, 0, 0.6, 0.2, accentMat);
    g.add(chestLight2);

    // 肩
    var shoulderL = new T.Mesh(new T.SphereGeometry(0.075, 12, 10), jointMat);
    shoulderL.position.set(-0.21, 0.78, 0);
    g.add(shoulderL);
    var shoulderR = shoulderL.clone();
    shoulderR.position.x = 0.21;
    g.add(shoulderR);

    // 手臂（上臂 + 前臂 + 夹爪）
    function arm(sign) {
      var pivot = new T.Group();
      pivot.position.set(sign * 0.21, 0.78, 0);
      var upper = new T.Mesh(new T.CylinderGeometry(0.045, 0.038, 0.30, 12), bodyMat);
      upper.position.y = -0.16;
      pivot.add(upper);
      var elbow = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), jointMat);
      elbow.position.y = -0.32;
      pivot.add(elbow);
      var fore = new T.Group();
      fore.position.y = -0.32;
      var foreMesh = new T.Mesh(new T.CylinderGeometry(0.034, 0.030, 0.26, 12), jointMat);
      foreMesh.position.y = -0.14;
      fore.add(foreMesh);
      var grip = new T.Group();
      grip.position.y = -0.28;
      var g1 = H.box(0.02, 0.09, 0.05, jointMat, -0.028, -0.045, 0);
      var g2 = H.box(0.02, 0.09, 0.05, jointMat, 0.028, -0.045, 0);
      grip.add(g1); grip.add(g2);
      fore.add(grip);
      pivot.add(fore);
      g.add(pivot);
      return { pivot: pivot, fore: fore, grip: grip };
    }
    var armL = arm(-1);
    var armR = arm(1);

    // 头
    var head = new T.Group();
    head.position.y = 0.95;
    var neck = new T.Mesh(new T.CylinderGeometry(0.045, 0.05, 0.09, 12), jointMat);
    neck.position.y = -0.06;
    head.add(neck);
    var skull = new T.Mesh(new T.SphereGeometry(0.135, 20, 16), bodyMat);
    skull.scale.set(1, 0.92, 1.05);
    skull.castShadow = true;
    head.add(skull);
    // 面罩
    var visor = new T.Mesh(new T.SphereGeometry(0.138, 20, 16, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.32, Math.PI * 0.36),
      new T.MeshStandardMaterial({ color: 0x0d1520, roughness: 0.12, metalness: 0.9 }));
    head.add(visor);
    // 单眼
    var eye = new T.Mesh(new T.SphereGeometry(0.032, 14, 12), accentMat);
    eye.position.set(0, 0.01, 0.115);
    head.add(eye);
    var eyeGlow = new T.Mesh(new T.RingGeometry(0.035, 0.05, 24),
      new T.MeshBasicMaterial({ color: 0x6fe8ff, transparent: true, opacity: 0.4 }));
    eyeGlow.position.set(0, 0.01, 0.125);
    head.add(eyeGlow);
    g.add(head);

    // ---- 路径与工作点（客厅内收拾）----
    var waypoints = [
      { x: 2.0, z: -2.2, item: true },
      { x: 7.2, z: -2.0, item: true },
      { x: 7.4, z: 3.4, item: true },
      { x: 1.6, z: 4.0, item: true }
    ];
    var debrisMat = new T.MeshStandardMaterial({ color: 0xbfc9d6, roughness: 0.8, metalness: 0.1 });
    waypoints.forEach(function (w) {
      var d = H.box(0.14, 0.1, 0.12, debrisMat, w.x + 0.5, 0.05, w.z + 0.4);
      scene.add(d);
      w.debris = d;
      w.pickT = 0;
    });

    var state = 'move';
    var wp = 0;
    var workT = 0, moveT = 0;
    var pos = { x: 2.0, z: -2.2 };
    g.position.set(pos.x, 0, pos.z);
    var yaw = 0;

    return {
      group: g,
      update: function (dt, time) {
        var target = waypoints[wp];
        var dx = target.x - pos.x, dz = target.z - pos.z;
        var dist = Math.sqrt(dx * dx + dz * dz);

        // 朝向
        var wantYaw = Math.atan2(dx, dz);
        var delta = ((wantYaw - yaw + Math.PI * 3) % H.TAU) - Math.PI;
        yaw += delta * Math.min(1, dt * 4.5);

        if (state === 'move') {
          moveT += dt;
          if (dist > 0.35) {
            var sp = 0.95;
            pos.x += dx / dist * sp * dt;
            pos.z += dz / dist * sp * dt;
            // 手臂轻微摆动
            armL.pivot.rotation.x = Math.sin(moveT * 5.2) * 0.35;
            armR.pivot.rotation.x = -Math.sin(moveT * 5.2) * 0.35;
            armL.fore.rotation.x = -0.25 + Math.sin(moveT * 5.2) * 0.15;
            armR.fore.rotation.x = -0.25 - Math.sin(moveT * 5.2) * 0.15;
          } else {
            state = 'work';
            workT = 0;
          }
        } else {
          workT += dt;
          // 下探 → 抓取 → 收回
          var k = Math.sin(Math.min(1, workT / 1.6) * Math.PI);
          armR.pivot.rotation.x = -1.05 * k;
          armR.fore.rotation.x = -0.75 * k;
          armL.pivot.rotation.x = -0.25 * k;
          head.rotation.x = 0.35 * k;
          // 收拾物件
          if (target.debris && target.debris.scale.x > 0.02 && workT > 0.75) {
            var s = Math.max(0, target.debris.scale.x - dt * 1.6);
            target.debris.scale.setScalar(s);
            target.debris.position.y = 0.05 + (1 - s) * 0.7;
          }
          if (workT > 2.0) {
            head.rotation.x = 0;
            state = 'move';
            wp = (wp + 1) % waypoints.length;
            moveT = 0;
            // 一段时间后清理过的位置重新出现杂物
            if (target.debris) {
              target.debris.scale.setScalar(1);
              target.debris.position.y = 0.05;
            }
          }
        }

        // 悬浮起伏 + 身体轻微倾斜
        g.position.x = pos.x;
        g.position.z = pos.z;
        g.position.y = Math.sin(time * 2.1) * 0.018;
        g.rotation.y = yaw;
        baseGlow.material.opacity = 0.45 + 0.25 * Math.sin(time * 3.3);
        eyeGlow.material.opacity = 0.3 + 0.2 * Math.sin(time * 2.6);

        // 走路时的轻微摆头
        if (state === 'move') {
          head.rotation.y = Math.sin(moveT * 2.4) * 0.18;
        } else {
          head.rotation.y = H.damp(head.rotation.y, 0, 5, dt);
        }
      },
      position: pos
    };
  };
})(window.HOME);
