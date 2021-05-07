/**
 * @copyright: Copyright (C) 2019
 * @desc: play yuv data
 * @author: liuliguo
 * @file: ImagePlayer.js
 */

let timer = null;

import BaseClass from "../base/BaseClass.js";
import ImageData from "./ImageData.js";
import ImageBfs from "./ImageBfs.js";
import Screen from "./Screen.js";
import { READY } from "../config/Config.js";
import Events from "../config/EventsConfig";

export default class ImagePlayer extends BaseClass {
  status = "pause";
  _currentTime = 0;
  maxPTS = null;
  ready = false;
  firstRender = false;
  constructor(options) {
    super(options);
    this.playHandler = null;
    this.player = options.player;
    this.debug = options.debug || false;
    this.autoScale = this.player.options.autoScale;
    this.keepCache = this.player.options.keepCache;
    this.screen = new Screen({
      player: this.player,
      canvas: options.canvas,
      width: this.player.screenWidth,
      height: this.player.screenHeight,
      autoScale: this.player.options.autoScale
    });
    this.imageData = new (this.keepCache ? ImageBfs : ImageData)({
      events: options.events,
      maxBufferLength: options.maxBufferLength,
      player: options.player
    });
  }
  setScreenRender(canvas) {
    this.screen.setCanvas(canvas);
    this.screen.setRender(canvas);
  }
  clear() {
    this.screen.clear();
  }

  play(time) {
    if (this.status !== "play") {
      this.status = "play";
      this.render(time);
    }
  }

  pause() {
    if (this.status !== "pause") {
      this.status = "pause";
      clearTimeout(this.playHandler);
      this.playHandler = null;
    }
  }
  checkBuffer() {
    return this.imageData.checkBuffer(this.currentTime);
  }
  push(data, poolIndex) {
    // this.logger.info("ImagePlayer push", data.pts, data.duration);
    this.imageData.push(data, poolIndex);
    if (poolIndex !== this.imageData.poolIndex) return;

    let end = this.end;
    let duration = end - this.player.currentTime;
    let minDuration = READY.READYBUFFERLENGTH;
    if (this.player.playbackRate > 1) {
      minDuration *= this.player.playbackRate * 8;
    }
    // console.log('duration', duration, minDuration, this.ready);
    if (duration > minDuration && !this.ready) {
      let success;
      let time;
      // if (this.keepCache) {
      const showTime =
        this.player.currentTime < this.imageData.start
          ? this.imageData.start
          : this.player.currentTime;
      // console.log("render", showTime);
      time = showTime;
      success = this.render(showTime, false);
      // } else {
      // time = this.imageData.start;
      // success = this.render(this.imageData.start, false);
      // }
      if (!this.maxPTS) {
        this.maxPTS =
          this.imageData.offset +
          this.player.duration * 1000 -
          (1000 / this.imageData.fps) * 5;
      }
      if (success) {
        this.ready = true;
        this.status = "ready";
        // clearTimeout(timer);
        // timer = setTimeout(() => {
        this.player.seeking = false;
        this.events.emit(Events.ImagePlayerReady);
        this.events.emit(Events.StreamDataReady);
        this.events.emit(Events.ImagePlayerBuffeUpdate);
        if (this.keepCache) {
          this.imageData.preload(time);
        }
        // }, 200);
      }
    }
  }
  async find(time) {
    const image = await this.imageData.find(time);
    return image;
  }
  buffer() {
    return this.imageData.buffer();
  }
  isBuffered(time) {
    return this.imageData.isBuffered(time);
  }
  async render(time, next = true) {
    if (time < this.imageData.offset) {
      return;
    }
    let image = await this.find(time);
    if (image) {
      this.currentNo = image.no;
      if (!this.firstRender) {
        this.firstRender = true;
        this.events.emit(
          Events.PlayerLoadedMetaData,
          image.width,
          image.height
        );
      }
      // console.log("drawFrame", image.pts);
      this.screen.drawFrame(image);
      this.currentTime = Math.max(image.pts, time);
      if (next) {
        this.events.emit(Events.ImagePlayerRenderEnd, time, image.duration);
      }
      if (this.keepCache) {
        image.buf_y = null;
        image.buf_u = null;
        image.buf_v = null;
      }
      image = null;
      return true;
    } else {
      if (this.maxPTS && time >= this.maxPTS) {
        this.status = "end";
        this.events.emit(Events.ImagePlayerEnd, this.maxPTS);
        return;
      }
      this.logger.warn(
        "Events.ImagePlayerWait",
        time,
        this.start,
        this.end,
        this.imageData.poolIndex
      );
      this.logger.warn("render", "not yuv data");
      this.pause();
      this.status = "wait";
      this.ready = false;
      this.events.emit(Events.ImagePlayerWait, "image", "this");
      if (this.keepCache || time > this.end) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const realTime = time / 1000;
          const { processController, streamController, loadData } = this.player;
          const segment = loadData.getSegmentByTime(realTime);
          if (segment) {
            let no = segment.no;
            this.logger.info("checkDemuxNo", processController.demuxNo, no);
            if (processController.demuxNo === no) {
              no += 1;
            }
            const buffer = loadData.bufferPool.getByKeyValue("no", no)[0];
            if (buffer) {
              this.logger.info("streamController", "startLoad", no);
              streamController.startLoad(no);
            } else {
              this.logger.info("loadData", "loadSegmentByNo", no);
              loadData.loadSegmentByNo(no);
            }
          }
        }, 1000);
      }
      return false;
    }
  }
  reset(time, destroy) {
    this.pause();
    this.status = "pause";
    this.ready = false;
    this.imageData.reset(time, destroy);
    this.maxPTS = null;
    this.currentTime = 0;
  }
  resetScreen() {
    this.player.$canvas.width = this.player.screenWidth;
    this.player.$canvas.height = this.player.screenHeight;
    this.screen = new Screen({
      player: this.player,
      canvas: this.player.$canvas,
      width: this.player.screenWidth,
      height: this.player.screenHeight,
      autoScale: this.player.options.autoScale
    });
    this.render(this.currentTime, false);
  }
  set currentTime(time) {
    this._currentTime = time;
  }
  get currentTime() {
    return this._currentTime;
  }
  get offset() {
    return this.imageData.offset;
  }
  get fragDuration() {
    return Math.ceil(1000 / this.imageData.fps);
  }
  get start() {
    return this.imageData.start;
  }
  get end() {
    return this.imageData.end;
  }
  get duration() {
    return this.imageData.duration;
  }
}
