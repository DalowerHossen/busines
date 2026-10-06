// postcss.config.mjs
// PostCSS pipeline for Tailwind CSS v4.
//
// Tailwind v4 compiles with Lightning CSS and adds vendor prefixes itself,
// so a separate autoprefixer pass is both unnecessary and a source of
// double prefixing. The browser targets live in the Tailwind config.

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
