import express from 'express';
import fileRoutes from './files/files.route.js';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 3021;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHARED_DIR = path.join(__dirname, '../shared');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use('/shared', express.static(SHARED_DIR));
app.use(express.static(path.join(__dirname, '../public')));

// Optional: Serve index.html on root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API routes
app.use('/api/files', fileRoutes);

// Start server
app.listen(PORT, () => {
    console.log('Server running on http://localhost:' + PORT);
});
