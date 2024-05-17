# Arc Themes Feature Pack

This repository is an Arc Themes Starter bundle. For more detailed information on how to run Pagebuilder Engine locally, visit [this doc](https://docs.arcxp.com/alc/en/how-to-run-pagebuilder-engine-locally-starting-with-my-organization-s-live?sys_kb_id=fde031b3938e86504792b0cdfaba102c&id=kb_article_view&sysparm_rank=1&sysparm_tsqueryId=faf2652c93d68a504792b0cdfaba105d)

## Docker
The Fusion engine and services that support it run in Docker containers that can be spun up for local development. To do so, you'll need to download and install Docker if you haven't already. Once you've installed Docker, you'll probably want to allocate at least 6GB of RAM to it so it has the resources necessary to run all the services Fusion requires.

## Blocks.json
The initial starter repo has all the blocks, please make sure to remove all that are not needed, also please remove any blocks if you have the same name as a custom block.
Make sure `"buildSiteStyles": true,` is included for the styling to work locally.

## Environment Variables
If you don't already have a `.env` file in the root directory, create the file and add:
```
CONTENT_BASE=https://api.sandbox.vanguardiaeluniversal.arcpublishing.com
ARC_ACCESS_TOKEN=<<YOUR-ACCESS-TOKEN>>
FUSION_RELEASE=<<Fusion-Version>> If no fusion version is specified the latest will be added by default
```

## NPMRC
To be able to run locally, you need to create a read-only token in [Github](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token). This token needs to be added to your `.npmrc` file and will allow you to view and install Themes blocks locally. The `.npmrc` file must never be added to the repo or checked in. Note: A `.npmrc-encrypted` file will be added by PageBuilder Engine when zipping the bundle for non-local environments. Please use the following format when setting up your .npmrc:
```
@wpmedia:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=<<PASTE-HERE>>
```

## Starting Fusion
1. Download the `node_modules`: `npm install`
2. To run fusion: `npx fusion start`
3. Navigate to `http://localhost/pagebuilder/pages` to see the PageBuilder Admin.

## Stopping Fusion
The server needs to be running while you are developing locally, but when you need to stop it, use this command: `npx fusion down`
