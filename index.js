require('dotenv').config();
require('express-async-errors');

const express = require('express');
const app = express();
const cors = require('cors');
var bodyParser = require('body-parser');
const helmet = require("helmet");
const compression = require("compression");

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(helmet());
app.use(compression()); 
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const dsRouter = require('./routes/dsRoutes');
const mainRouter = require('./routes/mainRoutes');

app.use(cors());
app.use(express.json());
app.use(express.static('./public'));
app.use('/api/v1/ds', dsRouter);
app.use('/', mainRouter);

const port = process.env.PORT || 3001;
const start = async () => {
    try {
      app.listen(port, () =>
        console.log(`Server is listening on port ${port}...`)
      );
    } catch (error) {
      console.log(error);
    }
  };
start();
  