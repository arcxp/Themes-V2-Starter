/* eslint-disable no-case-declarations */
const fs = require('fs');
const https = require('https');
const path = require('path');

function parseArgs(args) {
  const parsedArgs = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('--') && args[i + 1]) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      parsedArgs[key] = value;
    }
  }
  return parsedArgs;
}

function createFolderStructure(sites = []) {
  const folders = ['themes', 'themes/styles', sites && 'themes/sites'];
  const files = [
    'themes/styles/alias.json',
    'themes/styles/blocks.json',
    'themes/styles/breakpoints.json',
    'themes/styles/components.json',
    'themes/styles/global.json',
  ];

  sites.forEach((site) => {
    folders.push(`themes/sites/${site}`);
    folders.push(`themes/sites/${site}/styles`);
    const siteStyleFiles = [
      `themes/sites/${site}/styles/alias.json`,
      `themes/sites/${site}/styles/blocks.json`,
      `themes/sites/${site}/styles/breakpoints.json`,
      `themes/sites/${site}/styles/components.json`,
      `themes/sites/${site}/styles/global.json`,
    ];
    files.push(...siteStyleFiles);
  });

  folders.forEach((folder) => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }
  });

  files.forEach((file) => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '{}', 'utf-8');
    }
  });

  console.log('Folder structure created successfully');
}

function fetchTokens(theme, version, site) {
  const tokenUrls = [
    {
      url: `https://raw.githubusercontent.com/WPMedia/arc-themes-blocks/arc-themes-release-version-${version}/blocks/global-tokens/themes/${theme}.json`,
      localFile: site ? `themes/sites/${site}/styles/global.json` : 'themes/styles/global.json',
    },
    {
      url: `https://raw.githubusercontent.com/WPMedia/arc-themes-blocks/arc-themes-release-version-${version}/blocks/alias-tokens/themes/${theme}.json`,
      localFile: site ? `themes/sites/${site}/styles/alias.json` : 'themes/styles/alias.json',
    },
    {
      url: `https://raw.githubusercontent.com/WPMedia/arc-themes-blocks/arc-themes-release-version-${version}/blocks/breakpoint-tokens/themes/${theme}.json`,
      localFile: site
        ? `themes/sites/${site}/styles/breakpoints.json`
        : 'themes/styles/breakpoints.json',
    },
  ];

  tokenUrls.forEach(({ url, localFile }) => {
    https
      .get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const remoteData = JSON.parse(data);
          fs.writeFileSync(localFile, JSON.stringify(remoteData, null, 2));
          console.log(`Successfully updated ${localFile}`);
        });
      })
      .on('error', (err) => {
        console.error(`Error: ${err.message}`);
      });
  });
}

function fetchStyles(block, theme, version, site) {
  const url = `https://raw.githubusercontent.com/WPMedia/arc-themes-blocks/arc-themes-release-version-${version}/blocks/${block}/themes/${theme}.json`;
  const writePath = site ? `themes/sites/${site}/styles/blocks.json` : 'themes/styles/blocks.json';
  const localFile = path.join(__dirname, writePath);

  https
    .get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const remoteData = JSON.parse(data);
        let localData = {};

        if (fs.existsSync(localFile)) {
          localData = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
        }

        const updatedData = { ...localData, ...remoteData };
        fs.writeFileSync(localFile, JSON.stringify(updatedData, null, 2));
        console.log(`Successfully updated ${localFile}`);
      });
    })
    .on('error', (err) => {
      console.error(`Error: ${err.message}`);
    });
}

function fetchComponentStyles(component, theme, version, site) {
  const url = `https://raw.githubusercontent.com/WPMedia/arc-themes-components/arc-themes-release-version-${version}/src/components/${component}/themes/${theme}.json`;
  const writePath = site
    ? `themes/sites/${site}/styles/components.json`
    : 'themes/styles/components.json';
  const localFile = path.join(__dirname, writePath);

  https
    .get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const remoteData = JSON.parse(data);
        let localData = {};

        if (fs.existsSync(localFile)) {
          localData = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
        }

        const updatedData = { ...localData, ...remoteData };
        fs.writeFileSync(localFile, JSON.stringify(updatedData, null, 2));
        console.log(`Successfully updated ${localFile}`);
      });
    })
    .on('error', (err) => {
      console.error(`Error: ${err.message}`);
    });
}

const command = process.argv[2];

if (!command) {
  console.error('Usage: node arc-themes.js <command> [options]');
  process.exit(1);
}

switch (command) {
  case 'init':
    const sites = parseArgs(process.argv.slice(3)).sites
      ? parseArgs(process.argv.slice(3)).sites.split(',')
      : [];
    createFolderStructure(sites);
    break;
  case 'get-tokens':
    const { theme, version, site } = parseArgs(process.argv.slice(3));
    if (!theme || !version) {
      console.error(
        'Usage: node arc-themes.js get-tokens --theme <theme> --version <version> [--site <site>]',
      );
      process.exit(1);
    }
    fetchTokens(theme, version, site);
    break;
  case 'get-styles':
    const {
      block,
      theme: blockTheme,
      version: blockVersion,
      site: blockSite,
    } = parseArgs(process.argv.slice(3));
    if (!block || !blockTheme || !blockVersion) {
      console.error(
        'Usage: node arc-themes.js get-styles --block <block> --theme <theme> --version <version> [--site <site>]',
      );
      process.exit(1);
    }
    fetchStyles(block, blockTheme, blockVersion, blockSite);
    break;
  case 'get-component-styles':
    const {
      component,
      theme: compTheme,
      version: compVersion,
      site: compSite,
    } = parseArgs(process.argv.slice(3));
    if (!component || !compTheme || !compVersion) {
      console.error(
        'Usage: node arc-themes.js get-styles --component <component> --theme <theme> --version <version> [--site <site>]',
      );
      process.exit(1);
    }
    fetchComponentStyles(component, compTheme, compVersion, compSite);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
