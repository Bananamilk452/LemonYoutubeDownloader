<script>
import Table from '../components/Table.vue';

export default {
  name: 'PrivateDownload',
  components: {
    Table,
  },
  data() {
    return {
      data: [],
      headlessdata: [],
      thumbnail: '',
      format: [],
      readyToRender: false,
      userFailed: false,
      userInput: '',
      cookie: '',
      fastdl: true,
      loading: false,
      progress: '클립보드 가져오는 중 & 분석 중...',
      type: 'video',
    };
  },

  created() {
    document.title = '비공개 영상 다운로드';
    this.$ipcRenderer.on('private getinfo data', (data) => {
      this.data = data;
      this.format = data.formats.filter((x) => x.hasVideo).sort((a, b) => Number(b.qualityLabel.split('p')[0]) - Number(a.qualityLabel.split('p')[0]));
      console.log(this.data);
      this.thumbnail = data.videoDetails.thumbnails
        ? data.videoDetails.thumbnails[0].url
        : data.videoDetails.thumbnail || null;
      this.progress = '헤드리스 브라우저에서 정보 수집 중...';
    });
    this.$ipcRenderer.on('private getheadless data', (data) => {
      this.headlessdata = data;
      this.readyToRender = true;
      console.log(this.headlessdata);
    });
  },
  methods: {
    processInput(input, cookie) {
      // TODO: 에러나면 따로 넣는 곳 만들기
      this.userFailed = false;
      const result = this.youtubeLinkParse(input);

      if (result.match) {
        this.$ipcRenderer.send('private getinfo', { videoId: result.value, cookie });
        this.$ipcRenderer.send('private getheadless', { videoId: result.value, cookie });
        this.progress = `정보 수집 중...\n파싱한 비디오 ID: ${result.value}`;
        this.loading = true;
      } else {
        this.userFailed = true;
        this.progress = '에러가 발생했습니다. 링크/쿠키를 분석할 수 없어요.';
        console.error('링크 분석 불가');
      }
    },
    youtubeLinkParse(link) {
      const regex = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/;
      const result = link.match(regex);
      if (result === null) return { match: false, value: link };
      return { match: true, value: result[1] };
    },
    parseTime(time) {
      if (time / 60 / 60 >= 1) return `${Math.floor(time / 60 / 60)}:${Math.floor(time / 60)}:${time % 60}`;
      return `${Math.floor(time / 60)}:${time % 60}`;
    },
    submitDownload(options, url) {
      if (this.fastdl === false) {
        alert('현재 빠른 다운로드만 사용할 수 있습니다.');
        return;
      }
      const o = JSON.parse(options);
      if (o.type === 'video') {
        this.$ipcRenderer.send('private download', {
          ...o, url, info: this.data.videoDetails, cookie: this.cookie,
        });
        window.close();
      } else if (o.type === 'audio') {
        this.$ipcRenderer.send('download audio', {
          ...o, url, info: this.data.videoDetails, cookie: this.cookie,
        });
        window.close();
      }
    },
    closeWindow() {
      window.close();
    },
  },
};
</script>

<template lang="pug">
  #download
    #list(v-if="readyToRender")
      .list-description 가져온 클립보드 내용: {{ clipboard }}
      .list-title 분석한 영상:
        a.list-link(:href="data.videoDetails.video_url") {{ data.videoDetails.video_url }}
      .search-card
        .search-image(style="width:20%;")
          img.search-thumbnail(:src="thumbnail")
          .search-thumbnail-time {{ parseTime(data.videoDetails.lengthSeconds) }}
        .search-info
          .search-title {{ data.videoDetails.title }}
          .search-channel
            img.search-avatar(:src="data.videoDetails.author.thumbnails[0].url")
            .search-author {{ data.videoDetails.author.name }}
      .list-option
        label(for=".list-type" style="margin: 0 6px 3px 0") 유형:
        select.list-type(v-model="type")
          option(value="video") 영상 다운로드
          //- option(value="audio") 오디오만 다운로드
      Table(:format="format" :rawformat="data.formats" :headlessdata="headlessdata" :fastdl="fastdl" :type="type")
      .list-action
        button(v-if="$store.state.selection !== null" @click="submitDownload($store.state.selection, data.videoDetails.video_url)") 다운로드
        button(@click="closeWindow()") 취소
    #prefetch(v-if="userFailed || !readyToRender")
      .ui.text.loader.active.small(v-if="loading") {{ progress }}
      .user-input(v-if="!loading")
        .user-title 유튜브 영상 링크와 쿠키를 입력해주세요.
        .user-anchor(@click="$openBrowser('https://gist.github.com/Bananamilk452/224df295a699f5ac36e7e078ef7bdd61')")
          strong 쿠키 가져오는 법 (외부 링크)
        input(placeholder="유튜브 영상 링크" v-model="userInput")
        textarea(placeholder="쿠키" v-model="cookie")
        button(@click="processInput(userInput, cookie)") 제출
</template>

<style lang="scss">
#download {
  width: 100vw;
  height: 100vh;
}

#prefetch {
  width: 100%;
  height: 100%;
}

#prefetch > .loader {
  white-space: pre-wrap;
}

.when-user-failed, .user-input {
  margin-top: 8px;
}

.user {
  &-input {
    display: flex;
    flex-direction: column;
    width: 70%;
    position: absolute;
    top: 25px;
    left: 50%;
    transform: translate(-50%, 0);
    align-items: center;
    justify-content: center;

    textarea, input {
      width: 70%;
    }

    input {
      margin-top: 8px;
    }

    textarea {
      padding: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans KR', 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      margin: 8px 0;
      height: 100px;
    }
  }

  &-anchor {
    cursor: pointer;
    color: #197cc7;

    &:hover {
      text-decoration: underline;
    }
  }
}

#list {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 24px 24px 0 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.list-{
  &title {
    font-size: 18px;
    text-align: left;
    margin-bottom: 12px;
    font-weight: 700;
  }

  &description {
    font-size: 15px;
    text-align: left;
    margin-bottom: 8px;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    height: 30px;
  }

  &link {
    color: #0a3ee9;
    display: inline;
    text-decoration: none;
    margin-left: 4px;
    font-size: 16px;
    font-weight: 500;
  }

  &link:visited {
    color: #0a3ee9;
    text-decoration: none;
  }

  &link:hover {
    text-decoration: underline;
  }

  &option {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    margin: -4px 0 12px 0;
  }

  &type {
    padding: 3px;
    margin-right: 8px;
  }

  &action {
    margin: 14px 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;

    & > button:last-child {
      margin-left: 8px;
      background-color: gray;
    }
  }
}

#list > .search-card {
  background-color: transparent !important;
  filter: none !important;
}
</style>
