<script>
/* eslint-disable consistent-return */
/* eslint-disable vue/return-in-computed-property */
export default {
  name: 'Table',
  props: {
    type: String,
    format: Array,
    rawformat: Array,
    fastdl: Boolean,
    headlessdata: Array,
  },
  methods: {
    codecString(container, videoCodec, audioCodec) {
      if (audioCodec && videoCodec) return `${container.toUpperCase()} / ${this.codecSplit(videoCodec).toUpperCase()} / ${this.codecSplit(audioCodec).toUpperCase()}`;
      if (videoCodec) return `${container.toUpperCase()} / ${this.codecSplit(videoCodec).toUpperCase()}`;
      return `${container.toUpperCase()} / ${this.codecSplit(audioCodec).toUpperCase()}`;
    },
    codecSplit(str) {
      if (str.includes('.')) return str.split('.')[0];
      return str;
    },
    formatBytes(bytes, decimals = 2) {
      if (bytes === undefined) return '조회 실패';
      if (bytes === 0) return '0 Bytes';

      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
    },
    bitrateToqualityLabel(bitrate) {
      if (bitrate >= 160) return this.headlessdata[0];
      if (bitrate >= 128) return '480p';
      if (bitrate >= 64) return '240p';
      if (bitrate >= 48) return '144p';
      return this.headlessdata[0];
    },
  },
  computed: {
    fastDownload() {
      if (this.type === 'video') {
        const vp9 = this.format.filter((x) => x.videoCodec.includes('vp9'));
        const result = [];
        this.headlessdata.forEach((q) => {
          const find = vp9.find((v) => v.qualityLabel === q);
          if (Number(find.qualityLabel.split('p')[0]) > 1080 || find.qualityLabel.endsWith('p60')) result.push(find);
          else {
            find.container = 'MP4';
            find.videoCodec = 'AV1';
            result.push(find);
          }
        });
        return result;
      }
      if (this.type === 'audio') {
        return [this.rawformat.filter((x) => x.hasAudio && !x.hasVideo).sort((a, b) => b.audioBitrate - a.audioBitrate)[0]];
      }
    },
    normalDownload() {
      if (this.type === 'video') {
        return this.format;
      }
      if (this.type === 'audio') {
        return this.rawformat.filter((x) => x.hasAudio && !x.hasVideo).sort((a, b) => b.audioBitrate - a.audioBitrate);
      }
    },
  },
};
</script>

<template lang="pug">
//- // TODO: 구조 효율적으로 바꾸기
.list-table-wrapper(v-if="fastdl")
  p(v-if="type === 'audio'") ※ 빠른 다운로드에서는 최상 품질만 선택할 수 있습니다.
  table.list-table
    thead
      tr(v-show="type === 'video'")
        th 선택
        th 화질
        th 해상도
        th 추청되는 유형
        th 크기
      tr(v-show="type === 'audio'")
        th 선택
        th 비트레이트
        th 샘플레이트
        th 코덱
        th 크기
    tbody(v-if="type === 'video'")
      tr(v-for="o in fastDownload")
        td
          input(type="radio" name="selection" v-model="$store.state.selection" :value="JSON.stringify({ fast: fastdl, quality: o.qualityLabel, itag: o.itag, type: type, codec: o.codecs})")
        td {{ o.qualityLabel }}
        td {{ o.width }}x{{o.height}}
        td {{ codecString(o.container, o.videoCodec, o.audioCodec) }}
        td {{ formatBytes(o.contentLength) }}
    tbody(v-if="type === 'audio'")
      tr(v-for="o in fastDownload")
        td
          input(type="radio" name="selection" v-model="$store.state.selection" :value="JSON.stringify({ fast: fastdl, quality: bitrateToqualityLabel(o.audioBitrate), itag: o.itag, type: type, codec: o.codecs})")
        td {{ o.audioBitrate }}kbps
        td {{ o.audioSampleRate }}hz
        td {{ o.codecs }}
        td {{ formatBytes(o.contentLength) }}
.list-table-wrapper(v-else)
  table.list-table
    thead
      tr(v-show="type === 'video'")
        th 선택
        th 화질
        th 해상도
        th 유형
        th 크기
      tr(v-show="type === 'audio'")
        th 선택
        th 비트레이트
        th 샘플레이트
        th 코덱
        th 크기
    tbody(v-if="type === 'video'")
      tr(v-for="o in normalDownload")
        td
          input(type="radio" name="selection" v-model="$store.state.selection" :value="{ fast: fastdl, quality: o.qualityLabel, itag: o.itag, type: type, codec: o.codecs}")
        td {{ o.qualityLabel }}
        td {{ o.width }}x{{o.height}}
        td {{ codecString(o.container, o.videoCodec, o.audioCodec) }}
        td {{ formatBytes(o.contentLength) }}
    tbody(v-if="type === 'audio'")
      tr(v-for="o in normalDownload")
        td
          input(type="radio" name="selection" v-model="$store.state.selection" :value="{ fast: fastdl, quality: bitrateToqualityLabel(o.audioBitrate), itag: o.itag, type: type, codec: o.codecs}")
        td {{ o.audioBitrate }}kbps
        td {{ o.audioSampleRate }}hz
        td {{ o.codecs }}
        td {{ formatBytes(o.contentLength) }}
</template>

<style lang="scss">
.list-{
  &table-wrapper {
    overflow: auto;
    border: 2px solid #171717;
    border-radius: 3px;
    padding: 8px;
    flex-grow: 1;
  }

  &table, &table > thead, tbody > &table {
    width: 100%;
    overflow-y: auto;    /* Trigger vertical scroll    */
    overflow-x: hidden;  /* Hide the horizontal scroll */
  }
}
</style>
