// functions/api/admin/orders.js
// GET/POST /api/admin/orders — Order management, delivery retry, and CSV export

import { requireAdminAuth } from '../../utils/auth.js';
import { getOrdersList, getOrderByOrderId, getProductById, updateOrderDeliveryStatus } from '../../utils/db.js';
import { generateDownloadToken } from '../../utils/storage.js';
import { sendCourseDeliveryEmail } from '../../utils/email.js';

export async function onRequestGet(context) {
  const auth = await requireAdminAuth(context);
  if (!auth.authorized) {
    return auth.response;
  }

  const url = new URL(context.request.url);
  const search = url.searchParams.get('search') || '';
  const courseId = url.searchParams.get('courseId') || '';
  const status = url.searchParams.get('status') || '';
  const isExport = url.searchParams.get('export') === 'csv';
  const limit = parseInt(url.searchParams.get('limit') || (isExport ? '1000' : '50'), 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  try {
    const orders = await getOrdersList(context.env, { search, courseId, status, limit, offset });

    if (isExport) {
      const csvHeader = 'Order ID,Payment ID,Student Name,Email,Phone,Course,Amount INR,Payment Status,Delivery Status,Access Code,Purchase Date\r\n';
      const csvRows = orders.map(o => [
        `"${o.order_id || ''}"`,
        `"${o.payment_id || ''}"`,
        `"${(o.student_name || '').replace(/"/g, '""')}"`,
        `"${o.email || ''}"`,
        `"${o.phone || ''}"`,
        `"${o.course_id || ''}"`,
        Math.round((o.amount_paise || 0) / 100),
        `"${o.payment_status || ''}"`,
        `"${o.delivery_status || ''}"`,
        `"${o.access_code || ''}"`,
        `"${o.paid_at || o.created_at || ''}"`
      ].join(',')).join('\r\n');

      return new Response(csvHeader + csvRows, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="findcollege_orders_${new Date().toISOString().slice(0, 10)}.csv"`
        }
      });
    }

    return new Response(JSON.stringify({ success: true, count: orders.length, orders }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    console.error('Error fetching orders:', err.message);
    return new Response(JSON.stringify({ success: false, message: 'Failed to retrieve orders' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const auth = await requireAdminAuth(context);
  if (!auth.authorized) {
    return auth.response;
  }

  const { request, env } = context;

  try {
    const body = await request.json();
    const { action, orderId } = body;

    if (!orderId) {
      return new Response(JSON.stringify({ success: false, message: 'orderId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const order = await getOrderByOrderId(env, orderId);
    if (!order) {
      return new Response(JSON.stringify({ success: false, message: 'Order not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // STRICT BUSINESS RULE: Never send course delivery or resend access for unpaid orders
    if (order.payment_status !== 'paid') {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Security Violation: Cannot send course materials for an unpaid or unverified transaction.' 
      }), { 
        status: 403, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    if (action === 'resend_email' || action === 'retry_delivery') {
      const product = await getProductById(env, order.course_id);
      const bundleKey = product?.full_course_file_keys ? product.full_course_file_keys.trim() : '';

      if (!bundleKey) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: `Cannot deliver course: Complete bundle file key is missing in DB for course ${order.course_id}. Please assign the file key in the Course Catalog before retrying.` 
        }), { 
          status: 422, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      const { token } = await generateDownloadToken({
        env,
        orderId: order.order_id,
        courseId: order.course_id,
        fileKey: bundleKey,
        customerEmail: order.email,
        hoursValid: 24
      });

      const reqUrl = new URL(request.url);
      const downloadUrl = `${reqUrl.protocol}//${reqUrl.host}/api/download/${token}`;
      const amountInr = Math.round(order.amount_paise / 100);

      const emailRes = await sendCourseDeliveryEmail(env, {
        studentName: order.student_name,
        email: order.email,
        course: product || { course_name: order.course_id },
        orderId: order.order_id,
        paymentId: order.payment_id,
        accessCode: order.access_code || 'FCAI-PAID-ACCESS',
        downloadUrl,
        amountInr
      });

      if (emailRes.success) {
        await updateOrderDeliveryStatus(env, order.order_id, 'sent');
        return new Response(JSON.stringify({ success: true, message: `Access email successfully resent to ${order.email}` }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        await updateOrderDeliveryStatus(env, order.order_id, 'failed');
        return new Response(JSON.stringify({ success: false, message: `Email sending failed: ${emailRes.error}` }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ success: false, message: 'Invalid action specified' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Error in admin orders action:', err.message);
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

