/* ============================================
   SETTINGS.JS - Settings Management Panel
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    if (!Storage.checkAuth()) return;

    initThemeSelector();
    initFirebaseConfigForm();
    listenToFirebaseLogs();
    initBackupRestore();
});

// ============================================
// THEME SELECTOR
// ============================================
function initThemeSelector() {
    const themeCards = document.querySelectorAll('.theme-card');
    const currentTheme = localStorage.getItem('inv_theme') || 'sunset';

    // Highlight current active theme card
    themeCards.forEach(card => {
        if (card.dataset.theme === currentTheme) {
            card.classList.add('active');
        }

        card.addEventListener('click', function () {
            themeCards.forEach(c => c.classList.remove('active'));
            this.classList.add('active');

            const selectedTheme = this.dataset.theme;
            
            // Set local storage and apply class to documentElement
            localStorage.setItem('inv_theme', selectedTheme);
            applyThemeClass(selectedTheme);
            
            showToast(`Theme changed to ${this.querySelector('span').textContent}!`, 'success');
        });
    });
}

function applyThemeClass(theme) {
    // Remove all previous theme classes
    document.documentElement.className = '';
    
    if (theme !== 'sunset') {
        document.documentElement.classList.add(`theme-${theme}`);
    }
}

// ============================================
// FIREBASE CONFIGURATION FORM
// ============================================
function initFirebaseConfigForm() {
    const syncToggle = document.getElementById('firebaseSyncToggle');
    const configForm = document.getElementById('firebaseConfigForm');
    const testBtn = document.getElementById('testFirebaseBtn');
    const statusBadge = document.getElementById('syncStatusBadge');
    
    // Load existing settings
    const enabled = localStorage.getItem('inv_firebase_enabled') === 'true';
    syncToggle.checked = enabled;
    
    // Default Firebase configuration
    let config = {
        apiKey: "AIzaSyBd8DDduHxJhANfDSS6ZfdXsdzipTMmg5Y",
        authDomain: "inventory-system-421c9.firebaseapp.com",
        projectId: "inventory-system-421c9",
        storageBucket: "inventory-system-421c9.firebasestorage.app",
        messagingSenderId: "683808185075",
        appId: "1:683808185075:web:42ff90eaa54bbf0caef586"
    };
    
    const configStr = localStorage.getItem('inv_firebase_config');
    if (configStr) {
        try {
            config = JSON.parse(configStr);
        } catch (e) {
            console.error('Error reading saved Firebase configuration', e);
        }
    } else {
        // Automatically save the user's config as default
        localStorage.setItem('inv_firebase_config', JSON.stringify(config));
    }

    // Populate inputs
    document.getElementById('fbApiKey').value = config.apiKey || '';
    document.getElementById('fbAuthDomain').value = config.authDomain || '';
    document.getElementById('fbProjectId').value = config.projectId || '';
    document.getElementById('fbStorageBucket').value = config.storageBucket || '';
    document.getElementById('fbMessagingSenderId').value = config.messagingSenderId || '';
    document.getElementById('fbAppId').value = config.appId || '';

    updateConnectionStatusBadge();

    // Toggle listener
    syncToggle.addEventListener('change', function () {
        const isChecked = this.checked;

        if (!isChecked) {
            localStorage.setItem('inv_firebase_enabled', 'false');
            FirebaseSync.stopSync();
            updateConnectionStatusBadge();
            showToast('Firebase Cloud Sync disabled.', 'info');
        } else {
            // Save configuration before starting
            saveConfigAndEnable();
        }
    });

    // Form submit listener
    configForm.addEventListener('submit', function (e) {
        e.preventDefault();
        saveConfigAndEnable();
    });

    // Test connection listener
    testBtn.addEventListener('click', async () => {
        const config = getFormConfig();
        if (!config.apiKey || !config.projectId || !config.appId) {
            showToast('Please fill in API Key, Project ID, and App ID to test', 'error');
            return;
        }

        testBtn.disabled = true;
        testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
        FirebaseSync.log('Testing connection with provided credentials...', 'info');

        try {
            await FirebaseSync.loadSDKs();
            
            // Temporary app initialization for testing if not already done
            const testAppName = `testApp_${Date.now()}`;
            const testApp = firebase.initializeApp(config, testAppName);
            const testDb = testApp.firestore();
            
            // Try to perform a mock read/write test
            await testDb.collection('_connection_test_').doc('test').set({
                ping: true,
                timestamp: new Date().toISOString()
            });
            await testDb.collection('_connection_test_').doc('test').delete();
            
            FirebaseSync.log('Database read/write test succeeded!', 'success');
            showToast('Firebase connection test successful!', 'success');
            
            // Clean up test app
            await testApp.delete();
        } catch (err) {
            FirebaseSync.log(`Connection test failed: ${err.message}`, 'error');
            showToast(`Connection failed: ${err.message}`, 'error');
        } finally {
            testBtn.disabled = false;
            testBtn.innerHTML = '<i class="fas fa-plug"></i> Test Connection';
        }
    });

    // Listener for status changes
    window.addEventListener('firebase-status-change', updateConnectionStatusBadge);
}

function getFormConfig() {
    return {
        apiKey: document.getElementById('fbApiKey').value.trim(),
        authDomain: document.getElementById('fbAuthDomain').value.trim(),
        projectId: document.getElementById('fbProjectId').value.trim(),
        storageBucket: document.getElementById('fbStorageBucket').value.trim(),
        messagingSenderId: document.getElementById('fbMessagingSenderId').value.trim(),
        appId: document.getElementById('fbAppId').value.trim()
    };
}

function toggleFormInputs(enabled) {
    // Keep inputs enabled for user entry
}

function saveConfigAndEnable() {
    const config = getFormConfig();
    
    if (!config.apiKey || !config.projectId || !config.appId) {
        showToast('API Key, Project ID, and App ID are required to sync', 'error');
        document.getElementById('firebaseSyncToggle').checked = false;
        return;
    }

    localStorage.setItem('inv_firebase_config', JSON.stringify(config));
    localStorage.setItem('inv_firebase_enabled', 'true');
    document.getElementById('firebaseSyncToggle').checked = true;

    FirebaseSync.log('Firebase Cloud Sync enabled. Initializing...', 'info');
    FirebaseSync.init();
    showToast('Firebase configuration saved & Sync enabled!', 'success');
}

function updateConnectionStatusBadge() {
    const badge = document.getElementById('syncStatusBadge');
    if (!badge) return;

    if (localStorage.getItem('inv_firebase_enabled') !== 'true') {
        badge.className = 'status-badge status-offline';
        badge.innerHTML = '<i class="fas fa-circle-xmark"></i> Sync Disabled';
    } else if (FirebaseSync.isConnected()) {
        badge.className = 'status-badge status-online';
        badge.innerHTML = '<i class="fas fa-cloud-arrow-up"></i> Connected & Synced';
    } else {
        badge.className = 'status-badge status-pending';
        badge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    }
}

// ============================================
// CONSOLE LOGS VISUAL LISTENER
// ============================================
function listenToFirebaseLogs() {
    const consoleEl = document.getElementById('firebaseSyncConsole');
    if (!consoleEl) return;

    // Render historical logs first
    consoleEl.innerHTML = '';
    FirebaseSync.logs.forEach(log => {
        appendLogToConsole(log);
    });

    // Listen to new logs
    window.addEventListener('firebase-log', (e) => {
        appendLogToConsole(e.detail.message, e.detail.type);
    });

    // Clear logs button
    const clearBtn = document.getElementById('clearLogsBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            consoleEl.innerHTML = '<div class="console-placeholder">// Console logs cleared. Waiting for synchronization activity...</div>';
            FirebaseSync.logs = [];
        });
    }
}

function appendLogToConsole(logStr, type = 'info') {
    const consoleEl = document.getElementById('firebaseSyncConsole');
    if (!consoleEl) return;

    // Remove placeholder if present
    const placeholder = consoleEl.querySelector('.console-placeholder');
    if (placeholder) {
        consoleEl.removeChild(placeholder);
    }

    const logDiv = document.createElement('div');
    logDiv.className = `console-line console-line-${type}`;
    logDiv.textContent = logStr;
    consoleEl.appendChild(logDiv);
    
    // Auto-scroll to bottom
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

// ============================================
// BACKUP & RESTORE UTILITIES
// ============================================
function initBackupRestore() {
    const exportBtn = document.getElementById('exportBackupBtn');
    const importInput = document.getElementById('importBackupInput');
    const importDragArea = document.getElementById('importDragArea');
    const importStatusText = document.getElementById('importStatusText');

    if (exportBtn) {
        exportBtn.addEventListener('click', exportBackup);
    }

    if (importInput) {
        importInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                importBackup(file);
            }
        });
    }

    // Drag and drop support
    if (importDragArea) {
        ['dragenter', 'dragover'].forEach(eventName => {
            importDragArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                importDragArea.style.borderColor = 'var(--purple)';
                importDragArea.style.background = 'rgba(255, 255, 255, 0.1)';
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            importDragArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                importDragArea.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                importDragArea.style.background = 'rgba(255, 255, 255, 0.05)';
            }, false);
        });

        importDragArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const file = dt.files[0];
            if (file && file.name.endsWith('.json')) {
                importBackup(file);
            } else {
                showToast('Please upload a valid JSON backup file.', 'error');
            }
        }, false);
    }
}

function exportBackup() {
    const keys = ['inv_products', 'inv_suppliers', 'inv_purchases', 'inv_stockouts', 'inv_payments', 'inv_activity_log', 'inv_users'];
    const backupData = {};
    keys.forEach(key => {
        try {
            backupData[key] = JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) {
            backupData[key] = [];
        }
    });
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Database backup exported successfully!', 'success');
}

function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            const keys = ['inv_products', 'inv_suppliers', 'inv_purchases', 'inv_stockouts', 'inv_payments', 'inv_activity_log', 'inv_users'];
            
            // Check backup structure
            let isValid = false;
            for (const key of keys) {
                if (data.hasOwnProperty(key) && Array.isArray(data[key])) {
                    isValid = true;
                }
            }
            
            if (!isValid) {
                showToast('Invalid backup file format.', 'error');
                return;
            }

            if (confirm('⚠️ WARNING:\n\nImporting this backup will overwrite your current local database. All existing unsaved data will be replaced.\n\nDo you want to proceed?')) {
                // Save backup to storage
                keys.forEach(key => {
                    if (data[key]) {
                        localStorage.setItem(key, JSON.stringify(data[key]));
                        
                        // If connected to Firebase, upload to Firestore in the background
                        if (window.FirebaseSync && FirebaseSync.isConnected()) {
                            FirebaseSync.uploadKey(key, data[key]);
                        }
                    }
                });

                showToast('Database restored successfully!', 'success');
                // Trigger dynamic refresh on all active views
                window.dispatchEvent(new CustomEvent('storage-update'));
            }
        } catch (err) {
            showToast('Failed to parse backup file.', 'error');
        }
    };
    reader.readAsText(file);
}
