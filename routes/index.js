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

const  express = require('express');
const  router = express.Router();
const  include = require('include')(__dirname);

const areas = include('controllers/api');

//*******************************************************************
// router

// get id
router.get('/api/:area/:year/find', function(req, res){

	console.log('router.get');
	
	areas.get.areas(req, res);

});

//*******************************************************************
//exports

module.exports = router;
