
## 视频处理

#### FFmpeg视频压缩的几个关键参数

常用参数:

- 文件路径: -i 输入文件的路径
- 码率: -b:v 输出文件的码率
- 分辨率: -s 输出文件的分辨率
- 帧率: -r 输出文件的帧率值

示例:
```Shell
ffmpeg.exe -i test.MP4 -b 600k output.mp4
```

#### 视频合并

这种方法成功率很高，也是最好的，但是需要 FFmpeg 1.1 以上版本。先创建一个文本文件 filelist.txt：
```Shell
file 'input1.mkv'
file 'input2.mkv'
file 'input3.mkv'
```
然后：
```Shell
ffmpeg -f concat -i filelist.txt -c copy output.mkv
```

#### FFmpeg视频截取
```Shellss
ffmpeg -ss 00:00:00 -t 00:00:30 -i test.mp4 -vcodec copy -acodec copy output.mp4
#-ss - 指定从什么时间开始
#-t - 指定要截取多长时间
```

#### 从视频中提取音频
```Shell
ffmpeg -i video.mp4 -ss 00:00:10 -t 00:00:30  -vn output.mp3

#-ss - 指定从什么时间开始
#-t - 指定要截取多长时间
#-vn – 表明我们已经在输出文件中禁用视频录制。
#-ar – 设置输出文件的音频频率。通常使用的值是22050 Hz、44100 Hz、48000 Hz。
#-ac – 设置音频通道的数目。
#-ab – 表明音频比特率。
#-f – 输出文件格式。在我们的实例中，它是 mp3 格式。
```

#### 将音频混入视频
```Shell
ffmpeg -i a.mp4 -i b.aac -c:v copy -map 0:v:0
 -filter_complex "[0:a][1:a]amerge=inputs=2[aout]" -map "[aout]" -ac 2 c.mp4
```

#### 音频混合
```Shell
ffmpeg -y  -i input1.wav  -i input2.wav -filter_complex
 amix=inputs=2:duration=first:dropout_transition=4  output.wav

#- amix=inputs=输入的音频个数，默认是2；
#- duration=音频周期时常，默认是最长的；
```
大多数的时候，音频混合还会涉及到某个音频需要延迟，例如需要混音的第二个音频要在第一个音频的第五秒才开始播放，这就要使用ffmpeg的-itsoffset命令：
```Shell
ffmpeg -y  -i  input1.wav -itsoffset 5-i input2.wav
 -filter_complex amix=inputs=2:duration=first:dropout_transition=4 -async 1  output.wav    

#-itsoffset  offset ： 延迟时间offset秒；

#注意：一定要在音频输出之前加上 -async 1 命令，否则 -itsoffset 命令失效。
```


#### 更改视频分辨率
 更改视频分辨率
```Shell
ffmpeg -i video.mp4 -filter:v scale=1280:720 -c:a copy output.mp4
```
或
```Shell
ffmpeg -i video.mp4 -s 1280x720 -c:a copy output:mp4
```

#### 压缩视频文件
> 压缩视频文件
```Shell
ffmpeg -i input.mp4 -vf scale=1280:-1 -c:v libx264 -preset veryslow -crf 24 output.mp4
```
请注意，如果你尝试减小视频文件的大小，你将损失视频质量。如果 24 太有侵略性，你可以降低 -crf 值到或更低值。

你也可以通过下面的选项来转换编码音频降低比特率，使其有立体声感，从而减小大小。
```Shell
-ac 2 -c:a aac -strict -2 -b:a 128k
```

### 从视频文件中移除音频流
```Shell
ffmpeg -i video.mp4 -an outpu.mp4
```
这里 -an 表示没有音频录制