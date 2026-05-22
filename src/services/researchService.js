const axios = require('axios');
const config = require('../config');

const OSV_API = 'https://api.osv.dev/v1';
const GITHUB_API = 'https://api.github.com';
const TAVILY_API = 'https://api.tavily.com/search';

function encodePackageName(packageName) {
  return encodeURIComponent(packageName);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getHighestCvssScore(vuln) {
  const scores = [];

  asArray(vuln.severity).forEach(entry => {
    const match = String(entry.score || '').match(/CVSS:\d\.\d\/.+/);
    if (match) {
      const numericMatch = String(entry.score).match(/\/([0-9]\.[0-9])$/);
      if (numericMatch) scores.push(parseFloat(numericMatch[1]));
    }
  });

  if (typeof vuln.cvss?.score === 'number') scores.push(vuln.cvss.score);
  if (typeof vuln.cvss_severities?.cvss_v4?.score === 'number') scores.push(vuln.cvss_severities.cvss_v4.score);
  if (typeof vuln.cvss_severities?.cvss_v3?.score === 'number') scores.push(vuln.cvss_severities.cvss_v3.score);

  return scores.length > 0 ? Math.max(...scores) : null;
}

function severityFromScore(score, fallback = 'LOW') {
  if (score == null) return fallback;
  if (score >= 9) return 'CRITICAL';
  if (score >= 7) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  return 'LOW';
}

function normalizeRepositoryUrl(repository) {
  if (!repository) return null;
  if (typeof repository === 'string') return repository;
  return repository.url || repository.web || null;
}

async function fetchNpmMetadata(packageName) {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${encodePackageName(packageName)}`, {
      timeout: 6000,
    });
    const metadata = response.data;
    const latestVersion = metadata['dist-tags']?.latest || null;
    const latest = latestVersion ? metadata.versions?.[latestVersion] : null;

    return {
      name: metadata.name || packageName,
      description: metadata.description || latest?.description || '',
      latestVersion,
      license: latest?.license || metadata.license || null,
      repositoryUrl: normalizeRepositoryUrl(latest?.repository || metadata.repository),
      homepage: latest?.homepage || metadata.homepage || null,
      deprecated: Boolean(latest?.deprecated || metadata.deprecated),
      deprecationMessage: latest?.deprecated || metadata.deprecated || null,
      maintainers: asArray(metadata.maintainers).map(maintainer => maintainer.name).filter(Boolean),
      keywords: asArray(latest?.keywords || metadata.keywords),
      distTags: metadata['dist-tags'] || {},
      createdAt: metadata.time?.created || null,
      modifiedAt: metadata.time?.modified || null,
    };
  } catch (err) {
    console.warn(`[Research][npm] Metadata unavailable for ${packageName}: ${err.message}`);
    return {
      name: packageName,
      latestVersion: null,
      deprecated: false,
      maintainers: [],
      keywords: [],
      distTags: {},
      error: err.message,
    };
  }
}

async function fetchOsvVulnerabilityDetails(vulnIds) {
  const uniqueIds = [...new Set(vulnIds)].slice(0, 25);
  const results = await Promise.allSettled(uniqueIds.map(id =>
    axios.get(`${OSV_API}/vulns/${encodeURIComponent(id)}`, { timeout: 6000 })
  ));

  return results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value.data);
}

async function fetchOsvAdvisories(packageName, version) {
  const queries = [{ package: { ecosystem: 'npm', name: packageName } }];
  if (version) {
    queries.push({ package: { ecosystem: 'npm', name: packageName }, version });
  }

  try {
    const response = await axios.post(`${OSV_API}/querybatch`, { queries }, { timeout: 8000 });
    const vulnIds = asArray(response.data.results)
      .flatMap(result => asArray(result.vulns))
      .map(vuln => vuln.id)
      .filter(Boolean);
    return fetchOsvVulnerabilityDetails(vulnIds);
  } catch (err) {
    console.warn(`[Research][OSV] Query failed for ${packageName}: ${err.message}`);
    return [];
  }
}

async function fetchGithubAdvisories(packageName) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (config.GITHUB_TOKEN) headers.Authorization = `Bearer ${config.GITHUB_TOKEN}`;

  try {
    const response = await axios.get(`${GITHUB_API}/advisories`, {
      headers,
      params: {
        ecosystem: 'npm',
        affects: packageName,
        per_page: 100,
      },
      timeout: 8000,
    });
    return asArray(response.data);
  } catch (err) {
    console.warn(`[Research][GitHub Advisories] Query failed for ${packageName}: ${err.message}`);
    return [];
  }
}

function extractVersionRangesFromOsv(vuln) {
  return asArray(vuln.affected)
    .flatMap(affected => asArray(affected.ranges))
    .flatMap(range => asArray(range.events))
    .map(event => {
      if (event.introduced) return `>=${event.introduced}`;
      if (event.fixed) return `<${event.fixed}`;
      if (event.last_affected) return `<=${event.last_affected}`;
      return null;
    })
    .filter(Boolean)
    .join(', ');
}

function extractPatchVersionFromOsv(vuln) {
  const fixed = asArray(vuln.affected)
    .flatMap(affected => asArray(affected.ranges))
    .flatMap(range => asArray(range.events))
    .map(event => event.fixed)
    .filter(Boolean);
  return fixed[0] || null;
}

function normalizeOsvAdvisory(vuln) {
  const score = getHighestCvssScore(vuln);
  const cveId = asArray(vuln.aliases).find(alias => alias.startsWith('CVE-')) || null;
  const ghsaId = asArray(vuln.aliases).find(alias => alias.startsWith('GHSA-')) || null;
  const patchVersion = extractPatchVersionFromOsv(vuln);

  return {
    id: vuln.id,
    cveId,
    ghsaId,
    source: 'osv',
    sourceUrl: `https://osv.dev/vulnerability/${vuln.id}`,
    severity: severityFromScore(score, 'LOW'),
    summary: vuln.summary || vuln.details || vuln.id,
    description: vuln.details || vuln.summary || '',
    affectedVersions: extractVersionRangesFromOsv(vuln) || 'unknown',
    patchedVersion: patchVersion,
    patched: Boolean(patchVersion),
    cvssScore: score,
    references: asArray(vuln.references).map(ref => ref.url).filter(Boolean),
    publishedAt: vuln.published || null,
    updatedAt: vuln.modified || null,
  };
}

function normalizeGithubAdvisory(advisory) {
  const npmVuln = asArray(advisory.vulnerabilities)
    .find(vuln => vuln.package?.ecosystem === 'npm');
  const score = getHighestCvssScore(advisory);
  const patchedVersion = npmVuln?.first_patched_version || null;

  return {
    id: advisory.ghsa_id,
    cveId: advisory.cve_id || null,
    ghsaId: advisory.ghsa_id,
    source: 'github-advisory',
    sourceUrl: advisory.html_url || advisory.url,
    severity: String(advisory.severity || severityFromScore(score, 'LOW')).toUpperCase(),
    summary: advisory.summary || advisory.ghsa_id,
    description: advisory.description || advisory.summary || '',
    affectedVersions: npmVuln?.vulnerable_version_range || 'unknown',
    patchedVersion,
    patched: Boolean(patchedVersion),
    cvssScore: score,
    cwes: asArray(advisory.cwes).map(cwe => cwe.cwe_id || cwe.name).filter(Boolean),
    epss: advisory.epss || null,
    references: asArray(advisory.references),
    publishedAt: advisory.published_at || null,
    updatedAt: advisory.updated_at || null,
  };
}

function dedupeAdvisories(advisories) {
  const byId = new Map();
  advisories.forEach(advisory => {
    const key = advisory.cveId || advisory.ghsaId || advisory.id;
    const existing = byId.get(key);
    if (!existing || (advisory.source === 'github-advisory' && existing.source !== 'github-advisory')) {
      byId.set(key, advisory);
    }
  });
  return [...byId.values()];
}

function advisoryToCve(advisory) {
  return {
    id: advisory.cveId || advisory.ghsaId || advisory.id,
    severity: advisory.severity,
    description: advisory.summary,
    source: advisory.sourceUrl,
    affectedVersions: advisory.affectedVersions,
    patched: advisory.patched,
    patchVersion: advisory.patchedVersion,
  };
}

async function tavilySearch(query, options = {}) {
  if (!config.TAVILY_API_KEY || config.TAVILY_API_KEY.includes('your_')) {
    console.warn('[Research][Tavily] TAVILY_API_KEY not configured, skipping web context');
    return { answer: '', results: [], usage: null };
  }

  try {
    const response = await axios.post(
      TAVILY_API,
      {
        query,
        search_depth: options.searchDepth || 'basic',
        max_results: options.maxResults || 5,
        include_answer: options.includeAnswer || false,
        include_raw_content: options.includeRawContent || false,
        include_domains: options.includeDomains,
        exclude_domains: options.excludeDomains,
        topic: options.topic || 'general',
      },
      {
        headers: {
          Authorization: `Bearer ${config.TAVILY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: options.timeout || 10000,
      }
    );

    return {
      answer: response.data.answer || '',
      results: asArray(response.data.results),
      usage: response.data.usage || null,
    };
  } catch (err) {
    console.warn(`[Research][Tavily] Search failed for "${query}": ${err.message}`);
    return { answer: '', results: [], usage: null, error: err.message };
  }
}

function resultText(result) {
  return `${result.title || ''} ${result.content || ''} ${result.raw_content || ''}`.trim();
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function searchSentiment(packageName) {
  const response = await tavilySearch(
    `${packageName} npm package maintenance problems community sentiment GitHub issues Reddit Hacker News`,
    { maxResults: 6, includeAnswer: true }
  );

  const positiveSignals = [];
  const negativeSignals = [];
  const sources = [];

  response.results.forEach(result => {
    const text = resultText(result).toLowerCase();
    const host = hostFromUrl(result.url);
    if (host && !sources.includes(host)) sources.push(host);

    const positive = text.match(/(great|excellent|love|best|recommended|popular|reliable|solid|actively maintained)[^.!?\n]*/i);
    if (positive) positiveSignals.push(positive[0].trim().substring(0, 140));

    const negative = text.match(/(deprecated|unmaintained|abandoned|buggy|avoid|slow|bloated|outdated|security issue)[^.!?\n]*/i);
    if (negative) negativeSignals.push(negative[0].trim().substring(0, 140));
  });

  return {
    overall: negativeSignals.length > positiveSignals.length ? 'negative' :
             positiveSignals.length > 0 ? 'positive' : 'neutral',
    positiveSignals: positiveSignals.slice(0, 3),
    negativeSignals: negativeSignals.slice(0, 3),
    sources: sources.slice(0, 6),
    answer: response.answer,
    rawResults: response.results,
  };
}

function looksLikePackageName(name) {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'npm', 'node',
    'javascript', 'typescript', 'library', 'package', 'alternative',
    'alternatives', 'github', 'reddit', 'hacker', 'news', 'modern',
  ]);
  if (!name || name.length < 2 || name.length > 50) return false;
  if (stopWords.has(name.toLowerCase())) return false;
  return /^(@[a-z0-9-_.]+\/)?[a-z0-9][a-z0-9-_.]*$/i.test(name);
}

function extractAlternativesFromResults(packageName, results) {
  const alternatives = [];
  const patterns = [
    /(?:use|try|consider|switch to|migrate to|check out)\s+(@?[a-z0-9][\w./-]+)/gi,
    /(@?[a-z0-9][\w./-]+)\s+(?:is\s+)?(?:a\s+)?(?:great\s+)?(?:alternative|replacement|substitute|successor)/gi,
    /(?:alternative(?:s)?(?: to [\w.-]+)?[\s:,]+)(@?[a-z0-9][\w./-]+)/gi,
  ];

  results.forEach(result => {
    const text = resultText(result);
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].replace(/[.,;:!?)]+$/, '');
        if (
          looksLikePackageName(name) &&
          name.toLowerCase() !== packageName.toLowerCase() &&
          !alternatives.find(alt => alt.name.toLowerCase() === name.toLowerCase())
        ) {
          alternatives.push({
            name,
            source: result.url,
            context: (result.content || result.title || '').substring(0, 220),
          });
        }
      }
    });
  });

  return alternatives.slice(0, 5);
}

async function searchAlternatives(packageName) {
  const response = await tavilySearch(
    `"${packageName}" npm alternative library replacement TypeScript JavaScript`,
    {
      maxResults: 8,
      includeAnswer: true,
      includeDomains: ['npmjs.com', 'github.com', 'socket.dev', 'npmtrends.com'],
    }
  );

  return {
    alternatives: extractAlternativesFromResults(packageName, response.results),
    answer: response.answer,
    rawResults: response.results,
  };
}

async function searchSupplementalSecurity(packageName) {
  const response = await tavilySearch(
    `${packageName} npm CVE vulnerability security advisory`,
    {
      maxResults: 5,
      includeAnswer: true,
      includeDomains: ['github.com', 'osv.dev', 'nvd.nist.gov', 'security.snyk.io', 'socket.dev'],
    }
  );

  return {
    answer: response.answer,
    sources: response.results.map(result => ({
      title: result.title,
      url: result.url,
      content: result.content,
    })),
  };
}

async function researchPackage(packageName) {
  console.log(`Researching ${packageName} with OSV.dev, GitHub Advisories, npm metadata, and Tavily...`);

  const packageMetadata = await fetchNpmMetadata(packageName);
  const [osvRaw, githubRaw, sentiment, alternativesResult] = await Promise.all([
    fetchOsvAdvisories(packageName, packageMetadata.latestVersion),
    fetchGithubAdvisories(packageName),
    searchSentiment(packageName),
    searchAlternatives(packageName),
  ]);

  const authoritativeAdvisories = dedupeAdvisories([
    ...osvRaw.map(normalizeOsvAdvisory),
    ...githubRaw.map(normalizeGithubAdvisory),
  ]);

  const supplementalSecurity = authoritativeAdvisories.length === 0
    ? await searchSupplementalSecurity(packageName)
    : { answer: '', sources: [] };

  const sources = [
    { type: 'npm', name: 'npm registry', url: `https://www.npmjs.com/package/${packageName}` },
    { type: 'osv', name: 'OSV.dev', url: `https://osv.dev/list?ecosystem=npm&q=${encodeURIComponent(packageName)}` },
    { type: 'github-advisory', name: 'GitHub Advisory Database', url: `https://github.com/advisories?query=ecosystem%3Anpm+${encodeURIComponent(packageName)}` },
    ...sentiment.rawResults.map(result => ({ type: 'tavily-sentiment', name: result.title, url: result.url })),
    ...alternativesResult.rawResults.map(result => ({ type: 'tavily-alternatives', name: result.title, url: result.url })),
    ...supplementalSecurity.sources.map(source => ({ type: 'tavily-security', name: source.title, url: source.url })),
  ].filter(source => source.url);

  return {
    cves: authoritativeAdvisories.map(advisoryToCve),
    sentiment: {
      overall: sentiment.overall,
      positiveSignals: sentiment.positiveSignals,
      negativeSignals: sentiment.negativeSignals,
      sources: sentiment.sources,
    },
    alternatives: alternativesResult.alternatives,
    advisories: authoritativeAdvisories,
    authoritativeAdvisories,
    packageMetadata,
    webContext: {
      sentimentAnswer: sentiment.answer,
      alternativeAnswer: alternativesResult.answer,
      supplementalSecurityAnswer: supplementalSecurity.answer,
      supplementalSecuritySources: supplementalSecurity.sources,
    },
    sources,
  };
}

module.exports = {
  researchPackage,
  fetchNpmMetadata,
  normalizeOsvAdvisory,
  normalizeGithubAdvisory,
  extractAlternativesFromResults,
};
