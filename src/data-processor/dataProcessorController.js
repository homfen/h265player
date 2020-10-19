/**
 * @copyright: Copyright (C) 2019
 * @desc: demux and decode
 * @author: liuliguo
 * @file: dataProcessorController.js
 */
import BaseClass from '../base/BaseClass.js';
import webworkify from 'webworkify-webpack';
import Events from '../config/EventsConfig';

export default class DataProcessorController extends BaseClass {
  isLast = false;
  constructor(options) {
    super(options);
    this.type = options.type;
    this.libPath = options.libPath;
    this.player = options.player;
    this.init();
  }
  init() {
    let type = this.type;
    if (type == 'ts') {
      this.initNornalWorker();
    }
    this.bindEvent();
    this.loadjs();
  }
  initNornalWorker() {
    this.processor = this.initWorker();
  }
  initWorker() {
    let processor = webworkify(require.resolve('./dataProcessor.js'));
    processor.onmessage = event => {
      let workerData = event.data;
      let type = workerData.type;
      let no = workerData.no;
      let data = workerData.data;
      switch (type) {
        case 'dataProcessorReady':
          this.onDataProcessorReady();
          break;
        case 'decoded':
          this.onDecoded(data, no);
          break;
        case 'demuxedAAC':
          this.onDemuxedAAC(data, no);
          break;
        case 'partEnd':
          this.onPartEnd(data);
          break;
        case 'resetEnd':
          this.onResetEnd();
          break;
        case 'maxPTS':
          this.onMaxPTS(data);
          break;
        case 'flushEnd':
          this.onFlushEnd(data);
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
      type: 'flush',
    });
  }
  loadjs() {
    this.processor.postMessage({
      type: 'loadwasm',
      libPath: this.libPath,
      codec: this.options.codec,
    });
  }
  reset() {
    this.isLast = false;
    this.processor.terminate();
    this.initNornalWorker();
    this.loadjs();
  }
  onFlushEnd(data) {
    this.events.emit(Events.DecodeFlushEnd, data);
  }
  onMaxPTS(data) {
    this.events.emit(Events.PlayerMaxPTS, data.maxAudioPTS, data.maxVideoPTS);
  }
  onDemuxedAAC(pes, no) {
    this.events.emit(Events.DemuxAAC, pes, no);
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
    this.logger.info('onStartDemux', 'postMessage to demux');

    if (data && data.arrayBuffer && data.arrayBuffer.byteLength > 0) {
      this.processor.postMessage(
        {
          type: 'startDemux',
          data: data.arrayBuffer,
          no: data.no,
          isLast: this.isLast,
        },
        [data.arrayBuffer.buffer],
      );
    } else {
      this.logger.error('onStartDemux', 'data is null', 'data:', data);
    }
  }
  onDecoded(data, no) {
    if (this.player.reseting) {
      return;
    }
    this.events.emit(Events.DecodeDecoded, data, no);
  }
  onPartEnd(data) {
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
}
