<script setup lang="ts">
import { fmtAgo } from '~/utils/format'
interface Dev { id: string; name: string; type: string; linkedAt: number; lastSeenAt: number; self: boolean }
interface Net { id: string; label: string; addedAt: number }
const toast = useToast()
const data = ref<{ devices: Dev[]; networks: Net[]; selfLinked: boolean } | null>(null)
const loading = ref(true)
const icons: Record<string, string> = { phone: 'phone', tablet: 'tablet', desktop: 'desktop' }

async function load(): Promise<void> {
  try { data.value = await api('/link/list') } catch (e) { toast.err((e as Error).message) } finally { loading.value = false }
}
async function unlink(kind: 'device' | 'ip', id: string): Promise<void> {
  if (!confirm('Unlink? That device or network will go back to its own space.')) return
  try { await api(`/link/${kind}/${id}`, { method: 'DELETE' }); toast.ok('Unlinked'); await load() } catch (e) { toast.err((e as Error).message) }
}
onMounted(() => { void load(); window.addEventListener('sync:linked-changed', load) })
onBeforeUnmount(() => window.removeEventListener('sync:linked-changed', load))
</script>

<template>
  <div class="space-y-3">
    <p v-if="loading" class="text-muted text-sm p-4">Loading...</p>
    <template v-else-if="data">
      <section class="card divide-y divide-line">
        <h3 class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">Linked devices</h3>
        <p v-if="!data.devices.length" class="px-4 py-5 text-sm text-muted">No devices linked by code yet. Use Link Device to connect a phone on mobile data.</p>
        <div v-for="d in data.devices" :key="d.id" class="px-4 py-3 flex items-center gap-3">
          <span class="size-10 grid place-items-center rounded-xl bg-surface-2"><Icon :name="icons[d.type] ?? 'desktop'" /></span>
          <div class="min-w-0"><p class="font-medium truncate">{{ d.name }}<span v-if="d.self" class="ml-2 text-[11px] text-accent-ink bg-accent-soft rounded-full px-2 py-0.5">this device</span></p>
            <p class="text-xs text-muted">Linked {{ fmtAgo(d.linkedAt) }} · seen {{ fmtAgo(d.lastSeenAt) }}</p></div>
          <button class="btn ml-auto !px-0 w-10" :aria-label="`Unlink ${d.name}`" @click="unlink('device', d.id)"><Icon name="trash" :size="16" /></button>
        </div>
      </section>
      <section class="card divide-y divide-line">
        <h3 class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">Linked networks</h3>
        <p v-if="!data.networks.length" class="px-4 py-5 text-sm text-muted">No networks linked by IP address.</p>
        <div v-for="n in data.networks" :key="n.id" class="px-4 py-3 flex items-center gap-3">
          <span class="size-10 grid place-items-center rounded-xl bg-surface-2"><Icon name="globe" /></span>
          <div><p class="font-medium">{{ n.label }}</p><p class="text-xs text-muted">Added {{ fmtAgo(n.addedAt) }}</p></div>
          <button class="btn ml-auto !px-0 w-10" :aria-label="`Unlink ${n.label}`" @click="unlink('ip', n.id)"><Icon name="trash" :size="16" /></button>
        </div>
      </section>
    </template>
  </div>
</template>
