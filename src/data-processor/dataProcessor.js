/**
 * @copyright: Copyright (C) 2019
 * @desc: demux and decode ts packet
 * @author: liuliguo
 * @file: dataProcessor.js
 */

import Decode from "../decode/Decode.js";
import DecodeMp4 from "../decode/DecodeMp4.js";
import TsDemux from "../demux/TsDemux.js";
import Mp4Demux from "../demux/Mp4Demux.js";

self.decode = new Decode();
self.decodeMp4 = new DecodeMp4();

export default (self) => {
  self.onmessage = function (event) {
    let data = event.data;
    let type = data.type;
    let buffer = data.data;
    let no = data.no;
    let decoded = data.decoded;
    let poolIndex = data.poolIndex;
    let isLast = data.isLast;
    let sourceType = data.sourceType;
    //console.log('dataProcessor buffer', buffer, type);
    switch (type) {
      case "startDemux":
        if (sourceType === "HLS") {
          self.demuxer = new TsDemux(self.decode);
          self.demuxer.isLast = isLast;
          self.demuxer.no = no;
          self.demuxer.decoded = decoded;
          self.demuxer.poolIndex = poolIndex;
          self.demuxer.push(buffer);
        } else if (sourceType === "MP4") {
          self.decodeMp4.push(buffer);
        }
        break;
      case "loadwasm":
        if (sourceType === "HLS") {
          self.decode.loadWASM(event);
        } else if (sourceType === "MP4") {
          self.decodeMp4.loadWASM(event);
        }
        break;
      case "flush":
        if (sourceType === "HLS") {
          self.decode.flush();
        } else if (sourceType === "MP4") {
          self.decodeMp4.flush();
        }
        break;
    }
  };
};
