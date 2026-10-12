<script setup lang="ts">
const cfg = useRuntimeConfig()
const name = String(cfg.public.appName)
const appUrl = String(cfg.public.appUrl).replace(/\/$/, '')
const origin = String(cfg.public.siteUrl).replace(/\/$/, '')


await usePageSeo('features', {
  title: `Features | ${name}`,
  description: `Everything ${name} does: live text sync, device-to-device file transfer, QR linking, end-to-end encrypted chat rooms and more. Free, private, no sign-up.`,
  path: '/features',
  schema: [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name, url: appUrl, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any (web browser)', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: features.map(f => f.title) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: origin }, { '@type': 'ListItem', position: 2, name: 'Features', item: `${origin}/features` }] },
  ],
})
async function feedback(): Promise<void> { await navigateTo('/feedback') }
</script>

<template>
  <div class="pt-6 md:pt-10 pb-12">
    <FeaturesView :app-href="appUrl" @feedback="feedback"><template #ad><AdSlot kind="inline" class="mt-12" /></template></FeaturesView>
  </div>
</template>
