import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true,
    }),
  },
  csrf: {
    trustedOrigins: ['tailscale:*', 'http://100.*:*', 'http://192.168.*:*', 'http://10.*:*'],
  },
  vitePlugin: {
    dynamicCompileOptions: ({ filename }) => (filename.includes('node_modules') ? undefined : { runes: true }),
  },
};

export default config;
