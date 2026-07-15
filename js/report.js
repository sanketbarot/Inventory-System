/* ============================================
   REPORT.JS - Reports & Export
   ============================================ */

let currentReport = 'stock';
let currentReportData = [];

document.addEventListener('DOMContentLoaded', () => {
    initReportEvents();
    loadReport('stock');
});

function initReportEvents() {
    // Report Tabs
    document.querySelectorAll('.report-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            loadReport(this.dataset.report);
        });
    });

    // Date Filter
    document.getElementById('applyDateFilter').addEventListener('click', () => {
        loadReport(currentReport);
    });

    // Export
    document.getElementById('exportExcel').addEventListener('click', exportToExcel);
    document.getElementById('exportPDF').addEventListener('click', exportToPDF);
}

function loadReport(type) {
    currentReport = type;
    const dateRange = document.getElementById('dateRangeFilter');
    const reportDate = document.getElementById('reportDate');
    reportDate.textContent = `Generated: ${Storage.formatDate(Storage.getToday())}`;

    // Show/hide date filter
    dateRange.style.display = (type === 'purchase') ? 'flex' : 'none';

    switch (type) {
        case 'stock':
            loadStockReport();
            break;
        case 'purchase':
            loadPurchaseReport();
            break;
        case 'lowstock':
            loadLowStockReport();
            break;
        case 'payments':
            loadPaymentsReport();
            break;
        case 'value':
            loadValueReport();
            break;
    }
}

function loadStockReport() {
    document.getElementById('reportTitle').textContent = 'Current Stock Report';
    const head = document.getElementById('reportTableHead');
    const body = document.getElementById('reportTableBody');
    const summary = document.getElementById('reportSummary');

    const products = Storage.getProducts();
    currentReportData = products;

    head.innerHTML = `
        <tr>
            <th>#</th>
            <th>Product</th>
            <th>Category</th>
            <th>Unit</th>
            <th>Current Stock</th>
            <th>Min Stock</th>
            <th>Price</th>
            <th>Value</th>
            <th>Status</th>
        </tr>
    `;

    if (products.length === 0) {
        body.innerHTML = '<tr><td colspan="9" class="empty-state">No products</td></tr>';
        summary.innerHTML = '';
        return;
    }

    body.innerHTML = products.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${p.name}</strong></td>
            <td>${p.category || '-'}</td>
            <td>${p.unit}</td>
            <td>${p.currentStock || 0}</td>
            <td>${p.minimumStock}</td>
            <td>${Storage.formatCurrency(p.purchasePrice)}</td>
            <td>${Storage.formatCurrency((p.currentStock || 0) * (p.purchasePrice || 0))}</td>
            <td>${getStockStatusBadge(p)}</td>
        </tr>
    `).join('');

    const totalItems = products.length;
    const totalStock = products.reduce((s, p) => s + (p.currentStock || 0), 0);
    const totalValue = Storage.getTotalInventoryValue();

    summary.innerHTML = `
        <div class="summary-box">
            <label>Total Products</label>
            <span>${totalItems}</span>
        </div>
        <div class="summary-box">
            <label>Total Stock</label>
            <span>${totalStock}</span>
        </div>
        <div class="summary-box">
            <label>Total Value</label>
            <span>${Storage.formatCurrency(totalValue)}</span>
        </div>
    `;
}

function loadPurchaseReport() {
    document.getElementById('reportTitle').textContent = 'Purchase Report';
    const head = document.getElementById('reportTableHead');
    const body = document.getElementById('reportTableBody');
    const summary = document.getElementById('reportSummary');

    let purchases = Storage.getPurchases().sort((a, b) => new Date(b.date) - new Date(a.date));

    const fromDate = document.getElementById('reportDateFrom').value;
    const toDate = document.getElementById('reportDateTo').value;

    if (fromDate) purchases = purchases.filter(p => p.date >= fromDate);
    if (toDate) purchases = purchases.filter(p => p.date <= toDate);

    currentReportData = purchases;

    head.innerHTML = `
        <tr>
            <th>#</th>
            <th>Date</th>
            <th>Invoice</th>
            <th>Supplier</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Due</th>
            <th>Status</th>
        </tr>
    `;

    if (purchases.length === 0) {
        body.innerHTML = '<tr><td colspan="8" class="empty-state">No purchases found</td></tr>';
        summary.innerHTML = '';
        return;
    }

    body.innerHTML = purchases.map((p, i) => {
        const supplier = Storage.getSupplierById(p.supplierId);
        return `
            <tr>
                <td>${i + 1}</td>
                <td>${Storage.formatDate(p.date)}</td>
                <td>${p.invoiceNo}</td>
                <td>${supplier ? supplier.name : '-'}</td>
                <td>${Storage.formatCurrency(p.totalAmount)}</td>
                <td>${Storage.formatCurrency(p.paidAmount)}</td>
                <td class="${p.dueAmount > 0 ? 'text-danger' : ''}">${Storage.formatCurrency(p.dueAmount)}</td>
                <td>${getPaymentStatusBadge(p)}</td>
            </tr>
        `;
    }).join('');

    const totalAmount = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const totalPaid = purchases.reduce((s, p) => s + (p.paidAmount || 0), 0);
    const totalDue = purchases.reduce((s, p) => s + (p.dueAmount || 0), 0);

    summary.innerHTML = `
        <div class="summary-box">
            <label>Total Purchases</label>
            <span>${purchases.length}</span>
        </div>
        <div class="summary-box">
            <label>Total Amount</label>
            <span>${Storage.formatCurrency(totalAmount)}</span>
        </div>
        <div class="summary-box">
            <label>Total Paid</label>
            <span style="color: var(--success);">${Storage.formatCurrency(totalPaid)}</span>
        </div>
        <div class="summary-box">
            <label>Total Due</label>
            <span style="color: var(--danger);">${Storage.formatCurrency(totalDue)}</span>
        </div>
    `;
}

function loadLowStockReport() {
    document.getElementById('reportTitle').textContent = 'Low Stock Report';
    const head = document.getElementById('reportTableHead');
    const body = document.getElementById('reportTableBody');
    const summary = document.getElementById('reportSummary');

    const lowStock = Storage.getLowStockProducts();
    const outOfStock = Storage.getOutOfStockProducts();
    const allAlerts = [...outOfStock, ...lowStock];
    currentReportData = allAlerts;

    head.innerHTML = `
        <tr>
            <th>#</th>
            <th>Product</th>
            <th>Category</th>
            <th>Current Stock</th>
            <th>Min Stock</th>
            <th>Deficit</th>
            <th>Status</th>
        </tr>
    `;

    if (allAlerts.length === 0) {
        body.innerHTML = '<tr><td colspan="7" class="empty-state">All items are well stocked ✅</td></tr>';
        summary.innerHTML = '';
        return;
    }

    body.innerHTML = allAlerts.map((p, i) => {
        const deficit = Math.max(0, p.minimumStock - (p.currentStock || 0));
        return `
            <tr>
                <td>${i + 1}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.category || '-'}</td>
                <td>${p.currentStock || 0} ${p.unit}</td>
                <td>${p.minimumStock} ${p.unit}</td>
                <td class="text-danger">${deficit} ${p.unit}</td>
                <td>${getStockStatusBadge(p)}</td>
            </tr>
        `;
    }).join('');

    summary.innerHTML = `
        <div class="summary-box">
            <label>Low Stock Items</label>
            <span style="color: var(--warning);">${lowStock.length}</span>
        </div>
        <div class="summary-box">
            <label>Out of Stock Items</label>
            <span style="color: var(--danger);">${outOfStock.length}</span>
        </div>
    `;
}

function loadPaymentsReport() {
    document.getElementById('reportTitle').textContent = 'Pending Payments Report';
    const head = document.getElementById('reportTableHead');
    const body = document.getElementById('reportTableBody');
    const summary = document.getElementById('reportSummary');

    const pending = Storage.getPendingPurchases();
    currentReportData = pending;

    head.innerHTML = `
        <tr>
            <th>#</th>
            <th>Supplier</th>
            <th>Invoice</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Due</th>
            <th>Due Date</th>
            <th>Status</th>
        </tr>
    `;

    if (pending.length === 0) {
        body.innerHTML = '<tr><td colspan="8" class="empty-state">No pending payments ✅</td></tr>';
        summary.innerHTML = '';
        return;
    }

    body.innerHTML = pending.map((p, i) => {
        const supplier = Storage.getSupplierById(p.supplierId);
        return `
            <tr>
                <td>${i + 1}</td>
                <td>${supplier ? supplier.name : '-'}</td>
                <td>${p.invoiceNo}</td>
                <td>${Storage.formatCurrency(p.totalAmount)}</td>
                <td>${Storage.formatCurrency(p.paidAmount)}</td>
                <td class="text-danger">${Storage.formatCurrency(p.dueAmount)}</td>
                <td>${Storage.formatDate(p.dueDate)}</td>
                <td>${getPaymentStatusBadge(p)}</td>
            </tr>
        `;
    }).join('');

    const totalDue = pending.reduce((s, p) => s + (p.dueAmount || 0), 0);
    const overdueAmount = Storage.getTotalOverdueAmount();

    summary.innerHTML = `
        <div class="summary-box">
            <label>Pending Invoices</label>
            <span>${pending.length}</span>
        </div>
        <div class="summary-box">
            <label>Total Pending</label>
            <span style="color: var(--warning);">${Storage.formatCurrency(totalDue)}</span>
        </div>
        <div class="summary-box">
            <label>Overdue Amount</label>
            <span style="color: var(--danger);">${Storage.formatCurrency(overdueAmount)}</span>
        </div>
    `;
}

function loadValueReport() {
    document.getElementById('reportTitle').textContent = 'Inventory Value Report';
    const head = document.getElementById('reportTableHead');
    const body = document.getElementById('reportTableBody');
    const summary = document.getElementById('reportSummary');

    const products = Storage.getProducts().filter(p => (p.currentStock || 0) > 0);
    currentReportData = products;

    head.innerHTML = `
        <tr>
            <th>#</th>
            <th>Product</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Unit Price</th>
            <th>Total Value</th>
            <th>% of Total</th>
        </tr>
    `;

    const totalValue = products.reduce((s, p) => s + ((p.currentStock || 0) * (p.purchasePrice || 0)), 0);

    if (products.length === 0) {
        body.innerHTML = '<tr><td colspan="7" class="empty-state">No inventory value</td></tr>';
        summary.innerHTML = '';
        return;
    }

    const sorted = [...products].sort((a, b) => {
        return ((b.currentStock || 0) * (b.purchasePrice || 0)) - ((a.currentStock || 0) * (a.purchasePrice || 0));
    });

    body.innerHTML = sorted.map((p, i) => {
        const value = (p.currentStock || 0) * (p.purchasePrice || 0);
        const percentage = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : 0;
        return `
            <tr>
                <td>${i + 1}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.category || '-'}</td>
                <td>${p.currentStock} ${p.unit}</td>
                <td>${Storage.formatCurrency(p.purchasePrice)}</td>
                <td><strong>${Storage.formatCurrency(value)}</strong></td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="flex:1; height:6px; background:rgba(167,139,250,0.15); border-radius:3px; overflow:hidden;">
                            <div style="width:${percentage}%; height:100%; background:linear-gradient(135deg, var(--purple), var(--pink)); border-radius:3px;"></div>
                        </div>
                        <span style="font-size:12px; white-space:nowrap;">${percentage}%</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    summary.innerHTML = `
        <div class="summary-box">
            <label>Products in Stock</label>
            <span>${products.length}</span>
        </div>
        <div class="summary-box">
            <label>Total Inventory Value</label>
            <span style="color: var(--success);">${Storage.formatCurrency(totalValue)}</span>
        </div>
    `;
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

function exportToExcel() {
    const table = document.getElementById('reportTable');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);

    const reportNames = {
        stock: 'Current_Stock',
        purchase: 'Purchase_Report',
        lowstock: 'Low_Stock',
        payments: 'Pending_Payments',
        value: 'Inventory_Value'
    };

    XLSX.utils.book_append_sheet(wb, ws, reportNames[currentReport] || 'Report');
    XLSX.writeFile(wb, `${reportNames[currentReport] || 'Report'}_${Storage.getToday()}.xlsx`);
    showToast('Excel file downloaded!', 'success');
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

    const reportNames = {
        stock: 'Current Stock Report',
        purchase: 'Purchase Report',
        lowstock: 'Low Stock Report',
        payments: 'Pending Payments Report',
        value: 'Inventory Value Report'
    };

    // Title
    doc.setFontSize(18);
    doc.setTextColor(45, 45, 63);
    doc.text(reportNames[currentReport] || 'Report', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(122, 122, 154);
    doc.text(`Generated: ${Storage.formatDate(Storage.getToday())}`, 14, 28);

    // Table
    doc.autoTable({
        html: '#reportTable',
        startY: 35,
        styles: {
            font: 'helvetica',
            fontSize: 9,
            cellPadding: 4
        },
        headStyles: {
            fillColor: [167, 139, 250],
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [245, 240, 255]
        },
        margin: { left: 14, right: 14 }
    });

    doc.save(`${(reportNames[currentReport] || 'Report').replace(/\s/g, '_')}_${Storage.getToday()}.pdf`);
    showToast('PDF file downloaded!', 'success');
}