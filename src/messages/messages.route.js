const express = require('express');
const messageService = require('./messages.service');

const router = express.Router();

// GET /api/messages
router.get('/', (req, res) => {
    try {
        const messages = messageService.safeReadMessages();
        return res.json(messages);
    } catch (err) {
        console.error('Error reading messages:', err);
        return res.status(500).json({ error: 'Failed to load messages' });
    }
});

// DELETE /api/messages/:id
router.delete('/:id', (req, res) => {
    try {
        const removed = messageService.deleteMessageById(req.params.id);
        return res.json({ message: 'Message deleted', data: removed });
    } catch (err) {
        if (err?.code === 'EINVAL_ID') {
            return res.status(400).json({ error: 'Invalid message id' });
        }

        if (err?.code === 'ENOENT') {
            return res.status(404).json({ error: 'Message not found' });
        }

        console.error('Error deleting message:', err);
        return res.status(500).json({ error: 'Failed to delete message' });
    }
});

// Minimal message endpoint used by the public UI.
// POST /api/messages { text: string }
router.post('/', (req, res) => {
    try {
        const saved = messageService.appendMessage({ text: req.body?.text });

        return res.status(201).json({
            message: 'Message received',
            data: saved,
        });
    } catch (err) {
        if (err?.code === 'EINVAL_TEXT') {
            return res.status(400).json({ error: 'Message text is required' });
        }

        console.error('Error saving message:', err);
        return res.status(500).json({ error: 'Failed to save message' });
    }
});

module.exports = router;
