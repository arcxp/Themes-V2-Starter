const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const util = require("util");
require("dotenv").config();
const {promisify} = require("util");
const {execSync} = require("child_process");
const sleep = promisify(setTimeout);

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
const delay = process.env.POLLING_DELAY || 10000;
const timeout = process.env.TIMEOUT || 30;
// let latestServiceVersion = null

// Load all tables:
async function loadTables() {
  const tables = ["build", "values", "blocks", "blocks-json"];
  const maxRetries = 10;
  const delay = 3000; // 3 seconds
  console.log("Checking Themes tables");
  for (const env of envs) {
    const {baseUrl, auth} = await fetchEnvironmentVariables(env);
    const headers = {
      Authorization: `Bearer ${auth}`,
    };

    for (const table of tables) {
      let retries = 0;
      while (retries < maxRetries) {
        const apiUrl = `${baseUrl}/themesettings/api/${table}`;
        try {
          const response = await axios.get(apiUrl, {headers});
          if (response.status === 200) {
            console.log(`Successfully fetched ${table} data for ${env}`);
            break;
          }
        } catch (error) {
          if (retries === 0) {
            console.log("Could not fetch data, attempting to create new build");
            await createBuild(baseUrl, auth);
          } else {
            console.error(
              `Unable to fetch ${table} data for ${env}, trying again`
            );
          }
          retries++;
          if (retries === maxRetries) {
            console.error(`Exceeded maximum retries for ${env} - ${table}`);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    console.log("Themes Tables have loaded");
  }
}

function fetchOrgID() {
  if (!contentBase) {
    console.log("No CONTENT_BASE found in .env");
  } else {
    return contentBase.split(".")[contentBase.split(".").length - 3];
  }
}

async function fetchThemesVersion(retries = 0) {
  //Make sure there is an active build so the blocks-json endpoint returns data
  const buildStatus = await getBuildStatus(contentBase, authToken);
  if (!buildStatus || buildStatus === null || buildStatus === "COMPLETE") {
    console.log("Creating New Build");
    const buildNum = await createBuild(contentBase, authToken);
  }

  const apiUrl = `${contentBase}/themesettings/api/blocks-json`;

  const headers = {
    Authorization: `Bearer ${authToken}`,
  };

  try {
    const response = await axios.get(apiUrl, {headers});
    if (response.status === 200) {
      return response.data.themesReleaseVersion;
    } else {
      if (retries < 10) {
        console.log(`Received ${response.status} response, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
        return fetchThemesVersion(retries + 1); // Retry
      } else {
        throw new Error("Exceeded maximum retry attempts");
      }
    }
  } catch (error) {
    console.error("Error fetching themes version:", error);
    process.exit(1);
  }
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

async function fetchEnvironmentVariables(env) {
  let baseUrl = "";
  let auth = "";
  let resizerUrl = "";
  const defaultSite = await fetchDefaultSiteId();
  if (env === "sandbox") {
    baseUrl = process.env.CONTENT_BASE;
    auth = process.env.ARC_ACCESS_TOKEN;
    resizerUrl = `https://${orgID}-${defaultSite}-sandbox.web.arc-cdn.net/resizer/v2/`;
  } else if (env === "staging") {
    baseUrl = process.env.STAGING_DEPLOYER_ENDPOINT;
    auth = process.env.STAGING_ACCESS_TOKEN;
    resizerUrl = `https://${orgID}-${defaultSite}-staging.web.arc-cdn.net/resizer/v2/`;
  } else if (env === "dev") {
    baseUrl = process.env.DEV_DEPLOYER_ENDPOINT;
    auth = process.env.DEV_ACCESS_TOKEN;
    resizerUrl = `https://${orgID}-${defaultSite}-dev.web.arc-cdn.net/resizer/v2/`;
  } else if (env === "prod") {
    baseUrl = process.env.PROD_DEPLOYER_ENDPOINT;
    auth = process.env.PROD_ACCESS_TOKEN;
    resizerUrl = `https://${orgID}-${defaultSite}-prod.web.arc-cdn.net/resizer/v2/`;
  }

  return {baseUrl, auth, resizerUrl};
}

// PREPARE THE BUNDLE

function parseSites(sites) {
  const sitesObject = {};
  sites.forEach((site) => {
    sitesObject[site._id] = site._id;
  });
  return sitesObject;
}

async function fetchDefaultSiteId() {
  baseURL = contentBase || process.env.PROD_DEPLOYER_ENDPOINT;
  auth = authToken || process.env.PROD_ACCESS_TOKEN;

  const apiUrl = `${baseURL}/site/v3/website/`;
  const headers = {
    Authorization: `Bearer ${auth}`,
  };

  try {
    const response = await axios.get(apiUrl, {headers});
    if (response.status === 200) {
      const data = response.data;
      const defaultSite = data.find((site) => site.is_default_website === true);
      if (defaultSite) {
        return defaultSite._id;
      } else {
        console.log("No default site found. Using Org ID");
        return orgID;
      }
    } else {
      throw new Error(`Failed to fetch data, status code: ${response.status}`);
    }
  } catch (error) {
    console.error("Error fetching default site ID or orgId:", error);
    process.exit(1);
  }
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

async function updateBlocksJSON(data, themesVersion, defaultSite) {
  const sitesObject = {};

  data.forEach((site) => {
    sitesObject[site._id] = {
      siteProperties: {
        websiteName: site.display_name || site._id,
      },
    };
  });

  const blocksPath = "blocks.json";
  const blocksJSON = JSON.parse(fs.readFileSync(blocksPath, "utf-8"));
  const orgID = fetchOrgID();

  const updatedResizerURL = `https://${orgID}-${defaultSite}-sandbox.web.arc-cdn.net/resizer/v2/`;

  const updatedContent = blocksJSON;
  updatedContent.values.default.siteProperties.resizerURL = updatedResizerURL;
  updatedContent.themesReleaseVersion = themesVersion;
  updatedContent.values.sites = sitesObject;

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
    const themesVersion = "arc-themes-release-version-4.0.0";
    const defaultSite = await fetchDefaultSiteId();
    console.log("Themes Version:", themesVersion);

    const data = response.data;
    fs.writeFileSync(
      "mocks/siteservice/api/v3/website",
      JSON.stringify(data, null, 2),
      "utf-8"
    );
    updateEnvironment(data);
    await updateBlocksJSON(data, themesVersion, defaultSite);
  } catch (error) {
    console.error("Error Updating Files:", error.message);
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
    console.error("Error Fetching Resizer Version:", error);
  }
}

function addToGitignore() {
  const gitignorePath = ".gitignore";

  return new Promise((resolve, reject) => {
    fs.readFile(gitignorePath, "utf8", (err, data) => {
      if (err) {
        console.error(`Error reading ${gitignorePath}: ${err.message}`);
        reject(err);
        return;
      }

      if (data.includes("themes-provisioning.js")) {
        console.log(
          `File 'themes-provisioning.js' is already in ${gitignorePath}.`
        );
        resolve();
      } else {
        const updatedContent = data + `\nthemes-provisioning.js\n`;

        fs.writeFile(gitignorePath, updatedContent, "utf8", (writeErr) => {
          if (writeErr) {
            console.error(
              `Error writing to ${gitignorePath}: ${writeErr.message}`
            );
            reject(writeErr);
          } else {
            console.log(`Added 'themes-provisioning.js' to ${gitignorePath}.`);
            resolve();
          }
        });
      }
    });
  });
}

async function configureBundle() {
  try {
    // await loadTables();
    await updateFiles();
    await fetchResizerVersion();
    await addToGitignore();
  } catch (error) {
    console.log("There was an error during bundle configuration:", error);
  }
}

// ZIP AND DEPLOY THE BUNDLE
function zipBundle(zipFileName) {
  if (!fs.existsSync("dist")) {
    fs.mkdirSync("dist");
    console.log("Created dist folder");
  }

  console.log("Zipping Bundle...");
  execSync(
    `zip dist/${zipFileName}.zip -r . -x ".git/*" ".env" ".npmrc" "node_modules/*" "coverage/*" ".github/*" ".fusion/*" ".circleci/*" "data/*" "mocks/*" "dist/*" "src/*.scss" ".stylelintrc.json" "obf-provisioning.js"`
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
    console.error("Upload failed:", error);
    throw error;
  }
}

async function uploadAndDeploy(environments = envs) {
  try {
    zipBundle(zipFileName);
    for (const env of environments) {
      const {baseUrl, auth, resizerUrl} = await fetchEnvironmentVariables(env);
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
          "Upload failed, deployment skipped for environment: ", env
        );
      }

      const buildStatus = getBuildStatus(baseUrl, auth);
      if (!buildStatus || buildStatus === null || buildStatus === "COMPLETE") {
        console.log("Creating New Build");
        const buildNum = await createBuild(baseUrl, auth);
      }
      await updateFields(baseUrl, auth, resizerUrl);
      await selectBundle(baseUrl, auth);
      await completeBuild(baseUrl, auth);
      await checkDeployment(baseUrl, auth);
      await promoteBuild(baseUrl, auth);
      console.log(`Build successfully deployed in ${env}`);
      // else {
      //   console.log(
      //     `There is an active build in the ${env} environment.\n Complete the current build and rerun command`
      //   );
      // }
    }
  } catch (error) {
    console.log("There was an error during deployment:", error);
  }
}

async function createBuild(baseUrl, auth) {
  const apiUrl = `${baseUrl}/themesettings/api/build`;
  const headers = {
    Authorization: `Bearer ${auth}`,
  };

  try {
    const response = await axios.post(apiUrl, {}, {headers});
    console.log(`${response?.data?.buildNum || "Build" } created`);
    return response.build.buildNum;
  } catch (error) {
    console.error("Error creating build:", error);
  }
}

async function updateFields(baseUrl, auth, resizerUrl) {
  const apiUrl = `${baseUrl}/themesettings/api/values`;

  const headers = {
    Authorization: `Bearer ${auth}`,
  };

  const body = {
    siteId: "default",
    build: "latest",
    fields: [
      {
        fieldId: "resizerURL",
        value: resizerUrl,
      },
      {
        fieldId: "fallbackImage",
        value:
          "https://static.themebuilder.aws.arc.pub/themesinternal-sandbox/1622831876027.png",
      },
    ],
  };

  try {
    const response = await axios.post(apiUrl, body, {headers});
    console.log("Fields updated successfully");
  } catch (error) {
    console.error("Error updating fields:", error);
    throw error;
  }
}

function getBlocks() {
  try {
    const blocksArray = JSON.parse(
      fs.readFileSync("blocks.json", "utf-8")
    ).blocks;
    return blocksArray;
  } catch (error) {
    console.error("Error reading blocks.json:", error);
    throw error;
  }
}

async function selectBundle(baseUrl, auth) {
  const blocksArray = getBlocks();
  const apiUrl = `${baseUrl}/themesettings/api/blocks`;

  const headers = {
    Authorization: `Bearer ${auth}`,
  };

  const body = {
    blocks: blocksArray,
    bundleVersion: zipFileName,
    build: "latest",
  };

  try {
    const response = await axios.post(apiUrl, body, {headers});
    console.log("Bundle successfully selected");
  } catch (error) {
    console.error("Error updating fields:", error);
    throw error;
  }
}

async function completeBuild(baseUrl, auth) {
  const apiUrl = `${baseUrl}/themesettings/api/complete-build`;

  const headers = {
    Authorization: `Bearer ${auth}`,
  };

  try {
    const response = await axios.post(apiUrl, {}, {headers});
    console.log(`Build #${response.data.buildNum} Completed`);
  } catch (error) {
    console.error("Error completing build:", error);
    throw error;
  }
}

async function getBuildStatus(baseUrl, auth) {
  const apiUrl = `${baseUrl}/themesettings/api/build`;

  const headers = {
    Authorization: `Bearer ${auth}`,
  };

  try {
    const response = await axios.get(apiUrl, {headers});
    console.log("Build Status: ", response?.data?.build?.status);
    return response.data?.build?.status;
  } catch (error) {
    console.error("Error checking build status:", error);
    throw error;
  }
}

async function checkDeployment(baseUrl, auth) {
  console.log(`Checking if deployment has completed...`);

  for (let i = 0; i < timeout; i += 1) {
    await sleep(delay);
    const buildStatus = await getBuildStatus(baseUrl, auth);
    if (buildStatus === "COMPLETE") return buildStatus;
  }

  throw new Error(
    "Bundle did not deploy within the set time. Further investigation required. One possible solution is to increase the timeout, if the bundle was eventually deployed"
  );
}

async function promoteBuild(baseUrl, auth) {
  const apiUrl = `${baseUrl}/themesettings/api/promote-build`;

  const headers = {
    Authorization: `Bearer ${auth}`,
  };

  try {
    const response = await axios.post(apiUrl, {}, {headers});
    console.log(`Build #${response.data.buildNum} Promoted Successfully`);
  } catch (error) {
    console.error("Error promoting build:", error);
    throw error;
  }
}

async function configureAndDeploy(environments = envs) {
  try {
    await addToGitignore();
    // await loadTables();
    await updateFiles();
    await fetchResizerVersion();
    await uploadAndDeploy(environments);
  } catch (error) {
    console.log("There was an error during deployment:", error);
  }
}

async function createRepo() {
  await addToGitignore();
  const execSettings = {stdio: "inherit"};

  try {
    execSync("git init", execSettings);

    execSync(
      "git rm --cached --ignore-unmatch themes-provisioning.js",
      execSettings
    );
    console.log("Removed themes-provisioning.js from git cache");

    execSync("git add .", execSettings);
    console.log("Added all files to git");

    execSync('git commit -m "Initial commit"', execSettings);
    console.log("Committed changes");

    execSync(
      `gh repo create arcxp-ce-support/${orgID}-Themes2-Mirror --private`,
      execSettings
    );
    console.log("Created GitHub repository");

    execSync(
      `git remote set-url origin git@github.com:arcxp-ce-support/${orgID}-Themes2-Mirror.git`,
      execSettings
    );
    console.log("Set remote URL to new repo");

    execSync("git push -u origin main", execSettings);
    console.log(
      `Pushed to remote. Repo can be found at https://github.com/arcxp-ce-support/${orgID}-Themes2-Mirror`
    );
  } catch (error) {
    console.error(
      "Error:",
      error.stderr ? error.stderr.toString() : error.toString()
    );
  }
}

const command = process.argv[2];
const environments = process.argv[3]?.split(",");

if (!command) {
  console.error("Usage: node themes-provisioning.js <command>");
  process.exit(1);
}

switch (command) {
  case "load-tables":
    loadTables();
    break;
  case "configure-bundle":
    configureBundle();
    break;
  case "zip-bundle":
    zipBundle(zipFileName);
    break;
  case "upload":
    uploadAndDeploy(environments);
    break;
  case "configure-and-deploy":
    configureAndDeploy(environments);
    break;
  case "create-repo":
    createRepo();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
