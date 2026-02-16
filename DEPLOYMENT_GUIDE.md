# 🚀 PartyFund Deployment Guide

Complete guide to deploy your improved PartyFund app to GitHub Pages with Firebase backend.

---

## 📋 Prerequisites

- Node.js (v18 or higher) - [Download](https://nodejs.org/)
- Git - [Download](https://git-scm.com/)
- GitHub account
- Google account (for Firebase)

---

## 🔥 Part 1: Firebase Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name: `partyfund-app`
4. Disable Google Analytics (optional)
5. Click "Create project"

### Step 2: Enable Google Authentication

1. In Firebase Console, go to **Build → Authentication**
2. Click "Get started"
3. Click on "Google" sign-in provider
4. Toggle **Enable**
5. Select a support email
6. Click "Save"

### Step 3: Create Firestore Database

1. Go to **Build → Firestore Database**
2. Click "Create database"
3. Choose **Start in production mode** (we'll add rules next)
4. Select location closest to your users (e.g., `asia-south1` for India)
5. Click "Enable"

### Step 4: Set Up Security Rules

1. In Firestore Database page, click on **Rules** tab
2. Replace the default rules with the content from `firestore.rules` file
3. Click "Publish"

**Your firestore.rules should look like this:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isPartyAdmin(partyId) {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/parties/$(partyId)).data.adminId == request.auth.uid;
    }
    
    match /parties/{partyId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && 
                       request.resource.data.adminId == request.auth.uid;
      allow update, delete: if isPartyAdmin(partyId);
    }
    
    match /members/{memberId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && 
                       isPartyAdmin(request.resource.data.partyId);
      allow update, delete: if isAuthenticated() && 
                               isPartyAdmin(resource.data.partyId);
    }
    
    match /transactions/{transactionId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && 
                       isPartyAdmin(request.resource.data.partyId);
      allow update, delete: if isAuthenticated() && 
                               isPartyAdmin(resource.data.partyId);
    }
  }
}
```

### Step 5: Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps" section
3. Click on the **Web** icon `</>`
4. Register app with nickname: `PartyFund Web`
5. **Copy the Firebase configuration object**

It will look like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "partyfund-app.firebaseapp.com",
  projectId: "partyfund-app",
  storageBucket: "partyfund-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdefghijklmnop"
};
```

6. **Save this configuration** - you'll need it soon!

### Step 6: Add Authorized Domain for GitHub Pages

1. In Firebase Console, go to **Authentication → Settings → Authorized domains**
2. Click "Add domain"
3. Add: `YOUR-USERNAME.github.io`
   - Replace `YOUR-USERNAME` with your actual GitHub username
   - Example: `tester2021test.github.io`
4. Click "Add"

---

## 💻 Part 2: Local Setup

### Step 1: Clone/Download the Project

If you have the project files, organize them like this:

```
partyfund/
├── src/
│   ├── App.jsx          (your improved app)
│   └── main.jsx
├── index.html
├── package.json
├── vite.config.js
├── firestore.rules
└── .gitignore
```

### Step 2: Create .gitignore File

Create a `.gitignore` file in the root:

```
# Dependencies
node_modules/
package-lock.json

# Build output
dist/
build/

# Environment variables
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
```

### Step 3: Install Dependencies

Open terminal in the project folder and run:

```bash
npm install
```

This will install:
- React & React DOM
- Firebase SDK
- Lucide React (icons)
- Vite (build tool)
- gh-pages (deployment tool)

### Step 4: Configure Firebase in Your App

1. Open `src/App.jsx`
2. Find the `firebaseConfig` object (around line 12-19):

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

3. **Replace it with your Firebase config** from Step 5 above

### Step 5: Update Base Path in vite.config.js

Open `vite.config.js` and update the `base` path:

```javascript
export default defineConfig({
  plugins: [react()],
  base: '/partyfund/', // ← Change this to your repo name
  // ...
})
```

**Important:** The base path must match your GitHub repository name!

- If your repo is `https://github.com/username/partyfund`
- Then base should be: `base: '/partyfund/'`

### Step 6: Test Locally

Run the development server:

```bash
npm run dev
```

Open your browser to `http://localhost:5173` and test:
- ✅ Google login works
- ✅ Can create parties
- ✅ Can add friends
- ✅ Can add income/expenses
- ✅ Settlement calculations work
- ✅ Print view works

---

## 🌐 Part 3: GitHub Pages Deployment

### Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click the **+** icon → **New repository**
3. Repository name: `partyfund` (or whatever you want)
4. Choose **Public**
5. **DO NOT** initialize with README
6. Click "Create repository"

### Step 2: Initialize Git and Push

In your project folder terminal:

```bash
# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: PartyFund with Firebase"

# Add remote (replace USERNAME and REPO)
git remote add origin https://github.com/USERNAME/REPO.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Replace:**
- `USERNAME` with your GitHub username
- `REPO` with your repository name (e.g., `partyfund`)

Example:
```bash
git remote add origin https://github.com/tester2021test/partyfund.git
```

### Step 3: Deploy to GitHub Pages

```bash
npm run deploy
```

This will:
1. Build your app for production
2. Create a `gh-pages` branch
3. Push the built files to GitHub Pages

Wait 2-3 minutes for GitHub to process the deployment.

### Step 4: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll to **Pages** section (left sidebar)
4. Under "Source", ensure:
   - Branch: `gh-pages`
   - Folder: `/ (root)`
5. Click **Save**

### Step 5: Access Your Live App

Your app will be available at:

```
https://USERNAME.github.io/REPO/
```

Example:
```
https://tester2021test.github.io/partyfund/
```

---

## 🔧 Part 4: Troubleshooting

### Issue: Firebase Authentication Error

**Error:** "auth/unauthorized-domain"

**Solution:**
1. Go to Firebase Console → Authentication → Settings
2. Add your GitHub Pages domain to Authorized domains
3. Format: `username.github.io`

### Issue: Blank Page After Deploy

**Solution:**
1. Check browser console for errors
2. Verify `base` in `vite.config.js` matches repo name
3. Ensure Firebase config is correct
4. Clear browser cache

### Issue: 404 on Refresh

**Solution:**
This is expected with SPA on GitHub Pages. Users should bookmark the main URL.

Alternatively, add this to your `dist/` folder after build:

Create `404.html`:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>PartyFund</title>
    <script>
      sessionStorage.redirect = location.href;
    </script>
    <meta http-equiv="refresh" content="0;URL='/partyfund'">
  </head>
</html>
```

### Issue: Firebase Security Rules Blocking Requests

**Solution:**
Check Firestore Rules tab for denied requests. Common issues:
- User not authenticated
- User trying to modify another admin's party
- Missing `adminId` field when creating party

---

## 📱 Part 5: Making Updates

### Update Code

1. Make changes to `src/App.jsx`
2. Test locally: `npm run dev`
3. When ready:

```bash
git add .
git commit -m "Description of changes"
git push origin main
npm run deploy
```

### Update Firebase Rules

1. Modify `firestore.rules`
2. Go to Firebase Console → Firestore → Rules tab
3. Paste updated rules
4. Click "Publish"

---

## 🎨 Part 6: Customization

### Change App Name

1. Update `index.html` title
2. Update `package.json` name and description
3. Update login screen header in `App.jsx`

### Change Color Scheme

In `App.jsx`, find gradient classes:
- `from-indigo-600 to-purple-600` (main theme)
- Replace with your colors: `from-blue-600 to-cyan-600`

### Add Your Logo

1. Add logo image to `public/` folder
2. In login screen, replace the Receipt icon with your logo

---

## 📊 Monitoring & Analytics

### View Firebase Usage

Firebase Console → Project Overview:
- Authentication users
- Firestore reads/writes
- Storage usage

### Set Up Quotas

Free tier limits:
- **Authentication:** 10K verifications/month
- **Firestore:** 50K reads, 20K writes, 20K deletes/day
- **Storage:** 1GB

For production, consider upgrading to Blaze (pay-as-you-go) plan.

---

## 🔐 Security Best Practices

1. **Never commit Firebase config to public repos** (it's safe for client-side but be aware)
2. **Use environment variables** for sensitive data
3. **Regularly review Firestore security rules**
4. **Monitor authentication attempts** in Firebase Console
5. **Enable Firebase App Check** for production (prevents abuse)

---

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [GitHub Pages Guide](https://pages.github.com/)

---

## ✅ Quick Reference

### Development Commands

```bash
npm run dev        # Start dev server (localhost:5173)
npm run build      # Build for production
npm run preview    # Preview production build
npm run deploy     # Build and deploy to GitHub Pages
```

### Important URLs

- **Firebase Console:** https://console.firebase.google.com
- **GitHub Pages:** https://USERNAME.github.io/REPO
- **Local Dev:** http://localhost:5173

---

## 🎉 You're Done!

Your PartyFund app is now live with:
- ✅ Firebase authentication (Google login)
- ✅ Real-time database sync
- ✅ Secure data access rules
- ✅ Hosted on GitHub Pages

Share the link with your friends and start tracking expenses! 🎊

---

**Need Help?**
- Firebase Issues: [Firebase Support](https://firebase.google.com/support)
- GitHub Issues: [GitHub Support](https://support.github.com)
- Deployment Issues: Check the Troubleshooting section above
