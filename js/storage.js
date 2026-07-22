/* ============================================
   STORAGE.JS - Data Management Layer
   With Indian Standard Time (IST) Support
   + Date Range Filters + Chart Data
   ============================================ */

const Storage = {

    // ============================================
    // INDIAN TIME (IST) HELPERS
    // ============================================
    getIndianNow() {
        const now = new Date();
        const istOffset = 5.5 * 60;
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        return new Date(utc + (istOffset * 60000));
    },

    getIndianDate() {
        const ist = this.getIndianNow();
        const year = ist.getFullYear();
        const month = String(ist.getMonth() + 1).padStart(2, '0');
        const day = String(ist.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    getIndianTime() {
        return new Date().toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    },

    getIndianDateTime() {
        return new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    },

    getIndianDateFormatted() {
        return new Date().toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    // ── Helper Functions ──
    generateId(prefix) {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    },

    getToday() {
        return this.getIndianDate();
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    },

    formatCurrency(amount) {
        return '₹' + parseFloat(amount || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    },

    // ── Generic Storage Functions ──
    getData(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading from storage:', e);
            return [];
        }
    },

    setData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            // Trigger local update for immediate UI refresh in current tab
            window.dispatchEvent(new CustomEvent('storage-update', { detail: { key: key } }));
            if (window.FirebaseSync && typeof FirebaseSync.uploadKey === 'function') {
                FirebaseSync.uploadKey(key, data);
            }
            return true;
        } catch (e) {
            console.error('Error writing to storage:', e);
            return false;
        }
    },

    // ============================================
    // AUTHENTICATION & SESSION
    // ============================================
    getSession() {
        const session = localStorage.getItem('inv_session') || sessionStorage.getItem('inv_session');
        return session ? JSON.parse(session) : null;
    },

    isLoggedIn() {
        const session = this.getSession();
        return session && session.isLoggedIn === true;
    },

    getCurrentUser() {
        const session = this.getSession();
        return session ? {
            username: session.userId,
            name: session.name,
            role: session.role,
            avatar: session.avatar
        } : null;
    },

    logout() {
        const session = this.getSession();
        if (session) {
            this.logActivity('logout', `${session.name} logged out`);
        }
        localStorage.removeItem('inv_session');
        sessionStorage.removeItem('inv_session');
        window.location.href = 'login.html';
    },

    checkAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },

    // ============================================
    // ACTIVITY LOG (with IST)
    // ============================================
    logActivity(type, message, details = '') {
        const logs = this.getData('inv_activity_log');
        const user = this.getCurrentUser();

        logs.push({
            id: this.generateId('LOG'),
            type: type,
            message: message,
            details: details,
            userId: user ? user.username : 'system',
            userName: user ? user.name : 'System',
            time: this.getIndianTime(),
            date: this.getIndianDate(),
            dateFormatted: this.getIndianDateTime(),
            timestamp: new Date().toISOString()
        });

        if (logs.length > 1000) {
            logs.splice(0, logs.length - 1000);
        }

        this.setData('inv_activity_log', logs);
    },

    getActivityLogs(date = null, limit = 50) {
        let logs = this.getData('inv_activity_log');

        if (date) {
            logs = logs.filter(l => l.date === date);
        }

        return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    },

    getTodayActivityLogs() {
        return this.getActivityLogs(this.getToday());
    },

    // ============================================
    // DAILY SUMMARY (IST Based)
    // ============================================
    getDailySummary(date = null) {
        const targetDate = date || this.getToday();

        const purchases = this.getPurchases().filter(p => p.date === targetDate);
        const stockouts = this.getStockOuts().filter(s => s.date === targetDate);
        const payments = this.getPayments().filter(p => p.date === targetDate);
        const logs = this.getActivityLogs(targetDate, 100);

        const totalPurchaseAmount = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
        const totalPurchaseQty = purchases.reduce((s, p) => {
            return s + (p.products || []).reduce((qs, item) => qs + (item.quantity || 0), 0);
        }, 0);
        const totalStockOutQty = stockouts.reduce((s, so) => s + (so.quantity || 0), 0);
        const totalPayments = payments.reduce((s, p) => s + (p.amount || 0), 0);

        return {
            date: targetDate,
            dateFormatted: this.formatDate(targetDate),
            purchases: {
                count: purchases.length,
                totalAmount: totalPurchaseAmount,
                totalQuantity: totalPurchaseQty,
                items: purchases
            },
            stockOuts: {
                count: stockouts.length,
                totalQuantity: totalStockOutQty,
                items: stockouts
            },
            payments: {
                count: payments.length,
                totalAmount: totalPayments,
                items: payments
            },
            activities: logs
        };
    },

    seedDefaultData() {
        const todayStr = this.getToday();
        const date5DaysAgo = new Date();
        date5DaysAgo.setDate(date5DaysAgo.getDate() - 5);
        const d5Str = date5DaysAgo.toISOString().split('T')[0];

        const date2DaysAgo = new Date();
        date2DaysAgo.setDate(date2DaysAgo.getDate() - 2);
        const d2Str = date2DaysAgo.toISOString().split('T')[0];

        const defaultSuppliers = [
            { id: 'SUP_dairy', name: 'Dairy Fresh Premium', phone: '+91 98765 43210', address: 'Anand, Gujarat', totalPurchase: 0, pendingAmount: 0, lastPayment: null },
            { id: 'SUP_spices', name: 'Spice & Herb Hub', phone: '+91 87654 32109', address: 'Spice Market, Mumbai', totalPurchase: 0, pendingAmount: 0, lastPayment: null },
            { id: 'SUP_gelato', name: 'Coldstone Gelato Base', phone: '+91 76543 21098', address: 'Industrial Area, Pune', totalPurchase: 0, pendingAmount: 0, lastPayment: null },
            { id: 'SUP_farms', name: 'Green Earth Farms', phone: '+91 65432 10987', address: 'Ooty, Tamil Nadu', totalPurchase: 0, pendingAmount: 0, lastPayment: null }
        ];

        const defaultProducts = [
            { id: 'PRD_cheese', name: 'Mozzarella Cheese', category: 'Dairy & Cheese', unit: 'kg', currentStock: 25, minimumStock: 5, purchasePrice: 450, supplierId: 'SUP_dairy' },
            { id: 'PRD_pep', name: 'Pepperoni Slices', category: 'Pizza Toppings', unit: 'kg', currentStock: 15, minimumStock: 3, purchasePrice: 850, supplierId: 'SUP_spices' },
            { id: 'PRD_sauce', name: 'Pizza Sauce (Classic)', category: 'Sauces & Spices', unit: 'Litre', currentStock: 40, minimumStock: 8, purchasePrice: 150, supplierId: 'SUP_spices' },
            { id: 'PRD_dough', name: 'Fresh Pizza Dough (Regular)', category: 'Crusts & Dough', unit: 'Pieces', currentStock: 120, minimumStock: 20, purchasePrice: 15, supplierId: 'SUP_dairy' },
            { id: 'PRD_paneer', name: 'Diced Paneer (Chilly Spiced)', category: 'Dairy & Cheese', unit: 'kg', currentStock: 18, minimumStock: 4, purchasePrice: 350, supplierId: 'SUP_dairy' },
            { id: 'PRD_vgelato', name: 'Vanilla Bean Gelato', category: 'Ice Cream & Desserts', unit: 'Litre', currentStock: 12, minimumStock: 3, purchasePrice: 300, supplierId: 'SUP_gelato' },
            { id: 'PRD_cgelato', name: 'Spicy Chilli Gelato', category: 'Ice Cream & Desserts', unit: 'Litre', currentStock: 8, minimumStock: 2, purchasePrice: 350, supplierId: 'SUP_gelato' },
            { id: 'PRD_flakes', name: 'Red Chilli Flakes', category: 'Sauces & Spices', unit: 'kg', currentStock: 5, minimumStock: 1, purchasePrice: 250, supplierId: 'SUP_spices' },
            { id: 'PRD_guava', name: 'Chilli Guava Syrup', category: 'Beverages', unit: 'Litre', currentStock: 15, minimumStock: 3, purchasePrice: 180, supplierId: 'SUP_gelato' },
            { id: 'PRD_jalapeno', name: 'Fresh Jalapenos', category: 'Vegetables & Herbs', unit: 'kg', currentStock: 4, minimumStock: 5, purchasePrice: 120, supplierId: 'SUP_farms' }
        ];

        const defaultPurchases = [
            {
                id: 'PUR_1',
                invoiceNo: 'INV-2026-001',
                supplierId: 'SUP_dairy',
                date: d5Str,
                totalAmount: 18000,
                paidAmount: 18000,
                dueAmount: 0,
                status: 'paid',
                products: [
                    { productId: 'PRD_cheese', quantity: 30, price: 450 },
                    { productId: 'PRD_dough', quantity: 300, price: 15 }
                ],
                createdAt: date5DaysAgo.toISOString()
            },
            {
                id: 'PUR_2',
                invoiceNo: 'INV-2026-002',
                supplierId: 'SUP_spices',
                date: d2Str,
                totalAmount: 15250,
                paidAmount: 10000,
                dueAmount: 5250,
                status: 'pending',
                dueDate: todayStr,
                products: [
                    { productId: 'PRD_pep', quantity: 15, price: 850 },
                    { productId: 'PRD_sauce', quantity: 15, price: 150 },
                    { productId: 'PRD_flakes', quantity: 2, price: 250 }
                ],
                createdAt: date2DaysAgo.toISOString()
            }
        ];

        const defaultStockouts = [
            {
                id: 'SO_1',
                productId: 'PRD_cheese',
                quantity: 5,
                date: d2Str,
                reason: 'Used for Pepperoni Pizza orders',
                createdAt: date2DaysAgo.toISOString()
            },
            {
                id: 'SO_2',
                productId: 'PRD_jalapeno',
                quantity: 1,
                date: todayStr,
                reason: 'Used for Spicy Chilli Paneer Pizza orders',
                createdAt: new Date().toISOString()
            }
        ];

        const defaultPayments = [
            {
                id: 'PAY_1',
                purchaseId: 'PUR_2',
                supplierId: 'SUP_spices',
                amount: 10000,
                date: d2Str,
                timestamp: date2DaysAgo.toISOString(),
                createdAt: date2DaysAgo.toISOString()
            }
        ];

        const defaultLogs = [
            { id: 'LOG_1', type: 'system_init', message: 'Crust & Chilly Inventory System initialized.', userId: 'system', userName: 'System', date: d5Str, time: '10:00:00 AM', timestamp: date5DaysAgo.toISOString() },
            { id: 'LOG_2', type: 'purchase', message: 'New purchase: INV-2026-001 from Dairy Fresh Premium - ₹18,000', userId: 'admin', userName: 'Sanket Barot', date: d5Str, time: '11:00:00 AM', timestamp: date5DaysAgo.toISOString() },
            { id: 'LOG_3', type: 'purchase', message: 'New purchase: INV-2026-002 from Spice & Herb Hub - ₹15,250', userId: 'admin', userName: 'Sanket Barot', date: d2Str, time: '12:00:00 PM', timestamp: date2DaysAgo.toISOString() },
            { id: 'LOG_4', type: 'payment', message: 'Payment recorded: ₹10,000 to Spice & Herb Hub', userId: 'admin', userName: 'Sanket Barot', date: d2Str, time: '02:30:00 PM', timestamp: date2DaysAgo.toISOString() },
            { id: 'LOG_5', type: 'stockout', message: 'Stock out: 5 kg of Mozzarella Cheese - Reason: Pizza orders', userId: 'staff', userName: 'Staff', date: d2Str, time: '05:00:00 PM', timestamp: date2DaysAgo.toISOString() }
        ];

        // Save collections directly to local storage to set seed baseline
        localStorage.setItem('inv_suppliers', JSON.stringify(defaultSuppliers));
        localStorage.setItem('inv_products', JSON.stringify(defaultProducts));
        localStorage.setItem('inv_purchases', JSON.stringify(defaultPurchases));
        localStorage.setItem('inv_stockouts', JSON.stringify(defaultStockouts));
        localStorage.setItem('inv_payments', JSON.stringify(defaultPayments));
        localStorage.setItem('inv_activity_log', JSON.stringify(defaultLogs));
        localStorage.setItem('inv_seeded', 'true');

        // Recalculate totals
        this.updateSupplierTotals('SUP_dairy');
        this.updateSupplierTotals('SUP_spices');
        this.updateSupplierTotals('SUP_gelato');
        this.updateSupplierTotals('SUP_farms');
    },

    // ============================================
    // PRODUCTS
    // ============================================
    getProducts() {
        let products = this.getData('inv_products');
        if (products.length === 0 && localStorage.getItem('inv_seeded') !== 'true') {
            this.seedDefaultData();
            products = this.getData('inv_products');
        }
        return products;
    },

    getProductById(id) {
        return this.getProducts().find(p => p.id === id);
    },

    saveProduct(product) {
        const products = this.getProducts();
        const istNow = new Date().toISOString();

        if (product.id) {
            const index = products.findIndex(p => p.id === product.id);
            if (index !== -1) {
                products[index] = {
                    ...products[index],
                    ...product,
                    updatedAt: istNow,
                    updatedDate: this.getToday(),
                    updatedTime: this.getIndianTime()
                };
                this.logActivity('product_update', `Product updated: ${product.name}`);
            }
        } else {
            product.id = this.generateId('PRD');
            product.createdAt = istNow;
            product.createdDate = this.getToday();
            product.createdTime = this.getIndianTime();
            product.updatedAt = istNow;
            products.push(product);
            this.logActivity('product_add', `New product added: ${product.name}`);
        }
        this.setData('inv_products', products);
        return product;
    },

    deleteProduct(id) {
        const product = this.getProductById(id);
        const products = this.getProducts().filter(p => p.id !== id);
        this.setData('inv_products', products);
        if (product) {
            this.logActivity('product_delete', `Product deleted: ${product.name}`);
        }
    },

    updateProductStock(productId, quantityChange) {
        const products = this.getProducts();
        const index = products.findIndex(p => p.id === productId);
        if (index !== -1) {
            const oldStock = products[index].currentStock || 0;
            products[index].currentStock = Math.max(0, oldStock + quantityChange);
            products[index].updatedAt = new Date().toISOString();
            products[index].lastStockUpdate = this.getIndianDateTime();
            this.setData('inv_products', products);
        }
    },

    getCategories() {
        const products = this.getProducts();
        return [...new Set(products.map(p => p.category).filter(Boolean))].sort();
    },

    getLowStockProducts() {
        return this.getProducts().filter(p => p.currentStock > 0 && p.currentStock <= p.minimumStock);
    },

    getOutOfStockProducts() {
        return this.getProducts().filter(p => p.currentStock <= 0);
    },

    getTotalInventoryValue() {
        return this.getProducts().reduce((total, p) => {
            return total + ((p.currentStock || 0) * (p.purchasePrice || 0));
        }, 0);
    },

    // ============================================
    // SUPPLIERS
    // ============================================
    getSuppliers() {
        return this.getData('inv_suppliers');
    },

    getSupplierById(id) {
        return this.getSuppliers().find(s => s.id === id);
    },

    saveSupplier(supplier) {
        const suppliers = this.getSuppliers();
        if (supplier.id) {
            const index = suppliers.findIndex(s => s.id === supplier.id);
            if (index !== -1) {
                suppliers[index] = { ...suppliers[index], ...supplier, updatedAt: new Date().toISOString() };
                this.logActivity('supplier_update', `Supplier updated: ${supplier.name}`);
            }
        } else {
            supplier.id = this.generateId('SUP');
            supplier.totalPurchase = 0;
            supplier.pendingAmount = 0;
            supplier.lastPayment = null;
            supplier.createdAt = new Date().toISOString();
            supplier.createdDate = this.getToday();
            suppliers.push(supplier);
            this.logActivity('supplier_add', `New supplier added: ${supplier.name}`);
        }
        this.setData('inv_suppliers', suppliers);
        return supplier;
    },

    deleteSupplier(id) {
        const supplier = this.getSupplierById(id);
        const suppliers = this.getSuppliers().filter(s => s.id !== id);
        this.setData('inv_suppliers', suppliers);
        if (supplier) {
            this.logActivity('supplier_delete', `Supplier deleted: ${supplier.name}`);
        }
    },

    updateSupplierTotals(supplierId) {
        const purchases = this.getPurchasesBySupplier(supplierId);
        const suppliers = this.getSuppliers();
        const index = suppliers.findIndex(s => s.id === supplierId);

        if (index !== -1) {
            suppliers[index].totalPurchase = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
            suppliers[index].pendingAmount = purchases.reduce((sum, p) => sum + (p.dueAmount || 0), 0);

            const payments = this.getPaymentsBySupplier(supplierId);
            if (payments.length > 0) {
                const sorted = payments.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
                suppliers[index].lastPayment = sorted[0].date;
            }
            this.setData('inv_suppliers', suppliers);
        }
    },

    // ============================================
    // PURCHASES
    // ============================================
    getPurchases() {
        return this.getData('inv_purchases');
    },

    getPurchaseById(id) {
        return this.getPurchases().find(p => p.id === id);
    },

    getPurchasesBySupplier(supplierId) {
        return this.getPurchases().filter(p => p.supplierId === supplierId);
    },

    savePurchase(purchase) {
        const purchases = this.getPurchases();
        if (purchase.id) {
            const index = purchases.findIndex(p => p.id === purchase.id);
            if (index !== -1) {
                purchases[index] = { ...purchases[index], ...purchase, updatedAt: new Date().toISOString() };
            }
        } else {
            purchase.id = this.generateId('PUR');
            purchase.createdAt = new Date().toISOString();
            purchase.createdDate = this.getToday();
            purchase.createdTime = this.getIndianTime();

            if (purchase.dueAmount <= 0) {
                purchase.status = 'paid';
            } else {
                purchase.status = 'pending';
            }

            purchases.push(purchase);

            if (purchase.products && purchase.products.length > 0) {
                purchase.products.forEach(item => {
                    this.updateProductStock(item.productId, item.quantity);
                });
            }

            this.updateSupplierTotals(purchase.supplierId);

            const supplier = this.getSupplierById(purchase.supplierId);
            this.logActivity('purchase', `New purchase: ${purchase.invoiceNo} from ${supplier ? supplier.name : 'Unknown'} - ${this.formatCurrency(purchase.totalAmount)}`);
        }
        this.setData('inv_purchases', purchases);
        return purchase;
    },

    getRecentPurchases(limit = 5) {
        return this.getPurchases()
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);
    },

    getTodayPurchases() {
        const today = this.getToday();
        return this.getPurchases().filter(p => p.date === today);
    },

    getPendingPurchases() {
        return this.getPurchases().filter(p => p.dueAmount > 0);
    },

    getOverduePurchases() {
        const today = this.getToday();
        return this.getPurchases().filter(p => p.dueAmount > 0 && p.dueDate && p.dueDate < today);
    },

    getTotalPendingAmount() {
        return this.getPendingPurchases().reduce((sum, p) => sum + (p.dueAmount || 0), 0);
    },

    getTotalOverdueAmount() {
        return this.getOverduePurchases().reduce((sum, p) => sum + (p.dueAmount || 0), 0);
    },

    // ============================================
    // STOCK OUT
    // ============================================
    getStockOuts() {
        return this.getData('inv_stockouts');
    },

    saveStockOut(stockout) {
        const stockouts = this.getStockOuts();
        stockout.id = this.generateId('SO');
        stockout.createdAt = new Date().toISOString();
        stockout.createdDate = this.getToday();
        stockout.createdTime = this.getIndianTime();
        stockouts.push(stockout);
        this.setData('inv_stockouts', stockouts);

        this.updateProductStock(stockout.productId, -stockout.quantity);

        const product = this.getProductById(stockout.productId);
        this.logActivity('stockout', `Stock out: ${stockout.quantity} ${product ? product.unit : ''} of ${product ? product.name : 'Unknown'} - Reason: ${stockout.reason}`);

        return stockout;
    },

    deleteStockOut(id) {
        const stockout = this.getStockOuts().find(s => s.id === id);
        if (stockout) {
            this.updateProductStock(stockout.productId, stockout.quantity);
            const product = this.getProductById(stockout.productId);
            this.logActivity('stockout_delete', `Stock out reversed: ${stockout.quantity} ${product ? product.unit : ''} of ${product ? product.name : 'Unknown'}`);
        }
        const stockouts = this.getStockOuts().filter(s => s.id !== id);
        this.setData('inv_stockouts', stockouts);
    },

    getTodayStockOuts() {
        const today = this.getToday();
        return this.getStockOuts().filter(s => s.date === today);
    },

    // ============================================
    // PAYMENTS
    // ============================================
    getPayments() {
        return this.getData('inv_payments');
    },

    getPaymentsBySupplier(supplierId) {
        return this.getPayments().filter(p => p.supplierId === supplierId);
    },

    getPaymentsByPurchase(purchaseId) {
        return this.getPayments().filter(p => p.purchaseId === purchaseId);
    },

    savePayment(payment) {
        const payments = this.getPayments();
        payment.id = this.generateId('PAY');
        payment.createdAt = new Date().toISOString();
        payment.createdDate = this.getToday();
        payment.createdTime = this.getIndianTime();
        payment.timestamp = new Date().toISOString();
        payments.push(payment);
        this.setData('inv_payments', payments);

        const purchases = this.getPurchases();
        const purchaseIndex = purchases.findIndex(p => p.id === payment.purchaseId);
        if (purchaseIndex !== -1) {
            purchases[purchaseIndex].paidAmount = (purchases[purchaseIndex].paidAmount || 0) + payment.amount;
            purchases[purchaseIndex].dueAmount = Math.max(0,
                (purchases[purchaseIndex].totalAmount || 0) - purchases[purchaseIndex].paidAmount
            );
            purchases[purchaseIndex].status = purchases[purchaseIndex].dueAmount <= 0 ? 'paid' : 'pending';
            this.setData('inv_purchases', purchases);
        }

        if (payment.supplierId) {
            this.updateSupplierTotals(payment.supplierId);
        }

        const supplier = this.getSupplierById(payment.supplierId);
        this.logActivity('payment', `Payment recorded: ${this.formatCurrency(payment.amount)} to ${supplier ? supplier.name : 'Unknown'}`);

        return payment;
    },

    // ============================================
    // DASHBOARD STATS
    // ============================================
    getDashboardStats() {
        const products = this.getProducts();
        const totalStock = products.reduce((sum, p) => sum + (p.currentStock || 0), 0);
        const todayPurchases = this.getTodayPurchases();
        const todayStockOuts = this.getTodayStockOuts();

        const todayPurchaseQty = todayPurchases.reduce((sum, p) => {
            return sum + (p.products || []).reduce((s, item) => s + (item.quantity || 0), 0);
        }, 0);
        const todayStockOutQty = todayStockOuts.reduce((sum, s) => sum + (s.quantity || 0), 0);

        return {
            totalProducts: products.length,
            inventoryValue: this.getTotalInventoryValue(),
            lowStockCount: this.getLowStockProducts().length,
            outOfStockCount: this.getOutOfStockProducts().length,
            pendingPayments: this.getTotalPendingAmount(),
            overduePayments: this.getTotalOverdueAmount(),
            currentStock: totalStock,
            todayPurchase: todayPurchaseQty,
            todayStockOut: todayStockOutQty
        };
    },

    // ============================================
    // NOTIFICATIONS
    // ============================================
    getNotifications() {
        const notifications = [];
        const lowStock = this.getLowStockProducts();
        const outOfStock = this.getOutOfStockProducts();
        const overdue = this.getOverduePurchases();

        lowStock.forEach(p => {
            notifications.push({
                type: 'warning',
                icon: 'fas fa-exclamation-triangle',
                message: `${p.name} is low on stock (${p.currentStock} ${p.unit} remaining)`,
                time: 'Low Stock Alert'
            });
        });

        outOfStock.forEach(p => {
            notifications.push({
                type: 'danger',
                icon: 'fas fa-times-circle',
                message: `${p.name} is out of stock!`,
                time: 'Out of Stock'
            });
        });

        overdue.forEach(p => {
            const supplier = this.getSupplierById(p.supplierId);
            notifications.push({
                type: 'danger',
                icon: 'fas fa-calendar-xmark',
                message: `Payment overdue: ${supplier ? supplier.name : 'Unknown'} - ${this.formatCurrency(p.dueAmount)}`,
                time: `Due: ${this.formatDate(p.dueDate)}`
            });
        });

        return notifications;
    },

    // ============================================
    // DATE RANGE HELPERS
    // ============================================
    getDateRange(range) {
        const today = new Date();
        const ist = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        let fromDate, toDate;

        switch (range) {
            case 'today':
                fromDate = new Date(ist);
                toDate = new Date(ist);
                break;
            case 'yesterday':
                fromDate = new Date(ist);
                fromDate.setDate(fromDate.getDate() - 1);
                toDate = new Date(fromDate);
                break;
            case 'week':
                fromDate = new Date(ist);
                fromDate.setDate(fromDate.getDate() - 7);
                toDate = new Date(ist);
                break;
            case 'month':
                fromDate = new Date(ist.getFullYear(), ist.getMonth(), 1);
                toDate = new Date(ist);
                break;
            case 'year':
                fromDate = new Date(ist.getFullYear(), 0, 1);
                toDate = new Date(ist);
                break;
            default:
                fromDate = new Date(ist);
                toDate = new Date(ist);
        }

        return {
            from: fromDate.toISOString().split('T')[0],
            to: toDate.toISOString().split('T')[0]
        };
    },

    getPreviousDateRange(range) {
        const today = new Date();
        const ist = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        let fromDate, toDate;

        switch (range) {
            case 'today':
                fromDate = new Date(ist);
                fromDate.setDate(fromDate.getDate() - 1);
                toDate = new Date(fromDate);
                break;
            case 'yesterday':
                fromDate = new Date(ist);
                fromDate.setDate(fromDate.getDate() - 2);
                toDate = new Date(fromDate);
                break;
            case 'week':
                fromDate = new Date(ist);
                fromDate.setDate(fromDate.getDate() - 14);
                toDate = new Date(ist);
                toDate.setDate(toDate.getDate() - 7);
                break;
            case 'month':
                fromDate = new Date(ist.getFullYear(), ist.getMonth() - 1, 1);
                toDate = new Date(ist.getFullYear(), ist.getMonth(), 0);
                break;
            case 'year':
                fromDate = new Date(ist.getFullYear() - 1, 0, 1);
                toDate = new Date(ist.getFullYear() - 1, 11, 31);
                break;
            default:
                fromDate = new Date(ist);
                toDate = new Date(ist);
        }

        return {
            from: fromDate.toISOString().split('T')[0],
            to: toDate.toISOString().split('T')[0]
        };
    },

    // ============================================
    // FILTERED DATA BY DATE RANGE
    // ============================================
    getPurchasesByDateRange(from, to) {
        return this.getPurchases().filter(p => p.date >= from && p.date <= to);
    },

    getStockOutsByDateRange(from, to) {
        return this.getStockOuts().filter(s => s.date >= from && s.date <= to);
    },

    getPaymentsByDateRange(from, to) {
        return this.getPayments().filter(p => p.date >= from && p.date <= to);
    },

    // ============================================
    // FILTERED DASHBOARD STATS
    // ============================================
    getFilteredStats(from, to) {
        const purchases = this.getPurchasesByDateRange(from, to);
        const stockouts = this.getStockOutsByDateRange(from, to);
        const payments = this.getPaymentsByDateRange(from, to);

        const totalPurchaseAmount = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
        const totalPurchaseQty = purchases.reduce((s, p) => {
            return s + (p.products || []).reduce((qs, i) => qs + (i.quantity || 0), 0);
        }, 0);
        const totalStockOutQty = stockouts.reduce((s, so) => s + (so.quantity || 0), 0);
        const totalPaymentsAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);

        const pendingAmount = purchases
            .filter(p => p.dueAmount > 0)
            .reduce((s, p) => s + (p.dueAmount || 0), 0);

        return {
            purchaseCount: purchases.length,
            purchaseAmount: totalPurchaseAmount,
            purchaseQty: totalPurchaseQty,
            stockOutCount: stockouts.length,
            stockOutQty: totalStockOutQty,
            paymentCount: payments.length,
            paymentAmount: totalPaymentsAmount,
            pendingAmount: pendingAmount
        };
    },

    // ============================================
    // CHART DATA
    // ============================================
    getCategoryDistribution() {
        const products = this.getProducts();
        const categories = {};

        products.forEach(p => {
            const cat = p.category || 'Uncategorized';
            if (!categories[cat]) {
                categories[cat] = {
                    count: 0,
                    value: 0
                };
            }
            categories[cat].count++;
            categories[cat].value += (p.currentStock || 0) * (p.purchasePrice || 0);
        });

        return Object.keys(categories).map(cat => ({
            category: cat,
            count: categories[cat].count,
            value: categories[cat].value
        }));
    },

    getTopProductsByValue(limit = 5) {
        const products = this.getProducts()
            .map(p => ({
                ...p,
                totalValue: (p.currentStock || 0) * (p.purchasePrice || 0)
            }))
            .filter(p => p.totalValue > 0)
            .sort((a, b) => b.totalValue - a.totalValue)
            .slice(0, limit);
        return products;
    },

    getPurchaseTrendData(days = 30) {
        const trends = [];
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now.getTime() + istOffset - (now.getTimezoneOffset() * 60 * 1000));
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const dayPurchases = this.getPurchases().filter(p => p.date === dateStr);
            const totalAmount = dayPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
            const totalQty = dayPurchases.reduce((s, p) => {
                return s + (p.products || []).reduce((qs, i) => qs + (i.quantity || 0), 0);
            }, 0);

            const dayStockOuts = this.getStockOuts().filter(s => s.date === dateStr);
            const stockOutQty = dayStockOuts.reduce((s, so) => s + (so.quantity || 0), 0);

            trends.push({
                date: dateStr,
                label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                amount: totalAmount,
                quantity: totalQty,
                stockOut: stockOutQty
            });
        }

        return trends;
    }

};