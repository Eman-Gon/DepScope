const axios = require('axios');

const YOU_API_KEY = process.env.YOU_COM_API_KEY;
const YOU_API_URL = 'https://api.ydc-index.io/search';

async function youSearch(query, numResults = 5) {
  if (!YOU_API_KEY || YOU_API_KEY.includes('your_')) {
    console.warn('You.com API key not configured, returning mock data');
    return [];
  }

  try {
    const response = await axios.get(YOU_API_URL, {
      params: {
        query: query,
        num_web_results: numResults
      },
      headers: {
        'X-API-Key': YOU_API_KEY
      }
    });

    return response.data.results || [];
  } catch (error) {
    console.error('You.com search error:', error.message);
    return [];
  }
}

async function searchCVEs(packageName) {
  const query = `${packageName} CVE vulnerability security advisory`;
  const results = await youSearch(query, 5);
  
  const cves = [];
  for (const result of results) {
    const text = `${result.title} ${result.description || ''}`.toLowerCase();
    const cveMatches = text.match(/cve-\d{4}-\d{4,7}/gi);
    
    if (cveMatches) {
      cveMatches.forEach(cveId => {
        if (!cves.find(c => c.id === cveId.toUpperCase())) {
          cves.push({
            id: cveId.toUpperCase(),
            severity: text.includes('critical') ? 'CRITICAL' : 
                     text.includes('high') ? 'HIGH' : 
                     text.includes('medium') ? 'MEDIUM' : 'LOW',
            description: result.description || result.title,
            source: result.url
          });
        }
      });
    }
  }
  
  return cves;
}

async function searchSentiment(packageName) {
  const query = `${packageName} review opinions problems issues`;
  const results = await youSearch(query, 5);
  
  const positiveSignals = [];
  const negativeSignals = [];
  const sources = [];
  
  for (const result of results) {
    const text = `${result.title} ${result.description || ''}`.toLowerCase();
    
    if (text.match(/great|excellent|love|best|recommended/)) {
      const match = text.match(/(great|excellent|love|best|recommended)[^.!?]*/i);
      if (match) positiveSignals.push(match[0]);
    }
    
    if (text.match(/deprecated|unmaintained|abandoned|buggy|avoid/)) {
      const match = text.match(/(deprecated|unmaintained|abandoned|buggy|avoid)[^.!?]*/i);
      if (match) negativeSignals.push(match[0]);
    }
    
    if (result.url) {
      const source = new URL(result.url).hostname;
      if (!sources.includes(source)) sources.push(source);
    }
  }
  
  return {
    overall: negativeSignals.length > positiveSignals.length ? 'negative' : 
             positiveSignals.length > 0 ? 'positive' : 'neutral',
    positiveSignals: positiveSignals.slice(0, 3),
    negativeSignals: negativeSignals.slice(0, 3),
    sources: sources.slice(0, 3)
  };
}

async function searchAlternatives(packageName) {
  const query = `${packageName} alternative replacement better library`;
  const results = await youSearch(query, 5);
  
  const alternatives = [];
  
  for (const result of results) {
    const text = result.description || result.title;
    const altMatches = text.match(/(?:alternative|vs|instead of|replacement for)\s+(\w+)/gi);
    
    if (altMatches) {
      altMatches.forEach(match => {
        const altName = match.split(/\s+/).pop();
        if (altName.toLowerCase() !== packageName.toLowerCase() && 
            !alternatives.find(a => a.name === altName)) {
          alternatives.push({
            name: altName,
            source: result.url,
            context: text.substring(0, 200)
          });
        }
      });
    }
  }
  
  return alternatives.slice(0, 3);
}

async function researchPackage(packageName) {
  console.log(`Researching ${packageName} with You.com...`);
  
  const [cves, sentiment, alternatives] = await Promise.all([
    searchCVEs(packageName),
    searchSentiment(packageName),
    searchAlternatives(packageName)
  ]);
  
  return {
    cves,
    sentiment,
    alternatives
  };
}

module.exports = {
  researchPackage,
  searchCVEs,
  searchSentiment,
  searchAlternatives
};
