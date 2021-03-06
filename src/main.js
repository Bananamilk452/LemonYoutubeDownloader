import Vue from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faLink, faSearch, faCog, faRedoAlt, faTimes, faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { faYoutube } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import App from './App.vue';
import router from './router';
import store from './store';

const { version } = require('../package.json');

library.add(faLink);
library.add(faSearch);
library.add(faCog);
library.add(faRedoAlt);
library.add(faYoutube);
library.add(faTimes);
library.add(faExclamationTriangle);

Vue.component('icon', FontAwesomeIcon);

Vue.config.productionTip = false;
Vue.prototype.$ipcRenderer = window.ipcRenderer;
Vue.prototype.$version = version;
// eslint-disable-next-line func-names
Vue.prototype.$openBrowser = function (url) {
  window.ipcRenderer.send('openBrowser', url);
};

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');
