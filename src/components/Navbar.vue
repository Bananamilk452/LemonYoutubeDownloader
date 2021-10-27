<script>
export default {
  name: 'Navbar',
};
</script>

<template lang="pug">
#navbar
  .navbar-item
    icon(:icon="['fab','youtube']" style="color: red;background:linear-gradient(white,white) center center/20% 70% no-repeat;")
    .navbar-title 링크 분석
  .navbar-item
    icon(icon="search")
    .navbar-title 영상 검색
  div(style="flex-grow: 1")
  .navbar-item
    icon(icon="sliders-h")
    .navbar-title 환경 설정
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
  /* flex-grow: 1; */
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
