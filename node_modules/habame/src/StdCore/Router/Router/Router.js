import Route from "StdCore/Router/Router/Route";
import RouteHelper from "StdCore/Router/RouteHelper";
import RouteGroup from "StdCore/Router/Router/RouteGroup";
import RouteGroupBuilder from "StdCore/Router/Router/RouteGroupBuilder";

/**
 * @param {string} $name RouterService name
 * @param {Habame} Habame
 *
 * @class
 */
const Router = function($name, Habame) {

    const $routerGroupBuilder = new RouteGroupBuilder();

    const $namedRoutes = {};
    const $routes = [];

    let $routeNotFound = null;
    let $routerInstanceService = null;

    this.setNamedRoute = function(name, route) {
        $namedRoutes[name] = route;
    };

    this.getRouterService = function() {
        if($routerInstanceService) {
            return $routerInstanceService;
        }
        $routerInstanceService = Habame.Services[$name];
        return $routerInstanceService;
    };

    this.path = function(path, component) {
        const route = new Route(this);
        route.path(path, component);
        $routes.push(route);
        return route;
    };

    this.notFound = function(path, component) {
        const route = new Route(this);
        route.path(path, component);
        $routeNotFound = route;
    };

    this.prefix = function(prefix) {
        return (new RouteGroup(this)).prefix(prefix);
    };

    this.name = function(name) {
        return (new RouteGroup(this)).name(name);
    };

    this.middlewares = function() {
        return (new RouteGroup(this)).middlewares(...arguments);
    };

    this.groups = function() {
        return $routerGroupBuilder;
    };

    this.routeExists = function(routeName) {
        return $namedRoutes[routeName] !== undefined;
    };

    this.getRouteByName = function(name) {
        if(!$namedRoutes[name]) {
            throw new Error("Undefined route "+ name);
        }
        return $namedRoutes[name];
    };

    this.getRouteByPath = function(path) {
        const pathCleaned = RouteHelper.cleanPath(path);
        for(const route of $routes) {
            if(route.isMatch(pathCleaned)) {
                return route;
            }
        }
        if(!$routeNotFound) {
            throw new Error("Route not found: "+ path);
        }
        return $routeNotFound;
    };

    this.get = function(route) {
        if(route instanceof Route) {
            return route;
        }
        if(typeof route === 'object') {
            const routeFound = this.getRouteByName(route.name);
            if(routeFound) {
                routeFound.set(route.params, route.query, route.hash);
                return routeFound;
            }
        }
        if(typeof route === 'string') {
            const routeFound = this.getRouteByPath(route);
            if(routeFound) {
                return routeFound;
            }
        }

        return $routeNotFound;
    };

    this.push = function(route) {
        if(!route) {
            throw new Error("Router.push params require a valid param");
        }
        const routeFound = this.get(route);
        if(routeFound) {
            const service = this.getRouterService();
            service.pushRoute(routeFound);
            return;
        }

        throw new Error('Route not found');
    };
};

export default Router;