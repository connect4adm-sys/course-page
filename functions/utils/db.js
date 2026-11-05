// functions/utils/db.js
// Cloudflare D1 Database helpers with in-memory fallback for local preview

import { ALLOWED_COURSES } from './validation.js';

// In-memory fallback stores for local testing when D1 binding is not yet attached
const mockMemoryStore = {
  products: Object.entries(ALLOWED_COURSES)
    .filter(([_, c]) => !c.isAlias)
    .map(([id, c]) => ({
      id,
      course_name: c.name,
      class_level: c.classLevel,
      subjects: c.subjects,
      price_paise: c.pricePaise,
      active: 1,
      sample_file_key: c.sampleFileKey,
      full_course_file_keys: c.bundleFileKey,
      updated_at: new Date().toISOString()
    })),
  leads: [],
  orders: [],
  entitlements: [],
  tokens: [],
  emailLogs: [],
  webhookEvents: [],
  adminUsers: []
};

export async function getProducts(env) {
  if (env && env.DB) {
    try {
      const { results } = await env.DB.prepare('SELECT * FROM products ORDER BY price_paise DESC').all();
      if (results && results.length > 0) return results.filter(p => !ALLOWED_COURSES[p.id]?.isAlias);
    } catch (e) {
      console.warn('D1 getProducts query error:', e.message);
    }
  }
  return mockMemoryStore.products.filter(p => !ALLOWED_COURSES[p.id]?.isAlias);
}

export async function getProductById(env, courseId) {
  if (env && env.DB) {
    try {
      const res = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(courseId).first();
      if (res) return res;
    } catch (e) {
      console.warn('D1 getProductById query error:', e.message);
    }
  }
  const fromStore = mockMemoryStore.products.find(p => p.id === courseId);
  if (fromStore) return fromStore;
  if (ALLOWED_COURSES[courseId]) {
    const c = ALLOWED_COURSES[courseId];
    const created = {
      id: courseId,
      course_name: c.name,
      class_level: c.classLevel,
      subjects: c.subjects,
      price_paise: c.pricePaise,
      active: 1,
      sample_file_key: c.sampleFileKey,
      full_course_file_keys: c.bundleFileKey,
      updated_at: new Date().toISOString()
    };
    mockMemoryStore.products.push(created);
    return created;
  }
  return null;
}

export async function updateProduct(env, id, { courseName, pricePaise, active, sampleFileKey, fullCourseFileKeys }) {
  if (env && env.DB) {
    await env.DB.prepare(`
      UPDATE products 
      SET course_name = COALESCE(?, course_name),
          price_paise = COALESCE(?, price_paise),
          active = COALESCE(?, active),
          sample_file_key = COALESCE(?, sample_file_key),
          full_course_file_keys = COALESCE(?, full_course_file_keys),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(courseName, pricePaise, active, sampleFileKey, fullCourseFileKeys, id).run();
  }
  let p = mockMemoryStore.products.find(p => p.id === id);
  if (!p && ALLOWED_COURSES[id]) {
    const c = ALLOWED_COURSES[id];
    p = {
      id,
      course_name: c.name,
      class_level: c.classLevel,
      subjects: c.subjects,
      price_paise: c.pricePaise,
      active: 1,
      sample_file_key: c.sampleFileKey,
      full_course_file_keys: c.bundleFileKey,
      updated_at: new Date().toISOString()
    };
    mockMemoryStore.products.push(p);
  }
  if (p) {
    if (courseName !== undefined) p.course_name = courseName;
    if (pricePaise !== undefined) p.price_paise = pricePaise;
    if (active !== undefined) p.active = active;
    if (sampleFileKey !== undefined) p.sample_file_key = sampleFileKey;
    if (fullCourseFileKeys !== undefined) p.full_course_file_keys = fullCourseFileKeys;
    p.updated_at = new Date().toISOString();
  }
}

export async function insertSampleLead(env, { id, courseId, studentName, phone, email, emailStatus, ipAddress, userAgent }) {
  if (env && env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO sample_leads (id, course_id, student_name, phone, email, email_status, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(id, courseId, studentName, phone, email, emailStatus || 'pending', ipAddress || null, userAgent || null).run();
      return;
    } catch (e) {
      console.warn('D1 insertSampleLead error:', e.message);
    }
  }
  mockMemoryStore.leads.push({
    id,
    course_id: courseId,
    student_name: studentName,
    phone,
    email,
    email_status: emailStatus || 'pending',
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    created_at: new Date().toISOString()
  });
}

export async function getRecentSampleLead(env, email, courseId, withinMinutes = 15) {
  if (env && env.DB) {
    try {
      const res = await env.DB.prepare(`
        SELECT * FROM sample_leads 
        WHERE LOWER(email) = LOWER(?) AND course_id = ? 
          AND created_at >= datetime('now', '-' || ? || ' minutes')
        ORDER BY created_at DESC LIMIT 1
      `).bind(email, courseId, withinMinutes).first();
      if (res) return res;
    } catch (e) {
      console.warn('D1 getRecentSampleLead error:', e.message);
    }
  }
  const cutoff = Date.now() - (withinMinutes * 60 * 1000);
  return mockMemoryStore.leads.find(l => 
    l.email && l.email.toLowerCase() === email.toLowerCase() && 
    l.course_id === courseId && 
    new Date(l.created_at).getTime() >= cutoff
  ) || null;
}

export async function updateLeadEmailStatus(env, leadId, status) {
  if (env && env.DB) {
    try {
      await env.DB.prepare('UPDATE sample_leads SET email_status = ? WHERE id = ?').bind(status, leadId).run();
      return;
    } catch (e) {
      console.warn('D1 updateLeadEmailStatus error:', e.message);
    }
  }
  const lead = mockMemoryStore.leads.find(l => l.id === leadId);
  if (lead) lead.email_status = status;
}

export async function insertCourseOrder(env, { id, orderId, courseId, amountPaise, currency, studentName, email, phone }) {
  if (env && env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO course_orders (id, order_id, course_id, amount_paise, currency, student_name, email, phone, payment_status, delivery_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'created', 'pending', CURRENT_TIMESTAMP)
      `).bind(id, orderId, courseId, amountPaise, currency || 'INR', studentName, email, phone).run();
      return;
    } catch (e) {
      console.warn('D1 insertCourseOrder error:', e.message);
    }
  }
  mockMemoryStore.orders.push({
    id,
    order_id: orderId,
    payment_id: null,
    course_id: courseId,
    amount_paise: amountPaise,
    currency: currency || 'INR',
    student_name: studentName,
    email,
    phone,
    payment_status: 'created',
    delivery_status: 'pending',
    access_code: null,
    webhook_processed: 0,
    created_at: new Date().toISOString(),
    paid_at: null
  });
}

export async function getOrderByOrderId(env, orderId) {
  if (env && env.DB) {
    try {
      const res = await env.DB.prepare('SELECT * FROM course_orders WHERE order_id = ?').bind(orderId).first();
      if (res) return res;
    } catch (e) {
      console.warn('D1 getOrderByOrderId error:', e.message);
    }
  }
  return mockMemoryStore.orders.find(o => o.order_id === orderId) || null;
}

export async function updateOrderStatusToPaid(env, orderId, paymentId, accessCode) {
  const paidAt = new Date().toISOString();
  if (env && env.DB) {
    try {
      await env.DB.prepare(`
        UPDATE course_orders 
        SET payment_status = 'paid',
            payment_id = ?,
            access_code = ?,
            paid_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
      `).bind(paymentId, accessCode, orderId).run();
      return;
    } catch (e) {
      console.warn('D1 updateOrderStatusToPaid error:', e.message);
    }
  }
  const order = mockMemoryStore.orders.find(o => o.order_id === orderId);
  if (order) {
    order.payment_status = 'paid';
    order.payment_id = paymentId;
    order.access_code = accessCode;
    order.paid_at = paidAt;
  }
}

export async function updateOrderDeliveryStatus(env, orderId, deliveryStatus) {
  if (env && env.DB) {
    try {
      await env.DB.prepare('UPDATE course_orders SET delivery_status = ? WHERE order_id = ?').bind(deliveryStatus, orderId).run();
      return;
    } catch (e) {
      console.warn('D1 updateOrderDeliveryStatus error:', e.message);
    }
  }
  const order = mockMemoryStore.orders.find(o => o.order_id === orderId);
  if (order) order.delivery_status = deliveryStatus;
}

export async function markWebhookProcessed(env, eventId, eventType, status, payloadSummary) {
  if (env && env.DB) {
    try {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO webhook_events (id, event_id, event_type, processed_at, processing_status, payload_summary)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
      `).bind(crypto.randomUUID(), eventId, eventType, status, payloadSummary).run();
      return;
    } catch (e) {
      console.warn('D1 markWebhookProcessed error:', e.message);
    }
  }
  mockMemoryStore.webhookEvents.push({
    id: crypto.randomUUID(),
    event_id: eventId,
    event_type: eventType,
    processed_at: new Date().toISOString(),
    processing_status: status,
    payload_summary: payloadSummary
  });
}

export async function isWebhookProcessed(env, eventId) {
  if (env && env.DB) {
    try {
      const res = await env.DB.prepare('SELECT id FROM webhook_events WHERE event_id = ?').bind(eventId).first();
      return Boolean(res);
    } catch (e) {
      console.warn('D1 isWebhookProcessed error:', e.message);
    }
  }
  return mockMemoryStore.webhookEvents.some(w => w.event_id === eventId);
}

export async function createCourseEntitlement(env, { orderId, customerEmail, courseId }) {
  const id = crypto.randomUUID();
  if (env && env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO course_entitlements (id, order_id, customer_email, course_id, access_status, created_at)
        VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
      `).bind(id, orderId, customerEmail, courseId).run();
      return id;
    } catch (e) {
      console.warn('D1 createCourseEntitlement error:', e.message);
    }
  }
  mockMemoryStore.entitlements.push({
    id,
    order_id: orderId,
    customer_email: customerEmail,
    course_id: courseId,
    access_status: 'active',
    created_at: new Date().toISOString()
  });
  return id;
}

export async function saveDownloadToken(env, { token, orderId, courseId, fileKey, customerEmail, expiresAt }) {
  const id = crypto.randomUUID();
  if (env && env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO download_tokens (id, token, order_id, course_id, file_key, customer_email, expires_at, download_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      `).bind(id, token, orderId, courseId, fileKey, customerEmail, expiresAt).run();
      return token;
    } catch (e) {
      console.warn('D1 saveDownloadToken error:', e.message);
    }
  }
  mockMemoryStore.tokens.push({
    id,
    token,
    order_id: orderId,
    course_id: courseId,
    file_key: fileKey,
    customer_email: customerEmail,
    expires_at: expiresAt,
    download_count: 0,
    created_at: new Date().toISOString()
  });
  return token;
}

export async function getDownloadToken(env, token) {
  if (env && env.DB) {
    try {
      const res = await env.DB.prepare('SELECT * FROM download_tokens WHERE token = ?').bind(token).first();
      if (res) return res;
    } catch (e) {
      console.warn('D1 getDownloadToken error:', e.message);
    }
  }
  return mockMemoryStore.tokens.find(t => t.token === token) || null;
}

export async function incrementDownloadCount(env, token) {
  if (env && env.DB) {
    try {
      await env.DB.prepare('UPDATE download_tokens SET download_count = download_count + 1 WHERE token = ?').bind(token).run();
      return;
    } catch (e) {
      console.warn('D1 incrementDownloadCount error:', e.message);
    }
  }
  const t = mockMemoryStore.tokens.find(x => x.token === token);
  if (t) t.download_count = (t.download_count || 0) + 1;
}

export async function logEmail(env, { recipient, emailType, referenceId, deliveryStatus, providerMessageId, errorMessage }) {
  const id = crypto.randomUUID();
  if (env && env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO email_logs (id, recipient, email_type, reference_id, delivery_status, provider_message_id, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(id, recipient, emailType, referenceId || null, deliveryStatus, providerMessageId || null, errorMessage || null).run();
      return;
    } catch (e) {
      console.warn('D1 logEmail error:', e.message);
    }
  }
  mockMemoryStore.emailLogs.push({
    id,
    recipient,
    email_type: emailType,
    reference_id: referenceId || null,
    delivery_status: deliveryStatus,
    provider_message_id: providerMessageId || null,
    error_message: errorMessage || null,
    created_at: new Date().toISOString()
  });
}

export async function getDashboardMetrics(env, dateFilter) {
  let leads = [];
  let orders = [];
  let emailLogs = [];

  if (env && env.DB) {
    try {
      const l = await env.DB.prepare('SELECT * FROM sample_leads').all();
      const o = await env.DB.prepare('SELECT * FROM course_orders').all();
      const e = await env.DB.prepare('SELECT * FROM email_logs').all();
      leads = l.results || [];
      orders = o.results || [];
      emailLogs = e.results || [];
    } catch (err) {
      console.warn('D1 metrics fallback:', err.message);
      leads = mockMemoryStore.leads;
      orders = mockMemoryStore.orders;
      emailLogs = mockMemoryStore.emailLogs;
    }
  } else {
    leads = mockMemoryStore.leads;
    orders = mockMemoryStore.orders;
    emailLogs = mockMemoryStore.emailLogs;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let filterStart = 0;
  if (dateFilter === 'today') {
    filterStart = todayStart;
  } else if (dateFilter === '7d') {
    filterStart = Date.now() - 7 * 86400000;
  } else if (dateFilter === '30d') {
    filterStart = Date.now() - 30 * 86400000;
  }

  const filteredLeads = filterStart ? leads.filter(l => new Date(l.created_at).getTime() >= filterStart) : leads;
  const filteredOrders = filterStart ? orders.filter(o => new Date(o.created_at).getTime() >= filterStart) : orders;
  const filteredEmails = filterStart ? emailLogs.filter(e => new Date(e.created_at).getTime() >= filterStart) : emailLogs;

  const totalLeads = filteredLeads.length;
  const todayLeads = leads.filter(l => new Date(l.created_at).getTime() >= todayStart).length;

  const totalOrders = filteredOrders.length;
  const paidOrders = filteredOrders.filter(o => o.payment_status === 'paid');
  const successfulPayments = paidOrders.length;
  const pendingPayments = filteredOrders.filter(o => o.payment_status === 'created').length;
  const failedPayments = filteredOrders.filter(o => o.payment_status === 'failed').length;

  const totalRevenuePaise = paidOrders.reduce((sum, o) => sum + (o.amount_paise || 0), 0);
  const totalRevenueInr = Math.round(totalRevenuePaise / 100);

  const todayPaidOrders = orders.filter(o => o.payment_status === 'paid' && new Date(o.paid_at || o.created_at).getTime() >= todayStart);
  const todayRevenuePaise = todayPaidOrders.reduce((sum, o) => sum + (o.amount_paise || 0), 0);
  const todayRevenueInr = Math.round(todayRevenuePaise / 100);

  const successfulEmailDeliveries = filteredEmails.filter(e => e.delivery_status === 'sent').length;
  const failedEmailDeliveries = filteredEmails.filter(e => e.delivery_status === 'failed').length;

  return {
    totalLeads,
    todayLeads,
    totalOrders,
    successfulPayments,
    pendingPayments,
    failedPayments,
    totalRevenueInr,
    todayRevenueInr,
    successfulEmailDeliveries,
    failedEmailDeliveries
  };
}

export async function getLeadsList(env, { search, courseId, limit = 50, offset = 0 } = {}) {
  let list = [];
  if (env && env.DB) {
    try {
      let query = 'SELECT * FROM sample_leads WHERE 1=1';
      const bindings = [];
      if (courseId) {
        query += ' AND course_id = ?';
        bindings.push(courseId);
      }
      if (search) {
        query += ' AND (student_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
        bindings.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      bindings.push(limit, offset);
      const res = await env.DB.prepare(query).bind(...bindings).all();
      list = res.results || [];
    } catch (e) {
      console.warn('D1 getLeadsList fallback:', e.message);
      list = mockMemoryStore.leads;
    }
  } else {
    list = mockMemoryStore.leads;
  }

  // In-memory filter if fallback
  if (courseId) list = list.filter(l => l.course_id === courseId);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(l => 
      (l.student_name && l.student_name.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.phone && l.phone.includes(q))
    );
  }
  return list;
}

export async function getOrdersList(env, { search, courseId, status, limit = 50, offset = 0 } = {}) {
  let list = [];
  if (env && env.DB) {
    try {
      let query = 'SELECT * FROM course_orders WHERE 1=1';
      const bindings = [];
      if (courseId) {
        query += ' AND course_id = ?';
        bindings.push(courseId);
      }
      if (status) {
        query += ' AND payment_status = ?';
        bindings.push(status);
      }
      if (search) {
        query += ' AND (student_name LIKE ? OR email LIKE ? OR phone LIKE ? OR order_id LIKE ? OR payment_id LIKE ?)';
        bindings.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      bindings.push(limit, offset);
      const res = await env.DB.prepare(query).bind(...bindings).all();
      list = res.results || [];
    } catch (e) {
      console.warn('D1 getOrdersList fallback:', e.message);
      list = mockMemoryStore.orders;
    }
  } else {
    list = mockMemoryStore.orders;
  }

  if (courseId) list = list.filter(o => o.course_id === courseId);
  if (status) list = list.filter(o => o.payment_status === status);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(o =>
      (o.student_name && o.student_name.toLowerCase().includes(q)) ||
      (o.email && o.email.toLowerCase().includes(q)) ||
      (o.phone && o.phone.includes(q)) ||
      (o.order_id && o.order_id.toLowerCase().includes(q)) ||
      (o.payment_id && o.payment_id.toLowerCase().includes(q))
    );
  }
  return list;
}

export async function getEmailLogsList(env, { limit = 50, offset = 0 } = {}) {
  if (env && env.DB) {
    try {
      const res = await env.DB.prepare('SELECT * FROM email_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit, offset).all();
      return res.results || [];
    } catch (e) {
      console.warn('D1 getEmailLogsList fallback:', e.message);
    }
  }
  return [...mockMemoryStore.emailLogs].reverse().slice(offset, offset + limit);
}

export async function getAdminUser(env, username) {
  if (env && env.DB) {
    try {
      const res = await env.DB.prepare('SELECT * FROM admin_users WHERE username = ?').bind(username).first();
      if (res) return res;
    } catch (e) {
      console.warn('D1 getAdminUser error:', e.message);
    }
  }
  return mockMemoryStore.adminUsers.find(u => u.username === username) || null;
}

export async function hasAnyAdminUser(env) {
  if (env && env.DB) {
    try {
      const res = await env.DB.prepare('SELECT COUNT(*) as count FROM admin_users').first();
      if (res && res.count > 0) return true;
    } catch (e) {
      console.warn('D1 hasAnyAdminUser error:', e.message);
    }
  }
  return mockMemoryStore.adminUsers.length > 0;
}

export async function createAdminUser(env, { username, passwordHash, salt }) {
  const id = crypto.randomUUID();
  if (env && env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO admin_users (id, username, password_hash, salt, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(id, username, passwordHash, salt).run();
      return { id, username };
    } catch (e) {
      console.warn('D1 createAdminUser error:', e.message);
    }
  }
  const user = { id, username, password_hash: passwordHash, salt, created_at: new Date().toISOString() };
  mockMemoryStore.adminUsers.push(user);
  return user;
}

