import { DEFAULT_ROUTER_NAME } from "StdCore/Router/constants";

const RouterLinkView =  {
    name: 'a',
    content: { name:'yield-fragment' },
    attrs: { href: '{{ href }}' },
    events: { 'prevent.click': 'push' }
};

/**
 * @param {Habame} Habame
 */
export default function Link(Habame) {
    Habame.createComponent('Link', function({ State, Props, Actions }) {

        State.init({ href: '' });

        const routerName = Props.router || DEFAULT_ROUTER_NAME;
        const router = Habame.Router.getRouter(routerName);

        if(!router) {
            throw new Error('Undefined Router '+ (Props.router || DEFAULT_ROUTER_NAME));
        }

        if(Props.to && !router.routeExists(Props.to)) {
            throw new Error('Undefined route name '+ Props.to);
        }

        const getRoute = function() {
            if(Props.to) {
                const route = router.getRouteByName(Props.to);
                route.set(Props.params || {}, Props.query, Props.hash);
                return route;
            }
            return router.getRouteByPath(Props.href);
        };

        const updateEndPoint = function() {
            const route = getRoute();
            State.href = route.getUrl();
        };

        Actions.push = function() {
            const route = getRoute();
            router.push(route);
        };


        (function() {
            updateEndPoint();
            if(Props.to) {
                Props.onUpdate('to', () => updateEndPoint());
                return;
            }
            if(Props.href) {
                Props.onUpdate('href', () => updateEndPoint());
            }
        }());

    }, RouterLinkView);
}