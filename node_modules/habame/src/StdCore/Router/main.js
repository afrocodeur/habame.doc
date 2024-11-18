import Router from "StdCore/Router/Router/Router";
import "StdCore/Router/Component/Router";
import "StdCore/Router/Component/Link";
import RouterService from "StdCore/Router/RouterService";
import { DEFAULT_ROUTER_NAME } from "StdCore/Router/constants";
import BrowserHistory from "StdCore/Router/History/BrowserHistory";

const HabameRouter = function(Habame) {

    /** @type {Object.<string, Router>} */
    const $routers = {};

    return {

        /**
         * @param {string} name
         * @param {{ history?: Object, browserHistory?: boolean }} options
         *
         * @returns {Router}
         */
        createRouter: function(name, options) {
            name = name || DEFAULT_ROUTER_NAME;
            if($routers[name] instanceof Router) {
                throw new Error('router : '+ name +' already exists');
            }

            const router = new Router(name, Habame);
            let history = null;

            if(options && options.browserHistory === true) {
                history = new BrowserHistory();
            }
            else if(options && options.history) {
                history = options.history;
            }

            Habame.createService(DEFAULT_ROUTER_NAME, RouterService, { params: [router, history] });
            $routers[name] = router;
            return router;
        },
        /**
         * @returns {Router}
         */
        createBrowserRouter: function() {
            return Habame.Router.createRouter(null, { browserHistory: true });
        },
        /**
         * @param {string} name
         *
         * @returns {Router}
         */
        getRouter: function(name) {
            name = name || DEFAULT_ROUTER_NAME;
            if(!($routers[name] instanceof Router)) {
                throw new Error('Undefined router '+ name);
            }
            return $routers[name];
        }

    };
};

export default HabameRouter;