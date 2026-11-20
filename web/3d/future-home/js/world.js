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

  // 线性空间里可以超过 1 的发光色——只有这样后处理的 bloom 阈值才吃得到
  H.hdr = function (hex, gain) {
    return new T.Color(hex).multiplyScalar(gain === undefined ? 1 : gain);
  };
  function matGlow(hex, gain) {
    var m = new T.MeshBasicMaterial({ fog: false });
    m.color.copy(H.hdr(hex, gain));
    return m;
  }
  H.matGlow = matGlow;

  H.buildMaterials = function () {
    // ---- 抛光岩板：地面是室内最大的反射面，它的成色决定整体质感 ----
    var floorT = tiled(H.tex.marble, 10, 8);
    mats.floor = new T.MeshStandardMaterial({
      map: floorT,
      bumpMap: H.lumaMap(floorT.image, 10, 8, { contrast: 0.55 }),
      bumpScale: 0.12,
      roughnessMap: H.lumaMap(floorT.image, 10, 8, { invert: true, contrast: 0.25, bias: 0.04 }),
      color: 0x9aa2ae, roughness: 0.46, metalness: 0.26, envMapIntensity: 1.25
    });

    var darkT = tiled(H.tex.concrete, 8, 4);
    mats.floorDark = new T.MeshStandardMaterial({
      map: darkT,
      bumpMap: H.lumaMap(darkT.image, 8, 4, { contrast: 0.6 }),
      bumpScale: 0.14,
      roughnessMap: H.lumaMap(darkT.image, 8, 4, { invert: true, contrast: 0.5, bias: -0.06 }),
      color: 0x59616e, roughness: 0.62, metalness: 0.3, envMapIntensity: 1.15
    });

    var woodT = tiled(H.tex.wood, 6, 3);
    mats.floorWood = new T.MeshStandardMaterial({
      map: woodT,
      bumpMap: H.lumaMap(woodT.image, 6, 3, { contrast: 0.8 }),
      bumpScale: 0.2,
      roughnessMap: H.lumaMap(woodT.image, 6, 3, { invert: true, contrast: 0.4, bias: 0.08 }),
      color: 0x8c7760, roughness: 0.78, metalness: 0.04, envMapIntensity: 0.7
    });

    // ---- 墙面：加凹凸让掠射角有细节，否则大面积纯色一眼就「假」 ----
    var wallT = tiled(H.tex.wall, 6, 2);
    var wallBump = H.lumaMap(wallT.image, 6, 2, { contrast: 0.75 });
    mats.wall = new T.MeshStandardMaterial({
      map: wallT, bumpMap: wallBump, bumpScale: 0.16,
      color: 0x828b99, roughness: 0.82, metalness: 0.05, envMapIntensity: 0.6
    });
    var wallDarkT = tiled(H.tex.concrete, 6, 2);
    mats.wallDark = new T.MeshStandardMaterial({
      map: wallDarkT,
      bumpMap: H.lumaMap(wallDarkT.image, 6, 2, { contrast: 0.7 }),
      bumpScale: 0.18,
      color: 0x4a5261, roughness: 0.86, metalness: 0.06, envMapIntensity: 0.5
    });

    var ceilT = tiled(H.tex.ceil, 9, 5);
    mats.ceil = new T.MeshStandardMaterial({
      map: ceilT,
      bumpMap: H.lumaMap(ceilT.image, 9, 5, { contrast: 0.9 }),
      bumpScale: 0.1,
      color: 0x9fa8b5, roughness: 0.88, metalness: 0.03, envMapIntensity: 0.45
    });

    // ---- 金属：拉丝 + 粗糙度变化，纯色金属会糊成一块 ----
    var brushT = tiled(H.tex.brushed, 3, 3);
    var brushRough = H.lumaMap(brushT.image, 3, 3, { invert: true, contrast: 0.35, bias: -0.1 });
    mats.metal = new T.MeshStandardMaterial({
      map: brushT, roughnessMap: brushRough, bumpMap: brushT, bumpScale: 0.03,
      color: 0xaeb8c4, roughness: 0.55, metalness: 0.95, envMapIntensity: 1.5
    });
    mats.darkMetal = new T.MeshStandardMaterial({
      map: tiled(H.tex.brushed, 2, 2), roughnessMap: brushRough,
      color: 0x323a46, roughness: 0.68, metalness: 0.82, envMapIntensity: 1.2
    });
    mats.black = new T.MeshStandardMaterial({
      color: 0x0f131a, roughness: 0.45, metalness: 0.55, envMapIntensity: 1.1
    });

    var fabT = tiled(H.tex.fabric, 6, 6);
    mats.fabric = new T.MeshStandardMaterial({
      map: fabT,
      bumpMap: H.lumaMap(fabT.image, 6, 6, { contrast: 1.4, res: 256 }),
      bumpScale: 0.22,
      color: 0xc3ccd8, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.35
    });
    var rugT = H.tex.rug();
    mats.rug = new T.MeshStandardMaterial({
      map: rugT,
      bumpMap: H.lumaMap(rugT.image, 1, 1, { contrast: 1.2 }),
      bumpScale: 0.3,
      roughness: 0.98, metalness: 0.0, envMapIntensity: 0.2
    });
    var furnT = tiled(H.tex.wood, 2, 2);
    mats.wood = new T.MeshStandardMaterial({
      map: furnT,
      bumpMap: H.lumaMap(furnT.image, 2, 2, { contrast: 0.7 }),
      bumpScale: 0.12,
      color: 0xb59c7f, roughness: 0.52, metalness: 0.04, envMapIntensity: 0.8
    });

    // ---- 玻璃：靠环境反射出型，别靠不透明度 ----
    // clearcoat 会在 shader 里多编一层高光（USE_CLEARCOAT），落地窗又是大面积，
    // 中低画质直接关掉，反射主要还是靠 envMap
    mats.glass = new T.MeshPhysicalMaterial({
      color: 0xaedcff, transparent: true, opacity: 0.085, roughness: 0.03,
      metalness: 0.0, side: T.DoubleSide, depthWrite: false,
      envMapIntensity: 2.4,
      clearcoat: H.QUALITY.detail > 1 ? 1.0 : 0.0, clearcoatRoughness: 0.02,
      ior: 1.45, reflectivity: 0.6
    });
    mats.water = new T.MeshStandardMaterial({
      color: 0x18435c, transparent: true, opacity: 0.52, roughness: 0.04,
      metalness: 0.4, envMapIntensity: 1.8
    });

    mats.strip = matGlow(0x62dcff, 2.3);
    mats.stripWarm = matGlow(0xffc78c, 2.0);
    mats.lampGreen = matGlow(0x4bffb0, 2.2);
    mats.lampRed = matGlow(0xff6a5c, 2.2);
    return mats;
  };

  /* ---- 程序化环境贴图：没有反射，金属和玻璃就只是灰色塑料 ---- */
  H.buildEnv = function () {
    var res = H.QUALITY.env;
    if (!res || !T.PMREMGenerator) return null;
    var es = new T.Scene();

    function panel(w, h, color, gain, x, y, z, rx, ry) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), matGlow(color, gain));
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      if (ry) m.rotation.y = ry;
      es.add(m);
    }
    // 顶部冷白面光（天花灯膜）+ 地面微弱反光
    panel(30, 30, 0xdceeff, 0.85, 0, 6, 0, Math.PI / 2, 0);
    panel(30, 30, 0x1a2230, 0.5, 0, -3, 0, -Math.PI / 2, 0);
    // 四周：窗侧城市冷光偏亮，内墙偏暗，制造方向性反射
    panel(30, 9, 0x24324a, 0.55, 0, 1.5, -12, 0, 0);
    panel(30, 9, 0x4c7ba8, 0.9, 0, 1.5, 12, 0, Math.PI);
    panel(26, 9, 0x1d2735, 0.45, -14, 1.5, 0, 0, Math.PI / 2);
    panel(26, 9, 0x2b3a52, 0.5, 14, 1.5, 0, 0, -Math.PI / 2);
    // 几条亮灯带，给金属件打出高光条
    panel(22, 0.5, 0xbfe6ff, 3.2, 0, 5.4, -4, Math.PI / 2, 0);
    panel(22, 0.4, 0xffd0a0, 2.4, 0, 5.4, 4, Math.PI / 2, 0);

    var pm = new T.PMREMGenerator(H.renderer);
    var rt = pm.fromScene(es, 0.02, 0.1, 80);
    pm.dispose();
    es.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    H.scene.environment = rt.texture;
    if ('environmentIntensity' in H.scene) H.scene.environmentIntensity = 0.75;
    H.envMap = rt.texture;
    return rt.texture;
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
    var m = new T.Mesh(H.boxGeo(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  H.glowStrip = function (w, h, d, x, y, z, mat) {
    var m = new T.Mesh(H.boxGeo(w, h, d), mat || mats.strip);
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
      ? H.boxGeo(WT, hh, len)
      : H.boxGeo(len, hh, WT);
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
    H.buildEnv();          // 先有环境反射，材质才知道自己该反射什么
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

    // ---- 空气里的浮尘，光束才看得见 ----
    buildDust();

    H.shell.door = buildDoor();

    // 墙面收边推迟到各房间建完再做（见 H.buildArchDetail），
    // 这样才能知道墙上挂了什么，避免踢脚 / 腰线从屏幕、柜子前面穿过去
    H.shell.mark = scene.children.length;
  };

  /* =======================================================================
   *  建筑细节：大面积白墙/白顶是「糙」的根源，靠分缝、灯槽、格栅把尺度打碎
   *  注意：必须在所有房间建完后调用，收边要避让墙上已有的屏幕 / 柜子 / 洁具
   * ===================================================================== */
  var occluders = [];

  // 收集「贴墙的陈设」包围盒：只看 shell 之后加入的对象，墙体地面天花不在其中
  function collectOccluders() {
    occluders = [];
    var kids = scene.children;
    var start = H.shell.mark || 0;
    for (var i = start; i < kids.length; i++) {
      var o = kids[i];
      if (!o.visible || o.isLight || o.isPoints) continue;
      var bb = new T.Box3();
      try { bb.setFromObject(o); } catch (e) { continue; }
      if (bb.isEmpty()) continue;
      var sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z;
      if (!isFinite(sx) || !isFinite(sz)) continue;
      if (sx > 40 || sz > 40) continue;        // 城市背板之类的超大平面
      if (bb.max.y < 0.12) continue;           // 地毯等贴地平面，不该切踢脚
      occluders.push(bb);
    }
  }

  H.buildArchDetail = function () {
    scene = H.scene;
    var detail = H.QUALITY.detail;
    if (detail <= 0) return;
    collectOccluders();

    var trimMat = new T.MeshStandardMaterial({
      color: 0x202733, roughness: 0.55, metalness: 0.55, envMapIntensity: 1.1
    });
    var reveal = new T.MeshStandardMaterial({
      color: 0x59636f, roughness: 0.5, metalness: 0.5, envMapIntensity: 1.0
    });
    var coveCool = H.matGlow(0x7ad4ff, 1.5);
    var coveWarm = H.matGlow(0xffc490, 1.4);

    // 一段「墙裙 + 凹缝 + 地脚灯」：沿某条轴贴着墙面生成
    // axis 'x'：墙沿 x 延伸（固定 z）；'z'：墙沿 z 延伸（固定 x）
    // opt.holes：门洞区间 [{a, b, h, pad}]。除此之外还会自动避让贴墙的陈设，
    //            否则踢脚 / 腰线 / 分缝会从敞开的门洞和大屏正中间横穿过去
    function dressWall(axis, fixed, a, b, face, opt) {
      opt = opt || {};
      var len = b - a;
      if (len < 0.8) return;
      var off = face * 0.012;                       // 贴面偏移，避免 z-fighting
      var glowMat = opt.warm ? coveWarm : coveCool;
      var holes = opt.holes || [];

      // 高度区间 [yLo,yHi] 的构件，在这面墙上需要让开哪些区段
      function cutsAt(yLo, yHi) {
        var cuts = [];
        for (var hi = 0; hi < holes.length; hi++) {
          var ho = holes[hi];
          if (yLo >= (ho.h || 2.35)) continue;      // 构件整体在洞口上方
          var pad = ho.pad === undefined ? 0.06 : ho.pad;
          cuts.push([ho.a - pad, ho.b + pad]);      // 断点藏进门框厚度里
        }
        for (var oi = 0; oi < occluders.length; oi++) {
          var bb = occluders[oi];
          if (bb.max.y <= yLo || bb.min.y >= yHi) continue;     // 高度不重叠
          var pMin = axis === 'x' ? bb.min.z : bb.min.x;
          var pMax = axis === 'x' ? bb.max.z : bb.max.x;
          // 必须和这面墙在同一侧：否则墙另一边房间里的家具会把这一面的收边切掉
          var pMid = (pMin + pMax) / 2;
          if (face > 0) {
            if (pMid < fixed - 0.05) continue;
            if (pMin > fixed + 0.8 || pMax < fixed - 0.15) continue;
          } else {
            if (pMid > fixed + 0.05) continue;
            if (pMax < fixed - 0.8 || pMin > fixed + 0.15) continue;
          }
          // 房间自己的隔墙也在候选里：通高又很薄的，是墙不是陈设
          if (bb.max.y - bb.min.y > L.h * 0.92 && pMax - pMin < 0.4) continue;
          var s0 = axis === 'x' ? bb.min.x : bb.min.z;
          var s1 = axis === 'x' ? bb.max.x : bb.max.z;
          if (s1 - s0 > len * 0.7) continue;        // 跟墙一样长，多半就是另一道墙
          cuts.push([s0 - 0.05, s1 + 0.05]);
        }
        return cuts;
      }

      // 把 [a,b] 按裁剪区间挖空后剩下的若干段
      function spans(yLo, yHi) {
        var segs = [[a, b]];
        var cuts = cutsAt(yLo, yHi);
        for (var ci = 0; ci < cuts.length; ci++) {
          var ca = cuts[ci][0], cb = cuts[ci][1], out = [];
          for (var si = 0; si < segs.length; si++) {
            var s = segs[si];
            if (cb <= s[0] || ca >= s[1]) { out.push(s); continue; }
            if (ca > s[0]) out.push([s[0], ca]);
            if (cb < s[1]) out.push([cb, s[1]]);
          }
          segs = out;
        }
        return segs;
      }

      function put(hgt, d, y, mat, extra) {
        var segs = spans(y - hgt / 2, y + hgt / 2);
        var made = [];
        for (var i = 0; i < segs.length; i++) {
          var s0 = segs[i][0], s1 = segs[i][1], w = s1 - s0;
          if (w < 0.06) continue;
          var c = (s0 + s1) / 2;
          var m = H.box(axis === 'x' ? w : d, hgt, axis === 'x' ? d : w, mat,
            axis === 'x' ? c : fixed + off + (extra || 0) * face,
            y,
            axis === 'x' ? fixed + off + (extra || 0) * face : c);
          m.castShadow = false;
          m.receiveShadow = true;
          scene.add(m);
          made.push(m);
        }
        return made;
      }

      function noShadow(list) {
        for (var i = 0; i < list.length; i++) list[i].receiveShadow = false;
      }

      // 踢脚：深色收边 + 内藏灯带，洗出地面反光
      put(0.11, 0.035, 0.055, trimMat);
      noShadow(put(0.016, 0.012, 0.022, glowMat, 0.028));
      // 腰线凹缝
      if (opt.waist !== false) put(0.03, 0.022, 1.12, reveal);
      // 顶部收口 + 洗墙灯槽
      put(0.09, 0.05, L.h - 0.1, trimMat);
      noShadow(put(0.02, 0.016, L.h - 0.165, glowMat, 0.04));

      // 竖向分缝：把 30m 长墙切成若干块，缝要细、要浅，否则像百叶窗
      if (detail > 1 && opt.seams !== false) {
        var sLo = 0.21, sHi = L.h - 0.21;
        var free = spans(sLo, sHi);
        var step = opt.step || 2.8;
        var n = Math.floor(len / step);
        for (var i = 1; i <= n; i++) {
          var p = a + i * (len / (n + 1));
          var ok = false;
          for (var fi = 0; fi < free.length; fi++) {
            // 分缝要整条落在空白段里，不能压着屏幕或门洞边
            if (p > free[fi][0] + 0.1 && p < free[fi][1] - 0.1) { ok = true; break; }
          }
          if (!ok) continue;
          var s = H.box(axis === 'x' ? 0.013 : 0.016, sHi - sLo, axis === 'x' ? 0.016 : 0.013,
            reveal,
            axis === 'x' ? p : fixed + off,
            (sLo + sHi) / 2,
            axis === 'x' ? fixed + off : p);
          s.castShadow = false;
          scene.add(s);
        }
      }
    }

    var wi = L.wt / 2;
    // 内墙 x=innerX 上的三个门洞，必须和 buildShell 里 wall() 的开洞保持一致
    var innerHoles = [
      { a: -3.95, b: -2.95, h: 2.35 },   // 全息游戏房
      { a: -1.0,  b: 1.0,   h: 2.35 },   // 卧室
      { a: 4.4,   b: 6.4,   h: 2.35 }    // 影院
    ];
    // 入户门洞门框更厚，断点要多让一点
    var entryHoles = [{ a: L.doorZ[0], b: L.doorZ[1], h: L.doorH, pad: 0.17 }];

    // 客厅/玄关四周（面朝室内）
    dressWall('x', L.z0 + wi, L.innerX + wi, L.x1 - wi, 1, { warm: true, step: 3.0 });
    dressWall('z', L.innerX + wi, L.z0 + wi, L.z1 - wi, 1, { step: 3.0, holes: innerHoles });
    dressWall('z', L.x1 - wi, L.z0 + wi, L.z1 - wi, -1, { warm: true, step: 3.0, holes: entryHoles });
    // 西区三间房的外侧墙
    dressWall('z', L.x0 + wi, L.z0 + wi, L.westZ1 - wi, 1, { step: 2.4 });
    dressWall('z', L.x0 + wi, L.westZ1 + wi, L.westZ2 - wi, 1, { warm: true, step: 2.4 });
    dressWall('z', L.x0 + wi, L.westZ2 + wi, L.z1 - wi, 1, { step: 2.4 });
    dressWall('x', L.z0 + wi, L.x0 + wi, L.innerX - wi, 1, { step: 3.0 });
    // 康养室凸出客厅的那块体量（在 rooms.js 里建，这里只做收边，别让它是一块纯白板）
    dressWall('z', 1.58, -7.80, -4.44, 1, { seams: false, waist: false });
    dressWall('x', -4.28, -1.90, 1.44, 1, {
      seams: false, waist: false, holes: [{ a: -0.86, b: 0.14, h: 2.12 }]
    });

    // ---- 天花：下沉灯膜 + 格栅梁，消灭「一整块白板」 ----
    var beamMat = new T.MeshStandardMaterial({
      color: 0x8d97a5, roughness: 0.7, metalness: 0.22, envMapIntensity: 0.8
    });
    var filmMat = H.matGlow(0xcfe4ff, 0.14);

    // 客厅上方做一块下沉吊顶，四周留灯槽
    (function coffer(x0, x1, z0, z1, warm) {
      var cw = x1 - x0, cd = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      var y = L.h - 0.1;
      // 边框
      scene.add(H.box(cw, 0.1, 0.12, beamMat, cx, y, z0));
      scene.add(H.box(cw, 0.1, 0.12, beamMat, cx, y, z1));
      scene.add(H.box(0.12, 0.1, cd, beamMat, x0, y, cz));
      scene.add(H.box(0.12, 0.1, cd, beamMat, x1, y, cz));
      // 灯槽：沿吊顶两条长边的细灯带，交给 bloom 发光（整片发光膜会把天花拍平）
      [z0 + 0.1, z1 - 0.1].forEach(function (zz) {
        var s = new T.Mesh(new T.BoxGeometry(cw - 0.3, 0.02, 0.05),
          warm ? H.matGlow(0xffcf9e, 2.4) : H.matGlow(0x9fe0ff, 2.1));
        s.position.set(cx, L.h - 0.125, zz);
        scene.add(s);
      });
      // 格栅梁
      if (detail > 1) {
        var n = Math.max(2, Math.round(cw / 1.9));
        for (var i = 1; i < n; i++) {
          var bx = x0 + (cw * i) / n;
          var bm = H.box(0.07, 0.085, cd - 0.24, beamMat, bx, L.h - 0.095, cz);
          bm.castShadow = false;
          scene.add(bm);
        }
      }
    })(0.4, 8.6, -6.9, -1.4, true);     // 沙发 / 大屏区
    (function () {
      // 玄关到餐区的通长灯槽
      var y = L.h - 0.1;
      scene.add(H.box(6.0, 0.09, 0.1, beamMat, 10.8, y, 2.0));
      scene.add(H.box(6.0, 0.09, 0.1, beamMat, 10.8, y, -2.0));
      [-1.9, 1.9].forEach(function (zz) {
        var s = new T.Mesh(new T.BoxGeometry(5.7, 0.018, 0.045), H.matGlow(0x9fe0ff, 2.0));
        s.position.set(10.8, L.h - 0.125, zz);
        scene.add(s);
      });
      var film = new T.Mesh(new T.PlaneGeometry(5.8, 3.8), filmMat);
      film.rotation.x = Math.PI / 2;
      film.position.set(10.8, L.h - 0.05, 0);
      scene.add(film);
    })();

    // ---- 天花通风口 / 检修盖板，细节密度 ----
    if (detail > 1) {
      var ventMat = new T.MeshStandardMaterial({
        color: 0x707a88, roughness: 0.6, metalness: 0.6, envMapIntensity: 1.0
      });
      [[11.2, 6.2], [1.0, 6.6], [-8.4, -6.4], [-8.4, 6.6], [-12.0, 1.4], [6.0, -7.2]]
        .forEach(function (p) {
          var v = H.box(0.62, 0.035, 0.34, ventMat, p[0], L.h - 0.03, p[1]);
          v.castShadow = false;
          scene.add(v);
          for (var i = 0; i < 4; i++) {
            var f = H.box(0.56, 0.02, 0.022, mats.darkMetal, p[0], L.h - 0.055, p[1] - 0.12 + i * 0.08);
            f.castShadow = false;
            scene.add(f);
          }
        });
    }
  };

  /* ---- 浮尘：让灯光有介质，空间立刻不「空」 ---- */
  function buildDust() {
    if (H.QUALITY.detail <= 0) return;
    var n = H.QUALITY.detail > 1 ? 900 : 420;
    var pos = new Float32Array(n * 3);
    var seed = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      pos[i * 3] = H.rand(L.x0, L.x1 + 4);
      pos[i * 3 + 1] = H.rand(0.15, L.h - 0.2);
      pos[i * 3 + 2] = H.rand(L.z0, L.z1);
      seed[i] = Math.random() * 100;
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));

    var mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uMap: { value: H.pointSprite() }, uSize: { value: 5.5 } },
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      vertexShader: [
        'attribute float aSeed;',
        'uniform float uTime; uniform float uSize;',
        'varying float vA;',
        'void main(){',
        '  vec3 p = position;',
        '  p.y += sin(uTime * 0.25 + aSeed) * 0.22;',
        '  p.x += sin(uTime * 0.17 + aSeed * 1.7) * 0.30;',
        '  p.z += cos(uTime * 0.21 + aSeed * 2.3) * 0.26;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  float d = -mv.z;',
        '  vA = (0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * 0.9 + aSeed * 3.1)))',
        '     * smoothstep(11.0, 2.5, d) * smoothstep(0.6, 1.8, d) * 0.30;',
        '  gl_PointSize = max(1.0, uSize / max(d, 0.6));',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uMap;',
        'varying float vA;',
        'void main(){',
        '  float a = texture2D(uMap, gl_PointCoord).a * vA;',
        '  if (a < 0.01) discard;',
        '  gl_FragColor = vec4(vec3(0.72, 0.86, 1.0) * a, a);',
        '}'
      ].join('\n')
    });

    var pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    pts.onBeforeRender = function () {
      mat.uniforms.uTime.value = performance.now() * 0.001;
    };
    scene.add(pts);
    H.dust = pts;
  }

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

    // 窗外城市：三层景深的程序化夜景，近景楼体遮挡远景霓虹，窗外才有「深度」
    var CW = 2048, CH = 1024;
    var c = H.tex.canvas(CW, CH);
    var g = c.getContext('2d');
    var HORIZON = CH * 0.80;

    var grd = g.createLinearGradient(0, 0, 0, CH);
    grd.addColorStop(0, '#03060e');
    grd.addColorStop(0.42, '#071120');
    grd.addColorStop(0.72, '#112a44');
    grd.addColorStop(0.86, '#1d4463');
    grd.addColorStop(1, '#0a1522');
    g.fillStyle = grd;
    g.fillRect(0, 0, CW, CH);

    // 星 + 低空云霭
    for (var si = 0; si < 420; si++) {
      var sy = Math.random() * CH * 0.45;
      g.fillStyle = 'rgba(210,228,255,' + H.rand(0.10, 0.55).toFixed(2) + ')';
      g.fillRect(Math.random() * CW, sy, 1.6, 1.6);
    }
    for (var ci = 0; ci < 26; ci++) {
      var cxp = Math.random() * CW, cyp = H.rand(CH * 0.26, CH * 0.62);
      var cr = H.rand(90, 300);
      var cg = g.createRadialGradient(cxp, cyp, 0, cxp, cyp, cr);
      cg.addColorStop(0, 'rgba(66,112,160,' + H.rand(0.05, 0.14).toFixed(3) + ')');
      cg.addColorStop(1, 'rgba(66,112,160,0)');
      g.fillStyle = cg;
      g.beginPath(); g.arc(cxp, cyp, cr, 0, H.TAU); g.fill();
    }

    // 远山轮廓
    g.fillStyle = '#060d17';
    g.beginPath();
    g.moveTo(0, HORIZON - 120);
    for (var mx = 0; mx <= CW; mx += 48) {
      g.lineTo(mx, HORIZON - 120 - Math.sin(mx * 0.0042) * 58 - H.fbm(mx * 0.01, 3.1, 3) * 56);
    }
    g.lineTo(CW, CH); g.lineTo(0, CH); g.closePath(); g.fill();

    // 三层楼群：越近越暗越大，窗口灯密度越高
    var LAYERS = [
      { n: 70, wMin: 16, wMax: 46, hMin: 70,  hMax: 230, base: HORIZON - 70, fill: 'rgba(10,18,30,', a: 0.80, lit: 0.22, step: 13, neon: 0.10 },
      { n: 52, wMin: 26, wMax: 72, hMin: 120, hMax: 380, base: HORIZON - 26, fill: 'rgba(7,13,22,',  a: 0.90, lit: 0.30, step: 12, neon: 0.22 },
      { n: 26, wMin: 50, wMax: 130, hMin: 190, hMax: 520, base: HORIZON + 40, fill: 'rgba(4,8,14,',  a: 0.97, lit: 0.26, step: 14, neon: 0.34 }
    ];
    LAYERS.forEach(function (L2) {
      for (var b = 0; b < L2.n; b++) {
        var bw = H.rand(L2.wMin, L2.wMax);
        var bh = H.rand(L2.hMin, L2.hMax);
        var bx = Math.random() * (CW + 80) - 40;
        var by = L2.base - bh;
        g.fillStyle = L2.fill + L2.a + ')';
        g.fillRect(bx, by, bw, bh + 200);
        // 楼顶航空警示灯
        if (Math.random() < 0.45) {
          g.fillStyle = 'rgba(255,90,70,0.9)';
          g.fillRect(bx + bw * 0.5 - 1.6, by - 5, 3.2, 3.2);
        }
        // 窗口灯
        for (var wy = by + 9; wy < L2.base; wy += L2.step) {
          for (var wx2 = bx + 4; wx2 < bx + bw - 5; wx2 += 8) {
            if (Math.random() > L2.lit) continue;
            var warm = Math.random() < 0.7;
            g.fillStyle = warm ? 'rgba(255,208,140,0.92)' : 'rgba(150,222,255,0.88)';
            g.fillRect(wx2, wy, 3.4, 4.2);
          }
        }
        // 立面霓虹条
        if (Math.random() < L2.neon) {
          var nc = Math.random() < 0.5 ? '120,235,255' : '255,120,190';
          g.fillStyle = 'rgba(' + nc + ',0.75)';
          if (Math.random() < 0.5) g.fillRect(bx + 2, by + 14, 2.6, bh * H.rand(0.3, 0.75));
          else g.fillRect(bx + 4, by + H.rand(20, 80), bw - 8, 3);
        }
      }
    });

    // 空中轨道与飞行器拖尾
    for (var li = 0; li < 5; li++) {
      var ly = H.rand(CH * 0.30, CH * 0.62);
      var lg = g.createLinearGradient(0, ly, CW, ly + H.rand(-60, 60));
      lg.addColorStop(0, 'rgba(120,200,255,0)');
      lg.addColorStop(0.5, 'rgba(140,215,255,' + H.rand(0.10, 0.22).toFixed(2) + ')');
      lg.addColorStop(1, 'rgba(120,200,255,0)');
      g.strokeStyle = lg;
      g.lineWidth = H.rand(1.2, 2.6);
      g.beginPath();
      g.moveTo(0, ly);
      g.bezierCurveTo(CW * 0.3, ly - 40, CW * 0.7, ly + 40, CW, ly + H.rand(-60, 60));
      g.stroke();
    }
    for (var vi = 0; vi < 16; vi++) {
      var vx = Math.random() * CW, vy = H.rand(CH * 0.25, CH * 0.66);
      var vl = H.rand(16, 54);
      var vg = g.createLinearGradient(vx, vy, vx + vl, vy + H.rand(-5, 5));
      var warmV = Math.random() < 0.5;
      vg.addColorStop(0, 'rgba(255,255,255,0)');
      vg.addColorStop(1, warmV ? 'rgba(255,196,130,0.85)' : 'rgba(150,230,255,0.85)');
      g.strokeStyle = vg;
      g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(vx, vy); g.lineTo(vx + vl, vy + H.rand(-5, 5)); g.stroke();
    }

    // 地平线辉光，把城市和天空焊在一起
    var hz = g.createLinearGradient(0, HORIZON - 150, 0, HORIZON + 90);
    hz.addColorStop(0, 'rgba(90,150,210,0)');
    hz.addColorStop(0.6, 'rgba(110,170,225,0.20)');
    hz.addColorStop(1, 'rgba(60,110,160,0)');
    g.fillStyle = hz;
    g.fillRect(0, HORIZON - 150, CW, 240);

    var cityTex = new T.CanvasTexture(c);
    cityTex.colorSpace = T.SRGBColorSpace;
    cityTex.anisotropy = H.maxAniso;
    var cityMat = new T.MeshBasicMaterial({ map: cityTex, fog: false });
    var city = new T.Mesh(new T.PlaneGeometry(52, 26), cityMat);
    city.position.set(3.4, 8.4, L.z1 + 9);
    city.rotation.y = Math.PI;
    scene.add(city);

    // 窗口的辉光溢色：窗外亮光在窗洞处散开，暗示玻璃厚度
    var halo = new T.Mesh(new T.PlaneGeometry((wx1 - wx0) + 0.6, L.h + 0.4),
      new T.MeshBasicMaterial({
        map: H.pointSprite(), color: 0x3f7fb8, transparent: true,
        opacity: 0.16, depthWrite: false, blending: T.AdditiveBlending, fog: false
      }));
    halo.position.set((wx0 + wx1) / 2, L.h * 0.52, L.z1 - 0.06);
    scene.add(halo);
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
  // o = { x, z, w, h, dir:'z'|'x', leaves:1|2, thick, panel, frame, track, range }
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
      color: 0xa9b7c3, roughness: 0.42, metalness: 0.2
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
        // 关门时更磨砂一点，门的存在感更明确
        panelMat.opacity = 0.52 + (1 - state.open) * 0.30;
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
    H.Lights.add(0xa8d8ff, 4.5, 11, 16.8, 2.6, 0);
  };

  /* ============================ 灯光 ============================ */
  H.buildLights = function () {
    scene = H.scene;
    // 有了 IBL 环境光之后，常量环境光要往回收，否则暗部全被抬平、没有体积
    H.scene.add(new T.HemisphereLight(0x27405f, 0x070a10, H.QUALITY.env ? 0.18 : 0.34));
    H.scene.add(new T.AmbientLight(0x1d2a40, H.QUALITY.env ? 0.26 : 0.55));

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
    // 这里只是「登记」，实际进场景的是 H.Lights 的固定槽位（见 core.js 3.5）
    var addPoint = H.Lights.add;
    addPoint(0xffd6a5, 11, 18, 4.4, 2.45, -4.2);    // 客厅 · 沙发区
    addPoint(0xffd2a0, 5.5, 16, 3.8, 2.62, 3.2);    // 客厅 · 入口侧
    addPoint(0xffe6c4, 10, 11, 11.6, 2.65, 5.4);    // 厨房 · 主灯（两组灯盘之间）
    addPoint(0xffcf9c, 5.0, 8, 12.9, 1.7, 7.4);     // 厨房 · 台面补光（吊柜下）
    addPoint(0xffd9b0, 4.5, 8, 10.0, 2.3, 3.9);     // 厨房 · 吧台侧补光
    addPoint(0xffd8ae, 5.0, 7, 5.2, 1.85, 5.4);     // 餐区 · 吊灯
    addPoint(0x9fdcff, 5.5, 11, 11.6, 2.5, 0);      // 玄关
    addPoint(0x4fd4ff, 7.5, 13, -9, 2.5, -5.2);     // 游戏房
    addPoint(0x3f6bff, 4.0, 12, -9, 2.4, 5.5);      // 影院
    H.bedroomLight = addPoint(0xffc89a, 7.5, 13, -11.6, 2.42, 1.0); // 卧室（可换色）
    addPoint(0xffd2a6, 3.6, 6, -12.3, 1.5, -1.5);   // 卧室 · 书桌台灯补光
    addPoint(0xffc9a2, 2.4, 5, -14.8, 3.05, -1.85); // 卧室 · 衣柜顶部洗墙

    // 窗外冷光（模拟城市溢光）
    var rim = new T.DirectionalLight(0x6ea8d8, 0.22);
    rim.position.set(6, 6, 20);
    scene.add(rim);

    buildLightShafts();
  };

  /* ---- 体积光锥：射灯下方的一截可见光柱，空气感全靠它 ---- */
  function buildLightShafts() {
    if (H.QUALITY.detail <= 0) return;
    H.shafts = [];
    var geo = new T.CylinderGeometry(0.10, 0.62, 2.5, 16, 1, true);
    var mat = new T.ShaderMaterial({
      uniforms: { uColor: { value: new T.Color(0xffd9ae) }, uStrength: { value: 0.30 } },
      transparent: true, depthWrite: false, side: T.DoubleSide,
      blending: T.AdditiveBlending, fog: false,
      vertexShader: [
        'varying vec2 vU; varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  vU = uv;',
        '  vN = normalize(normalMatrix * normal);',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  vV = normalize(-mv.xyz);',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uStrength;',
        'varying vec2 vU; varying vec3 vN; varying vec3 vV;',
        'void main(){',
        // 边缘朝向相机时最淡，正对时最亮——模拟光柱的侧面积分
        '  float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));',
        '  float fade = pow(1.0 - vU.y, 1.8);',          // 越往下越淡
        '  float a = rim * rim * fade * uStrength;',
        '  gl_FragColor = vec4(uColor * a, a);',
        '}'
      ].join('\n')
    });

    function shaft(x, z, color, strength, scale) {
      var m = new T.Mesh(geo, mat.clone());
      m.material.uniforms.uColor.value = new T.Color(color);
      m.material.uniforms.uStrength.value = strength;
      m.position.set(x, L.h - 1.3, z);
      if (scale) m.scale.set(scale, 1, scale);
      m.renderOrder = 2;
      scene.add(m);
      H.shafts.push(m);
    }
    // 走廊射灯下方
    for (var i = 0; i < 5; i++) shaft(-13 + i * 5.4, -7.2, 0xffd9ae, 0.26, 0.85);
    shaft(11.6, 0, 0x9fdcff, 0.30, 1.15);     // 玄关
    shaft(5.2, 5.4, 0xffd8ae, 0.24, 0.9);     // 餐桌吊灯
    shaft(11.6, 5.4, 0xffe6c4, 0.22, 1.0);    // 厨房
  }

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

  /* ============================ 区域剔除 ============================ *
   * 房间之间都有实墙，远处房间里的陈设（往往占了一半以上的 draw call）
   * 既看不见又在每帧消耗 CPU。这里按包围盒把「外壳之后加入的陈设」归到房间，
   * 离开一定距离就整组 visible=false。
   * 只收录「完整落在房间轮廓内」的对象 —— 地面 / 墙体 / 天花 / 落地窗 / 门厅
   * 都是跨区或外壳对象，永远保持可见，所以不会剔出空洞。
   * show 半径取得很保守：只有在「隔着墙、门洞也看不进去」的位置才会真的剔掉
   *   · 西三间：玄关 / 厨房 / 卫生间一侧（门此时是磨砂关闭状态）
   *   · 卫生间 / 康养室：玩家深入西区之后
   * live 半径比 show 小一圈：看不见时连 update（含屏幕重绘）一起停掉。
   * ======================================================================== */
  var CULL_DEF = [
    { zone: 'arcade',  rect: [-16.3, -2.02, -8.3, -2.52], ax: -9.0, az: -5.25, show: 21, live: 11 },
    { zone: 'bedroom', rect: [-16.3, -2.02, -2.48, 2.98], ax: -11.0, az: 0.25, show: 21, live: 11 },
    { zone: 'cinema',  rect: [-16.3, -2.02, 3.02, 8.3],   ax: -8.5, az: 5.5,  show: 21, live: 11 },
    { zone: 'bath',    rect: [9.92, 14.1, -8.3, -4.56],   ax: 11.9, az: -6.3, show: 22, live: 10 },
    { zone: 'care',    rect: [-2.0, 1.62, -8.3, -4.40],   ax: -0.2, az: -6.1, show: 16, live: 12 },
    // 客厅/玄关始终可见，这一条只用来决定「大屏等动画要不要继续刷」
    { zone: 'living',  ax: 4.4, az: -8.0, live: 17 }
  ];

  H.cull = (function () {
    var groups = [], live = {}, ready = false;

    function init() {
      if (ready) return;
      var kids = H.scene.children, start = H.shell.mark || 0;
      var i, j;
      for (i = 0; i < CULL_DEF.length; i++) {
        var d = CULL_DEF[i];
        groups.push({
          def: d, items: [], flags: [], on: true,
          show2: d.show ? d.show * d.show : -1,
          live2: d.live * d.live
        });
        live[d.zone] = true;
      }
      for (i = start; i < kids.length; i++) {
        var o = kids[i];
        if (o.isLight || !(o.isMesh || o.isGroup || o.isPoints)) continue;
        var bb = new T.Box3();
        try { bb.setFromObject(o); } catch (e) { continue; }
        if (bb.isEmpty() || !isFinite(bb.min.x) || !isFinite(bb.max.z)) continue;
        for (j = 0; j < groups.length; j++) {
          var r = groups[j].def.rect;
          if (!r) continue;
          if (bb.min.x >= r[0] && bb.max.x <= r[1] && bb.min.z >= r[2] && bb.max.z <= r[3]) {
            groups[j].items.push(o);
            groups[j].flags.push(o.visible);
            break;
          }
        }
      }
      ready = true;
    }

    function update(px, pz, zone) {
      if (!ready) return;
      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var dx = px - g.def.ax, dz = pz - g.def.az;
        var d2 = dx * dx + dz * dz;
        var here = zone === g.def.zone;
        live[g.def.zone] = here || d2 < g.live2;
        if (g.show2 < 0) continue;
        var want = here || d2 < g.show2;
        if (want === g.on) continue;
        g.on = want;
        for (var k = 0; k < g.items.length; k++) {
          g.items[k].visible = want ? g.flags[k] : false;
        }
      }
    }

    return {
      init: init,
      update: update,
      // 没登记过的区域（机器人、门等）默认一直活跃
      isLive: function (zone) { return live[zone] === undefined ? true : live[zone]; },
      stat: function () {
        var s = [];
        for (var i = 0; i < groups.length; i++) {
          s.push(groups[i].def.zone + ':' + groups[i].items.length + (groups[i].on ? '+' : '-'));
        }
        return s.join(' ');
      }
    };
  })();
})(window.HOME);
