var express = require('express');
var path = require('path');
const body = require("body-parser");
var axios = require('axios');
var { create } = require('./Functions/makeSession');
var { get } = require("./Functions/makeSession"); 

function ToMyId(len = 32) {
    let res = '';
    const chars = '0123456789abcdef';
    for (let i = 0; i < len; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
}

var fs = require('fs');
const pino = require("pino");
const {
    default: WASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require("baileys");

var app = express();
var root = process.cwd();
var port = process.env.PORT || 8000;

app.use(body.json());
app.use(body.urlencoded({ extended: true }));
app.use(express.static(path.join(root, 'statics')));

function rmFile(path) {
    if (!fs.existsSync(path)) return false;
    fs.rmSync(path, { recursive: true, force: true });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(root, '/statistics/index.html'));
});

app.get('/pair.html', (req, res) => {
    res.sendFile(path.join(root, '/statistics/pair.html'));
});

app.get('/code.html', (req, res) => {
    res.sendFile(path.join(root, '/statistics/code.html'));
});

app.get('/qr.html', (req, res) => {
    res.sendFile(path.join(root, '/statistics/qr.html'));
});

app.get('/session', async (req, res) => {
    const q = req.query.q;
    if (!q) { return res.status(400).json({
            ok: false,
            msg: 'err missing q'
        });
    }

    var query = q.split(';')[1];
    try { const data = await get(query);
        res.json({
            ok: true,
            data: data.content
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ok: false, msg: 'server errr', err: err.message
        });
    }
});

app.get('/pair', async (req, res) => {
    var id = ToMyId();
    let num = req.query.number;
    async function pair() {
        const { state, saveCreds } = await useMultiFileAuthState('./session/' + id);
        try {
            let wa = WASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({level: "fatal"}).child({level: "fatal"})),
                },
                logger: pino({level: "fatal"}).child({level: "fatal"}),
                browser: Browsers.macOS("Safari"),
                downloadHistory: false,
                syncFullHistory: false
            });

            if (!wa.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                var code = await wa.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.json({ code });
                }
            }

            wa.ev.on('creds.update', saveCreds);
            wa.ev.on("connection.update", async (state) => {
                const { connection, lastDisconnect } = state;
                if (connection == "open") {
                    await delay(3000);
                    try {
                        var json = await fs.promises.readFile(`${root}/session/${id}/creds.json`, 'utf-8');     
                        const { id: sessionId } = await create(json);    
                        await wa.sendMessage(wa.user.id, { 
                            text: `*Do not share this session or creds as well*\nYou can use session id or if you want upload the creds.json\n\n*Join our chat group*.  https://chat.whatsapp.com/KLd7DIw1OV56wj4BRw0oE9\n\nSession ID: garfield~${sessionId}` 
                        });
                        await wa.sendMessage(wa.user.id, {
                            document: Buffer.from(json, 'utf-8'),
                            mimetype: 'application/json',
                            fileName: 'creds.json'
                        });
                        
                        console.log('Session sent successfully:', id);
                        await delay(1000);
                        await wa.ws.close();
                        return await rmFile('./session/' + id);
                    } catch (err) {
                        console.error(err);
                        await wa.ws.close();
                        return await rmFile('./session/' + id);
                    }
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    pair();
                }
            });
        } catch (err) {
            console.error(err);
            await rmFile('./session/' + id);
            if (!res.headersSent) {
                res.status(500).json({ error: "Service unavailable" });
            }
        }
    }

    return await pair();
});

app.get('/qr', async (req, res) => {
    var id = ToMyId();
    async function qrConnect() {
        const { state, saveCreds } = await useMultiFileAuthState('./session/' + id);
        try {
            let wa = WASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({level: "fatal"}).child({level: "fatal"})),
                },
                logger: pino({level: "fatal"}).child({level: "fatal"}),
                browser: Browsers.macOS("Safari"),
                downloadHistory: false,
                syncFullHistory: false
            });

            const timeout = setTimeout(() => {
                if (!res.headersSent) {
                    console.log('time_out',id);
                    res.status(408).json({ error: "QR generation timeout" });
                    try {
                        wa.ws.close();
                    } catch (e) {
                        console.error(e);
                    }
                    rmFile('./session/' + id);
                }
            }, 30000);

            wa.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr && !res.headersSent) {
                    console.log('QR generated successfully for ID:', id);
                    clearTimeout(timeout);
                    res.json({ qr: qr });
                    return;
                }
                
                if (connection === 'open') {
                    clearTimeout(timeout);
                    await delay(3000);
                    try { var json = await fs.promises.readFile(`${root}/session/${id}/creds.json`, 'utf-8');     
                        const { id: sessionId } = await create(json);    
                        await wa.sendMessage(wa.user.id, { 
                            text: `*Do not share this session or creds as well*\nYou can use session id or if you want upload the creds.json\n\n*Join our chat group*.  https://chat.whatsapp.com/KLd7DIw1OV56wj4BRw0oE9\n\nSession ID: garfield~${sessionId}` 
                        });
                        await wa.sendMessage(wa.user.id, {
                            document: Buffer.from(json, 'utf-8'),
                            mimetype: 'application/json',
                            fileName: 'creds.json'
                        });
                        
                        console.log('QR Session sent successfully:', id);
                        await delay(1000);
                        await wa.ws.close();
                        return await rmFile('./session/' + id);
                    } catch (err) {
                        console.error(err);
                        await wa.ws.close();
                        return await rmFile('./session/' + id);
                    }
                } else if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    console.log('Connection closed, attempting reconnection for ID:', id);
                    if (!res.headersSent) {
                        clearTimeout(timeout);
                        await delay(3000);
                        qrConnect();
                    }
                }
            });

            wa.ev.on('creds.update', saveCreds);
            wa.ws.on('error', (error) => {
                console.error(id, error);
                if (!res.headersSent) {
                    clearTimeout(timeout);
                    res.status(500).json({ error: "Connection failed" });
                }
            });

        } catch (err) {
            console.error(err);
            await rmFile('./session/' + id);
            if (!res.headersSent) {
                res.status(500).json({ error: "Service unavailable", details: err.message });
            }
        }
    }

    return await qrConnect();
});

app.listen(port, () => {
    console.log(`Server running on:${port}`);
});
