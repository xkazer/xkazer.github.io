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
  var TIERS = {
    low:    { name: 'low',    scale: 0.70, shadow: 0,    tex: 512,  bloom: 1 },
    medium: { name: 'medium', scale: 0.85, shadow: 1024, tex: 1024, bloom: 1 },
    high:   { name: 'high',   scale: 1.00, shadow: 2048, tex: 1024, bloom: 1 }
  };
  var BUDGET = { low: 1.0e6, medium: 1.5e6, high: 2.3e6 };

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
    if (/SwiftShader|llvmpipe|Software|Mali|Adreno|PowerVR/i.test(gpu) ||
        (/Intel/i.test(gpu) && !/Arc/i.test(gpu))) return JSON.parse(JSON.stringify(TIERS.medium));

    return JSON.parse(JSON.stringify(TIERS.high));
  }

  var QUALITY = pickQuality();
  H.QUALITY = QUALITY;

  /* ============================ 3. 渲染器 / 场景 / 相机 ============================ */
  var renderer = null, scene = null, camera = null, post = null;
  var dynScale = 1;
  H.size = new T.Vector2(1, 1);

  H.init3D = function (canvas) {
    renderer = new T.WebGLRenderer({
      canvas: canvas, antialias: false, powerPreference: 'high-performance', stencil: false
    });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NoToneMapping;      // 色调映射在最后一个 pass 里自研
    renderer.setClearColor(0x05070c, 1);
    renderer.shadowMap.enabled = QUALITY.shadow > 0;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    scene = new T.Scene();
    scene.fog = new T.FogExp2(0x070b12, 0.0135);

    camera = new T.PerspectiveCamera(74, 1, 0.08, 260);

    H.renderer = renderer;
    H.scene = scene;
    H.camera = camera;

    post = H.createPost(renderer, scene, camera);
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

  var gov = { settle: 3.0, acc: 0, n: 0, upWait: 0, floorHits: 0 };
  H.govern = function (dtMs) {
    if (dtMs > 1500) return;                       // 切后台 / 断点，忽略
    gov.settle -= dtMs / 1000;
    if (gov.settle > 0) { gov.acc = 0; gov.n = 0; return; }

    gov.acc += dtMs; gov.n++;
    if (gov.n < 45 && gov.acc < 900) return;

    var avg = gov.acc / gov.n;
    gov.acc = 0; gov.n = 0;
    var s = dynScale;

    if (avg > 21.5 && s > 0.6) {                   // 太慢
      s = avg > 45 ? 0.6 : Math.max(0.6, s - (avg > 30 ? 0.2 : 0.1));
      gov.upWait = Math.min(20, Math.max(2, gov.upWait * 2));
    } else if (avg < 17.4 && s < 1 && gov.upWait <= 0) {
      s = Math.min(1, s + 0.1);
      gov.upWait = 2;
    }
    if (gov.upWait > 0) gov.upWait--;

    s = Math.round(s * 10) / 10;
    if (s !== dynScale) {
      dynScale = s;
      gov.settle = 1;
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

    var rtScene = new T.WebGLRenderTarget(2, 2, optsA);
    var rtA = new T.WebGLRenderTarget(2, 2, optsB);
    var rtB = new T.WebGLRenderTarget(2, 2, optsB);

    var brightMat = new T.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uThresh: { value: halfOk ? 0.82 : 0.60 } },
      vertexShader: FS_FRAG_HEAD + ' void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }',
      fragmentShader: [
        FS_FRAG_HEAD,
        'uniform sampler2D tSrc; uniform float uThresh;',
        'void main(){',
        '  vec3 c = texture2D(tSrc, vUv).rgb;',
        '  float l = max(c.r, max(c.g, c.b));',
        '  float w = smoothstep(uThresh, uThresh * 1.9, l);',
        '  gl_FragColor = vec4(c * w, 1.0);',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });

    var blurMat = new T.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uDir: { value: new T.Vector2(1, 0) } },
      vertexShader: FS_FRAG_HEAD + ' void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }',
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
        uBloom: { value: 0.30 },
        uExposure: { value: 0.92 },
        uRes: { value: new T.Vector2(2, 2) },
        uTime: { value: 0 },
        uTint: { value: new T.Color(1, 1, 1) }
      },
      vertexShader: FS_FRAG_HEAD + ' void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }',
      fragmentShader: [
        FS_FRAG_HEAD,
        'uniform sampler2D tScene, tBloom;',
        'uniform float uBloom, uExposure, uTime;',
        'uniform vec2 uRes;',
        'uniform vec3 uTint;',
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
        // 轻微色散，只在外圈生效
        '  vec2 q = uv - 0.5;',
        '  float r2 = dot(q, q);',
        '  vec3 col = texture2D(tScene, uv + q * r2 * 0.006).rgb;',
        '  col += texture2D(tBloom, uv).rgb * uBloom;',
        '  col *= uExposure;',
        '  col *= uTint;',
        '  col = aces(col);',
        '  col *= 1.0 - 0.34 * pow(clamp(length(q) * 1.42, 0.0, 1.0), 2.4);',
        '  float g = fract(sin(dot(uv * uRes + uTime * 61.7, vec2(12.9898, 78.233))) * 43758.5453);',
        '  col += (g - 0.5) * 0.012;',
        '  gl_FragColor = vec4(toSRGB(col), 1.0);',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });

    function blit(mat, target) {
      quad.material = mat;
      rd.setRenderTarget(target);
      rd.render(quad, ortho);
    }

    var api = {
      uniforms: compMat.uniforms,
      setSize: function (w, h) {
        rtScene.setSize(Math.max(2, w), Math.max(2, h));
        var bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
        rtA.setSize(bw, bh);
        rtB.setSize(bw, bh);
        compMat.uniforms.uRes.value.set(w, h);
      },
      render: function (time) {
        compMat.uniforms.uTime.value = time;

        rd.setRenderTarget(rtScene);
        rd.clear();
        rd.render(sc, cam);

        if (QUALITY.bloom) {
          brightMat.uniforms.tSrc.value = rtScene.texture;
          blit(brightMat, rtA);
          for (var i = 0; i < 2; i++) {
            blurMat.uniforms.tSrc.value = rtA.texture;
            blurMat.uniforms.uDir.value.set(1.0 / rtA.width, 0);
            blit(blurMat, rtB);

            blurMat.uniforms.tSrc.value = rtB.texture;
            blurMat.uniforms.uDir.value.set(0, 1.0 / rtA.height);
            blit(blurMat, rtA);
          }
          compMat.uniforms.tBloom.value = rtA.texture;
        }

        compMat.uniforms.tScene.value = rtScene.texture;
        blit(compMat, null);
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
    t.anisotropy = 4;
    if (srgb !== false) t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  var S = Math.max(256, Math.min(QUALITY.tex, 1024));

  function texMarble() {
    var c = makeCanvas(S), g = c.getContext('2d');
    g.fillStyle = '#d9dbdd';
    g.fillRect(0, 0, S, S);
    // 大面积色块 + 细噪点，模拟水磨石
    for (var i = 0; i < 2600; i++) {
      var x = Math.random() * S, y = Math.random() * S, r = H.rand(0.6, 3.2);
      var v = H.rand(0.55, 1.0);
      g.fillStyle = 'rgba(' + Math.round(210 * v) + ',' + Math.round(212 * v) + ',' + Math.round(215 * v) + ',0.55)';
      g.beginPath(); g.arc(x, y, r, 0, H.TAU); g.fill();
    }
    // 板缝
    g.strokeStyle = 'rgba(150,155,160,0.5)';
    g.lineWidth = Math.max(1, S / 512);
    g.beginPath();
    g.moveTo(0, S / 2); g.lineTo(S, S / 2);
    g.moveTo(S / 2, 0); g.lineTo(S / 2, S);
    g.stroke();
    return finishTex(c, 6, 6);
  }

  function texWood() {
    var c = makeCanvas(S), g = c.getContext('2d');
    g.fillStyle = '#3b2a20';
    g.fillRect(0, 0, S, S);
    var planks = 6, ph = S / planks;
    for (var p = 0; p < planks; p++) {
      var base = H.rand(0.72, 1.05);
      g.fillStyle = 'rgba(' + Math.round(78 * base) + ',' + Math.round(56 * base) + ',' + Math.round(40 * base) + ',1)';
      g.fillRect(0, p * ph, S, ph - 1);
      for (var i = 0; i < 90; i++) {
        var y = p * ph + Math.random() * ph;
        g.strokeStyle = 'rgba(30,20,14,' + H.rand(0.05, 0.22).toFixed(3) + ')';
        g.lineWidth = H.rand(0.5, 1.6);
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(S * 0.3, y + H.rand(-6, 6), S * 0.7, y + H.rand(-6, 6), S, y + H.rand(-3, 3));
        g.stroke();
      }
    }
    return finishTex(c, 4, 4);
  }

  function texWall() {
    var c = makeCanvas(S), g = c.getContext('2d');
    g.fillStyle = '#c9ccd1';
    g.fillRect(0, 0, S, S);
    for (var i = 0; i < 9000; i++) {
      var x = Math.random() * S, y = Math.random() * S;
      g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '120,126,134') + ',' + H.rand(0.02, 0.07).toFixed(3) + ')';
      g.fillRect(x, y, H.rand(1, 3), H.rand(1, 3));
    }
    return finishTex(c, 3, 2);
  }

  function texFabric() {
    var c = makeCanvas(256), g = c.getContext('2d');
    g.fillStyle = '#3a3f46';
    g.fillRect(0, 0, 256, 256);
    for (var y = 0; y < 256; y += 3) {
      for (var x = 0; x < 256; x += 3) {
        var v = 0.85 + Math.random() * 0.3;
        g.fillStyle = 'rgba(' + Math.round(58 * v) + ',' + Math.round(63 * v) + ',' + Math.round(70 * v) + ',0.9)';
        g.fillRect(x, y, 2, 2);
      }
    }
    return finishTex(c, 8, 8);
  }

  function texRug() {
    var c = makeCanvas(512), g = c.getContext('2d');
    g.fillStyle = '#20242c';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(120,190,230,0.18)';
    g.lineWidth = 2;
    for (var i = 0; i < 9; i++) {
      g.strokeRect(20 + i * 10, 20 + i * 10, 472 - i * 20, 472 - i * 20);
    }
    g.strokeStyle = 'rgba(120,190,230,0.10)';
    for (var k = 0; k <= 8; k++) {
      g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64, 512); g.stroke();
      g.beginPath(); g.moveTo(0, k * 64); g.lineTo(512, k * 64); g.stroke();
    }
    return finishTex(c, 1, 1);
  }

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
    fabric: texFabric,
    rug: texRug,
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
