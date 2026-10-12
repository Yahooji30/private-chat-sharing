<script setup lang="ts">
/**
 * One Google AdSense placement. Space is reserved up front so nothing jumps when the ad loads.
 * Without NUXT_PUBLIC_ADSENSE_CLIENT it shows a labelled preview box (turn off with NUXT_PUBLIC_ADS_PREVIEW=false).
 * kind: rail = 300x600 sidebar, inline = responsive rectangle inside content, banner = wide strip.
 */
const props = defineProps<{ kind: 'rail' | 'inline' | 'banner' }>()
const cfg = useRuntimeConfig().public as { adsenseClient?: string; adsPreview?: string | boolean; adSlotRail?: string; adSlotInline?: string; adSlotBanner?: string }
const client = String(cfg.adsenseClient ?? '')
const slotId = ({ rail: cfg.adSlotRail, inline: cfg.adSlotInline, banner: cfg.adSlotBanner })[props.kind] ?? ''
const live = !!client && !!slotId
const preview = !live && String(cfg.adsPreview ?? 'true') !== 'false'
const box = ({ rail: 'min-h-[600px] w-[300px]', inline: 'min-h-[280px]', banner: 'min-h-[100px] md:min-h-[90px]' })[props.kind]
const size = ({ rail: '300 x 600', inline: 'Responsive rectangle', banner: 'Responsive banner' })[props.kind]
if (live) useHead({ script: [{ key: 'adsense', async: true, crossorigin: 'anonymous', src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}` }] })
onMounted(() => {
  if (!live) return
  try { ((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle ||= []).push({}) } catch { /* blocked or already filled */ }
})
</script>

<template>
  <aside v-if="live || preview" class="ad-wrap" :aria-label="live ? 'Advertisement' : 'Ad space'">
    <p class="ad-label">Advertisement</p>
    <div class="ad-box" :class="box">
      <ins v-if="live" class="adsbygoogle" style="display:block;width:100%" :data-ad-client="client" :data-ad-slot="slotId" :data-ad-format="kind === 'rail' ? 'vertical' : 'auto'" data-full-width-responsive="true" />
      <div v-else class="ad-preview" :class="box"><span>Ad space<br><small class="font-normal opacity-80">{{ size }}</small></span></div>
    </div>
  </aside>
</template>
