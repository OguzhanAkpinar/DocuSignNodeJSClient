const express = require('express');
const router = express.Router();

const { 
   createEnvelope,
   getEnvelope,
   getDocument,
   createRecipientView
} = require('../controllers/dsController');

router
  .route('/createEnvelope')
  .post(createEnvelope);

  router
  .route('/createRecipientView')
  .post(createRecipientView);

  router
  .route('/getEnvelope/:envelopeId')
  .get(getEnvelope);

  router
  .route('/getDocument/:envelopeId/:documentId')
  .get(getDocument);

module.exports = router;