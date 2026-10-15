<script setup lang="ts">
const app = useApp()
const open = ref(false)
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const icons: Record<string, string> = { phone: 'phone', tablet: 'tablet', desktop: 'desktop' }
const count = computed(() => Math.max(app.peers.length, app.online ? 1 : 0))
</script>

<template>
  <div v-if="mounted && app.ready">
    <button class="btn !px-2.5 gap-1.5" :aria-expanded="open" aria-haspopup="dialog" :aria-label="`Devices online: ${count}`" @click="open = true">
      <span class="size-2 rounded-full" :class="app.online ? 'bg-ok' : 'bg-muted'" />
      <Icon name="users" :size="16" /><span class="text-sm tabular-nums">{{ count }}</span>
    </button>

    <!-- the same pop-up as Settings: a sheet from the bottom on phones, a centred window on bigger screens, never cut off -->
    <Modal :open="open" title="Devices online" subtitle="Everything on your network and every device you linked." @close="open = false">
      <ul class="space-y-1.5" data-testid="devices-list">
        <li v-for="p in app.peers" :key="p.deviceId" class="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 px-3 py-2.5">
          <span class="size-9 rounded-lg grid place-items-center bg-surface border border-line shrink-0"><Icon :name="icons[p.type] ?? 'desktop'" class="text-muted" /></span>
          <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ p.name }}</span>
          <span v-if="p.self" class="shrink-0 text-[11px] font-medium text-accent-ink bg-accent-soft rounded-full px-2.5 py-1">this device</span>
        </li>
        <li v-if="!app.peers.length" class="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">Only you right now.</li>
      </ul>
      <button class="btn btn-accent w-full !min-h-11 mt-4" @click="open = false; app.openSettings('link')"><Icon name="link" :size="16" />Link another device</button>
    </Modal>
  </div>
</template>
