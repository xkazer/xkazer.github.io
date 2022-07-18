
## Electron小抄


#### Electron禁用同策略
```JavaScript
app.commandLine.appendSwitch('disable-site-isolation-trials');
```

#### 启用nodejs并关闭安全
```JavaScript
webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
}
```

#### window 7上黑屏
原因: GPU进程崩溃(常见于电脑性能不够好或者是显卡设备出现问题)

解决:
- 方案一:  禁用硬件加速:  app.disableHardwareAcceleration();
- 方案二:  程序启动时，加上参数"--disable-gpu"
- 方案三:  设置程序 Vista 兼容模式


#### node-gyp安装失败
需要使用python 2.7.xx


#### 渲染进程require is not defined
官方为了安全性，将 electron v12.0.0 的 contextIsolation 的默认值改了。所以今后要在渲染进程里调用 require 的话，还需要加上 contextIsolation: false。