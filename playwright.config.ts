import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',fullyParallel:false,use:{baseURL:'http://127.0.0.1:3100',headless:true},webServer:{command:'npm run dev -- --port 3100',url:'http://127.0.0.1:3100',reuseExistingServer:false,env:{APP_ORIGIN:'http://127.0.0.1:3100',PAYPAL_CLIENT_ID:'',PAYPAL_CLIENT_SECRET:''},timeout:120000},reporter:'list'});
