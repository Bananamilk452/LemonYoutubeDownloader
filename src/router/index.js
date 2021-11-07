import Vue from 'vue';
import VueRouter from 'vue-router';
import Main from '../views/Main.vue';
import Search from '../views/Search.vue';
import Download from '../views/Download.vue';

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    name: 'Main',
    component: Main,
  },
  {
    path: '/search',
    name: 'Search',
    component: Search,
  },
  {
    path: '/download',
    name: 'Download',
    component: Download,
  },
  {
    path: '/direct/:id',
    name: 'Direct',
    component: Download,
  },
];

const router = new VueRouter({
  mode: 'hash',
  base: process.env.BASE_URL,
  routes,
});

export default router;
