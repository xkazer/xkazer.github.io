
#### 注入攻击
安全设计原则: 数据与代码分离，它可以说是专门为解决注入攻击而生的

注入攻击的本质，是把用户输入的数据当做代码执行。这里有两个关键条件:
- 第一个是用户能够控制输入
- 第二个是原本程序要执行的代码，拼接了用户输入的数据

注入类型:
- SQL注入
- XML注入
- 代码注入
- CRLF注入: CRLF常被用做不同语义之间的分隔符。因为通过"注入CRLF字符"，就有可能改变原有的语义

攻击手段:
- 攻击存储过程
- 命令执行: 利用"用户自定义函数"的技巧，即UDF(User-Defined Functions)来执行命令。在建立数据库帐户时应该遵循"最小权限原则"，尽量避免给Web应用使用数据库的管理员权限
- 编码问题: 要解决编码注入问题，需要统一数据库、操作系统、Web应用所使用的字符集，以避免各层对字符的理解存在差异。统一设置为UTF-8是一个很好的方法

防御手段:
- 防御SQL注入的最佳方式，就是使用预编译语句，绑定变量
- 尽量避免在存储过程内使用动态的SQL语句
- 检查输入数据的数据类型，在很大程度上可对抗SQL注入
- 对抗代码注入、命令注入时，需要禁用eval()、system()等可以执行命令的函数。如果一定要使用这些函数，则需要对用户的输入数据进行处理。
- 对抗CRLF的方法非常简单，只需要处理好"\r"、"\n"这两个保留字符即可，尤其是那些使用"换行符"作为分隔符的应用

#### 文件上传漏洞
文件上传漏洞是指用户上传了一个可执行的脚本文件，并通过此脚本文件获得了执行服务器端命令的能力

文件上传导致的常见安全问题一般有:
- 上传文件是Web脚本语言，服务器的Web容器解释并执行了用户上传的脚本，导致代码执行
- 上传文件是Flash的策略文件crossdomain.xml，黑客可以控制Flash在该域下的行为(其他通过类似方式控制策略文件的情况类似)
- 上传文件是病毒、木马文件，黑客用以诱骗用户或者管理员下载执行
- 上传文件是钓鱼图片或者包含了脚本的图片，在某些版本的浏览器中会被作为脚本执行，被用于钓鱼和欺诈

##### webshell
要完成webshell攻击，要满足如下几个条件:
- 首先，上传的文件能够被Web容器解释执行。所以文件上传后所在的目录要是Web容器所覆盖到的路径
- 其次，用户能够从web上访问这个文件。如果文件上传了，但用户无法通过Web访问，或者无法使得Web容器解释这个脚本，那么也不能称之为漏洞
- 最后，用户上传的文件若被安全检查、格式化、图片压缩等功能改变了内容，则也可以导致攻击不成功

防御手段:
- 文件上传的目录设置为不可执行
- 判断文件类型
- 使用随机数改写文件名和文件路径
- 单独设置文件服务器的域名

#### 认证与会话管理
认证实际上就是一个验证凭证的过程。认证的目的是为了认出用户是谁，而授权的目的是为了决定用户能够做什么

##### 1、密码认证
密码必须以不可逆的加密算法，或者是单向散列函数算法，加密后存储在数据库中。

目前黑客们广泛使用的一种破解MD5加密后密码的方法是"彩虹表(Rainbow Table)"

彩虹表的思路是收集尽可能多的密码明文和明文对应的MD5值。这样只需要查询MD5值，就能找到该MD5值对应的明文。

通过加盐可以有效对抗彩虹表。在计算密码明文的哈希值时，添加一个"salt"。"salt"是一个字符串，它的作用是为了增加明文的复杂度，并使得彩虹表一类的攻击失效

##### 2、多因素认证
多因素认证提高了攻击的门槛。比如一个支付交易使用了密码与数字证书双因素认证，成功完成该交易必须满足两个条件: 一是密码正确; 二是进行支持的电脑必须安装了该用户的数字证书。因此，为了成功实施攻击，黑客们除了盗取用户密码外，还不得不想办法在用户电脑上完成支付，这样就大大提高了攻击的成本。

##### 3、Session与认证
Session劫持是一种通过窃取用户SessionID后，使用该SessionID登录进目标帐户的攻击方法，此时攻击者实际上是使用了目标帐户的有效Session。如果SessionID是保存在Cookie中的，则这种攻击可以称为Cookie劫持。

Cookie泄露的途径:
- XSS(Cross-Site Scripting跨站脚本)攻击: 通过给Cookie标记HttpOnly(设置HttpOnly标记为true的cookie只能通过服务器端修改，js无法操作[读取会跳过])，可以有效缓解XSS窃取Cookie的问题。
- 网络嗅探
- 本地木马窃取

##### 4、Session Fixation(会话固定)攻击
在用户登录网站过程中，如果登录前后用户的SessionID没有发生变化，则会存在Session Fixation问题

具体攻击的过程是，用户X(攻击者)先获取到一个未经认证的SessionID，然后将这个SessionID交给用户Y去认证，Y完成认证后，服务器并未更新此SessionID的值(注意是未改变SessionID，而不是未改变Session)，所以X可以直接凭借此SessionID登录进Y的帐户

X如何才能让Y使用这个SessionID呢？如果SessionID保存在Cookie中，比较难做到这一点。但若是SessionID保存在URL中，则X只需要诱使Y打开认证URL即可。

解决Session Fixation的正确做法是，在登录完成后，重写SessionID。


#### Web框架安全
##### XSS
XSS攻击是在用户的浏览器上执行的，其形成过程则是在服务器端页面渲染时，注入了恶意的HTML代码导致的。从MVC架构来说，是发生在View层，因此使用"输出编码"的防御方法更加合理，这意味着需要针对不同上下文的XSS攻击场景，使用不同的编码方式。

类型:
- 反射型XSS: 通过url(如搜索参数)将脚本由后台透传到页面
- 存储型XSS: 通过聊天/博客等将脚本存储到目标服务器
- 基于DOM的XSS: 纯前端

"输出编码"的防御方法总结为以下几种:
- 在HTML标签中输出变量
- 在HTML属性中输出变量
- 在script标签中输出变量
- 在事件中输出变量
- 在CSS中输出变量
- 在URL中输出变量

针对以上不同情况，使用不同的编码函数(即对数据进行预处理，过滤关键字符再输出使用)。

##### CSRF(Cross-site request forgery跨站请求伪造)防御
在完整的CSRF防御方案，对于Web框架来主有以下几个地方需要改动。
- 在Session中绑定token。如果不能保存到服务端Session中，则可以替代为保存到Cookie里
- 在from表单中自动填入token字段，比如<input type=hidden name="anti_csrf_token" value="$token" />
- 在Ajax请求中自动添加token，这可能需要已有的Ajax封装实现的支持
- 在服务端对比POST提交参数的token与Session中绑定的token是否一致，以验证CSRF攻击

##### HTTP Headers管理
- 防御CRLF注入: 对抗CRLF的方案只需要"value"中编码所有的\r\n即可
- Location跳转: 对于框架来主，管理好跳转目的地址是很有必要的。一般来说，可以在两个地方做这件事件:
  - 如果Web框架提供统一的跳转函数，则可以在跳转函数内部实现一个白名单，指定跳转地址只能在白名单中
  - 另一种解决方案是控制HTTP的Location字段，限制Location的值只能是哪些地址，本质还是白名单
- 防御ClickJacking(点击劫持，视觉欺骗引导用户点击): 对抗ClickJacking的X-Frame-Options，需要在页面的HTTP Response中添加。该HTTP头有三个可选值:
  - DENY: 拒绝任何域加载。浏览器会拒绝当前页面加载任何frame页面
  - SAMEORIGIN: 允许同源域下加载。frame页面的地址只能加载同源下的页面
  - ALLOW-FROM: 可以定义允许frame加载的页面地址

#### 内容安全策略(CSP)
CSP实质是白名单制度，开发者明确告诉客户端，哪些外部资源可以加载和执行，等同于提供白名单。它的实现和执行全部由浏览器完成。

两种方式可以启用CSP。一种是通过HTTP头信息的**Content-Security-Policy**字段
```javascript
content-security-policy: script-src 'self'; object-src 'none'; style-src cdn.example.org third-party.org; child-src https:
```
另一种是通过网页的**<meta>**标签
```html
<meta http-equiv="Content-Security-Policy" content="script-src 'self'; object-src 'none'; style-src cdn.example.org third-party.org; child-src https:">
```
上面代码中，CSP做了如下配置：
- 脚本: 只信任当前域名
- <object>标签: 不信任任何URL，即不加载任何资源
- 样式表: 只信任cdn.example.org和third-party.org
- 框架(frame): 必须使用https协议加载
- 其他资源: 没有限制
启用后，不符合CSP的外部资源就会被阻止加载。资源加载限制选项:
- script-src: 外部脚本
- style-src: 样式表
- img-src: 图像
- media-src: 媒体文件(音频和视频)
- font-src: 字体文件
- object-src: 插件(比如Flash)
- child-src: 框架
- frame-ancestors: 嵌入的外部资源(比如<frame>、<iframe>、<embed>和<applet>)
- connect-src: HTTP连接(通过XHR、WebSockets、EventSource等)
- worker-src: worker脚本
- manifest-src: manifest 文件
- default-src: 上面各个选项的默认值
URL限制:
- frame-ancestors: 限制嵌入框架的网页
- base-uri: 限制<base#href>
- form-action: 限制<form#action>
其他限制:
- block-all-mixed-content: HTTPS网页不得加载HTTP资源(浏览器已经默认开启)
- upgrade-insecure-requests: 自动将网页上所有加载外部资源的HTTP链接换成HTTPS协议
- plugin-types: 限制可以使用的插件格式
- sandbox: 浏览器行为的限制，比如不能有弹出窗口等
report-uri:
用于记录XSS行为。report-uri用来告诉浏览器，应该把注入行为报告给哪个网址
```
Content-Security-Policy: default-src 'self'; ...; report-uri /my_csp_report_parser;
```
选项值:
- 主机名: example.org, https://example.com:443
- 路径名: example.org/resources.js/
- 通配符: *.example.org, *.//*.example.com:* (表示任意协议、任意子域名、任意端口)
- 协议名: https:、data:
- 关键字'self': 当前域名，需要加引号
- 关键字'none': 禁止加载任何外部资源，需要加引号
> 如果同一个限制选项使用多次，只有第一次会生效
script-src还支持一些特殊值(都需要放在单引号里):
- 'unsafe-inline': 允许执行页面内嵌的<script>标签和事件监听函数
- 'unsafe-eval': 允许将字符串当作代码执行，比如使用eval、setTimeout、setInterval和Function等函数。
- nonce值: 每次HTTP回应给出一个授权token,页面内嵌脚本必须有这个token，才会执行
- hash值: 列出允许执行的脚本代码的Hash值(计算hash值时，<script>标签不算在内)，页面内嵌脚本的哈希值只有吻合的情况下，才能执行
例:
```javascript
<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-EDNnf03nceIOfn39fn3e9h3sdfa'">
// 必段有token才能执行
<script nonce
```
注意
> script-src和object-src是必设的，除非设置了default-src
> script-src不能使用unsafe-inline关键字(除非伴随一个nonce值), 也不能允许设置 data:URL
> 必须特别注意JSONP的回调函数