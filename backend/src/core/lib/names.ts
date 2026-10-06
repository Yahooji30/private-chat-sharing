const ADJ = ['Blue', 'Swift', 'Calm', 'Bright', 'Brave', 'Quiet', 'Lucky', 'Amber', 'Coral', 'Misty', 'Solar', 'Lunar']
const ANIMAL = ['Fox', 'Otter', 'Panda', 'Falcon', 'Koala', 'Lynx', 'Heron', 'Gecko', 'Whale', 'Tiger', 'Robin', 'Moose']
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)] as T
export const randomDeviceName = (): string => `${pick(ADJ)} ${pick(ANIMAL)}`

export function deviceType(ua: string): 'phone' | 'tablet' | 'desktop' {
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  return /Mobi|Android|iPhone/i.test(ua) ? 'phone' : 'desktop'
}
