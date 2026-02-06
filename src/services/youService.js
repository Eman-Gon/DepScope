const axios = require('axios');

const YOU_API_KEY = process.env.YOU_COM_API_KEY;
const YOU_API_URL = 'https://ydc-index.io/v1/search';

async function youSearch(query, numResults = 5) {
  if (!YOU_API_KEY || YOU_API_KEY.includes('your_')) {
    console.warn('You.com API key not configured, returning mock data');
    return [];
  }

  try {
    const response = await axios.get(YOU_API_URL, {
      params: {
        query: query,
        count: numResults
      },
      headers: {
        'X-API-Key': YOU_API_KEY
      }
    });

    return response.data.results?.web || [];
  } catch (error) {
    console.error('You.com search error:', error.message);
    return [];
  }
}

function getResultText(result) {
  const snippets = (result.snippets || []).join(' ');
  return `${result.title || ''} ${result.description || ''} ${snippets}`;
}

async function searchCVEs(packageName) {
  const query = `${packageName} CVE vulnerability security advisory`;
  const results = await youSearch(query, 5);
  
  const cves = [];
  for (const result of results) {
    const text = getResultText(result).toLowerCase();
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
  const query = `${packageName} review opinions problems issues reddit hackernews`;
  const results = await youSearch(query, 5);
  
  const positiveSignals = [];
  const negativeSignals = [];
  const sources = [];
  
  for (const result of results) {
    const text = getResultText(result).toLowerCase();
    
    if (text.match(/great|excellent|love|best|recommended|popular|reliable|solid/)) {
      const match = text.match(/(great|excellent|love|best|recommended|popular|reliable|solid)[^.!?\n]*/i);
      if (match) positiveSignals.push(match[0].trim().substring(0, 120));
    }
    
    if (text.match(/deprecated|unmaintained|abandoned|buggy|avoid|slow|bloated|outdated/)) {
      const match = text.match(/(deprecated|unmaintained|abandoned|buggy|avoid|slow|bloated|outdated)[^.!?\n]*/i);
      if (match) negativeSignals.push(match[0].trim().substring(0, 120));
    }
    
    if (result.url) {
      try {
        const source = new URL(result.url).hostname;
        if (!sources.includes(source)) sources.push(source);
      } catch (e) { /* ignore bad URLs */ }
    }
  }
  
  return {
    overall: negativeSignals.length > positiveSignals.length ? 'negative' : 
             positiveSignals.length > 0 ? 'positive' : 'neutral',
    positiveSignals: positiveSignals.slice(0, 3),
    negativeSignals: negativeSignals.slice(0, 3),
    sources: sources.slice(0, 5)
  };
}

async function searchAlternatives(packageName) {
  const query = `"${packageName}" alternative library npm 2025`;
  const results = await youSearch(query, 8);
  
  const alternatives = [];
  // Words that definitely aren't package names
  const stopWords = new Set([
    'the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'is', 'it', 'and', 'or',
    'but', 'with', 'that', 'this', 'its', 'not', 'are', 'was', 'be', 'has',
    'have', 'had', 'do', 'does', 'did', 'will', 'can', 'may', 'should',
    'would', 'could', 'over', 'from', 'into', 'than', 'then', 'also', 'just',
    'more', 'most', 'some', 'such', 'only', 'very', 'each', 'every', 'all',
    'both', 'few', 'many', 'much', 'own', 'same', 'so', 'too', 'quite',
    'rather', 'about', 'above', 'after', 'before', 'below', 'between', 'here',
    'there', 'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom',
    'if', 'no', 'yes', 'like', 'by', 'up', 'out', 'off', 'down', 'well',
    'instead', 'these', 'those', 'them', 'they', 'your', 'our', 'my',
    'smaller', 'larger', 'better', 'faster', 'slower', 'great', 'good',
    'best', 'worst', 'new', 'old', 'modern', 'native', 'built-in',
    'libraries', 'library', 'package', 'module', 'framework', 'tool',
    'javascript', 'typescript', 'node', 'npm', 'yarn', 'code', 'project',
    'type-safe', 'half-dozen', 'close', 'specific', 'common', 'simple',
    'different', 'similar', 'another', 'other', 'however', 'actually',
  ]);

  function looksLikePackageName(name) {
    if (name.length < 3 || name.length > 30) return false;
    if (stopWords.has(name.toLowerCase())) return false;
    if (!/^[a-z@]/i.test(name)) return false;
    // Package names typically contain hyphens, dots, or are single lowercase words
    if (/^[A-Z]/.test(name) && !name.includes('-')) return false; // Skip capitalized English words
    return true;
  }
  
  for (const result of results) {
    const text = getResultText(result);
    const patterns = [
      /([a-z][\w.-]+)\s+(?:is\s+(?:a|an)\s+)?(?:great\s+)?(?:alternative|replacement|substitute|successor)/gi,
      /(?:use|try|consider|switch\s+to|migrate\s+to|check\s+out)\s+([a-z][\w.-]+)/gi,
      /(?:vs\.?\s+|versus\s+)([a-z][\w.-]+)/gi,
      /(?:alternative(?:s)?(?:\s+to\s+\w+)?[\s:,]+)([a-z][\w.-]+)/gi,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const altName = match[1].replace(/[.,;:!?)]+$/, '');
        if (looksLikePackageName(altName) &&
            altName.toLowerCase() !== packageName.toLowerCase() && 
            !alternatives.find(a => a.name.toLowerCase() === altName.toLowerCase())) {
          alternatives.push({
            name: altName,
            source: result.url,
            context: (result.description || result.title || '').substring(0, 200)
          });
        }
      }
    }
  }
  
  return alternatives.slice(0, 5);
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
