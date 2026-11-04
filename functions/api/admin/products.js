// functions/api/admin/products.js
// GET/PUT /api/admin/products — Course catalog management, pricing, and file mapping

import { requireAdminAuth } from '../../utils/auth.js';
import { getProducts, updateProduct, getProductById } from '../../utils/db.js';

export async function onRequestGet(context) {
  const auth = await requireAdminAuth(context);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const products = await getProducts(context.env);
    const enrichedProducts = await Promise.all(products.map(async p => {
      const sampleKey = (p.sample_file_key || '').trim();
      const bundleKey = (p.full_course_file_keys || '').trim();

      let sampleExistsInR2 = false;
      let bundleExistsInR2 = false;

      if (context.env?.BUCKET) {
        try {
          if (sampleKey) {
            const head = await context.env.BUCKET.head(sampleKey);
            sampleExistsInR2 = Boolean(head);
          }
          if (bundleKey) {
            const head = await context.env.BUCKET.head(bundleKey);
            bundleExistsInR2 = Boolean(head);
          }
        } catch (e) {
          // R2 check silent catch
        }
      }

      return {
        ...p,
        sample_file_key: sampleKey,
        full_course_file_keys: bundleKey,
        sampleStatus: sampleKey ? 'configured' : 'missing',
        bundleStatus: bundleKey ? 'configured' : 'missing',
        sampleExistsInR2,
        bundleExistsInR2
      };
    }));

    return new Response(JSON.stringify({ success: true, products: enrichedProducts }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    console.error('Error fetching admin products:', err.message);
    return new Response(JSON.stringify({ success: false, message: 'Failed to retrieve products' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPut(context) {
  const auth = await requireAdminAuth(context);
  if (!auth.authorized) {
    return auth.response;
  }

  const { request, env } = context;

  try {
    const body = await request.json();
    const { id, courseName, priceInr, active, sampleFileKey, fullCourseFileKeys } = body;

    if (!id) {
      return new Response(JSON.stringify({ success: false, message: 'Course ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const existing = await getProductById(env, id);
    if (!existing) {
      return new Response(JSON.stringify({ success: false, message: 'Course not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    let pricePaise = undefined;
    if (priceInr !== undefined) {
      const parsed = parseInt(priceInr, 10);
      if (isNaN(parsed) || parsed < 1) {
        return new Response(JSON.stringify({ success: false, message: 'Price must be a valid positive number' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      pricePaise = parsed * 100;
    }

    await updateProduct(env, id, {
      courseName,
      pricePaise,
      active: active !== undefined ? (active ? 1 : 0) : undefined,
      sampleFileKey,
      fullCourseFileKeys
    });

    const updated = await getProductById(env, id);

    return new Response(JSON.stringify({
      success: true,
      message: `Course ${id} successfully updated`,
      product: updated
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Error updating product:', err.message);
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

