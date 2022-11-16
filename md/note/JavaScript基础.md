
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

#### GC算法
标记-清除算法:
- 标记阶段: 首先通过根节点，标记所有从根节点开始的可达对象。未被标记的对象就是未被引用的垃圾对象
- 清除阶段: 清除所有未被标记的对象
> 不足: 
  - 1、效率问题: 标记和清除两个过程的效率都不高
  - 2、空间问题: 标记清除后会产生大量不连续的内存碎片，空间碎片太多可能会导致以后在程序运行过程中需要分配较大对象时，无法找到足够的连续内存而不得不提前出发另一次垃圾收集动作。

复制算法:
- 将原有内存空间分成两块，每次只使用一块
- 在垃圾回收时，将正在使用的内存的存活对象复制到未被使用的内存块中，然后清除正在使用的内存块中的所有对象
- 交换两个内存的角色，完成垃圾回收
> 不足: 相对高效的回收方法，不适用于存活对象较多的场合，如老年代

标记-整理算法:
- 标记阶段: 先通过根节点，标记所有根节点开始的可达对象，未被标记的为垃圾对象
- 整理阶段: 将所有存活对象压缩到内存的一段，之后清理边界外所有的空间

> 适合于存活对象较多的场合，如老年代

分代收集算法:
- 新生代: 选择"复制算法"
- 老年代: 选择"标记-清理"或"标记-整理"

Java堆是JVM管理的最大一块内存空间，主要存放对象实例。

堆分两块区域: 新生代、老年代

新生代又被分为Eden、From Survivor、To Survivor(8:1:1) 新生代这样划分是为了更好的管理堆内存中的对象，方便GC算法--复制算法来垃圾回收。
一次gc发生时(Eden空间快满时):
- Eden区活着的对象 + From Survivor存储的对象被复制到To Survivor
- 清空Eden和From Survivor
- 颠倒From Survivor和To Survivor的逻辑关系: From变To，To变From


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