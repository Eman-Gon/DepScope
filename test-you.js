require('dotenv').config();
const { researchPackage } = require('./src/services/youService');

researchPackage('lodash')
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(err => console.error('Error:', err.message));
