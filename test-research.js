const assert = require('assert');
const {
  normalizeOsvAdvisory,
  normalizeGithubAdvisory,
  extractAlternativesFromResults,
} = require('./src/services/researchService');

const osv = normalizeOsvAdvisory({
  id: 'GHSA-test-1234-5678',
  aliases: ['CVE-2025-0001'],
  summary: 'Prototype pollution in sample package',
  details: 'Sample details',
  affected: [{
    ranges: [{
      events: [{ introduced: '0' }, { fixed: '1.2.3' }],
    }],
  }],
  references: [{ url: 'https://osv.dev/vulnerability/GHSA-test-1234-5678' }],
});

assert.equal(osv.cveId, 'CVE-2025-0001');
assert.equal(osv.patchedVersion, '1.2.3');
assert.equal(osv.patched, true);
assert.equal(osv.source, 'osv');

const ghsa = normalizeGithubAdvisory({
  ghsa_id: 'GHSA-abcd-1234-efgh',
  cve_id: 'CVE-2025-0002',
  html_url: 'https://github.com/advisories/GHSA-abcd-1234-efgh',
  summary: 'High severity issue',
  description: 'Detailed advisory',
  severity: 'high',
  vulnerabilities: [{
    package: { ecosystem: 'npm', name: 'sample' },
    vulnerable_version_range: '<1.0.3',
    first_patched_version: '1.0.3',
  }],
  cvss_severities: { cvss_v3: { score: 7.5 } },
});

assert.equal(ghsa.severity, 'HIGH');
assert.equal(ghsa.affectedVersions, '<1.0.3');
assert.equal(ghsa.patchedVersion, '1.0.3');
assert.equal(ghsa.source, 'github-advisory');

const alternatives = extractAlternativesFromResults('lodash', [{
  title: 'Modern lodash alternatives',
  url: 'https://example.com/lodash-alternatives',
  content: 'Consider remeda or migrate to es-toolkit for modern TypeScript projects.',
}]);

assert(alternatives.some(alt => alt.name === 'remeda'));
assert(alternatives.some(alt => alt.name === 'es-toolkit'));

console.log('Research normalization tests passed');
