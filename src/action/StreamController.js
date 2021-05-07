/**
 * @copyright: Copyright (C) 2019
 * @desc: the player main stream controller, start demux and decode, load next ts packet
 * @author: liuliguo
 * @file: StreamController.js
 */

import BaseClass from "../base/BaseClass";
import Events from "../config/EventsConfig";

let aacCache = {};
let videoCache = {};
let pushTimer = null;
let videoBuffer = [];

export default class StreamController extends BaseClass {
  currentIndex = null;
  retryTime = 0;
  dataReady = { audioReady: false, imageReady: false };
  hasInit = false;
  loadDataStatus = "loading";
  duration = 0;
  tsNumber = 0;
  constructor(options) {
    super(options);
    this.loadData = options.loadData;
    this.imagePlayer = options.imagePlayer;
    this.audioPlayer = options.audioPlayer;
    this.player = options.player;
    this.keepCache = this.player.options.keepCache;
    this.bindEvent();
  }
  bindEvent() {
    this.events.on(Events.LoadDataRead, (data) => {
      if (!data) return;
      const no = data.no;
      const key = `${this.player.options.sourceURL}-${no}`;
      const aacData = aacCache[key];
      const videoData = aacCache[key];
      // console.log('onRead', data, aacCache, videoCache);
      if (false && aacCache[key] && videoCache[key]) {
        // console.log('decodeFromCache');
        this.readFromCache(aacData, videoData);
      } else {
        this.onRead(data);
      }
    });
    this.events.on(Events.DemuxVideo, (data, isLast) => {
      this.onVideoDemuxed(data, isLast);
    });
    this.events.on(Events.DemuxAAC, (data, no) => {
      // console.log('demuxAAC', data, no);
      this.onAACDemuxed(data, no);
    });
    this.events.on(Events.DecodeDecoded, (data, no, poolIndex) => {
      // console.log('demuxVideo', no);
      this.onDecoded(data, no, poolIndex);
    });
    this.events.on(Events.DecodeApppendEnd, (data) => {
      this.onAppendEnd(data);
    });
    this.events.on(Events.ImagePlayerReady, () => {
      this.logger.info("bindevent", "Events.ImagePlayerReady");
      this.checkDataReady("imageReady");
    });
    this.events.on(Events.AudioPlayerDataReady, () => {
      this.logger.info("bindevent", "Events.AudioPlayerDataReady");
      this.player.receiveAACTime = null;
      this.checkDataReady("audioReady");
    });
    this.events.on(Events.AudioPlayerWait, () => {
      this.dataReady.audioReady = false;
      this.events.emit(Events.PlayerWait, "audioPlayer");
    });
    this.events.on(Events.ImagePlayerWait, () => {
      this.dataReady.imageReady = false;
      this.events.emit(Events.PlayerWait, "imagePlayer");
    });
    this.events.on(Events.ImagePlayerEnd, () => {
      if (this.player.currentTime >= this.player.duration * 1000) {
        this.logger.info("bindevent", "........imageplayer end");
        this.events.emit(Events.PlayerEnd);
      }
    });
    this.events.on(Events.PlayerWait, () => {
      this.logger.warn("player status wait");
      this.player.statusBeforeWait = this.player.status;
      this.player.status = "wait";
      if (this.loadDataStatus === "loadend") {
        this.loadDataStatus = "loading";
        this.loadNext();
      }
    });
    this.events.on(Events.PlayerLoadNext, () => {
      if (this.loadDataStatus === "loadend") {
        this.loadDataStatus = "loading";
        this.loadNext();
      }
    });
    this.events.on(Events.ImagePlayerSwitchPool, (no) => {
      this.startLoad(no);
      // this.currentIndex = no;
    });
    this.events.on(Events.DecodeFlushEnd, (data) => {
      this.logger.info("flushend>>>>>>>>>>>>>>>", data);
      this.imagePlayer.maxPTS = data;
    });
  }
  checkDataReady(type) {
    let dataReady = this.dataReady;
    dataReady[type] = true;
    let keys = Object.keys(dataReady);
    let num = 0;
    for (let i = 0; i < keys.length; i++) {
      if (!dataReady[keys[i]]) {
        break;
      } else {
        num++;
      }
    }
    if (num == keys.length) {
      this.events.emit(Events.StreamDataReady);
    }
  }
  setBaseInfo(info) {
    this.duration = info.duration;
    this.tsNumber = info.tsNumber;
  }
  reset() {
    this.dataReady = { audioReady: false, imageReady: false };
    this.currentIndex = null;
    this.loadDataStatus = "loading";
  }
  startLoad(index) {
    this.logger.info("startLoad", "index:", index);
    this.currentIndex = index;
    this.player.currentIndex = index;
    this.events.emit(Events.LoadDataReadBufferByNo, index);
  }
  loadNext() {
    if (this.player.reseting) {
      this.loadDataStatus = "loadend";
      return;
    }
    if (this.currentIndex >= this.tsNumber) {
      this.logger.info(
        "loadNext",
        "load end",
        "currentIndex",
        this.currentIndex,
        "tsNumber:",
        this.tsNumber
      );
      this.loadDataStatus = "loadend";
      return;
    }
    this.currentIndex += 1;
    this.player.currentIndex = this.currentIndex;
    this.logger.info("loadNext", "load next ts", "tsno:", this.currentIndex);
    this.events.emit(Events.LoadDataReadBufferByNo, this.currentIndex);
  }
  onDecoded(dataArray, no, poolIndex) {
    // this.logger.info(
    // "StreamController",
    // "onDecoded",
    // "tsno:",
    // no,
    // dataArray.length,
    // poolIndex
    // );
    dataArray.forEach((data) => {
      data.no = no;
      const segment = this.loadData.segmentPool.find((item) => item.no === no);
      if (segment.startVideoPts == null) {
        segment.startVideoPts = data.pts - segment.start * 1000;
      }
      data.pts = data.pts - segment.startVideoPts;
      // console.log("onDecoded", no, data.pts);
      if (data.pts >= this.player.currentTime) {
        this.imagePlayer.push(data, poolIndex);
      } else if (this.keepCache) {
        data.poolIndex = poolIndex;
        videoBuffer.push(data);
        clearTimeout(pushTimer);
        pushTimer = setTimeout(() => {
          while (videoBuffer.length) {
            const data = videoBuffer.shift();
            this.imagePlayer.push(data, data.poolIndex);
          }
        }, 100);
      }
    });
    /*
    const key = `${this.player.options.sourceURL}-${no}`;
    if (!videoCache[key]) {
      videoCache[key] = [];
    }
    videoCache[key] = videoCache[key].concat(dataArray);
    */
  }
  onAppendEnd(data) {
    this.loadDataStatus = "loadend";
    if (data) {
      this.logger.info("onAppendEnd", "events.decodeFlush", data);
      this.events.emit(Events.DecodeFlush);
      return;
    }
    this.logger.info(
      "onAppendEnd",
      "start load next ts condition",
      this.checkBuffer(),
      this.currentIndex
    );
    if (this.checkBuffer() && this.currentIndex !== null) {
      this.logger.info(
        "onAppendEnd",
        "load next ts. currentIndex:",
        this.currentIndex
      );
      this.loadNext();
      return;
    }
    this.logger.info("onAppendEnd", "load ts stop");
    // if (this.player.status === "wait") {
    // this.player.action.seek(
    // this.player.currentTime + (this.player.startPts || 0)
    // );
    // }
  }
  onAACDemuxed(dataArray, no) {
    if (this.player.reseting) {
      return;
    }
    //no audio data
    if (!dataArray.length) {
      this.audioPlayer.send({});
    }
    this.logger.info(
      "StreamController",
      "onAACDemuxed",
      "tsno:",
      no,
      dataArray.length
    );
    dataArray.forEach((data) => {
      const segment = this.loadData.segmentPool.find((item) => item.no === no);
      if (segment.startAudioPts == null) {
        segment.startAudioPts = data.PTS - segment.start * 1000;
      }
      data.PTS = data.PTS - segment.startAudioPts;
      if (data.PTS >= this.player.currentTime || data.audioEnd) {
        if (!this.player.receiveAACTime && this.player.seeking) {
          this.player.receiveAACTime = Date.now();
        }
        this.audioPlayer.send(data);
      }
    });
    /*
    const key = `${this.player.options.sourceURL}-${no}`;
    if (!aacCache[key]) {
      aacCache[key] = [];
    }
    aacCache[key] = aacCache[key].concat(dataArray);
    */
  }
  onVideoDemuxed(data) {
    if (this.player.reseting) {
      return;
    }
    this.events.emit(Events.DecodeStartDecode, data);
  }
  checkBuffer() {
    let player = this.player;
    let time = player.currentTime;
    let buffer = player.buffer();
    let maxTime = buffer[1] || 0;
    let bufferLength = maxTime - time;
    // console.log(
    // "bufferLength",
    // bufferLength,
    // maxTime,
    // time,
    // player.maxBufferLength
    // );
    const maxBufferLength = player.playbackRate * player.maxBufferLength;
    if (bufferLength > 0) {
      if (bufferLength > maxBufferLength) {
        return false;
      } else {
        return true;
      }
    }
    return false;
  }
  onRead(data) {
    if (this.player.reseting) {
      // console.error("onRead reseting");
      return;
    }

    if (
      data &&
      data.arrayBuffer &&
      (data.no === this.currentIndex ||
        this.player.playbackRate > 1 ||
        this.player.options.type === "MP4")
    ) {
      this.retryTime = 0;

      this.logger.warn("onRead", "get stream data", data.no);
      //start demux, get the video and audio
      if (data.no === this.tsNumber && !this.player.options.isLive) {
        //the last one ts packet
        this.logger.info("onRead", "the last ts");
        this.events.emit(Events.DemuxLast);
      }
      this.events.emit(Events.DemuxStartDemux, data);
    } else {
      this.logger.error(
        "onRead",
        "load ts failred",
        "tsno:",
        this.currentIndex
      );
    }
  }
  readFromCache(aacData, videoData) {
    aacData.forEach((data) => {
      if (data.PTS >= this.player.currentTime || data.audioEnd) {
        if (!this.player.receiveAACTime && this.player.seeking) {
          this.player.receiveAACTime = Date.now();
        }
        this.audioPlayer.send(data);
      }
    });
    videoData.forEach((data) => {
      if (this.player.reseting) {
        return;
      }
      if (data.pts >= this.player.currentTime) {
        this.imagePlayer.push(data);
      }
    });
    this.events.emit(Events.DecodeFlush);
  }
}
