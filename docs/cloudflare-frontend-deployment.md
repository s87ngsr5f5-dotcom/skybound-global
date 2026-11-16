# Cloudflare frontend deployment

Public game: https://skybound-global-13z.pages.dev/
Project: skybound-global
Account ID: cdc3f7811070966a0760bbdcd4065da8
Source: https://github.com/s87ngsr5f5-dotcom/skybound-global
Assets: dist/
Backend: https://skybound-usage.skybound-global-ops.workers.dev

The frontend proxies /api/* and /admin to the existing backend through dist/_worker.js and dist/_routes.json. No backend password or token belongs in the repository.

To update the same public URL from another coding tool, clone this repository, sign into the Cloudflare account above with `npx wrangler login`, run `node run-all-tests.cjs`, then run `npx wrangler pages deploy dist --project-name skybound-global --branch main`.

The old skybound-air.pages.dev project is not present in this account; publishing this project does not change or redirect that old hostname. Cloudflare assigned the suffix -13z because the global skybound-global.pages.dev hostname was unavailable.
