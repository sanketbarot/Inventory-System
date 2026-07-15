/* ============================================
   STOCKOUT.JS - Stock Out Management
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    loadStockOuts();
    initStockOutEvents();

    if (getUrlParam('action') === 'add') {
        openStockOutModal();
    }
});

function initStockOutEvents() {
    // Add Stock Out
    document.getElementById('addStockOutBtn').addEventListener('click', openStockOutModal);

    // Save
    document.getElementById('saveStockout').addEventListener('click', saveStockOut);

    // Cancel / Close
    document.getElementById('cancelStockout').addEventListener('click', () => closeModal('stockoutModal'));
    document.getElementById('closeStockoutModal').addEventListener('click', () => closeModal('stockoutModal'));

    // Product change - show available stock
    document.getElementById('stockoutProduct').addEventListener('change', onProductSelect);

    // Search & Filter
    document.getElementById('stockoutSearch').addEventListener('input', filterStockOuts);
    document.getElementById('stockoutDateFilter').addEventListener('change', filterStockOuts);
}

function loadStockOuts() {
    const tbody = document.getElementById('stockoutTableBody');
    const stockouts = Storage.getStockOuts().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (stockouts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-dolly"></i>
                    <p>No stock out records</p>
                </td>
            </tr>
        `;
        return;
    }

    renderStockOuts(stockouts);
}

function renderStockOuts(stockouts) {
    const tbody = document.getElementById('stockoutTableBody');

    if (stockouts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>No records found</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = stockouts.map(s => {
        const product = Storage.getProductById(s.productId);
        return `
            <tr>
                <td>${Storage.formatDate(s.date)}</td>
                <td>${product ? product.name : '-'}</td>
                <td>${s.quantity} ${product ? product.unit : ''}</td>
                <td><span class="badge-status badge-${s.reason === 'Damage' || s.reason === 'Expired' ? 'overdue' : 'pending'}">${s.reason}</span></td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon delete" onclick="deleteStockOut('${s.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterStockOuts() {
    const search = document.getElementById('stockoutSearch').value.toLowerCase();
    const dateFilter = document.getElementById('stockoutDateFilter').value;

    let stockouts = Storage.getStockOuts().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (search) {
        stockouts = stockouts.filter(s => {
            const product = Storage.getProductById(s.productId);
            return (product && product.name.toLowerCase().includes(search)) ||
                   s.reason.toLowerCase().includes(search);
        });
    }

    if (dateFilter) {
        stockouts = stockouts.filter(s => s.date === dateFilter);
    }

    renderStockOuts(stockouts);
}

function loadProductDropdown() {
    const select = document.getElementById('stockoutProduct');
    const products = Storage.getProducts().filter(p => p.currentStock > 0);

    let options = '<option value="">Select Product</option>';
    products.forEach(p => {
        options += `<option value="${p.id}">${p.name} (${p.currentStock} ${p.unit} available)</option>`;
    });
    select.innerHTML = options;
}

function onProductSelect() {
    const productId = document.getElementById('stockoutProduct').value;
    const availableInput = document.getElementById('availableStock');
    const qtyInput = document.getElementById('stockoutQuantity');

    if (productId) {
        const product = Storage.getProductById(productId);
        if (product) {
            availableInput.value = product.currentStock;
            qtyInput.max = product.currentStock;
        }
    } else {
        availableInput.value = '';
    }
}

function openStockOutModal() {
    document.getElementById('stockoutForm').reset();
    document.getElementById('stockoutId').value = '';
    document.getElementById('stockoutDate').value = Storage.getToday();
    document.getElementById('availableStock').value = '';
    loadProductDropdown();
    openModal('stockoutModal');
}

function saveStockOut() {
    const date = document.getElementById('stockoutDate').value;
    const productId = document.getElementById('stockoutProduct').value;
    const quantity = parseInt(document.getElementById('stockoutQuantity').value) || 0;
    const reason = document.getElementById('stockoutReason').value;

    if (!date || !productId || !quantity || !reason) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    const product = Storage.getProductById(productId);
    if (!product) {
        showToast('Product not found', 'error');
        return;
    }

    if (quantity > product.currentStock) {
        showToast(`Only ${product.currentStock} ${product.unit} available`, 'error');
        return;
    }

    Storage.saveStockOut({
        date,
        productId,
        quantity,
        reason
    });

    closeModal('stockoutModal');
    loadStockOuts();
    showToast('Stock out recorded successfully!', 'success');
}

function deleteStockOut(id) {
    if (confirm('Are you sure you want to delete this record? Stock will be restored.')) {
        Storage.deleteStockOut(id);
        loadStockOuts();
        showToast('Stock out record deleted. Stock restored.', 'success');
    }
}