require('dotenv').config();
const { analyzeRepo } = require('./src/services/githubService');

analyzeRepo('https://github.com/lodash/lodash')
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(err => console.error('Error:', err.message));
