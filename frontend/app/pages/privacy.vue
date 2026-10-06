<script setup lang="ts">
useHead({ title: 'Privacy' })
const name = useRuntimeConfig().public.appName
</script>

<template>
  <article class="max-w-2xl mx-auto pt-6 prose-page">
    <h1>Privacy</h1>
    <p>Last updated: <time datetime="2026-10-06">6 October 2026</time></p>
      <h2>What we store</h2>
      <p>{{ name }} identifies a network by a keyed hash of its public IP address. We never store raw IP addresses. Text you type is encrypted at rest. Files travel directly between your devices and are never stored on our servers.</p>
      <h2>Secure chat</h2>
      <p>Chat messages are end-to-end encrypted in your browser. The server relays ciphertext only, keeps a short temporary buffer in memory, and deletes it when the room empties.</p>
      <h2>Cookies</h2>
      <p>One cookie identifies your device so linked devices and settings work. It is not used for tracking.</p>
  </article>
</template>
