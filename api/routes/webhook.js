const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const requestHandler = require('../handlers/request/request.js');

router.get('/', (req, res, next) => {
    const challenge = req.query.challenge;
    res.status(200).json({ challenge: challenge });
});

router.post('/', async (req, res, next) => {
    
    const body = req.body;
    const secret = process.env.WEBHOOK_SECRET;
    const signature = req.get('X-Exl-Signature');
    if (!validateSignature(body, secret, signature)) {
        return res.status(401).send({ errorMessage: 'Invalid Signature' });
    }
    res.status(204).send();
    const action = req.body.action.toLowerCase();
    switch (action) {
        case 'request':
            requestHandler.handler(req.body);
        default:
            message = 'No handler for type' + action;
    }

});

const validateSignature = (body, secret, signature) => {
    const hash = crypto.createHmac('SHA256', secret)
        .update(JSON.stringify(body))
        .digest('base64');
    return (hash === signature);
}

module.exports = router;