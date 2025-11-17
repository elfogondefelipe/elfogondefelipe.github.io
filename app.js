// app.js - Demo frontend con persistencia en localStorage
// Modificado para abrir directo dashboard con usuario fijo "defaultUser"

/* ---------- Mapping íconos por categoría (texto simple / unicode) ---------- */
const categoryIcon = {
  "Sueldo": "💼",
  "Comida": "🍽",
  "Gasolina": "⛽",
  "Transporte": "🚌",
  "Entretenimiento": "🎬",
  "Ahorro": "💰",
  "Salud": "💊",
  "Ropa": "👕",
  "Otros": "📦"
};

/* ---------- Helpers y utilitarios ---------- */
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const money = n => {
  const num = Number(n) || 0;
  return num.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
};
const todayISO = () => new Date().toISOString().slice(0,10);

/* ---------- Estado ---------- */
const currentUser = "Money App";  // usuario fijo

let chartInstance = null;

/* ---------- DOM ---------- */
// No necesitamos usuarios ni login, así que omitimos esos elementos
const loginScreen = qs('#login-screen');
const dashboardScreen = qs('#dashboard-screen');
const userTitle = qs('#userTitle');
const logoutBtn = qs('#logoutBtn');

const accountsListEl = qs('#accountsList');
const txAccountSelect = qs('#txAccount');
const txForm = qs('#txForm');
const txAmount = qs('#txAmount');
const txCategory = qs('#txCategory');
const txDate = qs('#txDate');
const txNote = qs('#txNote');
const segButtons = qsa('.seg-btn');

const totalBalanceEl = qs('#totalBalance');
const totalIngresosEl = qs('#totalIngresos');
const totalGastosEl = qs('#totalGastos');
const txListEl = qs('#txList');
const balancesByAccountEl = qs('#balancesByAccount');
const categoriesSummaryEl = qs('#categoriesSummary');

const filterType = qs('#filterType');
const filterCategory = qs('#filterCategory');
const filterFrom = qs('#filterFrom');
const filterTo = qs('#filterTo');
const clearFiltersBtn = qs('#clearFilters');
const addAccountBtn = qs('#addAccountBtn');

const chartCanvas = qs('#movementsChart');
const chartRange = qs('#chartRange');
const chartCategory = qs('#chartCategory');

/* ---------- Storage helpers ---------- */
function keyForUser(user) { return `finanzas_${user.replace(/\s+/g,'')}`; }
function loadData(user) {
  const key = keyForUser(user);
  const raw = localStorage.getItem(key);
  if(!raw) {
    const init = {
      accounts: [
        { id: 'cartera', name: 'Cartera', balance: 0 },
        { id: 'tarjeta', name: 'Tarjeta', balance: 0 },
        { id: 'caja', name: 'Caja fuerte', balance: 0 }
      ],
      tx: []
    };
    localStorage.setItem(key, JSON.stringify(init));
    return init;
  }
  try {
    return JSON.parse(raw);
  } catch(e) {
    console.error('Error parseando datos', e);
    return { accounts: [], tx: [] };
  }
}
function saveData(user, data){
  const key = keyForUser(user);
  localStorage.setItem(key, JSON.stringify(data));
}

/* ---------- Dashboard ---------- */
function openDashboard(user){
  userTitle.textContent = `${user}`;
  if(loginScreen) loginScreen.classList.add('hidden');
  if(dashboardScreen) dashboardScreen.classList.remove('hidden');

  renderAll();
}

logoutBtn.addEventListener('click', ()=>{
  // En este modo, al hacer logout solo recarga la página para reiniciar
  location.reload();
});

/* ---------- Render completo ---------- */
function renderAll(){
  if(!currentUser) return;
  const data = loadData(currentUser);
  renderAccounts(data.accounts);
  populateAccountSelect(data.accounts);
  recalcAndRender(data);
  renderTxList(data.tx);
  renderBalancesByAccount(data.accounts);
  renderCategoriesSummary(data.tx);
  updateChart();
}

/* ---------- Cuentas ---------- */
function renderAccounts(accounts){
  accountsListEl.innerHTML = '';
  accounts.forEach(acc=>{
    const li = document.createElement('li');
    li.className = 'account-item';
    li.innerHTML = `<div><div class="acc-name">${acc.name}</div><div class="muted small">${acc.id}</div></div><div class="acc-balance">${money(acc.balance)}</div>`;
    accountsListEl.appendChild(li);
  });
}

addAccountBtn.addEventListener('click', ()=>{
  const name = prompt('Nombre de la nueva cuenta (ej. Cuenta Ahorros):');
  if(!name) return;
  const id = name.replace(/\s+/g,'').toLowerCase();
  const data = loadData(currentUser);
  data.accounts.push({ id, name, balance: 0 });
  saveData(currentUser, data);
  renderAll();
});

/* ---------- Formulario de transacción ---------- */
let selectedType = 'ingreso';
segButtons.forEach(b=>{
  b.addEventListener('click', ()=>{
    segButtons.forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    selectedType = b.dataset.type;
  });
});

txDate.value = todayISO();

function populateAccountSelect(accounts){
  txAccountSelect.innerHTML = '';
  accounts.forEach(a=>{
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.name;
    txAccountSelect.appendChild(opt);
  });
}

txForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const amountVal = parseFloat(txAmount.value);
  if(isNaN(amountVal) || amountVal <= 0) return alert('Ingresa un monto válido');

  let txDateTime = txDate.value ? new Date(txDate.value + 'T' + new Date().toTimeString().slice(0,8)) : new Date();
  const isoDateTime = txDateTime.toISOString();

  const tx = {
    id: 'tx_' + Date.now(),
    type: selectedType,
    amount: Number(amountVal.toFixed(2)),
    category: txCategory.value,
    accountId: txAccountSelect.value,
    date: isoDateTime,
    note: txNote.value || ''
  };
  const data = loadData(currentUser);
  data.tx.unshift(tx);
  const acc = data.accounts.find(a=>a.id === tx.accountId);
  if(acc){
    if(tx.type === 'ingreso') acc.balance += tx.amount;
    else acc.balance -= tx.amount;
  }
  saveData(currentUser, data);
  txAmount.value = '';
  txNote.value = '';
  txDate.value = todayISO();
  renderAll();
});

/* ---------- Recalcula totales y render ---------- */
function recalcAndRender(data){
  const total = data.accounts.reduce((s,a)=>s + Number(a.balance||0),0);
  const ingresos = data.tx.filter(t=>t.type==='ingreso').reduce((s,t)=>s+t.amount,0);
  const gastos = data.tx.filter(t=>t.type==='gasto').reduce((s,t)=>s+t.amount,0);

  totalBalanceEl.textContent = money(total);
  totalIngresosEl.textContent = money(ingresos);
  totalGastosEl.textContent = money(gastos);
}

/* ---------- Render transacciones ---------- */
function renderTxList(txArr){
  let arr = txArr.slice();
  const typeF = filterType.value;
  const catF = filterCategory.value;
  const from = filterFrom.value;
  const to = filterTo.value;
  if(typeF !== 'all') arr = arr.filter(t=>t.type === typeF);
  if(catF !== 'all') arr = arr.filter(t=>t.category === catF);
  if(from) arr = arr.filter(t=>t.date >= from);
  if(to) arr = arr.filter(t=>t.date <= to);

  arr.sort((a,b) => new Date(a.date) - new Date(b.date));

  txListEl.innerHTML = '';
  if(arr.length === 0){
    txListEl.innerHTML = `<div class="muted">No hay movimientos.</div>`;
    return;
  }
  arr.forEach(t=>{
    const li = document.createElement('li');
    li.className = 'tx-item';
    const icon = categoryIcon[t.category] ? `<span class="cat-icon">${categoryIcon[t.category]}</span>` : `<span class="cat-icon">•</span>`;

    const fechaSimple = new Date(t.date).toISOString().slice(0,10);

    li.innerHTML = `
      <div>
        <div><strong>${icon} ${t.category}</strong> <span class="meta">· ${fechaSimple} · ${getAccountName(t.accountId)}</span></div>
        <div class="muted">${t.note || ''}</div>
      </div>
      <div style="text-align:right">
        <div class="tx-amount ${t.type === 'ingreso' ? 'income' : 'expense'}">${t.type === 'ingreso' ? '+' : '-'} ${money(t.amount)}</div>
        <div style="margin-top:8px"><button class="btn small ghost" data-id="${t.id}">Eliminar</button></div>
      </div>
    `;
    txListEl.appendChild(li);
  });

  qsa('.tx-item .btn').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const id = b.dataset.id;
      if(!confirm('Eliminar movimiento?')) return;
      const data = loadData(currentUser);
      const idx = data.tx.findIndex(x=>x.id===id);
      if(idx >= 0){
        const t = data.tx[idx];
        const acc = data.accounts.find(a=>a.id === t.accountId);
        if(acc){
          if(t.type === 'ingreso') acc.balance -= t.amount;
          else acc.balance += t.amount;
        }
        data.tx.splice(idx,1);
        saveData(currentUser, data);
        renderAll();
      }
    });
  });
}

/* ---------- Balances por cuenta y summary categorias ---------- */
function renderBalancesByAccount(accounts){
  balancesByAccountEl.innerHTML = '';
  accounts.forEach(a=>{
    const li = document.createElement('li');
    li.innerHTML = `<div style="display:flex;justify-content:space-between"><div>${a.name}</div><div>${money(a.balance)}</div></div>`;
    balancesByAccountEl.appendChild(li);
  });
}

function renderCategoriesSummary(txArr){
  const map = {};
  txArr.forEach(t=>{
    if(!map[t.category]) map[t.category] = 0;
    map[t.category] += (t.type === 'ingreso' ? t.amount : -t.amount);
  });
  categoriesSummaryEl.innerHTML = '';
  const keys = Object.keys(map);
  if(keys.length === 0){
    categoriesSummaryEl.innerHTML = `<div class="muted">Sin datos</div>`;
    return;
  }
  keys.forEach(k=>{
    const val = map[k];
    const icon = categoryIcon[k] ? `<span class="cat-icon">${categoryIcon[k]}</span>` : `<span class="cat-icon">•</span>`;
    const div = document.createElement('div');
    div.innerHTML = `<div style="display:flex;justify-content:space-between"><div>${icon} ${k}</div><div>${money(val)}</div></div>`;
    categoriesSummaryEl.appendChild(div);
  });
}

/* ---------- Filtros ---------- */
filterType.addEventListener('change', ()=> { renderAll(); });
filterCategory.addEventListener('change', ()=> { renderAll(); });
filterFrom.addEventListener('change', ()=> { renderAll(); });
filterTo.addEventListener('change', ()=> { renderAll(); });
clearFiltersBtn.addEventListener('click', ()=>{
  filterType.value = 'all';
  filterCategory.value = 'all';
  filterFrom.value = '';
  filterTo.value = '';
  renderAll();
});

/* ---------- GRÁFICA con Chart.js ---------- */
function updateChart(){
  if(!currentUser) return;
  const data = loadData(currentUser);
  const range = chartRange.value;
  const cat = chartCategory.value;

  const now = new Date();
  const filtered = data.tx.filter(t=>{
    if(cat !== 'all' && t.category !== cat) return false;

    const d = new Date(t.date);

    if(range === 'day') return d.toDateString() === now.toDateString();
    if(range === 'week') return (now - d) <= 7 * 24 * 60 * 60 * 1000;
    if(range === 'month') return (now - d) <= 30 * 24 * 60 * 60 * 1000;
    if(range === 'year') return d.getFullYear() === now.getFullYear();
    return true;
  });

  filtered.sort((a,b)=> new Date(a.date) - new Date(b.date));

  let cumulative = 0;
  const labels = [];
  const values = [];
  filtered.forEach(t => {
    const val = (t.type === 'ingreso' ? t.amount : -t.amount);
    cumulative += val;
    labels.push(t.date.slice(0,10));
    values.push(Number(cumulative.toFixed(2)));
  });

  if(chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = values;
    chartInstance.update();
    return;
  }

  const ctx = chartCanvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Saldo acumulado',
        data: values,
        borderColor: 'rgba(255,122,24,0.95)',
        backgroundColor: 'rgba(255,122,24,0.12)',
        tension: 0.25,
        pointRadius: 4,
        pointBackgroundColor: '#fff',
        pointBorderColor: 'rgba(255,122,24,0.95)'
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw;
              return (val >= 0 ? '+ ' : '- ') + money(Math.abs(val));
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: 'white', maxRotation: 0, minRotation: 0 },
          grid: { color: 'rgba(255,255,255,0.03)' }
        },
        y: {
          ticks: {
            color: 'white',
            callback: function(value) { return money(value); }
          },
          grid: { color: 'rgba(255,255,255,0.03)' }
        }
      },
      maintainAspectRatio: false
    }
  });
}

chartRange.addEventListener('change', updateChart);
chartCategory.addEventListener('change', updateChart);

/* ---------- Auxiliares ---------- */
function getAccountName(id){
  const data = loadData(currentUser);
  const acc = data.accounts.find(a=>a.id === id);
  return acc ? acc.name : id;
}

/* ---------- Inicialización ---------- */
(function init(){
  // Saltamos renderUsers y login
  openDashboard(currentUser);
})();
