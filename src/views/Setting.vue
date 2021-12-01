<script>
export default {
  name: 'Setting',
  data() {
    return {
      setting: {
        videotype: 'mp4',
        audiotype: 'mp3',
      },
    };
  },
  created() {
    document.title = '환경 설정';

    this.$ipcRenderer.send('setting fetch');

    this.$ipcRenderer.on('setting data', (data) => {
      this.setting = JSON.parse(data);
    });
  },
  methods: {
    save() {
      console.log('lol');
      this.$ipcRenderer.send('setting save', JSON.stringify(this.setting));
      window.close();
    },
    cancel() {
      window.close();
    },
  },
};
</script>

<template lang="pug">
#setting-container
  #setting
    .setting-title 환경 설정
    .divider(style="width:100%;")
    form.setting-form(@submit.prevent)
      .setting-form-title 저장
      .setting-form-field
        label(for="videotype") 비디오 저장 타입
        select(name="videotype" v-model="setting.videotype")
          option(value="mp4") mp4
          option(value="mkv") mkv
      .setting-form-field
        label(for="audiotype") 오디오 저장 타입
        select(name="audiotype" v-model="setting.audiotype")
          option(value="mp3") mp3
          option(value="ogg") ogg
  .setting-action
    button.setting-save(@click="save()") 저장
    button.setting-cancel(@click="cancel()") 취소
</template>

<style lang="scss">
#setting {
  padding: 16px 16px 58px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
}

.setting- {
  &title {
    font-size: 22px;
    font-weight: 700;
    text-align: left;
  }

  &action {
    position: fixed;
    height: 50px;
    border-top: 1px solid rgba(34, 36, 38, 0.15);
    width: 100%;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;

    & > * {
      margin-right: 10px;
    }
  }

  &cancel {
    background-color: #d81919;

    &:hover {
      background-color: #ad1c1c;
    }
  }

  &form {
    &-title {
      font-size: 17px;
      font-weight: 700;
      text-align: left;
      margin-bottom: 4px;
    }

    &-field {
      margin: 8px 0;

      label {
        margin-right: 6px;
      }

      select {
        padding: 2px;
      }
    }
  }
}
</style>
