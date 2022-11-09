
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