// The engine's public surface. Product repositories reach the generator through
// the subpath exports declared in package.json — `@merill/dailynews-engine/config`,
// `/static-site`, and so on — so that nothing outside can reach into src/ by path
// and become a dependency the engine cannot move.
module.exports = {
  ...require('./src/config'),
  DocsMonitor: require('./src/monitor-docs'),
  ...require('./src/static-site'),
  ...require('./src/update-state'),
  ...require('./src/search-index'),
  ...require('./src/kit-publisher'),
  ...require('./src/discord-publisher'),
  ...require('./src/period-summaries')
};
