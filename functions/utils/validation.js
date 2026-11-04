// functions/utils/validation.js
// Input validation and sanitization helpers for FindCollege.ai

export const ALLOWED_COURSES = {
  'jee-full': {
    name: 'JEE Full Course',
    classLevel: 'Class 11-12',
    subjects: 'Physics · Chemistry · Mathematics',
    pricePaise: 49900,
    originalPricePaise: 149900,
    sampleFileKey: 'samples/jee-full-sample.pdf',
    bundleFileKey: 'courses/jee-full-bundle.zip'
  },
  'neet-full': {
    name: 'NEET Full Course',
    classLevel: 'Class 11-12',
    subjects: 'Physics · Chemistry · Biology',
    pricePaise: 49900,
    originalPricePaise: 149900,
    sampleFileKey: 'samples/neet-full-sample.pdf',
    bundleFileKey: 'courses/neet-full-bundle.zip'
  },
  'foundation-9-10': {
    name: 'Foundation Class 9–10',
    classLevel: 'Class 9-10',
    subjects: 'Mathematics · Science',
    pricePaise: 39900,
    originalPricePaise: 798000,
    sampleFileKey: 'samples/foundation-9-10-sample.pdf',
    bundleFileKey: 'courses/foundation-9-10-bundle.zip'
  },
  'junior-6-8': {
    name: 'Junior Foundation Class 6–8',
    classLevel: 'Class 6-8',
    subjects: 'Mathematics · Science',
    pricePaise: 39900,
    originalPricePaise: 798000,
    sampleFileKey: 'samples/junior-6-8-sample.pdf',
    bundleFileKey: 'courses/junior-6-8-bundle.zip'
  }
};

export function validateStudentName(name) {
  if (typeof name !== 'string') return { valid: false, message: 'Name is required' };
  const trimmed = name.trim();
  if (trimmed.length < 2) return { valid: false, message: 'Name must be at least 2 characters' };
  if (trimmed.length > 80) return { valid: false, message: 'Name cannot exceed 80 characters' };
  // Allow letters, spaces, hyphens and dots
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
    return { valid: false, message: 'Name contains invalid characters' };
  }
  return { valid: true, value: trimmed };
}

export function validateEmail(email) {
  if (typeof email !== 'string') return { valid: false, message: 'Email address is required' };
  const trimmed = email.trim().toLowerCase();
  // RFC 5322 compliant regex for practical email validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, message: 'Please enter a valid email address' };
  }
  if (trimmed.length > 120) return { valid: false, message: 'Email address too long' };
  return { valid: true, value: trimmed };
}

export function validatePhone(phone) {
  if (typeof phone !== 'string' && typeof phone !== 'number') {
    return { valid: false, message: 'Mobile number is required' };
  }
  // Strip non-digits
  const digits = String(phone).replace(/\D/g, '');
  // Extract last 10 digits for Indian mobile numbers (e.g. +91 9876543210 -> 9876543210)
  const mobile = digits.length > 10 ? digits.slice(-10) : digits;
  
  // Indian mobile validation: 10 digits starting with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return { valid: false, message: 'Please enter a valid 10-digit Indian mobile number' };
  }
  return { valid: true, value: mobile };
}

export function validateCourseId(courseId) {
  if (typeof courseId !== 'string' || !ALLOWED_COURSES[courseId]) {
    return { valid: false, message: 'Invalid or unsupported course selected' };
  }
  return { valid: true, value: courseId, course: ALLOWED_COURSES[courseId] };
}

export function checkHoneypot(honeypotValue) {
  // If honeypot is filled out, it's a bot submission
  if (honeypotValue && String(honeypotValue).trim() !== '') {
    return true;
  }
  return false;
}
