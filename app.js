const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 启动服务器（可用环境变量覆盖：PORT / HTTPS_PORT）
const HTTP_PORT = Number(process.env.PORT) || 80;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 443;

// ===== 目录常量 =====
const WEB_DIR = path.join(__dirname, 'web');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const UPLOAD_TMP_DIR = path.join(UPLOAD_DIR, '.tmp');
const DATA_DIR = path.join(__dirname, 'data');
const VISIT_DB_FILE = path.join(DATA_DIR, 'visits.db');

// ===== 访问计数配置 =====
const VISIT_RETENTION_DAYS = 400;   // 明细保留天数，超期在写库时顺手清理
const VISIT_BOT_RE = /bot|spider|crawl|headless|curl|wget|python-requests|go-http|scrapy/i;

// ===== 文件中转配置 =====
const MAX_FILE_SIZE = 80 * 1024 * 1024; // 80MB
const MAX_HEADERS_SIZE = 16 * 1024;     // multipart 分段头部上限
const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN || '';
// 允许上传的扩展名白名单（可执行文件类型不在其中）
const ALLOWED_EXT = new Set([
  'txt', 'pdf', 'zip', 'tar', 'gz', 'bz2', '7z', 'rar',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico',
  'mp4', 'mp3', 'wav', 'flac', 'ogg', 'webm',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'md', 'csv', 'json', 'xml', 'apk', 'ipa', 'br',
]);

// 确保上传目录存在
for (const dir of [UPLOAD_DIR, UPLOAD_TMP_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('已创建上传目录: ' + dir);
  }
}

// 确保访问计数目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('已创建数据目录: ' + DATA_DIR);
}

// 解析为真实路径，避免符号链接绕过目录校验（macOS 上 /var、/tmp 本身是软链）
const WEB_DIR_REAL = fs.realpathSync(WEB_DIR);
const UPLOAD_DIR_REAL = fs.realpathSync(UPLOAD_DIR);

// MIME类型
const MIME_TYPES = {
  // 文本
  'txt': 'text/plain; charset=utf-8',
  'html': 'text/html; charset=utf-8',
  'htm': 'text/html; charset=utf-8',
  'css': 'text/css; charset=utf-8',
  'js': 'application/javascript; charset=utf-8',
  'mjs': 'application/javascript; charset=utf-8',
  'json': 'application/json; charset=utf-8',
  'map': 'application/json; charset=utf-8',
  'xml': 'application/xml; charset=utf-8',
  'md': 'text/markdown; charset=utf-8',
  'csv': 'text/csv; charset=utf-8',
  // 图片
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
  // 字体
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  'ttf': 'font/ttf',
  'otf': 'font/otf',
  'eot': 'application/vnd.ms-fontobject',
  // 音视频
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'flac': 'audio/flac',
  'ogg': 'audio/ogg',
  // 压缩包与其他
  'pdf': 'application/pdf',
  'zip': 'application/zip',
  'tar': 'application/x-tar',
  'gz': 'application/gzip',
  'bz2': 'application/x-bzip2',
  '7z': 'application/x-7z-compressed',
  'rar': 'application/vnd.rar',
  'br': 'application/x-brotli',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'apk': 'application/vnd.android.package-archive',
  'ipa': 'application/octet-stream',
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase().substring(1);
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// 页面/脚本类每次协商（改完刷新即生效），媒体类走长缓存
const REVALIDATE_EXT = new Set(['html', 'htm', 'js', 'mjs', 'css', 'json', 'map', 'xml', 'txt', 'md', 'csv']);

function getCacheControl(filePath) {
  const ext = path.extname(filePath).toLowerCase().substring(1);
  return REVALIDATE_EXT.has(ext) ? 'no-cache' : 'public, max-age=86400';
}

/**
 * 判断 targetPath 是否位于 parentDir 之内（两者都应为绝对路径）
 */
function isInside(parentDir, targetPath) {
  return targetPath === parentDir || targetPath.startsWith(parentDir + path.sep);
}

// ===== 访问计数 =====
function todayKey(d) {
  const t = d || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

// 路径归一化：去 query/hash、去末尾 /index.html、合并重复斜杠，
// 非站内路径或超长路径统一落到 '/'，避免同一页面被拆成多条记录
function normalizePage(raw) {
  let p = String(raw || '').split('#')[0].split('?')[0].trim();
  if (!p.startsWith('/') || p.length > 200) return '/';
  try { p = decodeURIComponent(p); } catch (e) { /* 解码失败就用原样 */ }
  p = p.replace(/\/{2,}/g, '/').replace(/\/index\.html?$/i, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '') || '/';
  // 只放行常规路径字符：这些 key 会被渲染到统计页，不能让 <>"' 之类的字符进来
  if (/[<>"'`\\\u0000-\u001f\u007f]/.test(p)) return '/';
  return p;
}

/* ---- 访问明细存储：node:sqlite（Node ≥ 22.5 内置）----
 * 老版本 Node 没有这个模块，启动时打一条警告并关闭计数功能，
 * 不做降级存储：两套后端数据互不相通，切版本会让统计数字忽大忽小。
 */
let visitStore = null;

function createSqliteStore(file) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file);
  // WAL：写入不阻塞读，进程被 kill 也不易损坏
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS hits (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      ts      INTEGER NOT NULL,
      day     TEXT    NOT NULL,
      page    TEXT    NOT NULL,
      visitor TEXT,
      bot     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_hits_day ON hits(day);
    CREATE INDEX IF NOT EXISTS idx_hits_page ON hits(page);
  `);
  const insertStmt = db.prepare('INSERT INTO hits (ts, day, page, visitor, bot) VALUES (?, ?, ?, ?, ?)');
  const pruneStmt = db.prepare('DELETE FROM hits WHERE ts < ?');
  const totalStmt = db.prepare(
    'SELECT COUNT(*) AS pv, COUNT(DISTINCT visitor) AS uv FROM hits WHERE bot = 0'
  );
  const todayStmt = db.prepare(
    'SELECT COUNT(*) AS pv, COUNT(DISTINCT visitor) AS uv FROM hits WHERE bot = 0 AND day = ?'
  );
  const pagesStmt = db.prepare(`
    SELECT page,
           COUNT(*) AS pv,
           SUM(CASE WHEN day = ? THEN 1 ELSE 0 END) AS today,
           MAX(day) AS last
      FROM hits
     WHERE bot = 0
  GROUP BY page
  ORDER BY pv DESC
     LIMIT 100
  `);
  const daysStmt = db.prepare(`
    SELECT day, COUNT(*) AS pv, COUNT(DISTINCT visitor) AS uv
      FROM hits
     WHERE bot = 0
  GROUP BY day
  ORDER BY day DESC
     LIMIT 14
  `);

  return {
    add(row) { insertStmt.run(row.ts, row.day, row.page, row.visitor, row.bot); },
    prune(cutoff) { pruneStmt.run(cutoff); },
    stats(day) {
      const empty = { pv: 0, uv: 0 };
      return {
        total: totalStmt.get() || empty,
        today: todayStmt.get(day) || empty,
        pages: pagesStmt.all(day),
        days: daysStmt.all(),
      };
    },
    close() { db.close(); },
  };
}

try {
  visitStore = createSqliteStore(VISIT_DB_FILE);
  console.log('访问计数库已就绪: ' + VISIT_DB_FILE);
} catch (err) {
  console.warn(`[visit] 警告：当前 Node ${process.version} 无法使用 node:sqlite（需要 Node ≥ 22.5），访问计数已关闭，页面访问不会被统计`);
  console.warn('[visit] 原因: ' + err.message);
}

// Ctrl+C / kill 时先干净关库（让 WAL 落盘），再退出
// 注意：SIGINT/SIGTERM 不会触发 'exit' 钩子，必须单独监听
function shutdown(signal) {
  return () => {
    if (visitStore) {
      try { visitStore.close(); } catch (e) { /* 关库失败不影响退出 */ }
      visitStore = null;
    }
    console.log(`\n收到 ${signal}，服务已停止`);
    process.exit(0);
  };
}

process.on('SIGINT', shutdown('SIGINT'));
process.on('SIGTERM', shutdown('SIGTERM'));

let lastPrune = 0;

// 清理超期明细，每次启动 + 每天最多跑一次
function pruneHits() {
  if (!visitStore) return;
  const now = Date.now();
  if (now - lastPrune < 24 * 3600 * 1000) return;
  lastPrune = now;
  try {
    visitStore.prune(now - VISIT_RETENTION_DAYS * 86400000);
  } catch (err) {
    console.warn('[visit] 清理历史数据失败: ' + err.message);
  }
}

/**
 * 记一次页面访问，只在 HTML 页面的 GET 请求里调用。
 * 不做频率限制（打开就计一次）；UV 用「IP + UA」指纹去重，
 * 不依赖 cookie —— 否则无 cookie 的探活/预取请求每次都会算成新访客。
 */
function recordHit(req, page) {
  if (!visitStore) return;
  pruneHits();

  const ua = String(req.headers['user-agent'] || '');
  const visitor = crypto.createHash('sha1')
    .update(clientIp(req) + '|' + ua)
    .digest('hex')
    .slice(0, 16);
  const bot = VISIT_BOT_RE.test(ua) ? 1 : 0;

  try {
    visitStore.add({ ts: Date.now(), day: todayKey(), page, visitor, bot });
  } catch (err) {
    console.warn('[visit] 写入失败: ' + err.message);
  }
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || '';
}

// 一个查询里 NULL 不会来自 COUNT(*)，这里只做类型兜底
function num(v) {
  return typeof v === 'number' ? v : Number(v) || 0;
}

/**
 * GET /api/visit/stats
 * 从库里聚合：全站今日/累计、最近 14 天、页面排行。
 * 只读，不计数，也不做跨域（只给同源的 stats.html 用）。
 */
function handleVisitStats(req, res) {
  const extra = { 'Cache-Control': 'no-store' };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    replyJson(res, 405, { error: 'Method Not Allowed' }, null, extra);
    return;
  }
  if (!visitStore) {
    replyJson(res, 200, { today: { pv: 0, uv: 0 }, total: { pv: 0, uv: 0 }, days: [], pages: [], disabled: true }, null, extra);
    return;
  }

  const day = todayKey();
  const empty = { pv: 0, uv: 0 };
  let s = { total: empty, today: empty, pages: [], days: [] };

  try {
    s = visitStore.stats(day);
  } catch (err) {
    console.warn('[visit] 查询统计失败: ' + err.message);
  }

  replyJson(res, 200, {
    today: { pv: num(s.today.pv), uv: num(s.today.uv) },
    total: { pv: num(s.total.pv), uv: num(s.total.uv) },
    days: s.days.slice().reverse().map((d) => ({ day: d.day, pv: num(d.pv), uv: num(d.uv) })),
    pages: s.pages.map((p) => ({ page: p.page, pv: num(p.pv), today: num(p.today), last: p.last || '' })),
  }, null, extra);
}

// ===== 请求处理器 =====
function handleRequest(req, res) {
  console.log(`${new Date().toLocaleString()} [${req.socket.encrypted ? 'HTTPS' : 'HTTP'}] ${req.socket.remoteAddress} ${req.method} ${req.url}`);

  const urlPath = req.url.split('?')[0];

  // ===== OPTIONS 预检 =====
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Allow': 'GET, HEAD, POST, OPTIONS', 'Content-Length': 0 });
    res.end();
    return;
  }

  // ===== GET /api/visit/stats 计数汇总（只读）=====
  if (urlPath === '/api/visit/stats') {
    handleVisitStats(req, res);
    return;
  }

  // ===== POST /upload 上传接口 =====
  if (req.method === 'POST' && urlPath === '/upload') {
    handleUpload(req, res);
    return;
  }

  // ===== GET/HEAD /files/:filename 文件下载 =====
  if ((req.method === 'GET' || req.method === 'HEAD') && urlPath.startsWith('/files/')) {
    handleFileDownload(req, res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'GET, HEAD, POST, OPTIONS' });
    res.end('Method Not Allowed');
    return;
  }

  // 解析URL路径
  let relativePath;
  try {
    relativePath = decodeURIComponent(urlPath);
  } catch (err) {
    console.log(`URL decode error: ${err.message}`);
    relativePath = '/index.html';
  }

  if (relativePath === '/' || relativePath === '') {
    relativePath = '/index.html';
  }

  // 防止路径穿越：确保最终路径仍在 web/ 目录内
  const realPath = path.join(WEB_DIR, relativePath);
  if (!isInside(WEB_DIR, realPath)) {
    page_404(req, res, urlPath);
    return;
  }

  // 解析软链后再校验一次，并确认是普通文件（目录请求必须走 404，否则读目录会抛 EISDIR 崩进程）
  fs.realpath(realPath, (err, resolvedPath) => {
    if (err || !isInside(WEB_DIR_REAL, resolvedPath)) {
      page_404(req, res, urlPath);
      return;
    }
    // 页面访问计数：只统计 HTML 页面的 GET，打开即计一次（不做频率限制）
    if (req.method === 'GET' && /\.html?$/i.test(resolvedPath) && shouldCountPage(resolvedPath)) {
      recordHit(req, normalizePage(req.url));
    }
    sendFile(req, res, resolvedPath, {
      contentType: getContentType(resolvedPath),
      cacheControl: getCacheControl(resolvedPath),
    });
  });
}

/**
 * 哪些页面参与计数：统计页自己、以下划线开头的调试页不计数
 */
function shouldCountPage(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (base === 'stats.html') return false;
  if (base.charAt(0) === '_') return false;
  return true;
}

/**
 * 发送文件，支持 HEAD / Range / 条件缓存头
 */
function sendFile(req, res, filePath, options = {}) {
  const {
    contentType = 'application/octet-stream',
    cacheControl = 'public, max-age=3600',
    downloadName = '',
  } = options;

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      page_404(req, res, req.url);
      return;
    }

    const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'Accept-Ranges': 'bytes',
      'ETag': etag,
      'Last-Modified': stat.mtime.toUTCString(),
    };
    // 协商缓存：内容没变就回 304，避免反复传输
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { 'ETag': etag, 'Cache-Control': cacheControl });
      res.end();
      return;
    }

    // 下载场景：ASCII 兜底 + RFC 5987 的 UTF-8 文件名
    if (downloadName) {
      const asciiName = downloadName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
      headers['Content-Disposition'] = `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
    }

    const range = parseRange(req.headers.range, stat.size);
    if (range && range.unsatisfiable) {
      res.writeHead(416, {
        'Content-Range': `bytes */${stat.size}`,
        'Content-Type': 'text/plain; charset=utf-8',
      });
      res.end('Range Not Satisfiable');
      return;
    }

    let start = 0;
    let end = stat.size - 1;
    if (range) {
      start = range.start;
      end = range.end;
      res.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': end - start + 1,
      });
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    }

    if (req.method === 'HEAD' || stat.size === 0) {
      res.end();
      return;
    }

    const fileStream = fs.createReadStream(filePath, { start, end });

    fileStream.on('error', (streamErr) => {
      console.error('File read error:', streamErr);
      page_500(req, res, streamErr);
    });

    fileStream.pipe(res);
  });
}

/**
 * 解析 Range 请求头（仅支持单区间，多区间回退为全量响应）
 * @return {null|{start:number,end:number}|{unsatisfiable:true}}
 */
function parseRange(rangeHeader, size) {
  if (!rangeHeader || size === 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
  if (!match) return null;

  const rawStart = match[1];
  const rawEnd = match[2];
  if (rawStart === '' && rawEnd === '') return null;

  let start;
  let end;
  if (rawStart === '') {
    // bytes=-N：最后 N 字节
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return { unsatisfiable: true };
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (start >= size || start > end) return { unsatisfiable: true };
  }

  return { start, end };
}

// ===== 上传处理（边收边落盘，不把整个文件读进内存）=====
function handleUpload(req, res) {
  const remote = req.socket.remoteAddress;

  // Token 鉴权（失败原因只记日志，不返回给客户端）
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!UPLOAD_TOKEN) {
    console.warn(`[upload] 鉴权失败：服务未配置 UPLOAD_TOKEN，来自 ${remote}`);
    replyJson(res, 401, { error: 'Unauthorized' });
    return;
  }
  if (!token || token !== UPLOAD_TOKEN) {
    console.warn(`[upload] 鉴权失败：Token 不匹配，来自 ${remote}`);
    replyJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = /boundary=(?:")?([^";]+)/.exec(contentType);
  if (!contentType.includes('multipart/form-data') || !boundaryMatch) {
    console.warn(`[upload] 请求格式错误：非 multipart/form-data，来自 ${remote}`);
    replyJson(res, 400, { error: 'Bad Request' });
    return;
  }
  const boundary = boundaryMatch[1].trim();
  // 请求流结束后 req.socket 会被置空，协议需提前取
  const protocol = req.socket.encrypted ? 'https' : 'http';

  doStreamUpload(req, res, boundary, remote, protocol).catch((err) => {
    console.error('[upload] 未预期的错误:', err);
    page_500(req, res, err);
  });
}

/**
 * 流式解析 multipart/form-data，提取第一个文件字段直接写临时文件
 */
async function doStreamUpload(req, res, boundary, remote, protocol) {
  const openDelim = Buffer.from('--' + boundary);
  const partDelim = Buffer.from('\r\n--' + boundary);
  const CRLFCRLF = Buffer.from('\r\n\r\n');

  let buf = Buffer.alloc(0);
  let phase = 'preamble';       // preamble → boundary → headers → body/skip → boundary → done
  let filename = null;
  let tmpPath = '';
  let out = null;
  let received = 0;
  let partBytes = 0;
  let tooLarge = false;

  const cleanupTmp = () => {
    if (out) {
      out.destroy();
      out = null;
    }
    if (tmpPath) {
      const target = tmpPath;
      tmpPath = '';
      fs.promises.unlink(target).catch(() => {});
    }
  };

  try {
    for await (const chunk of req) {
      received += chunk.length;
      if (received > MAX_FILE_SIZE + 64 * 1024) {
        tooLarge = true;
        break;
      }
      buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;

      while (phase !== 'done') {
        if (phase === 'preamble') {
          const idx = buf.indexOf(openDelim);
          if (idx === -1) {
            // 只保留可能是分隔符开头的尾部字节
            buf = buf.subarray(Math.max(0, buf.length - openDelim.length));
            break;
          }
          buf = buf.subarray(idx + openDelim.length);
          phase = 'boundary';
        } else if (phase === 'boundary') {
          if (buf.length < 2) break;
          if (buf[0] === 0x2d && buf[1] === 0x2d) {   // '--' 表示整体结束
            phase = 'done';
            break;
          }
          buf = buf.subarray(2);                      // 跳过 CRLF
          phase = 'headers';
        } else if (phase === 'headers') {
          const idx = buf.indexOf(CRLFCRLF);
          if (idx === -1) {
            if (buf.length > MAX_HEADERS_SIZE) throw new UploadError('分段头部过长');
            break;
          }
          const partHeaders = buf.subarray(0, idx).toString('utf8');
          buf = buf.subarray(idx + CRLFCRLF.length);

          const name = extractFilename(partHeaders);
          if (!name) {
            phase = 'skip';                           // 非文件字段，跳过其内容
          } else {
            filename = name;
            const ext = path.extname(filename).toLowerCase().substring(1);
            if (!ALLOWED_EXT.has(ext)) throw new UploadError(`不允许的文件类型 .${ext}`);
            tmpPath = path.join(UPLOAD_TMP_DIR, `${Date.now()}_${process.pid}_${Math.random().toString(16).slice(2)}.part`);
            out = fs.createWriteStream(tmpPath);
            phase = 'body';
          }
        } else if (phase === 'body' || phase === 'skip') {
          const idx = buf.indexOf(partDelim);
          if (idx === -1) {
            // 分隔符可能跨 chunk，尾部留够 partDelim.length - 1 字节
            const flushLen = buf.length - (partDelim.length - 1);
            if (flushLen > 0) {
              if (phase === 'body') {
                await writeToStream(out, buf.subarray(0, flushLen));
                partBytes += flushLen;
              }
              buf = buf.subarray(flushLen);
            }
            break;
          }
          if (phase === 'body') {
            await writeToStream(out, buf.subarray(0, idx));
            partBytes += idx;
          }
          buf = buf.subarray(idx + partDelim.length);
          phase = 'boundary';
        } else {
          break;
        }
      }

      if (phase === 'done') break;
    }

    if (tooLarge) {
      cleanupTmp();
      console.warn(`[upload] 文件超过大小限制 ${MAX_FILE_SIZE / 1024 / 1024}MB，来自 ${remote}`);
      replyJson(res, 400, { error: 'Bad Request' }, () => req.destroy());
      return;
    }

    if (!filename) {
      cleanupTmp();
      console.warn(`[upload] multipart 解析失败：未找到文件字段，来自 ${remote}`);
      replyJson(res, 400, { error: 'Bad Request' });
      return;
    }

    if (out) {
      await closeStream(out);
      out = null;
    }

    // 临时文件改名为最终文件（同盘 rename，同名直接覆盖）
    const savePath = path.join(UPLOAD_DIR, filename);
    await fs.promises.rename(tmpPath, savePath);
    tmpPath = '';

    const host = req.headers['host'] || 'localhost';
    console.log(`文件上传成功: ${filename} (${partBytes} bytes)`);
    replyJson(res, 200, {
      ok: true,
      filename: filename,
      size: partBytes,
      url: `${protocol}://${host}/files/${encodeURIComponent(filename)}`,
    });
  } catch (err) {
    cleanupTmp();
    if (res.writableEnded) return;

    if (err instanceof UploadError) {
      console.warn(`[upload] ${err.message}，来自 ${remote}`);
      replyJson(res, 400, { error: 'Bad Request' });
      return;
    }

    console.error('[upload] 上传请求错误:', err);
    replyJson(res, 500, { error: 'Internal Server Error' });
  }
}

class UploadError extends Error {}

/**
 * 从分段头部提取文件名，非法编码或无文件名时兜底
 */
function extractFilename(partHeaders) {
  const filenameMatch = partHeaders.match(/filename\*?=(?:UTF-8'')?["']?([^"'\r\n;]+)["']?/i);
  if (!filenameMatch) return null;

  const rawName = filenameMatch[1].trim();
  let filename;
  try {
    filename = decodeURIComponent(rawName);
  } catch (err) {
    // 非法 %XX 编码时退回原始字符串，避免 URIError 打挂进程
    console.warn(`[upload] 文件名解码失败，使用原始值: ${rawName}`);
    filename = rawName;
  }

  // 只保留文件名，去掉路径与控制字符
  filename = path.basename(filename).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!filename || filename === '.' || filename === '..') return null;
  return filename;
}

/**
 * 写入流并处理背压
 */
function writeToStream(stream, chunk) {
  if (!chunk.length) return Promise.resolve();
  if (stream.write(chunk)) return Promise.resolve();
  return new Promise((resolve) => stream.once('drain', resolve));
}

/**
 * 结束可写流并等待落盘
 */
function closeStream(stream) {
  return new Promise((resolve, reject) => {
    stream.end((err) => (err ? reject(err) : resolve()));
  });
}

function replyJson(res, statusCode, payload, onFlushed, extraHeaders) {
  if (res.headersSent) {
    res.end();
    return;
  }
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  }, extraHeaders || {}));
  res.end(body, onFlushed);
}

// ===== 文件下载处理 =====
function handleFileDownload(req, res) {
  const urlPath = req.url.split('?')[0];
  let filename;
  try {
    filename = path.basename(decodeURIComponent(urlPath.slice('/files/'.length)));
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  // 安全校验：拒绝路径分隔符/控制字符/隐藏文件，且扩展名在白名单内
  // （中文等 Unicode 文件名需放行，否则上传成功后反而无法下载）
  const ext = path.extname(filename).toLowerCase().substring(1);
  if (/[\\/\u0000-\u001f\u007f]/.test(filename) || filename.startsWith('.') || !ALLOWED_EXT.has(ext)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  // 防止路径穿越（双重保险）
  if (!isInside(UPLOAD_DIR, filePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.realpath(filePath, (err, resolvedPath) => {
    if (err || !isInside(UPLOAD_DIR_REAL, resolvedPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    sendFile(req, res, resolvedPath, {
      contentType: getContentType(resolvedPath),
      cacheControl: 'public, max-age=86400',
      downloadName: filename,
    });
  });
}

// 转义 HTML，避免将请求路径原样回显造成反射型 XSS
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 404页面
function page_404(req, res, pathname) {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.write('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1><p>The requested URL ' + escapeHtml(pathname) + ' was not found.</p></body></html>');
  res.end();
}

// 500页面
function page_500(req, res, error) {
  console.error('500 Error:', error);
  // 响应头已发出时不能再写头，否则抛 ERR_HTTP_HEADERS_SENT 会打挂进程
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
  res.write('<!DOCTYPE html><html><head><title>500 Error</title></head><body><h1>500 Internal Server Error</h1></body></html>');
  res.end();
}

// 检查SSL证书（基于 __dirname，避免启动目录不同导致证书静默不生效）
const sslKeyPath = path.join(__dirname, 'ssl', 'key.pem');
const sslCertPath = path.join(__dirname, 'ssl', 'cert.pem');

// 创建HTTP服务器
const httpServer = http.createServer(handleRequest);

// 创建HTTPS服务器
let httpsServer = null;
try {
  if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    const httpsOptions = {
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath)
    };

    httpsServer = https.createServer(httpsOptions, handleRequest);
  }
} catch (err) {
  console.warn('HTTPS不可用:', err.message);
  console.log('将以纯HTTP模式运行');
}

// 监听错误处理：端口无权限/被占用时给出明确提示，而不是直接抛栈崩溃
function onListenError(label, port) {
  return (err) => {
    if (err.code === 'EACCES') {
      console.error(`${label} 端口 ${port} 无监听权限：请用 sudo 启动，或通过环境变量指定 1024 以上的端口（如 PORT=8080）`);
    } else if (err.code === 'EADDRINUSE') {
      console.error(`${label} 端口 ${port} 已被占用`);
    } else {
      console.error(`${label} 启动失败:`, err.message);
    }
    process.exitCode = 1;
  };
}

// 启动HTTP服务器
httpServer.on('error', onListenError('HTTP', HTTP_PORT));
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`HTTP Server running at http://localhost:${HTTP_PORT}/`);
});

// 启动HTTPS服务器（如果证书存在）
if (httpsServer) {
  httpsServer.on('error', onListenError('HTTPS', HTTPS_PORT));
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`HTTPS Server running at https://localhost:${HTTPS_PORT}/`);
  });
} else {
  console.log('HTTPS Server未启动（未找到SSL证书）');
}

console.log('静态文件服务器已启动');
console.log('web目录: ' + WEB_DIR);
console.log('上传目录: ' + UPLOAD_DIR);
console.log('上传功能: ' + (UPLOAD_TOKEN ? '已启用' : '未启用（请设置 UPLOAD_TOKEN 环境变量）'));
