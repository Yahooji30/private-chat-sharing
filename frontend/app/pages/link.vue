<script setup lang="ts">
useHead({ title: 'Link a device' })
const route = useRoute()
const initial = typeof route.query.c === 'string' ? route.query.c : ''
const done = (): void => { location.href = '/' }
</script>

<template>
  <div class="max-w-md mx-auto pt-6 md:pt-12">
    <div class="card p-5 md:p-6 space-y-4">
      <div class="size-12 rounded-2xl bg-accent-soft text-accent-ink grid place-items-center"><Icon name="link" :size="24" /></div>
      <div>
        <h1 class="text-2xl font-bold">Link this device</h1>
        <p class="text-muted mt-1">Enter the 8-character code shown on your other device, or scan its QR code.</p>
      </div>
      <LinkRedeem :initial="initial" autofocus @done="done" />
    </div>
  </div>
</template>
