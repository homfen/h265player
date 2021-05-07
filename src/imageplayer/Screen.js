/**
 * @copyright: Copyright (C) 2019
 * @desc: render yuv on canvas
 * @author: liuliguo
 * @file: Screen.js
 */
import yuvCanvas from "yuv-canvas";
import yuvBuffer from "yuv-buffer";
import BaseClass from "../base/BaseClass";
export default class Screen extends BaseClass {
  canvas = null;
  constructor(options) {
    super();
    const { player, canvas, width, height, autoScale } = options;
    this.player = player;
    this.setCanvas(canvas);
    this.setRender();
    this.width = width;
    this.height = height;
    this.autoScale = autoScale;
  }

  setCanvas(canvas) {
    this.canvas = canvas;
  }

  setRender(canvas) {
    this.render = yuvCanvas.attach(canvas || this.canvas, {
      autoScale: this.autoScale
    });
  }

  clear() {
    this.render.clear();
  }
  drawFrame(data) {
    let st = Date.now();
    let {
      buf_y,
      buf_u,
      buf_v,
      width,
      height,
      stride_y,
      stride_u,
      stride_v
    } = data;
    let y, u, v, format, frameDisplay;
    let width_y = width;
    let height_y = height;
    let width_u = width_y / 2;
    let height_u = height_y / 2;
    y = {
      bytes: buf_y,
      stride: stride_y
    };
    u = {
      bytes: buf_u,
      stride: stride_u
    };
    v = {
      bytes: buf_v,
      stride: stride_v
    };

    const { width: realWidth, height: realHeight } = this.player.dims;
    const formatOpts = {
      displayWidth: this.autoScale ? realWidth : this.width,
      displayHeight: this.autoScale ? realHeight : this.height,
      width: width_y,
      height: height_y,
      chromaWidth: width_u,
      chromaHeight: height_u
    };
    format = yuvBuffer.format(formatOpts);
    frameDisplay = yuvBuffer.frame(format, y, u, v);
    this.render.drawFrame(frameDisplay);
    let endt = Date.now();
    if (endt - st > 10) {
      this.logger.warn("drawFrame", "reandertime:", endt - st);
    }
  }
}
