<script setup lang="ts">
import { computed } from 'vue'
import { PhArrowSquareOut, PhCaretDown, PhCaretUp, PhChatCircleText, PhCopy, PhFileText, PhFolderSimple, PhGearSix, PhHouse, PhImage, PhLockKey, PhMagnifyingGlass, PhMoon, PhPencilSimple, PhPlus,
  PhPresentationChart, PhQuestion, PhSignOut, PhSun, PhTag, PhTray, PhTrash, PhUploadSimple, PhUser, PhUsers, PhList, PhListBullets, PhFlag, PhX, PhMegaphone, PhWarning, PhCheckCircle, PhWarningCircle } from '@phosphor-icons/vue'
import type { Component } from 'vue'
const props = defineProps<{ name: string; size?: number; weight?: 'regular' | 'bold' | 'fill' }>()
const M: Record<string, Component> = {
  dash: PhPresentationChart, file: PhFileText, folder: PhFolderSimple, tag: PhTag, image: PhImage, flag: PhFlag, ads: PhMegaphone, cog: PhGearSix, users: PhUsers, list: PhListBullets, user: PhUser,
  menu: PhList, x: PhX, plus: PhPlus, trash: PhTrash, sun: PhSun, moon: PhMoon, out: PhSignOut, copy: PhCopy, up: PhCaretUp, down: PhCaretDown, help: PhQuestion, inbox: PhTray, search: PhMagnifyingGlass,
  edit: PhPencilSimple, upload: PhUploadSimple, lock: PhLockKey, home: PhHouse, chat: PhChatCircleText, external: PhArrowSquareOut, warn: PhWarning, ok: PhCheckCircle, err: PhWarningCircle,
}
const comp = computed(() => M[props.name] ?? PhFileText)
</script>

<template><component :is="comp" :size="size ?? 18" :weight="weight ?? 'regular'" aria-hidden="true" class="shrink-0" /></template>
