/* eslint-disable no-undef */
/* eslint-disable no-case-declarations */
const fs = require('fs')
const https = require('https')
require('dotenv').config()

function fetchOrgID() {
  const contentBase = process.env.CONTENT_BASE
  if (!contentBase) {
    console.log('No CONTENT_BASE found in .env')
  } else {
    return contentBase.split('.')[contentBase.split('.').length - 3]
  }
}

function parseSites(sites) {
  const sitesObject = {}
  sites.forEach((site) => {
    sitesObject[site._id] = site._id
  })
  return sitesObject
}

function updateEnvironment(data) {
  const environmentPath = 'environment/index.json'
  const environmentFile = JSON.parse(fs.readFileSync(environmentPath, 'utf-8'))
  const sitesObj = parseSites(JSON.parse(data))
  updatedContent = environmentFile
  updatedContent.siteStyles = sitesObj
  console.log(`Updated ${environmentPath}: \n`, updatedContent)
  fs.writeFileSync(environmentPath, JSON.stringify(updatedContent), 'utf-8')
}

function updateBlocksJSON(data) {
  const blocksPath = 'blocks.json'
  const blocksJSON = JSON.parse(fs.readFileSync(blocksPath, 'utf-8'))

  // const themesVersion = fetchThemesVersion();
  // const themesVersionString =
  //   themesVersion && `arc-themes-release-version-${themesVersion}`;
  // console.log(`Updated themesReleaseVersion: \n`, themesVersionString);

  const orgID = fetchOrgID()
  const siteName = JSON.parse(data)[0]._id
  const updatedResizerURL = `https://${orgID}-${siteName}-sandbox.web.arc-cdn.net/resizer/v2/`
  console.log(`Updated resizerURL: \n`, updatedResizerURL)

  updatedContent = blocksJSON
  updatedContent.values.default.siteProperties.resizerURL = updatedResizerURL
  // updatedContent.themesReleaseVersion = themesVersionString;
  fs.writeFileSync(blocksPath, JSON.stringify(updatedContent), 'utf-8')
}

function fetchSiteData() {
  try {
    const contentBase = process.env.CONTENT_BASE
    const accessToken = process.env.ARC_ACCESS_TOKEN

    if (!contentBase || !accessToken) {
      throw new Error(
        'CONTENT_BASE or ARC_ACCESS_TOKEN is not defined in environment variables.',
      )
    }

    const apiUrl = `${contentBase}/site/v3/website/`

    const options = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }

    const req = https.request(apiUrl, options, (res) => {
      let data = ''

      // A chunk of data has been received.
      res.on('data', (chunk) => {
        data += chunk
      })

      // The whole response has been received.
      res.on('end', () => {
        console.log('Site Data:', data)
        fs.writeFileSync('mocks/siteservice/api/v3/website', data, 'utf-8')
        updateEnvironment(data)
        updateBlocksJSON(data)
      })
    })
    // Handle errors during the request
    req.on('error', (error) => {
      console.error('Error fetching data:', error.message)
    })

    // End the request
    req.end()
  } catch (error) {
    console.error('Error:', error.message)
  }
}

function addToGitignore() {
  const gitignorePath = '.gitignore';

  // Read the current content of .gitignore
  fs.readFile(gitignorePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading ${gitignorePath}: ${err.message}`);
      return;
    }

    // Check if the file is already in .gitignore
    if (data.includes('themes-provisioning.js')) {
      console.log(`File 'themes-provisioning.js' is already in ${gitignorePath}.`);
    } else {
      // Append the file to .gitignore
      const updatedContent = data + `\nthemes-provisioning.js\n`;

      // Write the updated content back to .gitignore
      fs.writeFile(gitignorePath, updatedContent, 'utf8', (writeErr) => {
        if (writeErr) {
          console.error(`Error writing to ${gitignorePath}: ${writeErr.message}`);
        } else {
          console.log(`Added 'themes-provisioning.js' to ${gitignorePath}.`);
        }
      });
    }
  });
}

const command = process.argv[2]

if (!command) {
  console.error('Usage: node themes-provisioning.js <command>')
  process.exit(1)
}

switch (command) {
  case 'pull-site-data':
    fetchSiteData()
    addToGitignore()
    break
  default:
    console.error(`Unknown command: ${command}`)
    process.exit(1)
}
