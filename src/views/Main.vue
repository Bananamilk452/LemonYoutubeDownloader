<script>
import Navbar from '@/components/Navbar.vue';

export default {
  name: 'Main',
  components: {
    Navbar,
  },
};
</script>

<template lang="pug">
#main
  Navbar
  #result
    | 유튜브 링크를 복사하고 "링크 분석" 버튼을 누르거나 영상 검색 버튼을 눌러서 검색 후 영상을 다운로드하세요!
    button(onclick="location.href = '/search'") 테스트
</template>

<style lang="scss">
#result {
  // background-color: #F7F4CA;
  height: calc(100% - 45px);
  width: 100%;
  overflow-y: auto;
  padding: 12px 24px;
  box-sizing: border-box;
}
</style>
