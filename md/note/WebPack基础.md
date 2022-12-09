
#### 常用Loader
> - file-loader: 把文件输出到一个文件夹中，在代码中通过相对URL去引用输出的文件(处理图片和字体)
> - url-loader: 与file-loader类似，区别是用户可以设置一个阈值，大于阈值会交给file-loader处理，小于阈值时返回文件base64形式编码(处理图片和文字)
> - image-loader: 加载并且压缩图片文件
> - json-loader: 加载JSON文件(默认包含)
> - babel-loader: 把ES6转换成ES5
> - ts-loader: 将TypeScript转换成JavaScript
> - awesome-typescript-loader: 将TypeScript转换成JavaScript，性能优于ts-loader
> - sass-loader: 将scss/sass代码转换成css
> - less-loader: 将less代码转换成css
> - css-loadder: 加载css，支持模块化、压缩、文件导入等特性
> - style-loader: 将css代码注入到JavaScript中，通过DOM操作去加载CSS
> - postcss-loader: 支持CSS语法，使用下一代CSS，可以配合autoprefixer插件自动补齐CSS3前辍
> - eslint-loader: 通过ESLint检查JavaScript代码
> - tslint-loader: 通过TSLint检查TypeScript代码
> - vue-loader: 加载Vue.js单文件组件
> - i18n-loader: 国际化

#### 常用Plugin
> - define-plugin: 定义环境变量(Webpack4之后指定mode会自动配置)
> - ignore-plugin: 忽略部分文件
> - html-webpack-plugin: 简化HTML文件创建(依赖于html-loader)
> - uglifyjs-webpack-plugin: 压缩JavaScript(不支持ES6压缩)
> - mini-css-extract-plugin: 分离样式文件，CSS提取为独立文件，支持按需加载

#### Loader和Plugin区别
> Loader本质就是一个函数，在这个函数中对接收到的内容进行转换，返回转换后的结果(因为Webpack只认识Javascript，所以loader就成了翻译官，预处理其他资源)。
> Plugin就是插件，基于事件框架Tapable，插件可以扩展Webpack的功能，在Webpack运行的生命周期中广播中许多事件，Plugin可以监听这些处理，在合适的时机通过Webpack提供的API改变输出结果。

#### Webpack构建流程
> Webpack的运行流程是一个串行的过程，从启动到结束会依次执行以下流程:
> - 初始化参数: 从配置文件和Shell语句中读取与合并参数，得到最终的参数
> - 开始编译: 用上一步得到的参数初始化Compiler对象，加载所有配置的插件，执行对象的run方法开始执行编译
> - 确定入口: 根据配置中的entry找出所有入口文件
> - 编译模块: 从入口文件出发，调用所有配置的Loader对模块进行翻译，再找出该模块依赖的模块，再递归本步骤直到所有入口依赖的文件都经过了本步骤的处理。
> - 完成模块编译: 在经过上一步使用Loader翻译完所有模块后，得到每个模块被翻译后的最终内容以及它们之间的依赖关系
> - 输出资源: 根据入口和模块之间的依赖关系，组装成一个个包含多个模块的Chunk，再把每个Chunk转换成一个单独的文件加入到输出列表，这步是可以修改输出内容的最后机会
> - 输出完成: 在确定好输出内容后，根据配置确定输出的路径和文件名，把文件内容写入到文件系统
> 简单说: 
>   1. 初始化: 启动构建，读取与合并配置参数，加载Plugin，实例化Compiler
>   2. 编译: 从Entry出发，针对每个Module串行调用对应的Loader去翻译文件的内容，再找到该Module依赖的Module，递归地进行编译处理
>   3. 输出: 将编译后的Module组合成Chunk，将Chunk转换成文件，输出到文件系统中

#### Webpack打包速度优化
##### 分析打包速度
> 优化webpack构建速度的第一步就是知道将精力集中在哪里。我们可以通过speed-measure-webpack-plugin测量你的webpack构建期间各个阶段花费的时间。
```javascript
// 分析打包时间
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const smp = new SpeedMeasurePlugin();
// ...
module.exports = smap.swap(proWebpackConfig)
```
##### 分析影响打包速度环节
> 1. 开始打包，我们需要获取所有的依赖模块
> 2. 解析所有的依赖模块(解析成浏览器可运行的代码)
> 3. 将所有依赖模块打包到一个文件
> 4. 二次打包

##### 优化解析时间 - 开启多进程打包
> 1. thread-loader (webpack4官方推荐): 打怪这个loader放置在其他loader之前，放置在这个loader之后的loader就会在一个单独的workder[worker pool]池里运行，一个worker就是一个nodejs进程。
> 注: 请仅在耗时的loader上使用。  当项目较小时，多进程打包反而会使打包速度变慢

##### 合理使用缓存(缩短连续构建时间，增加初始构建时间)
> 使用webpack缓存的方法有几种，例如使用cache-loader，HardSourceWebpackPlugin或babel-loader的cacheDirectory标志。所有这些缓存方法都有启动的开销。重新运行期间在本地节省的时间很大，但是初始(冷)运行实际上会更慢。
> 1. cache-loader  使用简单，同thread-loader一样，仅需在一些性能开销较大的loader之前添加些loader，以将结果缓存到磁盘里，显著提升二次构建速度
>  注: 保存和读取这些缓存文件会有一些时间开销，所以请只对性能开销较大的loader使用此loader
> 2. HardSourceWebpackPlugin: 为模块提供中间缓存，二次构建大约可以节约80%时间
```
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
module.exports = {
  //...
  plugin: [
    new HardSourceWebpackPlugin()
  ]
}
```

##### 优化压缩时间
> - webpack4： webpack4默认内置使用terser-webpack-plugin插件压缩优化代码，而该插件使用terser来缩小JavsScript
>    terser启动多线程: 使用多进程并行运行来提高构建速度。并发运行的默认数量为os.cpus().length - 1。
```
module.exports = {
  optimization {
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
    ],
  },
};
```

##### 优化搜索时间- 缩小文件搜索范围 减小不必要的编译工作
> webpack打包时，会从配置的entry触发，解析入口文件的导入语句，再递归的解析，在遇到导入语句时，webpack会做两件事件:
>  - 根据导入语句去寻找对应的要导入的文件。
>  - 根据找到的要导入文件的后缀，使用配置中的Loader去处理文件。
> 1. 优化loader配置: 使用Loader时可以通过test、include、exclude三个配置项来命中Loader要应用规则的文件
> 2. 优化resolve.module配置: resolve.modules用于配置webpack去哪些目录下寻找第三方模块，resolve.modules的默认值是['node_modules']，含义是先去当前目录下的./node_modules目录查找，没找到就去上一级目录的../node_modules
> 3. 优化resolve.alias配置: 通过别名来把原导入路径映射成一个新的导入路径，减少耗时的递归解析操作
> 4. 优化resolve.extensions配置: 在导入语句没带文件后缀时，webpack会根据resolve.extension自动带上后缀后去尝试询问文件是否存在，所以配置resolve.extensions应尽可能注意以下几点:
>     - resolve.extensions列表要尽可能的小，不要把不可能存在的情况写到后缀尝试列表里
>     - 频率出现最高的文件后缀要优先放在最前面，以做到尽快的退出寻找过程
>     - 在源码中写导入语句时，要尽可能的带上后缀，从而可以避免寻找过程
> 5. 优化resolve.mainFields配置: 有一些第三方模块会针对不同环境提供几份代码。如: 
```json
{
  "jsnext:main": "es/index.js",   // 采用ES6语法的代码入口文件
  "main": "lib/index.js"      // 采用ES5语法的代码入口文件
}
```
>    webpack会根据mainFields的配置去决定优先采用哪份代码，mainFields默认如下:
```
mainFields: ['browser', 'main']
```
>   webpack会按照数组里的顺序去package.json文件里寻找，只会使用找到的第一个。假如想优先使用ES6的那份代码，可以这样配置:
```
mainFields: ['jsnext:main', 'browser', 'main']
```
> 6. 优化module.noParse配置: 可以让webpack忽略对部分没采用模块化的文件的递归解析处理，这样能提高构建性能。原因是一些库，如jQuery、ChartJS，它们庞大又没有采用模块化标准，让webpack去解析这些文件耗时又没有意义。
>  详细配置
```javascript
// 编译代码的基础配置
module.exports = {
  // ...
  module: 
    // 项目中使用的jquery并没有采用模块化标准，webpack忽略它
    noParse: /jquery/,
    rules: [
      // 这里编译js、jsx
      // 注意: 如果项目源码中没有jsx文件就不要写/\.jsx?/，提升正则表达式性能
      test: /\.(js|jsx)$/,
      // babel-loader 支持缓存转换出的结果，通过cacheDirecotry选项开启
      use: ['babel-loader?cacheDirectory'],
      // 排除node_modules 目录下的文件
      // node_modules目录下的文件都是采用的ES5语法，没必要再通过Babel去转换
      exclude: /node_modules/,
    ]
  },
  resolve: {
    // 设置模块导入规则，import/require时会直接在这些目录找文件
    // 可以指明存放第三方模块的绝对路径，以减少寻找
    modules: [
      path.resolve(`${project}/client/components`),
      path.resolve('h5_commonr/components'),
      'node_modules'
    ],
    // import导入时省略后缀
    // 注意: 尽可能的减少后缀尝试的可能性
    extensions: ['.js', 'jsx', '.react.js', '.css', '.json'],
    // import导入时别名，减少耗时的递归解析操作
    alias: {
      '@components': path.resolve(`${project}/components`),
    }
  }
}
```