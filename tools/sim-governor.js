/* 未来家居 · 动态画质调速器的离线收敛性验证
 *
 * 为什么需要它：
 *   调速器的失效模式是「偶发卡顿 → 误判跑不动 → 降级 → 降级本身触发材质重编译
 *   → 又测到卡顿 → 继续降级」的正反馈雪崩。这种 bug 要在浏览器里复现，得恰好在
 *   分辨率已触底时遇上一次 GC/音频/贴图尖峰，手工测试基本撞不上。
 *
 * ⚠ 本脚本镜像了 web/3d/future-home/js/core.js 里 H.govern 的决策逻辑。
 *   两边是手工同步的 —— 改了 core.js 的阈值 / 迟滞计数，必须同步改这里，
 *   否则模拟结果不再代表真实行为（那比没有模拟器更危险）。
 *
 * 用法：node tools/sim-governor.js   或   cd tools && npm run sim
 * 判读：各场景「末态」不应出现「明明不慢却降到 -4/-5」，且 D 场景要能自己爬回 -0。
 */
'use strict';

// 各级降级能省下的帧时间（ms），粗略对应 bloom / 浮尘 / 光锥 / FXAA / 灯光
var EFF = [1.2, 0.8, 2.2, 1.0, 1.5];
var VSYNC = 16.7;

function makeSim(opts) {
  opts = opts || {};
  var useMedian = opts.median !== false;
  var guardHeavy = opts.guardHeavy !== false;   // 4/5 级需要「持续极慢」
  var stallOnRecompile = opts.stall !== false;  // 重编译后的冷却

  var dynScale = 0.88, lv = 0;
  var gov = { settle: 5, acc: 0, n: 0, upWait: 0, floorHits: 0, good: 0, lock: 0, tries: {}, samples: [] };
  var log = [];
  var recompileLeft = 0;      // 重编译造成的卡顿还要持续多久（秒）

  function stall(sec) {
    gov.settle = Math.max(gov.settle, sec || 1.5);
    gov.acc = 0; gov.n = 0; gov.samples.length = 0;
    gov.floorHits = 0; gov.good = 0;
  }

  function degrade(next) {
    next = Math.min(5, Math.max(0, next));
    if (next === lv) return;
    // 跨过 4 级边界 = 改了进 shader 的开关 = 要重编译 962 个材质
    var recompile = (next >= 4) !== (lv >= 4);
    lv = next;
    if (recompile) {
      recompileLeft = 1.2;                    // 这就是雪崩的燃料：降级自己制造卡顿
      if (stallOnRecompile) stall(4);
    }
    if (stallOnRecompile) stall(1.5);
  }

  // 真实帧时间：基础成本 + 分辨率 + 未关掉的特效
  function frameMs(base) {
    if (recompileLeft > 0) return 180;          // 重编译期间的掉帧
    var c = 6 + 14 * dynScale * dynScale;
    for (var i = 0; i < 5; i++) if (lv < i + 1) c += EFF[i];
    return Math.max(VSYNC, c * base);
  }

  function govern(dtMs) {
    if (dtMs > 1500) { stall(1.5); return; }
    gov.settle -= dtMs / 1000;
    if (gov.settle > 0) { gov.acc = 0; gov.n = 0; gov.samples.length = 0; return; }

    gov.acc += dtMs; gov.n++;
    gov.samples.push(dtMs);
    if (gov.n < 45 && gov.acc < 900) return;

    var med;
    if (useMedian) {
      var sorted = gov.samples.slice().sort(function (a, b) { return a - b; });
      med = sorted[sorted.length >> 1];
    } else {
      med = gov.acc / gov.n;                     // 旧版：平均值
    }
    gov.acc = 0; gov.n = 0; gov.samples.length = 0;

    var s = dynScale;
    var SLOW = 21.5, GOOD = 17.6;

    if (med > SLOW && s > 0.6) {
      s = med > 45 ? 0.6 : Math.max(0.6, s - (med > 30 ? 0.2 : 0.1));
      gov.upWait = Math.min(20, Math.max(2, gov.upWait * 2));
      gov.good = 0;
    } else if (med > SLOW) {
      gov.good = 0;
      gov.floorHits++;
      var next = lv + 1;
      var needHits = next >= 4 ? 6 : 2;
      if (guardHeavy && next >= 4 && med < 33) needHits = Infinity;
      if (gov.floorHits >= needHits) {
        gov.floorHits = 0;
        if ((gov.tries[next] || 0) >= 2) gov.lock = next;
        degrade(next);
      }
    } else if (med < GOOD) {
      gov.good++;
      var canUp = lv > gov.lock;
      if (canUp && (lv >= 3 || s >= 1)) {
        var need = lv >= 4 ? 5 : 3;
        if (med <= 17.0) need = Math.max(2, need - 2);
        if (gov.good >= need) {
          gov.good = 0;
          gov.tries[lv] = (gov.tries[lv] || 0) + 1;
          degrade(lv - 1);
        }
      } else if (s < 1 && gov.upWait <= 0) {
        s = Math.min(1, s + 0.1);
        gov.upWait = 2;
        gov.good = 0;
      }
    } else {
      gov.good = 0;
    }
    if (med < 20) gov.floorHits = 0;
    if (gov.upWait > 0) gov.upWait--;

    s = Math.round(s * 10) / 10;
    if (s !== dynScale) {
      dynScale = s;
      gov.settle = Math.max(gov.settle, 1);
    }
  }

  return {
    // 跑 seconds 秒；spikeAt/spikeMs 用来注入一次偶发卡顿（持续 spikeLen 秒）
    run: function (seconds, base, spikeAt, spikeMs, spikeLen) {
      var t = 0, mark = 0, spikeLeft = 0;
      while (t < seconds) {
        if (spikeAt !== undefined && t < spikeAt && t + 0.02 >= spikeAt) {
          spikeLeft = spikeLen || 0.001;
          spikeAt = undefined;
        }
        var dt = spikeLeft > 0 ? spikeMs : frameMs(base);
        govern(dt);
        t += dt / 1000;
        if (spikeLeft > 0) spikeLeft -= dt / 1000;
        if (recompileLeft > 0) recompileLeft -= dt / 1000;
        if (t >= mark) { log.push(Math.round(dynScale * 100) + '%/-' + lv); mark += 1; }
      }
      return { scale: dynScale, lv: lv, log: log };
    }
  };
}

function show(label, r) {
  console.log('  ' + label.padEnd(10) + '末态 ' + Math.round(r.scale * 100) + '% / -' + r.lv);
  console.log('    ' + r.log.join(' '));
}

// 用户的实际处境：分辨率已经压到 60% 下限、稳定在 -1，然后偶发卡顿一下。
// 分辨率已触底是关键 —— 此时「慢」只能靠砍特效来应对，雪崩才有机会发生
var BASE = 1.45;

console.log('\n== 场景 A：60%/-1 稳定运行时，偶发一次 400ms 卡顿 ==');
console.log('  [旧版] 平均值判定 + 降级无冷却 + 4/5 级无门槛');
var oldA = makeSim({ median: false, guardHeavy: false, stall: false });
oldA.run(14, BASE);
show('旧版', oldA.run(26, BASE, 0.5, 400, 0.4));
console.log('  [新版] 中位数判定 + 重编译后冷却 4s + 4/5 级需持续 <30fps');
var newA = makeSim();
newA.run(14, BASE);
show('新版', newA.run(26, BASE, 0.5, 400, 0.4));

console.log('\n== 场景 B：连续三次卡顿（每次 350ms）==');
var oldB = makeSim({ median: false, guardHeavy: false, stall: false });
oldB.run(14, BASE);
oldB.run(3, BASE, 0.5, 350, 0.35);
oldB.run(3, BASE, 0.5, 350, 0.35);
show('旧版', oldB.run(20, BASE, 0.5, 350, 0.35));
var newB = makeSim();
newB.run(14, BASE);
newB.run(3, BASE, 0.5, 350, 0.35);
newB.run(3, BASE, 0.5, 350, 0.35);
show('新版', newB.run(20, BASE, 0.5, 350, 0.35));

console.log('\n== 场景 C：各档机器的最终收敛点（新版）==');
[['强机 x0.5', 0.5], ['中机 x0.72', 0.72], ['偏弱 x1.1', 1.1], ['弱机 x1.45', 1.45], ['极弱 x2.8', 2.8]]
  .forEach(function (m) {
    var r = makeSim().run(70, m[1]);
    console.log('  ' + m[0].padEnd(12) + '末态 ' + Math.round(r.scale * 100) + '% / -' + r.lv +
      '   轨迹 ' + r.log.filter(function (v, i) { return i % 6 === 0; }).join(' '));
  });

console.log('\n== 场景 D：真的很卡 → 降到底 → 机器空闲后能否自己爬回来（新版）==');
var d = makeSim();
var low = d.run(30, 2.8);
console.log('  先持续极慢，降到 -' + low.lv + ' / ' + Math.round(low.scale * 100) + '%');
show('再恢复', d.run(70, 0.55));
console.log('');
