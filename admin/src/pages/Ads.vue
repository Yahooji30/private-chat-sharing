<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'
import { fail, ok } from '../ui'

interface Slot { key: string; enabled: boolean; html: string }
const slots = ref<Slot[]>([]), globalOn = ref(false)
const hint: Record<string, string> = { 'top-banner': 'Below the header on the home page', sidebar: 'Beside articles (desktop)', 'in-article': 'Inside article pages', footer: 'Bottom of blog pages' }
async function load(): Promise<void> {
  try { slots.value = await api<Slot[]>('/admin/ad-slots'); globalOn.value = (await api<Record<string, string>>('/admin/site-settings')).ads_enabled === 'true' } catch (e) { fail(e) }
}
onMounted(load)
async function saveGlobal(): Promise<void> { try { await api('/admin/site-settings', { method: 'PUT', body: { ads_enabled: String(globalOn.value) } }); ok(globalOn.value ? 'Ads enabled' : 'Ads disabled') } catch (e) { fail(e) } }
async function save(s: Slot): Promise<void> { try { await api(`/admin/ad-slots/${s.key}`, { method: 'PUT', body: { enabled: s.enabled, html: s.html } }); ok('Saved') } catch (e) { fail(e) } }
</script>

<template>
  <div class="space-y-4 max-w-3xl"><h1 class="text-2xl font-bold">Ads</h1>
    <label class="card p-4 flex items-center gap-3 cursor-pointer"><input v-model="globalOn" type="checkbox" class="size-5 accent-[var(--accent)]" @change="saveGlobal"><span><span class="font-semibold block">Show ads site-wide</span><span class="text-sm text-muted">Visitors can still hide ads for themselves. Ads never appear in secure chat.</span></span></label>
    <div v-for="s in slots" :key="s.key" class="card p-4 space-y-2">
      <div class="flex items-center gap-3"><div class="mr-auto"><p class="font-semibold">{{ s.key }}</p><p class="text-xs text-muted">{{ hint[s.key] }}</p></div><label class="flex items-center gap-2 text-sm"><input v-model="s.enabled" type="checkbox" class="size-4 accent-[var(--accent)]" :aria-label="`Enable ${s.key}`">Enabled</label></div>
      <textarea v-model="s.html" class="input font-mono !text-xs" rows="4" placeholder="Ad HTML or AdSense snippet" :aria-label="`HTML for ${s.key}`" />
      <button class="btn" @click="save(s)">Save slot</button>
    </div>
  </div>
</template>
