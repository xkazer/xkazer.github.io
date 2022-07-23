const fs = require('fs');
const path = require('path');
/** 全局变量 */
const g_config = require('./links.json');
let g_home_template = '';

/**
 * 加载Home文件模板
 */
function loadHomeTemplate() {
  try {
    console.log(`加载home模块${g_config.homeTemplate}...`);
    g_home_template = fs.readFileSync(g_config.homeTemplate, 'utf8');
  } catch (err) {
    console.warn(err);
  }
}

/**
 * 根据链接获取图标
 */
function getUrlFavicon(url) {
  const params = url.split('/');
  return `${params[0]}//${params[2]}/favicon.ico`;
}

/**
 * 根据link生成html代码
 */
function generateLinksHtml() {
  let renderHtml = "";
  Object.keys(g_config.links)
    .forEach(key => {
      renderHtml += `<li><button class="category">${key}</button><ul class="link">`;
      Object.keys(g_config.links[key])
        .forEach(name => {
          const url = g_config.links[key][name];
          renderHtml += `<li style="background-image:url(${getUrlFavicon(url)})"><a href="${url}" target="_blank">${name}</a></li>`;
        });
      renderHtml += `</ul> </li>`;
    });
  return renderHtml;
}


/**
 * 根据links生成home.html
 * @param {*} file 文件路径
 */
 function translateHomeFile() {
  try {
    const outputFile = g_config.output;
    const result = generateLinksHtml();
    console.log(`生成文件${outputFile}...`)
    fs.writeFileSync(outputFile, g_home_template.replace(g_config.variable, result));
  } catch (err) {
    console.warn(err);
  }
}

/**
 * 主函数
 */
function main() {
  loadHomeTemplate();
  translateHomeFile();
}

main();