## Android Studio记录


#### 编译问题排除

##### 依赖库找不到
```Shell
./gradlew build --stacktrack
```

##### Manifest merger failed with multiple errors, see logs
可以使用命令行排查详细错误
```Shell
./gradlew processDebugManifest --stacktrace
```

##### env:bash\r: No such file or directory
执行./gradlew时报此错误时，可修改文件格式
```Shell
vim gradlew
:set fileformat=unix
:wq
```

##### Manifest merger failed : uses-sdk:minSdkVersion 21 cannot be smaller than version 23 declared in library
除升级minSdkVersion外，可在AndroidManifest.xml文件中 标签中添加
```Xml
<uses-sdk tools:overrideLibrary="xxx.xxx.xxx"/>
```
其中的xxx.xxx.xxx为第三方库包名
如果存在多个库有此异常，则用逗号分割它们，例如：
```Xml
<uses-sdk tools:overrideLibrary="xxx.xxx.aaa, xxx.xxx.bbb"/>
```