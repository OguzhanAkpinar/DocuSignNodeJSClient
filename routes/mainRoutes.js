const express = require('express');
const router = express.Router();

const { 
   result
} = require('../controllers/mainController');

router
  .route('/result')
  .get(result);
  
module.exports = router;