/**
 * @file  : idb.js
 * @author: xingquan
 * Date   : 2021.02.23
 */
const Filer = require("filer.js");
//const idb= require('idb.filesystem.js');
window.requestFileSystem =
  window.requestFileSystem || window.webkitRequestFileSystem;
//console.log(idb);

var g_imgio = null;

class ImgIO {
  constructor(task_id, on_fs_ok, on_read_ok, on_write_ok) {
    this.fs_ready = on_fs_ok;
    this.write_ready = on_write_ok;
    this.read_ready = on_read_ok;

    this.header_cnt = 11;
    this.base_offset = this.header_cnt * 4;
    this.img_cache_basedir = "/img_cache";
    this.img_cache_dir = this.img_cache_basedir + "/" + task_id.toString();

    this.filer = new Filer();
  }

  onError(e) {
    console.error("Error: " + e);
    throw new Error(e.toString());
  }

  init(max_size) {
    navigator.webkitPersistentStorage.requestQuota(
      max_size,
      (grantedBytes) => {
        console.log("grantedBytes=", grantedBytes);
        // polyfill方式使用indexedDB  // bug??? chrome 不生效，firefox可以？
        window.requestFileSystem(
          PERSISTENT,
          max_size,
          (fs) => {
            // console.log("fs ready!", fs);
            this.fs = fs;
            // 由filer接管该文件系统，以简化代码
            this.filer.init(
              { persistent: true, max_size },
              (fs) => {
                // console.log("filer FS=", fs);
                this.rm(this.img_cache_basedir, () => {
                  this.filer.mkdir(
                    this.img_cache_basedir,
                    false,
                    () => {
                      // console.log("/img_cache", "created!");
                      this.filer.mkdir(
                        this.img_cache_dir,
                        false,
                        (dirEntry) => {
                          // console.log(dirEntry, "created!");
                        },
                        this.onError
                      );
                    },
                    this.onError
                  );
                  this.fs_ready(fs);
                });
              },
              this.onError
            );
          },
          this.onError
        );
      },
      this.onError
    );
  }

  saveImg(
    video_id,
    frame_seq,
    img_data /* buf_u, buf_v, buf_y, duration, fps, height, pts, stride_u, stride_v, stride_y, width */
  ) {
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
    const f_path = f_dir + "/" + frame_seq.toString() + ".jpg";

    return new Promise((resolve) => {
      this.filer.mkdir(
        f_dir,
        false,
        (dirEntry) => {
          this.filer.write(
            f_path,
            { data: arr_buf },
            (fileEntry, fileWriter) => {
              // console.log(f_path + " write ok!");
              resolve({ video_id, frame_seq });
              this.write_ready(video_id, frame_seq, fileEntry);
            },
            this.onError
          );
        },
        this.onError
      );
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
    return new Promise((resolve) => {
      this.filer.open(f_path, (file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const arr_buf = reader.result;
          const arr32 = new Uint32Array(arr_buf);
          const arr8 = new Uint8Array(arr_buf);
          const header = arr32.subarray(
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
            buf_u: arr8.subarray(buf_u_offset, buf_u_offset + buf_u_len),
            buf_v: arr8.subarray(buf_v_offset, buf_v_offset + buf_v_len),
            buf_y: arr8.subarray(buf_y_offset, buf_y_offset + buf_y_len),
            duration,
            fps,
            height,
            pts,
            stride_u,
            stride_v,
            stride_y,
            width
          };
          // console.log(f_path + " read ok!");
          resolve(read_content);
          this.read_ready(video_id, frame_seq, read_content);
        };
        reader.readAsArrayBuffer(file);
      });
    });
  }

  listFiles(path) {
    this.diskInfo();
    this.filer.ls(
      path,
      (f_list) => {
        console.log(".");
        console.log("..");
        f_list.map((f_entry) => {
          if (f_entry.isFile) {
            f_entry.file((file_obj) => {
              //console.log(file_obj);
              console.log(
                file_obj.name,
                "(" + file_obj.type + ")",
                file_obj.size,
                "(bytes)",
                file_obj.lastModifiedDate
              );
            }, this.onError);
          } else {
            console.log(f_entry.name + "/");
          }
        });
      },
      this.onError
    );
  }

  diskInfo() {
    this.filer.df((used, free, cap) => {
      console.log("Disk used:", used, "free:", free, "total space:", cap);
    });
  }

  rm(path, cb) {
    this.filer.rm(
      path,
      () => {
        console.log(path + " del ok!");
        cb && cb();
      },
      this.onError
    );
  }
}

function init_browser_fs(task_id, max_size, on_fs_ok, on_read_ok, on_write_ok) {
  g_imgio = new ImgIO(task_id, on_fs_ok, on_read_ok, on_write_ok);
  g_imgio.init(max_size);
}

export { ImgIO, init_browser_fs, g_imgio };
