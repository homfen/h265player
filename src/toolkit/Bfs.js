import { g_imgio, init_browser_fs } from "../imageplayer/bfs";
import Logger from "./Logger.js";
let logger = Logger.get("Bfs.js", { level: 2 });

const init = (filename, self) => {
  const fs_ok = (fs) => {
    logger.info("fs=", fs);
    g_imgio = g_imgio;
  };
  const read_ok = (video_id, frame_seq) => {
    logger.info("read=", video_id, frame_seq);
  };
  const write_ok = (video_id, frame_seq, f_path) => {
    logger.info("write=", video_id, frame_seq, f_path);
  };
  init_browser_fs(filename, "HTML5FS", fs_ok, read_ok, write_ok, self);
};

export default (self) => {
  self.onmessage = (e) => {
    const { type } = e.data;
    switch (type) {
      case "init":
        const { filename } = e.data;
        init(filename, self);
        break;
      case "save":
        const { video_id, frame_seq, image } = e.data;
        g_imgio.saveImg(video_id, frame_seq, image);
        break;
      default:
        break;
    }
  };
};
