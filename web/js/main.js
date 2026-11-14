(function () {
  'use strict';

  // ===== 配置 =====
  // href 为空表示页面尚未实现，点击时给出提示
  var TOOLS = [
    { name: '时间戳转换', href: 'tool.html#timestamp' },
    { name: 'Base64编解码', href: 'tool.html#base64' },
    { name: 'UTF8转换', href: 'tool.html#utf8' },
    { name: 'URL编解码', href: 'tool.html#url' },
    { name: 'Unicode转换', href: 'tool.html#unicode' },
    { name: 'JSON格式化', href: 'tool.html#json' },
    { name: 'MD5加密', href: 'tool.html#md5' },
    { name: '进制串字符串反转', href: 'tool.html#radix' },
    { name: '二维码生成', href: 'tool.html#qrcode' },
    { name: '十六进制编辑器', href: 'hex.html' },
    { name: 'PE文件分析', href: 'pe.html' },
    { name: '文件对比', href: 'diff.html' }
  ];
  var FUN = [
    { name: '红白机ROM加载', href: 'nes.html' }
  ];
  var ENGINES = {
    baidu: 'https://www.baidu.com/s?wd=',
    bing: 'https://www.bing.com/search?q=',
    google: 'https://www.google.com/search?q='
  };
  var TABS = ['tools', 'fun', 'maxim'];
  var MAXIM_URL = 'maxim/maxim.json';

  function $(id) { return document.getElementById(id); }

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* 隐私模式忽略 */ }
  }

  // ===== 提示 =====
  var toastTimer = 0;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  // ===== 搜索 =====
  var engine = 'baidu';

  function setEngine(name) {
    if (!ENGINES[name]) name = 'baidu';
    engine = name;
    storageSet('engine', name);
    var buttons = document.querySelectorAll('.engine');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', buttons[i].getAttribute('data-engine') === name);
    }
  }

  function initSearch() {
    setEngine(storageGet('engine'));
    $('engines').addEventListener('click', function (e) {
      var btn = e.target.closest('.engine');
      if (!btn) return;
      setEngine(btn.getAttribute('data-engine'));
      $('searchInput').focus();
    });
    $('searchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('searchInput');
      var keyword = input.value.trim();
      if (!keyword) { input.focus(); return; }
      window.open(ENGINES[engine] + encodeURIComponent(keyword), '_blank', 'noopener');
    });
  }

  // ===== 卡片 =====
  function renderCards(container, items) {
    var frag = document.createDocumentFragment();
    items.forEach(function (item) {
      var a = document.createElement('a');
      a.className = 'card';
      a.textContent = item.name;
      if (item.href) {
        a.href = item.href;
      } else {
        a.href = '#';
        a.addEventListener('click', function (e) {
          e.preventDefault();
          toast(item.name + '：敬请期待');
        });
      }
      frag.appendChild(a);
    });
    container.appendChild(frag);
  }

  // ===== 标签 =====
  var maximLoaded = false;

  function showTab(name) {
    if (TABS.indexOf(name) === -1) name = 'tools';
    TABS.forEach(function (t) {
      $('pane-' + t).hidden = (t !== name);
    });
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      var active = tabs[i].getAttribute('data-tab') === name;
      tabs[i].classList.toggle('active', active);
      tabs[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }
    if (name === 'maxim' && !maximLoaded) loadMaxim();
  }

  function initTabs() {
    $('tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.tab');
      if (!btn) return;
      var name = btn.getAttribute('data-tab');
      if (location.hash !== '#' + name) {
        history.replaceState(null, '', '#' + name);
      }
      showTab(name);
    });
    window.addEventListener('hashchange', function () {
      showTab(location.hash.slice(1));
    });
    showTab(location.hash.slice(1));
  }

  // ===== 格言 =====
  var maximAll = []; // [{category, text, source}]
  var maximCurrent = null;

  function showMaxim(item) {
    maximCurrent = item;
    $('maximText').textContent = item ? item.text : '暂无格言';
    $('maximSource').textContent = item && item.source ? '—— ' + item.source : '';
  }

  // 按日期固定选取"今日格言"
  function pickToday() {
    var d = new Date();
    var seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return maximAll[seed % maximAll.length];
  }

  function pickRandom() {
    if (maximAll.length < 2) return maximAll[0];
    var item;
    do {
      item = maximAll[Math.floor(Math.random() * maximAll.length)];
    } while (item === maximCurrent);
    return item;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
      ok ? resolve() : reject();
    });
  }

  function formatMaxim(item) {
    return item.source ? item.text + ' —— ' + item.source : item.text;
  }

  function copyMaxim(item) {
    if (!item) return;
    copyText(formatMaxim(item)).then(
      function () { toast('已复制'); },
      function () { toast('复制失败'); }
    );
  }

  function renderMaximList(data) {
    var list = $('maximList');
    list.textContent = '';
    Object.keys(data).forEach(function (category) {
      var items = data[category];
      if (!Array.isArray(items) || !items.length) return;

      var group = document.createElement('div');
      group.className = 'maxim-group';
      var title = document.createElement('h3');
      title.textContent = category;
      group.appendChild(title);

      items.forEach(function (it) {
        if (!it || !it.text) return;
        var item = { category: category, text: it.text, source: it.source || '' };
        maximAll.push(item);

        var row = document.createElement('div');
        row.className = 'maxim-item';
        row.title = '点击复制';
        var text = document.createElement('span');
        text.textContent = item.text;
        row.appendChild(text);
        if (item.source) {
          var src = document.createElement('span');
          src.className = 'src';
          src.textContent = item.source;
          row.appendChild(src);
        }
        row.addEventListener('click', function () { copyMaxim(item); });
        group.appendChild(row);
      });
      list.appendChild(group);
    });
  }

  function loadMaxim() {
    maximLoaded = true;
    fetch(MAXIM_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        maximAll = [];
        renderMaximList(data);
        if (!maximAll.length) throw new Error('empty');
        showMaxim(pickToday());
      })
      .catch(function () {
        maximLoaded = false;
        showMaxim(null);
        $('maximList').innerHTML = '<div class="empty">暂无格言，请先在 md/maxim 添加格言并生成</div>';
      });
  }

  function initMaxim() {
    $('maximRandom').addEventListener('click', function () {
      if (!maximAll.length) { loadMaxim(); return; }
      showMaxim(pickRandom());
    });
    $('maximCopy').addEventListener('click', function () { copyMaxim(maximCurrent); });
  }

  // ===== 启动 =====
  renderCards($('toolsGrid'), TOOLS);
  renderCards($('funGrid'), FUN);
  initSearch();
  initMaxim();
  initTabs();
})();
