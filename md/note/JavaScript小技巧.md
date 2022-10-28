

## JavaScript小技巧

##### 通过条件判断向对象添加属性
```javascript
// 我们可以通过展开运算符向对象添加属性
const person = {
  id: 'ak001',
  name: 'ak47',
  ...(isValid && {isActive: true}),
  ...((age > 18 || isValid) && {cart: 0})
}
```

##### 使用可选链(Optionalchaining)避免访问对象属性报错
```javascript
const product = {
 id: 'ak001',
 name: 'ak47'
}
console.log(product.sale.isSale); // throw error
console.log(product?.sale?.isSale); // undefined
```

##### 检查对象中是否存在某个属性
```javascript
const person = {
  id: 'ak001',
  name: 'ak47'
}
console.log('name' in person); // true
console.log('isActive' in person); // false
```

##### 巧用空值合并
```javascript
let data = undefined ?? 'noData;
console.log('data:', data); // data: noData

data = null ?? 'noData';
console.log('data:', data); // data: noData

data = 0 ?? null ?? 'noData';
console.log('data:', data); // data: 0

// 当我们根据变量自身判断时
data ??= 'noData';
console.log('data:', data); // data: noData
// 和或（||） 运算符的区别？
// 或运算符针对的是falsy类的值 (0,’ ’, null, undefined, false, NaN)
// 而空值合并仅针对null和undefined生效；
```

##### 监听DOM节点尺寸变更
ResizeObserver接口可以监听到 Element 的内容区域或 SVGElement的边界框改变。内容区域则需要减去内边距 padding。
示例:
```javascript
this.elementRo = new ResizeObserver((entries) => {
  this.onResize();
});
this.elementRo.observe(dom);
```
不需要时停止监听
```javascript
this.elementRo.disconnect();
```

##### 监听DOM节点隐藏状态
IntersectionObserver 接口提供了一种异步观察目标元素与其祖先元素或顶级文档视窗 (viewport) 交叉状态的方法.
示例:
```javascript
this.elementIo = new IntersectionObserver((entries) => {
  this.onResize();
});
this.elementRo.observe(dom);
```
不需要时停止监听
```javascript
this.elementRo.disconnect();
```

##### 获取对象类型
```javascript
Object.prototype.toString.call(obj);
```