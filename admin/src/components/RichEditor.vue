<script setup lang="ts">
/** Visual page editor. The page text is still stored as Markdown, so the site renders it exactly as before. */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { Markdown } from 'tiptap-markdown'
import { PhArrowUUpLeft, PhArrowUUpRight, PhCode, PhCodeBlock, PhImage, PhLink, PhListBullets, PhListNumbers, PhMinus, PhQuotes, PhTable, PhTextB, PhTextHOne, PhTextHThree, PhTextHTwo, PhTextItalic, PhTextStrikethrough } from '@phosphor-icons/vue'

const props = withDefaults(defineProps<{ modelValue: string; placeholder?: string; images?: boolean; minHeight?: string; label?: string }>(), { placeholder: 'Start writing...', images: false, minHeight: '24rem', label: 'Page content' })
const emit = defineEmits<{ 'update:modelValue': [v: string]; image: [] }>()
const mode = ref<'visual' | 'markdown'>('visual')
const canUndo = computed(() => !!editor.value?.can().undo())
const canRedo = computed(() => !!editor.value?.can().redo())
const linkOpen = ref(false), linkUrl = ref('')
let lastEmitted = props.modelValue

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { rel: 'noopener noreferrer nofollow' } }),
    Image, Placeholder.configure({ placeholder: props.placeholder }),
    Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
    Markdown.configure({ html: false, tightLists: true, bulletListMarker: '-', linkify: false, breaks: false, transformPastedText: true, transformCopiedText: true }),
  ],
  editorProps: { attributes: { 'aria-label': props.label, class: 'prose-rich' } },
  onUpdate: ({ editor: e }) => { const md = (e.storage.markdown as { getMarkdown: () => string }).getMarkdown(); lastEmitted = md; emit('update:modelValue', md) },
})
// text changed from outside (loading an article, switching a language...)
watch(() => props.modelValue, v => { if (v !== lastEmitted && editor.value) { lastEmitted = v; editor.value.commands.setContent(v, false) } })
onBeforeUnmount(() => editor.value?.destroy())

function onMarkdown(ev: Event): void {
  const v = (ev.target as HTMLTextAreaElement).value
  lastEmitted = v
  emit('update:modelValue', v)
  editor.value?.commands.setContent(v, false)
}
function openLink(): void {
  const e = editor.value; if (!e) return
  linkUrl.value = (e.getAttributes('link').href as string | undefined) ?? 'https://'
  linkOpen.value = true
}
function applyLink(): void {
  const e = editor.value; if (!e) return
  const url = linkUrl.value.trim()
  if (!url || url === 'https://') e.chain().focus().extendMarkRange('link').unsetLink().run()
  else e.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  linkOpen.value = false
}
/** Called by the page once the author picked a picture from the media library. */
function insertImage(src: string, alt: string): void { editor.value?.chain().focus().setImage({ src, alt }).run() }
defineExpose({ insertImage })

type Tool = { key: string; label: string; icon: unknown; run: () => void; active?: () => boolean; show?: boolean }
const tools = (): Tool[] => {
  const e = editor.value
  if (!e) return []
  const c = () => e.chain().focus()
  return [
    { key: 'bold', label: 'Bold', icon: PhTextB, run: () => c().toggleBold().run(), active: () => e.isActive('bold') },
    { key: 'italic', label: 'Italic', icon: PhTextItalic, run: () => c().toggleItalic().run(), active: () => e.isActive('italic') },
    { key: 'strike', label: 'Strikethrough', icon: PhTextStrikethrough, run: () => c().toggleStrike().run(), active: () => e.isActive('strike') },
    { key: 'h1', label: 'Heading 1', icon: PhTextHOne, run: () => c().toggleHeading({ level: 1 }).run(), active: () => e.isActive('heading', { level: 1 }) },
    { key: 'h2', label: 'Heading 2', icon: PhTextHTwo, run: () => c().toggleHeading({ level: 2 }).run(), active: () => e.isActive('heading', { level: 2 }) },
    { key: 'h3', label: 'Heading 3', icon: PhTextHThree, run: () => c().toggleHeading({ level: 3 }).run(), active: () => e.isActive('heading', { level: 3 }) },
    { key: 'ul', label: 'Bulleted list', icon: PhListBullets, run: () => c().toggleBulletList().run(), active: () => e.isActive('bulletList') },
    { key: 'ol', label: 'Numbered list', icon: PhListNumbers, run: () => c().toggleOrderedList().run(), active: () => e.isActive('orderedList') },
    { key: 'quote', label: 'Quote', icon: PhQuotes, run: () => c().toggleBlockquote().run(), active: () => e.isActive('blockquote') },
    { key: 'code', label: 'Inline code', icon: PhCode, run: () => c().toggleCode().run(), active: () => e.isActive('code') },
    { key: 'codeblock', label: 'Code block', icon: PhCodeBlock, run: () => c().toggleCodeBlock().run(), active: () => e.isActive('codeBlock') },
    { key: 'link', label: 'Link', icon: PhLink, run: openLink, active: () => e.isActive('link') },
    { key: 'image', label: 'Insert image', icon: PhImage, run: () => emit('image'), show: props.images },
    { key: 'table', label: 'Insert table', icon: PhTable, run: () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { key: 'hr', label: 'Divider', icon: PhMinus, run: () => c().setHorizontalRule().run() },
  ].filter(t => t.show !== false)
}
</script>

<template>
  <div class="rich card !shadow-none overflow-hidden">
    <div class="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-line bg-surface-2/60" role="toolbar" aria-label="Formatting">
      <template v-if="mode === 'visual'">
        <button v-for="t in tools()" :key="t.key" type="button" class="size-8 grid place-items-center rounded-md transition-colors" :class="t.active?.() ? 'bg-accent-soft text-accent-ink' : 'text-ink/70 hover:bg-surface hover:text-ink'" :aria-label="t.label" :title="t.label" :data-testid="`rt-${t.key}`" @mousedown.prevent @click="t.run()">
          <component :is="t.icon" :size="18" :weight="t.active?.() ? 'bold' : 'regular'" /></button>
        <span class="w-px h-5 bg-line mx-1" />
        <button type="button" class="size-8 grid place-items-center rounded-md text-ink/70 hover:bg-surface hover:text-ink disabled:opacity-40" aria-label="Undo" title="Undo" :disabled="!canUndo" @mousedown.prevent @click="editor?.chain().focus().undo().run()"><PhArrowUUpLeft :size="18" /></button>
        <button type="button" class="size-8 grid place-items-center rounded-md text-ink/70 hover:bg-surface hover:text-ink disabled:opacity-40" aria-label="Redo" title="Redo" :disabled="!canRedo" @mousedown.prevent @click="editor?.chain().focus().redo().run()"><PhArrowUUpRight :size="18" /></button>
      </template>
      <div class="ml-auto inline-flex rounded-lg bg-surface p-0.5 border border-line text-xs font-medium" role="tablist" aria-label="Editor mode">
        <button type="button" role="tab" :aria-selected="mode === 'visual'" class="px-3 h-7 rounded-md" :class="mode === 'visual' ? 'bg-accent-soft text-accent-ink' : 'text-muted'" data-testid="mode-visual" @click="mode = 'visual'">Visual</button>
        <button type="button" role="tab" :aria-selected="mode === 'markdown'" class="px-3 h-7 rounded-md" :class="mode === 'markdown' ? 'bg-accent-soft text-accent-ink' : 'text-muted'" data-testid="mode-markdown" @click="mode = 'markdown'">Markdown</button>
      </div>
    </div>

    <div v-show="mode === 'visual'" class="bg-surface" :style="{ '--min': minHeight }"><EditorContent :editor="editor" /></div>
    <textarea v-if="mode === 'markdown'" :value="modelValue" class="block w-full bg-surface font-mono text-[13px] leading-relaxed p-4 outline-none resize-y" :style="{ minHeight }" aria-label="Markdown body" spellcheck="false"
      @input="onMarkdown" />

    <div v-if="linkOpen" class="fixed inset-0 z-[65] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Insert link" @keydown.esc="linkOpen = false">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="linkOpen = false" />
      <form class="relative w-full max-w-sm bg-surface border border-line rounded-2xl shadow-card p-5 space-y-4" @submit.prevent="applyLink">
        <h2 class="font-semibold">Link address</h2>
        <input v-model="linkUrl" class="input" type="url" placeholder="https://example.com" autofocus data-testid="link-url">
        <p class="text-xs text-muted">Leave it empty to remove the link from the selected text.</p>
        <div class="flex justify-end gap-2"><button type="button" class="btn" @click="linkOpen = false">Cancel</button><button class="btn btn-accent" data-testid="link-apply">Apply</button></div>
      </form>
    </div>
  </div>
</template>
