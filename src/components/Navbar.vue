<script>
export default {
  name: 'Navbar',
  methods: {
    openWindow(path, width, height) {
      window.open(`#/${path}`, path, `width=${width},height=${height}`);
    },
    test() {
      this.$ipcRenderer.send('test', { videoId: 'r_N_iUUrsJY' });
    },
  },
};
</script>

<template lang="pug">
#navbar
  .navbar-item(@click="openWindow('download', 700, 500)")
    icon(:icon="['fab','youtube']" style="color: red;background:linear-gradient(white,white) center center/20% 70% no-repeat;")
    .navbar-title 유튜브 영상 다운로드
  //- .navbar-item(@click="test()")
  //-   icon(:icon="['fab','youtube']" style="color: red;background:linear-gradient(white,white) center center/20% 70% no-repeat;")
  //-   .navbar-title 비공개 영상 다운로드
  .navbar-item(@click="openWindow('search', 500, 800)")
    icon(icon="search")
    .navbar-title 영상 검색
</template>

<style lang="scss">
#navbar {
  height: 80px;
  width: 100%;
  display: flex;
  flex-direction: row;
  border-bottom: 1px solid #cccccc;
  align-items: center;
  align-content: center;
  justify-content: center;
  background-color: #f3f3f3;
  box-shadow: 0px 15px 15px -3px rgba(0,0,0,0.1);
}

.navbar-item {
  flex-grow: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  align-content: center;
  padding: 0 18px;
  // border-right: 2px solid #4b4b4b;
  cursor: pointer;

  svg {
    font-size: 1.6em;
    height: 25px;
  }

  &:hover {
    background-color: #dbdbdb;
  }
}

.navbar-item:nth-child(2) > .navbar-title {
  margin-top: 1px;
}

// .navbar-item:last-child {
//   border-left: 2px solid #4b4b4b;
//   border-right: 0;
// }

.navbar-title {
  /* margin: 0 0 3px 4px; */
  font-size: 16px;
}

</style>
