import { decodeFrame, encodeFrame, type Header } from './protocol'
import type { Transport } from './engine'

export interface MeshHooks {
  signal(to: string, data: unknown): void
  onOpen(peer: string): void
  onClose(peer: string): void
  onFrame(peer: string, h: Header, payload: Uint8Array): void
  onBlocked(peer: string): void
}

interface Link { since: number; pc: RTCPeerConnection; dc?: RTCDataChannel; queue: RTCIceCandidateInit[]; opened: boolean; timer?: ReturnType<typeof setTimeout> }

/** One RTCPeerConnection + ordered reliable DataChannel per remote device. The lower device id initiates. */
export class Mesh implements Transport {
  private links = new Map<string, Link>()
  constructor(private me: string, private ice: RTCIceServer[], private hooks: MeshHooks) {}

  peers(): string[] { return [...this.links].filter(([, l]) => l.dc?.readyState === 'open').map(([p]) => p) }
  buffered(peer: string): number { return this.links.get(peer)?.dc?.bufferedAmount ?? 0 }
  drain(peer: string): Promise<void> {
    const dc = this.links.get(peer)?.dc
    if (!dc || dc.readyState !== 'open') return Promise.resolve()
    return new Promise(res => {
      dc.bufferedAmountLowThreshold = 1024 * 1024
      const done = (): void => { dc.removeEventListener('bufferedamountlow', done); dc.removeEventListener('close', done); res() }
      dc.addEventListener('bufferedamountlow', done); dc.addEventListener('close', done)
    })
  }
  send(peer: string, h: Header, payload?: Uint8Array): void {
    const dc = this.links.get(peer)?.dc
    if (dc?.readyState === 'open') dc.send(encodeFrame(h, payload) as unknown as ArrayBuffer)
  }

  /** `since` changes whenever a device reconnects (reload, network change): links made before that are dead, replace them. */
  sync(online: { id: string; since: number }[]): void {
    const want = new Map(online.filter(p => p.id !== this.me).map(p => [p.id, p.since]))
    for (const [p, since] of want) {
      const l = this.links.get(p)
      if (l && since > l.since) this.drop(p)
      if (!this.links.has(p) && this.me < p) this.connect(p, since)
    }
    for (const p of [...this.links.keys()]) if (!want.has(p)) this.drop(p)
  }

  private connect(peer: string, since = Date.now()): Link {
    const pc = new RTCPeerConnection({ iceServers: this.ice })
    const l: Link = { since, pc, queue: [], opened: false }
    this.links.set(peer, l)
    pc.onicecandidate = e => { if (e.candidate) this.hooks.signal(peer, { ice: e.candidate.toJSON() }) }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') { this.hooks.onBlocked(peer); this.drop(peer) }
      if (pc.connectionState === 'disconnected') l.timer = setTimeout(() => { if (pc.connectionState !== 'connected') this.drop(peer) }, 8000)
      if (pc.connectionState === 'connected' && l.timer) clearTimeout(l.timer)
    }
    pc.ondatachannel = e => this.attach(peer, l, e.channel)
    if (this.me < peer) {
      this.attach(peer, l, pc.createDataChannel('xfer', { ordered: true }))
      void pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => this.hooks.signal(peer, { sdp: pc.localDescription }))
    }
    return l
  }

  private attach(peer: string, l: Link, dc: RTCDataChannel): void {
    dc.binaryType = 'arraybuffer'
    l.dc = dc
    dc.onopen = () => { l.opened = true; this.hooks.onOpen(peer) }
    dc.onclose = () => { if (this.links.get(peer) === l) this.drop(peer) }
    dc.onmessage = e => {
      try { const f = decodeFrame(new Uint8Array(e.data as ArrayBuffer)); this.hooks.onFrame(peer, f.h, f.payload) } catch { /* ignore malformed frame */ }
    }
  }

  async onSignal(peer: string, data: { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit }): Promise<void> {
    let l = this.links.get(peer)
    if (data.sdp?.type === 'offer') { if (l) this.drop(peer); l = this.connect(peer) }
    if (!l) return
    const pc = l.pc
    if (data.sdp) {
      await pc.setRemoteDescription(data.sdp)
      for (const c of l.queue.splice(0)) await pc.addIceCandidate(c).catch(() => undefined)
      if (data.sdp.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); this.hooks.signal(peer, { sdp: pc.localDescription }) }
    } else if (data.ice) {
      if (pc.remoteDescription) await pc.addIceCandidate(data.ice).catch(() => undefined)
      else l.queue.push(data.ice)
    }
  }

  drop(peer: string): void {
    const l = this.links.get(peer)
    if (!l) return
    this.links.delete(peer)
    clearTimeout(l.timer)
    l.dc?.close(); l.pc.close()
    if (l.opened) this.hooks.onClose(peer)
  }

  closeAll(): void { for (const p of [...this.links.keys()]) this.drop(p) }
}
