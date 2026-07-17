# How to Set Up Your Firebase Project

Follow these step-by-step instructions to create a Firebase project, configure your Firestore database, and retrieve your credentials.

---

## Step 1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or **Create a project**).
3. Enter a project name (e.g., `inventory-system`) and click **Continue**.
4. (Optional) Disable Google Analytics for this project, then click **Create project**.
5. Once your project is ready, click **Continue**.

---

## Step 2: Register a Web App
1. On the project homepage, click the **Web icon (`</>`)** located under the heading "Get started by adding Firebase to your app".
2. Enter an app nickname (e.g., `Inventory System Web`), then click **Register app**.
3. You will see a script block containing a `firebaseConfig` object like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```
4. **Copy these config details!** You will enter these exact keys in the **Settings** panel of your web application.

---

## Step 3: Create the Firestore Database
1. In the left navigation sidebar of the Firebase Console, go to **Build** -> **Firestore Database**.
2. Click **Create database**.
3. Choose a location closest to you (e.g., `asia-south1` for India) and click **Next**.
4. Select **Start in test mode** for easy testing (it lets anyone read/write temporarily), or **Start in production mode**. Click **Create**.
5. Go to the **Rules** tab at the top and paste the rules from the [firestore.rules](file:///c:/Users/Yashpal/Desktop/Inventory-System/firestore.rules) file. Click **Publish**.

---

## Step 4: Configure Sync in the Web App
1. Open your web application and navigate to the **Settings** page from the sidebar.
2. Paste the config parameters into the input fields:
   - **API Key** -> `apiKey`
   - **Project ID** -> `projectId`
   - **Auth Domain** -> `authDomain`
   - **Storage Bucket** -> `storageBucket`
   - **Messaging Sender ID** -> `messagingSenderId`
   - **App ID** -> `appId`
3. Click **Test Connection** to confirm connectivity.
4. Click **Save & Sync**.
