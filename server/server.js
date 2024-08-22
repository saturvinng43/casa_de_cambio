const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql');
const twilio = require('twilio');


const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la base de datos
const db = mysql.createConnection({
    host: 'brzusxdftioxpzn4tg55-mysql.services.clever-cloud.com',
    database: 'brzusxdftioxpzn4tg55',
    user: 'upfykm9aih5tlexd',
    password: 'tKIaokOcjU7kkV0yD2oN'
});

// Conectar a la base de datos
db.connect(function(err) {
    if (err) {
        console.error('Error al conectar a la base de datos:', err);
        process.exit(1); // Salir si no se puede conectar
    } else {
        console.log('Conexión exitosa a la base de datos');
    }
});

// Middleware para manejar JSON y servir archivos estáticos
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Ruta para registrar usuario
app.post('/api/register', (req, res) => {
    const { username, email, password, phone_number, answer1, answer2, answer3, answer4, answer5 } = req.body;

    // Verificar si el correo electrónico ya está registrado
    const checkEmailQuery = 'SELECT * FROM users WHERE email = ?';
    db.query(checkEmailQuery, [email], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error al verificar el correo electrónico' });
        }
        if (results.length > 0) {
            return res.status(400).json({ success: false, message: 'El correo electrónico ya está registrado' });
        }

        // Insertar usuario en la tabla users
        const userQuery = 'INSERT INTO users (username, email, password, phone_number) VALUES (?, ?, ?, ?)';
        db.query(userQuery, [username, email, password, phone_number], (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error al registrar usuario' });
            }
            const userId = results.insertId;
            
            // Insertar respuestas a las preguntas de seguridad
            const questions = [
                { question: '¿Cuál es tu color favorito?', answer: answer1 },
                { question: '¿Nombre de tu mamá?', answer: answer2 },
                { question: '¿Nombre de tu papá?', answer: answer3 },
                { question: '¿Cuántos años tienes?', answer: answer4 },
                { question: '¿Cómo se llama tu mascota?', answer: answer5 }
            ];
            
            questions.forEach(q => {
                const questionQuery = 'INSERT INTO security_questions (user_id, question, answer) VALUES (?, ?, ?)';
                db.query(questionQuery, [userId, q.question, q.answer], (err) => {
                    if (err) {
                        console.error('Error al insertar pregunta de seguridad:', err);
                    }
                });
            });

            // Enviar un SMS de confirmación usando Twilio
            client.messages
                .create({
                    body: `Hola ${username}, tu registro fue exitoso en la casa de cambio A & I.`,
                    from: '+12088359147', // Reemplaza con tu número de Twilio
                    to: phone_number
                })
                .then(message => console.log('Mensaje enviado con SID:', message.sid))
                .catch(err => console.error('Error al enviar el mensaje:', err));

            res.json({ success: true, message: 'Registro exitoso' });
        });
    });
});

// Ruta para iniciar sesión
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // Consultar el usuario en la base de datos
    const query = 'SELECT * FROM users WHERE email = ? AND password = ?';
    db.query(query, [email, password], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error al verificar las credenciales' });
        }
        if (results.length > 0) {
            // Usuario encontrado, devolver detalles del usuario
            const user = results[0];
            res.json({ success: true, user });
        } else {
            // Credenciales incorrectas
            res.status(400).json({ success: false, message: 'Correo electrónico o contraseña incorrectos' });
        }
    });
});

// Ruta para cerrar sesión
app.post('/api/logout', (req, res) => {
    // Aquí puedes manejar la lógica para cerrar sesión (por ejemplo, eliminar cookies o sesiones)
    res.json({ success: true, message: 'Sesión cerrada exitosamente' });
});

// Ruta para verificar la conexión a la base de datos
app.get('/api/db-status', (req, res) => {
    db.query('SELECT 1 + 1 AS solution', (err, results) => {
        if (err) {
            res.status(500).json({ status: 'error', message: 'Error al conectar a la base de datos' });
        } else {
            res.json({ status: 'success', message: 'Conexión a la base de datos exitosa' });
        }
    });
});

// Ruta para obtener los usuarios de la base de datos
app.get('/api/users', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            res.status(500).json({ status: 'error', message: 'Error al obtener usuarios' });
        } else {
            res.json(results);
        }
    });
});

// Ruta para servir el archivo index.html en la raíz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Ruta para servir la página de usuario
app.get('/usuario.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/usuario.html'));
});

// Ruta para obtener las preguntas de seguridad para un correo electrónico dado
app.post('/security-questions', (req, res) => {
    const { email } = req.body;

    const userQuery = 'SELECT id FROM users WHERE email = ?';
    db.query(userQuery, [email], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error al verificar el correo electrónico' });
        }
        if (results.length === 0) {
            return res.status(400).json({ success: false, message: 'Correo electrónico no encontrado' });
        }

        const userId = results[0].id;

        const questionsQuery = 'SELECT question FROM security_questions WHERE user_id = ?';
        db.query(questionsQuery, [userId], (err, questions) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error al obtener las preguntas de seguridad' });
            }
            res.json({ success: true, questions });
        });
    });
});

// Ruta para verificar las respuestas y cambiar la contraseña
app.post('/change-password', (req, res) => {
    const { email, answers, newPassword } = req.body;

    // Verificar si el correo electrónico existe en la base de datos
    const userQuery = 'SELECT id FROM users WHERE email = ?';
    db.query(userQuery, [email], (err, results) => {
        if (err) {
            console.error('Error al verificar el correo electrónico:', err);
            return res.status(500).json({ success: false, message: 'Error al verificar el correo electrónico' });
        }
        if (results.length === 0) {
            return res.status(400).json({ success: false, message: 'Correo electrónico no encontrado' });
        }

        const userId = results[0].id;

        // Obtener las preguntas de seguridad del usuario
        const answersQuery = 'SELECT question, answer FROM security_questions WHERE user_id = ?';
        db.query(answersQuery, [userId], (err, questions) => {
            if (err) {
                console.error('Error al verificar las respuestas:', err);
                return res.status(500).json({ success: false, message: 'Error al verificar las respuestas' });
            }

            let correctAnswers = 0;
            questions.forEach(q => {
                const userAnswer = answers[q.question];
                console.log(`Pregunta: "${q.question}"`);
                console.log(`Respuesta del usuario: "${userAnswer}"`);
                console.log(`Respuesta correcta: "${q.answer}"`);

                if (userAnswer && userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase()) {
                    correctAnswers++;
                }
            });

            // Si al menos 3 respuestas son correctas, permitir cambiar la contraseña
            if (correctAnswers >= 3) {
                const updatePasswordQuery = 'UPDATE users SET password = ? WHERE id = ?';
                db.query(updatePasswordQuery, [newPassword, userId], (err) => {
                    if (err) {
                        console.error('Error al cambiar la contraseña:', err);
                        return res.status(500).json({ success: false, message: 'Error al cambiar la contraseña' });
                    }

                    // Enviar un SMS de confirmación usando Twilio
                    const getUserPhoneQuery = 'SELECT phone_number FROM users WHERE id = ?';
                    db.query(getUserPhoneQuery, [userId], (err, result) => {
                        if (err) {
                            console.error('Error al obtener el número de teléfono del usuario:', err);
                            return res.status(500).json({ success: false, message: 'Error al enviar el mensaje de confirmación' });
                        }

                        const phone_number = result[0].phone_number;

                        client.messages
                            .create({
                                body: `Hola, tu contraseña ha sido cambiada exitosamente en la casa de cambio A & I.`,
                                from: '+12088359147', // Reemplaza con tu número de Twilio
                                to: phone_number
                            })
                            .then(message => console.log('Mensaje enviado con SID:', message.sid))
                            .catch(err => console.error('Error al enviar el mensaje:', err));

                        res.json({ success: true, message: 'Contraseña cambiada exitosamente' });
                    });
                });
            } else {
                res.status(400).json({ success: false, message: 'Respuestas incorrectas' });
            }
        });
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
