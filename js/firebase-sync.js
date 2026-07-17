/* ============================================
   FIREBASE-SYNC.JS - Firebase Cloud Synchronization
   Offline-first bidirectional real-time sync
   ============================================ */

const FirebaseSync = {
    db: null,
    auth: null,
    listeners: {},
    isInitialized: false,
    logs: [],

    // Log messages to the sync console
    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('en-IN', { hour12: false });
        const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
        this.logs.push(logEntry);
        if (this.logs.length > 100) this.logs.shift();
        
        // Dispatch event for UI logs listener
        window.dispatchEvent(new CustomEvent('firebase-log', { detail: { message: logEntry, type } }));
        console.log(logEntry);
    },

    // Check if Firebase sync is enabled in settings
    isEnabled() {
        return localStorage.getItem('inv_firebase_enabled') === 'true';
    },

    // Check if Firebase is fully initialized and connected
    isConnected() {
        return this.isInitialized && this.db !== null;
    },

    // Dynamically load Firebase SDK CDN scripts
    async loadSDKs() {
        if (window.firebase) return;

        this.log('Loading Firebase SDKs...', 'info');
        const sdks = [
            "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js",
            "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js",
            "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"
        ];

        for (const src of sdks) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.async = false;
                script.onload = resolve;
                script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
                document.head.appendChild(script);
            });
        }
        this.log('Firebase SDKs loaded successfully.', 'success');
    },

    // Initialize Firebase
    async init() {
        if (!this.isEnabled()) {
            this.log('Firebase Sync is disabled.', 'info');
            return;
        }

        let configStr = localStorage.getItem('inv_firebase_config');
        if (!configStr) {
            const defaultConfig = {
                apiKey: "AIzaSyBd8DDduHxJhANfDSS6ZfdXsdzipTMmg5Y",
                authDomain: "inventory-system-421c9.firebaseapp.com",
                projectId: "inventory-system-421c9",
                storageBucket: "inventory-system-421c9.firebasestorage.app",
                messagingSenderId: "683808185075",
                appId: "1:683808185075:web:42ff90eaa54bbf0caef586"
            };
            localStorage.setItem('inv_firebase_config', JSON.stringify(defaultConfig));
            configStr = JSON.stringify(defaultConfig);
        }

        try {
            const config = JSON.parse(configStr);
            if (!config.apiKey || !config.projectId || !config.appId) {
                this.log('Invalid Firebase config parameters (API Key, Project ID, or App ID missing).', 'error');
                return;
            }

            await this.loadSDKs();

            // Initialize app if not already initialized
            if (!firebase.apps.length) {
                firebase.initializeApp(config);
            }

            this.db = firebase.firestore();
            this.auth = firebase.auth();
            this.isInitialized = true;
            this.log('Firebase initialized and connected to Firestore.', 'success');

            // Start synchronization
            await this.startSync();
            window.dispatchEvent(new Event('firebase-status-change'));
        } catch (error) {
            this.log(`Firebase initialization error: ${error.message}`, 'error');
            window.dispatchEvent(new Event('firebase-status-change'));
        }
    },

    // Sync configuration mapping: Local Storage Key -> Firestore Collection Name
    getSyncMap() {
        return {
            'inv_products': 'products',
            'inv_suppliers': 'suppliers',
            'inv_purchases': 'purchases',
            'inv_stockouts': 'stockouts',
            'inv_payments': 'payments',
            'inv_activity_log': 'activity_logs',
            'inv_users': 'users'
        };
    },

    // One-time bi-directional merge and start real-time listeners
    async startSync() {
        if (!this.isConnected()) return;

        const syncMap = this.getSyncMap();
        this.log('Starting real-time synchronization...', 'info');

        for (const [localKey, collectionName] of Object.entries(syncMap)) {
            try {
                // 1. Initial Merge
                await this.mergeCollection(localKey, collectionName);

                // 2. Start Real-time listener
                this.listenToCollection(localKey, collectionName);
            } catch (err) {
                this.log(`Failed to sync collection "${collectionName}": ${err.message}`, 'error');
            }
        }

        this.log('All collections are in sync and listening to live updates.', 'success');
    },

    // Unsubscribe all active listeners (useful when disabling sync)
    stopSync() {
        this.log('Stopping Firebase synchronization.', 'info');
        for (const [key, unsubscribe] of Object.entries(this.listeners)) {
            unsubscribe();
        }
        this.listeners = {};
        this.db = null;
        this.auth = null;
        this.isInitialized = false;
        this.log('Firebase listeners stopped.', 'info');
        window.dispatchEvent(new Event('firebase-status-change'));
    },

    // Compare and merge localStorage array and Firestore collection
    async mergeCollection(localKey, collectionName) {
        const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
        const snapshot = await this.db.collection(collectionName).get();
        const firestoreDocs = {};
        
        snapshot.forEach(doc => {
            firestoreDocs[doc.id] = doc.data();
        });

        this.log(`Merging "${collectionName}" (${localData.length} local items, ${snapshot.size} cloud items)`, 'info');

        const localMap = {};
        localData.forEach(item => {
            if (item.id) localMap[item.id] = item;
        });

        let updatedLocal = false;
        const finalMerged = [];

        // Check firestore docs against local docs
        for (const [id, fDoc] of Object.entries(firestoreDocs)) {
            const lDoc = localMap[id];
            if (!lDoc) {
                // Cloud has it, local doesn't
                finalMerged.push(fDoc);
                updatedLocal = true;
            } else {
                // Both have it, resolve conflict by updatedTime / timestamp
                const fTime = new Date(fDoc.updatedAt || fDoc.timestamp || 0).getTime();
                const lTime = new Date(lDoc.updatedAt || lDoc.timestamp || 0).getTime();

                if (fTime > lTime) {
                    finalMerged.push(fDoc);
                    updatedLocal = true;
                } else if (lTime > fTime) {
                    finalMerged.push(lDoc);
                    // Push newer local doc to firestore
                    await this.db.collection(collectionName).doc(id).set(lDoc);
                } else {
                    finalMerged.push(lDoc);
                }
            }
        }

        // Check local docs that aren't in firestore
        for (const [id, lDoc] of Object.entries(localMap)) {
            if (!firestoreDocs[id]) {
                finalMerged.push(lDoc);
                await this.db.collection(collectionName).doc(id).set(lDoc);
            }
        }

        // Save merged result locally if anything changed
        if (updatedLocal || localData.length !== finalMerged.length) {
            localStorage.setItem(localKey, JSON.stringify(finalMerged));
            window.dispatchEvent(new CustomEvent('storage-update', { detail: { key: localKey } }));
        }
    },

    // Set up Firestore listener to keep local storage fresh in real time
    listenToCollection(localKey, collectionName) {
        if (this.listeners[localKey]) {
            this.listeners[localKey](); // Unsubscribe first if it exists
        }

        this.listeners[localKey] = this.db.collection(collectionName).onSnapshot(snapshot => {
            // Read local data
            const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
            
            // Build current list from Firestore
            const firestoreData = [];
            snapshot.forEach(doc => {
                firestoreData.push(doc.data());
            });

            // If snapshot contains no changes or matched local, skip setting to avoid loop
            if (this.arraysEqual(localData, firestoreData)) {
                return;
            }

            this.log(`Live update received for "${collectionName}": merging changes.`, 'info');
            
            // Update local storage with live data
            // We use simple merge by matching ids and timestamps to handle conflicts correctly
            const merged = this.mergeArrays(localData, firestoreData);
            localStorage.setItem(localKey, JSON.stringify(merged));
            
            // Fire event so dynamic page scripts reload UI
            window.dispatchEvent(new CustomEvent('storage-update', { detail: { key: localKey } }));
        }, err => {
            this.log(`Snapshot listener error on "${collectionName}": ${err.message}`, 'error');
        });
    },

    // Upload an individual key/array to Firestore (triggered during writes)
    async uploadKey(localKey, data) {
        if (!this.isConnected()) return;

        const syncMap = this.getSyncMap();
        const collectionName = syncMap[localKey];
        if (!collectionName) return;

        try {
            this.log(`Syncing modifications in "${collectionName}" to Cloud...`, 'info');
            // Write each item to firestore document
            if (Array.isArray(data)) {
                // To avoid overloading, we can set docs concurrently
                const batch = this.db.batch();
                
                // For deletions, we check what was removed
                const snapshot = await this.db.collection(collectionName).get();
                const existingCloudIds = [];
                snapshot.forEach(doc => existingCloudIds.push(doc.id));
                
                const localIds = data.map(item => item.id).filter(Boolean);
                
                // 1. Delete removed items from Firestore
                existingCloudIds.forEach(id => {
                    if (!localIds.includes(id)) {
                        batch.delete(this.db.collection(collectionName).doc(id));
                    }
                });

                // 2. Set/Update items
                data.forEach(item => {
                    if (item.id) {
                        const docRef = this.db.collection(collectionName).doc(item.id);
                        batch.set(docRef, item);
                    }
                });

                await batch.commit();
                this.log(`Synced changes in "${collectionName}" to Cloud.`, 'success');
            }
        } catch (err) {
            this.log(`Error pushing data to "${collectionName}": ${err.message}`, 'error');
        }
    },

    // Helper: merge arrays by id prioritizing newer timestamp
    mergeArrays(arr1, arr2) {
        const map = {};
        arr1.forEach(item => {
            if (item.id) map[item.id] = item;
        });

        arr2.forEach(item => {
            if (!item.id) return;
            const existing = map[item.id];
            if (!existing) {
                map[item.id] = item;
            } else {
                const t1 = new Date(existing.updatedAt || existing.timestamp || 0).getTime();
                const t2 = new Date(item.updatedAt || item.timestamp || 0).getTime();
                if (t2 > t1) {
                    map[item.id] = item;
                }
            }
        });

        return Object.values(map);
    },

    // Helper: checks if arrays are equivalent
    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        
        const map1 = {};
        arr1.forEach(i => { if (i.id) map1[i.id] = JSON.stringify(i); });
        
        let match = true;
        for (const i of arr2) {
            if (!i.id || map1[i.id] !== JSON.stringify(i)) {
                match = false;
                break;
            }
        }
        return match;
    }
};

// Auto initialize on DOMContentLoaded if enabled
document.addEventListener('DOMContentLoaded', () => {
    FirebaseSync.init();
});
