// functions/api/admin/upload.js
// POST /api/admin/upload — Direct R2 storage file uploader & key mapper for Admin

import { requireAdminAuth } from '../../utils/auth.js';
import { getProductById, updateProduct } from '../../utils/db.js';

export async function onRequestPost(context) {
  const auth = await requireAdminAuth(context);
  if (!auth.authorized) {
    return auth.response;
  }

  const { request, env } = context;

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ success: false, message: 'Content-Type must be multipart/form-data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const formData = await request.formData();
    const courseId = formData.get('courseId');
    const fileType = formData.get('fileType'); // 'sample' or 'bundle'
    const file = formData.get('file');

    if (!courseId || !fileType) {
      return new Response(JSON.stringify({ success: false, message: 'courseId and fileType are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const product = await getProductById(env, courseId);
    if (!product) {
      return new Response(JSON.stringify({ success: false, message: 'Course not found in catalog' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ext = fileType === 'sample' ? 'pdf' : 'zip';
    const targetKey = fileType === 'sample' ? `samples/${courseId}-sample.${ext}` : `courses/${courseId}-bundle.${ext}`;

    if (file && typeof file.arrayBuffer === 'function') {
      const buffer = await file.arrayBuffer();

      if (env?.BUCKET) {
        await env.BUCKET.put(targetKey, buffer, {
          httpMetadata: {
            contentType: fileType === 'sample' ? 'application/pdf' : 'application/zip'
          }
        });
      }
    }

    // Update product assignment in database
    if (fileType === 'sample') {
      await updateProduct(env, courseId, { sampleFileKey: targetKey });
    } else {
      await updateProduct(env, courseId, { fullCourseFileKeys: targetKey });
    }

    const updated = await getProductById(env, courseId);

    return new Response(JSON.stringify({
      success: true,
      fileKey: targetKey,
      fileType,
      courseId,
      message: `${fileType === 'sample' ? 'Sample PDF' : 'Full Course Bundle'} successfully assigned to ${courseId}`,
      product: updated
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('File upload error:', err.message);
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

