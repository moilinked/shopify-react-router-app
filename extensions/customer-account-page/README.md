# Customer account UI Extension

## Prerequisites

Before you start building your extension, make sure that you’ve created a [development store](https://shopify.dev/docs/apps/tools/development-stores) with the [Checkout and Customer Accounts Extensibility](https://shopify.dev/docs/api/release-notes/developer-previews#previewing-new-features).

## Your new Extension

Your new extension contains the following files:

- `README.md`, the file you are reading right now.
- `shopify.extension.toml`, the configuration file for your extension. This file defines your extension’s name.
- `src/*.jsx`, the source code for your extension.
- `locales/en.default.json`, `locales/fr.json`, and `locales/de.json`, which contain translations used to [localized your extension](https://shopify.dev/docs/apps/checkout/best-practices/localizing-ui-extensions).

## Loyalty data

The loyalty hub calls `app/pages/api/shopify-extensions/loyalty-page.tsx` with the customer account session token. The init response aggregates Smile customer profile, VIP tiers, points products, and earning rules. `EarnPointsSection` renders Smile `/earning_rules`, filters tiered rules such as birthday and order by the current VIP tier, and maps known Smile rule name prefixes to locale keys in `locales/*.json`. Its card layout follows the Figma desktop/mobile variants: two columns above the 948px container breakpoint, one column below it, with 40px icon slots and mobile title/points alignment on the first row. `RedeemSection` uses the same responsive card grid for loading placeholders and loaded reward products, with skeleton content matching the image, progress, status, and CTA areas.

When the extension runs in the Shopify admin editor, or when the editor preview cannot provide a usable customer account session token, `src/api.ts` returns local mock loyalty data from `src/editorMockData.ts`. Runtime customer views still call the backend API with the customer account session token.

## Useful Links

- [Customer account UI extension documentation](https://shopify.dev/docs/api/customer-account-ui-extensions)
  - [Configuration](https://shopify.dev/docs/api/customer-account-ui-extensions/unstable/configuration)
  - [API Reference](https://shopify.dev/docs/api/customer-account-ui-extensions/unstable/apis)
  - [UI Components](https://shopify.dev/docs/api/customer-account-ui-extensions/unstable/components)
