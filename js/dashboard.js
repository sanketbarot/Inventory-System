/* ============================================
   DASHBOARD.JS - Enhanced Dashboard
   With Date Filter, Charts, Animations, Growth
   ============================================ */

// Global chart instances
let stockChart = null;
let categoryChart = null;
let topProductsChart = null;
let purchaseTrendChart = null;

// Current filter state
let currentRange = 'today';
let currentDateRange = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!Storage.checkAuth()) return;

    initDateFilter();
    loadDashboard();
});

// ============================================
// DATE FILTER
// ============================================
function initDateFilter() {
    const buttons = document.querySelectorAll('.date-btn');
    const customRange = document.getElementById('customDateRange');
    const applyBtn = document.getElementById('applyCustomDate');

    // Set today as default
    currentDateRange = Storage.getDateRange('today');

    buttons.forEach(btn => {
        btn.addEventListener('click', function () {
            buttons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const range = this.dataset.range;
            currentRange = range;

            if (range === 'custom') {
                customRange.style.display = 'flex';
                // Set default custom dates (last 7 days)
                const today = Storage.getToday();
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                document.getElementById('customFromDate').value = weekAgo.toISOString().split('T')[0];
                document.getElementById('customToDate').value = today;
            } else {
                customRange.style.display = 'none';
                currentDateRange = Storage.getDateRange(range);
                updateActivePeriod(range);
                refreshDashboard();
            }
        });
    });

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const from = document.getElementById('customFromDate').value;
            const to = document.getElementById('customToDate').value;

            if (!from || !to) {
                showToast('Please select both dates', 'error');
                return;
            }

            if (from > to) {
                showToast('From date cannot be after To date', 'error');
                return;
            }

            currentDateRange = { from, to };
            updateActivePeriod('custom', from, to);
            refreshDashboard();
        });
    }
}

function updateActivePeriod(range, from, to) {
    const activeEl = document.getElementById('activePeriod');
    const labels = {
        today: 'Today',
        yesterday: 'Yesterday',
        week: 'Last 7 Days',
        month: 'This Month',
        year: 'This Year',
        custom: 'Custom Range'
    };

    let periodText = labels[range] || 'Today';

    if (range === 'custom' && from && to) {
        periodText = `${Storage.formatDate(from)} → ${Storage.formatDate(to)}`;
    } else if (currentDateRange) {
        if (range === 'today' || range === 'yesterday') {
            periodText = `${labels[range]} (${Storage.formatDate(currentDateRange.from)})`;
        } else {
            periodText = `${labels[range]} (${Storage.formatDate(currentDateRange.from)} → ${Storage.formatDate(currentDateRange.to)})`;
        }
    }

    activeEl.innerHTML = `📅 <strong>${periodText}</strong>`;
}

// ============================================
// LOAD DASHBOARD
// ============================================
function loadDashboard() {
    updateActivePeriod(currentRange);
    loadTopCards();
    loadStockSummary();
    loadStockChart();
    loadCategoryChart();
    loadTopProductsChart();
    loadPurchaseTrendChart();
    loadRecentPurchases();
    loadPendingPaymentsTable();
    loadLowStockTable();
}

function refreshDashboard() {
    loadTopCards();
    loadStockSummary();
    loadStockChart();
    loadRecentPurchases();
    loadPendingPaymentsTable();
}

// ============================================
// ANIMATED COUNTERS
// ============================================
function animateCounter(element, target, duration = 1000, prefix = '', isDecimal = false) {
    if (!element) return;

    const start = 0;
    const startTime = performance.now();
    element.classList.add('updating');

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const current = start + (target - start) * easeProgress;

        if (isDecimal) {
            element.textContent = prefix + current.toLocaleString('en-IN', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            });
        } else {
            element.textContent = prefix + Math.floor(current).toLocaleString('en-IN');
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.classList.remove('updating');
        }
    }

    requestAnimationFrame(update);
}

// ============================================
// TOP CARDS with Growth Indicators
// ============================================
function loadTopCards() {
    const products = Storage.getProducts();
    const inventoryValue = Storage.getTotalInventoryValue();
    const lowStockCount = Storage.getLowStockProducts().length;
    const outOfStockCount = Storage.getOutOfStockProducts().length;
    const pendingAmount = Storage.getTotalPendingAmount();
    const overdueAmount = Storage.getTotalOverdueAmount();

    // Animate counters
    animateCounter(document.getElementById('totalProducts'), products.length);
    animateCounter(document.getElementById('inventoryValue'), inventoryValue, 1200, '₹', true);
    animateCounter(document.getElementById('lowStockCount'), lowStockCount);
    animateCounter(document.getElementById('outOfStockCount'), outOfStockCount);
    animateCounter(document.getElementById('pendingPayments'), pendingAmount, 1200, '₹', true);
    animateCounter(document.getElementById('overduePayments'), overdueAmount, 1200, '₹', true);

    // Calculate growth
    calculateAndShowGrowth();
}

function calculateAndShowGrowth() {
    const currentStats = Storage.getFilteredStats(currentDateRange.from, currentDateRange.to);
    const prevRange = Storage.getPreviousDateRange(currentRange);
    const prevStats = Storage.getFilteredStats(prevRange.from, prevRange.to);

    // Products Growth (based on purchase count for period)
    updateGrowthIndicator(
        'productsGrowth',
        currentStats.purchaseCount,
        prevStats.purchaseCount
    );

    // Inventory Value Growth
    updateGrowthIndicator(
        'valueGrowth',
        currentStats.purchaseAmount,
        prevStats.purchaseAmount
    );

    // Pending Payments Growth
    updateGrowthIndicator(
        'pendingGrowth',
        currentStats.pendingAmount,
        prevStats.pendingAmount,
        true  // Reverse (increase in pending is bad)
    );

    // Low Stock - static warning
    const lowStock = Storage.getLowStockProducts().length;
    const lowStockEl = document.getElementById('lowStockGrowth');
    if (lowStock === 0) {
        lowStockEl.className = 'growth-indicator';
        lowStockEl.innerHTML = '<i class="fas fa-check"></i><span>Good</span>';
    } else {
        lowStockEl.className = 'growth-indicator warning';
        lowStockEl.innerHTML = `<i class="fas fa-exclamation"></i><span>${lowStock} Item${lowStock > 1 ? 's' : ''}</span>`;
    }

    // Out of Stock - static critical
    const outStock = Storage.getOutOfStockProducts().length;
    const outEl = document.getElementById('outStockGrowth');
    if (outStock === 0) {
        outEl.className = 'growth-indicator';
        outEl.innerHTML = '<i class="fas fa-check"></i><span>All Good</span>';
    } else {
        outEl.className = 'growth-indicator danger';
        outEl.innerHTML = `<i class="fas fa-times"></i><span>${outStock} Item${outStock > 1 ? 's' : ''}</span>`;
    }

    // Overdue - critical
    const overdue = Storage.getOverduePurchases().length;
    const overdueEl = document.getElementById('overdueGrowth');
    if (overdue === 0) {
        overdueEl.className = 'growth-indicator';
        overdueEl.innerHTML = '<i class="fas fa-check"></i><span>No Overdue</span>';
    } else {
        overdueEl.className = 'growth-indicator danger';
        overdueEl.innerHTML = `<i class="fas fa-exclamation"></i><span>${overdue} Overdue</span>`;
    }
}

function updateGrowthIndicator(elementId, current, previous, reverse = false) {
    const el = document.getElementById(elementId);
    if (!el) return;

    let percentage = 0;
    let isUp = false;

    if (previous === 0) {
        percentage = current > 0 ? 100 : 0;
        isUp = current > 0;
    } else {
        percentage = ((current - previous) / previous) * 100;
        isUp = percentage >= 0;
    }

    percentage = Math.abs(percentage).toFixed(1);

    let className = 'growth-indicator';
    let icon = '';
    let text = '';

    if (current === 0 && previous === 0) {
        className += ' neutral';
        icon = '<i class="fas fa-minus"></i>';
        text = 'No change';
    } else if (reverse) {
        // For pending/overdue - increase is BAD
        if (isUp) {
            className += ' down';
            icon = '<i class="fas fa-arrow-up"></i>';
        } else {
            className += '';
            icon = '<i class="fas fa-arrow-down"></i>';
        }
        text = percentage + '%';
    } else {
        // Normal - increase is GOOD
        if (isUp) {
            className += '';
            icon = '<i class="fas fa-arrow-up"></i>';
        } else {
            className += ' down';
            icon = '<i class="fas fa-arrow-down"></i>';
        }
        text = percentage + '%';
    }

    el.className = className;
    el.innerHTML = `${icon}<span>${text}</span>`;
}

// ============================================
// STOCK SUMMARY
// ============================================
function loadStockSummary() {
    const stats = Storage.getFilteredStats(currentDateRange.from, currentDateRange.to);
    const totalStock = Storage.getProducts().reduce((sum, p) => sum + (p.currentStock || 0), 0);

    animateCounter(document.getElementById('currentStock'), totalStock);

    document.getElementById('todayPurchase').textContent = '+' + stats.purchaseQty;
    document.getElementById('todayStockOut').textContent = '-' + stats.stockOutQty;
}

// ============================================
// STOCK MOVEMENT CHART
// ============================================
function loadStockChart() {
    const ctx = document.getElementById('stockChart');
    if (!ctx) return;

    // Destroy existing chart
    if (stockChart) {
        stockChart.destroy();
    }

    // Get data based on current range
    const days = getDaysCountForRange(currentRange);
    const trendData = Storage.getPurchaseTrendData(days);

    const labels = trendData.map(t => t.label);
    const purchaseData = trendData.map(t => t.quantity);
    const stockoutData = trendData.map(t => t.stockOut);

    stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Stock In',
                    data: purchaseData,
                    borderColor: '#a78bfa',
                    backgroundColor: 'rgba(167, 139, 250, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointBackgroundColor: '#a78bfa',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                },
                {
                    label: 'Stock Out',
                    data: stockoutData,
                    borderColor: '#f9a8d4',
                    backgroundColor: 'rgba(249, 168, 212, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointBackgroundColor: '#f9a8d4',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 20,
                        font: { family: 'Poppins', size: 12 }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(167, 139, 250, 0.08)' },
                    ticks: { font: { family: 'Poppins', size: 11 }, color: '#7a7a9a' }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Poppins', size: 10 }, color: '#7a7a9a' }
                }
            }
        }
    });
}

function getDaysCountForRange(range) {
    switch (range) {
        case 'today': return 1;
        case 'yesterday': return 2;
        case 'week': return 7;
        case 'month': return 30;
        case 'year': return 365;
        case 'custom':
            if (currentDateRange) {
                const from = new Date(currentDateRange.from);
                const to = new Date(currentDateRange.to);
                return Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
            }
            return 7;
        default: return 7;
    }
}

// ============================================
// CATEGORY DISTRIBUTION CHART (Doughnut)
// ============================================
function loadCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    if (categoryChart) categoryChart.destroy();

    const categoryData = Storage.getCategoryDistribution();

    if (categoryData.length === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        document.getElementById('categoryLegend').innerHTML = '<p class="empty-notif">No products yet</p>';
        return;
    }

    // Pastel colors
    const colors = [
        '#a78bfa', '#f9a8d4', '#93c5fd', '#fdba74',
        '#86efac', '#fde68a', '#fca5a5', '#c4b5fd',
        '#fbcfe8', '#bfdbfe', '#fed7aa', '#bbf7d0'
    ];

    const labels = categoryData.map(c => c.category);
    const data = categoryData.map(c => c.count);
    const values = categoryData.map(c => c.value);
    const chartColors = labels.map((_, i) => colors[i % colors.length]);

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: chartColors,
                borderColor: '#fff',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label;
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            const catValue = values[context.dataIndex];
                            return [
                                `${label}: ${value} products (${percentage}%)`,
                                `Value: ${Storage.formatCurrency(catValue)}`
                            ];
                        }
                    }
                }
            }
        }
    });

    // Custom Legend
    const legendHTML = labels.map((label, i) => `
        <div class="legend-item">
            <div class="legend-color" style="background: ${chartColors[i]};"></div>
            <span>${label} (${data[i]})</span>
        </div>
    `).join('');
    document.getElementById('categoryLegend').innerHTML = legendHTML;
}

// ============================================
// TOP 5 PRODUCTS CHART (Horizontal Bar)
// ============================================
function loadTopProductsChart() {
    const ctx = document.getElementById('topProductsChart');
    if (!ctx) return;

    if (topProductsChart) topProductsChart.destroy();

    const topProducts = Storage.getTopProductsByValue(5);

    if (topProducts.length === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }

    const labels = topProducts.map(p => p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name);
    const data = topProducts.map(p => p.totalValue);

    // Gradient colors
    const canvas = ctx.getContext('2d');
    const gradient = canvas.createLinearGradient(0, 0, ctx.width, 0);
    gradient.addColorStop(0, 'rgba(167, 139, 250, 0.8)');
    gradient.addColorStop(1, 'rgba(249, 168, 212, 0.8)');

    topProductsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Value',
                data: data,
                backgroundColor: gradient,
                borderColor: '#a78bfa',
                borderWidth: 0,
                borderRadius: 8,
                barThickness: 25
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return Storage.formatCurrency(context.parsed.x);
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(167, 139, 250, 0.08)' },
                    ticks: {
                        font: { family: 'Poppins', size: 10 },
                        color: '#7a7a9a',
                        callback: function (value) {
                            if (value >= 1000) return '₹' + (value / 1000).toFixed(0) + 'k';
                            return '₹' + value;
                        }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { family: 'Poppins', size: 11 }, color: '#4a4a6a' }
                }
            }
        }
    });
}

// ============================================
// PURCHASE TREND CHART (30 Days)
// ============================================
function loadPurchaseTrendChart() {
    const ctx = document.getElementById('purchaseTrendChart');
    if (!ctx) return;

    if (purchaseTrendChart) purchaseTrendChart.destroy();

    const trendData = Storage.getPurchaseTrendData(30);
    const labels = trendData.map(t => t.label);
    const amounts = trendData.map(t => t.amount);
    const quantities = trendData.map(t => t.quantity);

    const canvas = ctx.getContext('2d');
    const gradient1 = canvas.createLinearGradient(0, 0, 0, ctx.height);
    gradient1.addColorStop(0, 'rgba(167, 139, 250, 0.4)');
    gradient1.addColorStop(1, 'rgba(167, 139, 250, 0.02)');

    const gradient2 = canvas.createLinearGradient(0, 0, 0, ctx.height);
    gradient2.addColorStop(0, 'rgba(147, 197, 253, 0.4)');
    gradient2.addColorStop(1, 'rgba(147, 197, 253, 0.02)');

    purchaseTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Purchase Amount (₹)',
                    data: amounts,
                    borderColor: '#a78bfa',
                    backgroundColor: gradient1,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: '#a78bfa',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    yAxisID: 'y'
                },
                {
                    label: 'Quantity',
                    data: quantities,
                    borderColor: '#93c5fd',
                    backgroundColor: gradient2,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointBackgroundColor: '#93c5fd',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 20,
                        font: { family: 'Poppins', size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            if (context.datasetIndex === 0) {
                                return 'Amount: ' + Storage.formatCurrency(context.parsed.y);
                            }
                            return 'Quantity: ' + context.parsed.y + ' items';
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    grid: { color: 'rgba(167, 139, 250, 0.08)' },
                    ticks: {
                        font: { family: 'Poppins', size: 10 },
                        color: '#7a7a9a',
                        callback: function (value) {
                            if (value >= 1000) return '₹' + (value / 1000).toFixed(0) + 'k';
                            return '₹' + value;
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: {
                        font: { family: 'Poppins', size: 10 },
                        color: '#7a7a9a'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: 'Poppins', size: 9 },
                        color: '#7a7a9a',
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// ============================================
// TABLES
// ============================================
function loadRecentPurchases() {
    const tbody = document.getElementById('recentPurchasesTable');
    const purchases = Storage.getPurchasesByDateRange(currentDateRange.from, currentDateRange.to)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    if (purchases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No purchases in this period</td></tr>';
        return;
    }

    tbody.innerHTML = purchases.map(p => {
        const supplier = Storage.getSupplierById(p.supplierId);
        return `
            <tr>
                <td>${Storage.formatDate(p.date)}</td>
                <td>${supplier ? supplier.name : '-'}</td>
                <td>${p.invoiceNo}</td>
                <td>${Storage.formatCurrency(p.totalAmount)}</td>
                <td>${getPaymentStatusBadge(p)}</td>
            </tr>
        `;
    }).join('');
}

function loadPendingPaymentsTable() {
    const tbody = document.getElementById('pendingPaymentsTable');
    const pending = Storage.getPendingPurchases().slice(0, 5);

    if (pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No pending payments ✅</td></tr>';
        return;
    }

    tbody.innerHTML = pending.map(p => {
        const supplier = Storage.getSupplierById(p.supplierId);
        return `
            <tr>
                <td>${supplier ? supplier.name : '-'}</td>
                <td class="text-danger">${Storage.formatCurrency(p.dueAmount)}</td>
                <td>${Storage.formatDate(p.dueDate)}</td>
                <td>${getPaymentStatusBadge(p)}</td>
            </tr>
        `;
    }).join('');
}

function loadLowStockTable() {
    const tbody = document.getElementById('lowStockTable');
    const lowStock = Storage.getLowStockProducts();
    const outOfStock = Storage.getOutOfStockProducts();
    const allAlerts = [...outOfStock, ...lowStock].slice(0, 5);

    if (allAlerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">All items are well stocked ✅</td></tr>';
        return;
    }

    tbody.innerHTML = allAlerts.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.currentStock} ${p.unit}</td>
            <td>${p.minimumStock} ${p.unit}</td>
            <td>${getStockStatusBadge(p)}</td>
        </tr>
    `).join('');
}