import { habameSass } from 'habame-sass';

export default {
    name: '%ProjectName%',
    entry: {
        html: 'public/index.html',
        script: 'src/main.js',
        modules: 'src/main.module.js'
    },
    server: {
        port: 3000,
        wsPort: 3030,
        experimentalHotReload: true
    },
    plugins: {
        view: [],
        script: [],
        style: [
            {
                callback: habameSass,
                options: { includes: ['vars.hb.scss'] }
            }
        ]
    },
    build: {
        outputs: {
            dir: 'dist/',
            files: {
                css: '',
                js: ''
            }
        },
        type: '',
        rollup: {}
    }
};