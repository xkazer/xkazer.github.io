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
#### Android miniSdkVersion大于或等于23时，应用找不到so文件

在应用AndroidManifest文件application标签增加android:extractNativeLibs="true"，即可解决问题

如果extractNativeLibs为false时，应用的so文件不解压而且页面对齐；如果设置为true时，系统安装服务会把so文件解压到系统目录。extractNativeLibs默认值是true，但是在使用Android Gradle plugin 3.6.0 及以上，没有配置extractNativeLibs时，会把此属性重置为false。

由于要动态加载Dex，Dex依赖的so没有解压到/data/app/<packagename>/lib目录下，在加载Dex是指定的libraryPath 没有so文件，所以报找不到so的异常。

#### 在Android Studio 中打开 Profiler 后APP闪退

打开Android Studio 中的 Device File Explorer，找到 /data/local/tmp/perfd 文件夹，删掉就可以了。
