<script setup lang="ts">
/** Light / dark switch. Light is the default; the choice is remembered on this device. The icons swap with CSS, so the server-rendered page and the browser agree. */
function toggle(): void {
  const dark = !document.documentElement.classList.contains('dark')
  document.documentElement.classList.toggle('dark', dark)
  try { localStorage.setItem('sync:theme', dark ? 'dark' : 'light') } catch { /* storage blocked */ }
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#0A0E1C' : '#F7F8FC'))
}
</script>

<template>
  <button type="button" class="btn !px-0 size-10 shrink-0" aria-label="Switch between light and dark theme" title="Light / dark" @click="toggle">
    <Icon name="sun" :size="20" class="dark:hidden" /><Icon name="moon" :size="20" class="hidden dark:block" />
  </button>
</template>
