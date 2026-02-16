# ⚡ Quick Start Guide - 5 Minutes

Get PartyFund running in 5 minutes!

---

## 🔥 Firebase Setup (2 minutes)

1. **Create Project**
   - Go to https://console.firebase.google.com
   - Click "Add project"
   - Name: `partyfund-app`
   - Disable Analytics (optional)

2. **Enable Google Auth**
   - Build → Authentication → Get Started
   - Click "Google" → Enable → Save

3. **Create Database**
   - Build → Firestore Database → Create
   - Start in **production mode**
   - Choose region

4. **Get Config**
   - Project Settings (gear icon)
   - Scroll to "Your apps"
   - Click Web icon `</>`
   - Copy the config object

5. **Add Domain**
   - Authentication → Settings → Authorized domains
   - Add: `YOUR-USERNAME.github.io`

---

## 💻 Local Setup (2 minutes)

1. **Install**
```bash
npm install
```

2. **Configure**
Open `src/App.jsx`, line 12:
```javascript
const firebaseConfig = {
  apiKey: "paste-your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

3. **Update Base Path**
Open `vite.config.js`:
```javascript
base: '/partyfund/', // Change to your repo name
```

4. **Test**
```bash
npm run dev
```
Open http://localhost:5173

---

## 🌐 Deploy (1 minute)

1. **Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

2. **Deploy**
```bash
npm run deploy
```

3. **Enable GitHub Pages**
   - Go to repo → Settings → Pages
   - Source: `gh-pages` branch
   - Save

4. **Done!**
   - Visit: `https://USERNAME.github.io/REPO/`

---

## ✅ Verify

- [ ] Can login with Google
- [ ] Can create a party
- [ ] Can add friends
- [ ] Can add income/expense
- [ ] Real-time updates work

---

## 🆘 Quick Fixes

**Firebase error?**
- Check config is correct
- Check authorized domains

**Blank page?**
- Check `base` in vite.config.js
- Clear browser cache

**Build error?**
- Run `npm install` again
- Check Node.js version (18+)

---

**Need detailed help? → [Full Deployment Guide](./DEPLOYMENT_GUIDE.md)**
