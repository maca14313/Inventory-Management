import { NextResponse } from 'next/server'
import { attachments } from '@/lib/attachments'
import { getAuthContextFromHeaders } from '@/lib/api'
import { handleError } from '@/lib/route-utils'

/** GET /api/attachments/meta-keys
 *  Returns the distinct metadata keys across all visible attachments.
 *  Powers the "by metadata type" tabs on the Attachments page.
 */
export async function GET(req: Request) {
  try {
    const ctx = getAuthContextFromHeaders(new Headers(req.headers))
    const keys = await attachments.distinctMetaKeys(ctx)
    return NextResponse.json({ keys })
  } catch (e) { return handleError(e) }
}
