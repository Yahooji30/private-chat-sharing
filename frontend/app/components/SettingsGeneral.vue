<script setup lang="ts">
import type { Settings } from '@sync/shared'
const app = useApp()
const toast = useToast()
const draft = reactive<Settings>({ ...app.settings })
const name = ref(app.device?.name ?? '')
const saving = ref(false)
watch(() => app.settings, s => Object.assign(draft, s))

async function save(): Promise<void> {
  saving.value = true
  try {
    await app.saveSettings({ ...draft })
    if (name.value.trim() && name.value.trim() !== app.device?.name) await app.rename(name.value.trim())
    toast.ok('Settings saved')
  } catch (e) { toast.err((e as Error).message) } finally { saving.value = false }
}
const canNotify = import.meta.client && typeof Notification !== 'undefined'
async function turnNotify(v: boolean): Promise<void> {
  const ok = await app.setNotify(v)
  if (v && !ok) toast.warn('Notifications are blocked. Allow them in your browser settings for this site.')
}
const sel = 'input !min-h-10 !w-auto pr-8 cursor-pointer'
</script>

<template>
  <div class="space-y-3">
    <section class="card p-4 space-y-4">
      <SettingRow title="Theme" desc="Applies to this device only.">
        <select :class="sel" :value="app.theme" aria-label="Theme" @change="app.setTheme(($event.target as HTMLSelectElement).value as 'system')">
          <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
        </select>
      </SettingRow>
      <SettingRow title="Font" desc="Typeface of your text area.">
        <select v-model="draft.fontFamily" :class="sel" aria-label="Font"><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option></select>
      </SettingRow>
      <SettingRow title="Font Size" :desc="`${draft.fontSize}px. Adjust the text size of your text area.`">
        <input v-model.number="draft.fontSize" type="range" min="12" max="28" step="1" class="w-28 accent-[var(--accent)]" aria-label="Font size">
      </SettingRow>
      <SettingRow title="Spellcheck" desc="Underline spelling mistakes while typing."><Toggle :model-value="app.spellcheck" label="Spellcheck" @update:model-value="app.setLocal('spellcheck', $event)" /></SettingRow>
      <SettingRow v-if="canNotify" title="Notifications" desc="Tell me when a file arrives from another device while the app is in the background."><Toggle :model-value="app.notify" label="Notifications" @update:model-value="turnNotify" /></SettingRow>
    </section>

    <section class="card p-4 space-y-4">
      <SettingRow title="Enable Found URLs" desc="Automatically detect and display clickable links in your text.">
        <Toggle v-model="draft.urlsPanel" label="Enable Found URLs" />
      </SettingRow>
      <template v-if="draft.urlsPanel">
        <SettingRow sub title="Open URLs In" desc="New tab or the current tab.">
          <select :value="draft.urlsNewTab ? 'new' : 'same'" :class="sel" aria-label="Open URLs in" @change="draft.urlsNewTab = ($event.target as HTMLSelectElement).value === 'new'">
            <option value="new">New Tab</option><option value="same">Current Tab</option>
          </select>
        </SettingRow>
      </template>
    </section>


    <section class="card p-4 space-y-3">
      <label class="block">
        <span class="font-medium">Device name</span>
        <input v-model="name" class="input mt-1.5" maxlength="40" autocomplete="off">
      </label>
      <SettingRow title="Your IP Address" :desc="`This is how ${useRuntimeConfig().public.appName} identifies your network.`">
        <code class="px-2.5 py-1.5 rounded-lg bg-surface-2 border border-line text-sm font-mono">{{ app.ip }}</code>
      </SettingRow>
    </section>
    <button class="btn btn-accent w-full !min-h-12 text-base" :disabled="saving" @click="save">Save General Settings</button>
  </div>
</template>
