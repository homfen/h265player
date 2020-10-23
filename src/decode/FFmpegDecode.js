/**
 * @copyright: Copyright (C) 2019
 * @desc: wasm methods to decode
 * @author: liuliguo
 * @file: FFmpegDecode.js
 */
import {NdArray} from 'numjs';

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
      addr_bgr,
      bgr_size,
    ) {
      let out_y = HEAPU8.subarray(addr_y, addr_y + stride_y * height);
      let out_u = HEAPU8.subarray(addr_u, addr_u + (stride_u * height) / 2);
      let out_v = HEAPU8.subarray(addr_v, addr_v + (stride_v * height) / 2);
      let out_bgr = HEAPU8.subarray(addr_bgr, addr_bgr + bgr_size);
      let obj = {
        stride_y,
        stride_u,
        stride_v,
        width,
        height,
        buf_y: Uint8Array.from(out_y),
        buf_u: Uint8Array.from(out_u),
        buf_v: Uint8Array.from(out_v),
        pts,
        buf_bgr: Uint8Array.from(out_bgr),
        bgr_size,
      };
      that.result.push(obj);
    },
    'viiiiiiiiiii');
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
