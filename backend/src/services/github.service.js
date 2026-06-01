import axios from 'axios';

const BASE_URL = 'https://api.github.com';

function getHeaders() {
  const headers = { Accept: 'application/vnd.github.v3+json' };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

function parseRepoUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
  if (!match) throw new Error('Invalid GitHub URL. Expected format: https://github.com/owner/repo');
  return { owner: match[1], repo: match[2] };
}

async function fetchRepoTree(owner, repo, branch = 'HEAD') {
  try {
    const response = await axios.get(
      `${BASE_URL}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers: getHeaders() }
    );
    return response.data.tree
      .filter(item => item.type === 'blob')
      .map(item => ({ path: item.path, type: item.type, size: item.size }));
  } catch (err) {
    if (err.response?.status === 404) throw new Error(`Repository not found: ${owner}/${repo}`);
    if (err.response?.status === 403) throw new Error('GitHub API rate limit exceeded. Set GITHUB_TOKEN for higher limits.');
    throw new Error(`GitHub API error: ${err.message}`);
  }
}

async function readFile(owner, repo, path) {
  try {
    const response = await axios.get(
      `${BASE_URL}/repos/${owner}/${repo}/contents/${path}`,
      { headers: getHeaders() }
    );
    if (!response.data.content) throw new Error(`File not found at path: ${path}`);
    return Buffer.from(response.data.content, 'base64').toString('utf-8');
  } catch (err) {
    if (err.response?.status === 404) throw new Error(`File not found at path: ${path}`);
    if (err.response?.status === 403) throw new Error('GitHub API rate limit exceeded. Set GITHUB_TOKEN for higher limits.');
    if (err.message.startsWith('File not found')) throw err;
    throw new Error(`GitHub API error: ${err.message}`);
  }
}

export { parseRepoUrl, fetchRepoTree, readFile };
