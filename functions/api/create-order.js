// functions/api/create-order.js
// POST /api/create-order — Server-enforced Razorpay order creation

import { validateStudentName, validateEmail, validatePhone, validateCourseId } from '../utils/validation.js';
import { getProductById, insertCourseOrder } from '../utils/db.js';
import { createRazorpayOrder } from '../utils/razorpay.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid JSON request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { name, email, phone, courseId } = body;

    // Validate inputs
    const nameCheck = validateStudentName(name);
    if (!nameCheck.valid) {
      return new Response(JSON.stringify({ success: false, message: nameCheck.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return new Response(JSON.stringify({ success: false, message: emailCheck.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      return new Response(JSON.stringify({ success: false, message: phoneCheck.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const courseCheck = validateCourseId(courseId);
    if (!courseCheck.valid) {
      return new Response(JSON.stringify({ success: false, message: courseCheck.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Single source of truth for price: retrieved strictly from backend catalog
    const product = await getProductById(env, courseCheck.value);
    if (!product || !product.active) {
      return new Response(JSON.stringify({ success: false, message: 'Course is unavailable for purchase' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Call Razorpay Orders API
    const orderData = await createRazorpayOrder({
      env,
      course: product,
      studentName: nameCheck.value,
      email: emailCheck.value,
      phone: phoneCheck.value
    });

    // Record pending order in D1
    const localId = crypto.randomUUID();
    await insertCourseOrder(env, {
      id: localId,
      orderId: orderData.orderId,
      courseId: product.id,
      amountPaise: orderData.amount,
      currency: orderData.currency,
      studentName: nameCheck.value,
      email: emailCheck.value,
      phone: phoneCheck.value
    });

    return new Response(JSON.stringify({
      success: true,
      orderId: orderData.orderId,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId: orderData.keyId,
      isDemo: orderData.isDemo || false,
      courseName: product.course_name,
      courseId: product.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Error in /api/create-order:', err.message);
    return new Response(JSON.stringify({ success: false, message: err.message || 'Failed to initialize order' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
