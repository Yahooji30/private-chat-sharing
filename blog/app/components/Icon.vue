<script setup lang="ts">
/** Phosphor icons behind one small name map, so call sites stay `<Icon name="copy" />`. */
import { PhArrowSquareOut, PhArrowsClockwise, PhCaretDown, PhCheck, PhCheckCircle, PhChatCircleText, PhClipboardText, PhCopy, PhDesktop, PhDeviceMobile, PhDeviceTablet,
  PhDownloadSimple, PhEnvelopeSimple, PhEye, PhEyeSlash, PhFileText, PhFileZip, PhGearSix, PhGlobeHemisphereWest, PhHouse, PhKey, PhLink, PhLockKey, PhMoon, PhPause, PhPaperPlaneRight,
  PhPlay, PhPlus, PhQrCode, PhQuestion, PhShareNetwork, PhShieldCheck, PhSun, PhTrash, PhUploadSimple, PhUsers, PhWarning, PhWhatsappLogo, PhWifiHigh, PhX, PhNewspaper, PhSparkle, PhStar, PhLightning, PhDevices, PhArrowsLeftRight, PhFingerprint, PhDownloadSimple as PhDl, PhFiles, PhLockSimple, PhArrowRight, PhCloudSlash, PhCursorClick } from '@phosphor-icons/vue'
import type { Component } from 'vue'

const props = defineProps<{ name: string; size?: number; weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone' }>()
const M: Record<string, Component> = {
  copy: PhCopy, paste: PhClipboardText, link: PhLink, upload: PhUploadSimple, download: PhDownloadSimple, refresh: PhArrowsClockwise, x: PhX, settings: PhGearSix, sun: PhSun, moon: PhMoon,
  home: PhHouse, chat: PhChatCircleText, globe: PhGlobeHemisphereWest, qr: PhQrCode, share: PhShareNetwork, key: PhKey, check: PhCheck, checkCircle: PhCheckCircle, alert: PhWarning,
  trash: PhTrash, file: PhFileText, users: PhUsers, eye: PhEye, mask: PhEyeSlash, external: PhArrowSquareOut, send: PhPaperPlaneRight, whatsapp: PhWhatsappLogo, mail: PhEnvelopeSimple,
  lock: PhLockKey, plus: PhPlus, phone: PhDeviceMobile, desktop: PhDesktop, tablet: PhDeviceTablet, chevron: PhCaretDown, pause: PhPause, play: PhPlay, zip: PhFileZip, shield: PhShieldCheck,
  wifi: PhWifiHigh, faq: PhQuestion, blog: PhNewspaper, features: PhSparkle, star: PhStar, bolt: PhLightning, devices: PhDevices, swap: PhArrowsLeftRight, fingerprint: PhFingerprint, files: PhFiles, lockSimple: PhLockSimple, arrowRight: PhArrowRight, noCloud: PhCloudSlash, tap: PhCursorClick,
}
const comp = computed(() => M[props.name] ?? PhFileText)
</script>

<template>
  <component :is="comp" :size="size ?? 20" :weight="weight ?? 'regular'" aria-hidden="true" class="shrink-0" />
</template>
