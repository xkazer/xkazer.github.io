
#### 盒子模型(box-sizing)
- W3C标准盒子模型(content-box): 属性width，height只包含content，不包含border和padding
- IE盒子模型(border-box): 属性width，height包含content、border和padding

#### CSS选择符
- id选择器(#myid)
- 类选择器(.myclassname)
- 标签选择器(div,h1,p)
- 后代选择器(h1 p)
- 相邻后代选择器(子)选择器(ul>li)
- 兄弟选择器(li~a)
- 相邻兄弟选择器(li+a)
- 属性选择器(a[rel="external"])
- 伪类选择器(a:hover,li:nth-child)
- 伪元素选择器(::before, ::after)
- 通配符选择器(*)

#### 伪类和伪元素
伪类用于当已有的元素处于某个状态时，为其添加对应的样式，这个状态是根据用户行为而动态变化的。比如悬停

伪元素用于创建一些不在文档树中的元素，并为其添加样式。它们允许我们为元素的某些部分设置样式。比如::before在元素前增加文本

注: 由于旧版本中的W3C规范并未对此进行特别区分，所以绝大多数浏览器都支持(::)和(:)两个方式表示伪元素。


#### CSS哪些属性可以继承
- 字体系列属性: font、font-family、font-weight、font-size、font-style、font-variant、font-stretch、font-size-adjust
- 文本系列属性: text-indent、text-align、text-shadow、line-height、word-spacing、letter-spacing、text-transform、direction、color
- 表格布局属性: caption-side、border-collapse、empty-cells
- 列表属性: list-style-type、list-style-image、list-style-position、list-style
- 光标属性: cusor
- 元素可见性: visibility
- 其他: speak、page等

注: 当一个属性不是继承属性时，可以使用inherit关键字指定一个属性应从父元素继承它的值，inherit关键字用于显示地指定继承性，可用于任何继承性/非继承性属性。

#### CSS优先级算法
选择器特殊性分四个等级:
- 标签内选择符  x,0,0,0
```
<span style="color:red;">
```
- ID选择符     0,x,0,0
```
#text{color:red;}
```
- class选择符/属性选择符/伪类选择符 0,0,x,0
```
.text{color:red;} [type="text"]{color:red}
```
- 元素和伪元素选择符     0,0,0,x
```
span{color:red;}
```
特点:
- 每个等级初始值为0
- 每个等级的叠加为选择器出现的次数相加
- 不可进位
- 等级从左向右，如果某一位相同，则判断下一位
- 优化级相同，则最后出现的优化级高，!important也适用
- 通配符选择器特殊性为: 0,0,0,0
- 继承样式优化级最低，通配符样式优先级高于继承样式

#### 关于伪类LVHA的解释
a标签有四种状态: 链接访问前、链接访问后、鼠标滑过、激活，分别对应四种伪类: :link、:visited、:hover、:active

链接访问前:
- 当鼠标滑过a标签时，满足:link和:hover两个状态，:hover伪类须在:link伪类后面声明
- 当鼠标点击激活a标签时，同时满足:link、:hover、:active三种状态，必须将:active声明放到:link和:hover后，因此得出LVHA顺序


#### position的值relative和absolute定位原点
- absolute: 绝对定位，相对于值不为static(absolute或relative)的第一个父元素的padding box进行定位
- fixed: 绝对定位，相对于浏览器窗口进行定位
- relative: 相对定位，相对于其元素本身所在正常位置进行定位
- static: 默认值，没有定位
- inherit: 从父元素继承position属性


#### display、position和float的相互关系
- display为none时，position和float值不影响表现
- position为absolute或fixed时，float属性失败，且display会被设置为table或block
- position不为absolute或fixed，则判断float是否为none，不是则正常转换display
- 如果float为none，则判断元素是否根元素，是则正常转换，否则保持display属性不变

#### CSS优化、提供性能的方法:
加载性能:
- css压缩:将写好的css进行打包压缩，可以减少很多的体积
- css单一样式： 当需要下边距和左边距时，很多时候选择(margin: top 0 bottom 0;)但(margin-bottom:bottom;margin-left:left;)执行效率更高
- 减少使用@import，而建议使用link，因为后者在页面加载时一起加载，前者是等待页面加载完成之后再进行加载
选择器性能:
- 关键选择器: 选择器的最后面部分为关键选择器(即用来匹配目标元素的部分)。CSS选择符是从右到从进行匹配的。当使用后代选择器时，浏览器会遍历所有子元素来确定是否是指定的元素等等
- 如果规则拥有ID选择器作为其关键选择器，则不要为规则增加标签。过滤无关的规则(这样样式系统就不会浪费时间去匹配它们了)
- 避免使用通配规则，如*{}计算次数惊人
- 尽量少的去对标签进行选择，而是用class
- 尽量少的去使用后代选择器，降低选择器的权重值。后代选择器是开销最高的，尽量将选择器的深度降到最低，最高不要超过三层，更多的使用类来关联每一个标签元素
- 了解哪些属性是可以通过继承而来的，然后避免对这些属性重复指定规则
渲染性能:
- 慎重使用高性能属性: 浮动、定位
- 尽量减少页面重排、重绘
- 去除空规则: {}
- 属性值为0时，不加单位
- 属性值为浮点小数0.**，可以省略小数点之前的0
- 标准化各种浏览器前缀: 带浏览器前缀的在前。标准属性在后
- 不使用@import前缀
- 选择器优化嵌套，避免层级过深
- CSS雪碧图，减少页面的请求次数
- 正确使用display属性，由于display的作用，某些样式组合会失效，徒增样式体积也影响解析性能
- 不滥用web字体。
可维护性、健壮性:
- 将相同属性的样式抽离出来，整合并通过class在页面中使用，提高页面可维护性
- 样式和内容分离: 将css代码定义到外部css中


#### flex
重要概念:
- flex容器: 设置 display: flex; 的元素
- flex项目: flex容器内的元素
- 主轴: 项目排列方向
- 交叉轴

flex容器的属性:
- flex-direction: 设置主轴方向, 值: **row**、row-reverse、column、column-reverse
- flex-wrap: 设置容器内项目是否可换行，值: **nowrap**、wrap、wrap-reverse
- flex-flow: 上面两个的合体，默认值 : **row nowrap**
- justify-content: 主轴对齐方式，值: **flex-start**、flex-end、center、space-between、space-around
- align-items: 交叉轴上的对齐方式，值: **stretch**(若无高度则占满整个高度)、flex-start、flex-end、center、baseline(第一行文本基线对齐)
- align-content: 多根轴线的对齐方式, 值: **stretch**(平分空间，且未设置高度是撑满)、flex-start、flex-end、center、space-betweeen、space-around

flex项目属性
- flex-grow: 定义项目的放大比例，默认值为0，即如果有剩余空间，也不放大
- flex-shrink: 定义项目的缩小比例，默认值为1，即空间不足，该项目将缩小
- flex-basis: 定义了在分配多余空间之前，项目占据的主轴空间，浏览器根据这个属性，计算主轴是否有多余的空间。值: **auto**(即项目本来的大小)
- order: 定义项目在容器中的排列顺序，数值越小，排列越靠前，默认为0
- align-self: 允许单个项目与其他项目不一样的对齐方式。值: **auto**(即继承父元素的align-items属性)、flex-start、flex-end、center、baseline、stretch


#### grid
二维布局方式，相对于使用HTML结构实现的table布局, grid布局都是在CSS中完成的

重要概念:
- grid容器
- grid项目
- 行
- 列
- 单元格
- 网络线

grid容器的属性
- grid-template-columns
- grid-template-rows
- gap(column-gap、row-gap)
- place-items(justify-items、align-items)
- place-content(justify-content、align-content)
- grid-template-areas
- grid-auto-flow
- grid-auto-columns、grid-auto-rows

grid项目的属性:
- grid-column-start、grid-column-end
- grid-row-start、grid-row-end
- grid-column
- grid-row
- grid-area
- justify-self、align-self
- place-self

#### 实现响应式布局
> 响应式设计的基本原理是通过媒体查询检测不同的设备屏幕尺寸做处理，为了处理移动端，页面头部必须有meta声明viewport。
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user=scalable=no">
```
> 属性对应如下:
>  - width=device-width: 是自适应手机屏幕的尺寸宽度
>  - maximum-scale: 是缩放比例的最大值
>  - initial-scale: 是缩放的初始化
>  - user-scalable: 是用户的可以缩放的操作

属性名|取值|描述
--|--|--
width|正整数|定义布局视口的宽度，单位为像素
height|正整数|定义布局视口的高度，单位为像素，很少使用
initial-scale|[0,10]|初始缩放比例，1表示不缩放
minimum-scale|[0,10]|最小缩放比例
maxinum-scale|[0,10]|最大缩放比例
user-scalable|yes/no|是否允许手动缩放页面，默认值为yes

##### 媒体查询
> 使用@media查询，可以针对不同的媒体类型定义不同的样式
```css
@media screen (min-width: 375px) and (max-width: 600px) { ... }
```

##### 百分比
> 通过百分比单位"%"来实现响应式的效果。height、width属性的百分比依托于父标签的宽高，但是其他盒子属性则不完全依赖父元素:
>   - 子元素的top/left和bottom/right如果设置百分比，则相对于直接非static定位(默认定位)的父元素的高度/宽度
>   - 子元素的padding如果设置百分比，不论是垂直方向还是水平方向，都相对于直接父元素的width
>   - 子元素的margin如果设置成百分比，不论是垂直方向还是水平方向，都相对于直接父元素的width
>   - border-radius不一样，如果设置border-radius为百分比，则是相对于自身的宽度

##### vw/vh
> vw表示相对于视图窗口的宽度，vh表示相对于视图窗口高蔗。任意层级元素，在使用vw单位的情况下，1vw都等于视图宽度的百分之一，与百分比布局很类似。

##### rem
> rem是一个灵活的、可扩展的单位，由浏览器转化像素并显示。rem是相对于根元素html的font-size属性，默认情况下浏览器字体大小为16px，此时1rem=16px。可以利用前面提到的媒体查询，针对不同设备分辨率改变font-size的值。
```css
@media screen and (max-width: 320px) {
  html {
    font-size: 12px;
  }
}
```

#### BFC
> BFC(Block Formatting Context)，即块级格式化上下文，它是页面中的一块渲染区域，并且有一套属于自己的渲染规则:
>  - 内部的盒子会在垂直方向上一个接一个的放置
>  - 对于同一个BFC的俩个相邻的盒子的margin会发生重叠，与方向无关
>  - 每个元素的左外边距与包含块的左边界相接触(从左到右)，即使是浮动元素也是如此
>  - BFC的区域不会与float的元素区域重叠
>  - 计算BFC的高度时，浮动子元素也参与计算
>  - BFC就是页面上的一个隔离的独立容器，容器里面的子元素不会影响到外面的元素，反之亦然

##### BFC触发条件
> 触发BFC的条件包括不限于:
>  - 根元素，即HTML元素
>  - 浮动元素: float值为left、right
>  - overflow值不为visble，为auto、scroll、hidden
>  - display的值为inline-block、inltable-cell、table-caption、table、inline-table、flex、inline-flex、grid、inline-grid
>  - position的值为absolute或fixed

##### BFC应用场景

###### 防止margin重叠(塌陷)
```html
<style>
  p {
    width: 200px;
    line-height: 100px;
    text-align: center;
    margin: 100px;
  }
</style>
<body>
  <p>Haha</p>
  <p>Hehe</p>
</body>
```
> 两个p元素之间的距离为100px，发生了margin重叠(塌陷)，以最大的为准。可以在p外层包裹一层容器，并触发这个容器生成一个BFC,两个p不属于同一个BFC，就不会出现margin重叠
```html
<style>
  .wrap {
    overflow: hidden;     // 新的BFC
  }
  p {
    width: 200px;
    line-height: 100px;
    text-align: center;
    margin: 100px;
  }
</style>
<body>
  <p>Haha</p>
  <div class="wrap">
    <p>Hehe</p>
  </div>
</body>
```

###### 清除内部浮动
```html
<style>
  .par {
    border: 5px solid #fcc;
    width: 300px;
  }
  .child {
    border: 5px solid #f66;
    width: 100px;
    height: 100px;
    float: left;
  }
</style>
<body>
  <div class="par">
    <div class="child"></div>
    <div class="child"></div>
  </div>
</body>
```
> 这里.par的高度为0，因为子元素是浮动的。这里可以利用BFC计算高度时，浮动元素也会参与的规则，让.par元素生成一个BFC，则内部浮动元素计算高度时也会计算。
```css
.par {
  overflow: hidden;
}
```

###### 自适应多栏布局
> 这里举个两栏的布局
```html
<style>
    body {
        width: 300px;
        position: relative;
    }
 
    .aside {
        width: 100px;
        height: 150px;
        float: left;
        background: #f66;
    }
 
    .main {
        height: 200px;
        background: #fcc;
    }
</style>
<body>
    <div class="aside"></div>
    <div class="main"></div>
</body>
```
> 因为每个元素的左外边距与包含块的左边界相接触，因为虽然.aslide为浮动元素，但是main的左边依然与包含块的左边相接触。而BFC的区域不会与浮动盒子重叠，所以我们可通过触发main生成BFC，以此适应两栏布局
```css
.main {
  overflow: hidden;
}
```
> 新的BFC不会与浮动的.aside元素重叠。因此会根据包含块的宽度，和.aside的宽度，自动变窄。