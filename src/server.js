const express = require('express');
const fileRoutes = require('./files/files.route');
const messageRoutes = require('./messages/messages.route');
const path = require('path');

const PORT = 3021;
const app = express();
const SHARED_DIR = path.join(__dirname, 'shared');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use('/shared', express.static(SHARED_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// Optional: Serve index.html on root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// API routes
app.use('/api/files', fileRoutes);
app.use('/api/messages', messageRoutes);

// Start server
app.listen(PORT, () => {
    console.log('Server running on http://localhost:' + PORT);
});
