import { describe, it, expect } from 'vitest'
import { executeAction } from '../action-engine'
import type { ActionContext } from '../action-engine'

function mockCtx(): ActionContext {
  return {
    authFetch: async () => new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 }),
  }
}

describe('executeAction', () => {
  it('returns null for unknown command "turn off the lights"', async () => {
    const result = await executeAction('turn off the lights', mockCtx())
    expect(result).toBeNull()
  })

  it('returns null for unrecognized format "set brightness to 50"', async () => {
    const result = await executeAction('set brightness to 50', mockCtx())
    expect(result).toBeNull()
  })

  it('handles shutdown command via device action', async () => {
    const result = await executeAction('shutdown computer', mockCtx())
    expect(result).not.toBeNull()
    expect(result!.handled).toBe(true)
  })

  it('returns null for completely unknown commands', async () => {
    const result = await executeAction('what time is it', mockCtx())
    expect(result).toBeNull()
  })
})
