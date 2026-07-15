/* ============================================
   INVENTORY.JS - Products Management
   ============================================ */

let deleteProductId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadCategoryFilter();
    initInventoryEvents();

    // Check URL params
    if (getUrlParam('action') === 'add') {
        openAddProductModal();
    }
});

function initInventoryEvents() {
    // Add Product
    document.getElementById('addProductBtn').addEventListener('click', openAddProductModal);

    // Save Product
    document.getElementById('saveProduct').addEventListener('click', saveProduct);

    // Cancel / Close Modal
    document.getElementById('cancelProduct').addEventListener('click', () => closeModal('productModal'));
    document.getElementById('closeProductModal').addEventListener('click', () => closeModal('productModal'));

    // Delete Modal
    document.getElementById('closeDeleteModal').addEventListener('click', () => closeModal('deleteModal'));
    document.getElementById('cancelDelete').addEventListener('click', () => closeModal('deleteModal'));
    document.getElementById('confirmDelete').addEventListener('click', confirmDeleteProduct);

    // Search
    document.getElementById('productSearch').addEventListener('input', filterProducts);

    // Filters
    document.getElementById('categoryFilter').addEventListener('change', filterProducts);
    document.getElementById('statusFilter').addEventListener('change', filterProducts);
}

function loadProducts() {
    const tbody = document.getElementById('productsTableBody');
    const products = Storage.getProducts();

    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <p>No products added yet</p>
                </td>
            </tr>
        `;
        return;
    }

    renderProducts(products);
}

function renderProducts(products) {
    const tbody = document.getElementById('productsTableBody');

    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>No products found</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = products.map(p => {
        const supplier = p.supplierId ? Storage.getSupplierById(p.supplierId) : null;
        return `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.category || '-'}</td>
                <td>${p.unit}</td>
                <td>${p.currentStock || 0}</td>
                <td>${p.minimumStock}</td>
                <td>${Storage.formatCurrency(p.purchasePrice)}</td>
                <td>${supplier ? supplier.name : '-'}</td>
                <td>${getStockStatusBadge(p)}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon edit" onclick="editProduct('${p.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete" onclick="deleteProduct('${p.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterProducts() {
    const search = document.getElementById('productSearch').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;

    let products = Storage.getProducts();

    if (search) {
        products = products.filter(p =>
            p.name.toLowerCase().includes(search) ||
            (p.category && p.category.toLowerCase().includes(search))
        );
    }

    if (category) {
        products = products.filter(p => p.category === category);
    }

    if (status) {
        products = products.filter(p => {
            if (status === 'in-stock') return p.currentStock > p.minimumStock;
            if (status === 'low-stock') return p.currentStock > 0 && p.currentStock <= p.minimumStock;
            if (status === 'out-of-stock') return p.currentStock <= 0;
            return true;
        });
    }

    renderProducts(products);
}

function loadCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    const datalist = document.getElementById('categoryList');
    const categories = Storage.getCategories();

    // Filter select
    let options = '<option value="">All Categories</option>';
    categories.forEach(c => {
        options += `<option value="${c}">${c}</option>`;
    });
    select.innerHTML = options;

    // Datalist for form
    if (datalist) {
        datalist.innerHTML = categories.map(c => `<option value="${c}">`).join('');
    }
}

function loadSupplierDropdown() {
    const select = document.getElementById('productSupplier');
    const suppliers = Storage.getSuppliers();

    let options = '<option value="">Select Supplier</option>';
    suppliers.forEach(s => {
        options += `<option value="${s.id}">${s.name}</option>`;
    });
    select.innerHTML = options;
}

function openAddProductModal() {
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productStock').value = '0';
    document.getElementById('productMinStock').value = '10';
    loadSupplierDropdown();
    openModal('productModal');
}

function editProduct(id) {
    const product = Storage.getProductById(id);
    if (!product) return;

    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category || '';
    document.getElementById('productUnit').value = product.unit;
    document.getElementById('productStock').value = product.currentStock || 0;
    document.getElementById('productMinStock').value = product.minimumStock;
    document.getElementById('productPrice').value = product.purchasePrice;

    loadSupplierDropdown();
    document.getElementById('productSupplier').value = product.supplierId || '';

    openModal('productModal');
}

function saveProduct() {
    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value.trim();
    const unit = document.getElementById('productUnit').value;
    const stock = parseInt(document.getElementById('productStock').value) || 0;
    const minStock = parseInt(document.getElementById('productMinStock').value) || 0;
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    const supplier = document.getElementById('productSupplier').value;

    if (!name || !unit || !category) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    const product = {
        id: document.getElementById('productId').value || null,
        name,
        category,
        unit,
        currentStock: stock,
        minimumStock: minStock,
        purchasePrice: price,
        supplierId: supplier || null,
        status: 'active'
    };

    const isEdit = !!product.id;
    Storage.saveProduct(product);

    closeModal('productModal');
    loadProducts();
    loadCategoryFilter();
    showToast(`Product ${isEdit ? 'updated' : 'added'} successfully!`, 'success');
}

function deleteProduct(id) {
    const product = Storage.getProductById(id);
    if (!product) return;

    deleteProductId = id;
    document.getElementById('deleteProductName').textContent = product.name;
    openModal('deleteModal');
}

function confirmDeleteProduct() {
    if (deleteProductId) {
        Storage.deleteProduct(deleteProductId);
        deleteProductId = null;
        closeModal('deleteModal');
        loadProducts();
        loadCategoryFilter();
        showToast('Product deleted successfully!', 'success');
    }
}