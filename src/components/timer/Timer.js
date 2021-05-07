/**
 * @copyright: Copyright (C) 2019
 * @desc: Timer
 * @author: Jarry
 * @file: Timer.js
 */

import BaseComponent from "../../base/BaseComponent";
import { timeFormat } from "../../utils/Format";
import Events from "../../config/EventsConfig";

class Timer extends BaseComponent {
  template = this.createTemplate`
  <gp-time class="goldplay__control--timer">
  <span gid="time" class="goldplay__control--timer-play">${"time"}</span>
  <span gid="slash">${"slash"}</span>
  <span gid="total-time" class="goldplay__control--timer-total">${"totalTime"}</span>
  </gp-time>
  `;
  data = {
    time: "00:00",
    totalTime: "",
    slash: "/"
  };
  options = {};
  constructor(options = {}) {
    super(options);
    this.options = options;
    Object.assign(this.data, options.data);
    this.init();
  }

  setTotalTime(data) {
    const time = data.segmentPool.reduce((a, b) => a + b.duration, 0);
    if (this.options.player.options.isLive) {
      this.element.querySelector('[gid="slash"]').style.display = "none";
      this.element.querySelector('[gid="total-time"]').style.display = "none";
    }
    this.data.totalTime = timeFormat.formatHHMMSS(time);
  }

  bindEvent() {
    this.events.on(Events.LoaderPlayListLoaded, (loader) => {
      this.setTotalTime(loader.loadData);
    });
  }

  updateTime(second) {
    this.element.querySelector('[gid="time"]').innerHTML = second;
  }

  updateTotalTime(second) {
    this.element.querySelector('[gid="total-time"]').innerHTML = second;
  }
}

export default Timer;
