/* ============================================
   SUPPLIER.JS - Supplier Management
   ============================================ */

let deleteSupId = null;
let currentSupplierId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadSuppliers();
    initSupplierEvents();

    if (getUrlParam('action') === 'add') {
        openAddSupplierModal();
    }

    // Listen to real-time Firebase / Storage sync updates
    window.addEventListener('storage-update', () => {
        loadSuppliers();
        if (typeof currentSupplierId !== 'undefined' && currentSupplierId) {
            loadSupplierPurchases(currentSupplierId);
            loadSupplierPending(currentSupplierId);
            loadSupplierPayments(currentSupplierId);
        }
    });
});

function initSupplierEvents() {
    // Add Supplier
    document.getElementById('addSupplierBtn').addEventListener('click', openAddSupplierModal);

    // Save
    document.getElementById('saveSupplier').addEventListener('click', saveSupplier);

    // Cancel / Close
    document.getElementById('cancelSupplier').addEventListener('click', () => closeModal('supplierModal'));
    document.getElementById('closeSupplierModal').addEventListener('click', () => closeModal('supplierModal'));

    // Detail Modal
    document.getElementById('closeSupplierDetail').addEventListener('click', () => closeModal('supplierDetailModal'));

    // Delete Modal
    document.getElementById('closeDeleteModal').addEventListener('click', () => closeModal('deleteModal'));
    document.getElementById('cancelDelete').addEventListener('click', () => closeModal('deleteModal'));
    document.getElementById('confirmDelete').addEventListener('click', confirmDeleteSupplier);

    // Search
    document.getElementById('supplierSearch').addEventListener('input', filterSuppliers);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(`tab-${this.dataset.tab}`).classList.add('active');
        });
    });
}

function loadSuppliers() {
    const grid = document.getElementById('suppliersGrid');
    const suppliers = Storage.getSuppliers();

    if (suppliers.length === 0) {
        grid.innerHTML = `
            <div class="empty-state-large">
                <i class="fas fa-truck"></i>
                <p>No suppliers added yet</p>
            </div>
        `;
        return;
    }

    renderSuppliers(suppliers);
}

function renderSuppliers(suppliers) {
    const grid = document.getElementById('suppliersGrid');

    if (suppliers.length === 0) {
        grid.innerHTML = `
            <div class="empty-state-large">
                <i class="fas fa-search"></i>
                <p>No suppliers found</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = suppliers.map(s => {
        const initials = s.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        return `
            <div class="supplier-card" onclick="openSupplierDetail('${s.id}')">
                <div class="supplier-card-header">
                    <div>
                        <div class="supplier-name">${s.name}</div>
                        <div class="supplier-phone"><i class="fas fa-phone"></i> ${s.phone}</div>
                    </div>
                    <div class="supplier-avatar">${initials}</div>
                </div>
                <div class="supplier-stats">
                    <div class="supplier-stat">
                        <span class="supplier-stat-label">Total Purchase</span>
                        <span class="supplier-stat-value">${Storage.formatCurrency(s.totalPurchase)}</span>
                    </div>
                    <div class="supplier-stat">
                        <span class="supplier-stat-label">Pending</span>
                        <span class="supplier-stat-value pending">${Storage.formatCurrency(s.pendingAmount)}</span>
                    </div>
                    <div class="supplier-stat">
                        <span class="supplier-stat-label">Last Payment</span>
                        <span class="supplier-stat-value" style="font-size:12px;">${s.lastPayment ? Storage.formatDate(s.lastPayment) : 'N/A'}</span>
                    </div>
                    <div class="supplier-stat">
                        <span class="supplier-stat-label">Actions</span>
                        <div class="action-btns" style="justify-content:center;" onclick="event.stopPropagation();">
                            <button class="btn-icon edit" onclick="editSupplier('${s.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon delete" onclick="deleteSupplier('${s.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function filterSuppliers() {
    const search = document.getElementById('supplierSearch').value.toLowerCase();
    let suppliers = Storage.getSuppliers();

    if (search) {
        suppliers = suppliers.filter(s =>
            s.name.toLowerCase().includes(search) ||
            s.phone.includes(search)
        );
    }

    renderSuppliers(suppliers);
}

function openAddSupplierModal() {
    document.getElementById('supplierModalTitle').textContent = 'Add Supplier';
    document.getElementById('supplierForm').reset();
    document.getElementById('supplierId').value = '';
    openModal('supplierModal');
}

function editSupplier(id) {
    const supplier = Storage.getSupplierById(id);
    if (!supplier) return;

    document.getElementById('supplierModalTitle').textContent = 'Edit Supplier';
    document.getElementById('supplierId').value = supplier.id;
    document.getElementById('supplierName').value = supplier.name;
    document.getElementById('supplierPhone').value = supplier.phone;
    document.getElementById('supplierAddress').value = supplier.address || '';
    openModal('supplierModal');
}

function saveSupplier() {
    const name = document.getElementById('supplierName').value.trim();
    const phone = document.getElementById('supplierPhone').value.trim();
    const address = document.getElementById('supplierAddress').value.trim();

    if (!name || !phone) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    const supplier = {
        id: document.getElementById('supplierId').value || null,
        name,
        phone,
        address
    };

    const isEdit = !!supplier.id;
    Storage.saveSupplier(supplier);

    closeModal('supplierModal');
    loadSuppliers();
    showToast(`Supplier ${isEdit ? 'updated' : 'added'} successfully!`, 'success');
}

function deleteSupplier(id) {
    const supplier = Storage.getSupplierById(id);
    if (!supplier) return;

    deleteSupId = id;
    document.getElementById('deleteSupplierName').textContent = supplier.name;
    openModal('deleteModal');
}

function confirmDeleteSupplier() {
    if (deleteSupId) {
        Storage.deleteSupplier(deleteSupId);
        deleteSupId = null;
        closeModal('deleteModal');
        loadSuppliers();
        showToast('Supplier deleted successfully!', 'success');
    }
}

function openSupplierDetail(id) {
    currentSupplierId = id;
    const supplier = Storage.getSupplierById(id);
    if (!supplier) return;

    document.getElementById('supplierDetailName').textContent = supplier.name;

    // Reset tabs
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="purchases"]').classList.add('active');
    document.getElementById('tab-purchases').classList.add('active');

    loadSupplierPurchases(id);
    loadSupplierPending(id);
    loadSupplierPayments(id);

    openModal('supplierDetailModal');
}

function loadSupplierPurchases(supplierId) {
    const tbody = document.getElementById('supplierPurchasesBody');
    const purchases = Storage.getPurchasesBySupplier(supplierId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (purchases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No purchases</td></tr>';
        return;
    }

    tbody.innerHTML = purchases.map(p => `
        <tr>
            <td>${Storage.formatDate(p.date)}</td>
            <td>${p.invoiceNo}</td>
            <td>${Storage.formatCurrency(p.totalAmount)}</td>
            <td>${Storage.formatCurrency(p.paidAmount)}</td>
            <td class="${p.dueAmount > 0 ? 'text-danger' : ''}">${Storage.formatCurrency(p.dueAmount)}</td>
            <td>${getPaymentStatusBadge(p)}</td>
        </tr>
    `).join('');
}

function loadSupplierPending(supplierId) {
    const tbody = document.getElementById('supplierPendingBody');
    const pending = Storage.getPurchasesBySupplier(supplierId).filter(p => p.dueAmount > 0);

    if (pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No pending invoices ✅</td></tr>';
        return;
    }

    tbody.innerHTML = pending.map(p => `
        <tr>
            <td>${p.invoiceNo}</td>
            <td class="text-danger">${Storage.formatCurrency(p.dueAmount)}</td>
            <td>${Storage.formatDate(p.dueDate)}</td>
            <td>
                <button class="btn btn-small btn-primary" onclick="closeModal('supplierDetailModal'); openPaymentModalFromSupplier('${p.id}')">
                    <i class="fas fa-money-bill-wave"></i> Pay
                </button>
            </td>
        </tr>
    `).join('');
}

function loadSupplierPayments(supplierId) {
    const tbody = document.getElementById('supplierPaymentsBody');
    const payments = Storage.getPaymentsBySupplier(supplierId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No payments</td></tr>';
        return;
    }

    tbody.innerHTML = payments.map(p => {
        const purchase = Storage.getPurchaseById(p.purchaseId);
        return `
            <tr>
                <td>${Storage.formatDate(p.date)}</td>
                <td>${Storage.formatCurrency(p.amount)}</td>
                <td>${purchase ? purchase.invoiceNo : '-'}</td>
                <td>${p.note || '-'}</td>
            </tr>
        `;
    }).join('');
}

function openPaymentModalFromSupplier(purchaseId) {
    // Redirect to purchase page with payment action
    window.location.href = `purchase.html?payment=${purchaseId}`;
}