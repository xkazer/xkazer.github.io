
#### js基础数据类型
js一共有五种基本数据类型: undefined/null/boolean/number/string

ES6中新增:
- Symbol: 代表创建后独一无二且不可变的数据类型
- BigInt: 可以表示任意精度格式的整数

内存:
- 栈: 原始数据类型(undefined、null、boolean、number、string)
- 堆: 引用数据类型(对象、数组和函数)

#### isNaN和Number.isNaN区别
NaN是一个警戒值的数字:
```javascript
typeof NaN;  // "number"
NaN != NaN  // true
```
函数isNaN会尝试将参数转换为数值，任何不能转换成数值的都会返回false，因此非数字值传入也会返回true
Number.isNaN会先判断参数是否是数字，如果是数字再继续判断是否是NaN，否则返回是false
```javascript
isNaN('a');   // true
Number.isNaN('a');    // false
```

#### Array构造函数只有一个参数的表现
Array构造函数只带一个数字参数时，该参数会被作为数组的预设长度(length)，而非只充当数组中的一个元素，这样创建出一个空数组。
```javascript
Array(2)        // (2) [empty × 2]
Array(2, 3)     // (2) [2, 3]
```

#### 其他值到字符串的转换规则
- null 和 undefined 类型分别转换为 "null" 和 "undefined"
- boolean类型 true 和 false 分别转换成 "true" 和 "false"
- number类型直接转换，不过那些极小和极大的数字会使用指数形式
- Symbol类型的值直接转换，但只允许显示强制类型转换
- 对普通对象来说，除非自行定义 toString() 方法，否则会调用 Object.prototype.toString() 返回内部属性[[Class]]的值，如"[object Object]"

#### 其他值到数字值的转换规则
- undefined 类型转换为NaN
- null 类型转换为 0
- boolean 类型中，true转换为1，false转换为0
- string 类型的值如同使用Number()函数进行转换，如果包含非数字值则转换为NaN，空字符串为0
- symbol 类型的值不能转换为数字，会报错
- 对象(包括数组)会首先被转换为相应的基本类型值，如果返回的是非数字的基本类型值，则再遵循以上规则
```javascript
Number([2]);    // 2
Number([2, 3]); // NaN
Number('123a'); // NaN
parseInt('123a'); // 123
```

#### {}和[]的valueOf和toString结果
- {} 的valueOf结果是{}，toString的结果是"[object Object]"
- [] 的valueOf结果是[]，toString的结果是""

#### || 和 && 操作符的返回值  
|| 和 && 首先会对第一个操作数执行条件判断:
- || 如果第一个条件判断为true则返回第一个操作数的值，如果为false，则返回第二个操作数的值
- && 如果第一个条件判断为true则返回第二个操作数的值，如果为false， 则返回第一个操作数的值

#### call、apply、bind区别
call、apply、bind都可以改变this指向
- call和apply会调用函数，并改变函数内部的this指向
- call和apply传参不同，call传递使用逗号隔开，apply使用数组传参
- bind不会调用函数，返回指定this值的原函数拷贝

#### class和function区别
class和function都可以作为构造函数，通过new操作符来实例化。
- class构建函数必须使用new操作符
- class声明不可以提升
- class不可以用call、apply、bind改变执行上下文

#### 使用requestAnimationFrame优化性能
现代浏览器都支持createDocumentFragment方法高效插入dom元素，并且这个方式是插入是以60Hz的频率插入的。

DocumentFragments是DOM节点。它们不是主DOM树的一部分。通常的用例是创始文档片段，将元素附加到文档片段，然后将文档片段附加到DOM树。在DOM树中，文档片会被其所有的子元素所代替。
因为文档片段存在于内存中，并不在DOM树中，所以将子元素插入到文档片档时不会引起页面回流(对元素位置和几何上的计算)。因此，使用文档片段通常会带来更好的性能。

#### 阻塞渲染
渲染的前提是生成渲染树，所以HTML和CSS肯定会阻塞渲染。如果想渲染的越快，就越应该降低一开始需要渲染的文件大小，并且扁平层级，优化选择器。

然后当浏览器在解析到script标签时，会暂停构建DOM，完成后才会从暂停的地方重新开始。也就是说，如果你想要首屏渲染的越快，就越不应该在首屏就加载JS文件，这也是都建议将script标签放在body标签底部的原因。

当script标签加上**defer**属性之后，表示该js文件会并行下载，但是会放到HTML解析完成顺序执行，所以对于这种情况你可以把script标签放在任意位置。

对于没有任何依赖的js文件可以加上**async**属性，表示JS文件下载和解析不会阻塞渲染。

注：
- DOMContentLoaded 事件在defer脚本下载且执行结束后触发，而不会等待async脚本。
- CSS匹配HTML元素是一个相当复杂和有性能问题的事件。所以，DOM树要小，CSS尽量用id和class，千万不要过渡层叠下去。
- style、link等样式资源的下载、解析不会阻塞页面的解析，但是会阻塞页面的渲染

#### 重绘(Repaint)和回流(Reflow)
- 重绘是当节点需要更改外观而不会影响布局时，比如改变color
- 回流是布局或几何属性需要改变

回流必定会发生重绘，重绘不一定会引发回流。回流所需的成本比重绘高得多，改变父节点里的子节点很可能会导致父节点的一系列回流。

#### 减少重绘和回流
- 使用transform替代top
- 使用visibility替换display:none，前者会引起重绘，后者会引发回流
- 不要把节点的属性值放在一个循环里当作循环里的变量(例如在循环中获取offsetTop会导致回流，因为需要去获取正常的值)
- 不要使用table布局,可能很小的一个小改动会造成整个table的重新布局
- 动画实现的速度的选择，动画速度越快，回流次数越多，可以使用requestAnimationFrame
- CSS选择符从右往左匹配查找，避免节点层级过多
- 将频繁重绘或回流的节点设置为图层(will-chage/video、iframe等)，图层能够阻止该节点的渲染行为影响别的节点。比如对于video标签，浏览器会自动将节点变为图层
- 不要一条一条地修改DOM的样式
- 尽量将DOM离线后修改:
  - 使用documentFragment对象在在内存里操作DOM
  - 先把DOM给display:none(有一次回流)，然后修改很多次后，再显示出来
  - clone一个DOM结点到内存里，然后改完后，再和线上的交换
- 为动画的HTML元件使用fixed或absolute的position，避免回流

#### CSS如何阻塞文档解析
理论上，既然样式表不改变DOM树，也就没有必要停下文档的解析等待它们，然而，存在一个问题，JavaScript脚本执行时可能在文档的解析过程中请求样式信息，如果样式还没有加载和解析，脚本将得到错误的值，显示这将会导致很多问题。

所以如果浏览器尚未完成CSSOM的下载和构建，而我们却想在此时运行脚本，那么浏览器将延迟JavaScript脚本执行和文档解析，直至其完成CSSOM的下载和构建。也就是说，在这种情况下，浏览器会下载构建CSSOM，然后再执行JavaScript，最后再继续文档的解析

#### 事件捕获与事件冒泡
```javascript
/**
 * type: 事件类型
 * function: 事件处理程序
 * useCapture: 指定事件在捕获或冒泡阶段执行. true: 捕获阶段, false: 默认，冒泡阶段
 */
element.addEventListener(type, function, useCapture);
```
- 冒泡是从下向上，DOM元素绑定的事件被触发时，目标元素执行后，它的父元素绑定的事件会向上顺序执行
- 捕获是从上向下，目标元素被触发时，会从目标元素最顶层的父元素事件向下执行到目标元素
- 先发生捕获事件，后发生冒泡事件

#### 事件委托
事件委托本质上是利用了浏览器事件冒泡的机制。因为事件在冒泡过程中会上传到父节点，并且父节点可以通过事件对象获取到目标节点，因此可以把子节点的监听函数定义在父节点上，由父节点的监听函数统一处理多个子元素的事件，这种方式称为事件代理。

#### 数组原生方法
- 数组和字符串的转换方法: toString()、toLocalString()[根据机器的本地环境来返回字符串]、join()
- 尾部操作方法: pop()、push()[可以传入多个参数]
- 首部操作方法: shift()、unshift()、重排序reverse()、sort()
- 数组连接的方法: concat()[返回新数组]
- 数组截取方法: slice()[返回新数组]
- 数组插入方法: splice()[影响原数组]
- 查找索引方法: indexOf()、lastIndexOf()
- 迭代方法: every()、some()、filter()、map()、forEach()
- 递归方法: reduce()、reduceRight()
- 填充方法: fill()

#### for..in和for...of
for...in遍历的是数据索引(index)，而for...of遍历的是数组的元素值(value)
> for...in遍历时，index索引为字符串型数字，不能直接进行几何运算
> for...in会遍历数组所有的可枚举属性，包括原型
```javascript
var arr = ['a', 'b', 'c']
Array.prototype.a = 123
for(let i in arr) {
  console(arr[i]);
}
// 'a', 'b', 'c', 123
```

#### require和import
- 规范
  - require是AMD规范引入方式
  - import是ES6的一个语法标准，如果要兼容浏览器的话必须转化为ES5的语法
- 调用时间
  - require是运行时调用，所以require理论上可以运用在代码的任何地址
  - import是编译时调用，所以必须放在文件开头
- 本质
  - require是赋值过程。module.exports后面的内容是什么，require的结果就是什么，比如对象、数字、字符串、函数等，然后再把require的结果赋值给某个变量，它相当于module.exports的传送门
  - import是解构过程，但是目前所有的引擎都还没有实现import，我们在node中使用babel支持ES6，也仅仅是将ES6转码为ES5再执行，import语法会被转码为require

#### GC算法
##### 标记-清除算法:
- 标记阶段: 首先通过根节点，标记所有从根节点开始的可达对象。未被标记的对象就是未被引用的垃圾对象
- 清除阶段: 清除所有未被标记的对象

不足: 
  - 1、效率问题: 标记和清除两个过程的效率都不高
  - 2、空间问题: 标记清除后会产生大量不连续的内存碎片，空间碎片太多可能会导致以后在程序运行过程中需要分配较大对象时，无法找到足够的连续内存而不得不提前出发另一次垃圾收集动作。

##### 复制算法:
- 将原有内存空间分成两块，每次只使用一块
- 在垃圾回收时，将正在使用的内存的存活对象复制到未被使用的内存块中，然后清除正在使用的内存块中的所有对象
- 交换两个内存的角色，完成垃圾回收

> 相对高效的回收方法，不适用于存活对象较多的场合，如老年代

##### 标记-整理算法:
- 标记阶段: 先通过根节点，标记所有根节点开始的可达对象，未被标记的为垃圾对象
- 整理阶段: 将所有存活对象压缩到内存的一段，之后清理边界外所有的空间

> 适合于存活对象较多的场合，如老年代

##### 分代收集算法:
- 新生代: 选择"复制算法"
- 老年代: 选择"标记-清理"或"标记-整理"

Java堆是JVM管理的最大一块内存空间，主要存放对象实例。

堆分两块区域: 新生代、老年代

新生代又被分为Eden、From Survivor、To Survivor(8:1:1) 新生代这样划分是为了更好的管理堆内存中的对象，方便GC算法--复制算法来垃圾回收。
一次gc发生时(Eden空间快满时):
- Eden区活着的对象 + From Survivor存储的对象被复制到To Survivor
- 清空Eden和From Survivor
- 颠倒From Survivor和To Survivor的逻辑关系: From变To，To变From

![](../png/js_mem.png)

#### 防抖(debounce)
在触发事件后N秒后才执行函数，如果N秒内又触发了函数，则重新进行计时。

应用场景: 输入框进行输入实时搜索、页面触发resize事件的时候

手写:
```javascript
function debounce(fn, wait) {
  var timer = null;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, wait);
  }
}
```

#### 节流(throttle)
在规定的一个单位时间内，只触发一次函数，如果单位时间内触发多次函数，只有一次生效

应用场景: 页面滚动事件

手写:
```javascript
function throttle(fn, wait) {
  var timer = null;
  return () => {
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, wait);
    }
  }
}
```

#### requestIdleCallback
页面是一帧一帧绘制出来的，当每秒绘制的帧数(FPS)达到60时，页面是流畅的，不于这个值时，用户会感觉到卡顿

1s 60帧，所以每一帧的时间是1000/60约16ms.所以我们书写代码时力求不让一帧的工作量超过16ms

一帧(Frame)内需要完成如下六个步骤:
- 处理用户的交互
- JS解析执行
- 帧开始。窗口尺寸变更，页面滚动等的处理
- requestAnimationFrame
- 布局
- 绘制

上面六个步骤完成后没超过16ms，说明时间有富余，此时就会执行requestIdleCallback里注册的任务

和requestAnimationFrame每一帧必定执行不同，requestIdleCallback是捡浏览器空闲来执行任务。如此一来，假如浏览器一直处于忙碌状态，requestIdleCallback注册的任务有可能永远不会执行。此时可通过设置timeout来保证执行。
```javascript
var handle = window.requestIdleCallback(callback[, options])
// callback: 回调，即空闲时需要执行的任务，该回调函数接收一个IdleDeadline对象作为入参。基中IdleDeadline包含(didTimeout: 布尔值，表示任务是否超时; timeRemaining: 表示当前帧剩余的时间，也可理解为留给任务的时间)
// options: 目前options只有一个参数， timeout:表示超过这个时间后，如果任务还没执行，则强制执行，不必等待空闲
```
与setTimeout类似，requestIdleCallback会返回一个唯一id，可通过cancelIdleCallback来取消任务。

> 因为它发生在一帧的最后，此时页面布局已经完成，所以不建议在requestIdleCallback里再操作DOM，这样会导致页面再次重绘。DOM操作建议放在requestAnimationFrame中进行。
> Promise也不建议在这里进行，因为Promise的回调属性Event loop中优先级较高的一种微任务，会在requestIdleCallback结束时立即执行，不管此时是否还有富余时间，这样很可能会让一帧超过16ms

#### Object.defineProperty
Object.defineProperty(obj, prop, descriptor) 方法会在一个对象定义一个新属性，或者修改一个对象的现有属性，并返回这个对象
- obj: 要在其上定义属性的对象
- prop: 要定义或修改的属性的名称
- descriptor: 将被定义或修改的属性描述符
descriptor属性描述符主要有两种形式: 数据描述符和存取描述符。描述符是这两种形式之一; 不能同时是两者。
- 数据描述符和存取描述符共同拥有:
  - configurable: 特性表示对象的属性是否可以被删除，以及除value和writable特性外的其他特性是否可以被修改。默认为false
  - enumerable: 当该属性的enumerable为true时，该属性才可以在for...in循环和Object.keys()中被枚举。默认为false
- 数据描述符
  - value: 该属性对应的值。可以是任何有效的JavaScript值(数值、对象、函数等)。默认为undefined
  - writable: 当且仅当该属性的writable为true时，value才能被赋值运算符改变。默认为false
- 存取描述符
  - get: 一个给属性提供getter的方法，如果没有getter则为undefined。当访问该属性时，该方法会被执行，方法执行时没有参数传入，但是会传入this对象(由于继承关系，这里的this并不一定是定义该属性的对象)。默认为undefined.
  - set: 一个给属性提供setter的方法。如果没有setter则为undefined。当属性值修改时，触发执和该方法。该方法将接受唯一参数，即该属性新的参数值。默认为undefined
> 定义descriptor时，最好先把这些属性都定义清楚，防止被继承和继承时出错。

#### JS运行机制(Event loop)
JS执行是单线程的，它是基于事件循环的。
- 所有同步任务都在主线程上执行，形成一个执行栈
- 主线程之外，会存在一个任务队列，只要异步任务有了结果，就在任务队列中放置一个事件
- 当执行栈中的所有同步任务执行完成后，就会读取任务队列。那些对应的异步任务，会结束等待状态，进入执行栈
- 主线程不断重复上一步

#### 模块化--JS规范
##### CommonJS
> NodeJS是CommonJS规范的主要实践者，它有四个重要的环境变量为模块化的实现提供支持: module、exports、require、global。实际使用时，用module.exports定义当前模块对外输出的接口(不推荐使用exports)，用require加载模块。
```javascript
/** 
 * 导出
 */
var basicNum = 0;
function add(a, b) {return a+b};
mmodule.exports = {
  add: add,
  basicNum: basicNum
}
/**
 * 引用 
 */
// 必须加./路径，不加的话只会去node_modules文件找
var math = =require('./math');
```
> CommonJS用同步的方式加载模块。在服务端，模块文件都存在本地，读取快，所以不会有问题。但是在浏览器上，限于网络原因，更合理的方案是使用异步加载
>
> exports 和 module.export区别:
> - exports： 对于本身来讲是一个变量(对象), 它不是module的引用，它是{}的引用，它指向module.exports的{}模块。只能使用.语法向外暴露变量
> - module.exports: module是一个变量，指向一块内存，exports是module中的一个属性，存储在内存中，然后exports属性指向{}模块。既可以使用.语法，也可以使用=直接赋值
```javascript
// 下面的function是一块新的内存地址，导致exports和module.exports不存在任何关系，而require拿到的是module.exports对象，所以这样写是导不出去的
exports = function (x){console.log(x)};

// 下面的写法是可以导出去的。module.exports除了可以导出对象、函数，还可以导出字符串、数值等
module.exports = function(x) {console.log(x)};
```

##### AMD和require.js
> AMD规范采用异步方式加载，模块的加载不影响它后面语句的运行。所有依赖这个模块的语句，都定义在一个回调函数中，等到加载完成之后，这个回调函数才会执行。这里介绍require.js实现AMD规范的模块化: 用require.config()指定引用路径等，用define()定义模块，用require()加载模块。
> 
> 首先我们需要引入require.js文件和一个入口文件main.js。main.js中配置require.config()并规定项目中用到的基础模块。
```html
<!-- 网页中引入require.js及main.js -->
<script src="js/require.js" data-main="js/main"></script>
```
```javascript
/** main.js入口文件/主模块 */
// 首先用config()指定各模块路径和引用名
require.config({
  baseUrl: "js/lib",
  paths: {
    "jquery": "jquery.min",   // 实际路径为js/lib/jquery.min.js
    "underscore": "underscore.min",
  }
});

// 执行基本操作
require(["jquery", "underscore"], function($, _){
})
```
> 引用模块的时候，我们把模块块名放在[]中作为require()的第一个参数;如果我们定义的模块本身也依赖其他模块，那就需要将它们放在[]中作为define()的第一参数。
```javascript
// 定义math.js模块
define(function() {
  var basicNum = 0;
  var add = function (x, y) {return x+y};
  return {
    add: add,
    basicNum: basicNum
  }
});
// 定义一个依赖undefscore.js的模块
define(['underscore'], function(_){
  var classify = function(list) {
    _.countBy(list, function(num){
      return num > 30 ? 'old' : 'young';
    })
  };
  return {
    classify: classify
  };
})
// 引用模块，将模块放在[]内
require(['jquery', 'math'], function($, math){
  var sum = math.add(10, 20);
  $("#sum").html(sum);
});
```
##### CMD和sea.js
> AMD的实现者require.js在申明依赖的模块时，会在第一时间加载并执行模块内的代码:
```javascript
define(["a", "b", "c", "d", "e", "f"], function(a, b, c, d, e, f){
  // 等于在最前面声明并初始化要用到的所有模块
  if (false) {
    // 即使没用到某个模块b，但b还是提前执行了。这就是CMD要优化的地方
    b.foo();
  }
})
```
> CMD是另一种js模块化方案，它与AMD很类似，不同点在于 **AMD推崇依赖前置、提前执行，CMD推崇依赖就近、延迟执行**。此规范其实是在sea.js推广过程中产生的。
```javascript
/** AMD写法 */
define(["a", "b", "c", "d", "e", "f"], function (a, b, c, d, e, f) {
  // 等于在最前面声明并初始化了要用到的所有模块
  a.doSomething();
  if (false) {
    // 即便没用到某个模块b，但b还是执行了
    b.doSomething()
  }
});

/** CMD写法 */
define(function(require, exports, module){
  var a = require('./a');   // 在需要时声明
  a.doSomething();
  if (false) {
    var b=require('./b');
    b.doSomething();
  }
});

/** sea.js */
// 定义模块math.js
define(function(require, exports, module) {
  var $ = require('jquery.js');
  var add = function(a, b) {
    return a+b;
  }
  exports.add = add;
});

// 加载模块
seajs.use(['math.js'], function(math){
  var sum = sum.add(1, 2);
});
```

##### ESM(ES6 Module)
> ES6在语言标准的层面上，实现了模块功能，而且实现得相当简单，旨在成为浏览器和服务器通用的模块解决方案。其模块功能主要由两个命令构成: export和import。export命令用于规定模块的对外接口，import命令用于输入其他模块提供的功能。
```javascript
/** 定义模块 math.js */
var basicNum = 0;
var add = function (a, b){
  return a+b;
};
export { basicNum, add };

/** 引用模块 */
import { basicNum, add } from './math';
function test(ele) {
  ele.textContent = add(99, basicNum);
}
```
> 如上例所示，使用import命令时，用户需要知道所要加载的变量名或函数名。其实ES6还提供了export default命令，为模块指定默认输出，对应的import语句不需要使用大括号。
```javascript
/** export default */
// 定义输出
export default { basicNum, add };

// 引入
import math from './math';
function test(ele) {
  ele.textContent = math.add(99, math.basicNum);
}
```
> ES6的模块不是对象，import命令会被JavaScript引擎静态分析，在编译时就引入模块代码，而不是在代码运行时加载，所以无法实现条件加载。正因为这个，使得静态分析成为可能。
> ES6模块的特征:
>    - 严格模式: ES6的模块自动采用严格模式
>    - import read-only特性: import 的属性是只读的，不能赋值，类似于const的特性
>    - export/import提升: import/export必须位于模块顶级，不能位于作用域内; 其次对于模块内的import/export会提升到模块顶部，这是编译阶段完成的。

##### ES6模块与CommonJS模块的差异
> 1. CommonJS模块输出的是一个值的拷贝，ES6模块输出的是值的引用
>     - CommonJS输出的是值的拷贝，也就是说，一旦输出一个值，模块内部的变化就影响不到这个值
>     - ES6模块的运行机制与CommonJS不一样。JS引擎对脚本静态分析时，遇到模块加载命令import，就会生成一个只读引用。等到脚本真正执行时，再根据这个只读引用，到被加载的那个模块里面去取值。换句话说，ES6的import有点像Unix系统的"符号连接"，原始值变了，import加载的值也会跟着变。
> 2. CommonJS模块是运行时加载，ES6模块是编译时输出接口
>     - 运行时加载: CommonJS模块就是对象; 即在输入时是先加载整个模块，生成一个对象，然后再从这个对象上面读取方法，这种加载称为"运行时加载"。
>     - 编译时加载: ES6模块不是对象，而是通过export命令显式指定输出的代码，import时采用静态命令的形式。即在import时可以指定加载某个输出值，而不是加载整个模块，这种加载称为"编译时加载"。模块内部引用的变化，会反应在外部。
> CommonJS输出拷贝的例子
```javascript
// a.js
let a = 1;
let b = { num: 1}
setTimeout(() => {
  a = 2;
  b = { num: 2 };
}, 200);
module.exports = {
  a,
  b,
};

// main.js
let { a, b } = require('./a');
console.log(a);     // 1
console.log(b);     // { num: 1 }
setTimeout(() => {
  console.log(a);     // 1
  console.log(b);     // { num: 1 }
}, 500);
```
> ES6 Module输出的例子:
```javascript
// a.js
let a = 1;
let b = { num: 1}
setTimeout(() => {
  a = 2;
  b = { num: 2 };
}, 200);
module.exports = {
  a,
  b,
};

// main.js
import {a, b} from './a';
console.log(a);     // 1
console.log(b);     // { num: 1 }
setTimeout(() => {
  console.log(a);     // 2
  console.log(b);     // { num: 2 }
}, 500);
```
##### 总结
1. AMD/CMD/CommonJS是js模块化的规范，对应的实现是require.js/sea.js/Node.js
2. CommonJS主要针对服务端(一般采用同步加载)，AMD/CMD/ES Module主要针对浏览器端(一般采用异步加载)，容易混淆的是AMD/CMD。
3. AMD/CMD区别，虽然都是并行加载js文件，但还是有所区别，AMD是预加载，在并行加载js文件同时，还会解析执行该模块;而CMD是懒加载，虽然一开始会并行加载js文件，但是不会执行，而是在需要时才执行。
4. AMD/CMD的优缺点，一个的优点就是另一个的缺点，可以对照浏览。
    - AMD优点: 加载快速，尤其遇到多个大文件，因为并行解析，所以同一时间可以解析多个文件
    - AMD缺点: 并行加载，异步处理，加载顺序不一定，可能会造成一些困扰，甚至为程序埋下大坑
    - CMD优化: 因为只有在使用的时候才会解析执行js文件，因此，每个JS文件的执行顺序在代码中是有体现的，是可控的。
    - CMD缺点: 执行等待时间会叠加。因为每个文件执行时是同步执行(串行执行)，因此时间是所有文件解析执行时间之和，尤其在文件较多较大时，这个缺点尤为明显(AMD可以利用空闲时间)。
5. CommonJS和ES Module区别: CommonJS模块输出的是一个值的拷贝，ES6模块输出的是值的引用
6. 使用: CommonJS是node就行，AMD是通过<script>引入require.js，CMD则是引入sea.js


#### 函数柯里化实现
```javascript
function curry(func) {
  return function curried(...args) {
    if (args.length >= func.length) {
      return func.apply(this, args);
    } else {
      return function (...args2) {
        return curried.apply(this, args.concat(args2));
      }
    }
  }
}
```

#### javascript单线程
> 浏览器是一个多进程的架构

![](../png/singlethread.png)

> 渲染进程下的多线程

![](../png/multithreading.png)

> - **GUI线程**: 负责渲染页面，解析html、css; 构建DOM树和渲染树
> - **js引擎线程**: js引擎线程负责解析和执行js程序; js引擎线程与GUI线程互斥，当浏览器执行javascript程序时，GUI渲染线程层会保存在一个队列当中，直到js程序执行完成，才会接着执行。
> - **定时触发线程**: setTimeout是由定时器触发线程完成的，定时器触发线程在这定时任务完成后会通知事件触发线程往任务队列里添加事件。
> - **事件触发线程**: 将满足触发条件的事件放入任务队列，一些异步的事件会放到异步队列中
> - **异步HTTP请求线程**: 用与处理ajax请求，当请求完成时如果有回调函数就通知事件触发线程往任务队列中添加任务


#### 浏览器的Event Loop
##### 宏任务和微任务

![](../png/taskandmicrotask.png)

> - 宏任务
>     1. script: script整体代码
>     2. setImmediate: node的一个方法
>     3. setTimeout和setInterval
>     4. requestAnimationFrame
>     5. I/O
>     6. UI rendering
> - 微任务
>     1. Object.observe: 监听对象变化的一个方法
>     2. MutationObserver: 可以监听Dom结构变化的一个api
>     3. postMessage: window对象通信的一个方法
>     4. Promise.then catch finally
![](../png/eventloopfn.png)

#### 静态方法调用
> 1. 通过类名来调用
> 2. 通过this.contructor来调用
```
class StaticMethodCall {
  constructor() {
    console.log(StaticMethodCall.staticMethod());
    console.log(this.constructor.staticMethod());
  }
  static staticMethod() {
    return 'static method has been called.';
  }
}
```