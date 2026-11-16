(function () {
  "use strict";

  var T = window.THREE;
  var bootEl = document.getElementById("boot");
  if (!T) { bootEl.textContent = "three.js 加载失败"; return; }

  /* ============================================================
   *  0. 工具
   * ========================================================== */
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var TAU = Math.PI * 2;

  function hash2(x, y) {
    var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return h - Math.floor(h);
  }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, oct) {
    var s = 0, amp = 0.5, f = 1;
    for (var i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; }
    return s;
  }

  /* ============================================================
   *  1. 渲染器 / 场景 / 相机
   * ========================================================== */
  var canvas = document.getElementById("view");
  var renderer = new T.WebGLRenderer({
    canvas: canvas, antialias: true, powerPreference: "high-performance", stencil: false
  });
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;      // 线性写进 HDR RT，最终 pass 自己 tonemap
  renderer.setClearColor(0x05080f, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.15, 3000);

  /* ============================================================
   *  2. 色调与常量
   * ========================================================== */
  var MOON_DIR = new T.Vector3(-0.46, 0.198, -0.866).normalize();
  var MOON_COL = new T.Color(0xdfe9ff);

  var SKY = {
    zenith: new T.Color(0x03040b),
    horizon: new T.Color(0x0d1c30),
    glow: new T.Color(0x1b3a56),
    deep: new T.Color(0x04121c),
    shallow: new T.Color(0x123f4a)
  };

  /* 天空/海面共用的解析天空色（保证地平线无缝对接） */
  var SKY_GLSL = [
    "vec3 skyColor(vec3 d, vec3 moonDir, vec3 zen, vec3 hor, vec3 glow){",
    "  float h = clamp(d.y, -1.0, 1.0);",
    "  float t = pow(clamp(h * 1.15, 0.0, 1.0), 0.55);",
    "  vec3 col = mix(hor, zen, t);",
    "  float md = max(dot(d, moonDir), 0.0);",
    "  col += vec3(0.50, 0.64, 0.94) * (pow(md, 90.0) * 0.42 + pow(md, 12.0) * 0.02);",
    "  col += glow * pow(1.0 - clamp(abs(h) * 6.0, 0.0, 1.0), 3.0) * 0.20;",
    "  return col;",
    "}"
  ].join("\n");

  var NOISE_GLSL = [
    "float hash12(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",
    "float noise2(vec2 p){",
    "  vec2 i = floor(p), f = fract(p);",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),",
    "             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);",
    "}",
    "float fbm2(vec2 p){",
    "  float s = 0.0, a = 0.5;",
    "  for (int i = 0; i < 5; i++){ s += a * noise2(p); p *= 2.03; a *= 0.5; }",
    "  return s;",
    "}"
  ].join("\n");

  /* ============================================================
   *  3. 星空穹顶
   * ========================================================== */
  var skyMat = new T.ShaderMaterial({
    uniforms: {
      uMoonDir: { value: MOON_DIR },
      uZenith: { value: SKY.zenith },
      uHorizon: { value: SKY.horizon },
      uGlow: { value: SKY.glow },
      uTime: { value: 0 }
    },
    vertexShader: [
      "varying vec3 vDir;",
      "void main(){",
      "  vDir = normalize(position);",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
    fragmentShader: [
      SKY_GLSL,
      NOISE_GLSL,
      "uniform vec3 uMoonDir, uZenith, uHorizon, uGlow;",
      "uniform float uTime;",
      "varying vec3 vDir;",
      "void main(){",
      "  vec3 d = normalize(vDir);",
      "  vec3 col = skyColor(d, uMoonDir, uZenith, uHorizon, uGlow);",
      // 银河带（一条倾斜的淡雾）
      "  float band = exp(-pow((d.y * 0.80 - d.x * 0.40 - 0.12) * 4.6, 2.0));",
      "  float n = fbm2(vec2(d.x * 2.6 + d.y * 1.7, d.z * 2.6 - d.y * 1.1) + 3.1);",
      "  col += band * vec3(0.014, 0.017, 0.032) * (0.25 + 1.0 * n);",
      // 地平线以下（被海面覆盖，仅作保险，颜色需与海面远端完全一致）
      "  col = mix(col, uHorizon * 1.06, smoothstep(0.03, -0.04, d.y));",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n"),
    side: T.BackSide, depthWrite: false, depthTest: false, fog: false
  });
  var sky = new T.Mesh(new T.SphereGeometry(1400, 40, 24), skyMat);
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  scene.add(sky);

  /* ============================================================
   *  4. 星辰
   * ========================================================== */
  var STAR_COUNT = 4600;
  var starGeo = new T.BufferGeometry();
  (function () {
    var pos = new Float32Array(STAR_COUNT * 3);
    var size = new Float32Array(STAR_COUNT);
    var phase = new Float32Array(STAR_COUNT);
    var tint = new Float32Array(STAR_COUNT);
    var v = new T.Vector3();
    for (var i = 0; i < STAR_COUNT; i++) {
      // 半球均匀采样，略偏向天顶
      var y = Math.pow(Math.random(), 0.72);
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var a = Math.random() * TAU;
      v.set(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(900);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      var big = Math.random() < 0.03;
      size[i] = big ? rand(2.4, 3.6) : rand(0.55, 1.9);
      phase[i] = Math.random();
      tint[i] = Math.random();
    }
    starGeo.setAttribute("position", new T.BufferAttribute(pos, 3));
    starGeo.setAttribute("aSize", new T.BufferAttribute(size, 1));
    starGeo.setAttribute("aPhase", new T.BufferAttribute(phase, 1));
    starGeo.setAttribute("aTint", new T.BufferAttribute(tint, 1));
  })();

  var starMat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uProj: { value: 1000 } },
    vertexShader: [
      "attribute float aSize; attribute float aPhase; attribute float aTint;",
      "uniform float uTime, uProj;",
      "varying vec3 vCol; varying float vA;",
      "void main(){",
      "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
      "  float tw = 0.70 + 0.32 * sin(uTime * (0.55 + aPhase * 1.9) + aPhase * 27.3);",
      "  gl_PointSize = max(1.2, aSize * 1.45 * uProj / max(1.0, -mv.z) * tw);",
      "  gl_Position = projectionMatrix * mv;",
      "  vec3 cool = vec3(0.72, 0.83, 1.0);",
      "  vec3 warm = vec3(1.0, 0.90, 0.76);",
      "  vCol = mix(cool, warm, aTint * 0.55 + 0.10) * (0.55 + 0.75 * tw);",
      "  vA = 0.45 + 0.55 * aPhase;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "varying vec3 vCol; varying float vA;",
      "void main(){",
      "  float d = length(gl_PointCoord - 0.5) * 2.0;",
      "  float a = smoothstep(1.0, 0.10, d);",
      "  a = a * a;",
      "  gl_FragColor = vec4(vCol * (0.5 + 1.15 * a), a * vA);",
      "}"
    ].join("\n"),
    transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: true, fog: false
  });
  var stars = new T.Points(starGeo, starMat);
  stars.renderOrder = -50;
  stars.frustumCulled = false;
  scene.add(stars);

  /* ============================================================
   *  5. 月
   * ========================================================== */
  var moonMat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: [
      "varying vec2 vUv;",
      "void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
    ].join("\n"),
    fragmentShader: [
      NOISE_GLSL,
      "uniform float uTime;",
      "varying vec2 vUv;",
      "void main(){",
      "  vec2 c = vUv - 0.5;",
      "  float r = length(c) * 2.0;",
      "  const float R = 0.80;",
      "  float disc = smoothstep(R, R - 0.010, r);",
      "  vec2 uv2 = c / R;",
      // 月海与细节
      "  float maria = fbm2(uv2 * 2.9 + 5.3);",
      "  float detail = fbm2(uv2 * 8.0 - 1.7);",
      "  vec3 base = mix(vec3(1.0, 0.98, 0.94), vec3(0.34, 0.335, 0.318), smoothstep(0.33, 0.60, maria));",
      "  base *= 0.88 + 0.22 * detail;",
      // 环形山（几个软斑点）
      "  float craters = 0.0;",
      "  craters += smoothstep(0.10, 0.0, length(uv2 - vec2(-0.31, 0.22))) * 0.16;",
      "  craters += smoothstep(0.08, 0.0, length(uv2 - vec2(0.24, -0.34))) * 0.13;",
      "  craters += smoothstep(0.06, 0.0, length(uv2 - vec2(0.12, 0.40))) * 0.10;",
      "  base *= 1.0 - craters;",
      // 临边昏暗
      "  float limb = pow(1.0 - clamp(r / R, 0.0, 1.0), 0.42);",
      "  base *= 0.52 + 0.60 * limb;",
      // 光晕
      "  float halo = exp(-max(r - R, 0.0) * 12.0) * smoothstep(1.0, R, r);",
      "  float corona = pow(max(0.0, 1.0 - r), 3.6) * 0.05;",
      "  vec3 col = base * disc * 0.56 + vec3(0.70, 0.81, 1.0) * (halo * 0.10 + corona * 0.5);",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n"),
    transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: true, fog: false
  });
  var moon = new T.Mesh(new T.PlaneGeometry(1, 1), moonMat);
  moon.scale.setScalar(74);
  moon.renderOrder = -40;
  moon.frustumCulled = false;
  scene.add(moon);

  /* ============================================================
   *  6. 海面（单象限 · 全程序化法线 + 解析反射）
   * ========================================================== */
  var seaMat = new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCamPos: { value: new T.Vector3() },
      uMoonDir: { value: MOON_DIR },
      uMoonCol: { value: MOON_COL },
      uZenith: { value: SKY.zenith },
      uHorizon: { value: SKY.horizon },
      uGlow: { value: SKY.glow },
      uDeep: { value: SKY.deep },
      uShallow: { value: SKY.shallow }
    },
    vertexShader: [
      "varying vec3 vWorld;",
      "void main(){",
      "  vec4 wp = modelMatrix * vec4(position, 1.0);",
      "  vWorld = wp.xyz;",
      "  gl_Position = projectionMatrix * viewMatrix * wp;",
      "}"
    ].join("\n"),
    fragmentShader: [
      NOISE_GLSL,
      "uniform float uTime;",
      "uniform vec3 uCamPos, uMoonDir, uMoonCol, uZenith, uHorizon, uGlow, uDeep, uShallow;",
      "varying vec3 vWorld;",
      // 只反射「天空本体」，不含月晕 → 避免整片海被月晕洗白
      "vec3 skyRefl(vec3 d){",
      "  float h = clamp(d.y, -0.2, 1.0);",
      "  float t = pow(clamp(h * 1.15, 0.0, 1.0), 0.55);",
      "  vec3 col = mix(uHorizon, uZenith, t);",
      "  col += uGlow * pow(1.0 - clamp(abs(h) * 6.0, 0.0, 1.0), 3.0) * 0.18;",
      "  return col;",
      "}",
      "vec2 waveGrad(vec2 p, vec2 dir, float k, float amp, float spd, float ph0){",
      "  float ph = dot(p, dir) * k + uTime * spd + ph0;",
      "  return dir * (k * amp * cos(ph));",
      "}",
      "void main(){",
      "  vec2 p = vWorld.xz;",
      "  float dist = length(vWorld - uCamPos);",
      // 相位抖动：打断远距离的规则条纹
      "  vec2 jit = vec2(fbm2(p * 0.33 + 3.1), fbm2(p * 0.35 - 7.3)) - 0.5;",
      "  vec2 pw = p + jit * 2.8;",
      "  vec2 g = vec2(0.0);",
      // 四组方向波，振幅很小 → 平静海面
      "  g += waveGrad(pw, normalize(vec2(0.86, 0.51)), 0.52, 0.105, 0.55, 0.0);",
      "  g += waveGrad(pw, normalize(vec2(-0.42, 0.91)), 1.05, 0.075, 0.85, 1.7);",
      "  g += waveGrad(pw, normalize(vec2(0.34, -0.94)), 2.20, 0.034, 1.35, 3.1);",
      "  g += waveGrad(pw, normalize(vec2(-0.88, -0.47)), 4.60, 0.016, 2.10, 5.2);",
      // 细碎涟漪（让月光倒影闪动）
      "  float rip = fbm2(p * 1.8 + vec2(uTime * 0.10, uTime * 0.06));",
      "  g += (vec2(noise2(p * 3.1 + uTime * 0.3), noise2(p * 3.3 - uTime * 0.27)) - 0.5) * 0.045 * (0.4 + rip);",
      "  g *= 1.0 / (1.0 + dist * 0.085);",   // 远处拉平，消除掠射角条纹
      "  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));",
      "  vec3 V = normalize(uCamPos - vWorld);",
      "  float ndv = max(dot(N, V), 0.0);",
      "  vec3 R = reflect(-V, N);",
      "  vec3 refl = skyRefl(R);",
      // 月光在水面的窄倒影（越远越收敛）
      "  float md = max(dot(R, uMoonDir), 0.0);",
      "  float farFade = 0.35 + 0.65 / (1.0 + dist * 0.030);",
      "  float glitter = pow(md, 26.0) * 0.020 * farFade + pow(md, 130.0) * 0.55 * farFade + pow(md, 1200.0) * 1.7 * farFade;",
      "  refl += uMoonCol * glitter;",
      // 菲涅尔
      "  float fres = 0.016 + 0.80 * pow(1.0 - ndv, 5.0);",
      "  float d = length(p);",
      "  float shallow = 1.0 - smoothstep(10.0, 30.0, d);",
      "  vec3 body = mix(uDeep, uShallow, shallow);",
      "  vec3 col = mix(body, refl, clamp(fres, 0.0, 1.0));",
      // 直接镜面（一点点，点缀）
      "  vec3 H = normalize(V + uMoonDir);",
      "  col += uMoonCol * pow(max(dot(N, H), 0.0), 2200.0) * 1.2 * farFade;",
      // 近岸极淡的白边
      "  float foam = smoothstep(11.8, 10.2, d) * (0.55 + 0.45 * sin(uTime * 0.55 + d * 2.6));",
      "  col += vec3(0.30, 0.41, 0.52) * foam * 0.13 * pow(1.0 - ndv, 2.2);",
      // 远处融进地平线（与天空地平线同色，保证无缝）
      "  col = mix(col, uHorizon * 1.06, smoothstep(70.0, 380.0, dist));",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n"),
    fog: false
  });
  var seaGeo = new T.PlaneGeometry(1800, 1800, 1, 1);
  seaGeo.rotateX(-Math.PI / 2);
  var sea = new T.Mesh(seaGeo, seaMat);
  sea.frustumCulled = false;
  sea.receiveShadow = false;
  scene.add(sea);

  /* ============================================================
   *  7. 岛屿
   * ========================================================== */
  var ISLAND_R = 10.6;

  function buildIsland() {
    var SIZE = 36, SEG = 180;
    var geo = new T.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);

    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);

    var cDry = new T.Color(0xb09a72);
    var cWet = new T.Color(0x6b6246);
    var cDeep = new T.Color(0x2c2a1e);
    var cGrass = new T.Color(0x36563c);
    var tmp = new T.Color();

    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      var ang = Math.atan2(z, x);
      var Rd = ISLAND_R * (1 + 0.13 * Math.sin(3 * ang + 0.9) + 0.075 * Math.sin(5 * ang + 2.4) + 0.038 * Math.sin(8 * ang + 4.1));
      var d = Math.sqrt(x * x + z * z);
      var t = d / Rd;
      var y;

      if (t <= 1) {
        var k = clamp((1 - t) / 0.60, 0, 1);          // t <= 0.40 为中央台地
        y = 2.55 * Math.pow(k, 1.30);
        y *= 0.94 + 0.12 * fbm(x * 0.55 + 7.3, z * 0.55 - 2.1, 3);
        y += 0.26 * (fbm(x * 1.55 + 4.2, z * 1.55 - 8.6, 3) - 0.5) * (0.35 + k);
      } else {
        y = -0.45 - 1.7 * Math.min(1, (t - 1) * 1.1);
      }
      y -= 0.03;
      pos.setY(i, y);

      var c;
      if (y > 1.05) c = tmp.copy(cGrass).lerp(cDry, 0.30);
      else if (y > 0.22) c = tmp.copy(cDry);
      else if (y > 0.0) c = tmp.copy(cDry).lerp(cWet, 0.66);
      else c = tmp.copy(cWet).lerp(cDeep, 0.85);

      var m = 0.82 + 0.34 * fbm(x * 3.2 + 11.0, z * 3.2 - 5.0, 3);
      colors[i * 3] = c.r * m;
      colors[i * 3 + 1] = c.g * m;
      colors[i * 3 + 2] = c.b * m;
    }

    pos.needsUpdate = true;
    geo.setAttribute("color", new T.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    var mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, metalness: 0.0 });
    var mesh = new T.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    return mesh;
  }
  var island = buildIsland();
  scene.add(island);

  function sandHeightAt(x, z) {
    var ang = Math.atan2(z, x);
    var Rd = ISLAND_R * (1 + 0.13 * Math.sin(3 * ang + 0.9) + 0.075 * Math.sin(5 * ang + 2.4) + 0.038 * Math.sin(8 * ang + 4.1));
    var d = Math.sqrt(x * x + z * z);
    var t = d / Rd;
    if (t > 1) return -0.2;
    var k = clamp((1 - t) / 0.60, 0, 1);
    var y = 2.55 * Math.pow(k, 1.30);
    y *= 0.94 + 0.12 * fbm(x * 0.55 + 7.3, z * 0.55 - 2.1, 3);
    return y - 0.03;
  }

  /* -------- 礁石 -------- */
  (function buildRocks() {
    var rockMat = new T.MeshStandardMaterial({ color: 0x34383f, roughness: 0.96, metalness: 0.03, flatShading: true });
    var spots = [
      [8.4, 3.2, 0.85], [-7.6, 5.3, 0.62], [6.2, -6.9, 0.48],
      [-8.9, -3.4, 0.72], [1.6, 9.1, 0.40], [-3.2, -9.4, 0.34]
    ];
    for (var i = 0; i < spots.length; i++) {
      var geo = new T.SphereGeometry(1, 9, 7);
      var p = geo.attributes.position;
      for (var v = 0; v < p.count; v++) {
        var sx = p.getX(v), sy = p.getY(v), sz = p.getZ(v);
        var n = 0.72 + 0.55 * vnoise(sx * 3.1 + i * 5.2, sz * 3.1 + sy * 1.7);
        p.setXYZ(v, sx * n, sy * n * 0.75, sz * n);
      }
      geo.computeVertexNormals();
      var m = new T.Mesh(geo, rockMat);
      var s = spots[i][2];
      m.scale.set(s * rand(1.0, 1.5), s * rand(0.7, 1.1), s * rand(1.0, 1.4));
      m.position.set(spots[i][0], rand(-0.12, 0.10), spots[i][1]);
      m.rotation.set(rand(0, 3), rand(0, 6), rand(0, 3));
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
  })();

  /* ============================================================
   *  8. 椰子树
   * ========================================================== */
  var TREE_POS = new T.Vector3(-1.7, 0, -1.1);

  function buildTrunkGeometry() {
    var pts = [
      new T.Vector3(0, 0, 0),
      new T.Vector3(0.03, 1.05, 0.04),
      new T.Vector3(0.22, 2.05, 0.06),
      new T.Vector3(0.54, 2.95, 0.02),
      new T.Vector3(0.98, 3.62, -0.07),
      new T.Vector3(1.34, 4.02, -0.16)
    ];
    var curve = new T.CatmullRomCurve3(pts, false, "catmullrom", 0.35);

    var LEN = 46, RAD = 13;
    var positions = [], colors = [], indices = [], normals = [];
    var tan = new T.Vector3(), n1 = new T.Vector3(), n2 = new T.Vector3(), dir = new T.Vector3(), p = new T.Vector3();
    var cBase = new T.Color(0x5f4d39), cTop = new T.Color(0x8b7457), cTmp = new T.Color();

    for (var i = 0; i <= LEN; i++) {
      var t = i / LEN;
      curve.getPointAt(t, p);
      curve.getTangentAt(t, tan);
      n1.set(0, 1, 0).cross(tan);
      if (n1.lengthSq() < 1e-6) n1.set(1, 0, 0);
      n1.normalize();
      n2.crossVectors(tan, n1).normalize();

      var taper = Math.pow(1 - t, 0.75);
      var r = (0.132 + 0.195 * taper) * (1 + 0.05 * Math.sin(t * 52.0));
      var ring = 0.5 + 0.5 * Math.sin(t * 52.0);

      for (var j = 0; j < RAD; j++) {
        var a = j / RAD * TAU;
        dir.copy(n1).multiplyScalar(Math.cos(a)).addScaledVector(n2, Math.sin(a));
        positions.push(p.x + dir.x * r, p.y + dir.y * r, p.z + dir.z * r);
        normals.push(dir.x, dir.y, dir.z);
        cTmp.copy(cBase).lerp(cTop, clamp(t * 0.85 + ring * 0.18, 0, 1));
        colors.push(cTmp.r, cTmp.g, cTmp.b);
      }
    }
    for (var s = 0; s < LEN; s++) {
      for (var k = 0; k < RAD; k++) {
        var a0 = s * RAD + k, a1 = s * RAD + (k + 1) % RAD;
        var b0 = (s + 1) * RAD + k, b1 = (s + 1) * RAD + (k + 1) % RAD;
        indices.push(a0, a1, b0, a1, b1, b0);
      }
    }
    var g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    return { geo: g, curve: curve };
  }

  function buildFrondGeometry(len, droop, width, segs) {
    var positions = [], colors = [], indices = [];
    var cIn = new T.Color(0x2e5636), cOut = new T.Color(0x5d8a4e);
    var cTmp = new T.Color();
    var ax = new T.Vector3(), bx = new T.Vector3();

    for (var i = 0; i <= segs; i++) {
      var t = i / segs;
      var x = len * t;
      var arch = 0.50 * Math.sin(t * Math.PI * 0.92) * (1 - t * 0.12);
      var y = arch - droop * Math.pow(t, 2.35);

      var w = width * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.55)), 0.72) * (1 - 0.10 * t);
      var serr = 1 - 0.06 * Math.abs(Math.sin(t * 26.0));
      var hw = Math.max(0.002, w * 0.5 * serr);
      var fold = 0.12 * w;

      ax.set(x, y + fold, hw);
      bx.set(x, y + fold, -hw);
      positions.push(ax.x, ax.y, ax.z, bx.x, bx.y, bx.z);

      var shade = 0.52 + 0.55 * t;
      cTmp.copy(cIn).lerp(cOut, t * 0.92).multiplyScalar(shade);
      colors.push(cTmp.r, cTmp.g, cTmp.b);
      colors.push(cTmp.r * 0.88, cTmp.g * 0.88, cTmp.b * 0.88);
    }
    for (var s = 0; s < segs; s++) {
      var a0 = s * 2, a1 = s * 2 + 1, b0 = (s + 1) * 2, b1 = (s + 1) * 2 + 1;
      indices.push(a0, a1, b0, a1, b1, b0);
    }
    var g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  (function buildTree() {
    var tree = new T.Group();
    var trunk = buildTrunkGeometry();

    var trunkMat = new T.MeshStandardMaterial({
      vertexColors: true, roughness: 0.96, metalness: 0.0, side: T.DoubleSide
    });
    var trunkMesh = new T.Mesh(trunk.geo, trunkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    tree.add(trunkMesh);

    var crown = trunk.curve.getPointAt(1);

    var frondMat = new T.MeshStandardMaterial({
      vertexColors: true, roughness: 0.70, metalness: 0.0, side: T.DoubleSide,
      emissive: new T.Color(0x0c1a10), emissiveIntensity: 0.95
    });

    var N = 15;
    for (var i = 0; i < N; i++) {
      var geo = buildFrondGeometry(rand(2.35, 3.30), rand(1.10, 1.85), rand(0.62, 0.94), 28);
      var m = new T.Mesh(geo, frondMat);
      var a = (i / N) * TAU + rand(-0.16, 0.16);
      m.position.copy(crown);
      m.rotation.set(0, a, 0);
      m.rotateZ(rand(-0.30, 0.35));
      m.rotateX(rand(-0.10, 0.10));
      m.castShadow = true;
      m.receiveShadow = true;
      tree.add(m);
    }

    // 椰子
    var cocoMat = new T.MeshStandardMaterial({ color: 0x4a3a26, roughness: 0.9, metalness: 0.0 });
    for (var c = 0; c < 4; c++) {
      var s = new T.Mesh(new T.SphereGeometry(0.115, 12, 10), cocoMat);
      var ang = (c / 4) * TAU + 0.5;
      s.position.set(
        crown.x + Math.cos(ang) * 0.17,
        crown.y - 0.17 - c * 0.015,
        crown.z + Math.sin(ang) * 0.17
      );
      s.castShadow = true;
      tree.add(s);
    }

    TREE_POS.y = sandHeightAt(TREE_POS.x, TREE_POS.z) - 0.05;
    tree.position.copy(TREE_POS);
    tree.rotation.y = -0.35;
    tree.scale.setScalar(1.18);
    scene.add(tree);
  })();

  /* ============================================================
   *  9. 灯光
   * ========================================================== */
  var moonLight = new T.DirectionalLight(0xcfe0ff, 1.35);
  moonLight.position.copy(MOON_DIR).multiplyScalar(70);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -11;
  moonLight.shadow.camera.right = 11;
  moonLight.shadow.camera.top = 11;
  moonLight.shadow.camera.bottom = -11;
  moonLight.shadow.camera.near = 20;
  moonLight.shadow.camera.far = 140;
  moonLight.shadow.bias = -0.0002;
  moonLight.shadow.normalBias = 0.022;
  scene.add(moonLight);

  var hemi = new T.HemisphereLight(0x3c5b86, 0x0b1018, 0.95);
  scene.add(hemi);

  var fill = new T.DirectionalLight(0x33547c, 0.95);
  fill.position.set(0.55, 0.42, 0.86);
  scene.add(fill);

  /* ============================================================
   *  10. 烟花
   * ========================================================== */
  function Fireworks(max) {
    this.max = max;
    this.parts = [];

    var geo = new T.BufferGeometry();
    this.posArr = new Float32Array(max * 3);
    this.colArr = new Float32Array(max * 3);
    this.sizArr = new Float32Array(max);
    this.alpArr = new Float32Array(max);

    var pAttr = new T.BufferAttribute(this.posArr, 3).setUsage(T.DynamicDrawUsage);
    var cAttr = new T.BufferAttribute(this.colArr, 3).setUsage(T.DynamicDrawUsage);
    var sAttr = new T.BufferAttribute(this.sizArr, 1).setUsage(T.DynamicDrawUsage);
    var aAttr = new T.BufferAttribute(this.alpArr, 1).setUsage(T.DynamicDrawUsage);
    geo.setAttribute("position", pAttr);
    geo.setAttribute("aColor", cAttr);
    geo.setAttribute("aSize", sAttr);
    geo.setAttribute("aAlpha", aAttr);
    geo.setDrawRange(0, 0);

    this.geo = geo;
    var mat = new T.ShaderMaterial({
      uniforms: { uProj: { value: 1000 } },
      vertexShader: [
        "attribute vec3 aColor; attribute float aSize; attribute float aAlpha;",
        "uniform float uProj;",
        "varying vec3 vCol; varying float vA;",
        "void main(){",
        "  vCol = aColor; vA = aAlpha;",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        "  gl_PointSize = max(1.0, aSize * uProj / max(0.6, -mv.z));",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying vec3 vCol; varying float vA;",
        "void main(){",
        "  float d = length(gl_PointCoord - 0.5) * 2.0;",
        "  float core = smoothstep(1.0, 0.0, d);",
        "  float g = pow(core, 3.0) * 1.55 + core * 0.45;",
        "  gl_FragColor = vec4(vCol * g * vA, g * vA);",
        "}"
      ].join("\n"),
      transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: true, fog: false
    });
    this.mat = mat;
    this.points = new T.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this.palette = [
      [1.00, 0.72, 0.32], [1.00, 0.42, 0.52], [0.55, 0.80, 1.00],
      [0.62, 1.00, 0.66], [1.00, 0.90, 0.62], [0.85, 0.62, 1.00]
    ];
    this.enabled = false;
    this.timer = 0.4;
    this.clock = 0;
  }

  Fireworks.prototype.spark = function (o) {
    if (this.parts.length >= this.max) return;
    this.parts.push(o);
  };

  Fireworks.prototype.burst = function (x, y, z, color) {
    sfx.burst(x, y, z);

    var n = 210 + Math.floor(Math.random() * 170);
    var speed = rand(7.0, 12.5);
    var style = Math.random();
    var pr = color[0], pg = color[1], pb = color[2];

    // 中心闪光
    this.spark({ k: 1, x: x, y: y, z: z, vx: 0, vy: 0, vz: 0,
      life: 0.15, max: 0.15, size: rand(5.0, 8.0), r: pr + 0.5, g: pg + 0.5, b: pb + 0.5 });

    for (var i = 0; i < n; i++) {
      var u = Math.random() * 2 - 1;
      var th = Math.random() * TAU;
      var sr = Math.sqrt(Math.max(0, 1 - u * u));
      var sp = speed * (0.55 + Math.random() * 0.55);
      if (style < 0.3) sp *= 0.72;               // 紧凑型
      if (style > 0.82) sp *= 1.12;              // 开场型

      var tint = 0.95 + Math.random() * 0.45;
      this.spark({
        k: 1,
        x: x, y: y, z: z,
        vx: sr * Math.cos(th) * sp,
        vy: u * sp * 0.95 + rand(0.2, 1.2),
        vz: sr * Math.sin(th) * sp,
        life: rand(1.7, 3.2) * (style < 0.3 ? 1.2 : 1.0),
        max: 3.2,
        size: rand(0.12, 0.24),
        r: Math.min(1.7, pr * tint),
        g: Math.min(1.7, pg * tint),
        b: Math.min(1.7, pb * tint)
      });
    }
  };

  Fireworks.prototype.launch = function (tx, ty, tz) {
    var color = this.palette[Math.floor(Math.random() * this.palette.length)];
    var sx = tx + rand(-0.6, 0.6);
    var sz = tz + rand(-0.6, 0.6);
    var dist = Math.max(6, ty);
    var vy = Math.sqrt(2 * 7.0 * dist);
    var life = vy / 7.0 + 0.15;
    this.spark({
      k: 0, x: sx, y: 0.35, z: sz,
      vx: (tx - sx) / life * 0.55, vy: vy, vz: (tz - sz) / life * 0.55,
      life: life, max: life, size: 0.30,
      r: color[0], g: color[1], b: color[2], c: color, cy: ty
    });
  };

  Fireworks.prototype.update = function (dt) {
    this.clock += dt;

    if (this.enabled) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = rand(0.75, 1.9);
        var a = Math.random() * TAU;
        var rr = rand(2.0, 11.0);
        this.launch(Math.cos(a) * rr, rand(9, 20), Math.sin(a) * rr);
      }
    }

    var keep = [];
    var drag, gy;
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      if (p.k === 0) {
        // 上升的烟花弹
        p.vy -= 7.0 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.life -= dt;
        // 尾迹
        if (Math.random() < 0.85) {
          this.spark({
            k: 1, x: p.x, y: p.y, z: p.z,
            vx: rand(-0.5, 0.5), vy: rand(-1.2, -0.2), vz: rand(-0.5, 0.5),
            life: rand(0.25, 0.6), max: 0.6, size: rand(0.05, 0.10),
            r: 1.0, g: 0.72, b: 0.35
          });
        }
        if (p.y >= p.cy || p.vy <= 0.5 || p.life <= 0) {
          this.burst(p.x, Math.max(6, p.y), p.z, p.c);
          continue;
        }
        keep.push(p);
      } else {
        drag = 1.0 - 1.25 * dt;
        gy = 9.8 * 0.30;
        p.vx *= drag; p.vy *= drag; p.vz *= drag;
        p.vy -= gy * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.life -= dt;
        if (p.life <= 0) continue;
        keep.push(p);
      }
    }
    this.parts = keep;

    // 写缓冲区
    var idx = 0, pos = this.posArr, col = this.colArr, siz = this.sizArr, alp = this.alpArr;
    for (var j = 0; j < this.parts.length && idx < this.max; j++) {
      var q = this.parts[j];
      var lf = clamp(q.life / (q.max || 1), 0, 1);
      var a = q.k === 0 ? 1.0 : Math.pow(lf, 0.75);
      a *= 0.80 + 0.20 * Math.sin(this.clock * 42 + j * 1.7);
      pos[idx * 3] = q.x; pos[idx * 3 + 1] = q.y; pos[idx * 3 + 2] = q.z;
      col[idx * 3] = q.r; col[idx * 3 + 1] = q.g; col[idx * 3 + 2] = q.b;
      siz[idx] = q.size * (0.55 + 0.45 * lf) * (q.k === 0 ? 1.0 : 1.0);
      alp[idx] = a;
      idx++;
    }
    this.geo.setDrawRange(0, idx);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  };

  /* ============================================================
   *  10.2 音效：WebAudio 程序化合成（零音频文件）
   *   - 烟花爆开：低频 boom + 气团噪声 + 余烬噼啪
   *   - 距离衰减 + 左右声像 + 程序化 IR 混响尾
   * ========================================================== */
  var sfx = (function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    var ctx = null, master = null, wet = null, noiseBuf = null;
    var enabled = true, lastAt = -1;

    function makeNoise() {
      var len = Math.floor(ctx.sampleRate * 2);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    // 程序化 IR：噪声 × 指数衰减，做出夜海上的长尾
    function makeIR(seconds, decay) {
      var len = Math.floor(ctx.sampleRate * seconds);
      var buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch);
        for (var i = 0; i < len; i++) {
          var t = i / len;
          var fade = i < 90 ? i / 90 : 1;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * fade;
        }
      }
      return buf;
    }

    function init() {
      if (ctx || !AC) return ctx;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);

        var conv = ctx.createConvolver();
        conv.buffer = makeIR(2.2, 2.8);
        wet = ctx.createGain();
        wet.gain.value = 0.55;
        wet.connect(conv);
        conv.connect(master);

        noiseBuf = makeNoise();
      } catch (e) {
        ctx = null;
      }
      return ctx;
    }

    // 必须在用户手势里调用（浏览器自动播放策略）
    function unlock() {
      if (!enabled) return;
      init();
      if (ctx && ctx.state === "suspended") ctx.resume();
    }

    var _right = new T.Vector3();
    var _rel = new T.Vector3();

    function burst(x, y, z) {
      if (!enabled || !ctx || ctx.state !== "running") return;
      var now = ctx.currentTime;
      if (now - lastAt < 0.045) return;            // 连发时避免叠成噪音
      lastAt = now;

      var d = Math.sqrt(
        Math.pow(x - camera.position.x, 2) +
        Math.pow(y - camera.position.y, 2) +
        Math.pow(z - camera.position.z, 2)
      );
      var near = clamp(1.15 - d / 95, 0.20, 1);
      var vol = near * near * 0.55;

      // 声像：爆点相对相机的左右投影
      _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      _rel.set(x - camera.position.x, 0, z - camera.position.z);
      var pan = _rel.lengthSq() > 1e-4 ? clamp(_rel.normalize().dot(_right), -1, 1) * 0.75 : 0;

      var t = now + 0.005;
      var out = ctx.createGain();
      out.gain.value = vol;

      var panner = null;
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        out.connect(panner);
        panner.connect(master);
        panner.connect(wet);
      } else {
        out.connect(master);
        out.connect(wet);
      }

      // 这一段放完就断开，避免长会话里节点越积越多
      setTimeout(function () {
        try { out.disconnect(); } catch (e) { /* ignore */ }
        if (panner) { try { panner.disconnect(); } catch (e) { /* ignore */ } }
      }, 1600);

      // 1) 低频 boom：快速下坠的正弦
      var osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(rand(130, 190), t);
      osc.frequency.exponentialRampToValueAtTime(rand(34, 46), t + 0.32);

      var og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.95, t + 0.012);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);

      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 300;
      lp.Q.value = 0.4;

      osc.connect(og);
      og.connect(lp);
      lp.connect(out);
      osc.start(t);
      osc.stop(t + 0.95);

      // 2) 气团张开：带通噪声，中心频率往下扫 → 远去的感觉
      var n1 = ctx.createBufferSource();
      n1.buffer = noiseBuf;
      n1.playbackRate.value = rand(0.85, 1.15);

      var bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(rand(1100, 1500), t);
      bp.frequency.exponentialRampToValueAtTime(280, t + 0.55);
      bp.Q.value = 0.65;

      var ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);

      n1.connect(bp);
      bp.connect(ng);
      ng.connect(out);
      n1.start(t);
      n1.stop(t + 0.7);

      // 3) 余烬噼啪
      var pops = 9 + Math.floor(Math.random() * 8);
      for (var i = 0; i < pops; i++) {
        var at = t + rand(0.10, 1.15);
        var amp = rand(0.03, 0.11) * (1 - (at - t) / 1.5);
        if (amp <= 0.002) continue;

        var src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.playbackRate.value = rand(0.9, 1.5);

        var hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = rand(1600, 3200);

        var g = ctx.createGain();
        g.gain.setValueAtTime(amp, at);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);

        src.connect(hp);
        hp.connect(g);
        g.connect(out);
        src.start(at);
        src.stop(at + 0.07);
      }
    }

    return {
      unlock: unlock,
      burst: burst,
      isEnabled: function () { return enabled; },
      state: function () { return ctx ? ctx.state : "none"; },
      setEnabled: function (on) { enabled = on; }   // 只切开关，音频上下文由手势解锁
    };
  })();

  var fireworks = new Fireworks(6000);

  /* ============================================================
   *  10.5 流星雨（屏幕空间统一方向，自上而下）
   * ========================================================== */
  var METEOR_D = 300;         // 流星所在平面到相机的距离
  var METEOR_SEG = 16;        // 每条流星的拖尾段数

  function Meteors(maxStreaks) {
    this.max = maxStreaks;
    this.streaks = [];
    this.SEG = METEOR_SEG;

    var vcount = maxStreaks * METEOR_SEG * 2;
    this.posArr = new Float32Array(vcount * 3);
    this.colArr = new Float32Array(vcount * 3);

    var geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(this.posArr, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute("color", new T.BufferAttribute(this.colArr, 3).setUsage(T.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.geo = geo;

    // 细线（WebGL 线宽恒为 1px）+ 顶点色叠加 → 越靠头越亮
    this.mat = new T.LineBasicMaterial({
      vertexColors: true, transparent: true, blending: T.AdditiveBlending,
      depthWrite: false, depthTest: true, fog: false
    });
    this.line = new T.LineSegments(geo, this.mat);
    this.line.frustumCulled = false;
    scene.add(this.line);

    this.enabled = false;
    this.timer = 0.2;
    this.clock = 0;

    this._fwd = new T.Vector3();
    this._right = new T.Vector3();
    this._up = new T.Vector3();

    this.nu = 0.85; this.nv = -0.52;     // 屏幕空间统一方向（单位向量）
    this.speed = 260;
    this.pickShower();
  }

  // 整场流星雨只有一个屏幕方向：向右下（或左下）斜落
  Meteors.prototype.pickShower = function () {
    var sign = Math.random() < 0.5 ? 1 : -1;
    var ang = rand(0.34, 0.52);          // 19°~30° 的下坠角
    this.nu = Math.cos(ang) * sign;
    this.nv = -Math.sin(ang);
    this.speed = rand(230, 320);
  };

  Meteors.prototype.basis = function () {
    this._fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    this._right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this._up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  };

  Meteors.prototype.spawn = function () {
    if (this.streaks.length >= this.max) return;
    this.basis();

    var halfH = METEOR_D * Math.tan(camera.fov * Math.PI / 360);
    var halfW = halfH * camera.aspect;
    var camY = camera.position.y;
    var fwd = this._fwd, up = this._up, right = this._right;

    // 这块平面上「海平线」所在的高度（世界 y == 相机高度）
    var vHorizon = (-fwd.y * METEOR_D) / Math.max(0.25, up.y);
    var vMin = Math.max(vHorizon + METEOR_D * 0.05, -halfH * 0.85);
    var vMax = halfH * 0.95;
    if (vMax < vMin + METEOR_D * 0.02) return;      // 当前视角看不到天空

    var u = 0, v = 0, ok = false;
    for (var tries = 0; tries < 10 && !ok; tries++) {
      u = rand(-halfW * 1.00, halfW * 1.00);
      v = rand(vMin + (vMax - vMin) * 0.30, vMax);
      var wy = camY + fwd.y * METEOR_D + up.y * v + right.y * u;
      ok = wy > camY + METEOR_D * 0.035;             // 起点必须明显高于海面
    }
    if (!ok) return;

    var sp = this.speed * rand(0.85, 1.15);
    var tint = Math.random();
    var col = tint < 0.58 ? [0.95, 0.97, 1.00]
      : (tint < 0.88 ? [0.72, 0.85, 1.00] : [1.00, 0.88, 0.70]);

    this.streaks.push({
      u: u, v: v,
      du: this.nu * sp, dv: this.nv * sp,
      tail: rand(40, 78),                            // 拖尾长度（世界单位）
      gain: rand(0.80, 1.35),
      cr: col[0], cg: col[1], cb: col[2],
      fade: 0, life: 0
    });
  };

  Meteors.prototype.update = function (dt) {
    this.clock += dt;

    if (this.enabled) {
      this.timer -= dt;
      if (this.timer <= 0) {
        var burst = Math.random() < 0.22 ? 2 + Math.floor(Math.random() * 3) : 1;
        for (var b = 0; b < burst; b++) this.spawn();
        this.timer = rand(0.14, 0.42);
      }
    }

    this.basis();
    var halfH = METEOR_D * Math.tan(camera.fov * Math.PI / 360);
    var halfW = halfH * camera.aspect;
    var camY = camera.position.y;
    var fwd = this._fwd, up = this._up, right = this._right;
    var camX = camera.position.x, camZ = camera.position.z;
    var baseX = camX + fwd.x * METEOR_D, baseY = camY + fwd.y * METEOR_D, baseZ = camZ + fwd.z * METEOR_D;

    var keep = [];
    var idx = 0, pos = this.posArr, col = this.colArr, SEG = this.SEG;

    for (var i = 0; i < this.streaks.length; i++) {
      var s = this.streaks[i];
      s.life += dt;
      s.u += s.du * dt;
      s.v += s.dv * dt;

      var wy = baseY + up.y * s.v + right.y * s.u;

      // 淡入 + 贴近海平线淡出 + 出画面淡出
      var target = clamp(s.life / 0.06, 0, 1)
        * clamp((wy - camY - METEOR_D * 0.02) / (METEOR_D * 0.05), 0, 1)
        * clamp((halfW - Math.abs(s.u)) / (halfW * 0.14), 0, 1)
        * clamp((halfH - Math.abs(s.v)) / (halfH * 0.14), 0, 1);
      s.fade += (target - s.fade) * Math.min(1, dt * 14);
      if (target <= 0 && s.fade < 0.02) continue;
      if (wy < camY + METEOR_D * 0.012) continue;    // 硬性下限：不画到海平面以下

      if (idx + SEG * 2 > this.max * SEG * 2) break;

      for (var k = 0; k < SEG; k++) {
        for (var e = 0; e < 2; e++) {
          var f = (k + e) / SEG;
          var uu = s.u - this.nu * s.tail * f;
          var vv = s.v - this.nv * s.tail * f;
          var o = (idx + k * 2 + e) * 3;
          pos[o] = baseX + right.x * uu + up.x * vv;
          pos[o + 1] = baseY + right.y * uu + up.y * vv;
          pos[o + 2] = baseZ + right.z * uu + up.z * vv;
          var bright = Math.pow(1 - f, 1.7) * s.fade * s.gain;
          col[o] = s.cr * bright * 1.45;
          col[o + 1] = s.cg * bright * 1.45;
          col[o + 2] = s.cb * bright * 1.45;
        }
      }
      idx += SEG * 2;
      keep.push(s);
    }

    this.streaks = keep;
    this.geo.setDrawRange(0, idx);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  };

  var meteors = new Meteors(20);

  /* ============================================================
   *  11. 后期：亮度提取 + 双重模糊 + 合成（自写 bloom）
   * ========================================================== */
  var fsGeo = new T.BufferGeometry();
  fsGeo.setAttribute("position", new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  fsGeo.setAttribute("uv", new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  var fsQuad = new T.Mesh(fsGeo, null);
  fsQuad.frustumCulled = false;
  var fsCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var halfOk = false;
  try {
    halfOk = !!(renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float"));
  } catch (e) { halfOk = false; }
  var RT_TYPE = halfOk ? T.HalfFloatType : T.UnsignedByteType;

  var dbSize = new T.Vector2();
  renderer.getDrawingBufferSize(dbSize);

  var rtOptsA = { type: RT_TYPE, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true, stencilBuffer: false };
  var rtOptsB = { type: RT_TYPE, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, stencilBuffer: false };

  var rtScene = new T.WebGLRenderTarget(dbSize.x, dbSize.y, rtOptsA);
  var rtA = new T.WebGLRenderTarget(Math.max(2, dbSize.x >> 2), Math.max(2, dbSize.y >> 2), rtOptsB);
  var rtB = new T.WebGLRenderTarget(Math.max(2, dbSize.x >> 2), Math.max(2, dbSize.y >> 2), rtOptsB);

  var passCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var brightMat = new T.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uThresh: { value: halfOk ? 0.85 : 0.62 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: [
      "uniform sampler2D tSrc; uniform float uThresh;",
      "varying vec2 vUv;",
      "void main(){",
      "  vec3 c = texture2D(tSrc, vUv).rgb;",
      "  float l = max(c.r, max(c.g, c.b));",
      "  float w = smoothstep(uThresh, uThresh * 1.9, l);",
      "  gl_FragColor = vec4(c * w, 1.0);",
      "}"
    ].join("\n"),
    depthTest: false, depthWrite: false
  });

  var blurMat = new T.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uDir: { value: new T.Vector2(1, 0) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: [
      "uniform sampler2D tSrc; uniform vec2 uDir;",
      "varying vec2 vUv;",
      "void main(){",
      "  vec3 s = texture2D(tSrc, vUv).rgb * 0.2270270270;",
      "  s += texture2D(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;",
      "  s += texture2D(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;",
      "  s += texture2D(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;",
      "  s += texture2D(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;",
      "  gl_FragColor = vec4(s, 1.0);",
      "}"
    ].join("\n"),
    depthTest: false, depthWrite: false
  });

  var compositeMat = new T.ShaderMaterial({
    uniforms: {
      tScene: { value: null },
      tBloom: { value: null },
      uBloom: { value: 0.62 },
      uExposure: { value: 1.22 },
      uRes: { value: new T.Vector2(dbSize.x, dbSize.y) }
    },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: [
      "uniform sampler2D tScene, tBloom;",
      "uniform float uBloom, uExposure;",
      "uniform vec2 uRes;",
      "varying vec2 vUv;",
      "vec3 aces(vec3 x){",
      "  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;",
      "  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);",
      "}",
      "vec3 toSRGB(vec3 c){",
      "  vec3 lo = c * 12.92;",
      "  vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(0.41666667)) - 0.055;",
      "  return mix(hi, lo, step(c, vec3(0.0031308)));",
      "}",
      "void main(){",
      "  vec3 col = texture2D(tScene, vUv).rgb;",
      "  col += texture2D(tBloom, vUv).rgb * uBloom;",
      "  col *= uExposure;",
      "  col = aces(col);",
      "  vec2 q = vUv - 0.5;",
      "  col *= 1.0 - 0.40 * pow(clamp(length(q) * 1.40, 0.0, 1.0), 2.2);",
      "  float g = fract(sin(dot(vUv * uRes, vec2(12.9898, 78.233))) * 43758.5453);",
      "  col += (g - 0.5) * 0.010;",
      "  gl_FragColor = vec4(toSRGB(col), 1.0);",
      "}"
    ].join("\n"),
    depthTest: false, depthWrite: false
  });

  function blit(material, target) {
    fsQuad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(fsQuad, fsCam);
  }

  function resizeTargets() {
    renderer.getDrawingBufferSize(dbSize);
    rtScene.setSize(dbSize.x, dbSize.y);
    var w = Math.max(2, dbSize.x >> 2), h = Math.max(2, dbSize.y >> 2);
    rtA.setSize(w, h); rtB.setSize(w, h);
    compositeMat.uniforms.uRes.value.set(dbSize.x, dbSize.y);
  }

  /* ============================================================
   *  12. 自由视角（轨道 + 阻尼 + 空闲自转）
   * ========================================================== */
  var HOME = { theta: 0.16, phi: 1.36, radius: 37 };
  var orbit = {
    theta: HOME.theta, phi: HOME.phi, radius: HOME.radius,
    tTheta: HOME.theta, tPhi: HOME.phi, tRadius: HOME.radius,
    target: new T.Vector3(0, 3.4, 0),
    dragging: false, pointers: {}, moved: 0, downAt: 0, idle: 0, pinchDist: 0
  };

  function applyOrbit(dt) {
    orbit.idle += dt;
    if (!orbit.dragging && orbit.idle > 2.6) orbit.tTheta += dt * 0.030;

    var k = 1 - Math.exp(-dt * 9.0);
    orbit.theta = lerp(orbit.theta, orbit.tTheta, k);
    orbit.phi = lerp(orbit.phi, orbit.tPhi, k);
    orbit.radius = lerp(orbit.radius, orbit.tRadius, 1 - Math.exp(-dt * 6.5));

    var sp = Math.sin(orbit.phi), cp = Math.cos(orbit.phi);
    camera.position.set(
      orbit.target.x + orbit.radius * sp * Math.sin(orbit.theta),
      orbit.target.y + orbit.radius * cp,
      orbit.target.z + orbit.radius * sp * Math.cos(orbit.theta)
    );
    if (camera.position.y < 0.8) camera.position.y = 0.8;
    camera.lookAt(orbit.target);
  }

  var ptrCount = 0;
  canvas.addEventListener("pointerdown", function (e) {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    orbit.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    ptrCount++;
    orbit.dragging = true;
    orbit.moved = 0;
    orbit.idle = 0;
    orbit.downAt = performance.now();
    if (ptrCount === 2) {
      var ids = Object.keys(orbit.pointers);
      var a = orbit.pointers[ids[0]], b = orbit.pointers[ids[1]];
      orbit.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }, { passive: true });

  canvas.addEventListener("pointermove", function (e) {
    var p = orbit.pointers[e.pointerId];
    if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    orbit.moved += Math.abs(dx) + Math.abs(dy);
    orbit.idle = 0;

    if (ptrCount >= 2) {
      var ids = Object.keys(orbit.pointers);
      if (ids.length >= 2) {
        var a = orbit.pointers[ids[0]], b = orbit.pointers[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        if (orbit.pinchDist > 0) {
          orbit.tRadius = clamp(orbit.tRadius * (orbit.pinchDist / Math.max(1, d)), 12, 70);
        }
        orbit.pinchDist = d;
      }
      return;
    }
    orbit.tTheta -= dx * 0.0052;
    orbit.tPhi = clamp(orbit.tPhi - dy * 0.0038, 0.62, 1.50);
  }, { passive: true });

  function endPointer(e) {
    if (orbit.pointers[e.pointerId]) {
      delete orbit.pointers[e.pointerId];
      ptrCount = Math.max(0, ptrCount - 1);
    }
    if (ptrCount === 0) {
      orbit.dragging = false;
      var dt = performance.now() - orbit.downAt;
      if (orbit.moved < 7 && dt < 420) launchAtPointer(e.clientX, e.clientY);
    }
  }
  canvas.addEventListener("pointerup", endPointer, { passive: true });
  canvas.addEventListener("pointercancel", endPointer, { passive: true });

  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    orbit.tRadius = clamp(orbit.tRadius * (1 + Math.sign(e.deltaY) * 0.085), 12, 70);
    orbit.idle = 0;
  }, { passive: false });

  /* ---- 点击夜空：放一枚烟花 ---- */
  var ndc = new T.Vector3();
  var dirTmp = new T.Vector3();
  function launchAtPointer(cx, cy) {
    ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1, 0.5);
    ndc.unproject(camera);
    dirTmp.copy(ndc).sub(camera.position).normalize();
    var px = camera.position.x + dirTmp.x * 60;
    var py = camera.position.y + dirTmp.y * 60;
    var pz = camera.position.z + dirTmp.z * 60;
    px = clamp(px, -13, 13);
    pz = clamp(pz, -13, 13);
    py = clamp(py, 9, 26);
    fireworks.launch(px, py, pz);
  }

  /* ============================================================
   *  13. UI
   * ========================================================== */
  var btnFW = document.getElementById("btn-fw");
  var btnMet = document.getElementById("btn-met");
  var btnReset = document.getElementById("btn-reset");
  var btnSnd = document.getElementById("btn-snd");
  var fpsEl = document.getElementById("fps");

  function setFireworks(on) {
    fireworks.enabled = on;
    btnFW.setAttribute("aria-pressed", on ? "true" : "false");
    btnFW.querySelector(".label").textContent = on ? "关闭烟花" : "开启烟花";
    if (on) fireworks.timer = 0.15;
  }

  function setMeteors(on) {
    meteors.enabled = on;
    btnMet.setAttribute("aria-pressed", on ? "true" : "false");
    btnMet.querySelector(".label").textContent = on ? "关闭流星" : "开启流星";
    if (on) {
      meteors.pickShower();                  // 每次开启都取一个当前的侧向方向
      meteors.timer = 0.12;
      meteors.spawn(); meteors.spawn();      // 打开立刻先来两颗
    }
  }

  function resetView() {
    orbit.tTheta = HOME.theta; orbit.tPhi = HOME.phi; orbit.tRadius = HOME.radius;
    orbit.idle = 0;
  }

  function setSound(on) {
    sfx.setEnabled(on);
    btnSnd.setAttribute("aria-pressed", on ? "true" : "false");
    btnSnd.querySelector(".label").textContent = on ? "音效开" : "音效关";
  }

  btnFW.addEventListener("click", function () { setFireworks(!fireworks.enabled); });
  btnMet.addEventListener("click", function () { setMeteors(!meteors.enabled); });
  btnReset.addEventListener("click", function () { resetView(); });
  btnSnd.addEventListener("click", function () { setSound(!sfx.isEnabled()); });
  setSound(true);

  // 浏览器自动播放策略：在第一次用户手势里创建/恢复 AudioContext
  (function unlockAudioOnFirstGesture() {
    var unlock = function () {
      sfx.unlock();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  })();

  window.addEventListener("keydown", function (e) {
    if (e.code === "Space") {
      e.preventDefault();
      setFireworks(!fireworks.enabled);
    } else if (e.code === "KeyF") {
      // 手动放一枚：朝屏幕中上方
      launchAtPointer(window.innerWidth * 0.5, window.innerHeight * 0.35);
    } else if (e.code === "KeyM") {
      setMeteors(!meteors.enabled);
    } else if (e.code === "KeyG") {
      meteors.spawn();                     // 手动单颗流星（不受开关限制）
    } else if (e.code === "KeyR") {
      resetView();
    } else if (e.code === "KeyS") {
      setSound(!sfx.isEnabled());
    } else if (e.code === "Escape") {
      location.href = "../index.html#scene";
    }
  });

  window.addEventListener("resize", function () {
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    resizeTargets();
  });

  /* ============================================================
   *  14. 主循环
   * ========================================================== */
  var clock = new T.Clock();
  var time = 0;
  var fpsAcc = 0, fpsFrames = 0, projScale = 1000;

  function updateProjScale() {
    var h = renderer.getDrawingBufferSize(dbSize).y;
    projScale = h / (2 * Math.tan(camera.fov * Math.PI / 360));
  }
  updateProjScale();

  function step(dtIn) {
    var dt = Math.min(dtIn, 0.05);
    time += dt;

    applyOrbit(dt);

    // uniforms
    skyMat.uniforms.uTime.value = time;
    starMat.uniforms.uTime.value = time;
    moonMat.uniforms.uTime.value = time;
    seaMat.uniforms.uTime.value = time;
    seaMat.uniforms.uCamPos.value.copy(camera.position);
    starMat.uniforms.uProj.value = projScale;
    fireworks.mat.uniforms.uProj.value = projScale;

    // 跟随相机（天穹 / 星辰 / 月亮）
    sky.position.copy(camera.position);
    stars.position.copy(camera.position);
    moon.position.copy(camera.position).addScaledVector(MOON_DIR, 800);
    moon.quaternion.copy(camera.quaternion);

    fireworks.update(dt);
    meteors.update(dt);

    // ---- 1) 场景 → HDR RT
    renderer.setRenderTarget(rtScene);
    renderer.clear();
    renderer.render(scene, camera);

    // ---- 2) 亮度提取
    brightMat.uniforms.tSrc.value = rtScene.texture;
    blit(brightMat, rtA);

    // ---- 3) 两轮模糊
    for (var i = 0; i < 2; i++) {
      blurMat.uniforms.tSrc.value = rtA.texture;
      blurMat.uniforms.uDir.value.set(1.0 / rtA.width, 0);
      blit(blurMat, rtB);

      blurMat.uniforms.tSrc.value = rtB.texture;
      blurMat.uniforms.uDir.value.set(0, 1.0 / rtA.height);
      blit(blurMat, rtA);
    }

    // ---- 4) 合成到屏幕
    compositeMat.uniforms.tScene.value = rtScene.texture;
    compositeMat.uniforms.tBloom.value = rtA.texture;
    blit(compositeMat, null);

    return dt;
  }

  function frame() {
    var dt = step(clock.getDelta());

    // FPS
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc > 0.5) {
      fpsEl.textContent = Math.round(fpsFrames / fpsAcc) + " FPS";
      fpsAcc = 0; fpsFrames = 0;
    }

    requestAnimationFrame(frame);
  }

  applyOrbit(0.016);
  renderer.compile(scene, camera);
  frame();

  setTimeout(function () {
    bootEl.classList.add("done");
    setTimeout(function () { bootEl.style.display = "none"; }, 950);
  }, 260);

  window.__ISLE__ = {
    scene: scene, camera: camera, renderer: renderer, fireworks: fireworks,
    meteors: meteors, sfx: sfx, setFireworks: setFireworks, setMeteors: setMeteors,
    setSound: setSound,
    orbit: orbit, info: function () { return renderer.info; },
    // 调试/自动化：手动推进若干帧（页面被切到后台时 rAF 会冻结）
    step: function (dt, n) {
      var f = dt || 1 / 60, c = n || 1, d = 0;
      for (var i = 0; i < c; i++) d = step(f);
      return time;
    }
  };
})();
