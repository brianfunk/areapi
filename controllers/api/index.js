/*
                        _____ __________.___ 
_____ _______   ____   /  _  \\______   \   |
\__  \\_  __ \_/ __ \ /  /_\  \|     ___/   |
 / __ \|  | \/\  ___//    |    \    |   |   |
(____  /__|    \___  >____|__  /____|   |___|
     \/            \/        \/              

 */
 
//*******************************************************************

'use strict';

//*******************************************************************
// required modules

const include = require('include')(__dirname);

const Pool = require('pg-pool');
const url = require('url')

//*******************************************************************
// db connection

const params = url.parse(process.env.DATABASE_URL);
const auth = params.auth.split(':');

const config = {
	user: auth[0],
	password: auth[1],
	host: params.hostname,
	port: params.port,
	database: params.pathname.split('/')[1],
	ssl: true
};

console.log('config: '+ JSON.stringify(config) );

const pool = new Pool(config);

//*******************************************************************
// controller

const get = {};

// get id

get.areas = function(req, res){
	
	let start = process.hrtime();
    
	let area = req.params.area;
	let year = req.params.year;
	
	let lat = req.query.latitude; 
	let lon = req.query.longitude; 
	
	let format = req.query.format; 
	let showall = req.query.showall; 
    
	console.log('area: '+ area +' & year: '+ year);
	console.log('lat: '+ lat +' & lon: '+ lon);
	console.log('format: '+ format +' & showall: '+ showall);
			
	let query = 'SELECT type, id, market_cod, market_des ' +
		'FROM '+ area + ' '+ 
		'WHERE '+
		'ST_Within(ST_MakePoint($1, $2), geom )';
		
	console.log('query: '+ query);
		
	let params = [lon, lat];
	
	let resp_json = {};
	
	pool.query(query, params, function (err, rs) {
		
		if (err){
			console.error('db error : ' + err);
			resp_json.status = 'ERROR';
			resp_json.executionTime = process.hrtime(start)[1] / 1000000;
		}
		else {
			
			if (rs.rows <= 0) {
				
				console.error('db error : 0 records');
				resp_json.status = 'NONE';
				resp_json.executionTime = process.hrtime(start)[1] / 1000000;
			}
			else {
				resp_json.area = {}
				resp_json.area.type = rs.rows[0].type;
				resp_json.area.year = year;
				resp_json.area.id = rs.rows[0].id;
				resp_json.area.description = rs.rows[0].market_des;
				resp_json.area.code = rs.rows[0].market_cod;
				resp_json.status = 'OK';
				resp_json.executionTime = process.hrtime(start)[1] / 1000000;
			}			
		}	
		
		res.json(resp_json);
		
	});	
    
};

//*******************************************************************
// exports

module.exports.get = get;
