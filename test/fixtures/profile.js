// Two complete product profiles, deliberately sharing no vocabulary.
//
// One profile is not enough: with a single fixture, code that hardcodes one
// product's string still passes every test. Building the same page from two
// profiles and asserting that neither product's words appear in the other's
// output turns that into a mechanical check.
function profile(overrides) {
  const { key, Product, audience, host } = overrides;
  return {
    site: {
      name: `${Product} Daily`,
      host,
      url: `https://${host}`,
      description: `What changed across ${Product} documentation.`,
      productName: Product,
      audience
    },
    brand: {
      wordmark: `Daily.${Product}`,
      ogAlt: `${Product} change intelligence`,
      themeStorageKey: `${key}-theme`,
      tokenStorageKey: `${key}-token`,
      emailEyebrow: `${Product} Daily`,
      logo: `${key}-logo.png`,
      aboutIcon: `/assets/products/${key}.svg`,
      uiAssets: [],
      extraCss: ''
    },
    build: { docsCloneDir: `${key}-docs`, detailDays: 30 },
    links: { related: [], footer: [], stayCurrent: [], followProject: [] },
    identity: {
      docEventPrefix: `${key}-docs`,
      batchEventPrefix: `${key}-news`,
      kitMarkerPrefix: `daily-${key}-news`
    },
    discord: { botName: `${Product} Scout` },
    ai: {
      schemaPrefix: key,
      subject: Product,
      forbiddenOpeners: [`${Product} documentation`],
      impactBoost: new RegExp(key)
    },
    docs: {
      learnRootUrl: `https://learn.example.test/${key}/`,
      trackedPaths: /^docs\//,
      learnRoutes: [{ match: /^docs\/(.*)\.md$/, path: `${key}/$1` }],
      areas: { stripPrefix: /^docs\//, rules: [{ match: /^(.+?)\//, name: '$1' }], fallback: 'General' }
    },
    analytics: { piqoSite: '' },
    messageCenter: { servicePattern: new RegExp(Product, 'i') },
    taxonomy: {
      products: [{ slug: `${key}-core`, name: `${Product} Core`, short: `${Product}`, icon: { file: `${key}.svg` } }],
      topics: [{ slug: 'general', name: 'General', icon: { file: 'general.svg' } }],
      defaultProduct: `${key}-core`,
      defaultTopic: 'general',
      iconSource: { repository: 'https://example.test/icons', revision: '0'.repeat(40) },
      stopwords: 'the and for',
      searchAliases: {}
    },
    classify: { products: [], topics: [] },
    copy: {
      rssFeedLabel: `${Product} feed`,
      messageCenterHeading: `${Product} in Message Center`,
      landing: { heading: `Today in ${Product}`, blurb: `Every ${Product} change.` },
      directory: { productsLede: `${Product} products.`, topicsLede: `${Product} topics.` },
      search: { inputLabel: `Search ${Product}`, placeholder: `Search ${Product}` },
      compare: {
        pageTitle: `Compare ${Product}`, lede: `Compare ${Product} revisions.`,
        placeholderUrl: `https://learn.example.test/${key}/page`, mapping: `${Product} mapping.`
      },
      dailyEmail: { eyebrow: `${Product} Daily`, intro: `Today in ${Product}.` },
      detail: {
        adminHeading: `What ${Product} admins need to know`,
        adminImpactLabel: `For ${Product} administrators`,
        summaryLabel: `${Product} summary`,
        summaryDisclosure: `Written by AI from ${Product} sources.`
      },
      footer: { featureBlurb: `${Product} daily.`, tagline: `${Product} tagline.` },
      about: {
        heading: `About ${Product} Daily`, lede: `${Product} lede.`,
        whyItExists: [`${Product} exists.`], howItWorks: [`${Product} works.`],
        emailEyebrow: `${Product} email`, emailBody: `${Product} email body.`,
        extraSections: [], community: [`${Product} community.`],
        quote: `${Product} quote.`, bio: `${Product} bio.`
      }
    }
  };
}

const ALPHA = profile({ key: 'alpha', Product: 'Alphaproduct', audience: 'Alphaproduct operators', host: 'alpha.test' });
const BETA = profile({ key: 'zeta', Product: 'Zetaproduct', audience: 'Zetaproduct operators', host: 'zeta.test' });

module.exports = { profile, ALPHA, BETA };
