import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/EventsList.vue') },
    { path: '/events/:id', component: () => import('./views/EventDetail.vue'), props: true },
  ],
});
