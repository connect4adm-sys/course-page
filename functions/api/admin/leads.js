// functions/api/admin/leads.js
// GET /api/admin/leads — Lead search, filtering, and CSV export

import { requireAdminAuth } from '../../utils/auth.js';
import { getLeadsList } from '../../utils/db.js';

export async function onRequestGet(context) {
  const auth = await requireAdminAuth(context);
  if (!auth.authorized) {
    return auth.response;
  }

  const url = new URL(context.request.url);
  const search = url.searchParams.get('search') || '';
  const courseId = url.searchParams.get('courseId') || '';
  const isExport = url.searchParams.get('export') === 'csv';
  const limit = parseInt(url.searchParams.get('limit') || (isExport ? '1000' : '50'), 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  try {
    const leads = await getLeadsList(context.env, { search, courseId, limit, offset });

    if (isExport) {
      const csvHeader = 'ID,Student Name,Mobile Number,Email,Course ID,Email Status,Submission Date,IP Address\r\n';
      const csvRows = leads.map(l => [
        `"${l.id}"`,
        `"${(l.student_name || '').replace(/"/g, '""')}"`,
        `"${l.phone || ''}"`,
        `"${l.email || ''}"`,
        `"${l.course_id || ''}"`,
        `"${l.email_status || ''}"`,
        `"${l.created_at || ''}"`,
        `"${l.ip_address || ''}"`
      ].join(',')).join('\r\n');

      return new Response(csvHeader + csvRows, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="findcollege_leads_${new Date().toISOString().slice(0, 10)}.csv"`
        }
      });
    }

    return new Response(JSON.stringify({ success: true, count: leads.length, leads }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    console.error('Error fetching leads:', err.message);
    return new Response(JSON.stringify({ success: false, message: 'Failed to retrieve leads' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
