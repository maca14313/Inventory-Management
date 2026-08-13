import { NextResponse } from 'next/server'
import { attachments } from '@/lib/attachments'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/** GET /api/attachments/counts
 *  Returns attachment counts grouped by fileCategory — powers the
 *  file-type tabs on the Attachments page.
 */
export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const counts = await attachments.countsByCategory(ctx)
    return NextResponse.json({ counts })
  } catch (e) { return handleError(e) }
}
