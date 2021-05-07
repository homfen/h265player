/**
 * Copyright (C) 2019.
 * All Rights Reserved.
 * @file HLSLoader
 * @desc
 * hls load module
 * @author Jarry
 */

import { BUFFER } from "../config/Config";
import BaseLoader from "./BaseLoader";
import { state } from "../config/LoaderConfig";
import { M3U8Parser } from "../toolkit/M3U8Parser";
import SegmentPool from "../data/SegmentPool";
import SegmentModel from "../model/SegmentModel";
import Events from "../config/EventsConfig";
import Utils from "../utils/Utils";
import { Parser } from "m3u8-parser";

let timer = null;

class HLSLoader extends BaseLoader {
  state = state.IDLE;

  maxBufferDuration = BUFFER.maxDuration;
  maxBufferSize = BUFFER.maxSize;
  baseUrl = "";

  options = null;
  httpWorker = null;
  sourceData = null;
  // segmentPool should be immutability
  segmentPool = [
    /* new SegmentModel */
  ];

  currentNo = null;
  maxRetryCount = BUFFER.maxRetryCount;

  constructor(options) {
    super();
    this.options = options;
    this.player = options.player;
    this.loaderController = this.options.loaderController;
    this.dataController = this.loaderController.dataController;
    this.httpWorker = options.httpWorker;
    this.setSegmentPool(new SegmentPool());
    this.liveRetry = 0;
    clearInterval(timer);
    timer = null;
  }

  loadPlaylist(callback) {
    if (this.isNotFree()) {
      this.logger.info("loadPlaylist", "not free.");
      if (!this.player.options.isLive) {
        setTimeout(() => {
          this.loadPlaylist(callback);
        }, 200);
      }
      return;
    }
    if (this.player.options.beforeLoad) {
      this.player.options
        .beforeLoad(this.sourceURL, this.options.sourceURL)
        .then((url) => {
          this.options.sourceURL = url;
          this.state = state.LOADING;
          this.httpWorker.postMessage({
            type: "invoke",
            fileType: "m3u8",
            method: "get",
            name: "playlist",
            url
          });
        });
    } else {
      this.state = state.LOADING;
      this.httpWorker.postMessage({
        type: "invoke",
        fileType: "m3u8",
        method: "get",
        name: "playlist",
        url: this.sourceURL
      });
    }
    this.httpWorker.onmessage = (event) => {
      this.state = state.IDLE;
      const data = event.data;
      const body = event.data.data;
      if (!body) {
        if (this.player.options.isLive) {
          const content = "暂无直播";
          this.events.emit(Events.PlayerAlert, content);
        } else {
          const content = `Get the ${data.fileType} file error. URL: ${data.url}`;
          this.events.emit(Events.PlayerAlert, content);
          this.events.emit(Events.LoaderError, content, data);
          const errors = [
            this.state,
            "request playlist error.",
            "data:",
            data,
            content
          ];
          this.events.emit(Events.PlayerThrowError, errors);
        }
        return;
      }
      if (data.name == "playlist") {
        this.parsePlaylist(body, callback);
      }
    };
  }

  parsePlaylist(source, callback) {
    const parser = new Parser();
    parser.push(source);
    parser.end();
    const manifest = parser.manifest;
    // console.log("manifest", manifest);
    const levelLen = manifest.playlists?.length;
    if (levelLen) {
      const level = manifest.playlists[levelLen - 1];
      this.sourceURL = level.uri;
      // console.log("levelUrl", this.sourceURL);
      this.loadPlaylist(callback);
      return;
    }

    const data = new M3U8Parser(source);
    if (!data.segments || !data.segments.length) {
      this.events.emit(Events.LoaderError, data);
      this.events.emit(Events.PlayerAlert, "Parse playlist file error.");
      const errors = [this.state, "Parse playlist error.", "data:", data];
      this.events.emit(Events.PlayerThrowError, errors);
      return;
    }
    let segments = data.segments;
    segments.forEach((item) => {
      item.start = Utils.msec2sec(item.start);
      item.end = Utils.msec2sec(item.end);
      item.duration = Utils.msec2sec(item.duration);
    });
    // 处理discontinuity的情况
    if (this.player.options.isLive) {
      if (this.segmentPool.length) {
        const names = this.segmentPool.map((item) => item.name);
        data.segments = data.segments.filter(
          (item) => names.indexOf(item.name) === -1
        );
        if (data.segments.length) {
          const last = this.segmentPool.getLast();
          const lastNo = last.no;
          const lastEnd = last.end;
          data.segments.forEach((item, idx) => {
            item.no = idx + lastNo + 1;
            if (idx === 0) {
              item.start = lastEnd;
            } else {
              item.start = data.segments[idx - 1].end;
            }
            item.end = item.start + item.duration;
          });
          // this.events.emit(Events.ControlBarPlay, this);
          this.liveRetry = 0;
        } else {
          this.liveRetry++;
        }
      }
      if (!timer) {
        timer = setInterval(() => {
          if (this.liveRetry < 15) {
            if (
              !this.isNotFree() &&
              !this.player.seeking &&
              !this.player.reseting
            ) {
              this.player.loaderController.loadPlaylist();
            }
          } else {
            clearInterval(timer);
            timer = null;
            this.liveRetry = 0;
          }
        }, 1000);
      }
    } else if (manifest.discontinuityStarts.length) {
      const starts = manifest.discontinuityStarts.filter(
        (item, idx, arr) => !arr[idx - 1] || arr[idx - 1] != item - 1
      );
      const preds = starts.map((v, i) => {
        let start = starts[i - 1];
        if (i === 0) {
          start = 0;
        }
        return segments.slice(start, v).reduce((a, b) => a + b.duration, 0);
      });
      preds.unshift(0);
      for (let i = 0; i < preds.length; i++) {
        preds[i] += preds[i - 1] || 0;
      }
      let idx = 0;
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const start = starts[idx];
        if (start == null) {
          segment.pred = preds[preds.length - 1];
        } else if (i < start) {
          segment.pred = preds[idx];
        } else if (i === start) {
          idx += 1;
          segment.pred = preds[idx];
        }
      }
    }
    // console.log("segments", this.options.sourceURL, segments);
    // const listUrl = this.options.sourceURL;
    // const prefix = listUrl.slice(0, listUrl.lastIndexOf("/") + 1);
    // const list = segments.slice();
    // const download = () => {
    // if (!list.length) return;
    // const segment = list.shift();
    // const url = prefix + segment.file;
    // window.open(url, "_blank");
    // setTimeout(download, 1000);
    // };
    // download();
    this.setSourceData(Object.freeze(data));
    this.segmentPool.addAll(data.segments);
    if (data.segments.length) {
      callback.call(this, data);
      if (this.player.options.isLive) {
        const imagePlayer = this.player.imagePlayer;
        const imageData = imagePlayer.imageData;
        if (
          imagePlayer.status !== "play" &&
          imagePlayer.status !== "ready" &&
          imageData.offset != null
        ) {
          const last = this.segmentPool.getLast();
          this.logger.info("imagePlayer end replay", this.player.currentTime);
          this.player.seek(last.start * 1000);
          setTimeout(() => {
            if (this.player.paused) {
              this.player.play();
            }
          }, 1000);
        }
      }
    }
  }

  setSourceData(sourceData) {
    this.sourceData = sourceData;
  }

  getSourceData() {
    return this.sourceData;
  }

  setSegmentPool(segmentPool) {
    this.segmentPool = segmentPool;
  }

  getSegmentPool() {
    return this.segmentPool;
  }

  isNotFree(notice = "") {
    notice = "[" + notice + "]loader is not free. please wait.";
    if (this.state !== state.IDLE && this.state !== state.DONE) {
      this.logger.warn(
        "isNotFree",
        "check status for loader",
        "notice:",
        notice
      );
      return true;
    }
    return false;
  }

  getBaseUrl(file) {
    const sourceURL = this.options.sourceURL;
    const isAbsolute = file.indexOf("//") > -1;
    if (!isAbsolute) {
      const lastSlash = sourceURL.lastIndexOf("/");
      return sourceURL.substr(0, lastSlash + 1);
    }
    return "";
  }

  checkLoadCondition(segment) {
    if (this.player.options.keepCache) {
      return true;
    }
    // over the pool range
    if (segment.no > this.segmentPool.length) {
      return false;
    }
    // max duration limit
    const bufferDuration = this.dataController.getLoadDataBufferPool()
      .bufferDuration;
    const maxBufferDuration = this.maxBufferDuration * this.player.playbackRate;
    if (bufferDuration > maxBufferDuration) {
      this.logger.info(
        "checkLoadCondition",
        "stop load next segment.",
        "bufferDuration:",
        bufferDuration,
        "maxBufferDuration:",
        this.maxBufferDuration
      );
      return false;
    }
    return true;
  }

  /**
   * load ts file by segment
   * @param {Segment} segment
   * @param {String} type [optional] 'seek' or 'play'
   * @param {Number} time [optional] millisecond
   */
  loadFile(segment, type, time) {
    if (!(segment instanceof SegmentModel)) {
      return;
    }

    // only single load process
    if (this.isNotFree() && type !== "seek" && type !== "start") {
      this.logger.warn(
        "loadFile",
        "is loading",
        "segment:",
        segment,
        "type:",
        type
      );
      setTimeout(() => {
        this.loadFile(segment, type, time);
      }, 200);
      return;
    }

    if (!this.checkLoadCondition(segment)) {
      // this.state = state.IDLE;
      this.logger.warn(
        "loadFile",
        "checkLoadCondition failed",
        "segment:",
        segment,
        "type:",
        type
      );
      return;
    }

    this.currentNo = segment.no;

    const baseUrl = this.getBaseUrl(segment.file);
    let url = baseUrl + segment.file;
    let retryCount = 1;

    const _getRequestURL = (url, segment) => {
      if (typeof this.options.processURL == "function") {
        return this.options.processURL(url, segment);
      }
      return url;
    };

    const _send = (segment) => {
      if (this.player.options.beforeLoad) {
        this.player.options
          .beforeLoad(segment.file, this.options.sourceURL)
          .then((url) => {
            this.httpWorker.postMessage({
              type: "invoke",
              fileType: "ts",
              method: "get",
              name: segment.no,
              url
            });
          });
      } else {
        const _url = _getRequestURL(url, segment);
        this.httpWorker.postMessage({
          type: "invoke",
          fileType: "ts",
          method: "get",
          name: segment.no,
          url: _url
        });
      }
    };

    this.state = state.LOADING;
    this.events.emit(Events.LoaderLoading, segment, type, time);
    this.httpWorker.onmessage = (event) => {
      const data = event.data;
      if (data.type === "invoke") {
        this.state = state.DONE;
        this.logger.info(
          "loadfile",
          "httpWorker",
          "onmessage get data",
          data.name
        );
      }
      if (!data || data.type === "error") {
        this.state = state.ERROR;
        if (retryCount <= this.maxRetryCount) {
          this.logger.warn(
            "loadFile",
            "retry to load",
            "count:",
            retryCount,
            "segment:",
            segment
          );
          _send();
          retryCount += 1;
        } else {
          if (this.player.options.isLive) {
            this.state = state.IDLE;
            const content = "获取直播流数据错误";
            this.events.emit(Events.PlayerAlert, content);
          } else {
            this.events.emit(Events.LoaderError, segment, type, time);
            const content = "Load file error, please concat administrator.";
            this.events.emit(Events.PlayerAlert, content);
            const errors = [
              this.state,
              "Load File error.",
              "load count:",
              retryCount,
              "segment:",
              segment
            ];
            this.events.emit(Events.PlayerThrowError, errors);
          }
        }
      } else if (data.type === "notice") {
        if (data.noticeType === "speed") {
          this.events.emit(Events.LoaderUpdateSpeed, data.data);
        }
      } else if (data.fileType === "ts" && data.name === segment.no) {
        segment.loaded = true;
        this.logger.info("loadFile", "read success", "data no:", data.name);
        this.state = state.IDLE;
        this.events.emit(Events.LoaderLoaded, data, segment, type, time);
      } else {
        this.logger.warn(
          "loadFile",
          "is not ts file or the segment'no is not equal.",
          "fileType:",
          data.fileType,
          segment.no,
          "data:",
          data
        );
      }
    };
    _send(segment);
  }
  destroy() {
    if (this.httpWorker) {
      this.httpWorker.terminate();
    }
  }
}

export default HLSLoader;
