/**
 * @copyright: Copyright (C) 2019
 * @desc: demux and decode
 * @author: liuliguo
 * @file: dataProcessorController.js
 */
import BaseClass from "../base/BaseClass.js";
import webworkify from "webworkify-webpack";
import Events from "../config/EventsConfig";

let emitTimer = null;

export default class DataProcessorController extends BaseClass {
  isLast = false;
  constructor(options) {
    super(options);
    this.type = options.type;
    this.libPath = options.libPath;
    this.player = options.player;
    this.keepCache = this.player.options.keepCache;
    this.init();
    this.codecError = false;
  }
  init() {
    let type = this.type;
    if (type == "ts") {
      this.initNornalWorker();
    }
    this.bindEvent();
    this.loadjs();
  }
  initNornalWorker() {
    this.processor = this.initWorker();
  }
  initWorker() {
    let processor = webworkify(require.resolve("./dataProcessor.js"));
    processor.onmessage = (event) => {
      if (this.codecError) return;

      let workerData = event.data;
      let type = workerData.type;
      let no = workerData.no;
      let poolIndex = workerData.poolIndex;
      let data = workerData.data;
      // let start = workerData.start;
      // let pts = workerData.pts;
      switch (type) {
        case "dataProcessorReady":
          this.onDataProcessorReady();
          break;
        case "decoded":
          // let end = Date.now();
          // console.log('onDecoded', pts, end - start, start, end);
          this.onDecoded(data, no, poolIndex);
          break;
        case "demuxedAAC":
          this.onDemuxedAAC(data, no);
          break;
        case "partEnd":
          this.onPartEnd(data, no);
          break;
        case "resetEnd":
          this.onResetEnd();
          break;
        case "maxPTS":
          this.onMaxPTS(data);
          break;
        case "flushEnd":
          this.onFlushEnd(data);
          break;
        case "codecError":
          this.onCodecError();
          break;
        default:
          break;
      }
    };
    return processor;
  }
  bindEvent() {
    this.events.on(Events.DemuxStartDemux, this.onStartDemux.bind(this));
    this.events.on(Events.DemuxLast, () => {
      this.isLast = true;
    });
    this.events.on(Events.DecodeFlush, () => {
      this.flush();
    });
  }
  flush() {
    this.processor.postMessage({
      type: "flush",
      sourceType: this.player.options.type
    });
  }
  loadjs() {
    this.processor.postMessage({
      type: "loadwasm",
      libPath: this.libPath,
      codec: this.options.codec,
      sourceType: this.player.options.type
    });
  }
  reset() {
    this.isLast = false;
    this.processor.terminate();
    this.initNornalWorker();
    this.loadjs();
    this.codecError = false;
  }
  onFlushEnd(data) {
    this.events.emit(Events.DecodeFlushEnd, data);
  }
  onMaxPTS(data) {
    this.events.emit(Events.PlayerMaxPTS, data.maxAudioPTS, data.maxVideoPTS);
  }
  onDemuxedAAC(pes, no) {
    this.events.emit(Events.DemuxAAC, pes, no);
    const segment = this.player.loadData.segmentPool.find(
      (item) => item.no === no
    );
    if (segment.decoded && this.keepCache) {
      this.events.emit(Events.DecodeApppendEnd);
    }
  }
  onDataProcessorReady() {
    if (this.player.seeking || this.player.reseting) {
      this.events.emit(Events.ProcessorResetEnd);
    } else {
      this.events.emit(Events.DataProcessorReady);
    }
  }
  onStartDemux(data) {
    if (this.player.reseting) {
      return;
    }
    this.logger.info("onStartDemux", "postMessage to demux", data.no);

    const segment = this.player.loadData.segmentPool.find(
      (item) => item.no === data.no
    );
    if (segment.decoded && this.keepCache) {
      this.events.emit(Events.ImagePlayerReady);
      this.events.emit(Events.PlayerSeekEnd);
      const imagePlayer = this.player.imagePlayer;
      imagePlayer.ready = true;
      imagePlayer.status = "ready";
      imagePlayer.render(this.player.currentTime, false);
    }
    if (data && data.arrayBuffer && data.arrayBuffer.byteLength > 0) {
      this.demuxNo = data.no;
      // console.log("startDemux", data.no);
      this.processor.postMessage({
        type: "startDemux",
        data: data.arrayBuffer.slice(),
        no: data.no,
        decoded: segment.decoded,
        poolIndex: this.player.imagePlayer.imageData.poolIndex,
        sourceType: this.player.options.type,
        isLast: this.isLast
      });
      this.player.loadData.loadSegmentByNo(data.no + 1);
    } else {
      this.logger.error("onStartDemux", "data is null", "data:", data);
    }
  }
  onDecoded(data, no, poolIndex) {
    // if (this.player.reseting && !this.keepCache) {
    if (this.player.reseting) {
      return;
    }
    this.events.emit(Events.DecodeDecoded, data, no, poolIndex);
  }
  onPartEnd(data, no) {
    const segment = this.player.loadData.segmentPool.find(
      (item) => item.no === no
    );
    if (segment && this.keepCache) {
      // console.log("decoded", segment.no);
      segment.decoded = true;
    }
    this.events.emit(Events.DecodeApppendEnd, data);
  }
  onResetEnd() {
    this.events.emit(Events.ProcessorResetEnd);
  }
  destroy() {
    if (this.processor) {
      this.processor.terminate();
    }
  }
  onCodecError() {
    this.codecError = true;
    clearTimeout(emitTimer);
    emitTimer = setTimeout(() => {
      this.events.emit(Events.DemuxCodecError);
    }, 100);
  }
}
