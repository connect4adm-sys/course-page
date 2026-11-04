// functions/api/courses.js
// GET /api/courses — Public catalog of available courses & server-enforced pricing

import { getProducts } from '../utils/db.js';

export async function onRequestGet(context) {
  try {
    const products = await getProducts(context.env);
    const activeProducts = products
      .filter(p => p.active === 1 || p.active === true)
      .map(p => ({
        id: p.id,
        courseName: p.course_name,
        classLevel: p.class_level,
        subjects: p.subjects,
        priceInr: Math.round(p.price_paise / 100)
      }));

    return new Response(JSON.stringify({ success: true, courses: activeProducts }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
  } catch (err) {
    console.error('Error fetching courses:', err.message);
    return new Response(JSON.stringify({ success: false, error: 'Failed to retrieve course catalog' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

