<script>
export default {
  name: 'App',
};
</script>

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

input {
  border: 1px solid rgb(197, 197, 197);
  border-radius: 4px;
  padding: 8px;
  margin: 0 8px;
}

button {
  padding: 8px 12px;
  border-radius: 4px;
  border: 0;
  background-color: #197cc7;
  color: white;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

button:hover {
  background-color: #1769a8;
}

button > svg {
  margin-right: 6px;
}

.loader > progress {
  margin: 8px 4px 0 0;
}

// below all rules are from fomantic-ui

.divider {
  margin: 1rem 0;
  line-height: 1;
  height: 0;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: rgba(0,0,0,.85);
  user-select: none;
  border-top: 1px solid rgba(34,36,38,.15);
  border-bottom: 1px solid rgba(255,255,255,.1);
  font-size: 1rem;
}

.dimmer {
  position: absolute;
  top: 0 !important;
  left: 0 !important;
  width: 100%;
  height: 100%;
  text-align: center;
  vertical-align: middle;
  padding: 1em;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  box-sizing: border-box;
}

.dimmer > * {
  user-select: text;
  color: #FFFFFF;
}
</style>
