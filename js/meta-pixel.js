/**
 * FindCollege.ai — Centralized Meta Pixel & Conversions Tracking Utility
 * 
 * Instructions:
 * Enter your Meta Pixel ID below (e.g. '123456789012345').
 * If left empty (''), tracking safely skips without throwing errors.
 */

window.FINDCOLLEGE_CONFIG = window.FINDCOLLEGE_CONFIG || {};
window.FINDCOLLEGE_CONFIG.META_PIXEL_ID = window.FINDCOLLEGE_CONFIG.META_PIXEL_ID || '';

(function () {
  'use strict';

  var pixelId = window.FINDCOLLEGE_CONFIG.META_PIXEL_ID;
  var purchaseDedupeSet = new Set();

  // Initialize Meta Pixel Base Code
  function initPixel() {
    if (!pixelId || pixelId.trim() === '') {
      console.log('ℹ️ [Meta Pixel] Disabled or Pixel ID not configured yet. Set window.FINDCOLLEGE_CONFIG.META_PIXEL_ID.');
      return;
    }

    if (window.fbq) return;

    /* eslint-disable */
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */

    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
    console.log('✅ [Meta Pixel] Initialized with ID:', pixelId);
  }

  // Safe tracking helper
  function track(eventName, params, eventId) {
    if (!window.fbq || !pixelId) {
      console.log(`[Meta Event Mock: ${eventName}]`, params, eventId ? `(EventID: ${eventId})` : '');
      return;
    }
    if (eventId) {
      window.fbq('track', eventName, params || {}, { eventID: eventId });
    } else {
      window.fbq('track', eventName, params || {});
    }
  }

  window.FCAI_Pixel = {
    init: initPixel,

    setPixelId: function (id) {
      pixelId = id;
      window.FINDCOLLEGE_CONFIG.META_PIXEL_ID = id;
      initPixel();
    },

    // 1. PageView
    trackPageView: function () {
      track('PageView');
    },

    // 2. ViewContent — Course viewed or inspected
    trackViewContent: function (course) {
      track('ViewContent', {
        content_name: course.name,
        content_category: 'Digital Study Course',
        content_ids: [course.id],
        content_type: 'product',
        value: course.priceInr,
        currency: 'INR'
      });
    },

    // 3. Lead — Fired ONLY after sample form is successfully submitted & validated
    trackLead: function (course, leadId) {
      track('Lead', {
        content_name: course.name,
        content_category: 'Free Sample Lead',
        content_ids: [course.id],
        currency: 'INR',
        value: 0
      }, leadId ? `lead_${leadId}` : undefined);
    },

    // 4. InitiateCheckout — Fired when user genuinely clicks Buy Now & order initializes
    trackInitiateCheckout: function (course, orderId) {
      track('InitiateCheckout', {
        content_name: course.name,
        content_ids: [course.id],
        content_type: 'product',
        value: course.priceInr,
        currency: 'INR',
        num_items: 1
      }, orderId ? `order_${orderId}` : undefined);
    },

    // 5. Purchase — Fired ONLY after cryptographic payment verification succeeds
    trackPurchase: function (course, orderId, paymentId, amountInr) {
      // Deduplication guard
      if (purchaseDedupeSet.has(orderId)) {
        console.warn('Purchase event already dispatched for order:', orderId);
        return;
      }
      purchaseDedupeSet.add(orderId);

      // Never send raw PII to Meta custom parameters
      track('Purchase', {
        content_name: course.name,
        content_ids: [course.id],
        content_type: 'product',
        value: amountInr,
        currency: 'INR',
        num_items: 1
      }, orderId); // Event ID for browser & server Conversions API deduplication
    }
  };

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPixel);
  } else {
    initPixel();
  }
})();

