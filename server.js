const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const app = express();

const SECRET_KEY = 'meta2025';

app.use(express.json());

// SIRVE frontend DESDE LA MISMA CARPETA
app.use(express.static(path.join(__dirname, 'frontend')));

// RUTA RAÍZ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'empleo_ce'
}); 

db.connect(err => {
  if (err) {
    console.error('Error conectando a MySQL: ' + err.stack);
    return;
  }
  console.log('Conectado a MySQL con ID ' + db.threadId);
});

function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: 'Token no proporcionado' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'Formato de token incorrecto' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }
        req.usuarioId = decoded.id; 
        next();
    });
}

// REGISTRO
app.post('/registro', async (req, res) => {
  const { nombre, correo, contra, municipio } = req.body;
  const municipiosCE = ['Villavicencio','Restrepo','Cumaral','Acacías','Guamal','San Martín','Granada'];
  if (!municipiosCE.includes(municipio)) return res.status(400).json({ error: 'Municipio no permitido.' });
  
  try {
        const hash = await bcrypt.hash(contra, 10);
        db.query('INSERT INTO usuarios (nombre, correo, contra, municipio) VALUES (?, ?, ?, ?)', 
            [nombre, correo, hash, municipio], (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
                }
                console.error(err);
                return res.status(500).json({ error: 'Error al registrar el usuario.' });
            }
            res.json({ message: 'Registrado' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error interno en el servidor.' });
    }
});

// LOGIN
app.post('/login', (req, res) => {
  const { correo, contra } = req.body;
  db.query('SELECT * FROM usuarios WHERE correo = ?', [correo], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Error en la base de datos' });
    if (!results || results.length === 0) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const user = results[0];
    const match = await bcrypt.compare(contra, user.contra);
    
    if (!match) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    
    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '1h' });
    delete user.contra; 
    
    res.json({ token, usuario: user });
  });
});

// OBTENER OFERTAS (Consulta)
app.get('/ofertas', verificarToken, (req, res) => {
  // Se ordena por fecha de manera descendente para ver las más nuevas primero
  db.query('SELECT * FROM ofertas ORDER BY fecha DESC', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al cargar ofertas.' });
    }
    res.json(results || []);
  });
});

// PUBLICAR OFERTA (Gestión)
app.post('/ofertas', verificarToken, (req, res) => { 
  const { titulo, empresa, municipio, descripcion } = req.body;
  const id_empleador = req.usuarioId; // ID del usuario que publica

  if (!titulo || !empresa || !municipio || !descripcion) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const sql = 'INSERT INTO ofertas (titulo, empresa, municipio, descripcion, id_empleador) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [titulo, empresa, municipio, descripcion, id_empleador], (err, result) => {
    if (err) {
      console.error(err);
      // Error común: la tabla ofertas no tiene la columna id_empleador
      return res.status(500).json({ error: 'Error al publicar oferta. Revise el esquema SQL.' }); 
    }
    res.status(201).json({ message: 'Oferta publicada exitosamente', id: result.insertId });
  });
});


// GESTIONAR POSTULACIÓN
app.post('/postulaciones', verificarToken, (req, res) => {
    const id_usuario = req.usuarioId; 
    const { id_oferta } = req.body;

    if (!id_oferta) {
        return res.status(400).json({ error: 'ID de oferta requerida' });
    }

    db.query('SELECT * FROM postulaciones WHERE id_usuario = ? AND id_oferta = ?', 
        [id_usuario, id_oferta], (err, results) => {
            if (err) return res.status(500).json({ error: 'Error interno de la base de datos.' });
            
            if (results.length > 0) {
                return res.status(409).json({ error: 'Ya te has postulado a esta oferta.' });
            }

            const sql = 'INSERT INTO postulaciones (id_usuario, id_oferta) VALUES (?, ?)';
            db.query(sql, [id_usuario, id_oferta], (insertErr, result) => {
                if (insertErr) {
                    console.error(insertErr);
                    // Error común: la tabla postulaciones no existe
                    return res.status(500).json({ error: 'Error al registrar la postulación. Revise el esquema SQL.' });
                }
                res.status(200).json({ message: 'Postulación registrada exitosamente', id: result.insertId });
            });
    });
});


app.listen(3000, () => {
  console.log('SERVIDOR CORRIENDO EN http://localhost:3000');
  console.log(' SIRVIENDO: frontend/index.html');
});