import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { router, wireUnauthorized } from './router'
import './style.css'

const app = createApp(App).use(createPinia()).use(router)
wireUnauthorized()
app.mount('#app')
