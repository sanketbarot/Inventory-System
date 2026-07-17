/* ============================================
   PURCHASE.JS - Purchase Management
   ============================================ */

let productLineCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
    loadPurchases();
    initPurchaseEvents();

    if (getUrlParam('action') === 'add') {
        openNewPurchaseModal();
    }

    // Listen to real-time Firebase / Storage sync updates
    window.addEventListener('storage-update', () => {
        loadPurchases();
        loadSupplierOptions();
        loadProductOptions();
    });
});

function initPurchaseEvents() {
    // New Purchase
    document.getElementById('addPurchaseBtn').addEventListener('click', openNewPurchaseModal);

    // Product Lines
    document.getElementById('addProductLine').addEventListener('click', addProductLine);

    // Save Purchase
    document.getElementById('savePurchase').addEventListener('click', savePurchase);

    // Cancel / Close
    document.getElementById('cancelPurchase').addEventListener('click', () => closeModal('purchaseModal'));
    document.getElementById('closePurchaseModal').addEventListener('click', () => closeModal('purchaseModal'));

    // Payment Modal
    document.getElementById('closePaymentModal').addEventListener('click', () => closeModal('paymentModal'));
    document.getElementById('cancelPayment').addEventListener('click', () => closeModal('paymentModal'));
    document.getElementById('savePayment').addEventListener('click', savePayment);

    // Paid amount change
    document.getElementById('purchasePaid').addEventListener('input', calculateDue);

    // Search
    document.getElementById('purchaseSearch').addEventListener('input', filterPurchases);
    document.getElementById('purchaseDateFilter').addEventListener('change', filterPurchases);
}

function loadPurchases() {
    const tbody = document.getElementById('purchasesTableBody');
    const purchases = Storage.getPurchases().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (purchases.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fas fa-cart-plus"></i>
                    <p>No purchases recorded yet</p>
                </td>
            </tr>
        `;
        return;
    }

    renderPurchases(purchases);
}

function renderPurchases(purchases) {
    const tbody = document.getElementById('purchasesTableBody');

    if (purchases.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>No purchases found</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = purchases.map(p => {
        const supplier = Storage.getSupplierById(p.supplierId);
        const itemCount = (p.products || []).length;
        return `
            <tr>
                <td>${Storage.formatDate(p.date)}</td>
                <td>${p.invoiceNo}</td>
                <td>${supplier ? supplier.name : '-'}</td>
                <td>${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
                <td>${Storage.formatCurrency(p.totalAmount)}</td>
                <td>${Storage.formatCurrency(p.paidAmount)}</td>
                <td class="${p.dueAmount > 0 ? 'text-danger' : ''}">${Storage.formatCurrency(p.dueAmount)}</td>
                <td>${getPaymentStatusBadge(p)}</td>
                <td>
                    <div class="action-btns">
                        ${p.dueAmount > 0 ? `
                            <button class="btn-icon pay" onclick="openPaymentModal('${p.id}')" title="Make Payment">
                                <i class="fas fa-money-bill-wave"></i>
                            </button>
                        ` : ''}
                        <button class="btn-icon view" onclick="viewPurchase('${p.id}')" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterPurchases() {
    const search = document.getElementById('purchaseSearch').value.toLowerCase();
    const dateFilter = document.getElementById('purchaseDateFilter').value;

    let purchases = Storage.getPurchases().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (search) {
        purchases = purchases.filter(p => {
            const supplier = Storage.getSupplierById(p.supplierId);
            return p.invoiceNo.toLowerCase().includes(search) ||
                   (supplier && supplier.name.toLowerCase().includes(search));
        });
    }

    if (dateFilter) {
        purchases = purchases.filter(p => p.date === dateFilter);
    }

    renderPurchases(purchases);
}

function loadSupplierOptions() {
    const select = document.getElementById('purchaseSupplier');
    const suppliers = Storage.getSuppliers();

    let options = '<option value="">Select Supplier</option>';
    suppliers.forEach(s => {
        options += `<option value="${s.id}">${s.name}</option>`;
    });
    select.innerHTML = options;
}

function loadProductOptions() {
    const products = Storage.getProducts();
    let options = '<option value="">Select Product</option>';
    products.forEach(p => {
        options += `<option value="${p.id}">${p.name} (${p.currentStock} ${p.unit})</option>`;
    });
    return options;
}

function openNewPurchaseModal() {
    document.getElementById('purchaseModalTitle').textContent = 'New Purchase';
    document.getElementById('purchaseForm').reset();
    document.getElementById('purchaseId').value = '';
    document.getElementById('purchaseDate').value = Storage.getToday();
    document.getElementById('purchaseTotal').value = '';
    document.getElementById('purchaseDue').value = '';

    loadSupplierOptions();

    productLineCounter = 0;
    document.getElementById('productLinesBody').innerHTML = '';
    addProductLine();

    // Prefill product details if product_id is in URL query parameters
    const prefilledProductId = getUrlParam('product_id');
    if (prefilledProductId) {
        const firstLineProductSelect = document.querySelector('#productLinesBody select.line-product');
        if (firstLineProductSelect) {
            firstLineProductSelect.value = prefilledProductId;
            
            const product = Storage.getProductById(prefilledProductId);
            if (product) {
                const row = document.getElementById(`line_${productLineCounter}`);
                const rateInput = row.querySelector('.line-rate');
                if (rateInput) rateInput.value = product.purchasePrice || 0;
                
                if (product.supplierId) {
                    document.getElementById('purchaseSupplier').value = product.supplierId;
                }
                lineChanged(productLineCounter);
            }
        }
    }

    openModal('purchaseModal');
}

function addProductLine() {
    productLineCounter++;
    const tbody = document.getElementById('productLinesBody');
    const productOptions = loadProductOptions();

    const row = document.createElement('tr');
    row.id = `line_${productLineCounter}`;
    row.innerHTML = `
        <td>
            <select class="line-product" onchange="lineChanged(${productLineCounter})" required>
                ${productOptions}
            </select>
        </td>
        <td>
            <input type="number" class="line-qty" min="1" value="1" onchange="lineChanged(${productLineCounter})" oninput="lineChanged(${productLineCounter})">
        </td>
        <td>
            <input type="number" class="line-rate" min="0" step="0.01" value="0" onchange="lineChanged(${productLineCounter})" oninput="lineChanged(${productLineCounter})">
        </td>
        <td>
            <input type="number" class="line-total" readonly value="0">
        </td>
        <td>
            <button type="button" class="btn-icon delete" onclick="removeProductLine(${productLineCounter})">
                <i class="fas fa-times"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);
}

function removeProductLine(lineId) {
    const row = document.getElementById(`line_${lineId}`);
    if (row) {
        row.remove();
        calculatePurchaseTotal();
    }
}

function lineChanged(lineId) {
    const row = document.getElementById(`line_${lineId}`);
    if (!row) return;

    const productSelect = row.querySelector('.line-product');
    const qtyInput = row.querySelector('.line-qty');
    const rateInput = row.querySelector('.line-rate');
    const totalInput = row.querySelector('.line-total');

    // Auto-fill rate from product price
    if (productSelect.value) {
        const product = Storage.getProductById(productSelect.value);
        if (product && parseFloat(rateInput.value) === 0) {
            rateInput.value = product.purchasePrice || 0;
        }
    }

    const qty = parseFloat(qtyInput.value) || 0;
    const rate = parseFloat(rateInput.value) || 0;
    totalInput.value = (qty * rate).toFixed(2);

    calculatePurchaseTotal();
}

function calculatePurchaseTotal() {
    const rows = document.querySelectorAll('#productLinesBody tr');
    let total = 0;

    rows.forEach(row => {
        const lineTotal = parseFloat(row.querySelector('.line-total').value) || 0;
        total += lineTotal;
    });

    document.getElementById('purchaseTotal').value = total.toFixed(2);
    calculateDue();
}

function calculateDue() {
    const total = parseFloat(document.getElementById('purchaseTotal').value) || 0;
    const paid = parseFloat(document.getElementById('purchasePaid').value) || 0;
    document.getElementById('purchaseDue').value = Math.max(0, total - paid).toFixed(2);
}

function savePurchase() {
    const supplierId = document.getElementById('purchaseSupplier').value;
    const invoiceNo = document.getElementById('purchaseInvoice').value.trim();
    const date = document.getElementById('purchaseDate').value;
    const dueDate = document.getElementById('purchaseDueDate').value;
    const totalAmount = parseFloat(document.getElementById('purchaseTotal').value) || 0;
    const paidAmount = parseFloat(document.getElementById('purchasePaid').value) || 0;
    const dueAmount = parseFloat(document.getElementById('purchaseDue').value) || 0;

    if (!supplierId || !invoiceNo || !date) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    // Get product lines
    const rows = document.querySelectorAll('#productLinesBody tr');
    const products = [];

    rows.forEach(row => {
        const productId = row.querySelector('.line-product').value;
        const quantity = parseFloat(row.querySelector('.line-qty').value) || 0;
        const rate = parseFloat(row.querySelector('.line-rate').value) || 0;
        const total = parseFloat(row.querySelector('.line-total').value) || 0;

        if (productId && quantity > 0) {
            products.push({ productId, quantity, rate, total });
        }
    });

    if (products.length === 0) {
        showToast('Please add at least one product', 'error');
        return;
    }

    const purchase = {
        supplierId,
        invoiceNo,
        date,
        dueDate: dueDate || null,
        products,
        totalAmount,
        paidAmount,
        dueAmount
    };

    Storage.savePurchase(purchase);

    // If paid amount > 0, record as payment
    if (paidAmount > 0) {
        Storage.savePayment({
            supplierId,
            purchaseId: purchase.id,
            amount: paidAmount,
            date: date,
            note: 'Payment with purchase'
        });
    }

    closeModal('purchaseModal');
    loadPurchases();
    showToast('Purchase saved successfully!', 'success');
}

function openPaymentModal(purchaseId) {
    const purchase = Storage.getPurchaseById(purchaseId);
    if (!purchase) return;

    document.getElementById('paymentPurchaseId').value = purchaseId;
    document.getElementById('paymentDueDisplay').value = purchase.dueAmount;
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentAmount').max = purchase.dueAmount;
    document.getElementById('paymentDate').value = Storage.getToday();
    document.getElementById('paymentNote').value = '';

    openModal('paymentModal');
}

function savePayment() {
    const purchaseId = document.getElementById('paymentPurchaseId').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value) || 0;
    const date = document.getElementById('paymentDate').value;
    const note = document.getElementById('paymentNote').value.trim();

    if (amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    const purchase = Storage.getPurchaseById(purchaseId);
    if (!purchase) return;

    if (amount > purchase.dueAmount) {
        showToast('Amount cannot exceed due amount', 'error');
        return;
    }

    Storage.savePayment({
        supplierId: purchase.supplierId,
        purchaseId,
        amount,
        date: date || Storage.getToday(),
        note
    });

    closeModal('paymentModal');
    loadPurchases();
    showToast('Payment recorded successfully!', 'success');
}

function viewPurchase(id) {
    const purchase = Storage.getPurchaseById(id);
    if (!purchase) return;

    const supplier = Storage.getSupplierById(purchase.supplierId);
    let productDetails = '';
    (purchase.products || []).forEach(item => {
        const product = Storage.getProductById(item.productId);
        productDetails += `<tr>
            <td>${product ? product.name : '-'}</td>
            <td>${item.quantity}</td>
            <td>${Storage.formatCurrency(item.rate)}</td>
            <td>${Storage.formatCurrency(item.total)}</td>
        </tr>`;
    });

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'viewPurchaseModal';
    modal.innerHTML = `
        <div class="modal glass-modal modal-large">
            <div class="modal-header">
                <h2>Purchase Details - ${purchase.invoiceNo}</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove(); document.body.style.overflow='';">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-grid" style="margin-bottom: 20px;">
                    <div class="form-group">
                        <label>Supplier</label>
                        <p style="font-weight:600;">${supplier ? supplier.name : '-'}</p>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <p>${Storage.formatDate(purchase.date)}</p>
                    </div>
                    <div class="form-group">
                        <label>Invoice</label>
                        <p>${purchase.invoiceNo}</p>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <p>${getPaymentStatusBadge(purchase)}</p>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Qty</th>
                                <th>Rate</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>${productDetails}</tbody>
                    </table>
                </div>
                <div class="payment-section form-grid">
                    <div class="form-group">
                        <label>Total</label>
                        <p style="font-size:18px; font-weight:700;">${Storage.formatCurrency(purchase.totalAmount)}</p>
                    </div>
                    <div class="form-group">
                        <label>Paid</label>
                        <p style="font-size:18px; font-weight:700; color: var(--success);">${Storage.formatCurrency(purchase.paidAmount)}</p>
                    </div>
                    <div class="form-group">
                        <label>Due</label>
                        <p style="font-size:18px; font-weight:700; color: var(--danger);">${Storage.formatCurrency(purchase.dueAmount)}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}