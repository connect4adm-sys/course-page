/**
 * FindCollege.ai — Client-Side Course Sales, Sample Modal & Razorpay Checkout
 */

(function () {
  'use strict';

  var currentCourses = {
    'jee-full': { id: 'jee-full', name: 'JEE Full Resources', priceInr: 499 },
    'neet-full': { id: 'neet-full', name: 'NEET Full Resources', priceInr: 499 },
    'foundation-9-10': { id: 'foundation-9-10', name: 'Foundation Class 9–10 Resources', priceInr: 399 },
    'junior-6-8': { id: 'junior-6-8', name: 'Junior Foundation Class 6–8 Resources', priceInr: 399 }
  };

  // Fetch live backend catalog on load
  function syncCatalog() {
    fetch('/api/courses')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success && Array.isArray(data.courses)) {
          data.courses.forEach(function (c) {
            currentCourses[c.id] = { id: c.id, name: c.courseName, priceInr: c.priceInr };
          });
        }
      })
      .catch(function (err) {
        console.warn('Catalog sync fallback to local cache:', err.message);
      });
  }

  // --- Modal Helpers ---
  function openModal(id) {
    var m = document.getElementById(id);
    if (m) {
      m.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    var m = document.getElementById(id);
    if (m) {
      m.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Toast / Alert banner helper
  function showToast(msg, type) {
    var toast = document.getElementById('fcai-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'fcai-toast';
      toast.className = 'fcai-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'fcai-toast fcai-toast-' + (type || 'info') + ' show';
    setTimeout(function () {
      toast.classList.remove('show');
    }, 5000);
  }

  // --- 1. Sample Modal Handler ---
  window.openSampleModal = function (courseId) {
    var course = currentCourses[courseId] || currentCourses['jee-full'];
    var select = document.getElementById('sample-course-select');
    if (select) select.value = course.id;

    var statusEl = document.getElementById('sample-modal-status');
    if (statusEl) statusEl.innerHTML = '';

    var formEl = document.getElementById('sample-request-form');
    if (formEl) formEl.reset();

    if (window.FCAI_Pixel) {
      window.FCAI_Pixel.trackViewContent(course);
    }

    openModal('sample-modal');
  };

  window.closeSampleModal = function () {
    closeModal('sample-modal');
  };

  // Submit Free Sample Form
  function initSampleForm() {
    var form = document.getElementById('sample-request-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var nameInput = document.getElementById('sample-name');
      var emailInput = document.getElementById('sample-email');
      var phoneInput = document.getElementById('sample-phone');
      var courseSelect = document.getElementById('sample-course-select');
      var honeypotInput = document.getElementById('sample-hp');
      var submitBtn = document.getElementById('sample-submit-btn');
      var statusEl = document.getElementById('sample-modal-status');

      var name = (nameInput?.value || '').trim();
      var email = (emailInput?.value || '').trim();
      var phone = (phoneInput?.value || '').trim();
      var courseId = courseSelect?.value || 'jee-full';
      var honeypot = honeypotInput?.value || '';

      // Frontend validation
      if (name.length < 2) {
        statusEl.innerHTML = '<div class="fcai-alert fcai-alert-error">Please enter your valid full name.</div>';
        nameInput.focus();
        return;
      }
      if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        statusEl.innerHTML = '<div class="fcai-alert fcai-alert-error">Please enter a valid email address.</div>';
        emailInput.focus();
        return;
      }
      var cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        statusEl.innerHTML = '<div class="fcai-alert fcai-alert-error">Please enter a valid 10-digit Indian mobile number.</div>';
        phoneInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending Sample... <span class="fcai-spinner"></span>';
      statusEl.innerHTML = '';

      fetch('/api/sample-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          phone: cleanPhone,
          courseId: courseId,
          honeypot: honeypot
        })
      })
      .then(function (res) { return res.json(); })
      .then(function (res) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Get Free Sample Now →';

        if (res.success) {
          var targetCourse = currentCourses[courseId] || { name: 'Course' };
          statusEl.innerHTML = [
            '<div class="fcai-alert fcai-alert-success">',
            '  <h4>🎉 Check Your Email!</h4>',
            '  <p>' + res.message + '</p>',
            '  <p style="font-size: 13px; margin-top: 8px;">Sent to: <strong>' + res.email + '</strong></p>',
            '</div>'
          ].join('');

          form.reset();

          if (window.FCAI_Pixel) {
            window.FCAI_Pixel.trackLead(targetCourse);
          }
        } else {
          statusEl.innerHTML = '<div class="fcai-alert fcai-alert-error">' + (res.message || 'Submission failed. Please try again.') + '</div>';
        }
      })
      .catch(function (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Get Free Sample Now →';
        statusEl.innerHTML = '<div class="fcai-alert fcai-alert-error">Network error. Please check your connection and try again.</div>';
      });
    });
  }

  // --- 2. Buy Now & Razorpay Checkout Flow ---
  window.openBuyModal = function (courseId) {
    var course = currentCourses[courseId] || currentCourses['jee-full'];
    
    var titleEl = document.getElementById('buy-modal-course-title');
    var priceEl = document.getElementById('buy-modal-price');
    var hiddenCourse = document.getElementById('buy-course-id');
    var statusEl = document.getElementById('buy-modal-status');

    if (titleEl) titleEl.textContent = course.name;
    if (priceEl) priceEl.textContent = '₹' + course.priceInr;
    if (hiddenCourse) hiddenCourse.value = course.id;
    if (statusEl) statusEl.innerHTML = '';

    if (window.FCAI_Pixel) {
      window.FCAI_Pixel.trackViewContent(course);
    }

    openModal('buy-modal');
  };

  window.closeBuyModal = function () {
    closeModal('buy-modal');
  };

  function initBuyForm() {
    var form = document.getElementById('buy-checkout-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var nameInput = document.getElementById('buy-name');
      var emailInput = document.getElementById('buy-email');
      var phoneInput = document.getElementById('buy-phone');
      var courseIdInput = document.getElementById('buy-course-id');
      var submitBtn = document.getElementById('buy-submit-btn');
      var statusEl = document.getElementById('buy-modal-status');

      var name = (nameInput?.value || '').trim();
      var email = (emailInput?.value || '').trim();
      var phone = (phoneInput?.value || '').trim();
      var courseId = courseIdInput?.value || 'jee-full';
      var course = currentCourses[courseId] || { name: 'Digital Course', priceInr: 499 };

      // Validation
      if (name.length < 2) {
        statusEl.innerHTML = '<div class="fcai-alert fcai-alert-error">Please enter your full name.</div>';
        nameInput.focus();
        return;
      }
      if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        statusEl.innerHTML = '<div class="fcai-alert fcai-alert-error">Please enter a valid email address.</div>';
        emailInput.focus();
        return;
      }
      var cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        statusEl.innerHTML = '<div class="fcai-alert fcai-alert-error">Please enter a valid 10-digit Indian mobile number.</div>';
        phoneInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Connecting to Secure Checkout... <span class="fcai-spinner"></span>';
      statusEl.innerHTML = '';

      // 1. Create order on backend (Price locked strictly on server)
      fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          phone: cleanPhone,
          courseId: courseId
        })
      })
      .then(function (res) { return res.json(); })
      .then(function (orderRes) {
        if (!orderRes.success) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Proceed to Secure Payment →';
          statusEl.innerHTML = '<div class="fcai-alert fcai-alert-error">' + (orderRes.message || 'Failed to initialize payment') + '</div>';
          return;
        }

        // Fire InitiateCheckout Meta Pixel Event
        if (window.FCAI_Pixel) {
          window.FCAI_Pixel.trackInitiateCheckout(course, orderRes.orderId);
        }

        // 2. Open Razorpay Checkout
        if (typeof window.Razorpay === 'function') {
          var options = {
            key: orderRes.keyId,
            amount: orderRes.amount,
            currency: orderRes.currency || 'INR',
            name: 'FindCollege.ai',
            description: orderRes.courseName,
            image: '/logo.png',
            order_id: orderRes.orderId,
            prefill: {
              name: name,
              email: email,
              contact: cleanPhone
            },
            theme: {
              color: '#8c38f4'
            },
            handler: function (response) {
              handlePaymentVerification({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                course: course,
                studentName: name,
                email: email
              });
            },
            modal: {
              ondismiss: function () {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Proceed to Secure Payment →';
                statusEl.innerHTML = '<div class="fcai-alert fcai-alert-info">Payment window closed. You can click to retry anytime.</div>';
              }
            }
          };

          var rzp = new window.Razorpay(options);
          rzp.open();
        } else {
          // If Razorpay script is not loaded or in mock demonstration mode
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Proceed to Secure Payment →';
          simulateLocalPaymentVerification({
            order_id: orderRes.orderId,
            course: course,
            studentName: name,
            email: email
          });
        }
      })
      .catch(function (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Proceed to Secure Payment →';
        statusEl.innerHTML = '<div class="fcai-alert fcai-alert-error">Failed to connect to checkout: ' + err.message + '</div>';
      });
    });
  }

  // Handle server payment verification callback
  function handlePaymentVerification(params) {
    var statusEl = document.getElementById('buy-modal-status');
    var submitBtn = document.getElementById('buy-submit-btn');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Verifying Payment... <span class="fcai-spinner"></span>';
    }

    fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: params.order_id,
        razorpay_payment_id: params.payment_id,
        razorpay_signature: params.signature
      })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success && data.verified) {
        showSuccessModal({
          course: params.course,
          studentName: params.studentName,
          email: params.email,
          orderId: data.orderId,
          paymentId: data.paymentId,
          accessCode: data.accessCode
        });

        // Fire Purchase Meta Pixel Event
        if (window.FCAI_Pixel) {
          window.FCAI_Pixel.trackPurchase(params.course, data.orderId, data.paymentId, params.course.priceInr);
        }

        closeModal('buy-modal');
      } else {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Retry Payment Verification';
        }
        if (statusEl) {
          statusEl.innerHTML = '<div class="fcai-alert fcai-alert-error">' + (data.message || 'Payment verification failed.') + '</div>';
        }
      }
    })
    .catch(function (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Retry Payment Verification';
      }
      if (statusEl) {
        statusEl.innerHTML = '<div class="fcai-alert fcai-alert-error">Error communicating with verification service: ' + err.message + '</div>';
      }
    });
  }

  // Fallback simulator for test runs
  function simulateLocalPaymentVerification(params) {
    var dummyPayId = 'pay_demo_' + Date.now().toString(36);
    handlePaymentVerification({
      order_id: params.order_id,
      payment_id: dummyPayId,
      signature: 'demo_sig_verified',
      course: params.course,
      studentName: params.studentName,
      email: params.email,
      is_demo: true
    });
  }

  // Success Celebration Modal
  function showSuccessModal(data) {
    var courseNameEl = document.getElementById('success-course-name');
    var emailEl = document.getElementById('success-email');
    var codeEl = document.getElementById('success-access-code');
    var orderEl = document.getElementById('success-order-id');

    if (courseNameEl) courseNameEl.textContent = data.course.name;
    if (emailEl) emailEl.textContent = data.email;
    if (codeEl) codeEl.textContent = data.accessCode;
    if (orderEl) orderEl.textContent = data.orderId;

    openModal('success-modal');
  }

  window.closeSuccessModal = function () {
    closeModal('success-modal');
  };

  // Attach modal trigger buttons to existing cards
  function attachCardTriggers() {
    var cards = document.querySelectorAll('.course-card');
    var courseIds = ['jee-full', 'neet-full', 'foundation-9-10', 'junior-6-8'];

    cards.forEach(function (card, idx) {
      var courseId = courseIds[idx] || 'jee-full';
      
      // Update or enhance existing View Details button
      var existingBtn = card.querySelector('.btn-card');
      if (existingBtn) {
        var actionContainer = document.createElement('div');
        actionContainer.className = 'card-action-row';

        var sampleBtn = document.createElement('button');
        sampleBtn.type = 'button';
        sampleBtn.className = 'btn-card-sample';
        sampleBtn.textContent = 'Free Sample';
        sampleBtn.onclick = function () { window.openSampleModal(courseId); };

        var buyBtn = document.createElement('button');
        buyBtn.type = 'button';
        buyBtn.className = 'btn-card-buy';
        buyBtn.textContent = 'Buy Now →';
        buyBtn.onclick = function () { window.openBuyModal(courseId); };

        actionContainer.appendChild(sampleBtn);
        actionContainer.appendChild(buyBtn);

        existingBtn.parentNode.replaceChild(actionContainer, existingBtn);
      }
    });

    // Also wire top Hero button & Bottom CTA buttons
    var heroBtn = document.querySelector('.btn-explore');
    if (heroBtn) {
      heroBtn.onclick = function (e) {
        // Smooth scroll to courses section
        var c = document.getElementById('courses');
        if (c) c.scrollIntoView({ behavior: 'smooth' });
      };
    }

    var ctaBannerBtn = document.querySelector('.btn-banner-yellow');
    if (ctaBannerBtn) {
      ctaBannerBtn.onclick = function (e) {
        var c = document.getElementById('courses');
        if (c) c.scrollIntoView({ behavior: 'smooth' });
      };
    }
  }

  // Initialization
  document.addEventListener('DOMContentLoaded', function () {
    syncCatalog();
    initSampleForm();
    initBuyForm();
    attachCardTriggers();
  });
})();

