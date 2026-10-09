<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { DEFAULT_CHAT_SHARE_MESSAGE } from '@sync/shared'
import { api } from '../api'
import { fail, ok } from '../ui'

const tab = ref<'general' | 'legal' | 'social'>('general')
const f = reactive<Record<string, string>>({ site_name: '', tagline: '', default_og_media_id: '', social_x: '', social_facebook: '', social_instagram: '', social_youtube: '', analytics_id: '', chat_share_message: '', privacy_md: '', terms_md: '' })
onMounted(async () => { try { Object.assign(f, await api<Record<string, string>>('/admin/site-settings')) } catch (e) { fail(e) } })
const groups: Record<string, string[]> = { general: ['site_name', 'tagline', 'default_og_media_id', 'chat_share_message'], legal: ['privacy_md', 'terms_md'], social: ['social_x', 'social_facebook', 'social_instagram', 'social_youtube', 'analytics_id'] }
const names: Record<string, string> = { site_name: 'Site name', tagline: 'Tagline', default_og_media_id: 'Default social image (media id)', social_x: 'X (Twitter) URL', social_facebook: 'Facebook URL', social_instagram: 'Instagram URL', social_youtube: 'YouTube URL', analytics_id: 'Analytics ID', chat_share_message: 'Secret chat invite message', privacy_md: 'Privacy policy (Markdown)', terms_md: 'Terms of service (Markdown)' }
const hints: Record<string, string> = { chat_share_message: 'Sent with the room link when someone taps Share, WhatsApp, Telegram, Email or Copy message in a chat room. Put {link} where the link should go; if you leave it out, the link is added on a new line. The room password is never included, so people are told to ask for it.' }
async function save(): Promise<void> {
  try { await api('/admin/site-settings', { method: 'PUT', body: Object.fromEntries((groups[tab.value] ?? []).map(k => [k, f[k] ?? ''])) }); ok('Settings saved') } catch (e) { fail(e) }
}
</script>

<template>
  <div class="space-y-4 max-w-3xl"><h1 class="text-2xl font-bold">Site settings</h1>
    <div class="inline-flex rounded-xl bg-surface-2 p-1" role="tablist"><button v-for="t in (['general', 'legal', 'social'] as const)" :key="t" role="tab" :aria-selected="tab === t" class="px-4 h-9 rounded-lg text-sm font-medium capitalize" :class="tab === t ? 'bg-surface shadow-sm' : 'text-muted'" @click="tab = t">{{ t === 'social' ? 'Social & analytics' : t }}</button></div>
    <form class="card p-4 space-y-3" @submit.prevent="save">
      <div v-for="k in groups[tab]" :key="k"><label class="label" :for="k">{{ names[k] }}</label>
        <textarea v-if="k.endsWith('_md')" :id="k" v-model="f[k]" class="input font-mono !text-[13px]" rows="12" />
        <textarea v-else-if="k === 'chat_share_message'" :id="k" v-model="f[k]" class="input" rows="3" maxlength="500" :placeholder="DEFAULT_CHAT_SHARE_MESSAGE" /><input v-else :id="k" v-model="f[k]" class="input">
        <p v-if="hints[k]" class="text-xs text-muted mt-1">{{ hints[k] }}</p></div>
      <button class="btn btn-accent">Save</button>
    </form>
  </div>
</template>
