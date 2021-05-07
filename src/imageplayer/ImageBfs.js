/**
 * @file  : ImageBfs.js
 * @author: xingquan
 * Date   : 2021.02.23
 */
// import webworkify from "webworkify-webpack";
import BaseClass from "../base/BaseClass.js";
import Events from "../config/EventsConfig";
import { g_imgio, init_browser_fs } from "./bfs";
// import { g_imgio, init_browser_fs } from "./idb";

export default class ImageBfs extends BaseClass {
  maxBufferLength = 0;
  duration = 0;
  pools = [[]];
  poolIndex = 0;
  start = 0;
  end = 0;
  offset = null;
  fps = 25;
  constructor(options) {
    super(options);
    this.maxBufferLength = options.maxBufferLength;
    this.player = options.player;
    this.keepCache = this.player.options.keepCache;
    this.initBfs();
  }
  initBfs() {
    const fs_ok = (fs) => {
      this.logger.info("fs=", fs);
      this.g_imgio = g_imgio;
    };
    const read_ok = (video_id, frame_seq, read_content) => {
      this.logger.info("read=", video_id, frame_seq, read_content);
    };
    const write_ok = (video_id, frame_seq, f_path) => {
      this.logger.info("write=", video_id, frame_seq, f_path);
    };
    const reg = /([^/]+?)\.m3u8/;
    const filename = this.player.options.sourceURL.match(reg)[1];
    this.filename = filename;
    init_browser_fs(filename, "HTML5FS", fs_ok, read_ok, write_ok);
    // init_browser_fs(filename, 1024 * 1204 * 10, fs_ok, read_ok, write_ok);
    // this.bfsWorker = webworkify(require.resolve("../toolkit/Bfs.js"), {
    // name: "bfsWorker"
    // });
    // this.bfsWorker.postMessage({ type: "init", filename });
  }
  async push(data, poolIndex) {
    let pIndex = poolIndex == null ? this.poolIndex : poolIndex;
    let pool = this.pools[pIndex];
    let length = pool.length;

    if (this.offset == null) {
      this.offset = data.pts;
      this.start = data.pts;
      this.fps = data.fps === Infinity ? 25 : data.fps;
    }
    data.pts = parseInt(data.pts, 10);
    let index = this.findIndexAll(data.pts);
    if (index > -1) return;

    index = this.insertSort(pool, data);
    if (index === -1) return;

    this.setDuration();
    // const maxGap = (1000 / this.fps) * 5;
    // if (pool[index - 1]) {
    // const gap = pool[index].pts - pool[index - 1].pts;
    // // pool[index - 1].duration = gap > maxGap ? maxGap : gap;
    // pool[index - 1].duration = gap;
    // }
    // if (pool[index + 1]) {
    // const gap = pool[index + 1].pts - pool[index].pts;
    // // pool[index].duration = gap > maxGap ? maxGap : gap;
    // pool[index].duration = gap;
    // }

    if (poolIndex === this.poolIndex) {
      this.end = pool[length].pts + pool[length].duration;
      this.duration = this.end - this.start;
    }
    const image = pool[index];
    if (image.buf_y && image.buf_y.length && image.buf_y !== "pending") {
      await g_imgio.saveImg(poolIndex, image.pts, image);
    }
    // this.bfsWorker.postMessage({
    // type: "save",
    // video_id: poolIndex,
    // frame_seq: image.pts,
    // image
    // });
    if (image.pts - this.start > 5000) {
      delete image.buf_y;
      delete image.buf_u;
      delete image.buf_v;
    }
    // this.logger.info("imageData push", data.pts, this.end, this.duration);
    // this.joinPools();
  }
  setDuration() {
    const maxGap = (1000 / this.fps) * 4;
    const ptss = this.pools.reduce((a, b) => a.concat(b), []);
    ptss.sort((a, b) => a.pts - b.pts);
    for (let i = 0; i < ptss.length - 1; i++) {
      const current = ptss[i];
      const next = ptss[i + 1];
      const gap = next.pts - current.pts;
      current.duration = gap < maxGap ? gap : maxGap;
    }
  }
  joinPools() {
    const pools = this.pools.slice();
    pools.sort((a, b) => {
      if (!a.length) return 1;
      if (!b.length) return -1;
      return a[0].pts - b[0].pts;
    });
    const maxGap = (1000 / this.fps) * 5;
    for (let i = 0; i < pools.length; i++) {
      const prev = pools[i];
      const next = pools[i + 1];
      if (next && next.length) {
        const last = prev[prev.length - 1];
        const first = next[0];
        const gap = first.pts - last.pts;
        if (gap <= maxGap && gap > last.duration) {
          last.duration = gap;
        }
      }
    }
  }
  insertSort(array, value) {
    let length = array.length;
    if (length === 0) {
      array.push(value);
      return 0;
    }
    if (array.findIndex((item) => item.pts === value.pts) > -1) {
      return -1;
    }
    for (let i = 0; i < length; i++) {
      if (value.pts < array[i].pts) {
        let j = length;
        while (j > i) {
          array[j] = array[j - 1];
          j--;
        }
        array[i] = value;
        return i;
      }
    }
    array.push(value);
    return array.length - 1;
  }
  checkPool() {
    if (this.keepCache && this.pools.length > 3) {
      this.pools.sort((a, b) => a.timestamp - b.timestamp);
      this.pools = this.pools.slice(this.pools.length - 3);
      this.joinPools();
      // this.logger.info("remove pool");
    }
  }
  reset(time, destroy = false) {
    let reset = false;
    if (this.keepCache) {
      if (destroy) {
        g_imgio.empty();
      }
      let pool = this.pools[this.poolIndex];
      if (pool.length) {
        if (this.findIndex(time) === -1) {
          reset = true;
          this.poolIndex += 1;
          this.pools[this.poolIndex] = [];
        }
        this.pools[this.poolIndex].timestamp = Date.now();
      }
    } else {
      reset = true;
      this.offset = null;
      this.pools = [[]];
    }
    if (reset) {
      this.duration = 0;
      this.start = 0;
      this.end = 0;
    }
  }
  async preload(time) {
    if (!this.keepCache) return;
    const duration = 1000 / this.fps;
    for (let i = 1, len = this.fps * 4; i < len; i++) {
      const imagePts = time + duration * i;
      for (let j = 0; j < this.pools.length; j++) {
        const pool = this.pools[j];
        const index = this.findIndex(imagePts, pool);
        if (index > -1) {
          const image = pool[index];
          if (!image.buf_y) {
            image.buf_y = "pending";
            let data = await g_imgio.loadImg(j, image.pts);
            const { buf_y, buf_u, buf_v } = data;
            image.buf_y = buf_y;
            image.buf_u = buf_u;
            image.buf_v = buf_v;
            data.buf_y = null;
            data.buf_u = null;
            data.buf_v = null;
            data = null;
          }
        }
      }
    }
  }
  async find(time) {
    this.preload(time);
    let pool = this.pools[this.poolIndex];
    let index = this.findIndex(time, pool);
    if (index !== -1) {
      let image = pool[index];
      this.checkBuffer(time);
      pool.timestamp = Date.now();
      if (image.buf_y && image.buf_y !== "pending") {
        return image;
      }
      let data = await g_imgio.loadImg(this.poolIndex, image.pts);
      const { buf_y, buf_u, buf_v } = data;
      image.buf_y = buf_y;
      image.buf_u = buf_u;
      image.buf_v = buf_v;
      data.buf_y = null;
      data.buf_u = null;
      data.buf_v = null;
      data = null;
      return image;
    }
    return this.findInPools(time);
  }
  async findInPools(time) {
    if (this.keepCache) {
      for (let i = 0; i < this.pools.length; i++) {
        const pool = this.pools[i];
        let index = this.findIndex(time, pool);
        if (index > -1) {
          const image = pool[index];
          this.switchPool(i, image.no);
          if (image.buf_y && image.buf_y !== "pending") {
            return image;
          }
          const data = await g_imgio.loadImg(i, image.pts);
          const { buf_y, buf_u, buf_v } = data;
          image.buf_y = buf_y;
          image.buf_u = buf_u;
          image.buf_v = buf_v;
          data.buf_y = null;
          data.buf_u = null;
          data.buf_v = null;
          data = null;
          return image;
        }
      }
    }
  }
  switchPool(index, no) {
    this.poolIndex = index;
    let pool = this.pools[index];
    pool.timestamp = Date.now();
    this.start = pool[0].pts;
    let last = pool[pool.length - 1];
    this.end = last.pts + last.duration;
    this.duration = this.end - this.start;
    this.events.emit(Events.ImagePlayerSwitchPool, no);
  }
  findIndex(time, pool) {
    pool = pool || this.pools[this.poolIndex];
    let index = -1;
    for (let i = 0, len = pool.length; i < len; i++) {
      const value = pool[len - i - 1];
      let pts = parseInt(value.pts, 10);
      if (pts <= time && time < pts + value.duration) {
        index = len - i - 1;
        break;
      }
    }
    return index;
  }
  findIndexAll(time) {
    let index = -1;
    for (let j = 0, leng = this.pools.length; j < leng; j++) {
      const pool = this.pools[j];
      const tmp = pool.findIndex((item) => item.pts === time);
      if (tmp > -1) {
        return tmp;
      }
    }
    return index;
  }
  isBuffered(time) {
    let index = this.findIndex(time);
    if (index > -1) return true;

    if (this.keepCache) {
      for (let i = 0; i < this.pools.length; i++) {
        const pool = this.pools[i];
        let index = this.findIndex(time, pool);
        if (index > -1) {
          const last = pool[pool.length - 1];
          this.switchPool(i, last.no);
          return true;
        }
      }
      return false;
    }
  }
  checkBuffer() {
    if (this.end - this.offset - this.player.currentTime < 10000) {
      const { streamController, reseting } = this.player;
      if (reseting) {
        return true;
      }
      const { currentIndex, tsNumber } = streamController;
      if (currentIndex < tsNumber) {
        streamController.loadNext();
      }
    }
    return true;
  }
  buffer() {
    return {
      start: this.start,
      end: this.end
    };
  }
}
