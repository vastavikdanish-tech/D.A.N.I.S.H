import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../health/route'

vi.mock('@/lib/supabase.server', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  })),
}))

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: vi.fn(() => Promise.resolve({ id: 'test-user-id' })),
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with ok: true', async () => {
    const response = await GET(new Request('http://localhost/api/health'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('ok', true)
  })
})
