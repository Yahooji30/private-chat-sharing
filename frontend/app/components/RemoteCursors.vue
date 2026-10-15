<script setup lang="ts">
import type { RemoteCursor } from '~/composables/useTextSync'

/**
 * Draws the other devices' cursors and selections over the text box, like a shared document.
 * A text box cannot show more than one cursor, so a hidden copy of the text with the same font and width is laid out, and the position
 * of every cursor in that copy tells where to draw it.
 */
const props = defineProps<{ box: HTMLTextAreaElement | null; text: string; cursors: Record<string, RemoteCursor>; fontKey: string }>()
const app = useApp()
const mirror = useTemplateRef<HTMLDivElement>('mirror')
interface Mark { id: string; name: string; color: string; x: number; y: number; h: number; rects: { x: number; y: number; w: number; h: number }[] }
const marks = ref<Mark[]>([])

const COLORS = ['#e0457b', '#2f7be5', '#16a34a', '#d97706', '#8b5cf6', '#0891b2', '#dc2626', '#65a30d']
const colorOf = (id: string): string => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return COLORS[h % COLORS.length]! }
const nameOf = (id: string): string => app.peers.find(p => p.deviceId === id)?.name ?? 'Someone'

const COPY = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderLeftWidth', 'borderTopStyle', 'borderRightStyle', 'borderLeftStyle'] as const

let frame = 0
function schedule(): void {
  if (frame) return
  frame = requestAnimationFrame(() => { frame = 0; layout() })
}

function layout(): void {
  const box = props.box, m = mirror.value
  const list = Object.values(props.cursors)
  if (!box || !m || !list.length) { marks.value = []; return }
  const cs = getComputedStyle(box)
  for (const k of COPY) (m.style as unknown as Record<string, string>)[k] = cs[k]
  m.style.width = `${box.clientWidth + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)}px`
  m.style.boxSizing = 'border-box'
  const text = props.text
  const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5
  const out: Mark[] = []
  for (const c of list) {
    const at = Math.min(c.start, text.length), to = Math.min(Math.max(c.end, at), text.length)
    const pos = (n: number): { x: number; y: number } => {
      m.textContent = ''
      m.append(document.createTextNode(text.slice(0, n)))
      const tick = document.createElement('span'); tick.textContent = '​'; m.append(tick)
      m.append(document.createTextNode(text.slice(n) || '​'))
      return { x: tick.offsetLeft - box.scrollLeft, y: tick.offsetTop - box.scrollTop }
    }
    const head = pos(at)
    const rects: Mark['rects'] = []
    if (to > at) {
      // the selection: one block per line, found by asking the browser where the selected words sit
      const first = pos(at), last = pos(to)
      if (first.y === last.y) rects.push({ x: first.x, y: first.y, w: Math.max(2, last.x - first.x), h: line })
      else {
        const width = box.clientWidth - parseFloat(cs.paddingRight)
        rects.push({ x: first.x, y: first.y, w: Math.max(2, width - first.x), h: line })
        for (let y = first.y + line; y < last.y - 1; y += line) rects.push({ x: parseFloat(cs.paddingLeft), y, w: width - parseFloat(cs.paddingLeft), h: line })
        rects.push({ x: parseFloat(cs.paddingLeft), y: last.y, w: Math.max(2, last.x - parseFloat(cs.paddingLeft)), h: line })
      }
    }
    out.push({ id: c.deviceId, name: nameOf(c.deviceId), color: colorOf(c.deviceId), x: head.x, y: head.y, h: line, rects })
  }
  marks.value = out
}

watch(() => [props.text, props.cursors, props.box, props.fontKey, app.peers], schedule, { deep: false })
let scrollEl: HTMLTextAreaElement | null = null
watch(() => props.box, b => {
  scrollEl?.removeEventListener('scroll', schedule); scrollEl = b
  b?.addEventListener('scroll', schedule, { passive: true })
  schedule()
}, { immediate: true })
const resize = (): void => schedule()
onMounted(() => window.addEventListener('resize', resize))
onBeforeUnmount(() => { window.removeEventListener('resize', resize); scrollEl?.removeEventListener('scroll', schedule); cancelAnimationFrame(frame) })
</script>

<template>
  <div class="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" data-testid="remote-cursors">
    <div ref="mirror" class="absolute left-0 top-0 invisible whitespace-pre-wrap break-words" style="overflow-wrap: break-word; word-break: normal" />
    <template v-for="m in marks" :key="m.id">
      <span v-for="(r, i) in m.rects" :key="i" class="absolute rounded-sm" :style="{ left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, background: m.color, opacity: 0.22 }" />
      <span class="absolute transition-[left,top] duration-100 ease-out" :style="{ left: `${m.x}px`, top: `${m.y}px`, height: `${m.h}px`, borderLeft: `2px solid ${m.color}` }" data-testid="remote-caret">
        <span class="absolute left-[-2px] bottom-full -translate-y-px whitespace-nowrap rounded-md rounded-bl-none px-1.5 py-px text-[10px] font-semibold leading-tight text-white max-w-40 truncate" :style="{ background: m.color }">{{ m.name }}</span>
      </span>
    </template>
  </div>
</template>
