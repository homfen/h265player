/**
 * @copyright: Copyright (C) 2019
 * @desc: yuv data module
 * @author: liuliguo
 * @file: ImageData.js
 */
import BaseClass from "../base/BaseClass.js";
import Events from "../config/EventsConfig";

let timer = null;
export default class ImageData extends BaseClass {
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
  }
  push(data, poolIndex) {
    let pIndex = poolIndex == null ? this.poolIndex : poolIndex;
    let pool = this.pools[pIndex];
    let length = pool.length;

    if (this.offset == null) {
      this.offset = data.pts;
      this.start = data.pts;
      this.fps = data.fps === Infinity ? 25 : data.fps;
    }
    if (data.duration === 0) {
      data.duration = 1000 / this.fps;
    }
    let index = this.insertSort(pool, data);
    if (index === -1) return;
    if (pool[index - 1]) {
      const duration = pool[index].pts - pool[index - 1].pts;
      pool[index - 1].duration = duration;
    }
    if (pool[index + 1]) {
      const duration = pool[index + 1].pts - pool[index].pts;
      pool[index].duration = duration;
    }
    // pool[index].duration = data.duration || 1000 / this.fps;
    if (poolIndex === this.poolIndex) {
      this.end = pool[length].pts + pool[length].duration;
      this.duration = this.end - this.start;
    }
    if (this.pools.length > 1) {
      this.joinPools();
    }
    // console.log("imageData push", data.pts, this.end, this.duration);
  }
  joinPools() {
    const pools = this.pools.slice();
    pools.sort((a, b) => a[0].pts - b[0].pts);
    for (let i = 0; i < pools.length; i++) {
      const prev = pools[i];
      const next = pools[i + 1];
      if (next) {
        const last = prev[prev.length - 1];
        const first = next[0];
        const gap = first.pts - last.pts;
        if (gap <= 200 && gap > last.duration) {
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
      // console.log("remove pool");
    }
  }
  reset(time) {
    let reset = false;
    clearInterval(timer);
    timer = null;
    if (this.keepCache) {
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
  find(time) {
    let pool = this.pools[this.poolIndex];
    let length = pool.length;
    if (length === 0) {
      return;
    }
    let index = this.findIndex(time, pool);
    if (index !== -1) {
      let image = pool[index];
      this.checkBuffer(time);
      pool.timestamp = Date.now();
      return image;
    }
    return this.findInPools(time);
  }
  findInPools(time) {
    if (this.keepCache) {
      for (let i = 0; i < this.pools.length; i++) {
        const pool = this.pools[i];
        let index = this.findIndex(time, pool);
        if (index > -1) {
          const last = pool[pool.length - 1];
          this.switchPool(i, last.no);
          return pool[index];
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
      let pts = parseInt(value.pts);
      if (pts <= time && time < pts + value.duration) {
        index = len - i - 1;
        break;
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
  checkBuffer(time) {
    let duration = this.duration;
    let maxBufferLength = this.maxBufferLength;
    let minDuration = this.player.loadData.segmentPool.getLast().duration;
    let streamController = this.player.streamController;
    if (duration > maxBufferLength && !this.keepCache) {
      if (time > this.start) {
        const pool = this.pools[this.poolIndex];
        let index = this.findIndex(time);
        let reduceBuffer = pool.splice(0, index);
        // console.log("reduceBuffer", time, reduceBuffer.length, pool.length);
        reduceBuffer.forEach((item) => {
          item = null;
        });
        reduceBuffer = null;
        this.start = pool[0].pts;
        this.duration = this.end - this.start;
        // console.log("imageData pool", pool.length);
      }
      return false;
    } else if (
      this.end - this.offset - this.player.currentTime < minDuration * 1000 &&
      streamController.currentIndex < streamController.tsNumber
    ) {
      // console.log("PlayerLoadNext", time);
      this.events.emit(Events.PlayerLoadNext);
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
