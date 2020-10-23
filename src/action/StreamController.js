/**
 * @copyright: Copyright (C) 2019
 * @desc: the player main stream controller, start demux and decode, load next ts packet
 * @author: liuliguo
 * @file: StreamController.js
 */

import BaseClass from '../base/BaseClass';
import Events from '../config/EventsConfig';

let aacCache = {};
let videoCache = {};

export default class StreamController extends BaseClass {
  currentIndex = null;
  retryTime = 0;
  dataReady = {audioReady: false, imageReady: false};
  hasInit = false;
  loadDataStatus = 'loading';
  duration = 0;
  tsNumber = 0;
  constructor(options) {
    super(options);
    this.loadData = options.loadData;
    this.imagePlayer = options.imagePlayer;
    this.audioPlayer = options.audioPlayer;
    this.player = options.player;
    this.bindEvent();
  }
  bindEvent() {
    this.events.on(Events.LoadDataRead, data => {
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
    this.events.on(Events.DecodeDecoded, (data, no) => {
      // console.log('demuxVideo', no);
      this.onDecoded(data, no);
    });
    this.events.on(Events.DecodeApppendEnd, data => {
      this.onAppendEnd(data);
    });
    this.events.on(Events.ImagePlayerReady, () => {
      this.logger.info('bindevent', 'Events.ImagePlayerReady');
      this.checkDataReady('imageReady');
    });
    this.events.on(Events.AudioPlayerDataReady, () => {
      this.logger.info('bindevent', 'Events.AudioPlayerDataReady');
      this.player.receiveAACTime = null;
      this.checkDataReady('audioReady');
    });
    this.events.on(Events.AudioPlayerWait, () => {
      this.dataReady.audioReady = false;
      this.events.emit(Events.PlayerWait, 'audioPlayer');
    });
    this.events.on(Events.ImagePlayerWait, () => {
      this.dataReady.imageReady = false;
      this.events.emit(Events.PlayerWait, 'imagePlayer');
    });
    this.events.on(Events.ImagePlayerEnd, () => {
      this.logger.info('bindevent', '........imageplayer end');
      this.events.emit(Events.PlayerEnd);
    });
    this.events.on(Events.PlayerWait, () => {
      this.logger.warn('player status wait');
      this.player.statusBeforeWait = this.player.status;
      this.player.status = 'wait';
      if (this.loadDataStatus === 'loadend') {
        this.loadDataStatus = 'loading';
        this.loadNext();
      }
    });
    this.events.on(Events.PlayerLoadNext, () => {
      if (this.loadDataStatus === 'loadend') {
        this.loadDataStatus = 'loading';
        this.loadNext();
      }
    });
    this.events.on(Events.DecodeFlushEnd, data => {
      this.logger.info('flushend>>>>>>>>>>>>>>>', data);
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
    this.dataReady = {audioReady: false, imageReady: false};
    this.currentIndex = null;
    this.loadDataStatus = 'loading';
  }
  startLoad(index) {
    this.logger.info('startLoad', 'index:', index);
    this.currentIndex = index;
    this.player.currentIndex = index;
    this.events.emit(Events.LoadDataReadBufferByNo, index);
  }
  loadNext() {
    if (this.player.reseting) {
      return;
    }
    if (this.currentIndex >= this.tsNumber) {
      this.logger.info(
        'loadNext',
        'load end',
        'currentIndex',
        this.currentIndex,
        'tsNumber:',
        this.tsNumber,
      );
      return;
    }
    this.currentIndex += 1;
    this.player.currentIndex = this.currentIndex;
    this.logger.info('loadNext', 'load next ts', 'tsno:', this.currentIndex);
    this.events.emit(Events.LoadDataReadBufferByNo, this.currentIndex);
  }
  onDecoded(dataArray, no) {
    dataArray.forEach(data => {
      if (this.player.reseting) {
        return;
      }
      if (data.pts >= this.player.currentTime) {
        this.imagePlayer.push(data);
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
    if (data) {
      this.logger.info('onAppendEnd', 'events.decodeFlush', data);
      this.events.emit(Events.DecodeFlush);
      return;
    }
    this.logger.info(
      'onAppendEnd',
      'start load next ts condition',
      this.checkBuffer(),
      this.currentIndex,
    );
    if (this.checkBuffer() && this.currentIndex !== null) {
      this.logger.info(
        'onAppendEnd',
        'load next ts. currentIndex:',
        this.currentIndex,
      );
      this.loadNext();
      return;
    }
    this.loadDataStatus = 'loadend';
    this.logger.info('onAppendEnd', 'load ts stop');
  }
  onAACDemuxed(dataArray, no) {
    if (this.player.reseting) {
      return;
    }
    //no audio data
    if (!dataArray.length) {
      this.audioPlayer.send({});
    }
    dataArray.forEach(data => {
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
    if (player.playbackRate <= 1 && bufferLength >= player.maxBufferLength) {
      return false;
    } else {
      return true;
    }
  }
  onRead(data) {
    if (this.player.reseting) {
      console.error('onRead reseting');
      return;
    }

    if (
      data &&
      data.arrayBuffer &&
      (data.no === this.currentIndex || this.player.playbackRate > 1)
    ) {
      this.retryTime = 0;

      this.logger.warn('onRead', 'get stream data');
      //start demux, get the video and audio
      if (data.no === this.tsNumber) {
        //the last one ts packet
        this.logger.info('onRead', 'the last ts');
        this.events.emit(Events.DemuxLast);
      }
      this.events.emit(Events.DemuxStartDemux, data);
    } else {
      this.logger.error(
        'onRead',
        'load ts failred',
        'tsno:',
        this.currentIndex,
      );
    }
  }
  readFromCache(aacData, videoData) {
    aacData.forEach(data => {
      if (data.PTS >= this.player.currentTime || data.audioEnd) {
        if (!this.player.receiveAACTime && this.player.seeking) {
          this.player.receiveAACTime = Date.now();
        }
        this.audioPlayer.send(data);
      }
    });
    videoData.forEach(data => {
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
