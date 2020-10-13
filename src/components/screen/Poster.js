/**
 * @copyright: Copyright (C) 2019
 * @desc: loading poster image
 * @author: Jarry
 * @file: Poster.js
 */

import BaseComponent from '../../base/BaseComponent';
import Events from '../../config/EventsConfig';
import {sizeFormat} from '../../utils/Format';

class Poster extends BaseComponent {
  template = this.createTemplate`
  <gp-poster class="goldplay__screen--poster">
  <img src="${'poster'}" width="${'width'}" data-display="${'display'}" heigth="${'height'}" class="goldplay__screen--poster-image">
  <gp-speed class="goldplay__screen--poster-speed">${'speed'}</gp-speed>
  </gp-poster>
  `;
  data = {
    poster: '',
    status: '',
    display: 'show',
    speed: '',
    width: '',
    height: '',
  };
  options = {};
  constructor(options = {}) {
    super(options);
    this.options = options;
    if (options.player.poster) {
      this.data.poster = options.player.poster;
    }
    Object.assign(this.data, options.data);
    this.init();
  }

  resetPosition() {
    if (!this.element) {
      return;
    }
    const width = this.element.parentNode.offsetWidth;
    const height = this.element.parentNode.offsetHeight;
    this.element.style.width = width + 'px';
    this.element.style.marginTop =
      (height - this.element.offsetHeight - 20) / 2 + 'px';
  }

  bindEvent() {
    this.events.on(Events.LoaderUpdateSpeed, data => {
      if (this.data.display === 'show') {
        this.data.speed = sizeFormat.formatBytes(data.speed) + ' /s';
      }
    });
  }

  hide() {
    if (this.data.display !== 'hide') {
      // let value = 1
      // let timer = setInterval(() => {
      //   if (value <= 0) {
      //     this.element.style.display = 'none'
      //     clearInterval(timer)
      //     return
      //   }
      //   value = (value - 0.1).toFixed(2)
      //   this.element.style.opacity = value
      // }, 50)
      this.element.style.opacity = 0;
      this.element.style.display = 'none';
      this.data.display = 'hide';
    }
  }
}

export default Poster;
