// Paste your Google Apps Script web app URL here after deploying it.
// It looks like: https://script.google.com/macros/s/AKfycb.../exec
const API_URL = 'PASTE_YOUR_APPS_SCRIPT_URL_HERE';

const state = {
  menuItems: [], // [{ item, price }]
  order: {},     // { [itemName]: qty }
};

const els = {
  configBanner: document.getElementById('config-banner'),
  menuLabel: document.getElementById('menu-label'),
  menuList: document.getElementById('menu-list'),
  orderLines: document.getElementById('order-lines'),
  orderTotal: document.getElementById('order-total'),
  customerName: document.getElementById('customer-name'),
  submitBtn: document.getElementById('submit-order'),
  status: document.getElementById('order-status'),
};

function money(n) {
  return '$' + n.toFixed(2);
}

function isConfigured() {
  return API_URL && !API_URL.includes('PASTE_YOUR');
}

async function loadMenu() {
  if (!isConfigured()) {
    els.configBanner.hidden = false;
    els.menuList.innerHTML = '<li class="menu-loading">Connect the menu source in script.js to see today\u2019s items.</li>';
    return;
  }

  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    if (!data.ok) throw new Error(data.error || 'Could not load menu');

    state.menuItems = data.items || [];
    els.menuLabel.textContent = data.label || '';
    renderMenu();
  } catch (err) {
    els.menuList.innerHTML = '<li class="menu-loading">Couldn\u2019t load today\u2019s menu. Please refresh, or check back shortly.</li>';
  }
}

function renderMenu() {
  if (state.menuItems.length === 0) {
    els.menuList.innerHTML = '<li class="menu-loading">No items on the menu yet — check back soon.</li>';
    return;
  }

  els.menuList.innerHTML = '';
  state.menuItems.forEach((menuItem) => {
    const qty = state.order[menuItem.item] || 0;

    const li = document.createElement('li');
    li.className = 'menu-row';
    li.innerHTML = `
      <span class="menu-row-name">${escapeHtml(menuItem.item)}</span>
      <span class="menu-row-leader"></span>
      <span class="menu-row-price">${money(menuItem.price)}</span>
      <span class="menu-row-controls">
        <button type="button" class="qty-btn" data-action="dec" aria-label="Remove one ${escapeHtml(menuItem.item)}">&minus;</button>
        <span class="qty-value" data-role="qty">${qty}</span>
        <button type="button" class="qty-btn" data-action="inc" aria-label="Add one ${escapeHtml(menuItem.item)}">+</button>
      </span>
    `;

    li.querySelector('[data-action="inc"]').addEventListener('click', () => {
      state.order[menuItem.item] = (state.order[menuItem.item] || 0) + 1;
      renderMenu();
      renderTicket();
    });

    li.querySelector('[data-action="dec"]').addEventListener('click', () => {
      const current = state.order[menuItem.item] || 0;
      if (current <= 1) {
        delete state.order[menuItem.item];
      } else {
        state.order[menuItem.item] = current - 1;
      }
      renderMenu();
      renderTicket();
    });

    els.menuList.appendChild(li);
  });
}

function renderTicket() {
  const entries = Object.entries(state.order).filter(([, qty]) => qty > 0);

  if (entries.length === 0) {
    els.orderLines.innerHTML = '<li class="order-empty">Add something from the menu to get started.</li>';
    els.orderTotal.textContent = money(0);
    return;
  }

  let total = 0;
  els.orderLines.innerHTML = '';

  entries.forEach(([itemName, qty]) => {
    const menuItem = state.menuItems.find((m) => m.item === itemName);
    if (!menuItem) return;
    const lineTotal = menuItem.price * qty;
    total += lineTotal;

    const li = document.createElement('li');
    li.className = 'order-line';
    li.innerHTML = `
      <span class="order-line-name">${qty}&times; ${escapeHtml(itemName)}</span>
      <span class="order-line-price">${money(lineTotal)}</span>
    `;
    els.orderLines.appendChild(li);
  });

  els.orderTotal.textContent = money(total);
}

function getOrderPayload() {
  const entries = Object.entries(state.order).filter(([, qty]) => qty > 0);
  const items = entries.map(([itemName, qty]) => {
    const menuItem = state.menuItems.find((m) => m.item === itemName);
    return { item: itemName, qty, price: menuItem ? menuItem.price : 0 };
  });
  const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  return { items, total };
}

async function submitOrder() {
  const name = els.customerName.value.trim();
  const { items, total } = getOrderPayload();

  els.status.className = 'order-status';
  els.status.textContent = '';

  if (!name) {
    els.status.textContent = 'Enter a name before sending the order.';
    els.status.className = 'order-status error';
    els.customerName.focus();
    return;
  }

  if (items.length === 0) {
    els.status.textContent = 'Add at least one item before sending.';
    els.status.className = 'order-status error';
    return;
  }

  if (!isConfigured()) {
    els.status.textContent = 'Ordering isn\u2019t connected yet — see script.js.';
    els.status.className = 'order-status error';
    return;
  }

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = 'Sending\u2026';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        name,
        items,
        total,
        timestamp: new Date().toISOString(),
      }),
    });
    const data = await res.json();

    if (!data.ok) throw new Error(data.error || 'Order was not saved');

    els.status.textContent = `Order sent for ${name}. See you at lunch!`;
    els.status.className = 'order-status success';

    state.order = {};
    els.customerName.value = '';
    renderMenu();
    renderTicket();
  } catch (err) {
    els.status.textContent = 'Something went wrong sending the order. Please try again.';
    els.status.className = 'order-status error';
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = 'Send order';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

els.submitBtn.addEventListener('click', submitOrder);

loadMenu();
renderTicket();
