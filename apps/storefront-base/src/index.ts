/**
 * STOREFRONT-BASE — the shared, reusable storefront package.
 * Every niche storefront (fashion / electronics / grocery) will re-export from here
 * and optionally override pages/sections/components.
 *
 * This file is the package entry point — every page, section, component we build
 * will be re-exported via index.ts so child storefronts can import them.
 */
export * from "./sections/registry";
