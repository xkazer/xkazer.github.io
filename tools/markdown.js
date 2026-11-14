const fs = require('fs');
const path = require('path');

/** 全局配置（相对路径均以本文件所在目录为基准） */
const g_config = require('./markdown.json');
const resolve = (p) => path.resolve(__dirname, p);

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 解析单个格言 Markdown 文件
 * 每条格言一个无序列表项，可选用分隔符分出出处：`- 内容 —— 出处`
 * @param {string} file 文件路径
 * @return {{text: string, source: string}[]}
 */
function parseMaximFile(file) {
  const items = [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const match = /^[-*+]\s+(.+)$/.exec(line);
    if (!match) {
      console.warn(`警告：${path.basename(file)} 第 ${index + 1} 行不是列表项，已跳过：${line}`);
      return;
    }
    const content = match[1].trim();
    const pos = content.lastIndexOf(g_config.separator);
    const text = (pos === -1 ? content : content.slice(0, pos)).trim();
    const source = pos === -1 ? '' : content.slice(pos + g_config.separator.length).trim();
    if (!text) {
      console.warn(`警告：${path.basename(file)} 第 ${index + 1} 行格言内容为空，已跳过`);
      return;
    }
    items.push({ text, source });
  });
  return items;
}

/**
 * 读取目录下所有 .md 文件，生成 "分类 -> 格言数组"
 */
function collectMaxims() {
  const dir = resolve(g_config.markdownDir);
  const data = {};
  fs.readdirSync(dir)
    .filter(name => name.toLowerCase().endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .forEach(name => {
      const category = path.basename(name, '.md');
      console.log(`处理文件${name}...`);
      const items = parseMaximFile(path.join(dir, name));
      if (!items.length) {
        console.warn(`警告：${name} 没有有效格言，已跳过`);
        return;
      }
      // 源文件按时间正序追加，输出时倒序，最新的排在最上面
      data[category] = items.reverse();
    });
  return data;
}

/**
 * 生成格言列表 HTML（样式与主页格言列表一致）
 */
function renderHtml(data) {
  return Object.keys(data).map(category => {
    const rows = data[category].map(it => {
      const src = it.source ? `<span class="src">${escapeHtml(it.source)}</span>` : '';
      return `<div class="maxim-item"><span>${escapeHtml(it.text)}</span>${src}</div>`;
    }).join('\n');
    return `<div class="maxim-group">\n<h3>${escapeHtml(category)}</h3>\n${rows}\n</div>`;
  }).join('\n');
}

/**
 * 主函数
 */
function main() {
  const data = collectMaxims();
  const outputDir = resolve(g_config.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonFile = path.join(outputDir, g_config.outputJson);
  console.log(`生成文件${jsonFile}...`);
  fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2) + '\n');

  const template = fs.readFileSync(resolve(g_config.markdownTemplate), 'utf8');
  const pageFile = path.join(outputDir, g_config.outputPage);
  console.log(`生成文件${pageFile}...`);
  fs.writeFileSync(pageFile, template.replace(g_config.variable, () => renderHtml(data)));

  const total = Object.values(data).reduce((sum, list) => sum + list.length, 0);
  console.log(`完成：${Object.keys(data).length} 个分类，共 ${total} 条格言`);
}

main();
