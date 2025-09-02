// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./controllers/auth.controller');
const userRoutes = require('./controllers/user.controller');
const tripRoutes = require('./controllers/trip.controller');

const app = express();
app.use(cors());
app.use(express.json());

// prefijo /api para separar de las rutas de React
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trips', tripRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend escuchando en http://localhost:${PORT}`));
// ...existing code...
const userController = require('./controllers/user.controller');
// ...existing code...
app.post('/api/register', userController.register);
// ...existing code...