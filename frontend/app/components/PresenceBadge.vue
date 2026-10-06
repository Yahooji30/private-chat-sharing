<script setup lang="ts">
const app = useApp()
const open = ref(false)
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const icons: Record<string, string> = { phone: 'phone', tablet: 'tablet', desktop: 'desktop' }
onClickOutside(useTemplateRef('root'), () => { open.value = false })
</script>

<template>
  <div v-if="mounted && app.ready" ref="root" class="relative">
    <button class="btn !px-2.5 gap-1.5" :aria-expanded="open" :aria-label="`Devices online: ${Math.max(app.peers.length, app.online ? 1 : 0)}`" @click="open = !open">
      <span class="size-2 rounded-full" :class="app.online ? 'bg-ok' : 'bg-muted'" />
      <Icon name="users" :size="16" /><span class="text-sm tabular-nums">{{ Math.max(app.peers.length, app.online ? 1 : 0) }}</span>
    </button>
    <div v-if="open" class="anim-pop absolute right-0 mt-2 w-64 card shadow-card p-2 z-40">
      <p class="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted">Online now</p>
      <ul>
        <li v-for="p in app.peers" :key="p.deviceId" class="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          <Icon :name="icons[p.type] ?? 'desktop'" class="text-muted" />
          <span class="truncate text-sm font-medium">{{ p.name }}</span>
          <span v-if="p.self" class="ml-auto text-[11px] text-accent-ink bg-accent-soft rounded-full px-2 py-0.5">this device</span>
        </li>
        <li v-if="!app.peers.length" class="px-2 py-2 text-sm text-muted">Only you right now.</li>
      </ul>
      <button class="btn w-full mt-1" @click="open = false; app.openSettings('link')"><Icon name="link" :size="16" />Link another device</button>
    </div>
  </div>
</template>
