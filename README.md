# Kanbino-back-end

---

## 📘 Kanbino Backend Overview

![Kanbino Logo](./images/kanbinologo.png)

### Description
Kanbino Backend is a RESTful API powering the Kanbino frontend. It manages:
- Authentication (JWT)
- Boards and members
- Columns with ordering
- Cards with assignment, completion status, and reordering
- Comments on cards

Built with **Express, MongoDB, and JWT**, it supports secure authentication and CRUD operations for full-stack development.

---

## Features
- 🔑 JWT-based user authentication
- 👥 Role-based permissions (owner vs members)
- 📂 CRUD for boards, columns, and cards
- 🔄 Endpoints for drag-and-drop reordering
- 💬 Card comment system
- ✅ Toggle card completion status
- 🔒 Middleware for route protection and validation

---

## Getting Started
- **Deployed API**: Coming Soon
- **Frontend Repository**: [Kanbino Frontend](https://github.com/your-username/kanbino-frontend)

### Installation
```bash
cd backend
npm install
npm run dev
```

---

## Attributions
- Express
- MongoDB
- Mongoose
- JWT
- bcrypt

---

## Technologies Used
- Node.js / Express
- MongoDB + Mongoose
- JWT (authentication)
- bcrypt (password hashing)

---

## Next Steps
- 🔍 Search/filter functionality for cards
- 📜 Activity logs per board
- 🔔 Notifications for user mentions in comments
- 🏷 Tags/labels support on cards
- ⚡ Real-time updates via websockets
- 🛡 Rate limiting & improved error handling

---

## What I Learned

**Mongoose Operators:**
- `$set`: Updates a field value without replacing the whole document.  
    Example: `{ $set: { position: index } }` sets only the `position` field.
- `$gte`: Selects documents where the field value is greater than or equal to a specified value.
