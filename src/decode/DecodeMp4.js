/**
 * @copyright: Copyright (C) 2019
 * @desc: decode h265 data
 * @author: liuliguo
 * @file: Decode.js
 */
import {AV_TIME_BASE_Q} from '../config/Config.js';
import FFmpegDecode from './FFmpegDecodeMp4';
class Decode {
  constructor() {
    this.p = null;
    this.ptsList = [];
    this.ptsOffset = 0;
    this.fps = 0;
    this.lastDuration = 0;
    this.previousPTS = 0;
    this.status = false;
    this.yuvArray = [];
    this.decodeTool = null;
  }
  loadWASM(event) {
    let libPath = event.data.libPath;
    this.codec = event.data.codec;
    self.Module = {
      locateFile: function(wasm) {
        return libPath + wasm;
      },
    };
    // self.importScripts(libPath + 'TAppDecoderStatic.js')
    self.importScripts(libPath + 'libffmpeg_mp4.js');
    self.Module.onRuntimeInitialized = function() {
      console.log('wasm loaded');
      self.decodeMp4.decodeTool = new FFmpegDecode(self.decodeMp4, this.event);
      self.decodeMp4.openDecode();
      self.decodeMp4.onWasmLoaded();
    };
  }
  openDecode() {
    try {
      if (!this.status) {
        this.decodeTool.openDecode();
        this.status = true;
      }
    } catch (e) {
      console.error(e);
    }
  }
  closeDecode() {
    if (this.status) {
      this.decodeTool.closeDecode();
      this.status = false;
    }
  }
  //receive data and start decode
  push(pes) {
    self.decodeMp4.decodeTool.decodeData(pes);
    if (self.decodeMp4.decodeTool.checkData(this.p)) {
      this.getDecodeYUV(this.p, partEnd, lastTS);
    }
  }
  getDecodeYUV(p, partEnd, lastTS) {
    if (this.reseting) {
      return;
    }
    let duration = 0;
    if (!this.fps) {
      this.fps = this.getFPS();
    }
    let yuv = this.decodeTool.getYUV(p);
    let pts = this.ptsList.shift();
    yuv.pts = pts;

    if (this.previousPTS && pts) {
      duration = parseInt(pts - this.previousPTS);
      this.lastDuration = duration;
    } else {
      duration = this.lastDuration;
    }
    yuv.duration = duration;
    yuv.fps = this.fps;
    if (pts) {
      this.previousPTS = pts;
      this.yuvArray.push(yuv);
      let length = this.yuvArray.length;
      if (length > 10) {
        self.postMessage({
          type: 'decoded',
          data: this.yuvArray,
          no: this.no,
        });
        this.yuvArray = [];
      }
    }
    if (partEnd) {
      if (this.yuvArray.length) {
        self.postMessage({
          type: 'decoded',
          data: this.yuvArray,
          no: this.no,
        });
        this.yuvArray = [];
      }
      self.postMessage({
        type: 'partEnd',
        data: lastTS,
      });
    }
  }
  reset() {
    this.reseting = true;
    this.ptsList = [];
    this.ptsOffset = 0;
    this.previousPTS = 0;
    this.fps = 0;
    this.yuvArray = [];
    this.closeDecode();
    this.openDecode();
    self.postMessage({
      type: 'resetEnd',
      data: Date.now(),
    });
    this.reseting = false;
  }
  flush() {
    this.decodeTool.flush(this.p);
    if (this.yuvArray.length) {
      self.postMessage({
        type: 'decoded',
        data: this.yuvArray,
      });
      this.yuvArray = [];
    }
    this.closeDecode();
    self.postMessage({
      type: 'flushEnd',
      data: this.previousPTS,
    });
  }

  getFPS() {
    let ptsList = this.ptsList;
    let length = ptsList.length;
    if (length >= 2) {
      return Math.round(1000 / (ptsList[1] - ptsList[0]));
    }
    return null;
  }
  onWasmLoaded() {
    self.postMessage({
      type: 'dataProcessorReady',
    });
  }
  insertSort(array, value) {
    let length = array.length;
    if (length === 0) {
      array.push(value);
      return;
    }
    for (let i = 0; i < length; i++) {
      if (value < array[i]) {
        let j = length;
        while (j > i) {
          array[j] = array[j - 1];
          j--;
        }
        array[i] = value;
        return;
      }
    }
    array.push(value);
  }
}
export default Decode;
