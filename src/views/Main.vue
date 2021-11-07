<script>
import Navbar from '@/components/Navbar.vue';

export default {
  name: 'Main',
  components: {
    Navbar,
  },
  data() {
    return {
      list: [],
      status: false,
      progress: { text: '로딩 중...' },
    };
  },
  created() {
    this.$ipcRenderer.send('check binary');

    this.$ipcRenderer.on('binary status', (data) => {
      this.status = data.status;
    });

    this.$ipcRenderer.on('binary progress', (data) => {
      this.progress = data;
    });

    this.$ipcRenderer.on('download receive', (data) => {
      this.list.unshift({ ...data, progress: { type: 'text', value: '준비 중...' } });
    });

    this.$ipcRenderer.on('download progress', (data) => {
      this.list[this.list.findIndex((x) => x.url === data.url)].progress = data;
    });
    // TODO: 취소 기능 만들기
    // TODO: 파일 폴더 열기 버튼
  },
  methods: {
    getThumbnail(data) {
      return data.thumbnails
        ? data.thumbnails[0].url
        : data.thumbnail || null;
    },
    parseTime(time) {
      if (time / 60 / 60 >= 1) return `${Math.floor(time / 60 / 60)}:${String(Math.floor((time / 60) % 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
      return `${String(Math.floor((time / 60) % 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
    },
  },
};
</script>

<template lang="pug">
#main(v-if="status")
  Navbar
  #result
    .search-card(v-for="data in list" :key="data.url")
      .search-image(style="width:20%;")
        img.search-thumbnail(:src="getThumbnail(data.info)")
        .search-thumbnail-time {{ parseTime(data.info.lengthSeconds) }}
      .search-info
        .search-title {{ data.info.title }}
        .search-status
          .search-status-text {{ data.progress.value }}
          //- // TODO: 속도 표시
          .search-progress(v-if="data.progress.type === 'progress'")
            progress(:max="data.progress.size" :value="data.progress.current")
            .search-progress-text {{ ((data.progress.current / data.progress.size) * 100).toFixed(1) }}%
    | 유튜브 링크를 복사하고 "링크 분석" 버튼을 누르거나 영상 검색 버튼을 눌러서 검색 후 영상을 다운로드하세요!
.dimmer(v-else)
  p 초기 설치 중입니다. 응답 없음이 30초 이상 뜰 수 있습니다. 잠시만요...
  .ui.loader.active.small.text {{ progress.text }}
    .search-progress(v-if="progress.type === 'progress'")
      progress(:max="progress.size" :value="progress.current")
      .search-status-text {{ ((progress.current / progress.size) * 100).toFixed(1) }}%
</template>

<style lang="scss">
#result {
  // background-color: #F7F4CA;
  height: calc(100% - 45px);
  width: 100%;
  overflow-y: auto;
  padding: 12px;
  box-sizing: border-box;
  flex-direction: column;
}

#result > .search-card {
  background-color: transparent !important;
  filter: none !important;
}

.search- {
  &status {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;

    &-text {
      display: inline-block;
      font-weight: 700;
    }
  }

  &progress {
    display: flex;
    align-items: center;
    margin-top: 4px;
    flex-direction: row;
    width: 100%;

    & > progress {
      flex-grow: 1;
    }

    &-text {
      margin-left: 16px;
      margin-right: 8px;
      display: inline-block;
      font-weight: 700;
    }
  }
}
</style>
