const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',           
    password: '1234',           
    database: 'empleos_corredor',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();


async function verificarConexion() {
    try {
        const connection = await promisePool.getConnection();
        console.log('✓ Conexión exitosa a la base de datos MySQL');
        connection.release();
        return true;
    } catch (error) {
        console.error('✗ Error conectando a la base de datos:', error.message);
        return false;
    }
}

const usuariosDB = {
   
    obtenerTodos: async () => {
        const [rows] = await promisePool.query('SELECT * FROM usuarios WHERE estado = "activo"');
        return rows;
    },
    

    obtenerPorId: async (id) => {
        const [rows] = await promisePool.query('SELECT * FROM usuarios WHERE id = ?', [id]);
        return rows[0];
    },
    
    obtenerPorEmail: async (email) => {
        const [rows] = await promisePool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        return rows[0];
    },

    crear: async (usuario) => {
        const [result] = await promisePool.query(
            'INSERT INTO usuarios (nombre, apellido, email, telefono, documento, tipo_documento, direccion, barrio, municipio, fecha_nacimiento, profesion, nivel_educativo, experiencia_laboral, password, tipo_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [usuario.nombre, usuario.apellido, usuario.email, usuario.telefono, usuario.documento, usuario.tipo_documento, usuario.direccion, usuario.barrio, usuario.municipio, usuario.fecha_nacimiento, usuario.profesion, usuario.nivel_educativo, usuario.experiencia_laboral, usuario.password, usuario.tipo_usuario]
        );
        return result.insertId;
    },

    actualizar: async (id, usuario) => {
        const [result] = await promisePool.query(
            'UPDATE usuarios SET nombre = ?, apellido = ?, telefono = ?, direccion = ?, barrio = ?, profesion = ?, nivel_educativo = ?, experiencia_laboral = ? WHERE id = ?',
            [usuario.nombre, usuario.apellido, usuario.telefono, usuario.direccion, usuario.barrio, usuario.profesion, usuario.nivel_educativo, usuario.experiencia_laboral, id]
        );
        return result.affectedRows;
    }
};

const ofertasDB = {

    obtenerActivas: async () => {
        const [rows] = await promisePool.query(
            'SELECT * FROM ofertas_empleo WHERE estado = "activa" ORDER BY fecha_publicacion DESC'
        );
        return rows;
    },
    

    obtenerPorId: async (id) => {
        const [rows] = await promisePool.query('SELECT * FROM ofertas_empleo WHERE id = ?', [id]);
        return rows[0];
    },
    
    obtenerPorSector: async (sector) => {
        const [rows] = await promisePool.query(
            'SELECT * FROM ofertas_empleo WHERE sector = ? AND estado = "activa" ORDER BY fecha_publicacion DESC',
            [sector]
        );
        return rows;
    },
    
    crear: async (oferta) => {
        const [result] = await promisePool.query(
            'INSERT INTO ofertas_empleo (titulo, empresa, descripcion, requisitos, salario, tipo_contrato, ubicacion, sector, vacantes, fecha_cierre, id_empleador) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [oferta.titulo, oferta.empresa, oferta.descripcion, oferta.requisitos, oferta.salario, oferta.tipo_contrato, oferta.ubicacion, oferta.sector, oferta.vacantes, oferta.fecha_cierre, oferta.id_empleador]
        );
        return result.insertId;
    },
    

    obtenerPorEmpleador: async (id_empleador) => {
        const [rows] = await promisePool.query(
            'SELECT * FROM ofertas_empleo WHERE id_empleador = ? ORDER BY fecha_publicacion DESC',
            [id_empleador]
        );
        return rows;
    }
};


const postulacionesDB = {

    crear: async (postulacion) => {
        const [result] = await promisePool.query(
            'INSERT INTO postulaciones (id_usuario, id_oferta, notas) VALUES (?, ?, ?)',
            [postulacion.id_usuario, postulacion.id_oferta, postulacion.notas]
        );
        return result.insertId;
    },
    
    obtenerPorUsuario: async (id_usuario) => {
        const [rows] = await promisePool.query(
            `SELECT p.*, o.titulo, o.empresa, o.salario, o.ubicacion 
             FROM postulaciones p 
             JOIN ofertas_empleo o ON p.id_oferta = o.id 
             WHERE p.id_usuario = ? 
             ORDER BY p.fecha_postulacion DESC`,
            [id_usuario]
        );
        return rows;
    },
    
    obtenerPorOferta: async (id_oferta) => {
        const [rows] = await promisePool.query(
            `SELECT p.*, u.nombre, u.apellido, u.email, u.telefono, u.profesion, u.experiencia_laboral 
             FROM postulaciones p 
             JOIN usuarios u ON p.id_usuario = u.id 
             WHERE p.id_oferta = ? 
             ORDER BY p.fecha_postulacion DESC`,
            [id_oferta]
        );
        return rows;
    },
    
    verificarPostulacion: async (id_usuario, id_oferta) => {
        const [rows] = await promisePool.query(
            'SELECT * FROM postulaciones WHERE id_usuario = ? AND id_oferta = ?',
            [id_usuario, id_oferta]
        );
        return rows.length > 0;
    }
};

module.exports = {
    pool,
    promisePool,
    verificarConexion,
    usuariosDB,
    ofertasDB,
    postulacionesDB
};