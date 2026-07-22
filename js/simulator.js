/* ============================================
   SIMULATOR.JS - Crust & Chilly Live Simulator
   Simulates live sales and stock deliveries
   ============================================ */

const LiveSimulator = {
    intervalId: null,
    isActive: false,
    speedMs: 12000, // 12 seconds per transaction

    // Raw Ingredient mapping for menu items
    MENU_ITEMS: [
        {
            name: 'Classic Margherita Pizza 🍕',
            ingredients: [
                { id: 'PRD_dough', qty: 1, name: 'Fresh Pizza Dough' },
                { id: 'PRD_cheese', qty: 0.15, name: 'Mozzarella Cheese' },
                { id: 'PRD_sauce', qty: 0.10, name: 'Pizza Sauce' }
            ]
        },
        {
            name: 'Spicy Pepperoni Pizza 🍕🔥',
            ingredients: [
                { id: 'PRD_dough', qty: 1, name: 'Fresh Pizza Dough' },
                { id: 'PRD_cheese', qty: 0.12, name: 'Mozzarella Cheese' },
                { id: 'PRD_sauce', qty: 0.10, name: 'Pizza Sauce' },
                { id: 'PRD_pep', qty: 0.10, name: 'Pepperoni Slices' }
            ]
        },
        {
            name: 'Chilly Spiced Paneer Pizza 🍕🌶️',
            ingredients: [
                { id: 'PRD_dough', qty: 1, name: 'Fresh Pizza Dough' },
                { id: 'PRD_cheese', qty: 0.12, name: 'Mozzarella Cheese' },
                { id: 'PRD_sauce', qty: 0.10, name: 'Pizza Sauce' },
                { id: 'PRD_paneer', qty: 0.12, name: 'Diced Paneer' },
                { id: 'PRD_jalapeno', qty: 0.05, name: 'Fresh Jalapenos' }
            ]
        },
        {
            name: 'Vanilla Gelato Scoop 🍨',
            ingredients: [
                { id: 'PRD_vgelato', qty: 0.20, name: 'Vanilla Bean Gelato' }
            ]
        },
        {
            name: 'Spicy Chilli Gelato Scoop 🍨🌶️',
            ingredients: [
                { id: 'PRD_cgelato', qty: 0.20, name: 'Spicy Chilli Gelato' },
                { id: 'PRD_flakes', qty: 0.01, name: 'Red Chilli Flakes' }
            ]
        },
        {
            name: 'Chilli Guava Cooler 🍹',
            ingredients: [
                { id: 'PRD_guava', qty: 0.15, name: 'Chilli Guava Syrup' }
            ]
        }
    ],

    init() {
        // Read persisted simulator state from session storage
        const savedState = sessionStorage.getItem('inv_sim_active') === 'true';
        if (savedState) {
            this.start();
        }
        
        // Listen for storage-update to sync header button status if changed in other tab
        window.addEventListener('storage-update', (e) => {
            if (e.detail && e.detail.key === 'inv_sim_state') {
                const globalState = localStorage.getItem('inv_sim_state') === 'true';
                if (globalState && !this.isActive) {
                    this.start(true);
                } else if (!globalState && this.isActive) {
                    this.stop(true);
                }
            }
        });
    },

    toggle() {
        if (this.isActive) {
            this.stop();
        } else {
            this.start();
        }
    },

    start(skipSync = false) {
        if (this.isActive) return;
        this.isActive = true;
        sessionStorage.setItem('inv_sim_active', 'true');
        if (!skipSync) {
            localStorage.setItem('inv_sim_state', 'true');
            window.dispatchEvent(new CustomEvent('storage-update', { detail: { key: 'inv_sim_state' } }));
        }

        // Set up execution interval
        let actionCounter = 0;
        this.intervalId = setInterval(() => {
            actionCounter++;
            // 75% chance of sale, 25% chance of purchase, or force purchase if low stock alert
            if (actionCounter % 4 === 0 || this.hasUrgentLowStock()) {
                this.executePurchase();
            } else {
                this.executeSale();
            }
        }, this.speedMs);

        // Update UI components
        this.updateUI();
        if (typeof showToast === 'function') {
            showToast('Crust & Chilly Live Simulator started!', 'success');
        }
    },

    stop(skipSync = false) {
        if (!this.isActive) return;
        this.isActive = false;
        sessionStorage.setItem('inv_sim_active', 'false');
        if (!skipSync) {
            localStorage.setItem('inv_sim_state', 'false');
            window.dispatchEvent(new CustomEvent('storage-update', { detail: { key: 'inv_sim_state' } }));
        }

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.updateUI();
        if (typeof showToast === 'function') {
            showToast('Live Simulator stopped.', 'info');
        }
    },

    updateUI() {
        const widgets = document.querySelectorAll('.sim-widget');
        widgets.forEach(w => {
            if (this.isActive) {
                w.classList.add('active');
                const label = w.querySelector('.sim-label');
                if (label) label.textContent = 'Sim Active';
            } else {
                w.classList.remove('active');
                const label = w.querySelector('.sim-label');
                if (label) label.textContent = 'Live Sim';
            }
        });
    },

    hasUrgentLowStock() {
        const products = Storage.getProducts();
        return products.some(p => p.currentStock <= p.minimumStock);
    },

    executeSale() {
        // Pick random menu item
        const menuItem = this.MENU_ITEMS[Math.floor(Math.random() * this.MENU_ITEMS.length)];
        const products = Storage.getProducts();
        
        // Verify ingredients stock levels
        let canSell = true;
        let missingIng = '';

        for (const ing of menuItem.ingredients) {
            const p = products.find(prod => prod.id === ing.id);
            if (!p || p.currentStock < ing.qty) {
                canSell = false;
                missingIng = ing.name;
                break;
            }
        }

        if (!canSell) {
            if (typeof showToast === 'function') {
                showToast(`Sale Skipped: ${menuItem.name} ordered but out of ${missingIng}!`, 'error');
            }
            // Auto order ingredients that are out of stock
            this.triggerRestockForIngredient(menuItem.ingredients.find(ing => ing.name === missingIng)?.id);
            return;
        }

        // Deduct ingredients and save transaction logs
        for (const ing of menuItem.ingredients) {
            Storage.saveStockOut({
                productId: ing.id,
                quantity: ing.qty,
                date: Storage.getToday(),
                reason: `Live Sale: Consumed for ${menuItem.name}`
            });
        }

        if (typeof showToast === 'function') {
            showToast(`🍕 Live Order: 1x ${menuItem.name} prepared & sold!`, 'success');
        }
    },

    executePurchase() {
        const products = Storage.getProducts();
        
        // Prioritize restocking low stock items
        let targetProduct = products.find(p => p.currentStock <= p.minimumStock);
        
        // If nothing is low, pick a random product
        if (!targetProduct) {
            targetProduct = products[Math.floor(Math.random() * products.length)];
        }

        if (!targetProduct) return;

        // Generate restock quantity
        let qty = 10;
        if (targetProduct.unit === 'Pieces') qty = 50;
        if (targetProduct.unit === 'Litre') qty = 20;

        const totalAmount = qty * targetProduct.purchasePrice;
        const invoiceNo = `INV-SIM-${Date.now().toString().slice(-4)}`;

        const purchase = {
            invoiceNo: invoiceNo,
            supplierId: targetProduct.supplierId || 'SUP_dairy',
            date: Storage.getToday(),
            totalAmount: totalAmount,
            paidAmount: totalAmount,
            dueAmount: 0,
            status: 'paid',
            products: [
                { productId: targetProduct.id, quantity: qty, price: targetProduct.purchasePrice }
            ]
        };

        Storage.savePurchase(purchase);

        if (typeof showToast === 'function') {
            showToast(`🚚 Live Delivery: Restocked ${qty} ${targetProduct.unit} of ${targetProduct.name}!`, 'success');
        }
    },

    triggerRestockForIngredient(prodId) {
        if (!prodId) return;
        const products = Storage.getProducts();
        const product = products.find(p => p.id === prodId);
        if (!product) return;

        let qty = 15;
        if (product.unit === 'Pieces') qty = 60;
        if (product.unit === 'Litre') qty = 25;

        const totalAmt = qty * product.purchasePrice;
        const invoiceNo = `INV-SIM-AUTO-${Date.now().toString().slice(-4)}`;

        const purchase = {
            invoiceNo: invoiceNo,
            supplierId: product.supplierId || 'SUP_dairy',
            date: Storage.getToday(),
            totalAmount: totalAmt,
            paidAmount: totalAmt,
            dueAmount: 0,
            status: 'paid',
            products: [
                { productId: product.id, quantity: qty, price: product.purchasePrice }
            ]
        };

        Storage.savePurchase(purchase);
    }
};

window.LiveSimulator = LiveSimulator;

// Initialize simulator when script is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (localStorage.getItem('inv_session') || sessionStorage.getItem('inv_session')) {
        LiveSimulator.init();
    }
});
