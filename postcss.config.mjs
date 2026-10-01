// postcss.config.mjs
// PostCSS pipeline for Tailwind CSS and vendor prefixing.

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
