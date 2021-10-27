<template lang="pug">
  #app
    router-view
</template>

<style lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');

#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans KR', 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  // -webkit-font-smoothing: antialiased;
  // -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #171717;
}

body {
  margin: 0;
}

img {
  display: block;
}

html, body, #app, #main {
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>
