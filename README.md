# 🎉 PartyFund - Split Expenses with Friends

A modern, real-time expense splitting application built with React and Firebase.

![PartyFund](https://img.shields.io/badge/version-2.0.0-blue)
![React](https://img.shields.io/badge/react-18.2.0-61dafb)
![Firebase](https://img.shields.io/badge/firebase-10.8.0-orange)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### 🔐 Authentication
- Google OAuth login (secure, no password management)
- Role-based access (admin vs view-only)
- Persistent sessions

### 💰 Expense Management
- Create multiple party/event funds
- Add income from members
- Track expenses with categories
- Smart split logic (everyone or select specific people)
- Edit and delete transactions

### 👥 Member Management
- Add unlimited friends to parties
- Edit member names
- Remove members
- Color-coded member avatars

### 📊 Reports & Analytics
- Real-time expense tracking
- Category-wise breakdown
- Automatic settlement calculations
- Shows who owes whom
- Individual expense breakdown per member
- Professional print view for PDF export

### 🎨 Modern UI/UX
- Beautiful gradient design
- Smooth animations
- Toast notifications
- Mobile-responsive
- Dark mode ready
- Search and filter

### ⚡ Real-time Updates
- All changes sync instantly across devices
- No need to refresh
- Firebase real-time listeners

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Firebase account
- GitHub account

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/partyfund.git
cd partyfund
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure Firebase:**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Google Authentication
   - Create Firestore database
   - Copy your Firebase config
   - Update `src/App.jsx` with your config

4. **Run locally:**
```bash
npm run dev
```

5. **Deploy to GitHub Pages:**
```bash
npm run deploy
```

**For detailed setup instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**

---

## 📖 Documentation

- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Complete step-by-step deployment instructions
- **[Improvements](./IMPROVEMENTS.md)** - List of all improvements from previous version
- **[Firestore Rules](./firestore.rules)** - Database security rules

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Tailwind CSS
- **Backend:** Firebase (Auth + Firestore)
- **Build Tool:** Vite
- **Deployment:** GitHub Pages
- **Icons:** Lucide React
- **Hosting:** GitHub Pages

---

## 📱 Screenshots

### Login Screen
Beautiful gradient design with Google OAuth

### Dashboard
Track expenses in real-time with intuitive UI

### Reports
Automatic settlement calculations showing who owes whom

### Print View
Professional PDF-ready expense reports

---

## 🎯 How It Works

1. **Admin creates a party**
   - Gets a unique share code
   - Only admin can add transactions

2. **Add friends**
   - Admin adds all party members
   - Each member gets a color-coded avatar

3. **Track expenses**
   - **Income:** Money collected from members
   - **Expenses:** Money spent from the fund
   - Categories: Food, Hotel, Travel, etc.

4. **Smart splitting**
   - Split equally among everyone
   - OR select specific people for each expense

5. **Automatic settlement**
   - App calculates who paid vs who should pay
   - Shows final balance for each person
   - Green = they get money back
   - Red = they need to pay

---

## 🔐 Security

- Firebase Authentication (Google OAuth)
- Firestore security rules
- Only admins can modify parties
- All data encrypted in transit
- No exposed credentials

---

## 📊 Database Schema

### Collections

**parties**
```
{
  id: string
  name: string
  adminId: string (user.uid)
  adminName: string
  shareCode: string (6 chars)
  createdAt: timestamp
}
```

**members**
```
{
  id: string
  partyId: string (foreign key)
  name: string
  createdAt: timestamp
}
```

**transactions**
```
{
  id: string
  partyId: string (foreign key)
  type: 'in' | 'out'
  amount: number
  category: string
  description: string
  
  // For income (type='in')
  memberId: string
  memberName: string
  
  // For expenses (type='out')
  payerId: 'admin'
  payerName: 'Fund'
  involvedMemberIds: string[] (who to split with)
  
  date: timestamp
  createdAt: timestamp
}
```

---

## 🎨 Customization

### Change Theme Colors

In `src/App.jsx`, update gradient classes:

```javascript
// Find and replace:
"from-indigo-600 to-purple-600"

// With your colors:
"from-blue-600 to-cyan-600"
```

### Add New Categories

```javascript
const EXPENSE_CATEGORIES = ['Food', 'Hotel', 'YourCategory'];
```

### Modify Currency

Search for `₹` and replace with your currency symbol.

---

## 🐛 Known Issues

1. **404 on page refresh** - Expected with SPA on GitHub Pages (users should bookmark main URL)
2. **Limited offline support** - Firebase provides basic offline persistence
3. **No multi-currency** - Currently supports single currency only

---

## 🚧 Roadmap

### v2.1 (Next Release)
- [ ] Receipt image upload
- [ ] Date picker for backdated transactions
- [ ] Export to Excel/CSV
- [ ] Share party invite link
- [ ] Dark mode

### v2.2 (Future)
- [ ] Push notifications
- [ ] Email expense reports
- [ ] Multiple currencies
- [ ] Budget tracking
- [ ] Recurring expenses

### v3.0 (Long-term)
- [ ] Mobile app (React Native)
- [ ] Split by percentage
- [ ] Multi-language support
- [ ] Analytics dashboard

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👏 Acknowledgments

- React team for the amazing framework
- Firebase for the backend infrastructure
- Lucide for beautiful icons
- Tailwind CSS for styling utilities

---

## 📧 Contact

**Project Link:** https://github.com/yourusername/partyfund

**Live Demo:** https://yourusername.github.io/partyfund

---

## ⭐ Support

If you found this project helpful, please give it a ⭐️!

---

**Made with ❤️ for splitting expenses fairly**
