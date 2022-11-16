
#### Vue响应式原理
Vue是MVVM(Model-View-ViewModel)架构，响应式核心是通过Object.defineProperty拦截对数据的访问和设置ß

响应式数据分为两类:
- 对象: 循环遍历对象的所有属性，为每个属性设置getter、setter，以达到拦截访问和设置的目的(无法检测property的添加或移除)，如果属性值依旧为对象，则递归为属性值上的每个key设置getter、setter
  - 访问数据时(obj.key)进行依赖收集，在dep中存储相关的watcher
  - 设置数据时dep通过相关的watcher去更新
- 数组: 增强数组的那7个可以更改自身的原型方式，然后拦截这些方法的操作
  - 添加新数据时进行响应式处理，然后由dep通知watcher去更新
  - 删除数组时，也要由dep通知watcher去更新

注:
 - Vue 无法检测对象 property 的添加或移除
 - Vue对数组的7个变异方法(push、pop、shift、unshift、splice、sort、reverse)实现了响应
 - Vue 无法检测通过索引直接设置一个数组项，如 vm.items[indexOfItem] = newValue;
 - Vue 无法检测修改数组的长度, 如 vm.items.length = newLength;


#### methods、computed和watch的区别
使用场景:
 - methods 一般用于封装一些较为复杂的处理逻辑(同步、异步)
 - computed 一般用于封装一些简单的同步逻辑，将经过处理的数组返回，然后显示在模板中，以减轻模版的重量
 - watch 一般用于当需要在数组变化时执行异步或开销较大的操作

区别:
 - 一次渲染中多个地方使用同一个methdos或computed属性时，methods会执行多次，而computed只会被执行一次(后续访问直接使用第一次的执行结果)
 - computed和watch都是观察页面数据变化。computed只有依赖的数据变化时才会计算，当数据没有变化时，它会读取缓存数据。watch每次都需要执行函数。watch更适用于数据变化时的异步操作。


#### Vue的异步更新机制是如何实现的
Vue的异步更新机制的核心是利用了浏览器的异步任务队列来实现的，首选微任务队列，宏任务队列次之。

当响应式数据更新后，会调用dep.notify方法，通知dep中收集的watcher去执行update方法，watcher.update将watcher自己放入一个watcher队列(全局的queue数组)

然后通过nextTick方法将一个刷新watcher队列的方法放入一个全局的callbacks数组中

如果此时浏览器的异步任务队列中没有一个flushCallbacks的函数，则执行timerFunc函数，将flushCallbacks函数放入异步任务队列。如果异步任务队列中已经存在flushCallbacks函数，等待其执行完成以后再放入下一个flushCallbacks函数

#### Vue的nextTick API是如何实现的
Vue.nextTick或者vm.$nextTick是利用Event loop事件线程去异步操作,原理其实是做了两件事:
- 将传递的回调函数用try...catch包裹然后放入callbacks数组
- 执行timerFunc函数，在浏览器的异步任务放入一个刷新callbacks数组的函数

#### Vue.use(plugin)做了什么
负责安装plugin插件，其实就是执行插件提供的install方法
- 首先判断该插件是否已经安装过
- 如果没有，则执行插件的install方法安装插件

#### Vue.set(target, key, val) 做了什么
由于Vue无法探测普通的新增property，所以通过Vue.set向响应式对象中添加一个property，可以确保这个新property同样是响应式的，且触发视图更新。
- 更新数组指定下标的元素: Vue.set(array, idx, val), 内部通过splice方法实现响应式更新
- 更新对象已有属性: Vue.set(obj, key, val), 内部更新即可
- 不能向Vue实例或$data动态添加根级别的响应式数组
- Vue.set(obj, key, val),如果obj不是响应式对象，会执行obj[key]=val，但是不会做响应式处理
- Vue.set(obj, key, val),为响应式对象obj增加一个新的key，则通过Object.defineProperty方法设置响应式，并触发依赖更新

#### SPA单页面的实现方式
- 在hash模式中，在window上监听hashchange事件(地址栏中的hash变化触发)驱动界面变化
- 在history模式中，在window上监听popstate事件(浏览器的前进或后退按钮的点击触发)驱动页面变化，监听a链接点击事件用history.pushState、history.replaceState方法驱动界面变化
- 直接在界面用显示隐藏事件驱动界面变化

#### SPA单页应用的理解
SPA(single-page application)仅在Web页面初始化加载相应的HTML、JavaScript和CSS。一旦页面加载完成，SPA不会因为用户的操作而进行页面的重新加载和跳转;取而代之的是利用路由机制实现HTML内容的变换，UI与用户的交互，避免页面的重新加载。

优点:
- 用户体验好、快，内容的改变不需要重新加载，避免了不必要的跳转和重复渲染
- 基于上面一点，SPA相对对服务器压力小
- 前后端职责分离，架构清晰，前端进行交互逻辑，后端负责数据处理

缺点:
- 初始化加载耗时多: 为实现单页Web应用功能及显示效果，需要在加载页面时将JavaScript、CSS统一加载，部分页面按需加载
- 前进后退路由管理: 由于单页应用在一个页面中显示所有的内容，所以不能使用浏览器的前进后退功能，所有的页面切换需要自己建立堆栈管理
- SEO(Search Engine Optimization搜索引擎最佳化)难度较大: 由于所有的内容都在一个页面中动态替换显示，所以在SEO上其有着天然的弱势

#### Vue SEO方案
Vue SPA单页应用对SEO不友好，当然也有解决方案:
- SSR服务器渲染
  - 优势: 
    - 更好的SEO，因为搜索引擎爬虫抓取工具可能直接查看完全渲染的页面
    - 更快的内容到达时间，特别是对于缓慢的网络情况或运行缓慢的设备
  - 不足:
    - 一套代码两套执行环境，会引起各种问题，比如服务端没有window、document对象，处理方式是增加判断，如果是客户端才执行
    - 涉及构建设置和部署的更多要求，需要处理node server的运行环境
    - 更多的服务端负载

- 预渲染 prerender-spa-plugin
如果只是用来改善少数营销页面(例如: /, /about, /contact等)的SEO，那么可能需要预渲染。无需使用Web服务器实时动态编译HTML，而是使用预渲染方式，在构建时简单地生成针对特定的路由的静态HTML文件。
  - 优点:
    - 改动过小，引入插件配置即可
  - 不足:
    - 无法使用动态路由
    - 只使用少量页面的项目，页面多达几百个的情况下，打包会非常慢
  
- 使用Phantomjs针对爬虫做处理
这种解决方案其实是一种旁路机制，原理是通过Nginx配置，判断访问来源UA是否是爬虫访问，如果是则将搜索引擎的爬虫请求转到一个node server，再通过PhantomJS来解析完整的HTML，返回给爬虫。
  - 优点:
    - 完全不用改动项目代码，按原本的SPA开发即可，对比开发SSR成本小的不要太多
    - 对已用SPA开发的项目，这是不二之选
  - 不足:
    - 部署需要node服务器支持
    - 爬虫访问比网页访问要慢一些，因为定时要定时资源加载完成才返回给爬虫
    - 如果恶意模拟百度爬虫大量循环抓取，会造成服务器负载方面问题，解决方法是判断访问IP，是否是百度官方爬虫的IP


#### Vue中Watch高级用法deep和immediate
watch默认绑定，页面首次加载时，是不会执行的。只有值发生改变才会执行。指定immediate为true则可以立即执行。
```javascript
watch: {
  name: {
    handler(newVal, oldVal) {
      // 执行代码
    },
    immediate: true       // true表示立即执行
  }
}
```
如果监听的是对象类型，当手动修改对象的某个属性时，发现是无效的。这时就需要deep属性
```javascript
data: {
  obj: {
    a: 1
  }
},
watch: {
  obj: {
    handler(newVal, oldVal) {
      // 执行代码
    },
    deep: true  // true表示深度监听，这时候就可以监测到a的变化
  },
  'obj.a': {        // deep优化，用字符串的方式来取代深度监听(一个个遍历，很学浪费性能)
    handler(newval, oldVal) {

    }
  }
}
```

#### route和router的区别
route是"路由信息对象"，包括path、params、hash、query、fullPath、matched、name等路由信息。而router是"路由实例"对象包括了路由的跳转方法，钩子函数等

#### Vue生命周期
- beforeCreate(创建前) 在数据观测和初始化事件还未开始
- created(创建后) 完成数据观测，属性和方法的运算，初始化事件
- beforeMount(载入前) el属性还没显示出来，在挂载开始之前被调用，相关的render函数首次被调用。实例已完成: 编译模板，把data里的数据和模板生成html。
- mounted(载入后) el挂载到实例上之后调用。实例已完成: 用上面编译好的html内容替换el属性指向的DOm对象。完成模板中的html渲染到html页面中。
- beforeUpdate(更新前) 在数据更新之前调用，发生在虚拟DOM重新渲染和打补丁之前。可以在该钩子中进一步更改状态，不会触发附加的重渲染过程。
- updated(更新后) 在由于数据更改导致的虚拟DOM重新渲染和打补丁之后调用。调用时，组件DOM已经更新，所以可以执行依赖于DOm的操作
- beforeDestory(销毁前) 在实例销毁之前调用。实例仍然完全可用
- destroyed(销毁后) 在实例销毁之后调用。调用后，所有的事件监听器会被移除，所有的子实例也会销毁。
> 父子组件生命周期: 父beforeCreate => 父created => 子beforeCreated => 子created => 子mounted => 父mounted

#### keep-alive
keep-alive是Vue内置的一个组件，可以使被包含的组件保留状态，或避免重新渲染。2.1.0版本后,keep-alive新加入三个属性:
- include(包含的组件缓存)  字符串或正则表达式，只有名称匹配的组件会被缓存
- exclude(排除的组件不缓存，优化级大于include)  字符串或正则表达式，任何名称匹配的组件都不会被缓存
- max(缓存组件的最大值) 字符或数字，可以控制缓存组件的个数
> keepalive是一个抽象的组件，缓存的组件不会被mounted，为此提供activated和deactivated钩子函数
> 页面第一次进入，钩子的触发顺序: created => mounted => activated。退出时触发deactiveated 当再次进入(前进或后退)时，只触发activated
> 事件挂载的方法等，只执行一次的放在mounted中; 组件每次进去执行的方法放在activated中

#### v-for中的:key
使用v-for更新已渲染的元素列表时，默认用**就地复用**策略，列表数据修改的时候，他会根据key值去判断某个值是否修改，如果修改，则重新渲染这一项，否则复用之前的元素。
> 我们经常使用index(数据的下标)来作为key，但其实这是不推荐的做法。如果在数据中插入一条数据，该条数据后的所有数据都需要更新(key发生了变化)

#### 自定义指令
类似v-model和v-show，例如实现一个自动获取焦点的全局自定义指令:
```javascript
Vue.directive('focus', {
  inserted: function (el) {
    el.focus();
  }
})
```
也可以在组件中注册局部指令:
```javascript
directives: {
  focus: {
    inserted: function (el) {
      el.focus();
    }
  }
}
```
钩子函数:
- bind: 只调用一次，指令第一次绑定到元素时调用
- inserted: 被绑定元素插入父节点时调用(仅保证父节点存在，但不一定已被插入文档中)
- update: 所在组件的VNode更新时调用，但是可能发生在其子VNode更新之前。
- componentUpdated: 指令所在组件的VNode及子VNode全部更新后调用
- unbind: 只调用一次，指令在元素解绑时调用

#### v-model原理
语法糖:value+@input。分两种情况:
- 原生DOM(input、select、textarea)
```html
<input v-model="val">
<!-- 基本等价于,因为内部还有一些其他处理 -->
<input :value="val" @input="val = $event.target.value">
```
两个方向:
  - 改变数据时通知视图更新: 通过Object.definedProperty的setter在属性更新时通知视频更新
  - 视图改变时通知数据更新: 通过监听表单元素的input事件，从而通知数据更新
- 自定义组件
```html
<v-input v-model="val"></v-input>
<!-- 等价于 -->
<v-input :value="val" @input="val = $event"></v-input>
```

#### v-for和v-if不建议同时使用
v-for比v-if优化级高，所以使用的话，每次v-for都会执行v-if，造成不必要的计算，影响性能。

#### Vue的单向数据流
指数据一般从父组件传到子组件，子组件没有权利直接修改父组件传来的数据。

#### Vue2和Vue3的响应式原理
Vue2的响应式原理是靠Object.defineProperty实现。Vue3是通过Proxy来实现的。

Vue2中Object.defineProperty
- 深度监听在初始化时就一次性递归监听就好了
- 无法跟踪对象增加新值，删除属性
- 数组需要额外处理
Vue3中proxy:
- 深度监听是在获取值的时候才对其监听(按需监听)
- 可以很完备的监听属性增加和删除
- 数组可以原生使用api，不需要再对需要监听的api再做处理