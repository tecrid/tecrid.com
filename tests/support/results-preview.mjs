// Local browser QA only: node tests/support/results-preview.mjs
// Visit http://localhost:3003/tests/fixtures/results-layout.html
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const server = await createServer({
  configFile:false,
  root:new URL('../../', import.meta.url).pathname,
  plugins:[react()],
  server:{host:'127.0.0.1',port:3003,strictPort:true,watch:{usePolling:true,useFsEvents:false}},
});
await server.listen();
server.printUrls();
