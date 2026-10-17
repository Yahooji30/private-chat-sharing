import { describe, expect, it } from 'vitest'
import { gaMeasurementId } from '../src/index'

describe('Google Analytics measurement id', () => {
  it('accepts the G- form, tidied up', () => {
    expect(gaMeasurementId('G-Y7CP6YLMVL')).toBe('G-Y7CP6YLMVL')
    expect(gaMeasurementId('  g-y7cp6ylmvl ')).toBe('G-Y7CP6YLMVL')
  })
  it('refuses anything that could change the script address or the page', () => {
    for (const bad of ['', '   ', 'UA-12345-1', 'GTM-ABC123', 'G-', 'G-AB', 'G-ABC<script>', "G-ABC');alert(1);//", 'G-ABC&x=1', 'G-ABC DEF', 'https://evil.example/x.js', 'G-' + 'A'.repeat(40), null, undefined, 42, {}]) expect(gaMeasurementId(bad), String(bad)).toBe('')
  })
})
