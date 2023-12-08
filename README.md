# Arc Themes Feature Pack

This repository is used by the Arc Themes team for development, testing of Arc Themes Blocks

## How To Do Local Themes Development

Please see [internal documentation](https://arcpublishing.atlassian.net/wiki/spaces/TI/pages/3128033344/How+to+get+setup+with+a+feature+pack) for instructions on how to develop themes locally.

## How To Run Setup Scripts

Add a valid .npmrc file and .env file

Run `node themes-provisioning.js pull-site-data`. This will update your mocks/siteservice/api/v3/website file, environment/index.json file, and the resizerURL in your blocks.json. It will also include the themes-provisioning.js file in the .gitignore so it is not included in the repo you initialize.