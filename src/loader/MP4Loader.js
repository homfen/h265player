import BaseLoader from './BaseLoader';
import Events from '../config/EventsConfig';
import {state} from '../config/LoaderConfig';

class MP4Loader extends BaseLoader {
  state = state.IDLE;

  httpWorker = null;

  constructor(options) {
    super();
    this.options = options;
    this.loaderController = this.options.loaderController;
    this.dataController = this.loaderController.dataController;
    this.httpWorker = options.httpWorker;
  }

  loadFile() {
    const _send = () => {
      if (this.options.player.options.beforeLoad) {
        this.options.player.options.beforeLoad(this.sourceURL).then(url => {
          this.httpWorker.postMessage({
            type: 'invoke',
            fileType: 'video',
            method: 'get',
            name: 'video',
            url,
          });
        });
      } else {
        this.httpWorker.postMessage({
          type: 'invoke',
          fileType: 'video',
          method: 'get',
          name: 'video',
          url: this.sourceURL,
        });
      }
    };

    this.state = state.LOADING;
    this.httpWorker.onmessage = event => {
      this.state = state.DONE;
      const data = event.data;
      this.logger.info('loadfile', 'httpWorker', 'onmessage get data');
      if (!data || data.type === 'error') {
        this.state = state.ERROR;
        if (retryCount <= this.maxRetryCount) {
          this.logger.warn(
            'loadFile',
            'retry to load',
            'count:',
            retryCount,
            'segment:',
            segment,
          );
          _send();
          retryCount += 1;
        } else {
          this.events.emit(Events.LoaderError, segment, type, time);
          const content = 'Load file error, please concat administrator.';
          this.events.emit(Events.PlayerAlert, content);
          const errors = [
            this.state,
            'Load File error.',
            'load count:',
            retryCount,
            'segment:',
            segment,
          ];
          this.events.emit(Events.PlayerThrowError, errors);
        }
      } else if (data.type === 'notice') {
        if (data.noticeType === 'speed') {
          this.events.emit(Events.LoaderUpdateSpeed, data.data);
        }
      } else if (data.fileType === 'video' && data.name === 'video') {
        console.log('load mp4', data);
        this.logger.info('loadFile', 'read mp4 success', 'data:', data);
        this.state = state.IDLE;
        this.events.emit(Events.LoaderLoaded, data);
      } else {
        this.logger.warn(
          'loadFile',
          'load fail.',
          'fileType:',
          data.fileType,
          'data:',
          data,
        );
      }
    };
    _send();
  }
}

export default MP4Loader;
