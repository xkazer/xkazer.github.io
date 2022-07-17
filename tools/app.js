const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
/** 全局变量 */
const g_config = require('./config.json');
const g_doc_map = new Map();
let g_markdown_template = '';
let g_index_template = '';

/**
 * 递归遍历目录
 * @param {*} dir
 * @return 文件数组 
 */
function treeDir(dir, list=[]) {
  console.debug(`读取目录${dir}...`);
  const files = fs.readdirSync(dir);
  files.forEach(item => {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      treeDir(fullPath, list);
    } else {
      list.push(fullPath);
    }
  });
  return list;
}

/**
 * 加载Markdown文件模板
 */
function loadMarkdownTemplate() {
  try {
    console.log(`加载markdown模块${g_config.markdownTemplate}...`);
    g_markdown_template = fs.readFileSync(g_config.markdownTemplate, 'utf8');
    console.log(`加载markdown模块${g_config.indexTemplate}...`);
    g_index_template = fs.readFileSync(g_config.indexTemplate, 'utf8');
  } catch (err) {
    console.warn(err);
  }
}

/**
 * 记录文件信息
 * @param {*} file 文件路径
 * @param {*} htmlFile html文件路径
 */
function recordFileInfo(file, htmlFile) {
  const names = file.split(path.sep);
  const len = names.length;
  const subDir = len > 2 ? names[len - 2] : "_";
  if (g_doc_map.has(subDir)) {
    g_doc_map.get(subDir).push(htmlFile);
  } else {
    g_doc_map.set(subDir, [htmlFile]);
  }
}

/**
 * 生成Markdown简介
 * @param {*} name  类别(目录名称)
 * @param {*} list  列表
 * @param {string} pathfix 相对路径较正
 * @param {number} count 展示条目 
 */
function generateMarkdownList(name, list, count, pathfix) {
  const title = g_config.titleMap?.hasOwnProperty(name) ? g_config.titleMap[name] : name;
  const size = (count != 0 && count < list.length) ? count : list.length;
  console.debug(`生成目录${title}条目${size}...`);
  let renderHtml = `<div class="title">${title}</div><div class="list">`;
  for (let i = 0; i < size; i ++) {
    const file = list[i];
    const link = pathfix + path.basename(file);
    renderHtml += `<a href="${link}">${path.basename(file, ".html")}</a>`;
  }
  renderHtml += "</div>";
  return renderHtml;
}

/**
 * 生成Markdown菜单项
 * @param {*} sub 分类名称 
 * @param {string} pathfix 相对路径较正
 */
function generateMarkdownMenu(sub = null, count = 0, pathfix = '') {
  let renderStr = "";
  g_doc_map.forEach((list, key) => {
    if (!sub || sub === key) {
      renderStr += generateMarkdownList(key, list, count, pathfix);
    }
  });
  return renderStr;
}

/**
 * 将markdown转化为html
 * @param {*} file 文件路径
 */
function translateMarkdownFile(file) {
  console.log(`处理文件${file}...`)
  try {
    const data = fs.readFileSync(file, 'utf8');
    const md = new MarkdownIt();
    const result = md.render(data);
    const filename = path.basename(file, '.md');
    const outputFile = path.join(g_config.outoutDir, `${filename}.html`);
    console.log(`生成文件${outputFile}...`)
    recordFileInfo(file, outputFile);
    fs.writeFileSync(outputFile, g_markdown_template.replace(g_config.variable, result));
  } catch (err) {
    console.warn(err);
  }
}

/**
 * 生成Markdown目录页
 * @param {*} name 类别名称
 */
function translateMarkdownMenu(name) {
  try {
    const outputFile = path.join(g_config.outoutDir, `${name}.html`);
    const result = generateMarkdownMenu(name);
    console.log(`生成文件${outputFile}...`)
    fs.writeFileSync(outputFile, g_markdown_template.replace(g_config.variable, result));
  } catch (err) {
    console.warn(err);
  }
}

/**
 * 根据markdown生成index.html
 * @param {*} file 文件路径
 */
 function translateIndexFile() {
  try {
    const outputFile = g_config.outputIndex;
    const result = generateMarkdownMenu(undefined, 1, 'doc/');
    console.log(`生成文件${outputFile}...`)
    fs.writeFileSync(outputFile, g_index_template.replace(g_config.variable, result));
  } catch (err) {
    console.warn(err);
  }
}

/**
 * 主函数
 */
function main() {
  loadMarkdownTemplate();
  treeDir(g_config.markdownDir)
    .forEach(file => translateMarkdownFile(file));
  // console.debug(g_doc_map);
  Object.keys(g_config.titleMap)
    .forEach(name => {
      translateMarkdownMenu(name);
    });
  translateIndexFile();
}

main();