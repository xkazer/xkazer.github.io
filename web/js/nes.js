(function () {
  'use strict';

  // EmulatorJS 4.2.3 本地资源目录（前端、fceumm 内核、压缩库、中文语言包），不依赖外部 CDN
  var EJS_DATA_PATH = 'emulatorjs/';

  function $(id) { return document.getElementById(id); }

  var toastTimer = 0;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function setStatus(msg, type) {
    var el = $('nesStatus');
    el.textContent = msg || '';
    el.className = 'status' + (type ? ' ' + type : '');
  }

  var started = false;

  // 校验 iNES 文件头："NES" + 0x1A
  function checkHeader(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        var b = new Uint8Array(reader.result);
        resolve(b.length >= 16 && b[0] === 0x4E && b[1] === 0x45 && b[2] === 0x53 && b[3] === 0x1A);
      };
      reader.onerror = function () { resolve(false); };
      reader.readAsArrayBuffer(file.slice(0, 16));
    });
  }

  function startEmulator(file) {
    var baseName = file.name.replace(/\.[^.]+$/, '');

    window.EJS_player = '#game';
    window.EJS_core = 'nes';
    window.EJS_gameName = baseName;
    window.EJS_gameUrl = URL.createObjectURL(file);
    window.EJS_pathtodata = EJS_DATA_PATH;
    window.EJS_color = '#1457d9';
    window.EJS_language = 'zh-CN';
    window.EJS_startOnLoaded = true;
    window.EJS_threads = false;
    // 默认键位：WASD 方向，J = B，K = A，L = Start，Enter = Select
    // 索引含义：0 = B，2 = Select，3 = Start，4~7 = 上/下/左/右，8 = A
    // 注意：压缩版 EmulatorJS 对该配置是整体替换而非合并，必须提供 4 个玩家的完整结构
    window.EJS_defaultControls = {
      0: {
        0: { value: 'j', value2: 'BUTTON_2' },
        1: { value: '', value2: 'BUTTON_4' },
        2: { value: 'enter', value2: 'SELECT' },
        3: { value: 'l', value2: 'START' },
        4: { value: 'w', value2: 'DPAD_UP' },
        5: { value: 's', value2: 'DPAD_DOWN' },
        6: { value: 'a', value2: 'DPAD_LEFT' },
        7: { value: 'd', value2: 'DPAD_RIGHT' },
        8: { value: 'k', value2: 'BUTTON_1' },
        9: { value: '', value2: 'BUTTON_3' }
      },
      1: {},
      2: {},
      3: {}
    };

    $('nesName').textContent = file.name;
    $('nesPick').hidden = true;
    $('nesPlay').hidden = false;

    var script = document.createElement('script');
    script.src = EJS_DATA_PATH + 'loader.js';
    script.onerror = function () {
      toast('模拟器资源加载失败');
      $('nesPlay').hidden = true;
      $('nesPick').hidden = false;
      setStatus('模拟器资源加载失败，请确认 web/emulatorjs 目录完整', 'err');
      started = false;
    };
    document.body.appendChild(script);
  }

  function handleFile(file) {
    if (started || !file) return;
    if (!/\.nes$/i.test(file.name)) {
      setStatus('请选择 .nes 格式的文件', 'err');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setStatus('文件过大，不像是有效的红白机 ROM', 'err');
      return;
    }
    checkHeader(file).then(function (ok) {
      if (started) return;
      if (!ok) {
        setStatus('文件头不是有效的 iNES 格式，无法运行', 'err');
        return;
      }
      started = true;
      setStatus('');
      startEmulator(file);
    });
  }

  function init() {
    var drop = $('nesDrop');
    var input = $('nesFile');

    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener('change', function () {
      handleFile(input.files[0]);
      input.value = '';
    });

    ['dragenter', 'dragover'].forEach(function (name) {
      drop.addEventListener(name, function (e) {
        e.preventDefault();
        drop.classList.add('over');
      });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      drop.addEventListener(name, function (e) {
        e.preventDefault();
        drop.classList.remove('over');
      });
    });
    drop.addEventListener('drop', function (e) {
      handleFile(e.dataTransfer && e.dataTransfer.files[0]);
    });

    // 模拟器无法干净销毁，更换游戏时直接刷新页面
    $('nesReload').addEventListener('click', function () { location.reload(); });
  }

  init();
})();
