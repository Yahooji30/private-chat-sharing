<script setup lang="ts">
const app = useApp()
const tabs = [{ id: 'general', label: 'General' }, { id: 'link', label: 'Link Device' }, { id: 'linked', label: 'Linked Devices' }] as const
</script>

<template>
  <Modal :open="app.settingsOpen" title="Settings" subtitle="Manage your preferences and linked devices." @close="app.settingsOpen = false">
    <div class="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-2 mb-4" role="tablist">
      <button v-for="t in tabs" :key="t.id" role="tab" :aria-selected="app.settingsTab === t.id" class="h-10 rounded-lg text-sm font-medium transition px-1"
        :class="app.settingsTab === t.id ? 'bg-surface shadow-sm text-ink' : 'text-muted hover:text-ink'" @click="app.settingsTab = t.id">{{ t.label }}</button>
    </div>
    <SettingsGeneral v-if="app.settingsTab === 'general'" />
    <LinkDevice v-else-if="app.settingsTab === 'link'" />
    <LinkedDevices v-else />
  </Modal>
</template>
