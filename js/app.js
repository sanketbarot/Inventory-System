/* ============================================
   APP.JS - Global Shared Functions
   With Authentication & Indian Time
   ============================================ */

// Sync across tabs/windows in real-time
window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('inv_')) {
        window.dispatchEvent(new CustomEvent('storage-update', { detail: { key: e.key } }));
    }
});

// ── Auth Check on Page Load ──
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!Storage.checkAuth()) return;

    injectBrandAndWidgets();
    initSidebar();
    initNotifications();
    initUserProfile();
    initIndianTimeClock();
    initLogout();
});

function injectBrandAndWidgets() {
    // Insert Header Widgets (Live Simulator Toggle only)
    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
        // Prevent duplicate insertion
        if (!document.getElementById('headerWidgets')) {
            const widgetsContainer = document.createElement('div');
            widgetsContainer.className = 'header-widgets';
            widgetsContainer.id = 'headerWidgets';

            // Live Simulator Toggle HTML
            const simWidget = document.createElement('div');
            simWidget.className = 'sim-widget';
            simWidget.id = 'headerSimToggle';
            simWidget.title = 'Toggle Live Orders Simulation';
            simWidget.innerHTML = `
                <div class="sim-pulse"></div>
                <span class="sim-label">Live Sim</span>
            `;
            simWidget.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.LiveSimulator) {
                    window.LiveSimulator.toggle();
                } else {
                    console.error('LiveSimulator not loaded');
                }
            });

            widgetsContainer.appendChild(simWidget);

            // Insert before notification button
            const notifBtn = document.getElementById('notificationBtn');
            if (notifBtn) {
                headerRight.insertBefore(widgetsContainer, notifBtn);
            } else {
                headerRight.appendChild(widgetsContainer);
            }

            // Sync simulator button initial state if simulator is active
            if (window.LiveSimulator && window.LiveSimulator.isActive) {
                simWidget.classList.add('active');
                simWidget.querySelector('.sim-label').textContent = 'Sim Active';
            }
        }
    }
}

// ── Initialize User Profile ──
function initUserProfile() {
    const user = Storage.getCurrentUser();
    if (!user) return;

    // Update user name in header
    const userNameEl = document.querySelector('.user-name');
    if (userNameEl) {
        userNameEl.textContent = user.name;
    }

    // Update user role in header
    const userRoleEl = document.querySelector('.user-role');
    if (userRoleEl) {
        userRoleEl.textContent = user.role;
    }

    // Update avatar
    const avatarEl = document.querySelector('.avatar');
    if (avatarEl) {
        if (user.avatar) {
            avatarEl.innerHTML = `<div class="profile-avatar-circle" style="width: 32px; height: 32px; border-radius: 50%; background: var(--purple-light); color: var(--purple); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">${user.avatar}</div>`;
        }
    }

    // Update welcome message
    const welcomeEl = document.querySelector('.welcome-section h1');
    if (welcomeEl) {
        const hour = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
        let greeting = 'Good Morning';
        if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
        else if (hour >= 17 && hour < 21) greeting = 'Good Evening';
        else if (hour >= 21 || hour < 5) greeting = 'Good Night';

        // Slice to get the first name (e.g. "Sanket")
        const firstName = user.name.split(' ')[0];
        welcomeEl.textContent = `${greeting}, ${firstName}! 🖐️`;
    }

    // Inject Sidebar Profile Card
    const sidebarProfileWrapper = document.querySelector('.sidebar-profile-wrapper');
    if (sidebarProfileWrapper) {
        const email = user.username === 'admin' ? 'sanketbarot2901@gmail.com' : user.username + '@crustchilly.com';
        sidebarProfileWrapper.innerHTML = `
            <div class="sidebar-profile">
                <div class="profile-user-details">
                    <div class="profile-avatar">${user.avatar || 'S'}</div>
                    <div class="profile-info">
                        <span class="profile-name">${user.name}</span>
                        <span class="profile-email" title="${email}">${email}</span>
                    </div>
                </div>
                <button class="profile-signout" onclick="Storage.logout()">
                    <i class="fas fa-sign-out-alt"></i> Sign Out
                </button>
            </div>
        `;
    }
}

// ── Indian Time Clock ──
function initIndianTimeClock() {
    // Add time display to header if it exists
    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
        const timeEl = document.createElement('div');
        timeEl.className = 'header-clock';
        timeEl.innerHTML = `
            <div class="clock-time" id="headerClock">--:--</div>
            <div class="clock-date" id="headerDate">--</div>
        `;
        headerRight.insertBefore(timeEl, headerRight.firstChild);

        updateHeaderClock();
        setInterval(updateHeaderClock, 1000);
    }
}

function updateHeaderClock() {
    const clockEl = document.getElementById('headerClock');
    const dateEl = document.getElementById('headerDate');

    if (clockEl) {
        clockEl.textContent = new Date().toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).toUpperCase();
    }

    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }
}

// ── Logout ──
function initLogout() {
    // Add logout button to user profile
    const userProfile = document.querySelector('.user-profile');
    if (userProfile) {
        userProfile.style.cursor = 'pointer';
        userProfile.title = 'Click to logout';

        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'user-dropdown';
        dropdown.id = 'userDropdown';
        dropdown.innerHTML = `
            <div class="dropdown-header">
                <div class="dropdown-avatar">${Storage.getCurrentUser()?.avatar || '👤'}</div>
                <div class="dropdown-info">
                    <strong>${Storage.getCurrentUser()?.name || 'User'}</strong>
                    <span>${Storage.getCurrentUser()?.role || 'Staff'}</span>
                </div>
            </div>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" onclick="openActivityLog()">
                <i class="fas fa-history"></i> Activity Log
            </button>
            <button class="dropdown-item" onclick="openDailySummary()">
                <i class="fas fa-calendar-day"></i> Daily Summary
            </button>
            <button class="dropdown-item" onclick="openChangePassword()">
                <i class="fas fa-key"></i> Change Password
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item logout" onclick="Storage.logout()">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        `;

        userProfile.style.position = 'relative';
        userProfile.appendChild(dropdown);

        userProfile.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });

        document.addEventListener('click', () => {
            dropdown.classList.remove('active');
        });
    }
}

// ── Sidebar Toggle ──
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
            sidebarOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    function closeSidebar() {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
}

// ── Notification Panel ──
function initNotifications() {
    const notifBtn = document.getElementById('notificationBtn');
    const notifPanel = document.getElementById('notificationPanel');
    const notifClose = document.getElementById('notifClose');
    const notifBadge = document.getElementById('notifBadge');
    const notifBody = document.getElementById('notifBody');

    function loadNotifications() {
        const notifications = Storage.getNotifications();
        notifBadge.textContent = notifications.length;
        notifBadge.style.display = notifications.length > 0 ? 'flex' : 'none';

        if (notifications.length === 0) {
            notifBody.innerHTML = '<p class="empty-notif">No notifications 🎉</p>';
            return;
        }

        notifBody.innerHTML = notifications.map(n => `
            <div class="notif-item">
                <div class="notif-icon ${n.type}">
                    <i class="${n.icon}"></i>
                </div>
                <div class="notif-text">
                    <p>${n.message}</p>
                    <span>${n.time}</span>
                </div>
            </div>
        `).join('');
    }

    loadNotifications();

    window.addEventListener('storage-update', () => {
        loadNotifications();
    });

    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            notifPanel.classList.toggle('active');
            loadNotifications();
        });
    }

    if (notifClose) {
        notifClose.addEventListener('click', () => {
            notifPanel.classList.remove('active');
        });
    }

    document.addEventListener('click', (e) => {
        if (notifPanel && !notifPanel.contains(e.target) && notifBtn && !notifBtn.contains(e.target)) {
            notifPanel.classList.remove('active');
        }
    });

    loadNotifications();
}

// ── Toast Notifications ──
function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="${icons[type]}"></i>
        <span>${message}</span>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));

    setTimeout(() => removeToast(toast), 3500);
}

function removeToast(toast) {
    toast.style.animation = 'toastSlideOut 0.3s ease forwards';
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
}

// ── Modal Helper ──
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ── Badge Helpers ──
function getStockStatusBadge(product) {
    if (product.currentStock <= 0) {
        return '<span class="badge-status badge-out-of-stock">Out of Stock</span>';
    } else if (product.currentStock <= product.minimumStock) {
        return '<span class="badge-status badge-low-stock">Low Stock</span>';
    }
    return '<span class="badge-status badge-in-stock">In Stock</span>';
}

function getPaymentStatusBadge(purchase) {
    const today = Storage.getToday();
    if (purchase.dueAmount <= 0) {
        return '<span class="badge-status badge-paid">Paid</span>';
    } else if (purchase.dueDate && purchase.dueDate < today) {
        return '<span class="badge-status badge-overdue">Overdue</span>';
    }
    return '<span class="badge-status badge-pending">Pending</span>';
}

// ── URL Parameters ──
function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// ============================================
// ACTIVITY LOG MODAL
// ============================================
function openActivityLog() {
    const logs = Storage.getActivityLogs(null, 100);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'activityLogModal';

    const activityIcons = {
        login: 'fas fa-sign-in-alt',
        logout: 'fas fa-sign-out-alt',
        product_add: 'fas fa-plus-circle',
        product_update: 'fas fa-edit',
        product_delete: 'fas fa-trash',
        purchase: 'fas fa-cart-plus',
        stockout: 'fas fa-dolly',
        stockout_delete: 'fas fa-undo',
        payment: 'fas fa-money-bill-wave',
        supplier_add: 'fas fa-truck',
        supplier_update: 'fas fa-edit',
        supplier_delete: 'fas fa-trash',
        login_failed: 'fas fa-exclamation-triangle'
    };

    const activityColors = {
        login: 'info',
        logout: 'warning',
        product_add: 'success',
        product_update: 'info',
        product_delete: 'danger',
        purchase: 'success',
        stockout: 'warning',
        stockout_delete: 'info',
        payment: 'success',
        supplier_add: 'success',
        supplier_update: 'info',
        supplier_delete: 'danger',
        login_failed: 'danger'
    };

    let logsHTML = '';
    if (logs.length === 0) {
        logsHTML = '<p class="empty-notif">No activity recorded yet</p>';
    } else {
        logsHTML = logs.map(log => `
            <div class="notif-item">
                <div class="notif-icon ${activityColors[log.type] || 'info'}">
                    <i class="${activityIcons[log.type] || 'fas fa-circle'}"></i>
                </div>
                <div class="notif-text">
                    <p>${log.message}</p>
                    <span>🕐 ${log.time} | 📅 ${Storage.formatDate(log.date)} | 👤 ${log.userName}</span>
                </div>
            </div>
        `).join('');
    }

    modal.innerHTML = `
        <div class="modal glass-modal modal-large">
            <div class="modal-header">
                <h2><i class="fas fa-history" style="color: var(--purple);"></i> Activity Log</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove(); document.body.style.overflow='';">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
                <div class="time-display" style="background: rgba(255,255,255,0.4); border-radius: 15px; padding: 10px; margin-bottom: 15px; text-align: center;">
                    <span style="font-size: 12px; color: var(--text-muted);">🇮🇳 All times are in Indian Standard Time (IST - UTC+5:30)</span>
                </div>
                ${logsHTML}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

// ============================================
// DAILY SUMMARY MODAL
// ============================================
function openDailySummary() {
    const today = Storage.getToday();
    const summary = Storage.getDailySummary(today);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'dailySummaryModal';

    modal.innerHTML = `
        <div class="modal glass-modal modal-large">
            <div class="modal-header">
                <h2><i class="fas fa-calendar-day" style="color: var(--purple);"></i> Today's Summary</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove(); document.body.style.overflow='';">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 10px; background: rgba(167,139,250,0.08); border-radius: 15px; margin-bottom: 20px;">
                    <div style="font-size: 18px; font-weight: 700; color: var(--text-dark);">
                        📅 ${Storage.getIndianDateFormatted()}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted);">
                        🇮🇳 Indian Standard Time (IST)
                    </div>
                </div>

                <div class="stats-grid" style="margin-bottom: 20px;">
                    <div class="stat-card stat-products">
                        <div class="stat-icon"><i class="fas fa-cart-plus"></i></div>
                        <div class="stat-info">
                            <h3>${summary.purchases.count}</h3>
                            <p>Purchases (${Storage.formatCurrency(summary.purchases.totalAmount)})</p>
                        </div>
                    </div>
                    <div class="stat-card stat-out">
                        <div class="stat-icon"><i class="fas fa-dolly"></i></div>
                        <div class="stat-info">
                            <h3>${summary.stockOuts.count}</h3>
                            <p>Stock Out (${summary.stockOuts.totalQuantity} items)</p>
                        </div>
                    </div>
                    <div class="stat-card stat-value">
                        <div class="stat-icon"><i class="fas fa-money-bill-wave"></i></div>
                        <div class="stat-info">
                            <h3>${summary.payments.count}</h3>
                            <p>Payments (${Storage.formatCurrency(summary.payments.totalAmount)})</p>
                        </div>
                    </div>
                    <div class="stat-card stat-pending">
                        <div class="stat-icon"><i class="fas fa-list"></i></div>
                        <div class="stat-info">
                            <h3>${summary.activities.length}</h3>
                            <p>Activities</p>
                        </div>
                    </div>
                </div>

                <h3 style="font-size: 14px; color: var(--text-dark); margin-bottom: 10px;">
                    <i class="fas fa-history" style="color: var(--purple);"></i> Today's Activities
                </h3>
                <div style="max-height: 300px; overflow-y: auto;">
                    ${summary.activities.length === 0
                        ? '<p class="empty-notif">No activities today</p>'
                        : summary.activities.map(log => `
                            <div class="notif-item">
                                <div class="notif-text">
                                    <p>${log.message}</p>
                                    <span>🕐 ${log.time}</span>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

// ============================================
// CHANGE PASSWORD
// ============================================
function openChangePassword() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'changePasswordModal';

    modal.innerHTML = `
        <div class="modal glass-modal modal-small">
            <div class="modal-header">
                <h2><i class="fas fa-key" style="color: var(--purple);"></i> Change Password</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove(); document.body.style.overflow='';">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Current Password</label>
                    <input type="password" id="currentPassword" placeholder="Enter current password">
                </div>
                <div class="form-group">
                    <label>New Password</label>
                    <input type="password" id="newPassword" placeholder="Enter new password">
                </div>
                <div class="form-group">
                    <label>Confirm New Password</label>
                    <input type="password" id="confirmNewPassword" placeholder="Confirm new password">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove(); document.body.style.overflow='';">Cancel</button>
                <button class="btn btn-primary" onclick="changePassword()">Change Password</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function changePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmNewPassword').value;

    if (!current || !newPass || !confirm) {
        showToast('Please fill all fields', 'error');
        return;
    }

    if (newPass !== confirm) {
        showToast('New passwords do not match', 'error');
        return;
    }

    if (newPass.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    const user = Storage.getCurrentUser();
    const users = JSON.parse(localStorage.getItem('inv_users') || '[]');
    const userIndex = users.findIndex(u => u.username === user.username);

    if (userIndex === -1) {
        showToast('User not found', 'error');
        return;
    }

    if (users[userIndex].password !== current) {
        showToast('Current password is incorrect', 'error');
        return;
    }

    users[userIndex].password = newPass;
    localStorage.setItem('inv_users', JSON.stringify(users));

    Storage.logActivity('password_change', 'Password changed');

    const modal = document.getElementById('changePasswordModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }

    showToast('Password changed successfully!', 'success');
}