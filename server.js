const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const path = require('path');
const app = express();

const SECRET_KEY = 'meta2025';
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const db = mysql.createConnection({
    host: 'localhost', user: 'root', password: '1234', database: 'empleo_ce'
});

db.connect(err => {
    if (err) console.error('Error MySQL:', err);
    else console.log('MySQL conectado');
});

function verificarToken(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return res.status(403).json({ error: 'Token requerido' });
    const token = auth.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Token inválido' });
        req.userId = decoded.id;
        req.userType = decoded.tipo;
        next();
    });
}

// LOGIN CANDIDATO
app.post('/login/candidato', (req, res) => {
    const { correo, contra } = req.body;
    db.query('SELECT * FROM candidatos WHERE correo = ?', [correo], (err, results) => {
        if (err || results.length === 0 || contra !== results[0].contra)
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        const user = results[0];
        const token = jwt.sign({ id: user.id, tipo: 'candidato' }, SECRET_KEY, { expiresIn: '2h' });
        delete user.contra;
        res.json({ token, usuario: { ...user, tipo: 'candidato' } });
    });
});

// LOGIN EMPRESA
app.post('/login/empresa', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM empresas WHERE email = ?', [email], (err, results) => {
        if (err || results.length === 0 || password !== results[0].password)
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        const empresa = results[0];
        const token = jwt.sign({ id: empresa.id, tipo: 'empresa' }, SECRET_KEY, { expiresIn: '2h' });
        res.json({ token, usuario: { ...empresa, tipo: 'empresa' } });
    });
});

// REGISTRO CANDIDATO
app.post('/registro/candidato', (req, res) => {
    const { nombre, correo, contra, municipio } = req.body;
    db.query('INSERT INTO candidatos (nombre, correo, contra, municipio) VALUES (?,?,?,?)',
        [nombre, correo, contra, municipio], err => {
            if (err) return res.status(400).json({ error: 'Correo ya registrado' });
            res.json({ message: 'Registrado correctamente' });
        });
});

// REGISTRO EMPRESA
app.post('/registro/empresa', (req, res) => {
    const { razon_social, nit, email, password, municipio, telefono } = req.body;
    db.query('INSERT INTO empresas (razon_social, nit, email, password, municipio, telefono) VALUES (?,?,?,?,?,?)',
        [razon_social, nit, email, password, municipio, telefono], err => {
            if (err) return res.status(400).json({ error: 'Email o NIT ya registrado' });
            res.json({ message: 'Empresa registrada' });
        });
});

// OFERTAS (para candidatos)
app.get('/ofertas', verificarToken, (req, res) => {
    if (req.userType !== 'candidato') return res.status(403).json({ error: 'Acceso denegado' });
    const sql = `SELECT o.*, p.estado AS estado_postulacion FROM ofertas o 
                 LEFT JOIN postulaciones p ON o.id = p.id_oferta AND p.id_candidato = ? 
                 ORDER BY o.fecha DESC`;
    db.query(sql, [req.userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error' });
        res.json(results);
    });
});

// PUBLICAR OFERTA
app.post('/ofertas', verificarToken, (req, res) => {
    if (req.userType !== 'empresa') return res.status(403).json({ error: 'Solo empresas' });
    const { titulo, empresa, municipio, descripcion } = req.body;
    db.query('INSERT INTO ofertas (titulo, empresa, municipio, descripcion, id_empresa) VALUES (?,?,?,?,?)',
        [titulo, empresa, municipio, descripcion, req.userId], (err, result) => {
            if (err) return res.status(500).json({ error: 'Error al publicar' });
            res.json({ message: 'Oferta publicada', id: result.insertId });
        });
});

// POSTULARSE
app.post('/postulaciones', verificarToken, (req, res) => {
    if (req.userType !== 'candidato') return res.status(403).json({ error: 'Solo candidatos' });
    const { id_oferta } = req.body;
    db.query('INSERT INTO postulaciones (id_candidato, id_oferta) VALUES (?,?)', [req.userId, id_oferta], err => {
        if (err) return res.status(409).json({ error: 'Ya te postulaste' });
        res.json({ message: 'Postulación enviada' });
    });
});

// MIS OFERTAS (empresa)
app.get('/mis-ofertas', verificarToken, (req, res) => {
    if (req.userType !== 'empresa') return res.status(403).json({ error: 'Solo empresas' });
    db.query('SELECT * FROM ofertas WHERE id_empresa = ? ORDER BY fecha DESC', [req.userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error' });
        res.json(results);
    });
});

// CANDIDATOS POR OFERTA
app.get('/postulaciones-oferta/:id', verificarToken, (req, res) => {
    if (req.userType !== 'empresa') return res.status(403).json({ error: 'Solo empresas' });
    const { id } = req.params;
    db.query(`SELECT p.*, c.nombre, c.correo, c.municipio FROM postulaciones p 
              JOIN candidatos c ON p.id_candidato = c.id WHERE p.id_oferta = ?`, [id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error' });
        res.json(results);
    });
});

// ACEPTAR / RECHAZAR
app.patch('/postulacion/:id', verificarToken, (req, res) => {
    if (req.userType !== 'empresa') return res.status(403).json({ error: 'Solo empresas' });
    const { id } = req.params;
    const { estado } = req.body;
    if (!['aceptada', 'rechazada'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    db.query('UPDATE postulaciones SET estado = ? WHERE id = ?', [estado, id], (err, result) => {
        if (err || result.affectedRows === 0) return res.status(500).json({ error: 'Error' });
        res.json({ message: 'Estado actualizado' });
    });
});

app.listen(3000, () => console.log('http://localhost:3000'));