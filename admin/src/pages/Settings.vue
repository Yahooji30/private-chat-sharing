<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { DEFAULT_CHAT_SHARE_MESSAGE, HIDEABLE_PAGES, hiddenPageKeys } from '@sync/shared'
import { api } from '../api'
import RichEditor from '../components/RichEditor.vue'
import { fail, ok } from '../ui'

const tab = ref<'general' | 'pages' | 'legal' | 'social'>('general')
/** the pages switched off on the website; the switches below show the opposite (on = visible) */
const hidden = ref<string[]>([])
const f = reactive<Record<string, string>>({ site_name: '', tagline: '', default_og_media_id: '', social_x: '', social_facebook: '', social_instagram: '', social_youtube: '', analytics_id: '', chat_share_message: '', hidden_pages: '', privacy_md: '', terms_md: '' })
onMounted(async () => { try { Object.assign(f, await api<Record<string, string>>('/admin/site-settings')); hidden.value = hiddenPageKeys(f.hidden_pages) } catch (e) { fail(e) } })
const shown = (key: string): boolean => !hidden.value.includes(key)
function setShown(key: string, on: boolean): void { hidden.value = on ? hidden.value.filter(k => k !== key) : [...hidden.value, key] }
const groups: Record<string, string[]> = { general: ['site_name', 'tagline', 'default_og_media_id', 'chat_share_message'], pages: [], legal: ['privacy_md', 'terms_md'], social: ['social_x', 'social_facebook', 'social_instagram', 'social_youtube', 'analytics_id'] }
const names: Record<string, string> = { site_name: 'Site name', tagline: 'Tagline', default_og_media_id: 'Default social image (media id)', social_x: 'X (Twitter) URL', social_facebook: 'Facebook URL', social_instagram: 'Instagram URL', social_youtube: 'YouTube URL', analytics_id: 'Analytics ID', chat_share_message: 'Secret chat invite message', privacy_md: 'Privacy policy (Markdown)', terms_md: 'Terms of service (Markdown)' }
const hints: Record<string, string> = { chat_share_message: 'Sent with the room link when someone taps WhatsApp, Email, SMS, Share or Copy message in a chat room. Put {link} where the link should go (if you leave it out, the link is added on a new line) and {password} where the room password should go. If the person sending turns "Include the password" off, the message says the password comes separately.' }
async function save(): Promise<void> {
  const body = tab.value === 'pages' ? { hidden_pages: hidden.value.join(',') } : Object.fromEntries((groups[tab.value] ?? []).map(k => [k, f[k] ?? '']))
  try { await api('/admin/site-settings', { method: 'PUT', body }); ok('Settings saved') } catch (e) { fail(e) }
}
</script>

<template>
  <div class="space-y-4 max-w-3xl"><h1 class="text-2xl font-semibold">Site settings</h1>
    <div class="inline-flex rounded-xl bg-surface-2 p-1" role="tablist"><button v-for="t in (['general', 'pages', 'legal', 'social'] as const)" :key="t" role="tab" :aria-selected="tab === t" class="px-4 h-9 rounded-lg text-sm font-medium capitalize" :class="tab === t ? 'bg-surface shadow-sm' : 'text-muted'" @click="tab = t">{{ t === 'social' ? 'Social & analytics' : t }}</button></div>
    <form class="card p-4 space-y-3" @submit.prevent="save">
      <div v-if="tab === 'pages'" class="space-y-1">
        <p class="text-sm text-muted">Switch a page off to take it out of the website: its links disappear from the menus and footer, and anyone opening its address is sent to the home page. Switch it on again at any time. Nothing is deleted.</p>
        <label v-for="p in HIDEABLE_PAGES" :key="p.key" class="flex items-center justify-between gap-4 py-3 border-t border-line cursor-pointer">
          <span><span class="font-medium block">{{ p.label }}</span><span class="text-xs text-muted">{{ p.desc }}</span></span>
          <span class="flex items-center gap-2 shrink-0 text-sm" :class="shown(p.key) ? 'text-ok' : 'text-muted'">{{ shown(p.key) ? 'Shown' : 'Hidden' }}
            <input type="checkbox" role="switch" class="size-5 accent-[var(--accent)]" :checked="shown(p.key)" :aria-label="`Show ${p.label} on the website`" @change="setShown(p.key, ($event.target as HTMLInputElement).checked)"></span>
        </label>
      </div>
      <div v-for="k in groups[tab]" :key="k"><label class="label" :for="k">{{ names[k] }}</label>
        <RichEditor v-if="k.endsWith('_md')" :model-value="f[k] ?? ''" @update:model-value="f[k] = $event" :label="names[k] ?? k" placeholder="Write this page. Leave it empty to show the built-in text." min-height="18rem" />
        <textarea v-else-if="k === 'chat_share_message'" :id="k" v-model="f[k]" class="input" rows="9" maxlength="500" :placeholder="DEFAULT_CHAT_SHARE_MESSAGE" /><input v-else :id="k" v-model="f[k]" class="input">
        <p v-if="hints[k]" class="text-xs text-muted mt-1">{{ hints[k] }}</p></div>
      <button class="btn btn-accent">Save</button>
    </form>
  </div>
</template>
