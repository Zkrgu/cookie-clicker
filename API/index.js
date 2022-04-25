/* This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const cors = require('cors');
const http = require('http');

const con = mysql.createPool({
	connectionLimit: 2,
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME
});

const corsOptions = {
	origin: '*',
	allowedHeaders: ['Content-Type'],
}

con.pquery = query => {
	return new Promise((resolve, reject)=>{
		con.query(query, (err,rows) => {
			if(err) return reject(err);
			return resolve(rows);
		});
	});
};

const app = express();

const server = http.createServer(app).listen(process.env.port || 8000, () => {
	console.log(`Server running at http://localhost:${server.address().port}/`);
});

const io = require('socket.io')(server, {
	cors: {
		origin: '*'
	}
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(multer().none());

app.post('/', (req, res) => {
	const keys = Object.keys(req.body);
	if(!keys.includes('ak')
		|| !keys.includes('cid')
		|| !keys.includes('navn')) return res.sendStatus(422);
	if(!keys.includes('tlf') || req.body.tlf == '') req.body.tlf = null;

	if(req.body.navn.length > 255) return res.sendStatus(422);

	io.sockets.emit('resultat', {ak: req.body.ak, cid: req.body.cid, navn: req.body.navn});

	con.pquery(mysql.format(
		'INSERT INTO resultat (klikk, klient_id, navn, tlf) VALUES (?, ?, ?, ?)',
		[req.body.ak, req.body.cid, req.body.navn, req.body.tlf])
	)
		.then(()=>{
			res.sendStatus(200);
		})
		.catch(err => {res.sendStatus(500);})
	console.log(req.body);
});

app.get('/', (req, res) => {
	con.pquery('SELECT klikk as ak, klient_id as cid, navn, created_at as ts FROM resultat').then(rows => {
		res.send(rows);
	}).catch(err => {
		console.log(err);
		res.sendStatus(500);
	});
});

app.get('/klienter', (req,res) => {
	con.pquery('SELECT klienter.klient_id as cid, klienter.navn, COUNT(*) FROM resultat JOIN klienter ON resultat.klient_id = klient.klient_id GROUP BY resultat.klient_id').then(rows => {
		res.send(rows);
	}).catch(err => {
		console.log(err);
		res.sendStatus(500);
	});
});
