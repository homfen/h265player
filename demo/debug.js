import h265player from "../src/index";
import Events from "../src/config/EventsConfig";

const el = document.querySelector(".play-container");
const padding = 40;
const wWidth = window.innerWidth - padding;
el.style.width = wWidth + "px";
el.style.height = wWidth / 2 + "px";
const href = window.location.href;
const libPath = href.slice(0, href.lastIndexOf("/") + 1) + "lib/";
const urlPrefix = location.href.slice(
  0,
  location.href.lastIndexOf(location.pathname)
);
const src1 = urlPrefix + "/data/video2/video.m3u8";
// const src1 =
// "https://play.mms.cainiao.com/DingPei/live_STREAM_MAIN_24581642850820.m3u8?aliyun_uuid=442991077098708992-0";

let player = null;
// let live = true;
let live = false;
let src = src1;
let h265 = true;

const currentFrame = document.querySelector("#currentFrame");
function setFrame(nextTime) {
  const fps = player.imagePlayer.imageData.fps;
  const frame = Math.trunc((nextTime / 1000) * fps);
  currentFrame.innerHTML = frame;
}

const timeupdate = () => {
  if (!player) return;

  const currentTime = player.currentTime;
  setFrame(currentTime);
};

const createPlayer = (src, isLive) => {
  if (player) {
    player.events.off(Events.ImagePlayerRenderEnd, timeupdate);
    player.destroy();
  }
  player = new h265player(el, {
    sourceURL: src,
    type: "HLS",
    muted: false,
    isLive,
    libPath,
    playBackRate: 1,
    controlBar: true,
    autoPlay: false,
    autoScale: true,
    defaultAlert: true,
    keepCache: false
  });
  window.player = player;
  player.events.on(Events.ImagePlayerRenderEnd, timeupdate);
};

(function () {
  createPlayer(src1, live);
  let seekInput = document.querySelector("#seekValue");
  let seekButton = document.querySelector("#seekBtn");
  seekButton.onclick = function () {
    const value = seekInput.value;
    player && player.seek(value * 1000);
  };
  let srcInput = document.querySelector("#srcValue");
  let srcButton = document.querySelector("#srcBtn");
  srcButton.onclick = function () {
    const value = srcInput.value;
    src = value;
    createPlayer(src, live, h265);
  };

  let isLive = document.querySelector("#isLive");
  isLive.onclick = function (e) {
    live = e.target.checked;
    createPlayer(src, live, h265);
  };

  const prevFrame = document.querySelector("#prevFrame");
  const nextFrame = document.querySelector("#nextFrame");
  prevFrame.onclick = () => {
    const fps = player.imagePlayer.imageData.fps;
    const step = 1000 / fps;
    const currentTime = player.currentTime;
    const nextTime = currentTime - step < 0 ? 0 : currentTime - step;
    player.seek(nextTime);
    setFrame(nextTime);
  };
  nextFrame.onclick = () => {
    const fps = player.imagePlayer.imageData.fps;
    const step = 1000 / fps;
    const currentTime = player.currentTime;
    const duration = player.duration * 1000;
    const nextTime =
      currentTime + step > duration ? duration : currentTime + step;
    player.seek(nextTime);
    setFrame(nextTime);
  };

  const fullScreen = document.querySelector("#fullScreen");
  const exitFullScreen = document.querySelector("#exitFullScreen");
  fullScreen.onclick = () => {
    player.fullScreen();
  };
  exitFullScreen.onclick = () => {
    player.exitFullScreen();
  };

  window.onresize = () => {
    const wWidth = window.innerWidth - padding;
    el.style.width = wWidth + "px";
    el.style.height = wWidth / 2 + "px";
    player.resize(wWidth, wWidth / 2);
  };
})();
