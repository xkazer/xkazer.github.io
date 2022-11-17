
#### 什么是TypeScript
> TypeScript是一个强类型的JavaScript超集，支持ES6语法，支持面向对象编程的概念，如类、接口、继承、泛型等。
> TypeScript并不直接在浏览器上运行，需要编译器编译成纯JavaScript来运行

#### TypeScript相对于JavaScript的优势
> 增加了静态类型， 可以在开发人员编写脚本时检测错误，使得代码质量更好，更健壮
- 杜绝手误导致的变量名写错
- 类型可以一定程度上充当文档
- IDE自动填充，自动联想

#### const 和 readonly的区别
> const可以防止变量的值被修改，readyonly可以防止变量的属性被修改
- const用于变量，readyonly用于属性
- const在运行时检查，readonly在编译时检查
- const 声明的变量不得改变值，这意味着const一旦声明变量就必须立即初始化，不能留到以后赋值。readonly修饰的属性能确保自身不能修改属性，但是当你把这个属性交给其他并没有这种保证的使用者(允许类型兼容性的原因)，他们能改变
```typescript
const foo: {
  readonly bar: number;
} = {
  bar: 123
};
function isMutateFoo(foo: { bar: number }) {
  foo.bar = 456;
}
isMutateFoo(foo);
console.log(foo.bar);   // 456
```
- const保证的不是变量的值不得改变，而是变量指向的那个内存地址不得改动，例如使用const变量的数组，可以使用push、pos等方法。但是如果使用ReadyOnlyArray<number>声明的数组不能使用push,pop方法

#### any、never、unknown、null & undefind 和 void 区别
- any: 动态的变量类型(失去了类型检查的作用)
- never: 永不存在的值的类型，例如: never类型是那些总是会抛出异常或根本不会有返回值的函数表达式或箭头表达式的返回值类型
- unknown: 任何类型的值都可以赋给unknown类型，但是unknown类型的值只能赋给unknown本身和any类型
- null && undefined: 默认情况下null和undefined是所有类型的子类型。就是说你可以把null和undefined赋值给number类型的变量。当你指定了 --strictNullChecks标记，null和undefined只能赋值给void和它们各自
- void: 不有任何类型。例如: 一个函数如果没有返回值，那么返回值可以定义为void

#### Typescript中的this和JavaScript中的this有什么差异
- TypeScript: noImplicitThis: true的情况下，必须去声明this的类型，才能在函数和对象中使用this
- TypeScript中箭头函数的this和ES6中箭头函数中的this是一致的

#### Typescript中使用Union Types时有哪些注意事项
属性或方法访问: 当TypeScript不确定一个联合类型的变量到底是哪个类型的时候，我们只能访问此联合类型的所有类型里共有的属性或方法。
```typescript
function getString(something: string | number): string {
  return something.toString();    // 不能访问length
}
```

#### type和interface的区别
相同点:
- 都可以描述 对象 或者 函数
- 都允许拓展(extends)
不同点:
- type可以声明基本类型，联合类型，元组
- type可以使用typeof获取实例的类型进行赋值
- 多个相同的interface声明可以自动合并
> 使用interface 描述 数据结构, 使用type描述 类型关系
```typescript
enum str { A, B, C}
type strUnion = keyof typeof str;   // 'A' | 'B' | 'C'
```