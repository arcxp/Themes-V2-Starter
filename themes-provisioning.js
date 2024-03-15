const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const util = require("util");
require("dotenv").config();
// const { promisify } = require('util')
const {execSync} = require("child_process");
// const sleep = promisify(setTimeout)

require("dotenv").config();

// PULL ORG INFO
const contentBase = process.env.CONTENT_BASE;
const authToken = process.env.ARC_ACCESS_TOKEN;
const orgID = fetchOrgID();
const envs = fetchEnvs();
const date = new Date();
const month = String(date.getMonth() + 1).padStart(2, "0");
const day = String(date.getDate()).padStart(2, "0");
const dateStr = `${month}_${day}`;
const zipFileName = `${orgID}_${dateStr}`;
// const zipFileName = `${orgID}-themes-deployment-test`;
// const delay = process.env.POLLING_DELAY || 10000
// const timeout = process.env.TIMEOUT || 30
// let latestServiceVersion = null

function fetchOrgID() {
  if (!contentBase) {
    console.log("No CONTENT_BASE found in .env");
  } else {
    return contentBase.split(".")[contentBase.split(".").length - 3];
  }
}

async function fetchThemesVersion() {
  const apiUrl = `${contentBase}/themesettings/api/blocks-json`;

  const headers = {
    Authorization: `Bearer ${authToken}`,
  };

  const response = await axios.get(apiUrl, {headers});
  return response.data.themesReleaseVersion;
}

function fetchEnvs() {
  const envs = [];
  if (process.env.CONTENT_BASE) {
    envs.push("sandbox");
  }
  if (process.env.DEV_DEPLOYER_ENDPOINT) {
    envs.push("dev");
  }
  if (process.env.STAGING_DEPLOYER_ENDPOINT) {
    envs.push("staging");
  }
  if (process.env.PROD_DEPLOYER_ENDPOINT) {
    envs.push("prod");
  }
  return envs;
}

function fetchEnvironmentVariables(env) {
  let baseUrl = "";
  let auth = "";

  if (env === "sandbox") {
    baseUrl = process.env.CONTENT_BASE;
    auth = process.env.ARC_ACCESS_TOKEN;
  } else if (env === "dev") {
    baseUrl = process.env.STAGING_DEPLOYER_ENDPOINT;
    auth = process.env.STAGING_ACCESS_TOKEN;
  } else if (env === "staging") {
    baseUrl = process.env.DEV_DEPLOYER_ENDPOINT;
    auth = process.env.DEV_ACCESS_TOKEN;
  } else if (env === "prod") {
    baseUrl = process.env.PROD_DEPLOYER_ENDPOINT;
    auth = process.env.PROD_ACCESS_TOKEN;
  }

  return {baseUrl, auth};
}

// PREPARE THE BUNDLE

function parseSites(sites) {
  const sitesObject = {};
  sites.forEach((site) => {
    sitesObject[site._id] = site._id;
  });
  return sitesObject;
}

function findDefaultSite(sites) {
  return sites.find((site) => site.is_default_website === true)._id;
}

function updateEnvironment(data) {
  const environmentPath = "environment/index.json";
  const environmentFile = JSON.parse(fs.readFileSync(environmentPath, "utf-8"));
  const sitesObj = parseSites(data);
  const updatedContent = environmentFile;
  updatedContent.siteStyles = sitesObj;
  console.log(`Updated ${environmentPath}: \n`, updatedContent);
  fs.writeFileSync(
    environmentPath,
    JSON.stringify(updatedContent, null, 2),
    "utf-8"
  );
}

function updateBlocksJSON(data, themesVersion) {
  const blocksPath = "blocks.json";
  const blocksJSON = JSON.parse(fs.readFileSync(blocksPath, "utf-8"));
  const orgID = fetchOrgID();
  const siteName = findDefaultSite(data);
  const updatedResizerURL = `https://${orgID}-${siteName}-sandbox.web.arc-cdn.net/resizer/v2/`;

  const updatedContent = blocksJSON;
  updatedContent.values.default.siteProperties.resizerURL = updatedResizerURL;
  updatedContent.themesReleaseVersion = themesVersion;

  fs.writeFileSync(
    blocksPath,
    JSON.stringify(updatedContent, null, 2),
    "utf-8"
  );
}

async function updateFiles() {
  try {
    if (!contentBase || !authToken) {
      throw new Error(
        "CONTENT_BASE or ARC_ACCESS_TOKEN is not defined in environment variables."
      );
    }

    const apiUrl = `${contentBase}/site/v3/website/`;

    const headers = {
      Authorization: `Bearer ${authToken}`,
    };

    const response = await axios.get(apiUrl, {headers});
    const themesVersion = await fetchThemesVersion();
    console.log("Themes Version:", themesVersion);

    const data = response.data;
    fs.writeFileSync(
      "mocks/siteservice/api/v3/website",
      JSON.stringify(data, null, 2),
      "utf-8"
    );
    updateEnvironment(data);
    updateBlocksJSON(data, themesVersion);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

function updateResizer(resizerVersion) {
  const environmentPath = "environment/index.json";
  const environmentFile = JSON.parse(fs.readFileSync(environmentPath, "utf-8"));
  updatedContent = environmentFile;
  updatedContent.RESIZER_TOKEN_VERSION = resizerVersion;
  console.log(`Updated RESIZER_TOKEN_VERSION to: `, resizerVersion);
  fs.writeFileSync(
    environmentPath,
    JSON.stringify(updatedContent, null, 2),
    "utf-8"
  );
}

async function fetchResizerVersion() {
  try {
    if (!contentBase || !authToken) {
      throw new Error(
        "CONTENT_BASE or ARC_ACCESS_TOKEN is not defined in environment variables."
      );
    }

    const apiUrl = `${contentBase}/delivery-api/v1/organization/hmac-key/resizer?enabled=true`;

    const headers = {
      Authorization: `Bearer ${authToken}`,
    };

    const response = await axios.get(apiUrl, {headers});

    const resizerVersion = response.data[0].ssm_version;
    if (resizerVersion !== 1) {
      updateResizer(resizerVersion);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

function addToGitignore() {
  const gitignorePath = ".gitignore";

  // Read the current content of .gitignore
  fs.readFile(gitignorePath, "utf8", (err, data) => {
    if (err) {
      console.error(`Error reading ${gitignorePath}: ${err.message}`);
      return;
    }

    // Check if the file is already in .gitignore
    if (data.includes("themes-provisioning.js")) {
      console.log(
        `File 'themes-provisioning.js' is already in ${gitignorePath}.`
      );
    } else {
      // Append the file to .gitignore
      const updatedContent = data + `\nthemes-provisioning.js\n`;

      // Write the updated content back to .gitignore
      fs.writeFile(gitignorePath, updatedContent, "utf8", (writeErr) => {
        if (writeErr) {
          console.error(
            `Error writing to ${gitignorePath}: ${writeErr.message}`
          );
        } else {
          console.log(`Added 'themes-provisioning.js' to ${gitignorePath}.`);
        }
      });
    }
  });
}

// ZIP AND DEPLOY THE BUNDLE
function zipBundle(zipFileName) {
  if (!fs.existsSync("dist")) {
    fs.mkdirSync("dist");
    console.log("Created dist folder");
  }

  console.log("Zipping Bundle...");
  execSync(
    `zip dist/${zipFileName}.zip -r . -x ".git/*" ".env" "node_modules/*" "coverage/*" ".github/*" ".fusion/*" ".circleci/*" "data/*" "mocks/*" "dist/*" "src/*.scss" ".stylelintrc.json" "obf-provisioning.js"`
  );
  console.log(`Zipped bundle can be found at dist/${zipFileName}`);
}

async function getUploadMetadata(deployUrl, auth) {
  return axios.get(
    `${deployUrl}/themesettings/api/presigned-bundle-upload?name=${zipFileName}&fileType=application%2Fzip`,
    {
      headers: {
        Authorization: `Bearer ${auth}`,
      },
    }
  );
}

function buildFormData(fields) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    form.append(key, value);
  });
  form.append("file", fs.createReadStream(`dist/${zipFileName}.zip`));

  return form;
}

async function uploadFile(form, uploadUrl) {
  try {
    console.log(`Beginning Upload of ${zipFileName} to ${uploadUrl}`);
    const response = await axios.post(uploadUrl, form, {
      headers: {
        ...form.getHeaders(),
        "Content-Length": await util.promisify(form.getLength.bind(form))(),
      },
    });
    return response;
  } catch (error) {
    // console.error("Upload failed:", error);
    throw error;
  }
}

async function uploadBundle() {
  try {
    zipBundle(zipFileName);
    for (const env of envs) {
      const {baseUrl, auth} = fetchEnvironmentVariables(env);
      try {
        console.log("Requesting upload data from API");
        const {status: apiStatus, data: apiData} = await getUploadMetadata(
          baseUrl,
          auth
        );
        console.log("Status", apiStatus);

        const form = buildFormData(apiData.fields);
        console.log(JSON.stringify(form.getHeaders()));

        const {status: s3Status} = await uploadFile(form, apiData.url, auth);
        console.log(`S3 upload complete: status code ${s3Status}`);
      } catch (error) {
        console.error(
          env,
          "Upload failed, deployment skipped for environment:"
          // env,
          // error
        );
      }
    }
  } catch (error) {
    console.log("There was an error during deployment:", error);
  }
}

async function configureAndDeploy() {
  try {
    addToGitignore();
    await updateFiles();
    await fetchResizerVersion();
    await uploadBundle();
  } catch (error) {
    console.log("There wa an error during deployment:", error);
  }
}

const command = process.argv[2];

if (!command) {
  console.error("Usage: node themes-provisioning.js <command>");
  process.exit(1);
}

switch (command) {
  case "configure-bundle":
    updateFiles();
    fetchResizerVersion();
    addToGitignore();
    break;
  case "zip-bundle":
    zipBundle(zipFileName);
    break;
  case "upload":
    uploadBundle();
    break;
  case "test":
    console.log(themesVersion);
    break;
  case "configure-and-deploy":
    configureAndDeploy();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
