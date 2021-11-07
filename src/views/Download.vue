<script>
import Table from '@/components/Table.vue';

export default {
  name: 'Download',
  components: {
    Table,
  },
  data() {
    return {
      clipboard: '',
      data: [],
      headlessdata: [],
      thumbnail: '',
      format: [],
      readyToRender: false,
      fail: false,
      fastdl: true,
      progress: '클립보드 가져오는 중 & 분석 중...',
      type: 'video',
    };
  },
  created() {
    document.title = '영상 다운로드';
    console.log(this.$route);
    if (this.$route.name === 'Download') this.fetchClipboard();
    else if (this.$route.name === 'Direct') this.directDownload();

    this.$ipcRenderer.on('getinfo data', (data) => {
      this.data = data;
      this.format = data.formats.filter((x) => x.hasVideo).sort((a, b) => Number(b.qualityLabel.split('p')[0]) - Number(a.qualityLabel.split('p')[0]));
      console.log(this.data);
      this.thumbnail = data.videoDetails.thumbnails
        ? data.videoDetails.thumbnails[0].url
        : data.videoDetails.thumbnail || null;
      this.progress = '헤드리스 브라우저에서 정보 수집 중...';
    });
    this.$ipcRenderer.on('getheadless data', (data) => {
      this.headlessdata = data;
      this.readyToRender = true;
      console.log(this.headlessdata);
    });
  },
  methods: {
    fetchClipboard() {
      navigator.clipboard.readText()
        .then(async (res) => {
          this.clipboard = res;
          // TODO: 뭘 분석하는지 알려주기
          // TODO: 에러나면 따로 넣는 곳 만들기
          const result = this.youtubeLinkParse(this.clipboard);

          if (result.match) {
            this.$ipcRenderer.send('getinfo', result.value);
            this.$ipcRenderer.send('getheadless', result.value);
            this.progress = '정보 수집 중...';
          } else {
            this.progress = `에러가 발생했습니다. 클립보드를 분석할 수 없어요.\n클립보드: ${this.clipboard}`;
            console.error('링크 분석 불가');
          }
        }).catch((e) => {
          console.error(e);
          this.fail = true;
        });
    },
    directDownload() {
      this.$ipcRenderer.send('getinfo', this.$route.params.id);
      this.$ipcRenderer.send('getheadless', this.$route.params.id);
      this.progress = '정보 수집 중...';
    },
    youtubeLinkParse(link) {
      const regex = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/;
      const result = link.match(regex);
      if (result === null) return { match: false, value: link };
      return { match: true, value: result[1] };
    },
    retry() {
      window.location.reload(true);
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
        this.$ipcRenderer.send('download', { ...o, url, info: this.data.videoDetails });
        window.close();
      } else if (o.type === 'audio') {
        this.$ipcRenderer.send('download audio', { ...o, url, info: this.data.videoDetails });
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
    button#retry(v-if="fail" @click="retry()")
      icon(icon="redo-alt")
      | 재시도
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
          option(value="audio") 오디오만 다운로드
        label(for="speed" style="margin-bottom: 3px") 빠른 다운로드
        input#speed(type="checkbox" v-model="fastdl")
      Table(:format="format" :rawformat="data.formats" :headlessdata="headlessdata" :fastdl="fastdl" :type="type")
      .list-action
        button(v-if="$store.state.selection !== null" @click="submitDownload($store.state.selection, data.videoDetails.video_url)") 다운로드
        button(@click="closeWindow()") 취소
    #loading(v-if="!fail && !readyToRender")
      .ui.text.loader.active.small {{ progress }}
</template>

<style lang="scss">
#download {
  width: 100vw;
  height: 100vh;
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
    white-space: pre-line;
    text-overflow: ellipsis;
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
