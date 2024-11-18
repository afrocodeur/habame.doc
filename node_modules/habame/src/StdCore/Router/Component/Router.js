import { DEFAULT_ROUTER_NAME } from "StdCore/Router/constants";
import Route from "StdCore/Router/Router/Route";
import MiddlewareHandler from "StdCore/Router/Router/MiddlewareHandler";
import BrowserHistory from "StdCore/Router/History/BrowserHistory";

const RouterView = {
    name: 'div',
    ref: 'routerRenderContainer',
    attrs: {
        id: '{{ id }}'
    }
};

/**
 * @param {Habame} Habame
 */
export default function Router(Habame) {
    Habame.createComponent('Router', function({ Props, State, Refs, App, Lifecycle }) {
        State.init({
            id: Props.id || ''
        });

        const middlewareHandler = new MiddlewareHandler();
        const components = {};

        const routerService = Habame.Services[Props.name || DEFAULT_ROUTER_NAME];
        State.useService(routerService);
        let currentComponent = null;

        const mountRouteComponent = function(route) {
            if(!Refs.routerRenderContainer) {
                return;
            }

            let key = route.getPath();

            if(!route.isUniqueInstance()) {
                key = route.getUrl();
            }
            if(components[key]) {
                currentComponent = components[key];
                currentComponent.mount();
                return components[key];
            }

            currentComponent = App.createComponentByName(route.getComponent(), null);
            components[key] = currentComponent;

            currentComponent.render(Refs.routerRenderContainer);
        };

        State.get('$route').onUpdate((route) => {
            if(currentComponent) {
                currentComponent.unmount();
            }
            if(!(route instanceof Route)) {
                return;
            }
            const middlewares = route.getMiddlewares();
            middlewares.push(mountRouteComponent);
            middlewareHandler.handle(middlewares, route);
        });

        Lifecycle.onCreated(() => {
            const historyHandler = routerService.historyHandler();
            if(historyHandler && typeof historyHandler.getCurrentLocation === 'function') {
                routerService.push(historyHandler.getCurrentLocation());
                if(historyHandler instanceof BrowserHistory) {
                    historyHandler.useService(routerService);
                }
            }  else {
                routerService.push('/');
            }
        });

    }, RouterView);
}