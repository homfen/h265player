/**
 * @file  : bfs.js
 * @author: xingquan
 * Date   : 2021.02.23
 */

// import * as BrowserFS from "browserfs";
// const fs = BrowserFS.BFSRequire("fs");
// const Buffer = BrowserFS.BFSRequire("buffer");
// import fs from "fsGlobal";
import BaseClass from "../base/BaseClass.js";

const noop = () => {};
let g_imgio = null;
let f_dirs = [];
let ready = false;
window.fs = fs;

class ImgIO extends BaseClass {
  constructor(task_id, on_fs_ok = noop, on_read_ok = noop, on_write_ok = noop) {
    super();
    this.fs_ready = on_fs_ok;
    this.write_ready = on_write_ok;
    this.read_ready = on_read_ok;

    this.header_cnt = 11;
    this.base_offset = this.header_cnt * 4;
    this.img_cache_basedir = "/img_cache";
    this.img_cache_dir = this.img_cache_basedir + "/" + task_id.toString();
  }

  onError(e) {
    this.logger.error("Error: " + e);
    return;
    // throw new Error(e.toString());
  }

  init(storage_type, self) {
    BrowserFS.install(self);
    // Configures BrowserFS to use the IndexedDB as file system.
    const size = 1024 * 10; // 10G
    BrowserFS.configure(
      {
        fs: storage_type,
        options: {
          size, // HTML5FS
          cacheSize: size, // IndexedDB
          type: PERSISTENT
        }
      },
      (e) => {
        if (e) {
          throw e;
        }
        this.logger.info("fs", fs);
        this.fs = fs.getRootFS();
        this.fs.empty((e) => {
          if (e) {
            this.onError(e);
          }
          this.logger.info("empty");
          this.fs.mkdir(this.img_cache_basedir, 777, (e) => {
            if (e) {
              this.onError(e);
            }
            this.logger.info("mkdir", this.img_cache_basedir);
            this.fs.mkdir(this.img_cache_dir, 777, (e) => {
              if (e) {
                this.onError(e);
              }
              this.logger.info("mkdir", this.img_cache_dir);
              ready = true;
              this.fs_ready(fs);
            });
          });
        });
      }
    );
  }

  saveImg(
    video_id,
    frame_seq,
    img_data /* buf_u, buf_v, buf_y, duration, fps, height, pts, stride_u, stride_v, stride_y, width */
  ) {
    if (!img_data || !img_data.buf_u) return;
    if (!ready) {
      setTimeout(() => {
        this.saveImg(video_id, frame_seq, img_data);
      }, 20);
      return;
    }
    // this.logger.info("saveImg start", img_data.pts);
    const [buf_u_len, buf_v_len, buf_y_len] = [
      img_data.buf_u.length,
      img_data.buf_v.length,
      img_data.buf_y.length
    ];
    const {
      duration,
      fps,
      height,
      pts,
      stride_u,
      stride_v,
      stride_y,
      width
    } = img_data;
    const arr_buf = new ArrayBuffer(
      this.base_offset + buf_u_len + buf_v_len + buf_y_len
    );
    const arr32 = new Uint32Array(arr_buf);
    const arr8 = new Uint8Array(arr_buf);
    const header = arr32.subarray(0, this.header_cnt);
    header.set(
      new Uint32Array([
        buf_u_len,
        buf_v_len,
        buf_y_len,
        duration,
        fps,
        height,
        pts,
        stride_u,
        stride_v,
        stride_y,
        width
      ])
    );
    const [buf_u_offset, buf_v_offset, buf_y_offset] = [
      0,
      buf_u_len,
      buf_u_len + buf_v_len
    ].map((v) => v + this.base_offset);
    arr8.set(img_data.buf_u, buf_u_offset);
    arr8.set(img_data.buf_v, buf_v_offset);
    arr8.set(img_data.buf_y, buf_y_offset);
    const f_dir = this.img_cache_dir + "/" + video_id.toString();
    // const f_dir = this.img_cache_dir + "/0";
    const f_path = f_dir + "/" + frame_seq.toString() + ".jpg";
    let exist = false;
    if (f_dirs.indexOf(f_dir) > -1) {
      exist = true;
    }

    const buf = Buffer.from(arr_buf);
    return new Promise((resolve) => {
      if (exist) {
        fs.writeFile(f_path, buf, (e) => {
          if (e) {
            this.onError(e);
          }
          this.logger.info(f_path + " write ok!");
          this.write_ready(video_id, frame_seq, f_path);
          resolve({ video_id, frame_seq, f_path });
        });
      } else {
        this.fs.mkdir(f_dir, 777, (e) => {
          if (e) {
            this.onError(e);
          }
          f_dirs.push(f_dir);
          fs.writeFile(f_path, buf, (e) => {
            if (e) {
              this.onError(e);
            }
            this.logger.info(f_path + " write ok!");
            this.write_ready(video_id, frame_seq, f_path);
            resolve({ video_id, frame_seq, f_path });
          });
        });
      }
    });
  }

  loadImg(video_id, frame_seq) {
    const f_path =
      this.img_cache_dir +
      "/" +
      video_id.toString() +
      "/" +
      frame_seq.toString() +
      ".jpg";
    return new Promise((resolve, reject) => {
      fs.readFile(f_path, {}, (e, buf) => {
        if (e || !buf) {
          this.onError(e);
          reject();
          return;
        }
        const arr_buf = buf.buffer;
        let arr32 = new Uint32Array(arr_buf);
        let arr8 = new Uint8Array(arr_buf);
        let header = arr32.slice(
          0,
          this.header_cnt
        ); /* buf_u, buf_v, buf_y, duration, fps, height, pts, stride_u, stride_v, stride_y, width */
        const [
          buf_u_len,
          buf_v_len,
          buf_y_len,
          duration,
          fps,
          height,
          pts,
          stride_u,
          stride_v,
          stride_y,
          width
        ] = header;
        const [buf_u_offset, buf_v_offset, buf_y_offset] = [
          0,
          buf_u_len,
          buf_u_len + buf_v_len
        ].map((v) => v + this.base_offset);
        const read_content = {
          buf_u: arr8.slice(buf_u_offset, buf_u_offset + buf_u_len),
          buf_v: arr8.slice(buf_v_offset, buf_v_offset + buf_v_len),
          buf_y: arr8.slice(buf_y_offset, buf_y_offset + buf_y_len),
          duration,
          fps,
          height,
          pts,
          stride_u,
          stride_v,
          stride_y,
          width
        };
        // this.logger.info(f_path + " read ok!");
        resolve(read_content);
        this.read_ready(video_id, frame_seq, read_content);
        arr32 = null;
        arr8 = null;
        header = null;
      });
    });
  }

  empty(cb = noop) {
    if (this.fs) {
      this.fs.empty(cb);
    } else {
      const fsc = fs.getRootFS();
      if (fsc) {
        this.fs = fsc;
        this.fs.empty(cb);
      }
    }
  }
}

function init_browser_fs(
  task_id,
  storage_type,
  on_fs_ok,
  on_read_ok,
  on_write_ok,
  self = window
) {
  g_imgio = new ImgIO(task_id, on_fs_ok, on_read_ok, on_write_ok);
  g_imgio.init(storage_type, self);
}

export { ImgIO, init_browser_fs, g_imgio };
