const Sentry = require('./sentry-renderer');
window.Sentry = Sentry;

const { ipcRenderer } = require('electron');
const { crash } = global.process || {};

// ─── Scope setup ────────────────────────────────────────────────────
const CUSTOMER_TYPES = ['small-plan', 'medium-plan', 'large-plan', 'enterprise'];
const customerType = CUSTOMER_TYPES[Math.floor(Math.random() * CUSTOMER_TYPES.length)];
Sentry.getCurrentScope().setTag('customerType', customerType);
Sentry.getGlobalScope().setAttributes({ customerType });

// ─── Backend config ──────────────────────────────────────────────────
const BACKEND_URL = process.env.BACKEND_URL || 'https://flask.empower-plant.com';
const AGENT_URL   = process.env.AGENT_URL   || 'https://agent.empower-plant.com';

// Derive backendType from URL for scope tagging
const backendType = ['flask','express','spring-boot','aspnetcore','laravel','ruby-on-rails']
  .find(b => BACKEND_URL.includes(b)) || 'flask';
Sentry.getCurrentScope().setTag('backendType', backendType);
Sentry.getGlobalScope().setAttributes({ backendType });

// ─── User context ────────────────────────────────────────────────────
const userEmail = `${Math.random().toString(36).slice(2, 5)}@example.com`;
Sentry.setUser({ email: userEmail });
Sentry.getCurrentScope().setTag('user.email', userEmail);

// ─── Fetch interceptor — adds scope context as headers to all backend calls ─
const _nativeFetch = window.fetch.bind(window);
window.fetch = async function(...args) {
  const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
  const isSentryIngest = /ingest\..*sentry\.io/.test(url);
  if (!isSentryIngest) {
    const options = args[1] || {};
    args[1] = { ...options, headers: { ...options.headers, customerType, email: userEmail } };
  }
  return _nativeFetch.apply(window, args);
};

// ─── Products — populated at runtime from the backend ───────────────
let PRODUCTS = [];

const EMPLOYEES = [
  { name: 'Jane Schmidt',  role: 'CEO',                img: '../assets/jane-schmidt.jpg',  bio: 'Jane is also an environmentalist. She brings her own mug for take-away coffee and uses public transportation whenever possible.' },
  { name: 'Lily Chan',     role: 'Software Engineer',  img: '../assets/lily-chan.jpg',      bio: 'Lily believes that taking care of plants helps people care about themselves and their surroundings.' },
  { name: 'Keith Ryan',    role: 'Product Manager',    img: '../assets/keith-ryan.jpg',     bio: 'Keith is an avid rock climber with a specific passion for bouldering.' },
  { name: 'Mason Kim',     role: 'Sales',              img: '../assets/mason-kim.jpg',      bio: 'Fun fact: Mason will eat his vegetables, but he has no idea that cashews grow on trees.' },
  { name: 'Emma Garcia',   role: 'Engineer',           img: '../assets/emma-garcia.jpg',    bio: 'Every day Emma speaks with users near and far to help them buy, replace, use, and fix Empower Plant products.' },
  { name: 'Noah Miller',   role: 'Marketing',          img: '../assets/noah-miller.jpg',    bio: 'Most days Noah is wearing company swag. His kids are priority #1.' },
];

// ─── Utilities ───────────────────────────────────────────────────────
function busySleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

// ─── Cart state ──────────────────────────────────────────────────────
let cart = { items: [], quantities: {}, total: 0 };

function countItemsInCart() {
  return Object.values(cart.quantities).reduce((a, b) => a + b, 0);
}

function addToCart(product) {
  return Sentry.startSpan({ name: 'items_added_to_cart', op: 'function' }, (span) => {
    if (cart.quantities[product.id]) {
      cart.quantities[product.id]++;
    } else {
      cart.items.push(product);
      cart.quantities[product.id] = 1;
    }
    cart.total += product.price;
    const itemsInCart = countItemsInCart();
    span.setAttributes({ customerType, items_in_cart: itemsInCart });
    Sentry.metrics.distribution('items_in_cart', itemsInCart);
    Sentry.metrics.count('cart.add', 1, { attributes: { source: 'cart', product_id: product.id } });
    updateCartBadge();
    if (document.getElementById('page-cart').classList.contains('page--active')) {
      renderCart();
    }
  });
}

function removeFromCart(product) {
  if (!cart.quantities[product.id]) return;
  cart.quantities[product.id]--;
  cart.total -= product.price;
  if (cart.quantities[product.id] === 0) {
    delete cart.quantities[product.id];
    cart.items = cart.items.filter(i => i.id !== product.id);
  }
  Sentry.metrics.distribution('items_in_cart', countItemsInCart());
  Sentry.metrics.count('cart.remove', 1, { attributes: { product_id: product.id } });
  updateCartBadge();
  renderCart();
}

function updateCartBadge() {
  const total = cart.total;
  const badge = document.getElementById('cart-nav-label');
  if (badge) {
    badge.textContent = total > 0 ? `Cart ($${total}.00)` : 'Cart';
  }
}

// ─── Router ──────────────────────────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('page--active'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('page--active');
  document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
    a.classList.toggle('nav-link--active', a.dataset.page === pageId);
  });
  window.scrollTo(0, 0);
}

// ─── Render: Products page ────────────────────────────────────────────
function renderProducts() {
  const list = document.getElementById('products-list');
  if (!list) return;
  list.innerHTML = '<p style="padding:2rem">Loading products…</p>';

  Sentry.startSpan({ name: 'products.load', op: 'pageload', forceTransaction: true }, async () => {
    try {
      // Parallel tracing calls — mirrors React app's Products.jsx pattern
      const t0 = Date.now();
      const [productsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/products`),
        fetch(`${BACKEND_URL}/api`).catch(() => {}),
        fetch(`${BACKEND_URL}/organization`).catch(() => {}),
        fetch(`${BACKEND_URL}/connect`).catch(() => {}),
      ]);

      const loadDuration = Date.now() - t0;
      Sentry.metrics.distribution('request.duration', loadDuration, { unit: 'millisecond', tags: { endpoint: '/products' } });
      Sentry.metrics.distribution('products.load_duration', loadDuration, { unit: 'millisecond' });

      if (!productsRes.ok) {
        Sentry.withScope((scope) => {
          scope.setContext('err', { status: productsRes.status, statusText: productsRes.statusText });
          Sentry.captureException(new Error(`Products API error: ${productsRes.status}`));
        });
        list.innerHTML = '<p style="padding:2rem;color:red">Unable to load products. Is the backend running?</p>';
        return;
      }

      const data = await productsRes.json();
      window.PRODUCTS = PRODUCTS = data.slice(0, 4).map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        img: p.imgcropped || p.img,
        description: p.description,
        reviews: p.reviews || [],
      }));

      list.innerHTML = PRODUCTS.map((product, idx) => {
        const avg = product.reviews.length
          ? (product.reviews.reduce((a, b) => a + b.rating, 0) / product.reviews.length).toFixed(1)
          : '0.0';
        const stars = [1,2,3,4,5].map(i =>
          `<span class="star">${i <= Math.round(Number(avg)) ? '&#9733;' : '&#9734;'}</span>`
        ).join('');

        return `
          <li>
            <div class="product-card-inner">
              <img src="${product.img}" alt="${product.title}" />
              <div>
                <h2>${product.title}</h2>
                <p class="product-description">${product.description}</p>
              </div>
              <button class="sentry-unmask" onclick="addToCart(PRODUCTS[${idx}])">
                Add to cart — $${product.price.toFixed(2)}
              </button>
              <p class="product-stars">${stars} (${product.reviews.length})</p>
            </div>
          </li>`;
      }).join('');

    } catch (err) {
      Sentry.captureException(err);
      list.innerHTML = '<p style="padding:2rem;color:red">Unable to load products. Is the backend running?</p>';
    }
  });
}

// ─── Render: About page ───────────────────────────────────────────────
function renderAbout() {
  const list = document.getElementById('employee-list');
  if (!list) return;
  Sentry.startSpan({ name: 'about.load', op: 'pageload', forceTransaction: true }, async () => {
    // Deliberate CPU-blocking sleep — mirrors the React app's About busy_sleep
    busySleep(Math.floor(Math.random() * 25) + 100);

    // Parallel tracing calls — mirrors React app's About.jsx pattern
    await Promise.all([
      fetch(`${BACKEND_URL}/api`).catch(() => {}),
      fetch(`${BACKEND_URL}/organization`).catch(() => {}),
      fetch(`${BACKEND_URL}/connect`).catch(() => {}),
    ]);

    list.innerHTML = EMPLOYEES.map(e => `
      <li>
        <img src="${e.img}" alt="${e.name}" />
        <h5>${e.name}</h5>
        <p class="employee-role">${e.role}</p>
      </li>`
    ).join('');
  });
}

// ─── Render: Cart page ────────────────────────────────────────────────
function renderCart() {
  const container = document.getElementById('cart-contents');
  if (!container) return;

  if (cart.items.length === 0) {
    container.innerHTML = '<p>Your cart is empty. <a href="#" onclick="showPage(\'products\');return false;">Browse products</a></p>';
    return;
  }

  const rows = cart.items.map(item => {
    const qty = cart.quantities[item.id];
    return `
      <li class="cart-item">
        <img src="${item.img}" alt="${item.title}" />
        <h4>${item.title}</h4>
        <p>$${item.price}.00</p>
        <div class="quantity-adjust">
          <button onclick="removeFromCart(PRODUCTS.find(p => p.id === ${item.id}))">–</button>
          <span>${qty}</span>
          <button onclick="addToCart(PRODUCTS.find(p => p.id === ${item.id}))">+</button>
        </div>
        <p>$${item.price * qty}.00</p>
      </li>`;
  }).join('');

  container.innerHTML = `
    <ul class="cart-list">${rows}</ul>
    <h3 class="cart-subtotal sentry-unmask">Cart Subtotal: $${cart.total}.00</h3>
    <button onclick="showPage('checkout')">Proceed to checkout</button>`;
}

// ─── Checkout ─────────────────────────────────────────────────────────
function submitCheckout(event) {
  event.preventDefault();
  const btn = event.target.querySelector('[type=submit]');
  btn.disabled = true;
  btn.value = 'Processing…';

  Sentry.startSpan({ name: 'checkout_submit', forceTransaction: true }, async (span) => {
    const itemsInCart = countItemsInCart();
    span.setAttribute('checkout_submit.click', 1);
    span.setAttribute('checkout_submit.num_items', itemsInCart);
    span.setAttribute('checkout_submit.order_total', cart.total);

    Sentry.metrics.count('checkout_submit.click', 1);
    Sentry.metrics.distribution('checkout_submit.num_items', itemsInCart);
    Sentry.metrics.distribution('checkout_submit.order_total', cart.total);

    const formEl = event.target;
    const formData = {
      email:     formEl.elements['email'].value,
      firstName: formEl.elements['firstName'].value,
      lastName:  formEl.elements['lastName'].value,
      address:   formEl.elements['address'].value,
      city:      formEl.elements['city'].value,
      country:   formEl.elements['country'].value,
      state:     formEl.elements['state'].value,
      zipCode:   formEl.elements['zipCode'].value,
      promoCode: formEl.elements['promoCode'].value,
      subscribe: formEl.elements['subscribe'].checked,
    };

    try {
      const res = await Sentry.startSpan({ name: 'checkout.post', op: 'http.client' }, () =>
        fetch(`${BACKEND_URL}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart: { items: cart.items, quantities: cart.quantities, total: cart.total },
            form: formData,
            validate_inventory: 'true',
          }),
        })
      );

      const result = await res.json();
      span.setAttribute('checkout_submit.status', res.status);

      if (!res.ok || result.status === 'failed') {
        throw new Error(`Checkout failed: ${(result.out_of_stock || []).join(', ') || res.status}`);
      }

      span.setAttribute('checkout_submit.success', 1);
      Sentry.metrics.count('checkout_submit.success', 1);
      Sentry.logger.info('Checkout completed successfully', { total: cart.total, items: itemsInCart });

      cart = { items: [], quantities: {}, total: 0 };
      updateCartBadge();
      try { Sentry.getReplay().flush(); } catch (_) {}
      showPage('complete');

    } catch (err) {
      span.setAttribute('checkout_submit.error', 1);
      span.setAttribute('checkout_submit.status', 500);
      Sentry.metrics.count('checkout_submit.error', 1);
      Sentry.metrics.gauge('checkout_submit.status', 500);
      Sentry.logger.error('Checkout failed', { error: err.message, total: cart.total, items: itemsInCart });
      Sentry.withScope((scope) => {
        scope.setContext('checkout', { items: itemsInCart, total: cart.total });
        Sentry.captureException(err);
      });
      btn.disabled = false;
      btn.value = 'Complete order';
      const errMsg = document.getElementById('promo-message');
      if (errMsg) { errMsg.textContent = `Order failed: ${err.message}`; errMsg.style.color = 'red'; }
    }
  });
}

function applyPromoCode() {
  const input = document.getElementById('promoCode');
  const msg = document.getElementById('promo-message');
  if (!input.value.trim()) { msg.textContent = 'Please enter a promo code.'; msg.style.color = 'red'; return; }

  Sentry.startSpan({ op: 'http.client', name: 'handleApplyPromoCode' }, async () => {
    msg.textContent = 'Applying…';
    try {
      const res = await fetch(`${BACKEND_URL}/apply-promo-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: input.value }),
      });
      const data = await res.json();
      Sentry.metrics.distribution('request.duration', 0, { unit: 'millisecond', tags: { endpoint: '/apply-promo-code' } });

      if (res.ok && data.success) {
        const { percent_discount, max_dollar_savings } = data.promo_code;
        msg.textContent = `Promo applied! ${percent_discount}% off (up to $${max_dollar_savings})`;
        msg.style.color = 'green';
        Sentry.logger.info('Promo code applied', { code: input.value, discount: percent_discount });
      } else {
        const code = data.error?.code;
        msg.textContent = code === 'expired' ? 'Promo code has expired.' : 'Invalid promo code.';
        msg.style.color = 'red';
        Sentry.logger.warn('Promo code rejected', { code: input.value, reason: code });
      }
    } catch (err) {
      msg.textContent = 'Unable to apply promo code.';
      msg.style.color = 'red';
      Sentry.captureException(err);
    }
  });
}

// ─── Footer newsletter ────────────────────────────────────────────────
function subscribeNewsletter(event) {
  event.preventDefault();
  const input = document.getElementById('footer-email');
  const msg = document.getElementById('subscribe-message');
  if (!input.value) return;
  Sentry.withScope((scope) => {
    scope.setContext('newsletter', { email: input.value });
    msg.textContent = 'You have successfully subscribed!';
    Sentry.logger.info('Newsletter subscription', { email: input.value });
  });
}

// ─── Errors page — demo functions ────────────────────────────────────

function notAFunctionError() {
  const onlineStatus = navigator.onLine ? 'online' : 'offline';
  Sentry.getCurrentScope().setTag('onlineStatus', onlineStatus);
  Sentry.logger.info('notAFunctionError triggered', { onlineStatus });
  Sentry.metrics.count('demo.error.triggered', 1, { tags: { errorType: 'typeError' } });
  var someArray = [{ func: function() {} }];
  someArray[1].func();
}

function referenceError() {
  const onlineStatus = navigator.onLine ? 'online' : 'offline';
  Sentry.getCurrentScope().setTag('onlineStatus', onlineStatus);
  Sentry.logger.info('referenceError triggered', { onlineStatus });
  Sentry.metrics.count('demo.error.triggered', 1, { tags: { errorType: 'referenceError' } });
  console.log(undefinedVariable); // eslint-disable-line no-undef
}

function rangeError() {
  const onlineStatus = navigator.onLine ? 'online' : 'offline';
  Sentry.getCurrentScope().setTag('onlineStatus', onlineStatus);
  Sentry.logger.info('rangeError triggered', { onlineStatus });
  Sentry.metrics.count('demo.error.triggered', 1, { tags: { errorType: 'rangeError' } });
  Sentry.setContext('rangeError', { parameter: 0, validRange: '1–100' });
  throw new RangeError('Parameter must be between 1 and 100');
}

function syntaxError() {
  const onlineStatus = navigator.onLine ? 'online' : 'offline';
  Sentry.getCurrentScope().setTag('onlineStatus', onlineStatus);
  Sentry.logger.info('syntaxError triggered', { onlineStatus });
  Sentry.metrics.count('demo.error.triggered', 1, { tags: { errorType: 'syntaxError' } });
  eval('foo bar'); // eslint-disable-line no-eval
}

function crashMain()          { Sentry.logger.warn('Native crash — main');          ipcRenderer.send('demo.crash'); }
function errorMain()          { Sentry.logger.info('JS error — main');              ipcRenderer.send('demo.error'); }
function referenceErrorMain() { Sentry.logger.info('ReferenceError — main');        ipcRenderer.send('demo.referenceError'); }
function rangeErrorMain()     { Sentry.logger.info('RangeError — main');            ipcRenderer.send('demo.rangeError'); }

function errorRenderer() {
  Sentry.logger.error('Unhandled error — renderer');
  Sentry.metrics.count('demo.error.triggered', 1, { tags: { errorType: 'rendererError' } });
  throw new Error('Error in renderer process');
}

function addToCartJsError() {
  Sentry.logger.info('addToCartJsError triggered');
  Sentry.metrics.count('demo.error.triggered', 1, { tags: { errorType: 'addToCartError' } });
  let inventory = undefined;
  const stock = inventory[0]; // TypeError: Cannot read properties of undefined
  return stock;
}

window.crashRenderer = crash;

function slowOperation() {
  return Sentry.startSpan({ name: 'slow_renderer_task', op: 'task' }, async () => {
    const start = Date.now();
    const end = start + 200;
    while (Date.now() < end) {}
    const duration = Date.now() - start;
    Sentry.logger.log('Slow renderer task completed');
    Sentry.metrics.distribution('demo.task.duration', duration, { unit: 'millisecond', tags: { task: 'slow_renderer_task' } });
  });
}

function nPlusOneRequests() {
  Sentry.logger.warn('Starting N+1 requests demo');
  Sentry.metrics.count('demo.nplusone.triggered', 1);
  return Sentry.startSpan({ name: 'n_plus_one_requests', op: 'http.client', forceTransaction: true }, async () => {
    const spans = Array.from({ length: 20 }, (_, i) =>
      Sentry.startInactiveSpan({ name: `fetch product ${i + 1}`, op: 'http.client' })
    );
    const results = await Promise.all(
      spans.map((span, i) =>
        fetch(`https://jsonplaceholder.typicode.com/todos/${i + 1}`)
          .then(r => r.json())
          .finally(() => span.end())
      )
    );
    Sentry.metrics.gauge('demo.nplusone.items_fetched', results.length);
    Sentry.logger.log('N+1 requests completed', { count: results.length });
  });
}

function showFeedbackDialog() {
  const eventId = sessionStorage.getItem('lastErrorEventId') || Sentry.lastEventId();
  if (eventId) {
    Sentry.showReportDialog({ eventId });
  } else {
    const id = Sentry.captureMessage('User opened feedback dialog');
    Sentry.showReportDialog({ eventId: id });
  }
}

// ─── AI Chat Widget ───────────────────────────────────────────────────
const INACTIVITY_MS = 15000;
let chatState = {
  isOpen: false,
  conversationState: 'initial',
  messages: [],
  userResponses: { light: '', maintenance: '' },
  chatSpan: null,
  conversationId: null,
  typingSpan: null,
  typingTimeout: null,
  inactivityTimeout: null,
  conversationStarted: false,
  initTimeouts: [],
};

let _msgIdCounter = 0;
const _genMsgId = () => `msg-${Date.now()}-${++_msgIdCounter}`;
const _genConvId = () => `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function _renderChatMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = chatState.messages.map(msg => {
    if (msg.type === 'typing') {
      return '<div class="message bot-message"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
    }
    const cls = msg.type === 'bot' ? 'bot-message' : 'user-message';
    const text = (msg.text || '').replace(/\n/g, '<br>');
    return `<div class="message ${cls}"><div class="message-bubble">${text}</div></div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function _updateChatInputVisibility() {
  const form = document.getElementById('chat-input-form');
  if (!form) return;
  const show = chatState.conversationState === 'awaiting_light' || chatState.conversationState === 'awaiting_maintenance';
  form.style.display = show ? 'flex' : 'none';
}

function _addBotMessage(text) {
  chatState.messages = chatState.messages.filter(m => m.type !== 'typing');
  const msg = { type: 'bot', text, id: _genMsgId() };
  if (chatState.chatSpan) {
    Sentry.withActiveSpan(chatState.chatSpan, () => {
      Sentry.startSpan({ op: 'ui.render', name: 'Render Bot Message' }, () => {
        chatState.messages.push(msg);
        _renderChatMessages();
        _updateChatInputVisibility();
      });
    });
  } else {
    chatState.messages.push(msg);
    _renderChatMessages();
    _updateChatInputVisibility();
  }
}

function _addTypingIndicator() {
  chatState.messages.push({ type: 'typing', id: _genMsgId() });
  _renderChatMessages();
}

function _startInactivityTimer() {
  if (chatState.inactivityTimeout) clearTimeout(chatState.inactivityTimeout);
  if (!chatState.chatSpan) return;
  chatState.inactivityTimeout = setTimeout(() => endChatSession('inactivity_timeout'), INACTIVITY_MS);
}

function endChatSession(reason) {
  reason = reason || 'unknown';
  if (chatState.typingTimeout) { clearTimeout(chatState.typingTimeout); chatState.typingTimeout = null; }
  if (chatState.typingSpan) { chatState.typingSpan.end(); chatState.typingSpan = null; }
  if (chatState.inactivityTimeout) { clearTimeout(chatState.inactivityTimeout); chatState.inactivityTimeout = null; }
  chatState.initTimeouts.forEach(id => clearTimeout(id));
  chatState.initTimeouts = [];
  Sentry.setConversationId(null);
  if (chatState.chatSpan) {
    const isTimeout = reason === 'inactivity_timeout';
    Sentry.withActiveSpan(chatState.chatSpan, () => {
      Sentry.startSpan({ op: isTimeout ? 'mark' : 'ui.action', name: `Session End: ${reason}` }, () => {});
    });
    chatState.chatSpan.end();
    chatState.chatSpan = null;
  }
}

function openChat() {
  Sentry.metrics.count('chat.open', 1);
  chatState.conversationStarted = false;
  chatState.conversationId = _genConvId();
  Sentry.setConversationId(chatState.conversationId);
  Sentry.startNewTrace(() => {
    chatState.chatSpan = Sentry.startInactiveSpan({
      op: 'ui.interaction.chat',
      name: 'AI Agent Chat Session',
      forceTransaction: true,
    });
  });
  chatState.isOpen = true;
  chatState.conversationState = 'initial';
  chatState.messages = [];
  chatState.userResponses = { light: '', maintenance: '' };
  const chatWindow = document.getElementById('chat-window');
  if (chatWindow) chatWindow.style.display = 'flex';
  _updateChatInputVisibility();

  _addTypingIndicator();
  const t1 = setTimeout(() => {
    _addBotMessage('Hi, I can help you pick the right plants for your home');
    const t2 = setTimeout(() => {
      _addTypingIndicator();
      const t3 = setTimeout(() => {
        _addBotMessage('How much light does your room get?');
        chatState.conversationState = 'awaiting_light';
        _updateChatInputVisibility();
        const inp = document.getElementById('chat-message-input');
        if (inp) inp.focus();
      }, 1000);
      chatState.initTimeouts.push(t3);
    }, 500);
    chatState.initTimeouts.push(t2);
  }, 1000);
  chatState.initTimeouts.push(t1);
}

function closeChat(reason) {
  endChatSession(reason || 'click_close_button');
  chatState.isOpen = false;
  const chatWindow = document.getElementById('chat-window');
  if (chatWindow) chatWindow.style.display = 'none';
}

function toggleChat() {
  if (!chatState.isOpen) { openChat(); } else { closeChat('click_agent_button'); }
}

async function sendChatMessage(event) {
  event.preventDefault();
  const input = document.getElementById('chat-message-input');
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  input.value = '';

  if (chatState.typingSpan) { chatState.typingSpan.end(); chatState.typingSpan = null; }
  if (chatState.typingTimeout) { clearTimeout(chatState.typingTimeout); chatState.typingTimeout = null; }

  if (chatState.chatSpan) {
    Sentry.withActiveSpan(chatState.chatSpan, () => {
      Sentry.startSpan({ op: 'ui.action.click', name: 'Send Message' }, () => {});
    });
  }

  Sentry.metrics.count('chat.message_sent', 1, { attributes: { step: chatState.conversationState } });
  if (chatState.conversationState === 'awaiting_light' && !chatState.conversationStarted) {
    chatState.conversationStarted = true;
    Sentry.metrics.count('chat.conversation_started', 1);
  }

  chatState.messages.push({ type: 'user', text, id: _genMsgId() });
  _renderChatMessages();

  if (chatState.conversationState === 'awaiting_light') {
    chatState.userResponses.light = text;
    _updateChatInputVisibility();
    _addTypingIndicator();
    const t = setTimeout(() => {
      _addBotMessage('Are you only looking for low-maintenance plants?');
      chatState.conversationState = 'awaiting_maintenance';
      _updateChatInputVisibility();
      const inp = document.getElementById('chat-message-input');
      if (inp) inp.focus();
    }, 1000);
    chatState.initTimeouts.push(t);

  } else if (chatState.conversationState === 'awaiting_maintenance') {
    chatState.userResponses.maintenance = text;
    chatState.conversationState = 'completed';
    _updateChatInputVisibility();
    _addTypingIndicator();
    const headers = { 'Content-Type': 'application/json' };
    if (chatState.conversationId) headers['x-conversation-id'] = chatState.conversationId;
    const body = JSON.stringify({
      light: chatState.userResponses.light,
      maintenance: `Are you only looking for low-maintenance plants? Answer: ${text}`,
    });
    try {
      let response, data;
      if (chatState.chatSpan) {
        await Sentry.withActiveSpan(chatState.chatSpan, async () => {
          response = await _nativeFetch(`${AGENT_URL}/api/v1/buy-plants`, { method: 'POST', headers, body });
          data = await response.json();
        });
      } else {
        response = await _nativeFetch(`${AGENT_URL}/api/v1/buy-plants`, { method: 'POST', headers, body });
        data = await response.json();
      }
      _addBotMessage(data.response);
      _startInactivityTimer();
    } catch (err) {
      _addBotMessage('Sorry, I encountered an error. Please try again later.');
      chatState.conversationState = 'error';
      _startInactivityTimer();
    }
  }
}

function chatInputChanged() {
  if (!chatState.chatSpan) return;
  if (!chatState.typingSpan) {
    Sentry.withActiveSpan(chatState.chatSpan, () => {
      chatState.typingSpan = Sentry.startInactiveSpan({ op: 'ui.action', name: 'User Typing' });
    });
  }
  if (chatState.typingTimeout) clearTimeout(chatState.typingTimeout);
  chatState.typingTimeout = setTimeout(() => {
    if (chatState.typingSpan) { chatState.typingSpan.end(); chatState.typingSpan = null; }
  }, 1000);
}

function chatInputFocused() {
  if (!chatState.chatSpan) return;
  Sentry.withActiveSpan(chatState.chatSpan, () => {
    Sentry.startSpan({ op: 'ui.action', name: 'Focus Chat Input' }, () => {});
  });
}

// ─── Online / offline IPC ─────────────────────────────────────────────
const updateOnlineStatus = () => {
  ipcRenderer.send('online-status-changed', navigator.onLine ? 'online' : 'offline');
};
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ─── App version info ─────────────────────────────────────────────────
const versions = {
  chrome:   process.versions.chrome,
  electron: process.versions.electron,
  node:     process.versions.node,
};

// ─── Expose to window for HTML inline event handlers ──────────────────
Object.assign(window, {
  showPage, renderProducts, renderAbout, renderCart,
  addToCart, removeFromCart,
  submitCheckout, applyPromoCode, subscribeNewsletter,
  notAFunctionError, referenceError, rangeError, syntaxError,
  errorMain, errorRenderer, referenceErrorMain, rangeErrorMain,
  crashMain,
  addToCartJsError, slowOperation, nPlusOneRequests,
  showFeedbackDialog,
  openChat, closeChat, toggleChat,
  sendChatMessage, chatInputChanged, chatInputFocused, endChatSession,
});
