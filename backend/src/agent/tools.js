import * as githubService from '../services/github.service.js';

const TOOL_DEFINITIONS = [
  {
    name: 'fetch_repo_structure',
    description: 'Fetches the complete file tree of the repository. Use this first to understand what files exist before deciding which to read.',
    parameters: {
      branch: 'string (optional, defaults to HEAD)'
    }
  },
  {
    name: 'read_file',
    description: 'Reads the raw content of a specific file. Use the path exactly as returned by fetch_repo_structure.',
    parameters: {
      path: 'string (required) — exact file path from the repo tree'
    }
  },
  {
    name: 'search_files',
    description: 'Filters the file tree to find files matching a pattern. Use when looking for specific file types or names without fetching the entire tree again.',
    parameters: {
      pattern: 'string (required) — substring to match against file paths'
    }
  },
  {
    name: 'analyze_package_json',
    description: 'Reads and parses package.json to identify the tech stack, dependencies, and scripts. Use early when the goal involves stack analysis.',
    parameters: {}
  }
];

const FILE_CONTENT_LIMIT = 3000;

function truncate(content) {
  if (content.length <= FILE_CONTENT_LIMIT) return content;
  return content.slice(0, FILE_CONTENT_LIMIT) + '\n[truncated — file is larger, ask for specific sections if needed]';
}

async function executeTool(name, input, context) {
  try {
    switch (name) {
      case 'fetch_repo_structure': {
        const tree = await githubService.fetchRepoTree(context.owner, context.repo, input.branch);
        context.repoTree = tree;
        const summary = tree.map(f => f.path).join('\n');
        return `Repository has ${tree.length} files:\n${summary}`;
      }

      case 'read_file': {
        if (!input.path) return 'Error: path parameter is required for read_file';
        const content = await githubService.readFile(context.owner, context.repo, input.path);
        return truncate(content);
      }

      case 'search_files': {
        if (!input.pattern) return 'Error: pattern parameter is required for search_files';
        if (!context.repoTree) return 'Error: fetch_repo_structure must be called before search_files';
        const matches = context.repoTree
          .filter(f => f.path.includes(input.pattern))
          .map(f => f.path);
        if (matches.length === 0) return `No files found matching pattern: ${input.pattern}`;
        return `Found ${matches.length} file(s) matching "${input.pattern}":\n${matches.join('\n')}`;
      }

      case 'analyze_package_json': {
        const content = await githubService.readFile(context.owner, context.repo, 'package.json');
        return truncate(content);
      }

      default:
        return `Unknown tool: ${name}. Available tools: ${TOOL_DEFINITIONS.map(t => t.name).join(', ')}`;
    }
  } catch (err) {
    return `Tool error (${name}): ${err.message}`;
  }
}

export { TOOL_DEFINITIONS, executeTool };
