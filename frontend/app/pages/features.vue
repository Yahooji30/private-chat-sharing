<script setup lang="ts">
const name = String(useRuntimeConfig().public.appName)
const blogUrl = useApp().blogUrl
const feedback = useState('feedback-open', () => false)
useAppSeo('features', { title: `Features | ${name}`, description: `Everything ${name} does: live text sync, device-to-device file transfer, QR linking, end-to-end encrypted chat rooms and more. Free, private, no sign-up.` })
// the server-rendered copy on the blog site is the one search engines index
useHead({ link: blogUrl ? [{ rel: 'canonical', href: `${blogUrl}/features` }] : [] })
</script>

<template>
  <div class="pt-3 lg:pt-1">
    <FeaturesView app-href="/" internal @feedback="feedback = true"><template #ad><AdSlot kind="inline" class="mt-12" /></template></FeaturesView>
  </div>
</template>
