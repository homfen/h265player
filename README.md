Usage：

```
const options = {
  sourceURL: 'xxx.m3u8',
  type: 'HLS',
  libPath,
  codec: 0, // 0: h264, 1: h265
  playBackRate: 1,
  autoPlay: false,
  screenWidth,
  screenHeight,
  needInit: false,
  controlBar: false, // default controlBar
  beforeLoad(url, baseUrl) {
    // before load playlist/segment
    console.log(url, baseUrl);
  },
  onTimeupdate(time) {
    // when time(ms) update
    console.log(time);
  }
};
const player = new Player(videoWrap.current, options);
player.init();
```
