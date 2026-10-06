<script setup lang="ts">
useHead({ title: 'Edit page', meta: [{ name: 'robots', content: 'noindex' }] })
const route = useRoute()
const token = typeof route.query.k === 'string' ? route.query.k : undefined
</script>

<template><PageEditor :slug="String(route.params.slug)" :token="token" /></template>
