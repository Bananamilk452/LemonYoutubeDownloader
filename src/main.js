import Vue from 'vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faLink, faSearch, faSlidersH, faRedoAlt, faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { faYoutube } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import App from './App.vue';
import router from './router';
import store from './store';

library.add(faLink);
library.add(faSearch);
library.add(faSlidersH);
library.add(faRedoAlt);
library.add(faYoutube);
library.add(faTimes);

Vue.component('icon', FontAwesomeIcon);

Vue.config.productionTip = false;
Vue.prototype.$ipcRenderer = window.ipcRenderer;

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');
