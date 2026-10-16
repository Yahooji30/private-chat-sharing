<script setup lang="ts">
const name = String(useRuntimeConfig().public.appName)
const feedback = useState('feedback-open', () => false)
useAppSeo('features', { title: `Features | ${name}`, description: `Everything ${name} does: live text sync, device-to-device file transfer, QR linking, end-to-end encrypted chat rooms and more. Free, private, no sign-up.` })
</script>

<template>
  <div class="pt-3 lg:pt-1">
    <FeaturesView app-href="/" internal @feedback="feedback = true"><template #ad><AdSlot kind="inline" class="mt-12" /></template></FeaturesView>
  </div>
</template>
