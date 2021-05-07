/**
 * @copyright: Copyright (C) 2019
 * @desc: wasm methods to decode
 * @author: liuliguo
 * @file: FFmpegDecode.js
 */

export default class FFmpegDecode {
  constructor(decode) {
    this.decode = decode;
    // In case multiple frames are decoded (flush)
    this.result = [];
  }
  openDecode(codec = 1) {
    let that = this;
    let videoCallback = Module.addFunction(function(
      addr_y,
      addr_u,
      addr_v,
      stride_y,
      stride_u,
      stride_v,
      width,
      height,
      pts,
    ) {
      // let start = performance.now();
      let buf_y = HEAPU8.slice(addr_y, addr_y + stride_y * height);
      let buf_u = HEAPU8.slice(addr_u, addr_u + (stride_u * height) / 2);
      let buf_v = HEAPU8.slice(addr_v, addr_v + (stride_v * height) / 2);
      let obj = {
        stride_y,
        stride_u,
        stride_v,
        width,
        height,
        buf_y,
        buf_u,
        buf_v,
        pts,
      };
      that.result.push(obj);
      // console.log('videoCallback', pts, performance.now() - start);
    },
    'viiiiiiiii');
    Module._openDecoder(codec, videoCallback, 1);
  }
  decodeData(pes, pts) {
    let fileSize = pes.length;
    let cacheBuffer = Module._malloc(fileSize);
    Module.HEAPU8.set(pes, cacheBuffer);
    Module._decodeData(cacheBuffer, fileSize, pts);
    Module._free(cacheBuffer);
  }
  flush() {
    Module._flushDecoder();
    while (this.checkData()) {
      this.decode.getDecodeYUV();
    }
  }
  closeDecode() {
    Module._closeDecoder();
  }
  getYUV() {
    let res = null;
    if (this.result.length > 0) {
      res = this.result.shift();
    }
    return res;
  }
  checkData() {
    let length = this.result.length;
    return length > 0;
  }
}
