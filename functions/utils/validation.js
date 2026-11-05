// functions/utils/validation.js
// Input validation, course catalog & sanitization helpers for FindCollege.ai

export const ALLOWED_COURSES = {
  'jee-full': {
    name: 'JEE Full Resources',
    classLevel: 'Class 11-12',
    subjects: 'Physics · Chemistry · Mathematics',
    pricePaise: 49900,
    sampleFileKey: 'samples/jee-full-sample.pdf',
    bundleFileKey: 'courses/jee-full-bundle.zip'
  },
  'neet-full': {
    name: 'NEET Full Resources',
    classLevel: 'Class 11-12',
    subjects: 'Physics · Chemistry · Biology',
    pricePaise: 49900,
    sampleFileKey: 'samples/neet-full-sample.pdf',
    bundleFileKey: 'courses/neet-full-bundle.zip'
  },
  'class-10': {
    name: 'Class 10 Foundation Resources',
    classLevel: 'Class 10',
    subjects: 'Mathematics · Science',
    pricePaise: 39900,
    sampleFileKey: 'samples/class-10-sample.pdf',
    bundleFileKey: 'courses/class-10-bundle.zip'
  },
  'class-9': {
    name: 'Class 9 Foundation Resources',
    classLevel: 'Class 9',
    subjects: 'Mathematics · Science',
    pricePaise: 39900,
    sampleFileKey: 'samples/class-9-sample.pdf',
    bundleFileKey: 'courses/class-9-bundle.zip'
  },
  'class-8': {
    name: 'Class 8 Foundation Resources',
    classLevel: 'Class 8',
    subjects: 'Mathematics · Science',
    pricePaise: 29900,
    sampleFileKey: 'samples/class-8-sample.pdf',
    bundleFileKey: 'courses/class-8-bundle.zip'
  },
  'class-7': {
    name: 'Class 7 Foundation Resources',
    classLevel: 'Class 7',
    subjects: 'Mathematics · Science',
    pricePaise: 29900,
    sampleFileKey: 'samples/class-7-sample.pdf',
    bundleFileKey: 'courses/class-7-bundle.zip'
  },
  'class-6': {
    name: 'Class 6 Foundation Resources',
    classLevel: 'Class 6',
    subjects: 'Mathematics · Science',
    pricePaise: 29900,
    sampleFileKey: 'samples/class-6-sample.pdf',
    bundleFileKey: 'courses/class-6-bundle.zip'
  },
  // Backward-compatible aliases for legacy orders/tests
  'foundation-9-10': {
    name: 'Foundation Class 9–10 Resources',
    classLevel: 'Class 9-10',
    subjects: 'Mathematics · Science',
    pricePaise: 39900,
    sampleFileKey: 'samples/foundation-9-10-sample.pdf',
    bundleFileKey: 'courses/foundation-9-10-bundle.zip',
    isAlias: true
  },
  'junior-6-8': {
    name: 'Junior Foundation Class 6–8 Resources',
    classLevel: 'Class 6-8',
    subjects: 'Mathematics · Science',
    pricePaise: 39900,
    sampleFileKey: 'samples/junior-6-8-sample.pdf',
    bundleFileKey: 'courses/junior-6-8-bundle.zip',
    isAlias: true
  }
};

export function validateStudentName(name) {
  if (typeof name !== 'string') return { valid: false, message: 'Name is required' };
  const trimmed = name.trim();
  if (trimmed.length < 2) return { valid: false, message: 'Name must be at least 2 characters' };
  if (trimmed.length > 80) return { valid: false, message: 'Name cannot exceed 80 characters' };
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
    return { valid: false, message: 'Name contains invalid characters' };
  }
  return { valid: true, value: trimmed };
}

export function validateEmail(email) {
  if (typeof email !== 'string') return { valid: false, message: 'Email address is required' };
  const trimmed = email.trim().toLowerCase();
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
  const digits = String(phone).replace(/\D/g, '');
  const mobile = digits.length > 10 ? digits.slice(-10) : digits;
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
  if (honeypotValue && String(honeypotValue).trim() !== '') {
    return true;
  }
  return false;
}
