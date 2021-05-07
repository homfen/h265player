## h265player

[online demo]()

#### Usage：

```
import h265player from "h265player";
import Events from "h265player/dist/events";

const el = document.querySelector(".play-container");
const src = "https://homfen.github.io/h265player/data/video2/video.m3u8";
const libPath = "https://homfen.github.io/h265player/lib/";
const player = new h265player(el, {
  sourceURL: src,
  type: "HLS",
  isLive: false,
  libPath,
  playBackRate: 1,
  muted: false,
  controlBar: true,
  maxBufferLength: 6000,
  autoPlay: false,
  autoScale: true,
  defaultAlert: false
});
const timeupdate = () => {
  if (!player) return;

  const currentTime = player.currentTime;
  console.log(currentTime);
};
player.events.on(Events.ImagePlayerRenderEnd, timeupdate);
```

#### API:

###### play

播放

```
player.play();
```

###### pause

暂停

```
player.pause();
```

###### seek

跳转，ms

```
player.seek(10 * 1000);
```

###### changeSpeed

修改倍速

```
player.changeSpeed({value: 0.5});
```

###### changeSrc

切换视频地址

```
player.changeSrc(url);
```

###### resize

改变播放器大小

```
player.resize(width, height);
```

###### fullScreen

全屏

```
player.fullScreen();
```

###### exitFullScreen

退出全屏

```
player.exitFullScreen();
```

###### on

绑定事件，只适用 Events 中的 Player 事件

```
player.on('onPlay', () => {
  console.log('play');
});
```

###### off

解绑事件，只适用 Events 中的 Player 事件

```
const callback = () => {};
player.off('onPlay', callback);
```

###### buffer

获取已缓存范围，ms

```
console.log(player.buffer());
```

###### destroy

销毁

```
player.destroy();
```

#### Events:

```
const Events = {
  ProcessorResetEnd: "DataProcessorController.processorResetEnd",
  DataProcessorReady: "DataProcessorController.dataProcessorReady",
  // DecodeResetEnd: 'DecodeController.resetEnd',
  DecodeStartDecode: "DecodeController.startDecode",
  DecodeFlush: "DecodeController.flush",
  DecodeDecoded: "DecodeController.decoded",
  DecodeApppendEnd: "DecodeController.appendEnd",
  DecodeFlushEnd: "DecodeController.flushEnd",
  DecodeReady: "DecodeController.ready",

  DemuxResetEnd: "DemuxController.resetEnd",
  DemuxStartDemux: "DemuxController.startDemux",
  DemuxLast: "DemuxController.last",
  DemuxVideo: "DemuxController.video",
  DemuxAAC: "DemuxController.AAC",
  DemuxReady: "DemuxController.ready",
  DemuxCodecError: "DemuxController.codecError",

  ImagePlayerRenderEnd: "ImagePlayer.renderEnd",
  ImagePlayerWait: "ImagePlayer.wait",
  ImagePlayerReady: "ImagePlayer.ready",
  ImagePlayerEnd: "ImagePlayer.end",
  ImagePlayerBuffeUpdate: "ImagePlayer.bufferUpdate",
  ImagePlayerSwitchPool: "ImagePlayer.switchPool",

  ControlBarPlay: "ControlBar.onPlay",
  ControlBarPause: "ControlBar.onPause",
  ControlBarPauseLoading: "ControlBar.onPauseLoading",

  LoadDataReadBufferByNo: "LoadData.readBufferByNo",
  LoadDataReadBuffer: "LoadData.readBuffer",
  LoadDataRead: "LoadData.onRead",
  LoadDataSeek: "LoadData.onSeek",
  LoadDataFirstLoaded: "LoadData.onFirstLoaded",

  LoaderPlayListStart: "Loader.playlistStart",
  LoaderLoading: "Loader.onLoading",
  LoaderError: "Loader.onError",
  LoaderLoaded: "Loader.onLoaded",
  LoaderUpdateSpeed: "Loader.updateSpeed",
  LoaderLoadFile: "Loader.loadFile",
  LoaderPlayListLoaded: "Loader.playlistLoaded",

  AudioPlayerReady: "AudioPlayer.MSEReady",
  AudioPlayerDataReady: "AudioPlayer.dataReady",
  AudioPlayerWait: "AudioPlayer.wait",
  AudioPlayerEnd: "AudioPlayer.end",
  AudioPlayerPlaySuccess: "AudioPlayer.playSuccess",
  AudioPlayerPlayFail: "AudioPlayer.playFail",

  PlayerMaxPTS: "DemuxController.maxpts",
  PlayerSeekEnd: "Player.seekend",
  PlayerSpeedTo: "Player.speedTo",
  PlayerChangeRate: "Player.changeRate",
  PlayerChangeSrc: "Player.changeSrc",
  PlayerPlaying: "Player.playing",
  PlayerTimeUpdate: "Player.timeUpdate",
  PlayerbufferUpdate: "Player.bufferupdate",
  PlayerResetReady: "Player.resetReady",
  PlayerWait: "Player.wait",
  PlayerLoadNext: "Player.loadNext",
  PlayerOnPlay: "Player.onPlay",
  PlayerOnPause: "Player.onPause",
  PlayerOnSeek: "Player.onSeek",
  PlayerOnVolume: "Player.onVolume",
  PlayerReady: "Player.ready",
  /**
   * Event handling during player playing
   * @event Player#play
   * @type {Player}
   *
   */
  PlayerPlay: "Player.play",
  PlayerReset: "Player.reset",
  PlayerLoadedMetaData: "Player.loadedMetaData",
  /**
   * Event handling after playing ends
   * @event Player#end
   * @type {Player}
   *
   */
  PlayerEnd: "Player.end",
  /**
   * Event handling when playing pauses
   * @event Player#pause
   * @type {Player}
   *
   */
  PlayerPause: "Player.pause",
  /**
   * Event handling when player seeking data
   * @event Player#seeking
   * @type {Player}
   *
   */
  PlayerSeeking: "Player.seeking",
  PlayerAlert: "Player.alert",
  PlayerThrowError: "Player.throwError",

  StreamDataReady: "StreamController.dataReady"
};
```
