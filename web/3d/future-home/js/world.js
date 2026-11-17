/* =========================================================================
 * future-home · world.js
 * 建筑外壳 / 入户门厅 / 自动感应门 / 灯光 / 区域判定
 * 全部几何由代码生成（文档 1.4 铁律一），材质用程序化 CanvasTexture
 * ========================================================================= */
(function (H) {
  'use strict';

  var T = window.THREE;

  /* ============================ 布局 ============================ */
  var L = H.LAYOUT = {
    x0: -16, x1: 14,          // 室内地面范围
    z0: -8, z1: 8,
    h: 3.2,                   // 层高
    wt: 0.24,                 // 墙厚
    innerX: -2,               // 客厅 / 西区 的隔墙
    westZ1: -2.5,             // 全息游戏房 / 卧室 分隔
    westZ2: 3,                // 卧室 / 影院 分隔
    doorZ: [-1.3, 1.3],       // 入户门洞（z 区间）
    doorH: 2.45
  };

  var WT = L.wt;

  /* ============================ 材质库 ============================ */
  var mats = H.mats = {};

  function tiled(factory, rx, ry) {
    var t = factory();
    t.repeat.set(rx, ry);
    return t;
  }

  H.buildMaterials = function () {
    mats.floor = new T.MeshStandardMaterial({
      map: tiled(H.tex.marble, 10, 8), color: 0xa9b0ba, roughness: 0.30, metalness: 0.08
    });
    mats.floorDark = new T.MeshStandardMaterial({
      map: tiled(H.tex.marble, 8, 4), color: 0x3d4550, roughness: 0.42, metalness: 0.18
    });
    mats.floorWood = new T.MeshStandardMaterial({
      map: tiled(H.tex.wood, 6, 3), color: 0x6d5c48, roughness: 0.62, metalness: 0.02
    });
    mats.wall = new T.MeshStandardMaterial({
      map: tiled(H.tex.wall, 6, 2), color: 0x8e97a4, roughness: 0.88, metalness: 0.02
    });
    mats.wallDark = new T.MeshStandardMaterial({
      map: tiled(H.tex.wall, 6, 2), color: 0x2f3641, roughness: 0.9, metalness: 0.04
    });
    mats.ceil = new T.MeshStandardMaterial({ color: 0x9aa3b0, roughness: 0.95, metalness: 0.0 });

    mats.metal = new T.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.32, metalness: 0.86 });
    mats.darkMetal = new T.MeshStandardMaterial({ color: 0x2b313a, roughness: 0.42, metalness: 0.75 });
    mats.black = new T.MeshStandardMaterial({ color: 0x11151b, roughness: 0.7, metalness: 0.4 });

    mats.fabric = new T.MeshStandardMaterial({
      map: tiled(H.tex.fabric, 1, 1), color: 0xb3bcc9, roughness: 0.96, metalness: 0.0
    });
    mats.rug = new T.MeshStandardMaterial({ map: H.tex.rug(), roughness: 0.98, metalness: 0.0 });
    mats.wood = new T.MeshStandardMaterial({
      map: tiled(H.tex.wood, 2, 2), color: 0xb59c7f, roughness: 0.6, metalness: 0.02
    });

    mats.glass = new T.MeshStandardMaterial({
      color: 0xbfe6ff, transparent: true, opacity: 0.10, roughness: 0.06,
      metalness: 0.55, side: T.DoubleSide, depthWrite: false
    });
    mats.water = new T.MeshStandardMaterial({
      color: 0x1d4a63, transparent: true, opacity: 0.55, roughness: 0.08, metalness: 0.7
    });

    mats.strip = new T.MeshBasicMaterial({ color: 0x2c6672 });
    mats.stripWarm = new T.MeshBasicMaterial({ color: 0x9c7c52 });
    mats.lampGreen = new T.MeshBasicMaterial({ color: 0x2f9d6e });
    mats.lampRed = new T.MeshBasicMaterial({ color: 0xa8403a });
    return mats;
  };

  function matEmissive(color, intensity) {
    return new T.MeshStandardMaterial({
      color: color, emissive: new T.Color(color), emissiveIntensity: intensity || 1,
      roughness: 0.4, metalness: 0.1
    });
  }
  H.matEmissive = matEmissive;

  /* ============================ 几何工具 ============================ */
  var scene = null;

  H.box = function (w, h, d, mat, x, y, z) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  H.glowStrip = function (w, h, d, x, y, z, mat) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat || mats.strip);
    m.position.set(x, y, z);
    return m;
  };

  // 假的接触阴影（径向渐变贴片）：没有 AO 时给家具"落地感"
  var blobTex = null;
  H.shadowBlob = function (x, z, rx, rz, opacity) {
    if (!blobTex) {
      var c = H.tex.canvas(128);
      var g = c.getContext('2d');
      var grd = g.createRadialGradient(64, 64, 0, 64, 64, 62);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(0.55, 'rgba(0,0,0,0.5)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      blobTex = new T.CanvasTexture(c);
    }
    var m = new T.Mesh(new T.PlaneGeometry(rx * 2, rz * 2),
      new T.MeshBasicMaterial({
        map: blobTex, color: 0x000000, transparent: true,
        opacity: opacity === undefined ? 0.55 : opacity, depthWrite: false
      }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.014, z);
    H.scene.add(m);
    return m;
  };

  // axis: 'z' 表示墙沿 z 方向延伸（位于固定 x 上）
  function seg(axis, fixed, a, b, y0, y1, mat, collide) {
    var len = b - a, hh = y1 - y0;
    if (len <= 0.002 || hh <= 0.002) return null;
    var geo = axis === 'z'
      ? new T.BoxGeometry(WT, hh, len)
      : new T.BoxGeometry(len, hh, WT);
    var m = new T.Mesh(geo, mat);
    m.position.set(
      axis === 'z' ? fixed : (a + b) / 2,
      (y0 + y1) / 2,
      axis === 'z' ? (a + b) / 2 : fixed
    );
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    if (collide !== false) {
      if (axis === 'z') H.physics.add(fixed - WT / 2, a, fixed + WT / 2, b, y0, y1);
      else H.physics.add(a, fixed - WT / 2, b, fixed + WT / 2, y0, y1);
    }
    return m;
  }

  // 带门洞的墙：gaps = [{a,b,h}]
  function wall(axis, fixed, a, b, gaps, mat) {
    var list = (gaps || []).slice().sort(function (p, q) { return p.a - q.a; });
    var cursor = a;
    for (var i = 0; i < list.length; i++) {
      var g = list[i];
      if (g.a > cursor) seg(axis, fixed, cursor, g.a, 0, L.h, mat);
      if (g.h < L.h) seg(axis, fixed, g.a, g.b, g.h, L.h, mat);   // 过梁
      cursor = g.b;
    }
    if (cursor < b) seg(axis, fixed, cursor, b, 0, L.h, mat);
  }

  H.shell = {};

  /* ============================ 建筑主体 ============================ */
  H.buildShell = function () {
    scene = H.scene;
    H.buildMaterials();

    // ---- 地面（分区材质）----
    function slab(x0, x1, z0, z1, mat, y) {
      var m = H.box(x1 - x0, 0.16, z1 - z0, mat, (x0 + x1) / 2, (y || 0) - 0.08, (z0 + z1) / 2);
      m.castShadow = false;
      scene.add(m);
      return m;
    }
    slab(L.innerX, L.x1, L.z0, L.z1, mats.floor);          // 玄关 + 客厅
    slab(L.x0, L.innerX, L.z0, L.westZ1, mats.floorDark);  // 全息游戏房
    slab(L.x0, L.innerX, L.westZ1, L.westZ2, mats.floorWood); // 卧室
    slab(L.x0, L.innerX, L.westZ2, L.z1, mats.floorDark);  // 影院

    // ---- 天花 ----
    var ceil = H.box(L.x1 - L.x0 + 0.6, 0.22, L.z1 - L.z0 + 0.6, mats.ceil,
      (L.x0 + L.x1) / 2, L.h + 0.11, (L.z0 + L.z1) / 2);
    ceil.castShadow = false;
    scene.add(ceil);

    // ---- 外墙 ----
    wall('z', L.x1, L.z0, L.z1, [{ a: L.doorZ[0], b: L.doorZ[1], h: L.doorH }], mats.wall); // 东（入户）
    wall('z', L.x0, L.z0, L.z1, [], mats.wall);                                            // 西
    wall('x', L.z0, L.x0, L.x1, [], mats.wall);                                            // 北
    wall('x', L.z1, L.x0, L.x1, [], mats.wall);                                            // 南

    // ---- 内墙 x = innerX：三个门洞 ----
    wall('z', L.innerX, L.z0, L.z1, [
      { a: -3.95, b: -2.95, h: 2.35 },  // 全息游戏房（南移，避开康养室）
      { a: -1.0, b: 1.0, h: 2.35 },    // 卧室
      { a: 4.4, b: 6.4, h: 2.35 }      // 影院
    ], mats.wall);

    // ---- 西区两道横墙 ----
    wall('x', L.westZ1, L.x0, L.innerX, [], mats.wall);
    wall('x', L.westZ2, L.x0, L.innerX, [], mats.wall);

    // ---- 各个门洞的自动感应推拉门 ----
    H.buildAutoDoor({ x: L.innerX, z: -3.45, w: 1.0, h: 2.29, dir: 'z', leaves: 1, thick: L.wt });  // 全息游戏房
    H.buildAutoDoor({ x: L.innerX, z: 0.0, w: 2.0, h: 2.29, dir: 'z', leaves: 2, thick: L.wt });    // 卧室
    H.buildAutoDoor({ x: L.innerX, z: 5.4, w: 2.0, h: 2.29, dir: 'z', leaves: 2, thick: L.wt });    // 影院

    // ---- 南侧落地窗：客厅一面墙换成玻璃 + 城市夜景背板 ----
    buildSouthWindow();

    // ---- 天花灯带 ----
    addCeilingStrips();

    // ---- 玄关 ----
    buildEntry();

    H.shell.door = buildDoor();
  };

  /* ---- 客厅南侧落地窗（z = z1）---- */
  function buildSouthWindow() {
    var wx0 = -1.4, wx1 = 8.2;
    // 玻璃
    var glass = H.box(wx1 - wx0, L.h - 0.35, 0.03, mats.glass, (wx0 + wx1) / 2, (L.h - 0.35) / 2 + 0.05, L.z1);
    glass.castShadow = false;
    glass.receiveShadow = false;
    scene.add(glass);

    // 竖向分隔
    for (var i = 0; i <= 4; i++) {
      var x = wx0 + (wx1 - wx0) * (i / 4);
      scene.add(H.box(0.05, L.h - 0.3, 0.08, mats.darkMetal, x, (L.h - 0.3) / 2 + 0.05, L.z1));
    }
    // 上下框
    scene.add(H.box(wx1 - wx0, 0.08, 0.1, mats.darkMetal, (wx0 + wx1) / 2, 0.05, L.z1));
    scene.add(H.box(wx1 - wx0, 0.08, 0.1, mats.darkMetal, (wx0 + wx1) / 2, L.h - 0.24, L.z1));

    // 窗外城市：程序化点阵发光板
    var c = H.tex.canvas(1024, 512);
    var g = c.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#050a14');
    grd.addColorStop(0.62, '#0a1626');
    grd.addColorStop(1, '#0d2135');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 512);
    // 远山
    g.fillStyle = '#08111c';
    g.beginPath();
    g.moveTo(0, 380);
    for (var mx = 0; mx <= 1024; mx += 64) {
      g.lineTo(mx, 380 - Math.sin(mx * 0.013) * 40 - Math.random() * 22);
    }
    g.lineTo(1024, 512); g.lineTo(0, 512); g.closePath(); g.fill();
    // 楼群与窗口灯
    for (var bIdx = 0; bIdx < 90; bIdx++) {
      var bw = 12 + Math.random() * 34;
      var bh = 40 + Math.random() * 250;
      var bx = Math.random() * 1024 - 20;
      var by = 470 - bh;
      g.fillStyle = 'rgba(8,14,24,' + (0.7 + Math.random() * 0.3) + ')';
      g.fillRect(bx, by, bw, bh + 60);
      for (var wy = by + 8; wy < 470; wy += 9) {
        for (var wx2 = bx + 3; wx2 < bx + bw - 3; wx2 += 7) {
          if (Math.random() < 0.35) {
            g.fillStyle = Math.random() < 0.75 ? 'rgba(255,214,150,0.85)' : 'rgba(150,220,255,0.8)';
            g.fillRect(wx2, wy, 3, 4);
          }
        }
      }
    }
    var cityTex = new T.CanvasTexture(c);
    cityTex.colorSpace = T.SRGBColorSpace;
    var cityMat = new T.MeshBasicMaterial({ map: cityTex, fog: false });
    var city = new T.Mesh(new T.PlaneGeometry(46, 20), cityMat);
    city.position.set(3.4, 7.5, L.z1 + 9);
    city.rotation.y = Math.PI;
    scene.add(city);
  }

  /* ---- 天花灯带 ---- */
  function addCeilingStrips() {
    var y = L.h - 0.06;
    // 客厅两条纵向灯带
    [-4.6, 3.4].forEach(function (x) {
      var s = H.glowStrip(0.1, 0.03, 13.4, x, y, 0, mats.stripWarm);
      scene.add(s);
    });
    // 玄关横向灯带
    scene.add(H.glowStrip(4.2, 0.03, 0.1, 11.6, y, 0, mats.strip));
    // 游戏房/影院 边带
    scene.add(H.glowStrip(0.08, 0.03, 5.2, -15.6, L.h - 0.2, -5.2, mats.strip));
    scene.add(H.glowStrip(0.08, 0.03, 4.6, -15.6, L.h - 0.2, 5.5, mats.strip));
    // 卧室灯带（可被场景切换改色）
    var bedStrip = new T.Mesh(new T.BoxGeometry(0.08, 0.03, 5.2), new T.MeshBasicMaterial({ color: 0xffc89a }));
    bedStrip.position.set(-15.6, L.h - 0.22, 0.25);
    scene.add(bedStrip);
    H.bedroomStrip = bedStrip;

    // 走廊射灯
    for (var i = 0; i < 5; i++) {
      var x = -13 + i * 5.4;
      scene.add(H.glowStrip(0.5, 0.02, 0.5, x, y, -7.2, mats.stripWarm));
    }
  }

  /* ---- 玄关：鞋柜 + 换鞋凳 + 小屏 ---- */
  function buildEntry() {
    // 鞋柜挪到东墙（原位置让给卫生间），进门右手边
    var console_ = H.box(0.42, 1.0, 2.0, mats.wood, 13.62, 0.5, -3.3);
    scene.add(console_);
    scene.add(H.box(0.46, 0.04, 2.06, mats.darkMetal, 13.62, 1.02, -3.3));
    H.physics.add(13.39, -4.3, 13.83, -2.3, 0, 1.0, 'entry');
    H.shadowBlob(13.6, -3.3, 0.34, 1.05, 0.45);

    // 换鞋凳放在入户门内侧靠东墙（东南角已划给厨房）
    var bench = H.box(0.42, 0.42, 1.6, mats.fabric, 13.6, 0.21, 2.2);
    scene.add(bench);
    H.physics.add(13.39, 1.4, 13.81, 3.0, 0, 0.42, 'bench');
    H.shadowBlob(13.6, 2.2, 0.35, 0.9, 0.4);

    // 玄关信息小屏
    var sc = H.createScreenCanvas(512, 256);
    drawEntryScreen(sc, 23.5);
    var mat = new T.MeshBasicMaterial({ map: sc.texture });
    var panel = new T.Mesh(new T.PlaneGeometry(1.5, 0.75), mat);
    panel.position.set(13.87, 1.78, -3.3);
    panel.rotation.y = -Math.PI / 2;
    scene.add(panel);
    H.shell.entryScreen = sc;

    // 门口引导光带
    for (var i = 0; i < 3; i++) {
      scene.add(H.glowStrip(2.2 - i * 0.3, 0.012, 0.06, L.x1 + 1.2 + i * 0.9, 0.012, 0, mats.strip));
    }
  }

  function drawEntryScreen(sc, temp) {
    var g = sc.ctx, w = sc.canvas.width, h = sc.canvas.height;
    var d = new Date();
    var hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
    g.fillStyle = '#070d16';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,200,255,0.35)';
    g.lineWidth = 2;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#8fe2ff';
    g.font = '600 30px "PingFang SC", system-ui, sans-serif';
    g.fillText('欢迎回家', 26, 60);
    g.fillStyle = '#ffffff';
    g.font = '700 62px "PingFang SC", system-ui, sans-serif';
    g.fillText(hh + ':' + mm, 26, 132);
    g.fillStyle = 'rgba(200,225,245,0.75)';
    g.font = '400 24px "PingFang SC", system-ui, sans-serif';
    g.fillText('室内 ' + temp.toFixed(1) + '℃ · 空气 优 · 全屋待机', 26, 176);
    g.fillStyle = 'rgba(120,200,255,0.16)';
    g.fillRect(26, 196, w - 52, 6);
    g.fillStyle = '#49f0a8';
    g.fillRect(26, 196, (w - 52) * 0.82, 6);
    sc.texture.needsUpdate = true;
  }
  H.drawEntryScreen = drawEntryScreen;

  /* ============================ 自动感应门 ============================ */
  function buildDoor() {
    var cx = L.x1, cz = 0;
    var W = (L.doorZ[1] - L.doorZ[0]) / 2;   // 单扇宽 1.3
    var Hh = L.doorH;

    // 门框
    scene.add(H.box(0.34, Hh + 0.1, 0.16, mats.darkMetal, cx, (Hh + 0.1) / 2, L.doorZ[0] - 0.08));
    scene.add(H.box(0.34, Hh + 0.1, 0.16, mats.darkMetal, cx, (Hh + 0.1) / 2, L.doorZ[1] + 0.08));
    scene.add(H.box(0.34, 0.16, W * 2 + 0.3, mats.darkMetal, cx, Hh + 0.08, cz));

    function panel(zc) {
      var g = new T.Group();
      var glass = H.box(0.05, Hh - 0.12, W - 0.06, mats.glass, 0, Hh / 2, 0);
      glass.castShadow = false;
      g.add(glass);
      // 金属边框
      g.add(H.box(0.07, Hh, 0.05, mats.metal, 0, Hh / 2, -W / 2 + 0.02));
      g.add(H.box(0.07, Hh, 0.05, mats.metal, 0, Hh / 2, W / 2 - 0.02));
      g.add(H.box(0.07, 0.06, W, mats.metal, 0, Hh - 0.03, 0));
      g.add(H.box(0.07, 0.06, W, mats.metal, 0, 0.03, 0));
      // 把手光带
      g.add(H.glowStrip(0.02, Hh * 0.4, 0.03, 0.05, Hh * 0.5, -W / 2 + 0.1, mats.strip));
      g.position.set(cx, 0, zc);
      scene.add(g);
      return g;
    }

    var left = panel(cz - W / 2);
    var right = panel(cz + W / 2);

    // 感应器（门楣上）+ 指示灯
    var sensorBox = H.box(0.18, 0.12, 0.5, mats.black, cx - 0.2, Hh + 0.24, cz);
    scene.add(sensorBox);
    var lampMat = new T.MeshBasicMaterial({ color: 0xff5a52 });
    var lamp = new T.Mesh(new T.SphereGeometry(0.045, 12, 10), lampMat);
    lamp.position.set(cx - 0.2, Hh + 0.24, cz);
    scene.add(lamp);

    // 门扇碰撞盒（随开门移动）
    var boxL = H.physics.add(cx - 0.06, cz - W, cx + 0.06, cz, 0, Hh, 'door');
    var boxR = H.physics.add(cx - 0.06, cz, cx + 0.06, cz + W, 0, Hh, 'door');

    var state = { open: 0, target: 0, lastSound: 0 };

    return {
      update: function (dt, px, pz) {
        var dist = Math.sqrt((px - cx) * (px - cx) + (pz - cz) * (pz - cz));
        state.target = dist < 3.4 ? 1 : 0;
        var prev = state.open;
        state.open = H.damp(state.open, state.target, 3.6, dt);

        if (prev < 0.02 && state.open >= 0.02) H.Audio.door(true);
        if (prev > 0.98 && state.open <= 0.98) H.Audio.door(false);

        // 门扇沿 z 滑出 1.3，藏进两侧墙腔
        var slide = state.open * (W - 0.04);
        left.position.z = cz - W / 2 - slide;
        right.position.z = cz + W / 2 + slide;

        boxL.minZ = left.position.z - W / 2;
        boxL.maxZ = left.position.z + W / 2;
        boxR.minZ = right.position.z - W / 2;
        boxR.maxZ = right.position.z + W / 2;

        lampMat.color.setHex(state.open > 0.5 ? 0x49f0a8 : 0xff5a52);
      },
      isOpen: function () { return state.open; },
      position: { x: cx, z: cz }
    };
  }

  /* ============================ 房间自动感应门 ============================ */
  // 通用双扇/单扇推拉门：走近自动滑开，滑进墙里的"口袋"，不占门口空间
  // o = { x, z, w, h, dir:'z'|'x', leaves:1|2, thick, panel, frame, track, sensor, range }
  H.autoDoors = H.autoDoors || [];
  H.buildAutoDoor = function (o) {
    var scene = H.scene, mats = H.mats;
    var dir = o.dir || 'z';            // 'z'：门洞沿 z 展开；'x'：沿 x 展开
    var w = o.w, h = o.h || 2.35;
    var cx = o.x, cz = o.z;
    var thick = o.thick || 0.30;
    var leaves = o.leaves === 1 ? 1 : 2;
    var range = o.range || 3.1;

    var g = new T.Group();
    g.position.set(cx, 0, cz);
    if (dir === 'z') g.rotation.y = Math.PI / 2;
    scene.add(g);

    var frameMat = new T.MeshStandardMaterial({
      color: 0xdfe6ee, roughness: 0.3, metalness: 0.4
    });
    var panelMat = o.panel || new T.MeshStandardMaterial({
      color: 0xdfe9f4, transparent: true, opacity: 0.54, roughness: 0.58, metalness: 0.04
    });
    var edgeMat = new T.MeshStandardMaterial({
      color: 0xeef3f8, roughness: 0.28, metalness: 0.34
    });
    var handleMat = new T.MeshStandardMaterial({
      color: 0x71818e, roughness: 0.38, metalness: 0.5
    });
    var stripMat = new T.MeshBasicMaterial({ color: 0x9fe4ff });
    var trackMat = new T.MeshStandardMaterial({
      color: 0x5d6f7c, roughness: 0.42, metalness: 0.36
    });

    if (o.frame !== false) {
      g.add(H.box(0.055, h, thick + 0.02, frameMat, -(w / 2 + 0.028), h / 2, 0));
      g.add(H.box(0.055, h, thick + 0.02, frameMat, (w / 2 + 0.028), h / 2, 0));
      g.add(H.box(w + 0.11, 0.055, thick + 0.02, frameMat, 0, h + 0.028, 0));
    }

    // 门扇
    var leafW = (leaves === 1 ? w : w / 2) - 0.014;
    var leafData = [];
    for (var i = 0; i < leaves; i++) {
      var home = leaves === 1 ? 0 : (i === 0 ? -w / 4 : w / 4);
      var lg = new T.Group();
      lg.position.set(home, 0, 0);
      g.add(lg);

      var pane = H.box(leafW - 0.07, h - 0.14, 0.036, panelMat, 0, h / 2, 0);
      pane.castShadow = false;
      lg.add(pane);
      // 边梃 + 上下冒头
      lg.add(H.box(0.038, h - 0.02, 0.052, edgeMat, -leafW / 2 + 0.019, h / 2, 0));
      lg.add(H.box(0.038, h - 0.02, 0.052, edgeMat, leafW / 2 - 0.019, h / 2, 0));
      lg.add(H.box(leafW, 0.05, 0.052, edgeMat, 0, h - 0.045, 0));
      lg.add(H.box(leafW, 0.05, 0.052, edgeMat, 0, 0.045, 0));
      // 中缝指示灯（关门时是一条青色细线）
      var seamX = leaves === 1 ? (leafW / 2 - 0.045) : (i === 0 ? 1 : -1) * (leafW / 2 - 0.035);
      lg.add(H.box(0.012, h * 0.30, 0.018, stripMat, seamX, h * 0.5, 0.032));
      // 竖向拉手槽（两侧面各一条，认得出是门）
      var hx = (leaves === 1 ? 1 : (i === 0 ? 1 : -1)) * (leafW / 2 - 0.078);
      [-1, 1].forEach(function (fs) {
        lg.add(H.box(0.016, 0.46, 0.009, handleMat, hx, 1.06, fs * 0.019));
      });

      leafData.push({ g: lg, home: home, box: null });
    }

    // 地轨
    if (o.track !== false) g.add(H.box(w, 0.008, 0.04, trackMat, 0, 0.005, 0));
    // 门侧感应面板：贴在门洞旁的墙面上（走廊侧），门开为绿、门关为红
    var lampMat = new T.MeshBasicMaterial({ color: 0xff6a5e });
    if (o.sensor !== false) {
      var mz = thick / 2 + 0.018;
      g.add(H.box(0.072, 0.115, 0.016, frameMat, w / 2 + 0.118, 1.16, mz));
      var lamp = new T.Mesh(new T.SphereGeometry(0.017, 12, 10), lampMat);
      lamp.position.set(w / 2 + 0.118, 1.19, mz + 0.011);
      g.add(lamp);
      g.add(H.box(0.030, 0.006, 0.006, handleMat, w / 2 + 0.118, 1.115, mz + 0.010));
    }

    // 碰撞盒：按门扇当前位置同步
    function aabb(lx) {
      if (dir === 'z') return { x0: cx - 0.03, x1: cx + 0.03, z0: cz - lx - leafW / 2, z1: cz - lx + leafW / 2 };
      return { x0: cx + lx - leafW / 2, x1: cx + lx + leafW / 2, z0: cz - 0.03, z1: cz + 0.03 };
    }
    leafData.forEach(function (d) {
      var b = aabb(d.home);
      d.box = H.physics.add(b.x0, b.z0, b.x1, b.z1, 0, h, 'room-door');
      d.max = leafW + 0.02;      // 完全滑进墙里的距离
    });

    var state = { open: 0 };
    var api = {
      update: function (dt, px, pz) {
        var dx = px - cx, dz = pz - cz;
        api.dist = Math.sqrt(dx * dx + dz * dz);
        var near = api.dist < range;
        var prev = state.open;
        state.open = H.damp(state.open, near ? 1 : 0, 5.0, dt);
        if (prev < 0.02 && state.open >= 0.02) H.Audio.door(true);
        if (prev > 0.98 && state.open <= 0.98) H.Audio.door(false);

        for (var k = 0; k < leafData.length; k++) {
          var d = leafData[k];
          var lx;
          if (leaves === 1) {
            lx = state.open * (w + 0.02);
          } else {
            lx = d.home + (k === 0 ? -1 : 1) * state.open * d.max;
          }
          d.g.position.x = lx;
          var b = aabb(lx);
          d.box.minX = b.x0; d.box.maxX = b.x1;
          d.box.minZ = b.z0; d.box.maxZ = b.z1;
        }
        lampMat.color.setHex(state.open > 0.5 ? 0x49f0a8 : 0xff6a5e);
      },
      isOpen: function () { return state.open; },
      position: { x: cx, z: cz }
    };
    H.autoDoors.push(api);
    return api;
  };

  /* ============================ 入户门厅（室内前室） ============================ */
  // 只保留室内：门厅是一个封闭小前室，进门后即进入玄关
  var PORCH = H.PORCH = { x0: L.x1, x1: 18.7, z0: -3.4, z1: 3.4 };

  H.buildPorch = function () {
    scene = H.scene;

    // 地面
    var floorTex = H.tex.marble();
    floorTex.repeat.set(5, 5);
    var porchMat = new T.MeshStandardMaterial({ map: floorTex, color: 0x4a545f, roughness: 0.42, metalness: 0.12 });
    var slab = H.box(PORCH.x1 - PORCH.x0 + 0.4, 0.16, PORCH.z1 - PORCH.z0,
      porchMat, (PORCH.x0 + PORCH.x1) / 2, -0.08, 0);
    slab.castShadow = false;
    scene.add(slab);

    // 三面墙 + 天花，把室外彻底封住
    wall('x', PORCH.z0, PORCH.x0, PORCH.x1, [], mats.wallDark);
    wall('x', PORCH.z1, PORCH.x0, PORCH.x1, [], mats.wallDark);
    wall('z', PORCH.x1, PORCH.z0, PORCH.z1, [], mats.wallDark);
    var ceil = H.box(PORCH.x1 - PORCH.x0 + 0.4, 0.22, PORCH.z1 - PORCH.z0,
      mats.ceil, (PORCH.x0 + PORCH.x1) / 2, L.h + 0.11, 0);
    ceil.castShadow = false;
    scene.add(ceil);

    // 门槛
    scene.add(H.box(0.34, 0.03, 3.0, mats.metal, L.x1 + 0.18, 0.015, 0));

    // 两侧地脚光带 + 顶部灯带
    scene.add(H.glowStrip(4.3, 0.02, 0.06, 16.6, 0.014, PORCH.z0 + 0.5, mats.strip));
    scene.add(H.glowStrip(4.3, 0.02, 0.06, 16.6, 0.014, PORCH.z1 - 0.5, mats.strip));
    scene.add(H.glowStrip(0.09, 0.03, 5.6, PORCH.x1 - 0.55, L.h - 0.12, 0, mats.strip));

    // 端墙标识屏（"2086 / FUTURE HOME"）
    var sc = H.createScreenCanvas(512, 256);
    var g = sc.ctx;
    g.fillStyle = '#05090f';
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = 'rgba(120,200,255,0.30)';
    g.lineWidth = 2;
    g.strokeRect(10, 10, 492, 236);
    g.fillStyle = 'rgba(190,225,245,0.92)';
    g.font = '700 74px "PingFang SC", system-ui, sans-serif';
    g.fillText('2086', 42, 128);
    g.fillStyle = 'rgba(120,200,255,0.62)';
    g.font = '500 24px "PingFang SC", system-ui, sans-serif';
    g.fillText('FUTURE  HOME  ·  RESIDENCE  01', 44, 176);
    g.fillStyle = 'rgba(255,200,120,0.75)';
    g.fillRect(42, 202, 132, 3);
    sc.texture.needsUpdate = true;

    var sign = new T.Mesh(new T.PlaneGeometry(2.2, 1.1), new T.MeshBasicMaterial({ map: sc.texture }));
    sign.position.set(16.6, 1.9, PORCH.z0 + 0.14);
    scene.add(sign);

    // 门厅顶灯
    var l = new T.PointLight(0xa8d8ff, 4.5, 11, 1.6);
    l.position.set(16.8, 2.6, 0);
    scene.add(l);
  };

  /* ============================ 灯光 ============================ */
  H.buildLights = function () {
    scene = H.scene;
    H.scene.add(new T.HemisphereLight(0x2a3f5e, 0x080b11, 0.32));
    H.scene.add(new T.AmbientLight(0x25344c, 0.55));

    var moon = new T.DirectionalLight(0xa9c8ff, 0.42);
    moon.position.set(26, 20, 16);
    moon.target.position.set(0, 0, 0);
    scene.add(moon.target);
    if (H.QUALITY.shadow > 0) {
      moon.castShadow = true;
      moon.shadow.mapSize.set(H.QUALITY.shadow, H.QUALITY.shadow);
      var c = moon.shadow.camera;
      c.left = -24; c.right = 24; c.top = 20; c.bottom = -20; c.near = 1; c.far = 90;
      moon.shadow.bias = -0.0006;
      moon.shadow.normalBias = 0.03;
    }
    scene.add(moon);
    H.moonLight = moon;

    // 室内补光（客厅暖光 / 玄关冷光 / 游戏房青光 / 影院蓝光）
    function addPoint(color, intensity, dist, x, y, z) {
      var l = new T.PointLight(color, intensity, dist, 1.6);
      l.position.set(x, y, z);
      scene.add(l);
      return l;
    }
    addPoint(0xffd6a5, 11, 18, 4.4, 2.45, -4.2);    // 客厅 · 沙发区
    addPoint(0xffd2a0, 5.5, 16, 3.8, 2.62, 3.2);    // 客厅 · 入口侧
    addPoint(0xffe6c4, 10, 11, 11.6, 2.65, 5.4);    // 厨房 · 主灯（两组灯盘之间）
    if (H.QUALITY.name !== 'low') {                 // 低画质少放两盏，控制灯光数量
      addPoint(0xffcf9c, 5.0, 8, 12.9, 1.7, 7.4);   // 厨房 · 台面补光（吊柜下）
      addPoint(0xffd9b0, 4.5, 8, 10.0, 2.3, 3.9);   // 厨房 · 吧台侧补光
    }
    addPoint(0xffd8ae, 5.0, 7, 5.2, 1.85, 5.4);     // 餐区 · 吊灯
    addPoint(0x9fdcff, 5.5, 11, 11.6, 2.5, 0);      // 玄关
    addPoint(0x4fd4ff, 7.5, 13, -9, 2.5, -5.2);     // 游戏房
    addPoint(0x3f6bff, 4.0, 12, -9, 2.4, 5.5);      // 影院
    var bedLight = addPoint(0xffc89a, 7.5, 13, -11.6, 2.42, 1.0); // 卧室（可换色）
    H.bedroomLight = bedLight;
    if (H.QUALITY.name !== 'low') {
      addPoint(0xffd2a6, 3.6, 6, -12.3, 1.5, -1.5);   // 卧室 · 书桌台灯补光
      addPoint(0xffc9a2, 2.4, 5, -14.8, 3.05, -1.85);  // 卧室 · 衣柜顶部洗墙
    }

    // 窗外冷光（模拟城市溢光）
    var rim = new T.DirectionalLight(0x6ea8d8, 0.18);
    rim.position.set(6, 6, 20);
    scene.add(rim);
  };

  /* ============================ 区域判定 ============================ */
  H.zoneAt = function (x, z) {
    if (x > L.x1 + 0.2) return 'porch';
    if (x > 9.9 && z < -4.55) return 'bath';
    if (x > L.innerX && x < 1.6 && z < -4.4) return 'care';
    if (x > 9) return 'entry';
    if (x > L.innerX) return 'living';
    if (z < L.westZ1) return 'arcade';
    if (z < L.westZ2) return 'bedroom';
    return 'cinema';
  };

  H.ZONE_NAME = {
    porch: '入户门厅',
    entry: '玄关',
    bath: '卫生间',
    care: '智能康养室',
    living: '客厅',
    arcade: '全息游戏房',
    bedroom: '卧室',
    cinema: '私人影院'
  };
})(window.HOME);
